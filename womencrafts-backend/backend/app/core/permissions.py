"""
Granular permissions.

Module access answers "can this role open Users?". That was all we had, and it
is too blunt: a Support Agent needs to *read* members without being able to
delete them.

This adds the second half — what a role may DO inside a module. A permission is
`"<module>.<action>"`, e.g. `users.delete`. Roles store a flat list of those
strings, which keeps the check a set membership test rather than a walk through
nested objects on every request.

Two rules that keep it honest:

  * Super Admin bypasses everything. There is exactly one such role and it is
    the escape hatch when a permission set gets misconfigured.
  * Holding an action implies holding `view` on the same module. Nobody should
    be able to edit something they cannot see, and encoding that here means the
    UI can't produce that combination by accident.
"""

from fastapi import Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.rbac import SUPER_ADMIN, current_user_modules, role_name

# Action verbs, in the order the UI shows them.
VIEW = "view"
CREATE = "create"
EDIT = "edit"
DELETE = "delete"
EXPORT = "export"
APPROVE = "approve"

ACTION_LABELS = {
    VIEW: "View",
    CREATE: "Create",
    EDIT: "Edit",
    DELETE: "Delete",
    EXPORT: "Export",
    APPROVE: "Approve",
}

# module key -> (label, [actions it actually supports])
# Only list an action a module really has; a toggle that controls nothing is
# worse than no toggle at all.
CATALOGUE: dict[str, tuple[str, list[str]]] = {
    "dashboard": ("Dashboard", [VIEW, EXPORT]),
    "users": ("Users & Members", [VIEW, CREATE, EDIT, DELETE, EXPORT, APPROVE]),
    "appointments": ("Appointments", [VIEW, CREATE, EDIT, DELETE, EXPORT]),
    "services": ("Services & Types", [VIEW, CREATE, EDIT, DELETE]),
    "programs": ("Programmes", [VIEW, CREATE, EDIT, DELETE, EXPORT]),
    "calendar": ("Calendar", [VIEW, CREATE, EDIT, DELETE]),
    "messages": ("Messages", [VIEW, CREATE, EDIT, DELETE]),
    "analytics": ("Analytics", [VIEW, EXPORT]),
    "reports": ("Reports", [VIEW, CREATE, EXPORT]),
    "content": ("Content", [VIEW, CREATE, EDIT, DELETE, APPROVE]),
    "feedback": ("Feedback", [VIEW, EDIT, DELETE, EXPORT]),
    "ai": ("AI Command Center", [VIEW, EDIT]),
    "community": ("Community", [VIEW, CREATE, EDIT, DELETE, APPROVE]),
    "growth": ("Growth & Work", [VIEW, CREATE, EDIT, DELETE, APPROVE]),
    "safety": ("Safety & Support fund", [VIEW, EDIT, APPROVE, EXPORT]),
    "settings": ("Settings", [VIEW, EDIT]),
}


def all_permissions() -> list[str]:
    return [f"{mod}.{act}" for mod, (_label, acts) in CATALOGUE.items() for act in acts]


def total_count() -> int:
    return len(all_permissions())


def permissions_for_modules(modules: list[str]) -> list[str]:
    """
    A sensible starting set when a role has module access but no explicit
    permissions yet: everything except the destructive verbs.
    """
    granted: list[str] = []
    for mod in modules or []:
        label_actions = CATALOGUE.get(mod)
        if not label_actions:
            continue
        for act in label_actions[1]:
            if act in (DELETE, APPROVE):
                continue
            granted.append(f"{mod}.{act}")
    return granted


def normalise(permissions: list[str]) -> list[str]:
    """
    Drop anything unknown, and add the implied `view` for every module the role
    can act in. Applied on every write so stored data can never drift out of
    the shape the checks assume.
    """
    valid = set(all_permissions())
    kept = {p for p in (permissions or []) if p in valid}
    for perm in list(kept):
        module = perm.split(".", 1)[0]
        view = f"{module}.{VIEW}"
        if view in valid:
            kept.add(view)
    return sorted(kept)


def modules_from_permissions(permissions: list[str]) -> list[str]:
    """
    Module access is derived, never stored twice. A role can open exactly the
    modules it holds at least one permission in — so the two can't disagree.
    """
    mods = {p.split(".", 1)[0] for p in permissions or []}
    mods.add("dashboard")
    return sorted(m for m in mods if m in CATALOGUE)


def summarise(permissions: list[str]) -> list[dict]:
    """The grouped shape the roles screen renders, with real counts."""
    held = set(permissions or [])
    out = []
    for mod, (label, actions) in CATALOGUE.items():
        rows = [
            {
                "key": f"{mod}.{act}",
                "action": act,
                "label": ACTION_LABELS[act],
                "granted": f"{mod}.{act}" in held,
            }
            for act in actions
        ]
        out.append(
            {
                "module": mod,
                "label": label,
                "granted": sum(1 for r in rows if r["granted"]),
                "total": len(rows),
                "actions": rows,
            }
        )
    return out


async def user_permissions(user: dict) -> list[str]:
    """
    What this account may do: her role, adjusted for her.

    The role is the starting point, not the last word. Two people doing the
    same job often need different access — one Supervisor also handles safety
    reports, another must never see them — and the alternative to per-person
    adjustment is inventing a new role for every exception until nobody can
    say what any of them mean.

    So a staff account may carry `extra_permissions` (granted to her
    specifically) and `denied_permissions` (withheld from her specifically).
    Denials are applied last and win, because the reason to withhold something
    from one person is usually a stronger reason than the reason her role has
    it.

    Super Admin still bypasses everything — it is the escape hatch when a
    permission set is misconfigured, and a Super Admin who could be denied
    access is not an escape hatch.
    """
    from app.db.mongodb import get_database
    from app.models.role import RoleModel

    name = role_name(user)
    if name == SUPER_ADMIN:
        return all_permissions()

    role = await get_database()[RoleModel.collection_name].find_one({"name": name})
    stored = (role or {}).get("permissions")
    if isinstance(stored, list) and stored:
        base = set(normalise(stored))
    else:
        # No explicit set yet — fall back to what its module access implies.
        base = set(permissions_for_modules(await current_user_modules(user)))

    extra = {p for p in (user.get("extra_permissions") or []) if p in set(all_permissions())}
    denied = set(user.get("denied_permissions") or [])
    # `normalise` re-adds the implied `view` for anything granted, so a person
    # given `safety.approve` can actually open Safety.
    return sorted(set(normalise(sorted(base | extra))) - denied)


async def has_permission(user: dict, permission: str) -> bool:
    return permission in set(await user_permissions(user))


def require_permission(permission: str):
    """
    Dependency factory. `Depends(require_permission("users.delete"))` refuses
    anyone whose role does not hold it.
    """

    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if not await has_permission(user, permission):
            module, action = permission.split(".", 1)
            label = CATALOGUE.get(module, (module, []))[0]
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role cannot {ACTION_LABELS.get(action, action).lower()} in {label}",
            )
        return user

    return _guard

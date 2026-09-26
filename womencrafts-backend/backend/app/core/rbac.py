"""
Role-based access control.

Each role owns a list of MODULE keys it can open. The logged-in account carries
a `role`; its accessible modules are that role's list (Super Admin always gets
everything and is the only role allowed to edit access).
"""

from fastapi import Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.entitlements import Feature, allows
from app.db.mongodb import get_database
from app.models.role import RoleModel

SUPER_ADMIN = "Super Admin"

# The role every public sign-up gets. Members live in the member app (/app) and
# have NO access to the admin modules below — that separation is the whole point.
MEMBER_ROLE = "Member"

# Which application a role belongs to. Anything that isn't a plain Member is
# staff and lands in the admin dashboard.
AUDIENCE_MEMBER = "member"
AUDIENCE_STAFF = "staff"

# The top-level sections a role can be granted (match the sidebar).
ALL_MODULES = [
    "dashboard",
    "users",
    "appointments",
    "services",
    "programs",
    "calendar",
    "messages",
    "analytics",
    "reports",
    "content",
    "feedback",
    "ai",
    # The staff side of the member modules.
    "community",
    "growth",
    "safety",
    "settings",
    "market",
    "money",
    "learning",
    "resources",
]

# Sensible starting access per seeded role (Super Admin/Admin get everything).
DEFAULT_ROLE_MODULES = {
    "Super Admin": list(ALL_MODULES),
    "Admin": list(ALL_MODULES),
    "Instructor": ["dashboard", "appointments", "programs", "calendar", "messages", "content", "community", "growth"],
    "Supervisor": ["dashboard", "users", "appointments", "calendar", "feedback", "reports", "safety", "community", "growth"],
    "Regional Admin": ["dashboard", "users", "appointments", "programs", "calendar", "messages", "analytics", "reports", "community", "growth", "safety"],
    "Category Admin": ["dashboard", "users", "programs", "content", "analytics", "reports", "community", "growth", "learning", "resources"],
    "Member Manager": ["dashboard", "users", "appointments", "messages", "community", "growth", "safety"],
    # A Member gets NOTHING in the admin app — their experience is the member
    # app, which is gated by `audience`, not by these module keys.
    "Member": [],
    "Support Agent": ["dashboard", "messages", "feedback", "notifications", "safety", "community"],
    "Content Editor": ["dashboard", "content", "analytics"],
    "Viewer": ["dashboard", "analytics", "reports"],
}


def role_name(user: dict) -> str:
    """
    The account's role.

    An account with no role gets `Viewer`, not Super Admin.

    This used to default to Super Admin "for legacy/admin accounts", which
    meant any row that lost its `role` field — a bad migration, a hand-edited
    document, a bug in a write path — silently became the most privileged
    account on the platform. The blast radius of that default is the whole
    system; the blast radius of defaulting to the narrowest role is one
    confused colleague asking why she cannot see anything.
    """
    return user.get("role") or "Viewer"


def audience_for_role(name: str) -> str:
    """Which app this role signs in to — the member app or the admin dashboard."""
    return AUDIENCE_MEMBER if name == MEMBER_ROLE else AUDIENCE_STAFF


def is_member(user: dict) -> bool:
    return audience_for_role(role_name(user)) == AUDIENCE_MEMBER


async def require_active_member(user: dict = Depends(get_current_user)) -> dict:
    """
    Signed in, is a member, and has actually been admitted.

    Every member-facing router depends on this, so the admission gate lives in
    exactly one place. Staff accounts are refused here on purpose: a member area
    a staff token can read is a member area with no privacy.
    """
    from app.models.verification import VerificationStatus  # local: avoids a cycle

    if not is_member(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This area is for member accounts")
    if user.get("verification_status") != VerificationStatus.ACTIVE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is still being verified.")
    return user


async def modules_for_role(name: str) -> list[str]:
    if name == SUPER_ADMIN:
        return list(ALL_MODULES)
    # Members have no admin modules at all — never fall through to the
    # "everyone gets dashboard" default below.
    if name == MEMBER_ROLE:
        return []
    role = await get_database()[RoleModel.collection_name].find_one({"name": name})
    if role and isinstance(role.get("modules"), list) and role["modules"]:
        mods = [m for m in role["modules"] if m in ALL_MODULES]
    else:
        mods = list(DEFAULT_ROLE_MODULES.get(name, ["dashboard"]))
    if "dashboard" not in mods:
        mods = ["dashboard"] + mods
    return mods


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Block members from anything that belongs to the admin app."""
    if is_member(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This area is for staff accounts only",
        )
    return user


async def require_member(user: dict = Depends(get_current_user)) -> dict:
    """The mirror guard: member-app endpoints staff shouldn't post into."""
    if not is_member(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This endpoint is for member accounts",
        )
    return user


async def current_user_modules(user: dict) -> list[str]:
    """
    Which sections this account can open — her role, adjusted for her.

    Deliberately does NOT call `user_permissions`: that function falls back to
    this one when a role has no explicit permission set, and the two calling
    each other would recurse forever. So the per-person adjustment is applied
    here directly, from the same two fields.

    A module appears if her role grants it or a personal grant implies it, and
    disappears only when every action she would have had in it is denied —
    a sidebar entry that opens a page where nothing is permitted is worse
    than no entry.
    """
    name = role_name(user)
    mods = set(await modules_for_role(name))
    if name == SUPER_ADMIN:
        return sorted(mods)

    extra = user.get("extra_permissions") or []
    denied = set(user.get("denied_permissions") or [])
    mods |= {p.split(".", 1)[0] for p in extra}

    from app.core.permissions import CATALOGUE  # local: avoids a cycle
    for mod in list(mods):
        if mod == "dashboard":
            continue
        actions = CATALOGUE.get(mod, ("", []))[1]
        if actions and all(f"{mod}.{a}" in denied for a in actions):
            mods.discard(mod)

    return sorted(m for m in mods if m in ALL_MODULES)


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if role_name(user) != SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super Admin access required")
    return user


def module_guard(module_key: str):
    """Dependency factory — 403s if the caller's role can't open this module."""

    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        mods = await current_user_modules(user)
        if module_key not in mods:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role does not have access to the '{module_key}' module",
            )
        return user

    return _guard


def require_feature(feature: Feature):
    """
    Dependency factory — 403s if the caller's tier doesn't include this feature.

    Lives here rather than in `entitlements.py` so that module stays free of
    FastAPI: it is a portable engine, and the moment it imports `Depends` it
    stops being liftable into a project that isn't FastAPI.

    Today every personal feature is FREE, so this never refuses anyone. It is
    wired up now because threading it through finished screens later is the
    expensive part — see ADR-001 in the knowledge base.
    """

    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if not allows(user, feature):
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"'{feature.value}' is not included in your plan",
            )
        return user

    return _guard


async def ensure_rbac() -> None:
    """
    One-time backfill (idempotent): give every existing role a `modules` list if
    it lacks one, and make the primary admin account a Super Admin.
    """
    db = get_database()
    roles = db[RoleModel.collection_name]
    # These roles express the hierarchy used by staff scopes. They are created
    # idempotently for existing installations as well as fresh databases.
    scoped_roles = {
        "Regional Admin": "Manage members and operations in assigned regions",
        "Category Admin": "Manage assigned member and content categories",
        "Member Manager": "Support specifically assigned members and groups",
    }
    for name, desc in scoped_roles.items():
        if not await roles.find_one({"name": name}):
            doc = RoleModel.create_document(
                name=name, desc=desc, type="System",
                modules=DEFAULT_ROLE_MODULES[name],
            )
            await roles.insert_one(doc)
    async for role in roles.find({}):
        if not isinstance(role.get("modules"), list):
            mods = DEFAULT_ROLE_MODULES.get(role.get("name", ""), ["dashboard"])
            await roles.update_one({"_id": role["_id"]}, {"$set": {"modules": mods}})

    # A roleless account is backfilled to the NARROWEST staff role, never the
    # widest. This previously set them all to Super Admin, which turned a
    # missing field into full control of the platform.
    users = db["users"]
    await users.update_many(
        {"$or": [{"role": {"$exists": False}}, {"role": None}, {"role": ""}]},
        {"$set": {"role": "Viewer"}},
    )

    # Granular permissions backfill. Roles created before they existed get a
    # set derived from the modules they already had, so nobody silently gains
    # or loses access at the moment this ships.
    from app.core.permissions import all_permissions, normalise, permissions_for_modules

    async for role in roles.find({}):
        if isinstance(role.get("permissions"), list) and role["permissions"]:
            continue
        if role.get("name") == SUPER_ADMIN:
            granted = all_permissions()
        else:
            granted = normalise(permissions_for_modules(role.get("modules") or []))
        await roles.update_one(
            {"_id": role["_id"]}, {"$set": {"permissions": granted, "perms": len(granted)}}
        )

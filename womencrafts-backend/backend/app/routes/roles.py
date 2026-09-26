"""
Roles — what each kind of staff account may open and do.

── What a role is here ────────────────────────────────────────────────────
A role is a name plus a flat list of `"<module>.<action>"` permissions
(`app/core/permissions.py`). Module access is *derived* from that list, never
stored on its own, so the two cannot disagree. A staff account carries its
role by NAME (`users.role`), and `app/core/rbac.py` resolves access by looking
the name up — which is why renaming a role here must also move every account
that holds it, or they all silently become the narrowest role.

── What this file refuses ─────────────────────────────────────────────────
* Changing or deleting **Super Admin**. It is the way back in when another
  role is misconfigured; a Super Admin that can be edited is not that.
* Changing or deleting **Member**. It is the public sign-up role and the
  member app is gated on its name; touching it turns members into staff or
  locks every member out.
* Deleting a role somebody holds. The refusal says how many, and the screen
  can show who — move them first, then delete.

── Numbers are counted, not stored ────────────────────────────────────────
The old `users` field on a role document was written once by the seed and
never again ("Supervisor: 36" while nobody held it). Every count here comes
from the `users` collection at request time.

Every write is recorded through `app.core.audit.record` with the role's name
and what changed, so "who gave Support Agents the power to delete members"
has an answer.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import (
    CATALOGUE,
    all_permissions,
    modules_from_permissions,
    normalise,
    permissions_for_modules,
    require_permission,
    summarise,
    total_count,
)
from app.core.rbac import ALL_MODULES, MEMBER_ROLE, SUPER_ADMIN, require_super_admin
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.org import LayoutTemplateModel
from app.models.role import RoleModel
from app.models.staff_account import StaffAccountModel
from app.models.user import UserModel
from app.schemas.role import (
    PermissionGroup,
    RoleModulesUpdate,
    RolePermissions,
    RolePermissionsUpdate,
    RoleResponse,
)

router = APIRouter(prefix="/roles", tags=["Users"])

#: Roles nothing here may rename, reshape or delete — see the module note.
PROTECTED = {SUPER_ADMIN, MEMBER_ROLE}

NAME_MAX = 40


# ── shapes ───────────────────────────────────────────────────────────────────

class RoleOut(RoleResponse):
    """The list/detail row. `users` and `perms` are counted live."""
    permissions: list[str] = []
    protected: bool = False
    is_super_admin: bool = False
    is_member_role: bool = False


class RoleSummary(BaseModel):
    total: int
    system: int
    custom: int
    #: Staff accounts holding any staff role (members are not staff).
    staff_assigned: int
    #: Staff roles nobody holds.
    unused: int
    permissions_total: int


class RoleListOut(BaseModel):
    items: list[RoleOut]
    total: int
    summary: RoleSummary


class RoleCreateBody(BaseModel):
    name: str = Field(..., max_length=NAME_MAX)
    desc: str = ""
    icon: str = "ShieldCheck"
    permissions: list[str] = []
    #: Legacy clients send module keys instead; honoured only when
    #: `permissions` is empty.
    modules: Optional[list[str]] = None


class RolePatchBody(BaseModel):
    name: Optional[str] = Field(None, max_length=NAME_MAX)
    desc: Optional[str] = None
    icon: Optional[str] = None
    permissions: Optional[list[str]] = None


class RoleDuplicateBody(BaseModel):
    name: Optional[str] = Field(None, max_length=NAME_MAX)


class RoleHolder(BaseModel):
    id: str
    full_name: str
    email: str
    state: str


class RoleHolders(BaseModel):
    role_id: str
    role_name: str
    total: int
    #: Staff are listed; members are counted only (they belong on People).
    staff: list[RoleHolder]
    shown: int


# ── helpers ──────────────────────────────────────────────────────────────────

def _roles():
    return get_database()[RoleModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


async def _load(role_id: str) -> dict:
    doc = await _roles().find_one({"_id": to_object_id(role_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return doc


async def _holder_counts() -> dict[str, int]:
    """Accounts per role name, straight from the users collection."""
    out: dict[str, int] = {}
    async for g in _users().aggregate([{"$group": {"_id": "$role", "n": {"$sum": 1}}}]):
        if g.get("_id"):
            out[g["_id"]] = int(g["n"])
    return out


def _same_name(name: str) -> dict:
    """Case-insensitive exact match, so “admin” cannot shadow “Admin”."""
    return {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}


async def _check_name(name: str, *, exclude_id=None) -> str:
    name = " ".join((name or "").split())
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A role needs a name")
    if len(name) > NAME_MAX:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Keep the name under {NAME_MAX} characters"
        )
    if name.lower() in {p.lower() for p in PROTECTED}:
        raise HTTPException(status.HTTP_409_CONFLICT, f"“{name}” is reserved")
    query = _same_name(name)
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    if await _roles().find_one(query):
        raise HTTPException(status.HTTP_409_CONFLICT, f"A role called “{name}” already exists")
    return name


def _refuse_if_protected(doc: dict, what: str) -> None:
    name = doc.get("name", "")
    if name == SUPER_ADMIN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Super Admin cannot be {what}. It always holds every permission and is "
            "the way back in when another role is misconfigured.",
        )
    if name == MEMBER_ROLE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Member cannot be {what}. It is the public sign-up role and opens nothing "
            "in this dashboard.",
        )


def _permissions_of(doc: dict) -> list[str]:
    """
    A role's effective permission list.

    Super Admin is everything, whatever is stored. Member is nothing: rbac
    gives that role no modules regardless of any list on its document, so
    showing a list would describe access that does not exist. Roles created
    before granular permissions existed fall back to what their module access
    implies, exactly as `user_permissions` does.
    """
    name = doc.get("name")
    if name == SUPER_ADMIN:
        return all_permissions()
    if name == MEMBER_ROLE:
        return []
    stored = doc.get("permissions")
    if isinstance(stored, list) and stored:
        return normalise(stored)
    return normalise(permissions_for_modules(doc.get("modules") or []))


def _shape(doc: dict, holders: dict[str, int]) -> dict:
    out = RoleModel.to_response(doc)
    perms = _permissions_of(doc)
    name = doc.get("name", "")
    out["users"] = holders.get(name, 0)
    out["perms"] = len(perms)
    out["permissions"] = perms
    if name == SUPER_ADMIN:
        out["modules"] = list(ALL_MODULES)
    elif name == MEMBER_ROLE:
        out["modules"] = []
    else:
        out["modules"] = modules_from_permissions(perms)
    out["protected"] = name in PROTECTED
    out["is_super_admin"] = name == SUPER_ADMIN
    out["is_member_role"] = name == MEMBER_ROLE
    return out


def _perm_fields(granted: list[str]) -> dict:
    """The three stored fields that must always move together."""
    return {
        "permissions": granted,
        "modules": modules_from_permissions(granted),
        "perms": len(granted),
    }


def _diff_words(before: list[str], after: list[str], cap: int = 8) -> str:
    """“granted users.delete, users.export; revoked safety.view” — for the audit line."""
    b, a = set(before), set(after)
    added, removed = sorted(a - b), sorted(b - a)

    def clip(keys: list[str]) -> str:
        shown = ", ".join(keys[:cap])
        return shown + (f" and {len(keys) - cap} more" if len(keys) > cap else "")

    parts = []
    if added:
        parts.append(f"granted {clip(added)}")
    if removed:
        parts.append(f"revoked {clip(removed)}")
    return "; ".join(parts) if parts else "no permission changes"


async def _rename_everywhere(old: str, new: str) -> dict[str, int]:
    """
    Move every row that carries the old name.

    `users.role` is the one that decides access — an account left on the old
    name would resolve to Viewer at its next request. The other two are the
    People directory label and layout-template routing, which use the same
    vocabulary and would otherwise point at a role that no longer exists.
    """
    db = get_database()
    moved = {}
    for coll in (
        UserModel.collection_name,
        MemberModel.collection_name,
        LayoutTemplateModel.collection_name,
    ):
        res = await db[coll].update_many({"role": old}, {"$set": {"role": new}})
        moved[coll] = res.modified_count
    return moved


# ── reads ────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=RoleListOut,
    summary="List roles, with live holder counts",
    dependencies=[Depends(require_permission("users.view"))],
)
async def list_roles(
    q: Optional[str] = Query(None, description="Search by role name"),
    type: Optional[str] = Query(None, description="System or Custom"),
):
    query: dict = {}
    if type and type not in ("all", "All"):
        query["type"] = type
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    holders = await _holder_counts()
    # _id ascending preserves creation order (matches the UI ordering).
    items = [_shape(doc, holders) async for doc in _roles().find(query).sort("_id", 1)]

    # The summary is over EVERY role, not the filtered page, so the stat
    # cards do not change when somebody types in the search box.
    every = items if not query else [
        _shape(doc, holders) async for doc in _roles().find({}).sort("_id", 1)
    ]
    staff_roles = [r for r in every if not r["is_member_role"]]
    summary = RoleSummary(
        total=len(every),
        system=sum(1 for r in every if r["type"] == "System"),
        custom=sum(1 for r in every if r["type"] != "System"),
        staff_assigned=sum(r["users"] for r in staff_roles),
        unused=sum(1 for r in staff_roles if r["users"] == 0),
        permissions_total=total_count(),
    )
    return RoleListOut(items=[RoleOut(**r) for r in items], total=len(items), summary=summary)


@router.get("/catalogue/all", summary="Every permission the platform defines")
async def permission_catalogue(_: dict = Depends(get_current_user)):
    return {
        "modules": [
            {"module": mod, "label": label, "actions": actions}
            for mod, (label, actions) in CATALOGUE.items()
        ],
        "total": total_count(),
    }


@router.get("/me/permissions", summary="What the signed-in account may do")
async def my_permissions(me: dict = Depends(get_current_user)):
    from app.core.permissions import user_permissions

    held = await user_permissions(me)
    return {"permissions": held, "granted": len(held), "total": total_count()}


@router.get(
    "/{role_id}",
    response_model=RoleOut,
    summary="Get a role",
    dependencies=[Depends(require_permission("users.view"))],
)
async def get_role(role_id: str):
    doc = await _load(role_id)
    return RoleOut(**_shape(doc, await _holder_counts()))


@router.get(
    "/{role_id}/holders",
    response_model=RoleHolders,
    summary="Who holds this role",
    dependencies=[Depends(require_permission("users.view"))],
)
async def role_holders(role_id: str):
    """
    Staff are named so an admin can move them before deleting the role.
    Members are counted only — they are a directory of their own on People,
    and 57 names here would help nobody.
    """
    doc = await _load(role_id)
    name = doc.get("name", "")
    total = await _users().count_documents({"role": name})
    staff: list[RoleHolder] = []
    if name != MEMBER_ROLE:
        cursor = (
            _users()
            .find({"role": name}, {"full_name": 1, "email": 1, "is_active": 1, "hashed_password": 1})
            .sort("full_name", 1)
            .limit(25)
        )
        async for u in cursor:
            staff.append(
                RoleHolder(
                    id=str(u["_id"]),
                    full_name=u.get("full_name", "") or "",
                    email=u.get("email", "") or "",
                    state=StaffAccountModel.state(u),
                )
            )
    return RoleHolders(
        role_id=str(doc["_id"]), role_name=name, total=total, staff=staff, shown=len(staff)
    )


@router.get(
    "/{role_id}/permissions",
    response_model=RolePermissions,
    summary="A role's granular permissions",
    dependencies=[Depends(require_permission("users.view"))],
)
async def get_role_permissions(role_id: str):
    doc = await _load(role_id)
    held = _permissions_of(doc)
    return RolePermissions(
        role_id=str(doc["_id"]),
        role_name=doc.get("name", ""),
        is_super_admin=doc.get("name") == SUPER_ADMIN,
        granted=len(held),
        total=total_count(),
        groups=[PermissionGroup(**g) for g in summarise(held)],
    )


# ── writes (Super Admin only) ────────────────────────────────────────────────

@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED, summary="Create a role")
async def create_role(
    payload: RoleCreateBody, request: Request, me: dict = Depends(require_super_admin)
):
    name = await _check_name(payload.name)
    if payload.permissions:
        granted = normalise(payload.permissions)
    else:
        granted = normalise(permissions_for_modules(payload.modules or []))

    doc = RoleModel.create_document(
        name=name,
        desc=payload.desc,
        type="Custom",
        icon=payload.icon or "ShieldCheck",
    )
    doc.update(_perm_fields(granted))
    result = await _roles().insert_one(doc)
    doc["_id"] = result.inserted_id

    await record(
        me, "role.create", target=str(doc["_id"]),
        detail=f"Created role “{name}” with {len(granted)} of {total_count()} permissions "
               f"across {len(doc['modules'])} modules",
        request=request,
    )
    return RoleOut(**_shape(doc, {}))


@router.post(
    "/{role_id}/duplicate",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Copy a role, permissions and all",
)
async def duplicate_role(
    role_id: str,
    payload: RoleDuplicateBody,
    request: Request,
    me: dict = Depends(require_super_admin),
):
    src = await _load(role_id)
    src_name = src.get("name", "")
    if src_name == MEMBER_ROLE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Member holds no dashboard access; there is nothing to copy."
        )

    if payload.name and payload.name.strip():
        name = await _check_name(payload.name)
    else:
        # “Supervisor copy”, then “Supervisor copy 2”, … until one is free.
        base = f"{src_name} copy"
        name, n = base, 1
        while await _roles().find_one(_same_name(name)):
            n += 1
            name = f"{base} {n}"
        name = await _check_name(name)

    granted = _permissions_of(src)
    doc = RoleModel.create_document(
        name=name,
        desc=src.get("desc", ""),
        type="Custom",
        icon=src.get("icon", "ShieldCheck") or "ShieldCheck",
    )
    doc.update(_perm_fields(granted))
    result = await _roles().insert_one(doc)
    doc["_id"] = result.inserted_id

    await record(
        me, "role.duplicate", target=str(doc["_id"]),
        detail=f"Duplicated “{src_name}” as “{name}” ({len(granted)} permissions)",
        request=request,
    )
    return RoleOut(**_shape(doc, {}))


@router.patch("/{role_id}", response_model=RoleOut, summary="Rename, describe or reshape a role")
async def update_role(
    role_id: str,
    payload: RolePatchBody,
    request: Request,
    me: dict = Depends(require_super_admin),
):
    doc = await _load(role_id)
    _refuse_if_protected(doc, "changed")
    old_name = doc.get("name", "")

    updates: dict = {}
    changes: list[str] = []
    moved: dict[str, int] = {}

    if payload.name is not None:
        new_name = await _check_name(payload.name, exclude_id=doc["_id"])
        if new_name != old_name:
            updates["name"] = new_name
            moved = await _rename_everywhere(old_name, new_name)
            n = moved.get(UserModel.collection_name, 0)
            changes.append(
                f"renamed “{old_name}” → “{new_name}” "
                f"({n} account{'' if n == 1 else 's'} moved)"
            )

    if payload.desc is not None and payload.desc.strip() != (doc.get("desc") or ""):
        updates["desc"] = payload.desc.strip()
        changes.append("description changed")

    if payload.icon is not None and payload.icon != doc.get("icon"):
        updates["icon"] = payload.icon
        changes.append(f"icon → {payload.icon}")

    if payload.permissions is not None:
        before = _permissions_of(doc)
        after = normalise(payload.permissions)
        if set(before) != set(after):
            updates.update(_perm_fields(after))
            changes.append(
                f"permissions {len(before)} → {len(after)} ({_diff_words(before, after)})"
            )

    if not updates:
        return RoleOut(**_shape(doc, await _holder_counts()))

    updates["updated_at"] = datetime.now(timezone.utc)
    fresh = await _roles().find_one_and_update(
        {"_id": doc["_id"]}, {"$set": updates}, return_document=True
    )
    await record(
        me, "role.update", target=role_id,
        detail=f"“{fresh.get('name', old_name)}”: " + "; ".join(changes),
        request=request,
    )
    return RoleOut(**_shape(fresh, await _holder_counts()))


@router.delete("/{role_id}", summary="Delete a role nobody holds")
async def delete_role(role_id: str, request: Request, me: dict = Depends(require_super_admin)):
    doc = await _load(role_id)
    _refuse_if_protected(doc, "deleted")
    name = doc.get("name", "")

    held = await _users().count_documents({"role": name})
    if held:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{held} {'account holds' if held == 1 else 'accounts hold'} the {name} role. "
            "Move them to another role first.",
        )

    await _roles().delete_one({"_id": doc["_id"]})
    await record(
        me, "role.delete", target=role_id,
        detail=f"Deleted role “{name}” ({len(_permissions_of(doc))} permissions); nobody held it",
        request=request,
    )
    return {"message": "Role deleted", "name": name}


@router.put(
    "/{role_id}/permissions",
    response_model=RolePermissions,
    summary="Set a role's granular permissions (Super Admin only)",
)
async def set_role_permissions(
    role_id: str,
    payload: RolePermissionsUpdate,
    request: Request,
    me: dict = Depends(require_super_admin),
):
    doc = await _load(role_id)
    _refuse_if_protected(doc, "reshaped")

    before = _permissions_of(doc)
    # normalise() drops unknown keys and adds the implied view permissions, so
    # what lands in the database is always a shape the checks can rely on.
    granted = normalise(payload.permissions)

    fresh = await _roles().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {**_perm_fields(granted), "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if set(before) != set(granted):
        await record(
            me, "role.permissions", target=role_id,
            detail=f"“{fresh.get('name', '')}”: {len(before)} → {len(granted)} permissions "
                   f"({_diff_words(before, granted)})",
            request=request,
        )
    held = _permissions_of(fresh)
    return RolePermissions(
        role_id=str(fresh["_id"]),
        role_name=fresh.get("name", ""),
        is_super_admin=False,
        granted=len(held),
        total=total_count(),
        groups=[PermissionGroup(**g) for g in summarise(held)],
    )


@router.put(
    "/{role_id}/modules",
    response_model=RoleOut,
    summary="Set which modules a role can open (Super Admin only)",
)
async def set_role_modules(
    role_id: str,
    payload: RoleModulesUpdate,
    request: Request,
    me: dict = Depends(require_super_admin),
):
    """
    Kept for the older client. Module access is derived from permissions, so
    this edits the permission list: a module switched on gets its
    non-destructive actions, a module switched off loses every action in it.
    Writing `modules` alone would be overwritten by the next permission save.
    """
    doc = await _load(role_id)
    _refuse_if_protected(doc, "reshaped")

    wanted = {m for m in payload.modules if m in ALL_MODULES} | {"dashboard"}
    before = _permissions_of(doc)
    kept = [p for p in before if p.split(".", 1)[0] in wanted]
    already = {p.split(".", 1)[0] for p in kept}
    added = permissions_for_modules(sorted(wanted - already))
    granted = normalise(kept + added)

    fresh = await _roles().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {**_perm_fields(granted), "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if set(before) != set(granted):
        await record(
            me, "role.modules", target=role_id,
            detail=f"“{fresh.get('name', '')}” can now open: {', '.join(fresh['modules'])} "
                   f"({_diff_words(before, granted)})",
            request=request,
        )
    return RoleOut(**_shape(fresh, await _holder_counts()))

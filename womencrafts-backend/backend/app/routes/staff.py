"""
Staff accounts — creating them, and deciding what each person can do.

Before this existed there was no way to create a staff login at all. The only
endpoint that writes to `users` is `/auth/signup`, and it hardcodes
`role="Member"`; `POST /members` writes to the member directory and creates no
login, so anyone added there could not sign in. The one Super Admin was
seeded by hand and there was no way to make a second.

── Who may use this ────────────────────────────────────────────────────────
Creating, suspending and re-roling staff is Super Admin only. `users.view` is
enough to read the list, so a Supervisor can see who her colleagues are
without being able to change any of them.

── Three guard rails that are not optional ─────────────────────────────────
1. The last Super Admin cannot be suspended, demoted or deleted. Losing it
   locks everyone out of role management permanently, and there is no
   recovery path short of editing the database by hand.
2. Nobody can change their own role or suspend themselves. An admin who
   demotes herself by accident has the same problem as (1), and an admin who
   can promote herself makes every other permission decorative.
3. A staff account is suspended, never deleted. It is attached to the audit
   trail of everything it did, and deleting the row orphans that history.
"""

from datetime import datetime, timezone
import re
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field

from app.core import email as mailer
from app.core.audit import record
from app.core.config import settings
from app.core.permissions import all_permissions, normalise, require_permission
from app.core.rbac import (
    MEMBER_ROLE,
    SUPER_ADMIN,
    current_user_modules,
    require_super_admin,
    role_name,
)
from app.core.security import hash_password_async
from app.core.staff_scope import SCOPE_ASSIGNED, normalise_scope
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.role import RoleModel
from app.models.staff_account import (
    StaffAccountModel,
    StaffInviteModel,
    hash_token,
)
from app.models.user import UserModel

router = APIRouter(prefix="/staff", tags=["Admin · Staff"])


class StaffCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: str = Field(min_length=2, max_length=60)
    phone: str = Field(default="", max_length=32)


class RoleChange(BaseModel):
    role: str = Field(min_length=2, max_length=60)


class AccessChange(BaseModel):
    """Per-person adjustments on top of whatever her role grants."""
    extra_permissions: list[str] = Field(default_factory=list)
    denied_permissions: list[str] = Field(default_factory=list)


class ScopeChange(BaseModel):
    mode: str = Field(pattern="^(all|assigned)$")
    regions: list[str] = Field(default_factory=list, max_length=100)
    categories: list[str] = Field(default_factory=list, max_length=100)
    organizations: list[str] = Field(default_factory=list, max_length=100)
    communities: list[str] = Field(default_factory=list, max_length=200)
    member_ids: list[str] = Field(default_factory=list, max_length=500)


class AcceptInvite(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=200)


def _users():
    return get_database()[UserModel.collection_name]


def _invites():
    return get_database()[StaffInviteModel.collection_name]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such staff account")


async def _staff_roles() -> set[str]:
    """Every role that is not the member role — i.e. every staff role."""
    names = {r["name"] async for r in get_database()[RoleModel.collection_name].find({}, {"name": 1})}
    names.discard(MEMBER_ROLE)
    return names


async def _super_admin_count() -> int:
    return await _users().count_documents({"role": SUPER_ADMIN, "is_active": True})


async def _load(staff_id: str) -> dict:
    doc = await _users().find_one({"_id": _oid(staff_id)})
    if not doc or doc.get("role") == MEMBER_ROLE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such staff account")
    return doc


async def _guard_last_super_admin(doc: dict) -> None:
    """Refuse anything that would remove the final way in."""
    if doc.get("role") == SUPER_ADMIN and doc.get("is_active", True):
        if await _super_admin_count() <= 1:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This is the only Super Admin. Promote someone else first, "
                "or nobody will be able to manage roles.",
            )


def _guard_not_self(doc: dict, me: dict, what: str) -> None:
    if str(doc.get("_id")) == str(me.get("_id")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You cannot {what} your own account")


async def _shaped(doc: dict) -> dict:
    from app.core.permissions import user_permissions
    return StaffAccountModel.to_response(
        doc,
        modules=await current_user_modules(doc),
        permissions=await user_permissions(doc),
    )


# ── the list ────────────────────────────────────────────────────────────────

@router.get("", summary="Everyone with staff access",
            dependencies=[Depends(require_permission("users.view"))])
async def list_staff(
    q: str = Query("", description="Name or email"),
    role: str = Query("", description="Filter to one role"),
    state: str = Query("", description="invited | active | suspended"),
):
    staff_roles = await _staff_roles()
    query: dict = {"role": {"$in": list(staff_roles)}}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]

    rows = [await _shaped(d) async for d in _users().find(query).sort("created_at", -1)]
    if state:
        rows = [r for r in rows if r["state"] == state]

    return {
        "staff": rows,
        "total": len(rows),
        "by_state": {
            s: sum(1 for r in rows if r["state"] == s)
            for s in ("invited", "active", "suspended")
        },
        # So the screen can warn before an action that would strand everyone.
        "super_admins": await _super_admin_count(),
    }


@router.get("/roles", summary="Roles a staff account can be given",
            dependencies=[Depends(require_permission("users.view"))])
async def assignable_roles():
    out = []
    async for r in get_database()[RoleModel.collection_name].find({}):
        if r.get("name") == MEMBER_ROLE:
            continue
        out.append({
            "id": str(r["_id"]),
            "name": r.get("name", ""),
            "desc": r.get("desc", ""),
            "modules": r.get("modules") or [],
            "permissions": len(r.get("permissions") or []),
        })
    return {"roles": sorted(out, key=lambda r: r["name"])}


@router.get("/scope-options", summary="Search values available for staff assignments")
async def scope_options(
    kind: Literal["region", "category", "member"] = Query(...),
    q: str = Query("", max_length=100),
    limit: int = Query(30, ge=1, le=100),
    _: dict = Depends(require_super_admin),
):
    members = get_database()[MemberModel.collection_name]
    needle = re.compile(re.escape(q.strip()), re.IGNORECASE) if q.strip() else None
    if kind in ("region", "category"):
        field = "location" if kind == "region" else "segment"
        values = await members.distinct(field)
        cleaned = sorted({str(v).strip() for v in values if str(v).strip()})
        if needle:
            cleaned = [v for v in cleaned if needle.search(v)]
        return {"options": [{"value": v, "label": v} for v in cleaned[:limit]]}

    query = {}
    if needle:
        query = {"$or": [
            {"full_name": needle}, {"email": needle}, {"code": needle},
        ]}
    rows = await members.find(query, {"full_name": 1, "email": 1, "code": 1}).sort("full_name", 1).limit(limit).to_list(limit)
    return {"options": [{
        "value": str(row["_id"]),
        "label": row.get("full_name") or row.get("email") or str(row["_id"]),
        "detail": " · ".join(v for v in (row.get("code", ""), row.get("email", "")) if v),
    } for row in rows]}


# ── creating one ────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED,
             summary="Invite a staff member (Super Admin only)")
async def create_staff(body: StaffCreate, me: dict = Depends(require_super_admin)):
    """
    Creates the login and an invitation. **No password is set here.**

    The invitation is emailed automatically. The raw token also comes back
    exactly once so the Super Admin has a copyable fallback if delivery is
    delayed. It is stored only as a digest and cannot be read again.
    """
    email = str(body.email).lower().strip()
    if body.role == MEMBER_ROLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is the member role, not a staff role")
    if body.role not in await _staff_roles():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No such role")
    if await _users().find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    db = get_database()
    # A staff member gets a directory row too, so she appears in People with a
    # code like everyone else rather than existing only as a login.
    member_doc = MemberModel.create_document(
        full_name=body.full_name, email=email, phone=body.phone,
        role=body.role, status="Active",
        code=await _next_code(db),
    )
    member_id = str((await db[MemberModel.collection_name].insert_one(member_doc)).inserted_id)

    doc = UserModel.create_document(
        full_name=body.full_name,
        email=email,
        # Empty until she accepts. `StaffAccountModel.state` reads this as
        # `invited`, and `/auth/signin` refuses an account with no password.
        hashed_password="",
        role=body.role,
        member_id=member_id,
        phone=body.phone,
    )
    # Staff are not members and never walk the admission path.
    doc["verification_status"] = "active"
    res = await _users().insert_one(doc)
    doc["_id"] = res.inserted_id

    invite, raw = StaffInviteModel.create_document(
        user_id=str(res.inserted_id), email=email, invited_by=str(me["_id"]),
    )
    await _invites().insert_one(invite)

    invite_url = f"{settings.APP_BASE_URL.rstrip('/')}/accept-invite?token={raw}"
    delivered = await mailer.send(
        mailer.staff_invitation_email(body.full_name, body.role, invite_url), email
    )

    await record(me, "staff.invite", target=str(res.inserted_id),
                 detail=f"{body.full_name} <{email}> as {body.role}"
                        + (" (invitation emailed)" if delivered else " (email delivery failed)"))

    return {
        "staff": await _shaped(doc),
        # Shown once. The screen copies it and says so.
        "invite_token": raw,
        "expires_in_hours": 72,
        "email_sent": delivered,
    }


async def _next_code(db) -> str:
    n = await db[MemberModel.collection_name].count_documents({})
    return f"WC-{n + 1:04d}"


@router.post("/{staff_id}/resend", summary="Issue a fresh invitation (Super Admin only)")
async def resend_invite(staff_id: str, me: dict = Depends(require_super_admin)):
    doc = await _load(staff_id)
    if doc.get("hashed_password"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She has already set a password")

    # The previous token stops working the moment a new one is issued.
    await _invites().delete_many({"user_id": staff_id, "accepted_at": None})
    invite, raw = StaffInviteModel.create_document(
        user_id=staff_id, email=doc.get("email", ""), invited_by=str(me["_id"]),
    )
    await _invites().insert_one(invite)
    invite_url = f"{settings.APP_BASE_URL.rstrip('/')}/accept-invite?token={raw}"
    delivered = await mailer.send(
        mailer.staff_invitation_email(doc.get("full_name", ""), doc.get("role", ""), invite_url),
        doc.get("email", ""),
    )
    await record(
        me, "staff.reinvite", target=staff_id,
        detail=doc.get("email", "")
               + (" (invitation emailed)" if delivered else " (email delivery failed)"),
    )
    return {"invite_token": raw, "expires_in_hours": 72, "email_sent": delivered}


# ── accepting one ───────────────────────────────────────────────────────────

@router.post("/accept", summary="Set a password with an invitation token")
async def accept_invite(body: AcceptInvite):
    """
    Public on purpose — she has no account to sign in with yet. The token is
    the credential, it is single-use, and it expires.
    """
    invite = await _invites().find_one({"token_hash": hash_token(body.token)})
    if not StaffInviteModel.is_live(invite):
        # One message for wrong, used and expired alike: a distinct "expired"
        # reply confirms to a stranger that the token was once real.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invitation is no longer valid")

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": _oid(invite["user_id"])},
        {"$set": {"hashed_password": await hash_password_async(body.password),
                  "is_active": True, "updated_at": now}},
    )
    await _invites().update_one({"_id": invite["_id"]}, {"$set": {"accepted_at": now}})
    return {"ok": True, "email": invite.get("email", "")}


# ── changing what she can do ────────────────────────────────────────────────

@router.patch("/{staff_id}/role", summary="Change someone's role (Super Admin only)")
async def change_role(staff_id: str, body: RoleChange, me: dict = Depends(require_super_admin)):
    doc = await _load(staff_id)
    _guard_not_self(doc, me, "change the role of")
    if body.role == MEMBER_ROLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is the member role, not a staff role")
    if body.role not in await _staff_roles():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No such role")
    if doc.get("role") != body.role:
        await _guard_last_super_admin(doc)

    was = doc.get("role", "")
    await _users().update_one({"_id": doc["_id"]},
                              {"$set": {"role": body.role, "updated_at": datetime.now(timezone.utc)}})
    doc["role"] = body.role
    await record(me, "staff.role", target=staff_id, detail=f"{was} → {body.role}")
    return await _shaped(doc)


@router.put("/{staff_id}/access", summary="Adjust one person's access (Super Admin only)")
async def set_access(staff_id: str, body: AccessChange, me: dict = Depends(require_super_admin)):
    """
    Grants and withholds specific permissions for this person, on top of her
    role. See `user_permissions` for why denials win.
    """
    doc = await _load(staff_id)
    valid = set(all_permissions())
    extra = normalise([p for p in body.extra_permissions if p in valid])
    denied = sorted({p for p in body.denied_permissions if p in valid})
    overlap = set(extra) & set(denied)
    if overlap:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot both grant and withhold: {', '.join(sorted(overlap))}",
        )

    await _users().update_one(
        {"_id": doc["_id"]},
        {"$set": {"extra_permissions": extra, "denied_permissions": denied,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    doc["extra_permissions"], doc["denied_permissions"] = extra, denied
    await record(me, "staff.access", target=staff_id,
                 detail=f"+{len(extra)} / −{len(denied)}")
    return await _shaped(doc)


@router.put("/{staff_id}/scope", summary="Assign the records one staff member may access")
async def set_scope(staff_id: str, body: ScopeChange, me: dict = Depends(require_super_admin)):
    doc = await _load(staff_id)
    _guard_not_self(doc, me, "change the scope of")
    if doc.get("role") == SUPER_ADMIN and body.mode != "all":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A Super Admin always has platform-wide scope")

    scope = normalise_scope(body.model_dump())
    assigned = sum(len(scope[key]) for key in (
        "regions", "categories", "organizations", "communities", "member_ids"
    ))
    if scope["mode"] == SCOPE_ASSIGNED and assigned == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Choose at least one region, category, organization, community, or member",
        )

    await _users().update_one(
        {"_id": doc["_id"]},
        {"$set": {"staff_scope": scope, "updated_at": datetime.now(timezone.utc)},
         "$inc": {"token_version": 1}},
    )
    doc["staff_scope"] = scope
    await record(
        me, "staff.scope", target=staff_id,
        detail="All records" if scope["mode"] == "all" else f"{assigned} scope assignments",
    )
    return await _shaped(doc)


@router.post("/{staff_id}/suspend", summary="Suspend a staff account (Super Admin only)")
async def suspend(staff_id: str, me: dict = Depends(require_super_admin)):
    doc = await _load(staff_id)
    _guard_not_self(doc, me, "suspend")
    await _guard_last_super_admin(doc)
    await _users().update_one(
        {"_id": doc["_id"]},
        # Bumping the token version ends her open sessions immediately —
        # suspending someone who stays signed in until her token expires is
        # not suspending her.
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)},
         "$inc": {"token_version": 1}},
    )
    doc["is_active"] = False
    await record(me, "staff.suspend", target=staff_id, detail=doc.get("email", ""))
    return await _shaped(doc)


@router.post("/{staff_id}/restore", summary="Bring a suspended account back (Super Admin only)")
async def restore(staff_id: str, me: dict = Depends(require_super_admin)):
    doc = await _load(staff_id)
    await _users().update_one(
        {"_id": doc["_id"]},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}},
    )
    doc["is_active"] = True
    await record(me, "staff.restore", target=staff_id, detail=doc.get("email", ""))
    return await _shaped(doc)

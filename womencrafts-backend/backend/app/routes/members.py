from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.config import settings
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.user import UserModel
from app.routes._paging import paged
from app.schemas.member import (
    MemberCreate,
    MemberListResponse,
    MemberResponse,
    MemberStatsResponse,
    MemberStatusUpdate,
    MemberUpdate,
)

router = APIRouter(prefix="/members", tags=["Users"])


def _members():
    return get_database()[MemberModel.collection_name]


async def _next_code() -> str:
    """Generate the next 'WC-#####' code, one above the current highest."""
    highest = 12564
    async for doc in _members().find({}, {"code": 1}):
        code = str(doc.get("code", ""))
        if code.startswith("WC-") and code[3:].isdigit():
            highest = max(highest, int(code[3:]))
    return f"WC-{highest + 1}"


@router.get("", response_model=MemberListResponse, summary="List members")
async def list_members(
    q: Optional[str] = Query(None, description="Search by name, email, phone or code"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    segment: Optional[str] = Query(None, description="Filter by segment"),
    sort: str = Query("-created_at", description="Sort field; prefix '-' for descending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if role and role not in ("All Roles", "all"):
        query["role"] = role
    if status and status not in ("All Status", "all"):
        query["status"] = status
    if segment and segment not in ("All Segments", "all"):
        query["segment"] = segment
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["full_name", "email", "phone", "code"]))

    total, docs = await paged(
        _members(), query,
        sort=sort.lstrip("-"), direction=-1 if sort.startswith("-") else 1,
        page=page, page_size=page_size,
    )
    items = [MemberModel.to_response(doc) for doc in docs]
    return MemberListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=MemberStatsResponse, summary="Member statistics")
async def member_stats(_: dict = Depends(get_current_user)):
    docs = [doc async for doc in _members().find({})]
    total = len(docs)

    by_role: dict[str, int] = {}
    by_segment: dict[str, int] = {}
    engagement_sum = 0
    for doc in docs:
        by_role[doc.get("role", "")] = by_role.get(doc.get("role", ""), 0) + 1
        by_segment[doc.get("segment", "")] = by_segment.get(doc.get("segment", ""), 0) + 1
        engagement_sum += doc.get("engagement", 0)

    def count_status(value: str) -> int:
        return sum(1 for doc in docs if doc.get("status") == value)

    return MemberStatsResponse(
        total=total,
        active=count_status("Active"),
        inactive=count_status("Inactive"),
        pending=count_status("Pending"),
        rejected=count_status("Rejected"),
        avg_engagement=round(engagement_sum / total, 1) if total else 0.0,
        by_role=by_role,
        by_segment=by_segment,
    )


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED, summary="Create a member", dependencies=[Depends(require_permission("users.create"))])
async def create_member(payload: MemberCreate, _: dict = Depends(get_current_user)):
    email = str(payload.email).lower().strip()
    if await _members().find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A member with this email already exists")

    doc = MemberModel.create_document(
        full_name=payload.full_name,
        email=email,
        phone=payload.phone,
        role=payload.role,
        status=payload.status,
        location=payload.location,
        segment=payload.segment,
        gender=payload.gender,
        dob=payload.dob,
        referral=payload.referral,
        engagement=payload.engagement,
        avatar=payload.avatar,
        code=await _next_code(),
        verified_on="Awaiting review" if payload.status == "Pending" else "",
    )
    result = await _members().insert_one(doc)
    doc["_id"] = result.inserted_id
    return MemberResponse(**MemberModel.to_response(doc))


@router.get("/{member_id}", response_model=MemberResponse, summary="Get a member")
async def get_member(member_id: str, _: dict = Depends(get_current_user)):
    doc = await _members().find_one({"_id": to_object_id(member_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return MemberResponse(**MemberModel.to_response(doc))


@router.patch("/{member_id}", response_model=MemberResponse, summary="Update a member", dependencies=[Depends(require_permission("users.edit"))])
async def update_member(member_id: str, payload: MemberUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(member_id)
    updates = payload.model_dump(exclude_unset=True)

    if updates.get("email"):
        updates["email"] = str(updates["email"]).lower().strip()
        clash = await _members().find_one({"email": updates["email"], "_id": {"$ne": oid}})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another member already uses this email")

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _members().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return MemberResponse(**MemberModel.to_response(doc))


@router.patch("/{member_id}/status", response_model=MemberResponse, summary="Change a member's status", dependencies=[Depends(require_permission("users.edit"))])
async def set_member_status(member_id: str, payload: MemberStatusUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(member_id)
    doc = await _members().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return MemberResponse(**MemberModel.to_response(doc))


@router.delete("/{member_id}", summary="Delete a member", dependencies=[Depends(require_permission("users.delete"))])
async def delete_member(member_id: str, _: dict = Depends(get_current_user)):
    """
    Delete a member, and everything that only existed because of her.

    **This used to delete one row.** `members.delete_one` removed the directory
    profile and left everything else exactly where it was:

      · her `users` row survived, so the login still worked — an account that
        could sign in, with no profile behind it, which is a broken state no
        screen is written for;
      · her documents, notifications, messages, saved items and reset tokens
        all stayed, pointing at a member who no longer existed. Mongo has no
        foreign keys and nothing cascades, so nothing said a word.

    What is deleted and what survives is declared in `app/core/integrity.py`
    rather than here, so a new collection is one line in one table instead of a
    rule somebody has to remember to add to this function. Her financial
    records SURVIVE with the pointer cleared — a wallet transaction is a record
    of money that actually moved, and deleting it to tidy a reference would be
    falsifying a ledger.

    Her identity documents are deleted from disk as well as from the database.
    Leaving an encrypted photograph of somebody's Aadhaar card on a server
    after she has been removed is not a filing error.
    """
    from pathlib import Path

    from app.core import integrity
    from app.core.config import settings

    db = get_database()
    member = await db[MemberModel.collection_name].find_one({"_id": to_object_id(member_id)})
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    # The login behind the profile, if there is one. Matched on email because
    # that is the only link the two collections share in both directions.
    user = await db[UserModel.collection_name].find_one({"email": member.get("email", "")})

    removed: dict[str, int] = {}
    if user:
        uid = str(user["_id"])
        # Her ID documents, off the disk as well as out of the database.
        folder = Path(settings.PRIVATE_MEDIA_DIR) / uid
        if folder.exists():
            for f in folder.glob("*"):
                f.unlink(missing_ok=True)
            folder.rmdir()
        removed.update(await integrity.cascade_delete("users", user["_id"]))
        await db[UserModel.collection_name].delete_one({"_id": user["_id"]})
        removed["users deleted"] = 1

    removed.update(await integrity.cascade_delete("members", member["_id"]))
    await db[MemberModel.collection_name].delete_one({"_id": member["_id"]})

    detail = ", ".join(f"{n} {what}" for what, n in sorted(removed.items())) or "nothing else"
    return {"message": f"Member deleted. Also removed: {detail}."}


@router.post(
    "/{member_id}/reset-password",
    response_model=dict,
    summary="Start a password reset for a member",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def start_password_reset(member_id: str, me: dict = Depends(get_current_user)):
    """
    Staff-initiated password reset.

    We never set a password on someone's behalf and we never reveal one — that
    would mean a staff member briefly knowing a member's credentials. Instead
    this issues a single-use, 24-hour link and emails it to her.
    """
    from app.core.email import reset_email, send
    from app.models.verification import EmailTokenModel
    from app.routes.staff_account import log_activity

    db = get_database()
    member = await db[MemberModel.collection_name].find_one({"_id": to_object_id(member_id)})
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    user = await db[UserModel.collection_name].find_one({"email": member.get("email", "")})
    if not user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That member has no sign-in account to reset"
        )

    # Retire any earlier unused reset link, so only the newest one works.
    await db[EmailTokenModel.collection_name].delete_many(
        {"user_id": str(user["_id"]), "purpose": EmailTokenModel.PURPOSE_RESET, "used_at": None}
    )
    token_doc = EmailTokenModel.create_document(
        str(user["_id"]), EmailTokenModel.PURPOSE_RESET, hours=24
    )
    await db[EmailTokenModel.collection_name].insert_one(token_doc)

    url = f"{settings.APP_BASE_URL}/reset-password?token={token_doc['token']}"
    delivered = await send(
        reset_email(user.get("full_name", ""), url, by_staff=True), user["email"]
    )

    await log_activity(
        me, "Started a password reset", "Users",
        target=member.get("full_name", member.get("email", "")),
    )
    return {
        "message": f"A reset link has been sent to {user['email']}. It expires in 24 hours.",
        "delivered": delivered,
    }

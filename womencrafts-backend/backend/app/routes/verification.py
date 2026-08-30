"""
Account verification — the admission path for member accounts.

Two audiences share this module:
  • the applicant  — confirms her email, uploads an ID, watches her status
  • an admin       — reviews the queue, opens the document, approves or rejects

Security posture, deliberately:
  • ID documents are written to PRIVATE_MEDIA_DIR, which is NOT statically
    served. There is no public URL for them, ever.
  • The only way to read one is an admin-authenticated streaming endpoint that
    records who opened it.
  • A member can only ever see her OWN status and documents; the user id comes
    from the token, never from the request body.
"""

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from app.core.config import settings
from app.core.deps import get_current_user
from app.core import email as mailer
from app.core import docvault
from app.core.permissions import require_permission
from app.core.rbac import require_staff
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.user import UserModel
from app.models.verification import DocumentModel, EmailTokenModel, VerificationStatus
from app.schemas.verification import (
    DocumentResponse,
    MessageResponse,
    RejectRequest,
    VerificationQueueItem,
    VerificationQueueResponse,
    VerificationStatusResponse,
)

router = APIRouter(prefix="/verification", tags=["Verification"])

# Identity documents live here — separate from `media/`, never mounted static.
PRIVATE_ROOT = Path(settings.PRIVATE_MEDIA_DIR)
if not PRIVATE_ROOT.is_absolute():
    PRIVATE_ROOT = Path(__file__).resolve().parents[2] / settings.PRIVATE_MEDIA_DIR
PRIVATE_ROOT.mkdir(parents=True, exist_ok=True)

# A scan or a photo of a card — images plus PDF.
ALLOWED_DOC_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
}

CHUNK = 1024 * 1024


def _users():
    return get_database()[UserModel.collection_name]


def _docs():
    return get_database()[DocumentModel.collection_name]


def _tokens():
    return get_database()[EmailTokenModel.collection_name]


def _safe_stem(name: str) -> str:
    stem = Path(name or "").stem[:32]
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-.").lower() or "document"


async def issue_email_token(user_id: str, purpose: str = EmailTokenModel.PURPOSE_VERIFY) -> str:
    """Invalidate any outstanding token for this purpose, then mint a fresh one."""
    await _tokens().update_many(
        {"user_id": user_id, "purpose": purpose, "used_at": None},
        {"$set": {"used_at": datetime.now(timezone.utc)}},
    )
    doc = EmailTokenModel.create_document(user_id, purpose, settings.EMAIL_TOKEN_HOURS)
    await _tokens().insert_one(doc)
    return doc["token"]


async def send_verification_email(user: dict) -> None:
    token = await issue_email_token(str(user["_id"]))
    url = f"{settings.APP_BASE_URL.rstrip('/')}/verify-email?token={token}"
    await mailer.send(mailer.verification_email(user.get("full_name", ""), url), user["email"])


# --- applicant ---------------------------------------------------------------

@router.get("/status", response_model=VerificationStatusResponse, summary="Where my account stands")
async def my_status(current_user: dict = Depends(get_current_user)):
    state = current_user.get("verification_status") or VerificationStatus.ACTIVE
    docs = [
        DocumentModel.to_response(d)
        async for d in _docs().find({"user_id": str(current_user["_id"])}).sort("created_at", -1)
    ]
    return VerificationStatusResponse(
        status=state,
        label=VerificationStatus.LABELS.get(state, state),
        email=current_user.get("email", ""),
        rejection_reason=current_user.get("rejection_reason", ""),
        can_use_app=state in VerificationStatus.USABLE,
        documents=docs,
    )


@router.post("/resend-email", response_model=MessageResponse, summary="Resend the confirmation email")
async def resend_email(current_user: dict = Depends(get_current_user)):
    if current_user.get("verification_status") != VerificationStatus.PENDING_EMAIL:
        return MessageResponse(message="Your email address is already confirmed.")
    await send_verification_email(current_user)
    return MessageResponse(message="We've sent you a fresh confirmation link.")


@router.post("/confirm-email", response_model=MessageResponse, summary="Confirm an email address")
async def confirm_email(token: str = Query(..., description="Token from the emailed link")):
    """
    Public on purpose — she clicks this straight from her inbox, possibly on a
    device where she isn't signed in yet.
    """
    record = await _tokens().find_one(
        {"token": token, "purpose": EmailTokenModel.PURPOSE_VERIFY}
    )
    if not EmailTokenModel.is_valid(record):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That confirmation link is invalid or has expired. Please request a new one.",
        )

    user = await _users().find_one({"_id": ObjectId(record["user_id"])})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    now = datetime.now(timezone.utc)
    await _tokens().update_one({"_id": record["_id"]}, {"$set": {"used_at": now}})

    # Only advance if she is still waiting on this step.
    if user.get("verification_status") == VerificationStatus.PENDING_EMAIL:
        await _users().update_one(
            {"_id": user["_id"]},
            {"$set": {
                "verification_status": VerificationStatus.PENDING_DOCUMENTS,
                "email_verified_at": now,
                "updated_at": now,
            }},
        )
    return MessageResponse(message="Email confirmed. Next, upload your ID so we can verify you.")



async def save_document_file(file, user: dict) -> tuple[str, str, int]:
    """
    Write one uploaded document to private storage.

    Shared by the identity check and the paper vault, which are two different
    acts on the same store: submitting an ID puts an account into review, while
    adding a passbook to her vault must not. Keeping the *saving* in one place
    and the *consequences* at the call sites is what keeps that distinction
    from being made twice and differently.

    Returns (stored_name, extension, size).
    """
    extension = ALLOWED_DOC_TYPES.get((file.content_type or "").lower())
    if not extension:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Please upload a JPG, PNG, WEBP, HEIC or PDF.",
        )

    # One folder per account keeps documents isolated and easy to purge.
    folder = PRIVATE_ROOT / str(user["_id"])
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{_safe_stem(file.filename)}-{uuid.uuid4().hex[:12]}{extension}"
    destination = folder / stored_name

    limit = settings.MAX_DOCUMENT_MB * 1024 * 1024
    size = 0
    try:
        with destination.open("wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    out.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"That file is larger than the {settings.MAX_DOCUMENT_MB} MB limit.",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        destination.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Could not save the file: {exc}")

    # Encrypt at rest, if a key is configured.
    #
    # The web path around this file is careful — private directory, uuid in the
    # name, one audited reader. None of that helps once the bytes are somewhere
    # else: a backup, a snapshot, a laptop. What is on disk is a photograph of a
    # government ID belonging to a woman who may be hiding from someone.
    #
    # `available()` rather than unconditional: with no `DOCUMENT_ENCRYPTION_KEY`
    # this does nothing at all and the platform behaves exactly as before. The
    # day a key is set, new documents are encrypted and old ones keep opening,
    # because `docvault.read_file` passes plaintext through — so this can be
    # switched on without a flag day. See `app/core/docvault.py`.
    #
    # A failure here deletes the file rather than leaving a plaintext ID behind
    # on a platform that has been told to encrypt them. She is asked to upload
    # again, which is a far better outcome than the one where we quietly keep
    # the unencrypted copy.
    if docvault.available():
        try:
            docvault.encrypt_file(destination)
        except Exception as exc:  # noqa: BLE001
            destination.unlink(missing_ok=True)
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                f"Could not store that document securely: {exc}",
            )

    # `size` stays the PLAINTEXT byte count measured above, not what is now on
    # disk. It is the size of her document, which is what the screen shows her
    # and what the upload limit was checked against; the envelope's 16 bytes are
    # our business, not hers.
    return f"{user['_id']}/{stored_name}", extension, size


@router.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an identity document",
)
async def upload_document(
    file: UploadFile = File(..., description="Photo or scan of a government ID"),
    doc_type: str = Form("other", description="aadhaar | pan | passport | voter_id | driving_licence | national_id | other"),
    current_user: dict = Depends(get_current_user),
):
    state = current_user.get("verification_status")
    if state == VerificationStatus.ACTIVE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your account is already verified.")
    if state == VerificationStatus.PENDING_EMAIL:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Please confirm your email address first — check your inbox.",
        )

    stored_name, _extension, size = await save_document_file(file, current_user)

    doc = DocumentModel.create_document(
        user_id=str(current_user["_id"]),
        member_id=current_user.get("member_id") or "",
        doc_type=doc_type,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        content_type=file.content_type or "",
        size=size,
    )
    result = await _docs().insert_one(doc)
    doc["_id"] = result.inserted_id

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": current_user["_id"]},
        {"$set": {"verification_status": VerificationStatus.IN_REVIEW, "updated_at": now}},
    )
    await mailer.send(
        mailer.submitted_email(current_user.get("full_name", "")), current_user["email"]
    )
    return DocumentResponse(**DocumentModel.to_response(doc))


# --- reviewer (approvers only) -----------------------------------------------
#
# These four were guarded by `require_staff`, which means one thing and one
# thing only: **the caller is not a Member**. It does not mean the caller is a
# reviewer. A Viewer, a Content Editor, a Support Agent — every staff role in
# the catalogue passed it.
#
# What sat behind that guard is every applicant's Aadhaar and PAN. The queue
# hands back the document ids, `/documents/{id}/file` streams the scan, and the
# two together are a complete path from "I can sign in" to "I have four hundred
# women's identity documents on my laptop". Whoever did it would be in the
# access log, which is a record of the leak, not a control against it.
#
# `users.approve` already existed in the permission catalogue and nothing used
# it. It is exactly the right name for this: the people who decide whether an
# applicant gets in are the people who need to see what she sent to prove who
# she is, and nobody else in the building does.
#
# Approve and reject are gated with it too, and deliberately. Gating the queue
# but not the decision would mean a Viewer could not *look at* an applicant yet
# could still admit her by guessing a user id — a stranger inconsistency than
# the one this fixes, and on the more dangerous side of the pair.
#
# Members cannot reach any of it: a member role holds no permissions at all, so
# the check refuses them before the staff question is even asked.

@router.get("/queue", response_model=VerificationQueueResponse, summary="Applications awaiting review")
async def review_queue(
    state: Optional[str] = Query(None, description="Filter by verification status"),
    _: dict = Depends(require_permission("users.approve")),
):
    query: dict = {"role": "Member"}
    query["verification_status"] = (
        state if state in VerificationStatus.ALL else VerificationStatus.IN_REVIEW
    )

    # One query, not one per applicant.
    #
    # This loop asked the documents collection again for every row it printed.
    # Twenty women waiting for review meant twenty-one round trips to a cluster
    # in another data centre — and it got slower exactly when the queue got
    # longer, which is the moment somebody is trying to work through it.
    #
    # The `$lookup` joins on the string form of the user id, because that is
    # what the documents store.
    items = []
    rows = await _users().aggregate([
        {"$match": query},
        {"$sort": {"created_at": -1}},
        {"$lookup": {
            "from": DocumentModel.collection_name,
            "let": {"uid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}},
                {"$sort": {"created_at": -1}},
            ],
            "as": "_documents",
        }},
    ]).to_list(500)

    for user in rows:
        docs = [DocumentModel.to_response(d) for d in user.get("_documents", [])]
        created = user.get("created_at")
        items.append(
            VerificationQueueItem(
                user_id=str(user["_id"]),
                member_id=user.get("member_id") or "",
                full_name=user.get("full_name", ""),
                email=user.get("email", ""),
                phone=user.get("phone", ""),
                status=user.get("verification_status", ""),
                applied=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
                documents=docs,
            )
        )
    return VerificationQueueResponse(items=items, total=len(items))


@router.get("/documents/{document_id}/file", summary="Open an identity document (audited)")
async def read_document(document_id: str, staff: dict = Depends(require_permission("users.approve"))):
    """
    Streams the file straight from private storage. Never redirects to a public
    URL, and records who looked at it — identity documents deserve a paper trail.
    """
    doc = await _docs().find_one({"_id": to_object_id(document_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    target = (PRIVATE_ROOT / doc["stored_name"]).resolve()
    # Defence in depth: the resolved path must still sit inside private storage.
    if PRIVATE_ROOT.resolve() not in target.parents or not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document file is missing")

    await _docs().update_one(
        {"_id": doc["_id"]},
        {"$push": {"access_log": {
            "by": str(staff["_id"]),
            "name": staff.get("full_name", ""),
            "at": datetime.now(timezone.utc),
        }}},
    )
    # Read through the vault rather than streaming the file straight off disk.
    #
    # `read_file` decrypts if the file carries the envelope and hands back the
    # bytes untouched if it does not, so this endpoint answers identically
    # whether encryption is on, off, or halfway through a migration — which is
    # the only reason the write side above could be switched on without
    # breaking every document already stored.
    #
    # `Response` rather than `FileResponse` because there is nothing on disk to
    # stream any more once a file is encrypted. Documents are capped at
    # `MAX_DOCUMENT_MB` (10), so holding one in memory for the length of an
    # admin's click is not a concern worth a streaming decryptor.
    try:
        payload = docvault.read_file(target)
    except docvault.VaultUnavailable as exc:
        # Wrong key or an altered file. Say so plainly instead of handing a
        # reviewer a broken image: a document that silently renders as rubbish
        # is how a real applicant gets rejected for something that never
        # happened.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    filename = doc.get("original_name") or target.name
    return Response(
        content=payload,
        media_type=doc.get("content_type") or "application/octet-stream",
        headers={
            # Same disposition `FileResponse(filename=...)` produced, so nothing
            # that opens these changes behaviour.
            "Content-Disposition": f'attachment; filename="{filename}"',
            # Never let a browser or CDN keep a copy of an ID document.
            "Cache-Control": "no-store, private",
        },
    )


@router.post("/{user_id}/approve", response_model=MessageResponse, summary="Approve an applicant")
async def approve(user_id: str, staff: dict = Depends(require_permission("users.approve"))):
    user = await _users().find_one({"_id": to_object_id(user_id)})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "verification_status": VerificationStatus.ACTIVE,
            "verified_at": now,
            "rejection_reason": "",
            "updated_at": now,
        }},
    )
    await _docs().update_many(
        {"user_id": str(user["_id"]), "status": DocumentModel.STATUS_PENDING},
        {"$set": {
            "status": DocumentModel.STATUS_APPROVED,
            "reviewed_by": str(staff["_id"]),
            "reviewed_by_name": staff.get("full_name", ""),
            "reviewed_at": now,
        }},
    )
    # Keep the admin directory in step with the account.
    if user.get("member_id"):
        await get_database()[MemberModel.collection_name].update_one(
            {"_id": ObjectId(user["member_id"])},
            {"$set": {"status": "Active", "verified_on": now.strftime("%b %d, %Y")}},
        )

    await mailer.send(
        mailer.approved_email(user.get("full_name", ""), f"{settings.APP_BASE_URL.rstrip('/')}/signin"),
        user["email"],
    )
    return MessageResponse(message=f"{user.get('full_name', 'Applicant')} approved.")


@router.post("/{user_id}/reject", response_model=MessageResponse, summary="Reject an applicant")
async def reject(user_id: str, payload: RejectRequest, staff: dict = Depends(require_permission("users.approve"))):
    user = await _users().find_one({"_id": to_object_id(user_id)})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "verification_status": VerificationStatus.REJECTED,
            "rejection_reason": payload.reason,
            "updated_at": now,
        }},
    )
    await _docs().update_many(
        {"user_id": str(user["_id"]), "status": DocumentModel.STATUS_PENDING},
        {"$set": {
            "status": DocumentModel.STATUS_REJECTED,
            "reviewed_by": str(staff["_id"]),
            "reviewed_by_name": staff.get("full_name", ""),
            "reviewed_at": now,
            "review_note": payload.reason,
        }},
    )
    if user.get("member_id"):
        await get_database()[MemberModel.collection_name].update_one(
            {"_id": ObjectId(user["member_id"])}, {"$set": {"status": "Rejected"}}
        )

    await mailer.send(
        mailer.rejected_email(user.get("full_name", ""), payload.reason), user["email"]
    )
    return MessageResponse(message="Applicant rejected and notified.")


# --- member support threads (staff side) -------------------------------------
# Lives here rather than in routes/me.py because everything in that module is
# scoped to "the caller's own account" — this is the opposite: staff reading
# and answering someone else's thread.

from app.models.conversation import MemberMessageModel, MemberNotificationModel, notify  # noqa: E402
from app.schemas.verification import (  # noqa: E402
    StaffReplyRequest,
    SupportThread,
    SupportThreadMessage,
)


@router.get("/threads", response_model=list[SupportThread], summary="Member support threads")
async def support_threads(staff: dict = Depends(require_staff)):
    """Every member who has written in, most recently active first."""
    db = get_database()
    threads: dict[str, dict] = {}
    async for m in db[MemberMessageModel.collection_name].find({}).sort("created_at", 1):
        uid = m["user_id"]
        thread = threads.setdefault(uid, {"user_id": uid, "messages": [], "unread": 0})
        thread["messages"].append(MemberMessageModel.to_response(m))
        if m.get("sender") == MemberMessageModel.FROM_MEMBER and not m.get("read_by_team"):
            thread["unread"] += 1

    # One query for every member who has written in, not one per member.
    #
    # This used to `find_one` inside the loop. The cost grew with the number of
    # distinct people who had ever contacted support — so the busier the
    # inbox, the slower the inbox, which is exactly backwards.
    oids = []
    for uid in threads:
        try:
            oids.append(ObjectId(uid))
        except Exception:  # noqa: BLE001
            # A thread whose user_id is not an ObjectId cannot be matched to a
            # person; it is skipped below just as the per-row lookup skipped it.
            continue
    users = {
        str(u["_id"]): u
        for u in await db[UserModel.collection_name]
        .find({"_id": {"$in": oids}})
        .to_list(len(oids))
    } if oids else {}

    out = []
    for uid, thread in threads.items():
        user = users.get(uid)
        if not user:
            continue
        out.append(
            SupportThread(
                user_id=uid,
                full_name=user.get("full_name", ""),
                email=user.get("email", ""),
                avatar=user.get("avatar", ""),
                unread=thread["unread"],
                last_message=thread["messages"][-1]["body"][:120] if thread["messages"] else "",
                last_at=thread["messages"][-1]["sent_label"] if thread["messages"] else "",
                messages=[SupportThreadMessage(**m) for m in thread["messages"]],
            )
        )
    out.sort(key=lambda t: t.unread, reverse=True)
    return out


@router.post(
    "/threads/{user_id}/reply",
    response_model=SupportThreadMessage,
    status_code=status.HTTP_201_CREATED,
    summary="Reply to a member",
)
async def reply_to_member(
    user_id: str,
    payload: StaffReplyRequest,
    staff: dict = Depends(require_staff),
):
    db = get_database()
    member = await db[UserModel.collection_name].find_one({"_id": to_object_id(user_id)})
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    doc = MemberMessageModel.create_document(
        user_id=user_id,
        member_id=member.get("member_id") or "",
        body=payload.body,
        sender=MemberMessageModel.FROM_TEAM,
        sender_name=staff.get("full_name", "WomSakhi team"),
    )
    result = await db[MemberMessageModel.collection_name].insert_one(doc)
    doc["_id"] = result.inserted_id

    # Her incoming messages are now handled.
    await db[MemberMessageModel.collection_name].update_many(
        {"user_id": user_id, "read_by_team": False}, {"$set": {"read_by_team": True}}
    )
    await notify(
        db, user_id,
        title="New reply from the team",
        body=payload.body[:90],
        ntype=MemberNotificationModel.TYPE_MESSAGE,
        href="/app/messages",
    )
    return SupportThreadMessage(**MemberMessageModel.to_response(doc))

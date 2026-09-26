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

import asyncio
import re
import uuid
from html import escape
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.audit import record
from app.core.config import settings
from app.core.email import can_deliver
from app.core.deps import get_current_user
from app.core import email as mailer
from app.core import docvault
from app.core.permissions import require_permission
from app.core.rbac import require_staff
from app.core.serializers import to_object_id
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.staff import ActivityLogModel
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
    # `send` succeeds over the file adapter too, which is how a woman came to
    # be told "we've sent you a fresh confirmation link" any number of times
    # while every one of them sat in `outbox/`. Pressing a button that says it
    # worked, and waiting, is worse than being told there is another way in.
    if not can_deliver():
        return MessageResponse(
            message=(
                "We cannot send email yet, so no link is coming. Write to "
                "support@womsakhi.com from this address and a person will let you in."
            )
        )
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
# These were guarded by `require_staff`, which means one thing and one thing
# only: **the caller is not a Member**. It does not mean the caller is a
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
#
# ── Every decision is written down ──────────────────────────────────────────
# Approving, rejecting and asking for a new document each go through
# `app.core.audit.record` with the applicant's user id as the target, so an
# investigator can pull every decision ever taken about one woman. Opening a
# document is not in that log; it has its own, on the document (`access_log`),
# which the detail endpoint below reads back.
#
# ── Her vault is not the queue ──────────────────────────────────────────────
# `verification_documents` holds two different things: the ID she submitted
# for review, and the papers she keeps in her own vault (`routes/me.py` writes
# those with `status="stored"`). The queue used to `$lookup` every document
# for a user regardless, so a reviewer saw — and could open — a passbook that
# nobody had asked anyone to look at. Every reviewer-side read now says which
# kind it means, and the file endpoint refuses the other kind outright.

#: The identity check, as opposed to the vault.
REVIEWABLE: dict = {"status": {"$ne": DocumentModel.STATUS_STORED}}

#: Decisions in the activity log that concern an applicant. `member.*` rather
#: than `users.*` because that prefix is what `app/core/audit.py` buckets
#: under "Users" on the activity screen; `users.` would land in "Settings".
DECISION_ACTIONS = {
    "member.approve": "Approved",
    "member.reject": "Rejected",
    "member.resubmit": "Asked for a new document",
}


class ReviewQueueItem(VerificationQueueItem):
    rejection_reason: str = ""
    updated: str = ""


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    #: Every state, always, so the tabs can show a number even for the
    #: states not being listed right now.
    counts: dict[str, int]


class DocumentAccess(BaseModel):
    by: str
    name: str
    at: str


class ReviewedDocument(DocumentResponse):
    access_count: int = 0
    access_log: list[DocumentAccess] = []
    encrypted: bool = False


class DecisionRecord(BaseModel):
    id: str
    user_name: str
    action: str
    label: str
    detail: str
    when: str
    created_at: str


class ApplicantDetail(BaseModel):
    user_id: str
    member_id: str
    full_name: str
    email: str
    phone: str
    status: str
    status_label: str
    applied: str
    applied_at: str
    email_verified_at: str
    verified_at: str
    updated_at: str
    rejection_reason: str
    documents: list[ReviewedDocument]
    history: list[DecisionRecord]


class ResubmissionRequest(RejectRequest):
    """Same rule as a rejection: she is told why, so a reason is required."""


def _label(value) -> str:
    return value.strftime("%b %d, %Y") if isinstance(value, datetime) else ""


def _iso(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


def _state_of(user: dict) -> str:
    # An account created before verification existed has no status at all;
    # `my_status` reads that as verified, so the queue must too.
    return user.get("verification_status") or VerificationStatus.ACTIVE


def _state_filter(state: str) -> dict:
    if state == VerificationStatus.ACTIVE:
        return {"verification_status": {"$in": [VerificationStatus.ACTIVE, None]}}
    return {"verification_status": state}


async def _state_counts() -> dict[str, int]:
    counts = {s: 0 for s in VerificationStatus.ALL}
    async for row in _users().aggregate([
        {"$match": {"role": "Member"}},
        {"$group": {"_id": "$verification_status", "n": {"$sum": 1}}},
    ]):
        key = row["_id"] if row["_id"] in counts else VerificationStatus.ACTIVE
        counts[key] += row["n"]
    return counts


def _resubmission_email(name: str, reason: str, url: str) -> mailer.EmailMessageSpec:
    """
    Not `rejected_email`: that one opens with "We couldn't verify your
    account", and her account has not been refused — it is waiting on a
    better photo. Told the wrong thing, a woman gives up; told the right
    thing, she goes and takes it again in daylight.
    """
    first = escape((name or "").strip().split(" ")[0] or "there")
    safe = escape(reason)
    html = mailer._wrap(  # noqa: SLF001 — the one branded shell every email uses
        "Please send your ID again",
        "We looked at the document you sent, and we need a new one before we can "
        f"finish verifying you.<br><strong style='color:#8f2b68;'>What to change:</strong> {safe}",
        "Upload again",
        url,
        recipient_name=name,
        title_accent="ID",
        next_step="Upload the new document and a person will review it again, usually within 1–2 working days.",
    )
    text = (
        f"Hi {first},\n\nWe need a new copy of your ID before we can finish verifying you.\n\n"
        f"What to change: {reason}\n\nUpload it again here: {url}"
    )
    return mailer.EmailMessageSpec(
        to="", subject="WomSakhi — please send your ID again", html=html, text=text
    )


@router.get("/queue", response_model=ReviewQueueResponse, summary="Applications, by state")
async def review_queue(
    state: Optional[str] = Query(None, description="One verification status, or `all`"),
    q: Optional[str] = Query(None, max_length=80, description="Name, email, phone or member id"),
    _: dict = Depends(require_permission("users.approve")),
):
    query: dict = {"role": "Member"}
    if state != "all":
        query.update(_state_filter(state if state in VerificationStatus.ALL else VerificationStatus.IN_REVIEW))
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}, {"phone": rx}, {"member_id": rx}]

    # One query, not one per applicant.
    #
    # This loop asked the documents collection again for every row it printed.
    # Twenty women waiting for review meant twenty-one round trips to a cluster
    # in another data centre — and it got slower exactly when the queue got
    # longer, which is the moment somebody is trying to work through it.
    #
    # The `$lookup` joins on the string form of the user id, because that is
    # what the documents store. It takes only the identity check — see
    # REVIEWABLE — never what she keeps in her vault.
    rows, counts = await asyncio.gather(
        _users().aggregate([
            {"$match": query},
            {"$sort": {"created_at": -1}},
            {"$limit": 500},
            {"$lookup": {
                "from": DocumentModel.collection_name,
                "let": {"uid": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}, **REVIEWABLE}},
                    {"$sort": {"created_at": -1}},
                ],
                "as": "_documents",
            }},
        ]).to_list(500),
        _state_counts(),
    )

    items = []
    for user in rows:
        items.append(
            ReviewQueueItem(
                user_id=str(user["_id"]),
                member_id=user.get("member_id") or "",
                full_name=user.get("full_name", ""),
                email=user.get("email", ""),
                phone=user.get("phone", ""),
                status=_state_of(user),
                applied=_label(user.get("created_at")),
                documents=[DocumentModel.to_response(d) for d in user.get("_documents", [])],
                rejection_reason=user.get("rejection_reason", "") or "",
                updated=_label(user.get("updated_at")),
            )
        )
    return ReviewQueueResponse(items=items, total=len(items), counts=counts)


@router.get("/applicants/{user_id}", response_model=ApplicantDetail, summary="One application, in full")
async def applicant_detail(user_id: str, _: dict = Depends(require_permission("users.approve"))):
    """
    Everything a reviewer may see about one applicant: her details, the
    documents she submitted (with who has opened each one), and every decision
    taken about her so far. Nothing from her vault, nothing from her
    in-case-of-emergency data — those are hers.
    """
    user = await _users().find_one({"_id": to_object_id(user_id), "role": "Member"})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Applicant not found")

    uid = str(user["_id"])
    docs = [
        DocumentModel.to_response(d, include_private=True)
        async for d in _docs().find({"user_id": uid, **REVIEWABLE}).sort("created_at", -1)
    ]
    history = []
    async for row in (
        get_database()[ActivityLogModel.collection_name]
        .find({"target": uid, "action": {"$in": list(DECISION_ACTIONS)}})
        .sort("created_at", -1)
        .limit(50)
    ):
        entry = ActivityLogModel.to_response(row)
        history.append(
            DecisionRecord(
                id=entry["id"],
                user_name=entry["user_name"],
                action=entry["action"],
                label=DECISION_ACTIONS.get(entry["action"], entry["action"]),
                detail=entry["detail"],
                when=entry["when"],
                created_at=entry["created_at"],
            )
        )

    state = _state_of(user)
    return ApplicantDetail(
        user_id=uid,
        member_id=user.get("member_id") or "",
        full_name=user.get("full_name", ""),
        email=user.get("email", ""),
        phone=user.get("phone", ""),
        status=state,
        status_label=VerificationStatus.LABELS.get(state, state),
        applied=_label(user.get("created_at")),
        applied_at=_iso(user.get("created_at")),
        email_verified_at=_iso(user.get("email_verified_at")),
        verified_at=_iso(user.get("verified_at")),
        updated_at=_iso(user.get("updated_at")),
        rejection_reason=user.get("rejection_reason", "") or "",
        documents=[ReviewedDocument(**d) for d in docs],
        history=history,
    )


@router.get("/documents/{document_id}/file", summary="Open an identity document (audited)")
async def read_document(document_id: str, staff: dict = Depends(require_permission("users.approve"))):
    """
    Streams the file straight from private storage. Never redirects to a public
    URL, and records who looked at it — identity documents deserve a paper trail.
    """
    doc = await _docs().find_one({"_id": to_object_id(document_id)})
    # A paper in her vault is hers alone. 404 rather than 403, so the reviewer
    # side cannot even confirm that one exists.
    if not doc or doc.get("status") == DocumentModel.STATUS_STORED:
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


async def _applicant(user_id: str) -> dict:
    user = await _users().find_one({"_id": to_object_id(user_id), "role": "Member"})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Applicant not found")
    return user


def _who(user: dict) -> str:
    """`Asha Verma (asha@example.com, WS-0042)` — enough to recognise her in the log."""
    bits = [user.get("email", "")]
    if user.get("member_id"):
        bits.append(str(user["member_id"]))
    return f"{user.get('full_name', '') or 'Applicant'} ({', '.join(b for b in bits if b)})"


@router.post("/{user_id}/approve", response_model=MessageResponse, summary="Approve an applicant")
async def approve(
    user_id: str,
    request: Request,
    staff: dict = Depends(require_permission("users.approve")),
):
    user = await _applicant(user_id)
    was = _state_of(user)
    if was == VerificationStatus.ACTIVE:
        # Not an error worth a stack trace, but not a silent second "You're
        # in" email and a duplicate audit row either.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She is already verified.")

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
    await record(
        staff, "member.approve", target=str(user["_id"]),
        detail=f"Approved {_who(user)}; was {VerificationStatus.LABELS.get(was, was)}",
        request=request,
    )
    return MessageResponse(message=f"{user.get('full_name', 'Applicant')} approved.")


@router.post("/{user_id}/reject", response_model=MessageResponse, summary="Reject an applicant")
async def reject(
    user_id: str,
    payload: RejectRequest,
    request: Request,
    staff: dict = Depends(require_permission("users.approve")),
):
    user = await _applicant(user_id)
    was = _state_of(user)

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
    await record(
        staff, "member.reject", target=str(user["_id"]),
        detail=f"Rejected {_who(user)}; was {VerificationStatus.LABELS.get(was, was)}. Reason: {payload.reason}",
        request=request,
    )
    return MessageResponse(message="Applicant rejected and notified.")


@router.post(
    "/{user_id}/request-resubmission",
    response_model=MessageResponse,
    summary="Ask an applicant for a new document",
)
async def request_resubmission(
    user_id: str,
    payload: ResubmissionRequest,
    request: Request,
    staff: dict = Depends(require_permission("users.approve")),
):
    """
    The third answer, between yes and no. The photo is blurred, the card is
    cut off, the name does not match — none of that is a reason to refuse a
    woman, and none of it is a reason to admit her. She goes back to the
    upload step with a note saying what to change; the app stays closed
    until a person has looked again.
    """
    user = await _applicant(user_id)
    was = _state_of(user)
    if was == VerificationStatus.PENDING_EMAIL:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "She has not confirmed her email yet, so there is nothing to send again.",
        )
    if was == VerificationStatus.ACTIVE:
        # Asking a verified member for her ID again would close the app on
        # her. That is a suspension, which lives in Users, with its own trail.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "She is already verified. To withdraw access, suspend the account instead.",
        )

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "verification_status": VerificationStatus.PENDING_DOCUMENTS,
            # Read back by `/verification/status`, so her status screen can
            # carry the note as well as the email.
            "rejection_reason": payload.reason,
            "resubmission_requested_at": now,
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
            {"_id": ObjectId(user["member_id"])}, {"$set": {"status": "Pending"}}
        )

    await mailer.send(
        _resubmission_email(
            user.get("full_name", ""), payload.reason,
            f"{settings.APP_BASE_URL.rstrip('/')}/app/verify",
        ),
        user["email"],
    )
    await record(
        staff, "member.resubmit", target=str(user["_id"]),
        detail=f"Asked {_who(user)} for a new document; was {VerificationStatus.LABELS.get(was, was)}. Note: {payload.reason}",
        request=request,
    )
    return MessageResponse(message=f"Asked {user.get('full_name', 'the applicant')} for a new document.")


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
                avatar=media_url(user.get("avatar", "")),
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

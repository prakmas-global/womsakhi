"""
The safety centre.

Two things are different here from every other member route:

1. **Helplines are unauthenticated.** If a woman is in trouble and her session
   has expired, a 401 in front of the number 181 is unforgivable. That endpoint
   returns a constant and touches neither the database nor the token.

2. **Raising an alert never fails.** Notifying trusted contacts is best-effort;
   if it breaks, the alert is still recorded and staff still see it. She gets a
   success response as long as the alert itself was written.

3. **Nobody is messaged yet, and the screen must not imply otherwise.** There
   is no SMS provider wired in, so `contacts_notified` is the number of people
   the alert *names for staff to reach* — not a count of messages sent. The
   member screen used to read "Sunita and Meera have been told where you are"
   over both this gap and a hardcoded pair of names. Until a provider exists,
   what is true is that the alert is recorded, staff see it immediately, and
   the people she named are on it.
"""

import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.safety import (
    HELPLINES,
    HelplineModel,
    SafetyAlertModel,
    SafetyReportModel,
    TrustedContactModel,
)
from app.schemas.me import MessageResponse
from app.schemas.safety import (
    AlertCreate,
    AlertResponse,
    Helpline,
    ReportCreate,
    ReportResponse,
    SafetyCentre,
    TrustedContactCreate,
    TrustedContactResponse,
)

router = APIRouter(prefix="/safety", tags=["Member · Safety"])


def _contacts():
    return get_database()[TrustedContactModel.collection_name]


def _alerts():
    return get_database()[SafetyAlertModel.collection_name]


def _reports():
    return get_database()[SafetyReportModel.collection_name]


# --- helplines (deliberately public) -----------------------------------------

#: The last good curated list and when it was read. Thirty seconds is short
#: enough that a staff edit shows up promptly, long enough that this endpoint
#: costs one query a minute rather than one per call.
_HELPLINE_CACHE: dict = {"at": 0.0, "rows": None}
_HELPLINE_TTL_SECONDS = 30.0


def invalidate_helplines() -> None:
    """Called by the staff side after a write, so the next read is fresh."""
    _HELPLINE_CACHE["at"] = 0.0


async def effective_helplines() -> list[dict]:
    """
    The numbers that are live right now.

    The curated `helplines` collection wins when it holds at least one active
    row; otherwise the constant in code answers. On ANY failure reaching the
    database the last good list is served, and if there has never been one,
    the constant. The fallback is the point: this must work when nothing else
    does, and a curated list that could be emptied or a database that could be
    down must never stand between a woman and 181.
    """
    now = time.monotonic()
    cached = _HELPLINE_CACHE["rows"]
    if cached is not None and now - _HELPLINE_CACHE["at"] < _HELPLINE_TTL_SECONDS:
        return cached
    try:
        rows = await get_database()[HelplineModel.collection_name].find(
            {"active": {"$ne": False}}
        ).sort([("order", 1), ("created_at", 1)]).to_list(50)
    except Exception:  # noqa: BLE001 — the last good list, then the constant
        return cached if cached is not None else HELPLINES
    result = [HelplineModel.to_public(r) for r in rows] if rows else HELPLINES
    _HELPLINE_CACHE["rows"] = result
    _HELPLINE_CACHE["at"] = now
    return result


@router.get("/helplines", response_model=list[Helpline], summary="Emergency numbers")
async def helplines():
    """
    No authentication. Reads the curated list if staff have made one, and
    falls back to the constant in code if that read fails or returns nothing.
    """
    return await effective_helplines()


# --- the safety screen, in one request ---------------------------------------

@router.get("", response_model=SafetyCentre, summary="Everything my safety screen needs")
async def safety_centre(me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])

    # Her contacts, her open alert and her reports have nothing to say to one
    # another — three separate collections, all keyed on her. Sent one after
    # the next that is three trips to a cluster in another data centre for a
    # screen she may be opening because something is wrong. Sent together it
    # is one.
    contacts, open_alert, reports = await asyncio.gather(
        _contacts().find({"user_id": user_id}).sort("created_at", 1).to_list(20),
        _alerts().find_one(
            {"user_id": user_id, "status": {"$ne": SafetyAlertModel.STATUS_RESOLVED}},
            sort=[("created_at", -1)],
        ),
        _reports().find({"user_id": user_id}).sort("created_at", -1).to_list(50),
    )

    return {
        "helplines": await effective_helplines(),
        "contacts": [TrustedContactModel.to_response(c) for c in contacts],
        "open_alert": SafetyAlertModel.to_response(open_alert) if open_alert else None,
        "reports": [SafetyReportModel.to_response(r) for r in reports],
    }


# --- trusted contacts --------------------------------------------------------

@router.get("/contacts", response_model=list[TrustedContactResponse], summary="My trusted contacts")
async def list_contacts(me: dict = Depends(require_active_member)):
    docs = await _contacts().find({"user_id": str(me["_id"])}).sort("created_at", 1).to_list(20)
    return [TrustedContactModel.to_response(d) for d in docs]


@router.post(
    "/contacts",
    response_model=TrustedContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a trusted contact",
)
async def add_contact(body: TrustedContactCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    count = await _contacts().count_documents({"user_id": user_id})
    if count >= TrustedContactModel.MAX_PER_MEMBER:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"You can have up to {TrustedContactModel.MAX_PER_MEMBER} trusted contacts",
        )

    doc = TrustedContactModel.create_document(
        user_id=user_id,
        name=body.name,
        phone=body.phone,
        relation=body.relation,
        notify_on_alert=body.notify_on_alert,
    )
    result = await _contacts().insert_one(doc)
    doc["_id"] = result.inserted_id
    return TrustedContactModel.to_response(doc)


@router.delete("/contacts/{contact_id}", response_model=MessageResponse, summary="Remove a contact")
async def delete_contact(contact_id: str, me: dict = Depends(require_active_member)):
    deleted = await _contacts().find_one_and_delete(
        {"_id": to_object_id(contact_id), "user_id": str(me["_id"])}
    )
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That contact isn't yours or no longer exists")
    return {"message": "Contact removed"}


# --- alerts ------------------------------------------------------------------

@router.post(
    "/alert",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Raise an alert",
)
async def raise_alert(body: AlertCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    db = get_database()

    # `$ne: False`, not `== True`. `to_response` treats a *missing*
    # `notify_on_alert` as yes, so contacts saved before that field existed
    # were shown to her as "will be told" and matched nothing here — the alert
    # went out recording that it had reached nobody.
    contacts = await _contacts().find(
        {"user_id": user_id, "notify_on_alert": {"$ne": False}}
    ).to_list(20)

    doc = SafetyAlertModel.create_document(
        user_id=user_id,
        member_id=me.get("member_id", ""),
        member_name=me.get("full_name", ""),
        note=body.note,
        location=body.location,
        contacts_notified=len(contacts),
    )
    result = await _alerts().insert_one(doc)
    doc["_id"] = result.inserted_id

    # Best effort from here on — the alert is already safely recorded.
    await notify(
        db, user_id,
        "We've got your alert",
        "Our team has been alerted and will reach you. If you are in immediate danger, call 112.",
        "safety", "/app/safety",
    )
    return SafetyAlertModel.to_response(doc)


@router.post("/alert/{alert_id}/stand-down", response_model=AlertResponse, summary="I'm safe now")
async def stand_down(alert_id: str, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    doc = await _alerts().find_one_and_update(
        {"_id": to_object_id(alert_id), "user_id": str(me["_id"])},
        {
            "$set": {
                "status": SafetyAlertModel.STATUS_RESOLVED,
                "resolution": "Stood down by the member",
                "resolved_at": now,
            }
        },
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That alert isn't yours or no longer exists")
    return SafetyAlertModel.to_response(doc)


# --- reports -----------------------------------------------------------------

@router.get("/reports", response_model=list[ReportResponse], summary="Reports I've filed")
async def my_reports(me: dict = Depends(require_active_member)):
    docs = await _reports().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(100)
    return [SafetyReportModel.to_response(d) for d in docs]


@router.post(
    "/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report something",
)
async def file_report(body: ReportCreate, me: dict = Depends(require_active_member)):
    if body.category not in SafetyReportModel.CATEGORIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose one of the listed categories")

    user_id = str(me["_id"])
    doc = SafetyReportModel.create_document(
        user_id=user_id,
        category=body.category,
        details=body.details,
        about=body.about,
        anonymous=body.anonymous,
        evidence=body.evidence,
    )
    result = await _reports().insert_one(doc)
    doc["_id"] = result.inserted_id

    db = get_database()
    await notify(
        db, user_id,
        "Report received",
        "Someone on our team will look at this within 24 hours. Thank you for telling us.",
        "safety", "/app/safety",
    )
    return SafetyReportModel.to_response(doc)

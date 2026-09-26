"""
Billing — what this installation is, not what a template said it paid for.

── What was here ──────────────────────────────────────────────────────────
A seeded "Professional Plan" at ₹2,999 a month, a Mastercard ending 4242, five
invoices numbered INV-2024-00xx, a usage bar reading "62.4 GB / 100 GB" and a
GSTIN that does not validate. None of it was ever true. WomSakhi takes no
payment from the organisation running it, holds no card, and issues no
invoice; the screen was a picture of a billing page.

── What is here now ───────────────────────────────────────────────────────
  · the plan tier, read from the caller's entitlement — the same flag
    `org.py` refuses on, so the two screens can never disagree;
  · what that tier includes, from the entitlements catalogue;
  · seats, counted from the users collection;
  · storage, measured from the media directories on disk;
  · billing details an admin has typed — shown only once someone has, never
    the seeded placeholder;
  · invoices, only rows that carry a creation timestamp. The seeded rows do
    not, because no code ever created them. Nothing issues invoices today, so
    the list is honestly empty.

The plan-change, cancel, card and auto-pay endpoints are gone. A button that
"changes the plan" by editing a string in a document is not a billing action;
it is a lie with a spinner.
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.entitlements import FEATURES, Feature, Scope, allows, scope_of
from app.core.permissions import require_permission
from app.core.rbac import MEMBER_ROLE, SUPER_ADMIN
from app.core.serializers import page_meta
from app.db.mongodb import get_database
from app.models.billing import BillingAccountModel, InvoiceModel
from app.routes._paging import paged
from app.schemas.billing import InvoiceListResponse, InvoiceResponse
from app.schemas.settings_platform_admin import (
    BillingInfoIn,
    BillingInfoOut,
    BillingOverview,
    PaymentsInfo,
    PlanFeature,
    PlanInfo,
    SeatCounts,
    StorageInfo,
)

router = APIRouter(prefix="/billing", tags=["Settings"])


def _accounts():
    return get_database()[BillingAccountModel.collection_name]


def _invoices():
    return get_database()[InvoiceModel.collection_name]


def _users():
    return get_database()["users"]


#: Only invoices some code actually created. The seeded fixtures have no
#: `created_at` because `InvoiceModel.create_document` never set one — which
#: is exactly the tell that nothing real produced them.
_REAL_INVOICES: dict = {"created_at": {"$exists": True}}

#: Human names for the entitlement catalogue, in display order.
_FEATURE_LABELS: list[tuple[Feature, str]] = [
    (Feature.THEME_PRESETS, "Colour themes for every account"),
    (Feature.THEME_CUSTOM, "Custom colours"),
    (Feature.TEXT_SIZE, "Text size"),
    (Feature.HIGH_CONTRAST, "High contrast"),
    (Feature.LAYOUT_NAV, "Reorder and hide navigation"),
    (Feature.LAYOUT_RESIZE, "Resizable panes and charts"),
    (Feature.LAYOUT_WIDGETS, "Dashboard widgets"),
    (Feature.ORG_BRANDING, "Your own logo and wordmark"),
    (Feature.ORG_DEFAULT_THEME, "A platform-wide default palette"),
    (Feature.ORG_LAYOUT_TEMPLATES, "Layout templates pushed to a role"),
    (Feature.ORG_CUSTOM_DOMAIN, "A custom domain"),
]

_TIER_LABEL = {Scope.FREE: "Free", Scope.PRO: "Pro", Scope.ORG: "Organisation"}


def _size_label(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 ** 2:
        return f"{n / 1024:.1f} KB"
    if n < 1024 ** 3:
        return f"{n / 1024 ** 2:.1f} MB"
    return f"{n / 1024 ** 3:.2f} GB"


def _measure(root: str) -> tuple[int, int]:
    """(bytes, files) under a directory. Walks the tree; the media root here is
    a few megabytes, and a number that is measured beats one that is stored."""
    total, files = 0, 0
    base = Path(root)
    if not base.exists():
        return 0, 0
    for dirpath, _dirs, names in os.walk(base):
        for name in names:
            try:
                total += os.path.getsize(os.path.join(dirpath, name))
                files += 1
            except OSError:
                continue
    return total, files


def _iso(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


async def _billing_info_row() -> Optional[dict]:
    return await _accounts().find_one({}, {"billing_info": 1, "billing_info_updated_at": 1})


# --- overview ----------------------------------------------------------------

@router.get(
    "/account",
    response_model=BillingOverview,
    summary="What this installation is on, counted and measured",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def billing_overview(me: dict = Depends(get_current_user)):
    tier = scope_of(me)
    features = [
        PlanFeature(key=f.value, label=label, included=allows(me, f))
        for f, label in _FEATURE_LABELS
        if f in FEATURES
    ]

    staff_q = {"role": {"$ne": MEMBER_ROLE}}
    staff = await _users().count_documents(staff_q)
    active_staff = await _users().count_documents({**staff_q, "is_active": {"$ne": False}})
    supers = await _users().count_documents({"role": SUPER_ADMIN})
    members = await _users().count_documents({"role": MEMBER_ROLE})

    public_bytes, public_files = _measure(settings.MEDIA_DIR)
    private_bytes, private_files = _measure(settings.PRIVATE_MEDIA_DIR)
    used = public_bytes + private_bytes

    row = await _billing_info_row() or {}
    saved_at = row.get("billing_info_updated_at")
    info = row.get("billing_info") or {} if saved_at else {}

    provider = (settings.PAYMENT_PROVIDER or "sandbox").strip().lower()
    return BillingOverview(
        plan=PlanInfo(
            tier=tier.value,
            label=_TIER_LABEL.get(tier, tier.value.title()),
            features=features,
            note=(
                "Everything personal is free and already on for everyone. The organisation tier is "
                "what a licence would buy; there is no charge on this installation today."
                if tier == Scope.FREE
                else "Licensed features are on for this account."
            ),
        ),
        seats=SeatCounts(staff=staff, super_admins=supers, active_staff=active_staff, members=members),
        storage=StorageInfo(
            bytes=used,
            label=_size_label(used),
            files=public_files + private_files,
            location="This server's disk (media/ and private_media/). No cloud bucket is configured.",
        ),
        billing_info=BillingInfoOut(**{k: str(info.get(k, "") or "") for k in ("company", "email", "gstin", "address")}),
        billing_info_saved=bool(saved_at),
        billing_info_updated_at=_iso(saved_at),
        payments=PaymentsInfo(
            provider=provider,
            enabled=bool(settings.PAYMENTS_ENABLED),
            custody=False,
            note=(
                "WomSakhi holds no money on anyone's behalf. Member payments run through the payment "
                "provider in sandbox mode — no real money moves — and the organisation itself is not billed."
                if provider == "sandbox"
                else "WomSakhi holds no money on anyone's behalf; member payments go straight to the provider. "
                     "The organisation itself is not billed."
            ),
        ),
        invoices_total=await _invoices().count_documents(_REAL_INVOICES),
    )


@router.put(
    "/account/billing-info",
    response_model=BillingInfoOut,
    summary="Save the organisation's billing details",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def update_billing_info(
    payload: BillingInfoIn, request: Request, me: dict = Depends(get_current_user)
):
    """Details for an invoice that does not exist yet. Kept because an
    organisation that will one day be licensed wants them on file; shown only
    once a person has typed them."""
    now = datetime.now(timezone.utc)
    info = {
        "company": payload.company,
        "email": payload.email,
        "gstin": payload.gstin,
        "address": payload.address,
    }
    existing = await _accounts().find_one({}, {"_id": 1})
    if existing:
        await _accounts().update_one(
            {"_id": existing["_id"]},
            {"$set": {"billing_info": info, "billing_info_updated_at": now,
                      "billing_info_updated_by": str(me["_id"])}},
        )
    else:
        await _accounts().insert_one({
            "billing_info": info,
            "billing_info_updated_at": now,
            "billing_info_updated_by": str(me["_id"]),
            "created_at": now,
        })
    await record(
        me, "settings.billing.details", target="billing_info",
        detail=f"Saved billing details for {payload.company} ({payload.email})",
        request=request,
    )
    return BillingInfoOut(**info)


# --- invoices ----------------------------------------------------------------

@router.get(
    "/invoices",
    response_model=InvoiceListResponse,
    summary="Invoices that were actually issued",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status", description="Paid|Pending|Failed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query: dict = dict(_REAL_INVOICES)
    if status_filter and status_filter not in ("All", "all"):
        query["status"] = status_filter
    total, docs = await paged(
        _invoices(), query, sort="created_at", direction=-1, page=page, page_size=page_size,
    )
    items = [InvoiceModel.to_response(doc) for doc in docs]
    return InvoiceListResponse(items=items, **page_meta(total, page, page_size))


@router.get(
    "/invoices/{invoice_number}/download",
    summary="Download an invoice as CSV",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def download_invoice(invoice_number: str):
    doc = await _invoices().find_one({"invoice_number": invoice_number, **_REAL_INVOICES})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    inv = InvoiceModel.to_response(doc)
    rows = [
        ["Invoice", "Date", "Description", "Plan Period", "Amount", "Status"],
        [inv["invoice_number"], inv["date"], inv["description"], inv["period"], inv["amount"], inv["status"]],
    ]
    csv = "\n".join(",".join(f'"{cell}"' for cell in row) for row in rows)
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{inv["invoice_number"]}.csv"'},
    )


@router.get(
    "/invoices/{invoice_number}",
    response_model=InvoiceResponse,
    summary="One invoice",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_invoice(invoice_number: str):
    doc = await _invoices().find_one({"invoice_number": invoice_number, **_REAL_INVOICES})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return InvoiceResponse(**InvoiceModel.to_response(doc))


# --- seeding -----------------------------------------------------------------

async def seed() -> None:
    """
    Deliberately seeds nothing.

    `seed_all` still calls this at startup, so the function stays. It used to
    insert a plan, a card and five invoices nobody was ever sent. An invented
    invoice is worse than no invoice; the screen now says "none" and means it.
    """
    return None

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.deps import get_current_user
from app.core.serializers import page_meta
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.models.billing import BillingAccountModel, InvoiceModel, PlanModel
from app.routes._paging import paged
from app.schemas.billing import (
    AutoPayRequest,
    BillingAccountResponse,
    BillingInfoResponse,
    BillingInfoUpdate,
    BillingSummaryResponse,
    ChangePlanRequest,
    InvoiceListResponse,
    InvoiceResponse,
    PlanResponse,
    UpdatePaymentRequest,
    UsageOverviewResponse,
)

router = APIRouter(prefix="/billing", tags=["Settings"])


def _accounts():
    return get_database()[BillingAccountModel.collection_name]


def _plans():
    return get_database()[PlanModel.collection_name]


def _invoices():
    return get_database()[InvoiceModel.collection_name]


async def _account_doc() -> dict:
    """The singleton billing_account document, or 404 if it has not been seeded."""
    doc = await _accounts().find_one({})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Billing account not found")
    return doc


# --- Money helpers ------------------------------------------------------------

def _rupees(price: str) -> float:
    """Parse a display price like '₹2,999' into a number (2999.0)."""
    digits = "".join(ch for ch in (price or "") if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def _fmt(amount: float) -> str:
    """Format a number back into the '₹2,999.00' display string."""
    return f"₹{amount:,.2f}"


def _summary(doc: dict) -> dict:
    """Derive the Billing Summary (subtotal / taxes / total) from the plan price."""
    subtotal = _rupees(doc.get("plan_price", ""))
    tax_percent = doc.get("tax_percent", 18)
    taxes = subtotal * tax_percent / 100
    total = subtotal + taxes
    return {
        "plan": doc.get("plan", ""),
        "billing_cycle": doc.get("billing_cycle", "Monthly"),
        "subtotal": _fmt(subtotal),
        "tax_percent": tax_percent,
        "taxes": _fmt(taxes),
        "total": _fmt(total),
        "currency": doc.get("currency", "INR"),
    }


# --- Account (singleton) ------------------------------------------------------

@router.get("/account", response_model=BillingAccountResponse, summary="Get the billing account",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_account(_: dict = Depends(get_current_user)):
    doc = await _account_doc()
    data = BillingAccountModel.to_response(doc)
    data["summary"] = _summary(doc)
    return BillingAccountResponse(**data)


@router.get("/account/billing-info", response_model=BillingInfoResponse, summary="Get billing information",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_billing_info(_: dict = Depends(get_current_user)):
    doc = await _account_doc()
    return BillingInfoResponse(**doc.get("billing_info", {}))


@router.get("/account/usage", response_model=UsageOverviewResponse, summary="Get usage overview",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_usage(_: dict = Depends(get_current_user)):
    doc = await _account_doc()
    return UsageOverviewResponse(usage=doc.get("usage", []), usage_reset_date=doc.get("usage_reset_date", ""))


@router.get("/account/summary", response_model=BillingSummaryResponse, summary="Get billing summary",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_summary(_: dict = Depends(get_current_user)):
    doc = await _account_doc()
    return BillingSummaryResponse(**_summary(doc))


@router.put("/account/plan", response_model=BillingAccountResponse, summary="Change the current plan",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def change_plan(payload: ChangePlanRequest, _: dict = Depends(get_current_user)):
    plan = await _plans().find_one({"name": payload.plan_name})
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    doc = await _account_doc()
    await _accounts().update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "plan": plan["name"],
            "plan_price": plan["price"],
            "plan_description": plan["description"],
            "status": "Active",
        }},
    )
    doc = await _account_doc()
    data = BillingAccountModel.to_response(doc)
    data["summary"] = _summary(doc)
    return BillingAccountResponse(**data)


@router.post("/account/cancel", response_model=BillingAccountResponse, summary="Cancel the subscription",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def cancel_subscription(_: dict = Depends(get_current_user)):
    doc = await _account_doc()
    await _accounts().update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "Cancelled", "auto_pay": False}}
    )
    doc = await _account_doc()
    data = BillingAccountModel.to_response(doc)
    data["summary"] = _summary(doc)
    return BillingAccountResponse(**data)


@router.put("/account/payment", response_model=BillingAccountResponse, summary="Update the payment method",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def update_payment(payload: UpdatePaymentRequest, _: dict = Depends(get_current_user)):
    doc = await _account_doc()
    digits = "".join(ch for ch in payload.number if ch.isdigit())
    last4 = digits[-4:] if digits else doc.get("card", {}).get("last4", "")
    card = {
        "brand": payload.brand,
        "last4": last4,
        "expiry": payload.expiry.strip(),
        "is_primary": True,
    }
    await _accounts().update_one({"_id": doc["_id"]}, {"$set": {"card": card}})
    doc = await _account_doc()
    data = BillingAccountModel.to_response(doc)
    data["summary"] = _summary(doc)
    return BillingAccountResponse(**data)


@router.patch("/account/autopay", response_model=BillingAccountResponse, summary="Toggle auto-pay",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def toggle_autopay(payload: AutoPayRequest, _: dict = Depends(get_current_user)):
    doc = await _account_doc()
    await _accounts().update_one({"_id": doc["_id"]}, {"$set": {"auto_pay": payload.auto_pay}})
    doc = await _account_doc()
    data = BillingAccountModel.to_response(doc)
    data["summary"] = _summary(doc)
    return BillingAccountResponse(**data)


@router.put("/account/billing-info", response_model=BillingInfoResponse, summary="Update billing information",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def update_billing_info(payload: BillingInfoUpdate, _: dict = Depends(get_current_user)):
    doc = await _account_doc()
    billing_info = {
        "company": payload.company.strip(),
        "email": payload.email.strip(),
        "gstin": payload.gstin.strip(),
        "address": payload.address.strip(),
    }
    await _accounts().update_one({"_id": doc["_id"]}, {"$set": {"billing_info": billing_info}})
    return BillingInfoResponse(**billing_info)


# --- Plans --------------------------------------------------------------------

@router.get("/plans", response_model=list[PlanResponse], summary="List available plans",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_plans(_: dict = Depends(get_current_user)):
    account = await _accounts().find_one({})
    current_name = account.get("plan") if account else None
    items = []
    async for doc in _plans().find({}).sort("order", 1):
        item = PlanModel.to_response(doc)
        item["current"] = item["name"] == current_name
        items.append(PlanResponse(**item))
    return items


# --- Invoices -----------------------------------------------------------------

@router.get("/invoices", response_model=InvoiceListResponse, summary="List invoices (Billing History)",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_invoices(
    status: Optional[str] = Query(None, description="Filter by status: Paid|Pending|Failed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("All", "all"):
        query["status"] = status

    total, docs = await paged(
        _invoices(), query,
        sort="invoice_number", direction=-1,  # newest first (INV numbers increase over time)
        page=page, page_size=page_size,
    )
    items = [InvoiceModel.to_response(doc) for doc in docs]
    return InvoiceListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/invoices/{invoice_number}/download", summary="Download an invoice as CSV",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def download_invoice(invoice_number: str, _: dict = Depends(get_current_user)):
    doc = await _invoices().find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    inv = InvoiceModel.to_response(doc)
    rows = [
        ["Invoice", "Date", "Description", "Plan Period", "Amount", "Status"],
        [inv["invoice_number"], inv["date"], inv["description"], inv["period"], inv["amount"], inv["status"]],
    ]
    csv = "\n".join(",".join(f'"{cell}"' for cell in row) for row in rows)
    filename = f"{inv['invoice_number']}.csv"
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/invoices/{invoice_number}", response_model=InvoiceResponse, summary="Get an invoice",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_invoice(invoice_number: str, _: dict = Depends(get_current_user)):
    doc = await _invoices().find_one({"invoice_number": invoice_number})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return InvoiceResponse(**InvoiceModel.to_response(doc))


# --- Seeding ------------------------------------------------------------------

# The exact current-plan card, payment method, usage and billing-info the UI ships with.
_FEATURES = [
    {"icon": "Users", "label": "Unlimited", "sub": "Users"},
    {"icon": "CalendarDays", "label": "Unlimited", "sub": "Appointments"},
    {"icon": "Package", "label": "50", "sub": "Programs"},
    {"icon": "CloudUpload", "label": "100 GB", "sub": "Storage"},
    {"icon": "Headphones", "label": "Priority", "sub": "Support"},
]

_USAGE = [
    {"icon": "Users", "label": "Users", "value": "128 / Unlimited", "pct": 10, "color": "#e6117e"},
    {"icon": "CalendarDays", "label": "Appointments", "value": "3,842 / Unlimited", "pct": 40, "color": "#8b5cf6"},
    {"icon": "Package", "label": "Programs", "value": "45 / 50", "pct": 90, "color": "#f59e0b"},
    {"icon": "CloudUpload", "label": "Storage", "value": "62.4 GB / 100 GB", "pct": 62, "color": "#22c55e"},
    {"icon": "Mail", "label": "Email Credits", "value": "8,542 / 10,000", "pct": 85, "color": "#3b82f6"},
]

_ACCOUNT = dict(
    plan="Professional Plan",
    plan_price="₹2,999",
    plan_description="Everything in Basic, plus advanced features to grow your platform.",
    status="Active",
    billing_cycle="Monthly",
    next_billing_date="Jun 20, 2024",
    usage_reset_date="Jun 20, 2024",
    auto_pay=True,
    card={"brand": "Mastercard", "last4": "4242", "expiry": "12/26", "is_primary": True},
    billing_info={
        "company": "WomSakhi Pvt. Ltd.",
        "email": "billing@womsakhi.com",
        "gstin": "29ABCDE1234F1Z5",
        "address": "12 Artisan Lane, Bengaluru, KA 560001",
    },
    features=_FEATURES,
    usage=_USAGE,
    tax_percent=18,
    currency="INR",
)

# The 3 tiers offered in the Change Plan modal.
_PLANS = [
    dict(name="Basic Plan", price="₹999", description="Essential tools for small teams getting started.", order=1),
    dict(name="Professional Plan", price="₹2,999", description="Everything in Basic, plus advanced features to grow your platform.", order=2),
    dict(name="Enterprise Plan", price="₹6,999", description="Unlimited scale, dedicated support and custom integrations.", order=3),
]

# The 5 Billing History rows (all on the active Professional Plan, all Paid).
_INVOICE_ROWS = [
    ("INV-2024-0052", "May 20, 2024", "May 20 – Jun 20, 2024"),
    ("INV-2024-0041", "Apr 20, 2024", "Apr 20 – May 20, 2024"),
    ("INV-2024-0030", "Mar 20, 2024", "Mar 20 – Apr 20, 2024"),
    ("INV-2024-0019", "Feb 20, 2024", "Feb 20 – Mar 20, 2024"),
    ("INV-2024-0008", "Jan 20, 2024", "Jan 20 – Feb 20, 2024"),
]


async def seed() -> None:
    """Seed the billing_account / plans / invoices collections when empty."""
    db = get_database()

    if await db[BillingAccountModel.collection_name].count_documents({}) == 0:
        await db[BillingAccountModel.collection_name].insert_one(
            BillingAccountModel.create_document(**_ACCOUNT)
        )
        print("🌱 Seeded 1 billing account")

    if await db[PlanModel.collection_name].count_documents({}) == 0:
        docs = [PlanModel.create_document(**p) for p in _PLANS]
        await db[PlanModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} plans")

    if await db[InvoiceModel.collection_name].count_documents({}) == 0:
        docs = [
            InvoiceModel.create_document(
                invoice_number=number,
                date=date,
                period=period,
                description="Professional Plan – Monthly",
                plan="Professional Plan",
                amount="₹2,999",
                status="Paid",
            )
            for (number, date, period) in _INVOICE_ROWS
        ]
        await db[InvoiceModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} invoices")

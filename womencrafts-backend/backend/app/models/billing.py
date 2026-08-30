from typing import Optional


class BillingAccountModel:
    """
    The 'billing_account' collection — a SINGLETON document powering the
    Billing & Subscription settings screen (current plan card, payment method,
    usage overview, billing summary and the billing-information modal).

    Money / usage figures the UI paints verbatim (e.g. "₹2,999", "128 / Unlimited")
    are stored as-is (strings). The Billing Summary (subtotal / taxes / total) is
    derived from `plan_price` + `tax_percent` at read time so it always tracks the
    active plan.
    """

    collection_name = "billing_account"

    STATUSES = ["Active", "Cancelled"]

    @staticmethod
    def create_document(
        plan: str,
        plan_price: str,
        plan_description: str,
        status: str = "Active",
        billing_cycle: str = "Monthly",
        next_billing_date: str = "",
        usage_reset_date: str = "",
        auto_pay: bool = True,
        card: Optional[dict] = None,
        billing_info: Optional[dict] = None,
        features: Optional[list] = None,
        usage: Optional[list] = None,
        tax_percent: int = 18,
        currency: str = "INR",
    ) -> dict:
        return {
            "plan": plan,
            "plan_price": plan_price,                 # display string, e.g. "₹2,999"
            "plan_description": plan_description,
            "status": status,                         # Active | Cancelled
            "billing_cycle": billing_cycle,           # "Monthly"
            "next_billing_date": next_billing_date,   # "Jun 20, 2024"
            "usage_reset_date": usage_reset_date,     # "Jun 20, 2024"
            "auto_pay": auto_pay,
            "card": card or {},                       # {brand, last4, expiry, is_primary}
            "billing_info": billing_info or {},       # {company, email, gstin, address}
            "features": features or [],               # [{icon, label, sub}]
            "usage": usage or [],                     # [{icon, label, value, pct, color}]
            "tax_percent": tax_percent,               # 18
            "currency": currency,                     # "INR"
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "plan": doc.get("plan", ""),
            "plan_price": doc.get("plan_price", ""),
            "plan_description": doc.get("plan_description", ""),
            "status": doc.get("status", "Active"),
            "billing_cycle": doc.get("billing_cycle", "Monthly"),
            "next_billing_date": doc.get("next_billing_date", ""),
            "usage_reset_date": doc.get("usage_reset_date", ""),
            "auto_pay": doc.get("auto_pay", True),
            "card": doc.get("card", {}),
            "billing_info": doc.get("billing_info", {}),
            "features": doc.get("features", []),
            "usage": doc.get("usage", []),
        }


class PlanModel:
    """The 'plans' collection — the 3 tiers offered in the Change Plan modal."""

    collection_name = "plans"

    @staticmethod
    def create_document(
        name: str,
        price: str,
        description: str,
        billing_cycle: str = "Monthly",
        order: int = 0,
    ) -> dict:
        return {
            "name": name,
            "price": price,                # display string, e.g. "₹999"
            "description": description,
            "billing_cycle": billing_cycle,
            "order": order,                # sort order in the modal
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "price": doc.get("price", ""),
            "description": doc.get("description", ""),
            "billing_cycle": doc.get("billing_cycle", "Monthly"),
            "order": doc.get("order", 0),
        }


class InvoiceModel:
    """The 'invoices' collection — the rows in the Billing History table."""

    collection_name = "invoices"

    STATUSES = ["Paid", "Pending", "Failed"]

    @staticmethod
    def create_document(
        invoice_number: str,
        date: str,
        period: str,
        description: str,
        plan: str,
        amount: str,
        status: str = "Paid",
    ) -> dict:
        return {
            "invoice_number": invoice_number,   # "INV-2024-0052"
            "date": date,                       # "May 20, 2024"
            "period": period,                   # "May 20 – Jun 20, 2024"
            "description": description,          # "Professional Plan – Monthly"
            "plan": plan,                       # "Professional Plan"
            "amount": amount,                   # display string, e.g. "₹2,999"
            "status": status,                   # Paid | Pending | Failed
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "invoice_number": doc.get("invoice_number", ""),
            "date": doc.get("date", ""),
            "period": doc.get("period", ""),
            "description": doc.get("description", ""),
            "plan": doc.get("plan", ""),
            "amount": doc.get("amount", ""),
            "status": doc.get("status", "Paid"),
        }

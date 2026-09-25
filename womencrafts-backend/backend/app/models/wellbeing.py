"""
The four domains the engine needed and the backend did not have.

School fees, care tasks, benefit claims and health habits all exist as screens
in the app and as nothing at all in the database — the frontend renders them
from fixtures. That is fine for a screen and impossible for a scheduler: you
cannot remind a woman about a fee instalment that exists only in a React
component.

So each gets the smallest honest model that a reminder can be built from: who
it belongs to, when it is due, and whether it is done. Nothing more — these
are not the finished modules, they are the shape those modules will need, and
the engine can work against them today.

Amounts are minor units throughout, like every other amount in this codebase.
"""

from datetime import datetime, timezone


class SchoolFeeModel:
    """
    `school_fees` — a term's fee for one child, and when it is due.

    Per instalment rather than per term: a fee she pays in three parts is
    three deadlines, and reminding her once about "the term" is how the second
    instalment is missed.
    """

    collection_name = "school_fees"

    STATUS_DUE = "due"
    STATUS_PAID = "paid"
    STATUS_WAIVED = "waived"

    @staticmethod
    def create_document(*, user_id: str, child_name: str, school: str,
                        label: str, amount_minor: int, due_on: str,
                        member_id: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "child_name": child_name,
            "school": school,
            "label": label,                 # "Term 2 fees", "Books and uniform"
            "amount_minor": int(amount_minor),
            "due_on": due_on,               # ISO date
            "status": SchoolFeeModel.STATUS_DUE,
            "paid_at": None,
            "created_at": now,
            "updated_at": now,
        }


class CareTaskModel:
    """
    `care_tasks` — a meal, an errand, a lift to an appointment.

    CARE-UC-004 asks for exactly this: *"each has an owner and due time"*. The
    owner is what makes it a commitment rather than a hope, and it is why the
    reminder goes to the woman who offered, not to the woman who needs it.
    """

    collection_name = "care_tasks"

    KINDS = ("meal", "errand", "transport", "childcare", "visit")
    STATUS_OPEN = "open"
    STATUS_DONE = "done"
    STATUS_CANCELLED = "cancelled"

    @staticmethod
    def create_document(*, circle_id: str, owner_user_id: str,
                        for_member: str, kind: str, label: str,
                        due_at: datetime) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "circle_id": circle_id,
            # The reminder goes HERE — to whoever took it on.
            "user_id": owner_user_id,
            "for_member": for_member,
            "kind": kind if kind in CareTaskModel.KINDS else "errand",
            "label": label,
            "due_at": due_at,
            "status": CareTaskModel.STATUS_OPEN,
            "done_at": None,
            "created_at": now,
            "updated_at": now,
        }


class BenefitClaimModel:
    """
    `benefit_claims` — a scheme she is actually pursuing, and its closing date.

    BENEFIT-UC-006 wants a deadline reminder that survives *"timezone, closing
    date and source changes"*. So the closing date lives on her claim rather
    than only on the scheme: when the government moves it, the sweep moves her
    reminder, and the record shows both.
    """

    collection_name = "benefit_claims"

    STATE_TRACKING = "tracking"      # she has said she wants this one
    STATE_APPLIED = "applied"
    STATE_RECEIVED = "received"
    STATE_REFUSED = "refused"
    STATE_EXPIRED = "expired"

    @staticmethod
    def create_document(*, user_id: str, scheme_key: str, scheme_name: str,
                        closes_on: str, member_id: str = "",
                        papers_needed: list[str] | None = None) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "scheme_key": scheme_key,
            "scheme_name": scheme_name,
            "closes_on": closes_on,          # ISO date
            "papers_needed": list(papers_needed or []),
            "state": BenefitClaimModel.STATE_TRACKING,
            "applied_at": None,
            "created_at": now,
            "updated_at": now,
        }


class HealthHabitModel:
    """
    `health_habits` — a habit or a screening, with a cadence.

    HEALTH-UC-005 and HEALTH-UC-019 in one model because they are the same
    thing at different intervals: a daily tablet and a two-yearly screening
    both reduce to "remind her every N, at this local time".

    `adherence` is a list of dates she confirmed, which is what turns a
    reminder into the adherence log HEALTH-UC-011 asks for — and it is her
    record, never a score and never shown to anyone else.
    """

    collection_name = "health_habits"

    KIND_HABIT = "habit"
    KIND_MEDICATION = "medication"
    KIND_SCREENING = "screening"

    @staticmethod
    def create_document(*, user_id: str, kind: str, label: str,
                        every_days: int, local_time: str = "09:00",
                        member_id: str = "", note: str = "",
                        next_due: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "kind": kind,
            "label": label,
            # 1 = daily, 7 = weekly, 730 = every two years. One field instead
            # of three schedule types, because the engine already owns
            # recurrence and this only has to say how often.
            "every_days": max(1, int(every_days)),
            "local_time": local_time,
            "note": note,
            "next_due": next_due,
            "adherence": [],
            "active": True,
            "created_at": now,
            "updated_at": now,
        }

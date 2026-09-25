"""
Whether an employer actually pays — from women who worked for them.

── Why this cannot be seeded, ever ─────────────────────────────────────────
The screen this feeds carried four invented employers, one of them flagged
"Four women say they were never paid. Ask for money up front, or walk away."
Nobody had said anything. If that name had matched a real business it is a
defamatory claim about them; either way it is a woman deciding whether to take
work on evidence that does not exist.

So there are two collections and a hard rule between them:

  employers         a name somebody has worked for. A directory entry, no
                    judgement attached.
  employer_reports  one woman, one job, one outcome. The ONLY source of any
                    number on the screen.

Counts are derived from reports at read time. There is no stored score to seed,
no default reputation, and an employer nobody has reported on shows as exactly
that — which is honest and still useful, because "nobody has said anything" is
a different thing from "they are fine", and she deserves to know which she is
looking at.
"""

from datetime import datetime, timezone

#: What happened about the money. Deliberately coarse: a woman recalling a job
#: from three months ago knows which of these it was and would have to guess at
#: anything finer.
OUTCOMES = ("paid_on_time", "paid_late", "never_paid")

#: How many separate women must have reported before any count is shown.
#:
#: One report is a dispute between two people, and publishing it as a verdict
#: about a business is both unfair and legally exposed. Two is still thin; the
#: screen says how many so she can weigh it herself.
MIN_REPORTS_TO_SHOW = 2


class EmployerModel:
    collection_name = "employers"

    @staticmethod
    def create_document(*, name: str, kind: str = "", added_by: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            # Matched case-insensitively so "Rangoli Exports" and "rangoli
            # exports" are one business rather than two half-empty records.
            "name": name.strip()[:120],
            "name_key": name.strip().lower()[:120],
            "kind": kind.strip()[:60],
            "added_by": added_by,
            "created_at": now,
        }


class EmployerReportModel:
    collection_name = "employer_reports"

    @staticmethod
    def create_document(
        *, employer_id: str, user_id: str, outcome: str,
        what: str = "", amount_minor: int = 0, days_late: int = 0,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "employer_id": employer_id,
            # Stored so one woman cannot report the same employer twice and
            # move the count on her own. Never shown to anybody.
            "user_id": user_id,
            "outcome": outcome if outcome in OUTCOMES else "paid_on_time",
            "what": what.strip()[:140],
            "amount_minor": max(0, int(amount_minor)),
            "days_late": max(0, int(days_late)),
            "created_at": now,
        }


def summarise(employer: dict, reports: list[dict]) -> dict:
    """
    One employer as she should see it.

    Every number is counted from `reports`. Below `MIN_REPORTS_TO_SHOW` the
    counts are withheld and `enough` is False, so the screen can say "too few
    women have reported to say anything" instead of turning one bad month into
    a verdict.
    """
    n = len(reports)
    counts = {o: sum(1 for r in reports if r.get("outcome") == o) for o in OUTCOMES}
    last = max((r.get("created_at") for r in reports if r.get("created_at")), default=None)
    return {
        "id": str(employer.get("_id", "")),
        "name": employer.get("name", ""),
        "kind": employer.get("kind", ""),
        "worked_by": n,
        "enough": n >= MIN_REPORTS_TO_SHOW,
        # Withheld, not zeroed — a zero reads as "nobody was ever paid late".
        "paid_on_time": counts["paid_on_time"] if n >= MIN_REPORTS_TO_SHOW else None,
        "paid_late": counts["paid_late"] if n >= MIN_REPORTS_TO_SHOW else None,
        "never_paid": counts["never_paid"] if n >= MIN_REPORTS_TO_SHOW else None,
        "last_report": last.isoformat() if isinstance(last, datetime) else "",
        # No prose verdict. The old fixture wrote her advice — "ask for money up
        # front, or walk away" — into the data; what goes on the screen is the
        # count, and the judgement stays hers.
    }

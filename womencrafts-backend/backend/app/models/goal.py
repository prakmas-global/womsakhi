"""
What she is working towards, and how far along she is.

**Progress is computed, never stored** — for money goals at least. A goal that
says "₹24,350 of ₹30,000" while the ledger says something else is a goal she
stops believing, and the moment progress becomes a stored number it starts
drifting from the thing it is supposed to measure. Money goals are summed from
her earnings; the rest she moves herself, because nothing on the platform knows
how many regular clients she has found.

Three kinds, because they are measured differently and the screen has to know:

- **money** — in minor units, progress from the wallet ledger this month
- **skill** — lessons or sessions, progress from her enrolments
- **count** — anything she counts herself: clients, orders, kilos

A goal without a date is a wish. `by` is required at the model, and the screen
says so before it will save.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class GoalModel:
    collection_name = "goals"

    KIND_MONEY = "money"
    KIND_SKILL = "skill"
    KIND_COUNT = "count"
    KINDS = (KIND_MONEY, KIND_SKILL, KIND_COUNT)

    STATUS_OPEN = "open"
    STATUS_REACHED = "reached"
    STATUS_DROPPED = "dropped"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        member_id: str,
        label: str,
        kind: str,
        target: int,
        by: str,
        unit: str = "",
        current: int = 0,
        icon: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        kind = kind if kind in GoalModel.KINDS else GoalModel.KIND_COUNT
        return {
            "user_id": user_id,
            "member_id": member_id,
            "label": label.strip(),
            "kind": kind,
            # Money targets are minor units like every other amount here; the
            # other kinds are plain counts.
            "target": int(target),
            # Only ever moved by her, and only for kinds nothing can measure.
            # A money goal ignores this and reads the ledger.
            "current": int(current),
            "unit": unit.strip() or ("₹" if kind == GoalModel.KIND_MONEY else ""),
            "by": by.strip(),
            "icon": icon or ("TrendingUp" if kind == GoalModel.KIND_MONEY else "Target"),
            "status": GoalModel.STATUS_OPEN,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, current: int | None = None) -> dict:
        """`current` is passed in for kinds the platform can measure."""
        target = int(doc.get("target", 0))
        got = int(doc.get("current", 0)) if current is None else int(current)
        when = aware(doc.get("created_at"))
        return {
            "id": str(doc["_id"]),
            "label": doc.get("label", ""),
            "kind": doc.get("kind", GoalModel.KIND_COUNT),
            "target": target,
            "current": got,
            # Capped at 100 for the bar, but `current` is not — a woman who beat
            # her goal should see that she beat it, not that she exactly met it.
            "pct": min(100, round(got * 100 / target)) if target else 0,
            "reached": bool(target) and got >= target,
            "unit": doc.get("unit", ""),
            "by": doc.get("by", ""),
            "icon": doc.get("icon", "Target"),
            "status": doc.get("status", GoalModel.STATUS_OPEN),
            # Whether she moves it herself. The screen shows +/− only for these.
            "manual": doc.get("kind") == GoalModel.KIND_COUNT,
            "set_on": when.strftime("%d %b %Y") if when else "",
        }

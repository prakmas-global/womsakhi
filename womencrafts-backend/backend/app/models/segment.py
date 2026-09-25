from datetime import datetime, timezone
from typing import Optional


class SegmentModel:
    """
    The 'segments' collection — saved groupings of the members directory,
    shown on Users → Segments.

    A segment is a RULE, not a number. It used to store `users: "3,245"` and
    `growth: "18.6%"` as strings typed in by a seed, and the screen rendered
    them as if they were counts. Nothing ever updated them. Now the stored
    row is the rule (`segment`, `role`, `status` — each optional) and every
    figure on the screen is counted from `members` at read time.
    """

    collection_name = "segments"

    STATUSES = ["Active", "Inactive"]

    @staticmethod
    def create_document(
        name: str,
        desc: str = "",
        status: str = "Active",
        icon: str = "Users",
        rule: Optional[dict] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "desc": desc.strip(),
            "status": status,
            "icon": icon,
            "rule": SegmentModel.clean_rule(rule),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def clean_rule(rule: Optional[dict]) -> dict:
        """Keep only the three known keys; None means 'any'."""
        rule = rule or {}
        out: dict = {}
        for key in ("segment", "role", "status"):
            if key in rule and rule[key] is not None:
                out[key] = str(rule[key]).strip()
        return out

    @staticmethod
    def rule_for(doc: dict) -> dict:
        """
        The rule to count with. Rows seeded before rules existed have none, so
        one is derived from the name: "Entrepreneurs" → members whose segment
        is "Entrepreneur", "Instructors" → members whose role is "Instructor".
        """
        from app.models.member import MemberModel

        stored = doc.get("rule")
        if isinstance(stored, dict) and stored:
            return SegmentModel.clean_rule(stored)
        name = (doc.get("name") or "").strip()
        singular = name[:-1] if name.endswith("s") else name
        if singular in MemberModel.SEGMENTS:
            return {"segment": singular}
        if singular in MemberModel.ROLES:
            return {"role": singular}
        if name.lower() in ("others", "other", "unsegmented"):
            return {"segment": ""}
        return {}

    @staticmethod
    def matches(rule: dict, member: dict) -> bool:
        for key, want in rule.items():
            if (member.get(key) or "") != want:
                return False
        return True

    @staticmethod
    def to_response(doc: dict, live: dict) -> dict:
        created = doc.get("created_at")
        count = int(live.get("member_count", 0))
        active = int(live.get("active_count", 0))
        new_30 = int(live.get("new_30d", 0))
        prev_30 = int(live.get("prev_30d", 0))
        total = int(live.get("members_total", 0))
        active_pct = round(active * 100 / count, 1) if count else 0.0
        pct_of_total = round(count * 100 / total, 1) if total else 0.0
        growth_pct = (
            round((new_30 - prev_30) * 100 / prev_30, 1) if prev_30 else (100.0 if new_30 else 0.0)
        )
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "desc": doc.get("desc", ""),
            "status": doc.get("status", "Active"),
            "icon": doc.get("icon", "Users"),
            "rule": SegmentModel.rule_for(doc),
            "member_count": count,
            "active_count": active,
            "active_pct": active_pct,
            "pct_of_total": pct_of_total,
            "new_30d": new_30,
            "prev_30d": prev_30,
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
            "users": f"{count:,}",
            "pct": f"{pct_of_total}%",
            "eng": int(round(active_pct)),
            "growth": f"{abs(growth_pct)}%",
            "up": growth_pct >= 0,
        }

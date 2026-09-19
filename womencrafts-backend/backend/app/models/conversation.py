"""
Member messages and notifications.

Both are deliberately simple, because on a phone simple wins:

  • **Messages** — ONE thread per member, with the WomSakhi team. She never has
    to choose a recipient, find a department, or wonder who is listening. Staff
    see the same thread from the admin side.

  • **Notifications** — her own feed, written by the system when something
    actually happens to *her* (booking confirmed, application approved). Never a
    broadcast dumped on everyone.
"""

from datetime import datetime, timezone
from typing import Optional


class MemberMessageModel:
    """One message in a member's support thread."""

    collection_name = "member_messages"

    FROM_MEMBER = "member"
    FROM_TEAM = "team"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        body: str,
        sender: str = FROM_MEMBER,
        sender_name: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,          # whose thread this belongs to
            "member_id": member_id,
            "sender": sender,            # member | team
            "sender_name": sender_name,
            "body": body.strip(),
            # Read by the *other* side. A member's own message is read by her
            # the moment she sends it.
            "read_by_member": sender == MemberMessageModel.FROM_MEMBER,
            "read_by_team": sender == MemberMessageModel.FROM_TEAM,
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "sender": doc.get("sender", "member"),
            "sender_name": doc.get("sender_name", ""),
            "body": doc.get("body", ""),
            "sent_at": created.isoformat() if isinstance(created, datetime) else "",
            "sent_label": created.strftime("%d %b, %I:%M %p") if isinstance(created, datetime) else "",
        }


class MemberNotificationModel:
    """Something that happened to this member, worth telling her about."""

    collection_name = "member_notifications"

    # Kept small on purpose — every type must earn its place.
    TYPE_BOOKING = "booking"
    TYPE_PROGRAM = "program"
    TYPE_ACCOUNT = "account"
    TYPE_MESSAGE = "message"
    TYPE_SAFETY = "safety"
    TYPE_MENTORSHIP = "mentorship"
    TYPE_EVENT = "event"
    TYPE_MONEY = "money"
    TYPE_CIRCLE = "circle"
    TYPE_HEALTH = "health"

    # Every type the seeds and the app actually produce. Three of them —
    # safety, mentorship, event — were being written but not mapped, so they
    # all arrived at the screen as a generic bell and a member could not tell
    # a safety alert from a class reminder at a glance.
    ICONS = {
        TYPE_BOOKING: "CalendarCheck",
        TYPE_PROGRAM: "GraduationCap",
        TYPE_ACCOUNT: "ShieldCheck",
        TYPE_MESSAGE: "MessageCircle",
        TYPE_SAFETY: "LifeBuoy",
        TYPE_MENTORSHIP: "UserRoundCheck",
        TYPE_EVENT: "CalendarDays",
        TYPE_MONEY: "Wallet",
        TYPE_CIRCLE: "UsersRound",
        TYPE_HEALTH: "HeartPulse",
    }

    @staticmethod
    def create_document(
        user_id: str,
        title: str,
        body: str = "",
        ntype: str = TYPE_ACCOUNT,
        href: str = "",
    ) -> dict:
        return {
            "user_id": user_id,
            "type": ntype,
            "title": title,
            "body": body,
            "href": href,        # where tapping it should take her
            "unread": True,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        ntype = doc.get("type", "account")
        return {
            "id": str(doc["_id"]),
            "type": ntype,
            "icon": MemberNotificationModel.ICONS.get(ntype, "Bell"),
            "title": doc.get("title", ""),
            "body": doc.get("body", ""),
            "href": doc.get("href", ""),
            "unread": bool(doc.get("unread", True)),
            "when": MemberNotificationModel.relative(created),
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }

    @staticmethod
    def relative(when: Optional[datetime]) -> str:
        """'Just now' / '3h ago' / '2d ago' — kinder than a raw timestamp."""
        if not isinstance(when, datetime):
            return ""
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        seconds = (datetime.now(timezone.utc) - when).total_seconds()
        if seconds < 60:
            return "Just now"
        if seconds < 3600:
            return f"{int(seconds // 60)}m ago"
        if seconds < 86400:
            return f"{int(seconds // 3600)}h ago"
        if seconds < 604800:
            return f"{int(seconds // 86400)}d ago"
        return when.strftime("%d %b")


async def notify(db, user_id: str, title: str, body: str = "", ntype: str = "account", href: str = "") -> None:
    """
    Fire-and-forget notification.

    Never let a notification failure break the action that caused it — she cares
    that her booking was made, not that we failed to tell her about it.
    """
    try:
        await db[MemberNotificationModel.collection_name].insert_one(
            MemberNotificationModel.create_document(user_id, title, body, ntype, href)
        )
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  Could not write notification for {user_id}: {exc}")

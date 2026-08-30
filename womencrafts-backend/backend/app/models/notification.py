class NotificationModel:
    """
    The 'notifications' collection — every row in the Notifications feed
    (the grouped Today / Yesterday / Earlier list). Time labels the UI prints
    verbatim, like "10 min ago" or "Yesterday, 6:40 PM", are stored as-is.
    """

    collection_name = "notifications"

    # The 8 notification kinds; each maps to an icon/tone the frontend paints.
    TYPES = [
        "appointment",
        "message",
        "user",
        "payment",
        "alert",
        "feedback",
        "program",
        "system",
    ]

    # The three date buckets the feed groups rows into, in display order.
    GROUPS = ["Today", "Yesterday", "Earlier"]

    @staticmethod
    def create_document(
        type: str,
        title: str,
        desc: str,
        time: str,
        group: str = "Today",
        unread: bool = True,
    ) -> dict:
        return {
            "type": type,
            "title": title,
            "desc": desc,
            "time": time,        # verbatim label, e.g. "10 min ago"
            "group": group,      # Today | Yesterday | Earlier
            "unread": bool(unread),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "type": doc.get("type", ""),
            "title": doc.get("title", ""),
            "desc": doc.get("desc", ""),
            "time": doc.get("time", ""),
            "group": doc.get("group", "Earlier"),
            "unread": doc.get("unread", False),
        }


class NotificationChannelModel:
    """
    The 'notification_channels' collection — the delivery-channel toggles shown
    on the right rail (Email / Push / SMS / In-App). Each is either on or off.
    """

    collection_name = "notification_channels"

    @staticmethod
    def create_document(label: str, icon: str, on: bool = True) -> dict:
        return {
            "label": label,     # e.g. "Email"
            "icon": icon,       # lucide icon name the UI renders verbatim
            "on": bool(on),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "label": doc.get("label", ""),
            "icon": doc.get("icon", ""),
            "on": doc.get("on", False),
        }

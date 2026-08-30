from typing import Optional


class SessionModel:
    """
    The 'sessions' collection — powers the Settings › Sessions screen. It holds
    two flavours of row, distinguished by `status`:

      * "Active"     → shown in the "Active Sessions" table (the devices you are
                       currently signed in on). One of them is `is_current`.
      * "Signed Out" → shown in the "Session History" table (past logins).

    Every label the UI paints (device string, "2 mins ago", "May 20, 2024
    10:30 AM", location notes, tags) is stored verbatim so the frontend renders
    it as-is.
    """

    collection_name = "sessions"

    STATUSES = ["Active", "Signed Out"]

    # Icon name the UI maps to a lucide component (Monitor / Smartphone).
    DEVICE_TYPES = ["Monitor", "Smartphone"]

    @staticmethod
    def create_document(
        device_type: str,
        device: str,
        details: str,
        location: str,
        ip: str,
        status: str = "Active",
        is_current: bool = False,
        tag: Optional[str] = None,
        location_note: Optional[str] = None,
        last_active: Optional[str] = None,
        last_active_at: Optional[str] = None,
        login_time: Optional[str] = None,
        logout_time: Optional[str] = None,
    ) -> dict:
        return {
            "device_type": device_type,      # "Monitor" | "Smartphone" (icon name)
            "device": device,                # e.g. "Chrome on Windows"
            "details": details,              # e.g. "Windows 11 · Chrome 124.0.6367.91"
            "location": location,            # e.g. "Mumbai, Maharashtra, India"
            "ip": ip,                        # e.g. "103.21.244.18"
            "status": status,                # "Active" | "Signed Out"
            "is_current": is_current,        # True only for the session you are on
            "tag": tag,                      # e.g. "Current Session" (or None)
            "location_note": location_note,  # "Current Location" | "Trusted Device" | None
            "last_active": last_active,      # relative label, e.g. "2 mins ago"
            "last_active_at": last_active_at,  # absolute label, e.g. "May 20, 2024 10:30 AM"
            "login_time": login_time,        # history only, e.g. "May 20, 2024 07:45 AM"
            "logout_time": logout_time,      # history only, e.g. "May 20, 2024 10:28 AM"
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "device_type": doc.get("device_type", ""),
            "device": doc.get("device", ""),
            "details": doc.get("details", ""),
            "location": doc.get("location", ""),
            "ip": doc.get("ip", ""),
            "status": doc.get("status", "Active"),
            "is_current": bool(doc.get("is_current", False)),
            "tag": doc.get("tag"),
            "location_note": doc.get("location_note"),
            "last_active": doc.get("last_active"),
            "last_active_at": doc.get("last_active_at"),
            "login_time": doc.get("login_time"),
            "logout_time": doc.get("logout_time"),
        }


class SystemLogModel:
    """
    The 'system_logs' collection — every row of the Settings › System Logs table
    and its detail modal. The timestamp is a pre-formatted display string
    ("May 20 10:32:14") stored exactly as the UI shows it.
    """

    collection_name = "system_logs"

    LEVELS = ["Info", "Success", "Warning", "Error"]

    @staticmethod
    def create_document(
        time: str,
        level: str,
        source: str,
        message: str,
        user: str = "System",
        ip: str = "-",
    ) -> dict:
        return {
            "time": time,        # display timestamp, e.g. "May 20 10:32:14"
            "level": level,      # "Info" | "Success" | "Warning" | "Error"
            "source": source,    # module/action tag, e.g. "auth", "backup"
            "message": message,  # human-readable line the table shows
            "user": user,        # actor, e.g. "Admin User" or "System"
            "ip": ip,            # source IP or "-"
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "time": doc.get("time", ""),
            "level": doc.get("level", "Info"),
            "source": doc.get("source", ""),
            "message": doc.get("message", ""),
            "user": doc.get("user", "System"),
            "ip": doc.get("ip", "-"),
        }

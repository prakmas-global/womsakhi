"""
Enrollments and bookings — the records that BELONG to a member.

The admin side models the platform's inventory: programs, services, appointment
slots. None of it says who anything belongs to (an appointment stores a name
string; a program stores an enrolled *count*). The member app needs the other
half — "what is mine?" — so ownership lives here, keyed on the user id from the
token and never on anything the client sends.
"""

from datetime import datetime, timezone
from typing import Optional


class EnrollmentModel:
    """A member joining a program, and how far she has got."""

    collection_name = "enrollments"

    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_WITHDRAWN = "withdrawn"
    STATUSES = [STATUS_ACTIVE, STATUS_COMPLETED, STATUS_WITHDRAWN]

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        program_id: str,
        program_name: str = "",
        status: str = STATUS_ACTIVE,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "program_id": program_id,
            "program_name": program_name,
            "status": status if status in EnrollmentModel.STATUSES else EnrollmentModel.STATUS_ACTIVE,
            "progress": 0,              # 0-100, how much of the program she's done
            "sessions_attended": 0,
            "last_activity_at": now,
            "completed_at": None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, program: Optional[dict] = None) -> dict:
        created = doc.get("created_at")
        out = {
            "id": str(doc["_id"]),
            "program_id": doc.get("program_id", ""),
            "program_name": doc.get("program_name", ""),
            "status": doc.get("status", "active"),
            "progress": doc.get("progress", 0),
            "sessions_attended": doc.get("sessions_attended", 0),
            "joined": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
            # Filled from the program document when available, so the member app
            # can render a full card without a second request.
            "category": "",
            "mode": "",
            "duration": "",
            "dates": "",
            "days": "",
            "desc": "",
            "cover": "",
        }
        if program:
            out.update(
                program_name=program.get("name", out["program_name"]),
                category=program.get("category", ""),
                mode=program.get("mode", ""),
                duration=program.get("duration", ""),
                dates=program.get("dates", ""),
                days=program.get("days", ""),
                desc=program.get("desc", ""),
                cover=program.get("cover", ""),
            )
        return out


class BookingModel:
    """
    A member's booked session.

    Separate from the admin `appointments` collection on purpose: that one is the
    staff's operational diary and stores free-text names. This one is hers, keyed
    to her account, and is the only thing the member app reads or writes.
    """

    collection_name = "bookings"

    STATUS_UPCOMING = "upcoming"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUSES = [STATUS_UPCOMING, STATUS_COMPLETED, STATUS_CANCELLED]

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        service_id: str,
        service_name: str,
        date: str,
        time: str,
        mode: str = "Online",
        note: str = "",
        with_whom: str = "",
        duration: str = "",
        price: float = 0.0,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "service_id": service_id,
            "service_name": service_name,
            "date": date,          # ISO date, e.g. "2026-08-20"
            "time": time,          # slot label, e.g. "10:00 AM"
            "mode": mode,          # Online | In person
            "with_whom": with_whom,
            "duration": duration,
            "price": price,
            "note": note,
            "status": BookingModel.STATUS_UPCOMING,
            "cancelled_reason": "",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "service_id": doc.get("service_id", ""),
            "service_name": doc.get("service_name", ""),
            "date": doc.get("date", ""),
            "time": doc.get("time", ""),
            "mode": doc.get("mode", ""),
            "with_whom": doc.get("with_whom", ""),
            "duration": doc.get("duration", ""),
            "price": doc.get("price", 0),
            "note": doc.get("note", ""),
            "status": doc.get("status", "upcoming"),
            "cancelled_reason": doc.get("cancelled_reason", ""),
            "booked_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }

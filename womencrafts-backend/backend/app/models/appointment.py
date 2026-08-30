from typing import Optional


class AppointmentModel:
    """
    The 'appointments' collection — every booking shown on the Appointments
    screen (Calendar / Board / List views plus the detail & New Appointment
    modals). Colors/labels the UI paints verbatim are stored as-is.
    """

    collection_name = "appointments"

    # Allowed values, kept here so routes / schemas / seed all agree.
    STATUSES = ["Upcoming", "Completed", "Cancelled", "Rescheduled"]

    # The 10 services the "New Appointment" dropdown offers.
    SERVICES = [
        "Career Counseling",
        "Skill Workshop",
        "Mentoring Session",
        "Business Consultation",
        "Financial Literacy",
        "Health & Wellness",
        "Handicraft Training",
        "Entrepreneurship",
        "Digital Skills",
        "Marketing Basics",
    ]

    @staticmethod
    def create_document(
        name: str,
        service: str,
        day: str = "",
        date: str = "",
        time: str = "",
        status: str = "Upcoming",
        category: str = "Career",
        color: str = "#f9a8ce",
        bg: str = "bg-pink-50/70 dark:bg-pink-500/15",
        duration: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        return {
            "name": name.strip(),
            "service": service,
            "day": day,            # short weekday label, e.g. "Mon"
            "date": date,          # short date label, e.g. "May 20"
            "time": time,          # time range the card shows, e.g. "09:00 - 10:00 AM"
            "status": status,
            "category": category,  # legend bucket: Career/Skills/Business/Wellness/Finance
            "color": color,        # accent hex the UI draws verbatim
            "bg": bg,              # tailwind bg classes the UI applies verbatim
            "duration": duration,
            "notes": notes,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "service": doc.get("service", ""),
            "day": doc.get("day", ""),
            "date": doc.get("date", ""),
            "time": doc.get("time", ""),
            "status": doc.get("status", "Upcoming"),
            "category": doc.get("category", ""),
            "color": doc.get("color", ""),
            "bg": doc.get("bg", ""),
            "duration": doc.get("duration"),
            "notes": doc.get("notes"),
        }

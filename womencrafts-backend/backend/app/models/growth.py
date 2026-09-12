"""
The things that move a member forward: events she can attend, mentors she can
learn from, and paid work she can apply for.

Opportunities are the point of the whole platform. A woman finishes a tailoring
programme and then what? This is the "then what" — orders, jobs, freelance work,
listed by us and applied for in the app, with an honest status she can track
rather than silence.
"""

from datetime import date, datetime, timezone
from typing import Optional
import re

from app.core.media import media_url


def _pretty_date(iso: str) -> str:
    """'2026-08-20' -> 'Thu, 20 Aug'. Falls back to the raw string."""
    try:
        d = date.fromisoformat(iso)
        return d.strftime("%a, %d %b")
    except (ValueError, TypeError):
        return iso or ""


# ── what an opportunity pays ──────────────────────────────────────────────────
#
# `pay` was, and still is, free text: "₹14,000 – ₹18,000 / month", "₹180 per
# piece", "50% revenue share, ₹25,000+ typical". A human reads all of those
# correctly and a database reads none of them. It could not be filtered, could
# not be sorted, and — worse on this codebase — held rupees in a string while
# every other amount on the platform is an integer in paise.
#
# So the string stays, because it is the only thing that says "+ travel" or
# "50% revenue share", and the numbers inside it are lifted out beside it.
#
# **The period is not optional.** ₹180 per piece against ₹15,000 per month
# sorts to nonsense without it: the highest-paying work on the board would be
# whatever happened to quote a monthly figure. Anything compared or sorted must
# be compared within one period.
#
# Only currency-prefixed figures are read. "₹55 per tiffin, 20–40 a day"
# contains the numbers 20 and 40, and neither of them is money.

# "Rs"/"INR" as well as "₹": staff type this field by hand, and a figure we
# fail to read becomes a silent 0 rather than a visible error.
_AMOUNT = re.compile(r"(?:₹|\bRs\.?|\bINR)\s*([\d,]+(?:\.\d+)?)", re.I)
_RANGE_JOIN = re.compile(r"^\s*(?:[-–—]|to)\s*$")

# The vocabulary is deliberately small and closed. A unit we do not recognise
# becomes "piece" when it is clearly per-item, and "" otherwise — an empty
# period is honest, and the display string still carries the truth.
_PERIODS = [
    ("month", ("month", "monthly", "p.m", "pm ")),
    ("year", ("year", "annum", "annual", "p.a")),
    ("week", ("week", "weekly")),
    ("day", ("day", "daily", "shift")),
    ("hour", ("hour", "hourly", "hr")),
    ("word", ("word",)),
    ("piece", ("piece", "item", "unit", "each", "tiffin", "garment", "blouse", "saree", "order")),
]


def parse_pay(text: str) -> tuple[int, int, str]:
    """
    "₹14,000 – ₹18,000 / month" -> (1400000, 1800000, "month")

    Returns (low_minor, high_minor, period). A single figure sets low == high,
    so a caller can always sort on `pay_low_minor` without special-casing.
    Nothing parseable returns (0, 0, "") — which is distinguishable from
    genuinely unpaid work only by the display string, and that is the honest
    state of the data rather than a number we invented.
    """
    if not text:
        return 0, 0, ""

    hits = list(_AMOUNT.finditer(text))
    if not hits:
        return 0, 0, ""

    def minor(m) -> int:
        # round(), not int(): "₹1.20" is 120 paise, and float() gives 1.1999…
        return int(round(float(m.group(1).replace(",", "")) * 100))

    low = minor(hits[0])
    high = low
    # Two figures are a range only when nothing but a dash separates them.
    # "₹55 per tiffin, ₹60 with dessert" is two prices, not a band.
    if len(hits) >= 2 and _RANGE_JOIN.match(text[hits[0].end():hits[1].start()]):
        high = minor(hits[1])
        if high < low:
            low, high = high, low

    # The period qualifies the LAST figure of the amount, and stops at a comma:
    # in "₹55 per tiffin, 20–40 a day" the "day" belongs to the quantity.
    last = hits[1] if (high != low and len(hits) >= 2) else hits[0]
    tail = text[last.end():].split(",")[0].lower()
    period = ""
    for name, words in _PERIODS:
        if any(w in tail for w in words):
            period = name
            break
    return low, high, period


class EventModel:
    """A workshop, talk, mela or meet-up. Time-boxed, seat-limited, free by default."""

    collection_name = "events"

    @staticmethod
    def create_document(
        title: str,
        desc: str = "",
        category: str = "Workshop",
        cover: str = "",
        date_iso: str = "",
        time: str = "",
        duration: str = "",
        mode: str = "Online",
        venue: str = "",
        host: str = "",
        seats: int = 0,          # 0 = unlimited
        fee: float = 0.0,
        language: str = "",
        status: str = "published",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "title": title,
            "desc": desc,
            "category": category,
            "cover": cover,
            "date": date_iso,
            "time": time,
            "duration": duration,
            "mode": mode,             # Online | In person
            "venue": venue,
            "host": host,
            "seats": seats,
            "registered_count": 0,
            "fee": fee,
            "language": language,
            "status": status,         # draft | published | cancelled
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, registered: bool = False) -> dict:
        seats = doc.get("seats", 0) or 0
        taken = doc.get("registered_count", 0) or 0
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "desc": doc.get("desc", ""),
            "category": doc.get("category", ""),
            "cover": media_url(doc.get("cover", "")),
            "date": doc.get("date", ""),
            "date_label": _pretty_date(doc.get("date", "")),
            "time": doc.get("time", ""),
            "duration": doc.get("duration", ""),
            "mode": doc.get("mode", ""),
            "venue": doc.get("venue", ""),
            "host": doc.get("host", ""),
            "language": doc.get("language", ""),
            "fee": doc.get("fee", 0),
            "seats": seats,
            "seats_left": max(seats - taken, 0) if seats else 0,
            "full": bool(seats and taken >= seats),
            "registered": registered,
        }


class EventRegistrationModel:
    collection_name = "event_registrations"

    @staticmethod
    def create_document(user_id: str, member_id: str, event_id: str, event_title: str) -> dict:
        return {
            "user_id": user_id,
            "member_id": member_id,
            "event_id": event_id,
            "event_title": event_title,
            "status": "registered",     # registered | cancelled | attended
            "created_at": datetime.now(timezone.utc),
        }


class MentorModel:
    """
    A woman who has agreed to guide others.

    Deliberately its own collection rather than a flag on `users`: most mentors
    are external volunteers who never sign in, and the ones who do shouldn't have
    their private account fields exposed on a public directory.
    """

    collection_name = "mentors"

    @staticmethod
    def create_document(
        name: str,
        headline: str = "",
        bio: str = "",
        photo: str = "",
        expertise: Optional[list] = None,
        languages: Optional[list] = None,
        experience_years: int = 0,
        location: str = "",
        availability: str = "",
        status: str = "active",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name,
            "headline": headline,
            "bio": bio,
            "photo": photo,
            "expertise": expertise or [],
            "languages": languages or [],
            "experience_years": experience_years,
            "location": location,
            "availability": availability,
            "rating": 0.0,
            "rating_count": 0,
            "sessions_done": 0,
            "status": status,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, requested: bool = False) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "headline": doc.get("headline", ""),
            "bio": doc.get("bio", ""),
            "photo": media_url(doc.get("photo", "")),
            "expertise": doc.get("expertise", []) or [],
            "languages": doc.get("languages", []) or [],
            "experience_years": doc.get("experience_years", 0),
            "location": doc.get("location", ""),
            "availability": doc.get("availability", ""),
            "rating": round(float(doc.get("rating", 0) or 0), 1),
            "rating_count": doc.get("rating_count", 0),
            "sessions_done": doc.get("sessions_done", 0),
            "requested": requested,
        }


class MentorshipRequestModel:
    """She asks; a human introduces them. No auto-matching, no cold DMs."""

    collection_name = "mentorship_requests"

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_CLOSED = "closed"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        mentor_id: str,
        mentor_name: str,
        goal: str = "",
        preferred_time: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "mentor_id": mentor_id,
            "mentor_name": mentor_name,
            "goal": goal,
            "preferred_time": preferred_time,
            "status": MentorshipRequestModel.STATUS_PENDING,
            "staff_note": "",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "mentor_id": doc.get("mentor_id", ""),
            "mentor_name": doc.get("mentor_name", ""),
            "goal": doc.get("goal", ""),
            "preferred_time": doc.get("preferred_time", ""),
            "status": doc.get("status", "pending"),
            "when": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }


class OpportunityModel:
    """Paid work: a job, an internship, a freelance brief, or a bulk craft order."""

    collection_name = "opportunities"

    TYPES = ["Job", "Internship", "Freelance", "Craft order", "Training"]

    @staticmethod
    def create_document(
        title: str,
        org: str = "",
        kind: str = "Job",
        desc: str = "",
        location: str = "",
        mode: str = "On-site",
        pay: str = "",
        skills: Optional[list] = None,
        openings: int = 1,
        deadline: str = "",
        experience: str = "",
        cover: str = "",
        contact_note: str = "",
        status: str = "open",
        pay_low_minor: Optional[int] = None,
        pay_high_minor: Optional[int] = None,
        pay_period: Optional[str] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        # Derived from the display string unless the caller states them. Staff
        # who know the real band beat any parser; everyone else gets the numbers
        # read out of what they typed, at write time, so a filter never has to
        # parse text at query time.
        low, high, period = parse_pay(pay)
        if pay_low_minor is not None:
            low = int(pay_low_minor)
        if pay_high_minor is not None:
            high = int(pay_high_minor)
        if pay_period is not None:
            period = pay_period
        if high < low:
            low, high = high, low
        return {
            "title": title,
            "org": org,
            "kind": kind if kind in OpportunityModel.TYPES else "Job",
            "desc": desc,
            "location": location,
            "mode": mode,               # On-site | Remote | Hybrid
            # The string she reads, and the numbers everything else uses.
            "pay": pay,                 # free text: "₹12,000–₹18,000 / month"
            "pay_low_minor": low,
            "pay_high_minor": high,
            "pay_period": period,       # month | year | week | day | hour | word | piece | ""
            "skills": skills or [],
            "openings": openings,
            "deadline": deadline,
            "experience": experience,
            "cover": cover,
            "contact_note": contact_note,
            "applicant_count": 0,
            "status": status,           # open | closed
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, applied: bool = False, saved: bool = False) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "org": doc.get("org", ""),
            "kind": doc.get("kind", ""),
            "desc": doc.get("desc", ""),
            "location": doc.get("location", ""),
            "mode": doc.get("mode", ""),
            "pay": doc.get("pay", ""),
            # Read from the document, not re-parsed here: a document written
            # before the migration has no numbers, and inventing them on read
            # would let the screen show a band the filter cannot find.
            "pay_low_minor": int(doc.get("pay_low_minor", 0) or 0),
            "pay_high_minor": int(doc.get("pay_high_minor", 0) or 0),
            "pay_period": doc.get("pay_period", "") or "",
            "skills": doc.get("skills", []) or [],
            "openings": doc.get("openings", 1),
            "deadline": doc.get("deadline", ""),
            "deadline_label": _pretty_date(doc.get("deadline", "")),
            "experience": doc.get("experience", ""),
            "cover": media_url(doc.get("cover", "")),
            "contact_note": doc.get("contact_note", ""),
            "applicant_count": doc.get("applicant_count", 0),
            "status": doc.get("status", "open"),
            "applied": applied,
            "saved": saved,
            "posted": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }


class ApplicationModel:
    """
    Her application, and where it has got to.

    The status ladder is deliberately visible to her. "Applied" and then nothing
    for three weeks is the single most demoralising thing about job boards.
    """

    collection_name = "applications"

    STATUS_APPLIED = "applied"
    STATUS_SHORTLISTED = "shortlisted"
    STATUS_INTERVIEW = "interview"
    STATUS_OFFERED = "offered"
    STATUS_CLOSED = "closed"
    STATUS_WITHDRAWN = "withdrawn"
    LADDER = [STATUS_APPLIED, STATUS_SHORTLISTED, STATUS_INTERVIEW, STATUS_OFFERED]

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        opportunity_id: str,
        opportunity_title: str,
        org: str = "",
        note: str = "",
        phone: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "opportunity_id": opportunity_id,
            "opportunity_title": opportunity_title,
            "org": org,
            "note": note,
            "phone": phone,
            "status": ApplicationModel.STATUS_APPLIED,
            "staff_note": "",
            "history": [{"status": ApplicationModel.STATUS_APPLIED, "at": now}],
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        status = doc.get("status", "applied")
        return {
            "id": str(doc["_id"]),
            "opportunity_id": doc.get("opportunity_id", ""),
            "opportunity_title": doc.get("opportunity_title", ""),
            "org": doc.get("org", ""),
            "note": doc.get("note", ""),
            "status": status,
            "step": ApplicationModel.LADDER.index(status) + 1 if status in ApplicationModel.LADDER else 0,
            "steps": len(ApplicationModel.LADDER),
            "staff_note": doc.get("staff_note", ""),
            "applied_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }

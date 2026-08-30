from datetime import datetime, timezone
from typing import Optional


class FeedbackModel:
    """
    The 'feedback' collection — the rows shown on the Feedback screen table.

    Only the core facts are stored (sentiment/type/status/rating/date). The
    little display tones the UI needs — the face icon, the badge colours — are
    derived from those facts in to_response() so the API returns a complete row
    the frontend can render verbatim.
    """

    collection_name = "feedback"

    # Allowed values, kept here so routes/schemas/seed all agree.
    TYPES = ["Program Feedback", "Suggestion", "Complaint"]
    STATUSES = ["Resolved", "In Review", "Open"]
    SENTIMENTS = ["Positive", "Neutral", "Negative"]

    # Sentiment -> the smiley the UI draws and its colour.
    _FACE = {"Positive": "Smile", "Neutral": "Meh", "Negative": "Frown"}
    _FACE_TONE = {"Positive": "emerald", "Neutral": "amber", "Negative": "rose"}
    # Type badge colour.
    _TYPE_TONE = {"Program Feedback": "violet", "Suggestion": "sky", "Complaint": "rose"}
    # Status badge colour (Resolved -> emerald, In Review -> amber, else sky).
    _STATUS_TONE = {"Resolved": "emerald", "In Review": "amber", "Open": "sky"}

    @staticmethod
    def create_document(
        seq: int,
        text: str,
        user_name: str,
        user_email: str,
        type: str,
        program: str,
        rating: int,
        sentiment: str,
        status: str = "Open",
        date: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "seq": seq,
            "text": text.strip(),
            "user_name": user_name.strip(),
            "user_email": user_email.lower().strip(),
            "type": type,
            "program": program.strip(),
            "rating": rating,
            "sentiment": sentiment,
            "status": status,
            "date": date or now,
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        sentiment = doc.get("sentiment", "Neutral")
        ftype = doc.get("type", "")
        fstatus = doc.get("status", "Open")
        when = doc.get("date")
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "seq": doc.get("seq", 0),
            "face": FeedbackModel._FACE.get(sentiment, "Meh"),
            "face_tone": FeedbackModel._FACE_TONE.get(sentiment, "amber"),
            "text": doc.get("text", ""),
            "user": doc.get("user_name", ""),
            "email": doc.get("user_email", ""),
            "type": ftype,
            "t_type": FeedbackModel._TYPE_TONE.get(ftype, "violet"),
            "program": doc.get("program", ""),
            "rating": doc.get("rating", 0),
            "sentiment": sentiment,
            # The exact string the table shows, e.g. "Jun 20, 2024 10:30 AM".
            "date": when.strftime("%b %d, %Y %I:%M %p") if isinstance(when, datetime) else "",
            "status": fstatus,
            "s_tone": FeedbackModel._STATUS_TONE.get(fstatus, "sky"),
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }


class FeedbackThemeModel:
    """The 'feedback_themes' collection — the "What are people saying?" cards."""

    collection_name = "feedback_themes"

    @staticmethod
    def create_document(
        seq: int,
        label: str,
        icon: str,
        tone: str,
        mentions: int,
        delta: float,
        up: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "seq": seq,
            "label": label.strip(),
            "icon": icon,
            "tone": tone,
            "mentions": mentions,
            "delta": delta,
            "up": up,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        mentions = doc.get("mentions", 0)
        delta = doc.get("delta", 0)
        return {
            "id": str(doc["_id"]),
            "seq": doc.get("seq", 0),
            "label": doc.get("label", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            # The verbatim UI strings, e.g. "128 mentions" and "20%".
            "mentions": f"{mentions} mentions",
            "delta": f"{delta}%",
            "up": doc.get("up", True),
        }


class ProgramRatingModel:
    """The 'feedback_program_ratings' collection — Top Programs by Feedback."""

    collection_name = "feedback_program_ratings"

    @staticmethod
    def create_document(seq: int, name: str, rating: float) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "seq": seq,
            "name": name.strip(),
            "rating": rating,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "seq": doc.get("seq", 0),
            "name": doc.get("name", ""),
            # Kept to one decimal, exactly as the UI prints it ("4.8").
            "rating": f"{float(doc.get('rating', 0)):.1f}",
        }

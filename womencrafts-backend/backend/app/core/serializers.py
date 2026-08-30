"""Small shared helpers used across the route handlers."""

from datetime import datetime, timezone
from math import ceil

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status


def to_object_id(value: str) -> ObjectId:
    """Turn a string id from the URL into a Mongo ObjectId, or 404 if malformed."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")


def page_meta(total: int, page: int, page_size: int) -> dict:
    """Standard pagination block returned alongside every list endpoint."""
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": ceil(total / page_size) if page_size else 0,
    }


def aware(when: datetime | None) -> datetime | None:
    """
    Give a datetime read back from Mongo its timezone again.

    The driver stores UTC and returns it **naive**, so subtracting it from
    `datetime.now(timezone.utc)` raises `can't subtract offset-naive and
    offset-aware datetimes` — at request time, on a screen, not at import. Two
    models had already discovered this and fixed it locally; this is the same
    fix in one place so the third does not have to discover it again.

    Passing `None` gives `None`, because a missing timestamp is a normal thing
    for an optional field and not worth a guard at every call site.
    """
    if when is None:
        return None
    return when if when.tzinfo is not None else when.replace(tzinfo=timezone.utc)


def age_in_days(when: datetime | None) -> int:
    """How many whole days ago, floored at zero. A clock skew is not the future."""
    got = aware(when)
    if got is None:
        return 0
    return max(0, (datetime.now(timezone.utc) - got).days)

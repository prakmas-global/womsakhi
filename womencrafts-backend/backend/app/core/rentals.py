"""
Rent & borrow — verified women renting their things to each other.

A lehenga worn once a year, a pressure cooker big enough for a wedding, a
pram a baby has outgrown, a sewing machine idle in the monsoon: things a
woman owns that another needs for a few days. She earns from what sits in a
cupboard; the other saves the price of buying it.

── The money never passes through WomSakhi ─────────────────────────────────
Rent and deposit go from one woman to the other, in person or by UPI, AT
PICKUP — when the renter is holding the thing. The app records what was paid
and what came back; it never holds a rupee (routes/market.py and wallet.py
say why: custody needs a licence). This is also the rule the Money traps
screen teaches: never pay a deposit before you have the thing in your hands.

── A booking, step by step ─────────────────────────────────────────────────
  requested  she asks for dates                        (renter)
  accepted   the owner says yes; the dates are held    (owner)
  active     handed over; rent and deposit received    (owner)
  returned   back; condition noted, any deduction      (owner)
  closed     deposit back — confirmed by the renter, or nothing to return
Side doors: declined (owner), cancelled (either, before handover), expired
(a request nobody answered before its start day). A renter who disagrees
with a deduction raises a problem; staff see it.

Two held bookings never overlap: dates are blocked from `accepted` until the
thing is back.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

REQUESTED, ACCEPTED, ACTIVE, RETURNED, CLOSED = "requested", "accepted", "active", "returned", "closed"
DECLINED, CANCELLED, EXPIRED = "declined", "cancelled", "expired"
#: The states that hold an item's dates.
HOLDING = (ACCEPTED, ACTIVE)
OPEN = (REQUESTED, ACCEPTED, ACTIVE)

CONDITIONS = ("like_new", "good", "used")
RETURN_CONDITIONS = ("fine", "damaged", "lost")
HANDOVER = ("pickup", "delivery", "either")

MAX_DAYS = 90
MAX_PHOTOS = 6

#: What either woman can say about the other once it is over, in taps.
PRAISE_FOR_OWNER = ("Clean and as shown", "Easy pickup", "On time", "Kind and clear", "Would rent again")
PRAISE_FOR_RENTER = ("Returned on time", "Took good care", "Easy to deal with", "Paid on time", "Would rent to her again")


def days_between(start: date, end: date) -> int:
    """Both days count: 5th to 7th is three days."""
    return (end - start).days + 1


def rent_for(item: dict, days: int) -> int:
    """
    The rent for `days`. A weekly price, when she set one, applies to whole
    weeks — and never makes a rental dearer than paying by the day.
    """
    day = int(item["price_day_minor"])
    week = int(item.get("price_week_minor") or 0)
    by_day = day * days
    if week and days >= 7:
        return min(by_day, (days // 7) * week + (days % 7) * day)
    return by_day


def quote(item: dict, start: date, end: date) -> dict:
    days = days_between(start, end)
    rent = rent_for(item, days)
    deposit = int(item.get("deposit_minor") or 0)
    return {"days": days, "rent_minor": rent, "deposit_minor": deposit, "pay_at_pickup_minor": rent + deposit,
            "saved_by_week_minor": int(item["price_day_minor"]) * days - rent}


def check_dates(item: dict, start: date, end: date, today: Optional[date] = None) -> Optional[str]:
    """Why these dates cannot be asked for, or None."""
    today = today or date.today()
    if start < today:
        return "Pick a day from today onwards."
    if end < start:
        return "The return day must be on or after the pickup day."
    days = days_between(start, end)
    if days < int(item.get("min_days") or 1):
        return f"She rents this for at least {item.get('min_days')} days."
    if days > int(item.get("max_days") or MAX_DAYS):
        return f"She rents this for at most {item.get('max_days')} days."
    if (start - today).days > 180:
        return "You can ask up to six months ahead."
    return None


def overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    """ISO dates compare as strings; both ends inclusive."""
    return a_start <= b_end and b_start <= a_end

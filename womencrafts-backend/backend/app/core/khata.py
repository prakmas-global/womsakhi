"""
My Khata — her own money book: notes, money in and out, and chits.

Three things a woman keeps in a notebook today, kept here instead: a note to
herself, what came in and what went out with a word about each, and the chit
she runs or pays into. Nothing here holds or moves money — it is a record.
WomSakhi never collects a chit's money, and never will; a platform that holds
a chit's pot is running a chit business, which needs registration under the
Chit Funds Act, 1982, and is the thing frauds pretend to be.

── A chit, in numbers ────────────────────────────────────────────────────────
Chit value V, N members, N months. Each month every member subscribes V / N and
one member — a "prized" member, once only — takes the pot. Three ways to pick
her, chosen per chit:

  auction  Members bid the DISCOUNT they will give up to take it now. The
           lowest-taker — highest discount D — wins and receives V − D. The
           organiser (foreman) keeps a commission C = V × pct. What is left of
           the discount, D − C, is shared equally as a dividend: every member
           pays V/N − (D − C)/N that month.
  draw     A lucky draw among those who have not won. No discount.
  fixed    An order agreed at the start: member 1 in month 1, and so on.

For draw and fixed the commission, if any, comes out of the pot: the winner
receives V − C and everyone pays V/N.

Limits applied to every chit: commission at most 5% of V, a bid at most 40%
of V — the ceilings registered chits work within — and an auction bid never
below the commission (or the dividend would be negative).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Optional

METHODS = ("auction", "draw", "fixed")
MAX_COMMISSION_PCT = 5.0
MAX_BID_PCT = 40.0

# ── money book categories, as taps ───────────────────────────────────────────
IN_CATEGORIES = ("wages", "sales", "chit_payout", "chit_commission", "rent_earned", "gift", "family", "loan_taken", "other_in")
OUT_CATEGORIES = ("food", "home", "children", "health", "travel", "phone", "chit_payment", "rent_paid", "loan_repaid", "other_out")
NOTE_COLOURS = ("plain", "pink", "yellow", "green", "blue", "violet")


def month_index(start_month: str, today: Optional[date] = None) -> int:
    """Which month of the chit it is now: 1 in its first month, 0 before it starts."""
    today = today or date.today()
    y, m = (int(x) for x in start_month.split("-"))
    return (today.year - y) * 12 + (today.month - m) + 1


def month_label(start_month: str, n: int) -> str:
    y, m = (int(x) for x in start_month.split("-"))
    total = y * 12 + (m - 1) + (n - 1)
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def commission_of(value_minor: int, pct: float) -> int:
    return int(round(value_minor * pct / 100))


def settle(chit: dict, bid_minor: int) -> dict:
    """
    The month's money once its winner is known: what she receives, the
    dividend each member gets back, what each member pays, and the commission.
    """
    value, n = chit["value_minor"], chit["members_count"]
    monthly = chit["monthly_minor"]
    commission = commission_of(value, chit.get("commission_pct", 0))
    if chit["method"] == "auction":
        dividend = (bid_minor - commission) // n
        return {"bid_minor": bid_minor, "payout_minor": value - bid_minor, "dividend_minor": dividend,
                "due_minor": monthly - dividend, "commission_minor": commission}
    return {"bid_minor": 0, "payout_minor": value - commission, "dividend_minor": 0,
            "due_minor": monthly, "commission_minor": commission}


def check_bid(chit: dict, bid_minor: int) -> Optional[str]:
    """Why an auction bid cannot stand, or None."""
    value = chit["value_minor"]
    commission = commission_of(value, chit.get("commission_pct", 0))
    if bid_minor < commission:
        return f"The bid must be at least the commission (₹{commission // 100:,})."
    if bid_minor > value * MAX_BID_PCT / 100:
        return f"A bid can be at most {MAX_BID_PCT:.0f}% of the chit (₹{int(value * MAX_BID_PCT / 100) // 100:,})."
    return None


# ── the PIN ──────────────────────────────────────────────────────────────────
# A shared phone stays signed in; the PIN is what stands between her khata and
# whoever picks the phone up. The server holds only a salted hash, and refuses
# her khata's data without a short-lived key that only the right PIN mints.

PIN_ITERATIONS = 120_000
KEY_TTL = timedelta(minutes=30)
MAX_TRIES = 5
LOCKOUT = timedelta(minutes=10)


def hash_pin(pin: str, salt: Optional[bytes] = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, PIN_ITERATIONS)
    return digest.hex(), salt.hex()


def pin_matches(pin: str, digest_hex: str, salt_hex: str) -> bool:
    got, _ = hash_pin(pin, bytes.fromhex(salt_hex))
    return hmac.compare_digest(got, digest_hex)


def new_key() -> tuple[str, str, datetime]:
    """(key for her browser, its hash to keep, when it stops working)."""
    key = secrets.token_urlsafe(24)
    return key, hashlib.sha256(key.encode()).hexdigest(), datetime.now(timezone.utc) + KEY_TTL


def key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

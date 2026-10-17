"""
Can this address receive her code? Asked once, at join, before anything is sent.

`EmailStr` only checks the shape — `pandu@asdg.co` is a perfectly formed
address on a domain that may not exist. Here we look the domain up (MX, else
A/AAAA, as a mail server would) and turn away:

* a domain that does not exist, or has no mail server;
* a throwaway inbox service — the code arrives once, and then the account
  belongs to whoever opens that inbox next.

A lookup that cannot finish (timeout, no resolver) lets the address through:
a slow DNS server must never lock a woman out of joining. Answers are kept
for an hour so the same domain is looked up once, not on every press.
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

from email_validator import EmailNotValidError, EmailUndeliverableError, validate_email

from app.core.config import settings

#: The throwaway services seen most; the front end turns away the same list.
DISPOSABLE = frozenset({
    "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
    "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
    "tempmailo.com", "tempmail.net", "throwawaymail.com", "yopmail.com",
    "yopmail.net", "getnada.com", "nada.email", "trashmail.com", "dispostable.com",
    "maildrop.cc", "mailnesia.com", "fakeinbox.com", "moakt.com", "emailondeck.com",
    "mintemail.com", "mohmal.com", "burnermail.io", "spamgourmet.com", "mailcatch.com",
    "tempinbox.com", "trashmail.de", "inboxkitten.com", "emailfake.com", "fakemail.net",
})

NO_MAIL = "We can't find that email provider. Check the part after @, or use another email you can open."
THROWAWAY = "Temporary inboxes can't be used. Please use your own email address."

_TTL = 3600.0
_LOOKUP_SECONDS = 4
_seen: dict[str, tuple[float, Optional[str]]] = {}


def _lookup(email: str) -> Optional[str]:
    """Blocking DNS lookup. The refusal message, or None when mail can arrive (or we can't tell)."""
    try:
        validate_email(email, check_deliverability=True, timeout=_LOOKUP_SECONDS)
    except EmailUndeliverableError:
        return NO_MAIL
    except EmailNotValidError:
        return None  # a shape problem is EmailStr's to report, not ours
    except Exception:  # noqa: BLE001 — resolver trouble is "can't tell", never a refusal
        return None
    return None


async def refusal(email: str) -> Optional[str]:
    """Why this address can't be used to join, or None when it can."""
    domain = email.rsplit("@", 1)[-1].strip().lower()
    if domain in DISPOSABLE:
        return THROWAWAY
    if not settings.EMAIL_DOMAIN_CHECK:
        return None
    now = time.monotonic()
    hit = _seen.get(domain)
    if hit and now - hit[0] < _TTL:
        return hit[1]
    answer = await asyncio.to_thread(_lookup, email)
    if len(_seen) > 5000:
        _seen.clear()
    _seen[domain] = (now, answer)
    return answer

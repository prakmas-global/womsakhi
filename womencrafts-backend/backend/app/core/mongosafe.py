"""
Turning something a person typed into something safe to hand to Mongo.

`{"$regex": q}` where `q` came off the wire is the injection shape in a Mongo
app — there is no SQL here to inject into, so this is where it lands instead.
It goes wrong two ways, and the second one is the serious one:

**She gets the wrong answer.** A woman searching for "C++" or "50% off" sends
characters the regex engine reads as operators. Best case the pattern is
invalid and she gets a 500; worst case it silently matches the wrong rows.

**He takes the API down with one request.** `?q=(a%2B)%2B%24` is a
catastrophic-backtracking pattern. Measured, on this machine, against a single
31-character field:

    (a+)+$   vs   "aaaa…aaab"   →   97.77 seconds

Mongo runs that per document scanned, so one unauthenticated-ish search over a
few thousand members is not a slow query, it is the database gone. No payload,
no credentials, no cleverness — a query string.

`re.escape` closes both: every character is treated as itself, so the pattern
can only ever be the literal text she typed.

`routes/search.py` already did this, and framed it as the "C++" fix. It is the
same fix. This module exists so the other thirty-odd call sites can have it
without each one deciding for itself.
"""

from __future__ import annotations

import re

#: Long inputs cost scan time even escaped, and no real search term is 200
#: characters. Truncating is friendlier than refusing: she still gets results.
MAX_TERM = 120


def contains(term: str, *, options: str = "i") -> dict:
    """
    A Mongo "contains this text" clause, with the text taken literally.

        query["name"] = mongosafe.contains(q)

    Escaped, trimmed and length-capped. Passing an empty term yields a clause
    that matches everything, which is why callers should keep testing `if
    q.strip():` before using it rather than relying on this to be clever.
    """
    cleaned = (term or "").strip()[:MAX_TERM]
    return {"$regex": re.escape(cleaned), "$options": options}


def starts_with(term: str, *, options: str = "i") -> dict:
    """
    Anchored version — the only one that can use an index.

    `contains` cannot: a leading `.*` forces a collection scan whatever else is
    true. Where a prefix match will do, this is both safer and very much faster.
    """
    cleaned = (term or "").strip()[:MAX_TERM]
    return {"$regex": f"^{re.escape(cleaned)}", "$options": options}


def any_of(term: str, fields: list[str], *, options: str = "i") -> dict:
    """
    `$or` across several fields for one search box.

        filters.update(mongosafe.any_of(q, ["full_name", "email", "code"]))
    """
    rx = contains(term, options=options)
    return {"$or": [{field: rx} for field in fields]}

#!/usr/bin/env python3
"""
Measure every member endpoint. Commit the numbers, so "faster" is a diff.

    python3 bench.py                 # measure, print a table
    python3 bench.py --save          # measure and write bench.json
    python3 bench.py --compare       # measure and diff against bench.json

Reports p50 rather than a mean because one 900ms outlier from a cold connection
pool should not be allowed to describe a fast endpoint, and reports the query
count beside it because that is the number you can actually act on: this API
talks to a MongoDB Atlas cluster in another data centre, and a round trip costs
about 50ms whatever it fetches.

An endpoint at 400ms with 8 queries is not slow. It is chatty, and chatty has a
fix.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get("API_URL", "http://127.0.0.1:8020/api/v1")
EMAIL = os.environ.get("BENCH_EMAIL", "priya.sharma@example.com")
PASSWORD = os.environ.get("BENCH_PASSWORD", "Womsakhi!2026")
ROUNDS = int(os.environ.get("BENCH_ROUNDS", "5"))

#: Every GET a member's app makes. Add a row when you add a screen.
ENDPOINTS = [
    "/me/summary", "/me/profile", "/me/bookings", "/me/programs", "/me/notifications",
    "/me/certificates", "/me/documents", "/me/progress", "/me/referrals", "/me/messages",
    "/me/library", "/me/unread",
    # `/wallet/support` is the deprecated alias for `/wallet/fee-help`; both are
    # measured so the day it is finally deleted shows up here as a missing row
    # rather than as a 404 in somebody's app.
    "/wallet", "/wallet/fee-help", "/wallet/support",
    "/community/circles", "/community/stories",
    "/growth/mentors", "/growth/opportunities",
    "/catalog/programs", "/catalog/services",
    "/safety", "/safety/helplines",
    "/payments/methods",
    "/notifications",
    "/verification/status",
    # Built 2026-08-25 — the ten modules that had no server.
    "/saved", "/schemes", "/cover",
    "/wellbeing/health", "/wellbeing/rights", "/wellbeing/family", "/wellbeing/travel",
    "/group-buy", "/assess", "/digital", "/search?q=tailor",
]


def sign_in() -> str:
    body = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        API + "/auth/signin", data=body,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        cookie = r.headers.get("set-cookie", "")
        body = json.loads(r.read() or b"{}")
    # The token comes back in the body; the cookie is set for browsers.
    token = body.get("access_token") or body.get("token") or ""
    if not token:
        for part in cookie.split(";"):
            if part.strip().startswith("access_token="):
                token = part.strip().split("=", 1)[1]
    if not token:
        sys.exit("could not sign in — is the API up, and does that account exist?")
    return token


def hit(path: str, token: str) -> tuple[float, int, int, int]:
    """→ (milliseconds, status, bytes, queries)."""
    req = urllib.request.Request(API + path, headers={"Cookie": f"access_token={token}"})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            payload = r.read()
            ms = (time.perf_counter() - started) * 1000
            return ms, r.status, len(payload), int(r.headers.get("X-Query-Count", 0))
    except urllib.error.HTTPError as e:
        return (time.perf_counter() - started) * 1000, e.code, 0, 0


def measure(token: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in ENDPOINTS:
        hit(path, token)                       # warm the connection pool first
        runs = [hit(path, token) for _ in range(ROUNDS)]
        times = sorted(r[0] for r in runs)
        out[path] = {
            "p50": round(statistics.median(times)),
            "max": round(times[-1]),
            "bytes": runs[0][2],
            "queries": runs[0][3],
            "status": runs[0][1],
        }
    return out


def table(rows: dict[str, dict], before: dict | None = None) -> None:
    print(f"\n  {'p50':>6} {'max':>6} {'queries':>8} {'bytes':>7}   endpoint")
    print("  " + "─" * 68)
    worst = sorted(rows.items(), key=lambda kv: -kv[1]["p50"])
    for path, m in worst:
        delta = ""
        if before and path in before:
            was = before[path]["p50"]
            if was:
                pct = (m["p50"] - was) / was * 100
                if abs(pct) >= 10:
                    delta = f"   {'▼' if pct < 0 else '▲'} {abs(pct):.0f}%  (was {was}ms)"
        flag = "  ⚠" if m["queries"] > 5 or m["p50"] > 200 else "   "
        print(f"{flag}{m['p50']:>5}ms {m['max']:>5}ms {m['queries']:>8} {m['bytes']:>7}   {path}{delta}")

    total = sum(m["p50"] for m in rows.values())
    # Chatty AND slow. A fan-out of nine queries that answers in 33ms ran them
    # concurrently and is working as intended; flagging it trains everyone to
    # ignore the flag.
    chatty = [p for p, m in rows.items() if m["queries"] > 5 and m["p50"] > 100]
    print("  " + "─" * 68)
    print(f"  {total:>5}ms total across {len(rows)} endpoints")
    if chatty:
        print(f"  chatty and slow: {', '.join(chatty)}")
    if before:
        # Compare only the endpoints in BOTH runs. Summing everything made
        # adding eleven new endpoints look like a 35% regression, which is the
        # sort of number that gets a real regression waved through next time.
        shared = [p for p in rows if p in before]
        now_sum = sum(rows[p]["p50"] for p in shared)
        was_sum = sum(before[p]["p50"] for p in shared)
        if was_sum:
            print(f"  like-for-like on {len(shared)} endpoints: "
                  f"{was_sum}ms → {now_sum}ms ({(now_sum - was_sum) / was_sum * 100:+.0f}%)")

        # The number that is actually about the code.
        #
        # Latency to an Atlas cluster in another data centre moves by 5–10ms an
        # endpoint depending on the hour, which across thirty-five endpoints
        # reads as a 30% "regression" and panics whoever is looking. Query
        # count does not drift: it changes only when somebody writes a loop
        # that queries, and that is the regression worth failing a build over.
        q_now = sum(rows[p]["queries"] for p in shared)
        q_was = sum(before[p].get("queries", 0) for p in shared)
        moved = [p for p in shared
                 if rows[p]["queries"] > before[p].get("queries", rows[p]["queries"])]
        print(f"  queries: {q_was} → {q_now}" + ("  (unchanged — the timing above is network)"
                                                 if q_now <= q_was else ""))
        if moved:
            print("  MORE CHATTY: " + ", ".join(
                f"{p} {before[p]['queries']}→{rows[p]['queries']}" for p in moved))
        new_ones = [p for p in rows if p not in before]
        if new_ones:
            print(f"  {len(new_ones)} new endpoint(s), "
                  f"{sum(rows[p]['p50'] for p in new_ones)}ms: {', '.join(new_ones)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", action="store_true", help="write bench.json")
    ap.add_argument("--compare", action="store_true", help="diff against bench.json")
    args = ap.parse_args()

    rows = measure(sign_in())
    before = None
    if args.compare and os.path.exists("bench.json"):
        before = json.load(open("bench.json"))
    table(rows, before)
    if args.save:
        json.dump(rows, open("bench.json", "w"), indent=1)
        print("\n  saved bench.json")

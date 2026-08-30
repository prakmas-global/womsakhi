# Where we are — 2026-08-25

Both servers up. Typecheck clean. **Every member screen reads the database.**

    API   http://localhost:8020   (uvicorn, backend/)
    Web   http://localhost:3100   (next dev, frontend/)
    Sign in as priya.sharma@example.com

## State

| | |
|---|---|
| Modules with a server | **42 of 42** |
| Endpoints | **~420** |
| Screens reading live data | **31 of 31** — measured in a browser: 0 fell back, 0 threw |
| Routes compiling | 71, no errors |
| Queries across 35 benchmarked endpoints | **57** — only `/search` (9) and `/me/summary` (6) exceed two, both gathered |

Run `backend/bench.py --compare` after any backend change. Read the **query
count**, not the milliseconds: latency to Atlas moves 5–10ms an endpoint by the
hour, which reads as a 30% regression and means nothing. Query count only moves
when somebody writes a loop that queries.

## Verified working against the real database

- **Withdraw moves money.** ₹500 → ₹300, ledger debited, overdraw refused with
  her own figures, below-₹100 refused, same idempotency key twice withdraws once.
- **Her shop** reports 3 orders waiting, ₹3,900 this month, 4.7 rating, repeat
  buyers — all counted from her own orders.
- **Rate limiting** blocks eight wrong passwords on one account while a woman on
  the same IP signs in normally.
- **Assessments** are marked server-side; the answer key never reaches the phone.
- **Group buys** and **event seats** claim atomically, so two women pressing at
  once cannot both take the last one.

## What is left

1. **`growth.opportunities` stores pay as free text** — cannot be filtered or
   sorted, breaks this codebase's own minor-units rule. The frontend parses it
   back out, which works and is not a fix. Migrate to `pay_low_minor` /
   `pay_high_minor`.
2. **Rename the collision**: backend `/wallet/support` (asking us for help
   paying) vs the screen `/app/support-fund` (government schemes).
3. **A few fields the API does not carry yet**, each currently rendered as
   "not known" rather than invented — see the list in `backend-wiring.md`:
   route safety after dark, a mentor's fee, a savings circle's turn order,
   per-listing sales, reply times.
4. Multi-worker deploy: the cache and the rate limiter are per-process. Both
   want Redis before more than one worker runs.

## Three mistakes from this build, so they are not repeated

- **I claimed events and jobs had no server.** They did — `growth.py` has had
  both all along. I built duplicates before noticing and deleted them.
  Re-survey against the live OpenAPI spec, never a keyword list.
- **A seed attached to "whichever member came back first"** — which was
  `test123@gmail.com` out of fifteen accounts, so every screen looked empty
  including the test one. Seeds now cover every member.
- **A tight per-IP rate limit locked out the test account** after seven wrong
  passwords. On this platform that is a Common Service Centre, not an attacker.
  Per-account strict, per-IP loose.

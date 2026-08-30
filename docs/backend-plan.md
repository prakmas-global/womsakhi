# WomSakhi backend — structure, performance, and what is left to build

Written 2026-08-25 against measurements, not impressions. Every number below
came from `backend/bench.py`, which is committed so the claims stay checkable.

---

## The one fact that decides everything

**The database is in another data centre.** `mongodb+srv://…mongodb.net` — a
MongoDB Atlas cluster, not localhost. Measured round trip: **~50ms**.

That single number sets the whole optimisation order. A trivially indexed query
returning 2 bytes costs 50ms; a perfectly written query returning 12KB also
costs about 50ms. **Query tuning is not the lever. Round-trip count is.**

| Endpoint | p50 | Why |
|---|---:|---|
| `/me/programs` | **712ms** | N+1 — one query per enrolment, inside the loop |
| `/me/summary` | **335ms** | N+1 plus three counts run one after another |
| `/me/progress` | 193ms | several sequential counts |
| `/me/referrals` | 105ms | 240 bytes of response |
| anything simple | ~50ms | one round trip, the floor |
| `/safety/helplines` | **3ms** | answered in-process, never touches Mongo |

The last two rows are the whole argument. 50ms is the price of *asking*. 3ms is
the price of *already knowing*.

---

## Current structure

```
backend/
  main.py            entry, middleware, 39 routers mounted under /api/v1
  app/
    core/   38 files  config, rbac, deps, security, sakhi, payments, seed
    db/      3 files  mongodb.py (motor client) · indexes.py (78 indexes)
    models/ 35 files  document shape + to_response() serialisers
    routes/ 39 files  the HTTP surface — 380 endpoints
    schemas/34 files  pydantic request/response models
```

What is already right, and should not be undone:

- **78 indexes**, created idempotently at startup, following the ESR rule
  (Equality, Sort, Range) — the order Mongo can actually use them in.
- **The balance is never stored.** It is summed from the ledger on every read,
  so the figure and the transaction list cannot drift apart.
- **RBAC at the router**, one `module_guard` per module, not per endpoint.
- **Money in minor units** end to end.
- **The matching model warms off the request path**, on a background thread, so
  no woman pays the cold-load cost.

What is missing, and is the work below:

- no response compression
- no caching of anything
- no pagination on member lists
- no request timing, so a regression is invisible until someone complains
- two N+1 loops, both in `me.py`
- ten modules with no server at all

---

## Progress · 2026-08-25

### A correction to this plan

The survey behind the "ten missing modules" list below was **wrong about two of
them**. It matched the live OpenAPI document against a keyword list that did not
include `growth`, and so missed that `growth.py` already had a full events
module *and* a full jobs module (`/growth/opportunities`), both with seeded data
and working applications.

I built duplicates before noticing, and deleted them. Two job modules is the
same failure as two certificate templates: they drift, and the day they drift
nobody can say which is right. The re-survey below checks every module against
every path in the spec rather than a hand-written keyword list.

**One real weakness the duplicate exposed and worth fixing in place:**
`growth.opportunities` stores pay as **free text** (`"₹12,000–₹18,000 / month"`),
which cannot be filtered, sorted or totalled, and breaks this codebase's own
rule that money is minor units. Worth migrating to `pay_low_minor` /
`pay_high_minor` with the label computed once.

### Phase 0–2 · done

| | Before | After | |
|---|---:|---:|---|
| `/me/programs` | 638ms · 20 queries | **59ms · 2** | N+1 killed — one `$in` for every referenced programme |
| `/me/summary` | 315ms · 9 | **61ms · 6** | six independent queries `gather`ed; six round trips now cost one |
| `/me/progress` | 176ms · 6 | **32ms · 2** | three of the five queries were re-asking for a number the fourth already had |
| every endpoint | +1 query | **0** | the auth lookup ran on all 380 endpoints; now cached 15s and invalidated at the driver |
| 24 endpoints | **2562ms** | **897ms** | **−65%** |

- **`bench.py`** — p50 / max / bytes / queries per endpoint, `--save` and
  `--compare`. Compares like-for-like, because summing everything made adding
  eleven endpoints look like a 35% regression.
- **`Server-Timing: db;dur=…, wall;dur=…`** and **`X-Query-Count`** on every
  response. `db > wall` means the queries ran concurrently, which is the goal.
- **Query counting via a database proxy**, not pymongo's `CommandListener` —
  motor runs commands on a thread pool, so a `ContextVar` set in the listener
  belongs to the wrong context and every request reported zero.
- **`Counter` is a mutable object**, not two `ContextVar` integers — Starlette's
  `BaseHTTPMiddleware` runs the endpoint in a child task, and contexts copy
  downward but never merge back.
- **The cache refuses per-person data**, with one documented exception: her own
  user record, 15s, invalidated by the proxy on any write to `users` — because
  nineteen call sites across seven routers is nineteen chances to forget.
- **GZip ≥500 bytes.** The 12KB catalogue compresses to about a tenth.

### Phase 4 · the ten missing modules · done

**42 of 42 modules now have a server · 400 endpoints.**

| Module | Route | Note |
|---|---|---|
| Saved | `/saved` | One collection for every saveable kind; grouped `$in` per kind, not per row |
| Schemes · Cover · Health · Rights · Family · Travel | `/schemes`, `/cover`, `/wellbeing/*` | One `reference` collection, six routes. Real Indian entitlements, not placeholders |
| Buying together | `/group-buy` | Threshold compared inside Mongo with `$expr`, so two women joining the last place both count |
| Prove your skills | `/assess` | **Marked server-side**; the answer key never leaves the server |
| Using a phone | `/digital` | Six ordered steps, per-member progress |
| Search | `/search` | Nine collections, `gather`ed — 9 queries, 33ms |

Every one of them was built with the Phase 1–3 patterns from the start:
gathered queries, cached shared half, personal half never cached, atomic
counters, idempotent writes, and an index designed for the one query it serves.

---

## Phase 1 · Make it measurable  ⟵ start here

Nothing else can be trusted until a number can be reproduced.

- **`bench.py`** — hits every member endpoint five times, reports p50 / max /
  bytes. Committed, so "we made it faster" is a diff, not a claim.
- **`Server-Timing` middleware** — every response carries `db;dur=…` and
  `total;dur=…`, and a `X-Query-Count` header. A response that took 700ms and
  made 14 queries says so in the browser's network tab.
- **Slow-query log** — anything over 200ms or 5 queries prints the route and
  the count at WARNING. A regression announces itself.

## Phase 2 · Round trips

In order of what the numbers say:

1. **Kill the two N+1s.** Collect the ids, fetch with one `{"_id": {"$in": […]}}`,
   map in memory. `/me/programs` 712ms → one round trip.
2. **Run independent queries concurrently.** `/me/summary` makes six queries
   that do not depend on each other and awaits them one at a time.
   `asyncio.gather` makes six round trips cost one.
3. **Project only what is sent.** A document with a 4KB `body` field costs
   bandwidth on every list that never renders it.

## Phase 3 · Do not ask at all

- **A small async TTL cache**, in-process, keyed per endpoint.
  - Catalogue, mentors list, helplines, scheme reference data: **shared by every
    member** and changes maybe weekly. 60s TTL turns 50ms into 0.05ms for
    everyone after the first.
  - Never cache anything scoped to one member. A cached wallet is a wrong
    balance, and that is worse than a slow one.
- **Cache invalidation on write** — the admin endpoints that change a catalogue
  entry clear its key rather than waiting out the TTL.

## Phase 4 · Cheaper responses

- **GZipMiddleware** at 500 bytes. `/catalog/services` is 12KB of JSON that
  compresses to roughly a tenth. On a 2G connection that is the difference
  between two seconds and two hundred milliseconds.
- **Pagination** on every member list — `?limit=&cursor=`. Bounded by default,
  because "300" is a guess that becomes a bug the day someone has 301.

## Phase 5 · The ten missing modules

No server exists for these. Each needs a model, a router, indexes, seed data and
the admin side. In the order that earns most:

| Module | Collections | Why this order |
|---|---|---|
| **Jobs** (find work, applications) | `jobs`, `applications` | The largest hole. Two screens are fully built and read nothing |
| **Events** | `events`, `event_bookings` | Melas are how members actually sell |
| **Saved items** | `saved` | One tiny collection, unblocks every bookmark in the app |
| **Payout accounts** | `payout_accounts` | Withdraw has no destination without it |
| **Wellbeing** ×4 | `health_checks`, `rights`, `creches`, `routes` | Mostly reference data — the cheapest four |
| **Insurance** | `cover_schemes`, `enrolments` | Reference data plus her own |
| **Group buying** | `group_buys`, `joiners` | Needs a threshold and a clock |
| **Assessments** | `assessments`, `attempts` | Needs question banks |
| **Digital literacy** | reuse `progress` | Step tracking only |
| **Search** | index across the above | Last: it searches the others |

## Phase 6 · Robustness

- **Every write idempotent** where a phone might retry — an `Idempotency-Key`
  on payments and withdrawals so a double tap on a bad connection cannot pay
  twice.
- **A request id** on every response, logged, so a support ticket has a thread
  to pull.
- **Graceful degradation** — a failed cache read must fall through to Mongo, and
  a failed optional query must not take a screen down with it.

---

## Naming collision to fix before it is wired

Backend **`/wallet/support`** is *asking WomSakhi for help paying*.
The screen at **`/app/support-fund`** is *government schemes*. Two different
things sharing a word. Rename one now, while nothing depends on it.

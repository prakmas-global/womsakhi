# Reminder + Notification engines — build plan

**Status: for approval. No code written yet.**

Backend and database first, complete and proven, before any UI work. Every
number below was measured in this repo today, not assumed.

---

## 0. Ground truth

| Fact | Consequence |
|---|---|
| **No scheduler exists.** No APScheduler, Celery or cron — only FastAPI `BackgroundTasks` and `asyncio.create_task`, which die with the request | Step 1 is genuinely from zero |
| **Cloud Run `--min-instances 0 --max-instances 10 --workers 1`** | The API **scales to zero**. An in-process timer does not run when nobody is using the app — so it can never be the thing a safety deadline depends on |
| **MongoDB Atlas, `mongodb+srv`** → replica set | **Multi-document transactions are available.** The outbox pattern is possible properly |
| Redis is optional (`REDIS_URL`), used today for cache + rate limit | Correctness must not depend on it. It may make things faster, never correct |
| **Zero automated tests in the repo** — no `test_*.py`, no `conftest.py` | The test suite is part of this build, not an afterthought |
| `ensure_indexes()` runs at startup and is idempotent | New indexes follow the same path |

---

## 1. Architectural decisions

### D1 — Time comes from outside the app
**Cloud Scheduler → authenticated `POST /internal/engines/tick` every 60 seconds.**

Not an in-process loop. Cloud Run scales to zero; a loop inside the web process
stops existing the moment the app is idle, which is exactly when a woman most
needs her check-in deadline to fire (SAFE-UC-036: *"run check-in deadlines on
the server despite closed or sleeping browser"*).

The tick is authenticated with a GCP OIDC token, never a shared secret in a
query string, and is invisible to the public API surface.

### D2 — Concurrency is assumed, not prevented
`--max-instances 10` means **ten instances can tick at once**. Every due
occurrence is claimed with an atomic `findOneAndUpdate` that sets a lease and
an owner. Work whose lease expires returns automatically — a crashed worker
loses nothing and duplicates nothing (REM-UC-005).

Leasing lives in MongoDB, not Redis, so correctness holds with Redis absent.

### D3 — Atomic domain write + outbox event
A domain change and its event commit in **one transaction**. Workers then
consume at-least-once with idempotency keys. This is the only way "the
appointment moved" can never silently fail to recalculate its reminder
(REM-UC-004).

### D4 — Two logical modules, one deployable service
Per catalogue §24.6. Separate services only when scale or operational
isolation demands it — not on day one.

### D5 — The policy layer is a gate every intent passes
No module may dispatch directly. `policy.evaluate(intent)` returns
allow / hold / suppress **with a recorded reason**, and that record is the
audit trail (NOTIFY-UC-001, 004, 009).

### D6 — Nothing that works today changes behaviour
New collections, new routes, behind `ENGINES_ENABLED` (default **off**). The
existing `notifications` collection and its routes keep working untouched; the
engine writes into the same inbox through an adapter. The flag comes on only
when the tests below pass.

### D7 — Sensitive detail never leaves its domain
Intents carry **references, not content**. Health, faith, exact location and
case details stay in their own collections and never reach provider logs,
analytics or a notification preview.

---

## 2. The data model — 10 collections

Named by catalogue §24.6. Each gets indexes on the ESR rule the repo already
follows.

| Collection | Holds | Key indexes |
|---|---|---|
| `reminder_definitions` | The rule: owner, domain ref, schedule, timezone, template, state | `user_id + state`, `domain_ref` |
| `reminder_occurrences` | One due instant each, with its own id and schedule version | **`state + due_at`** (the tick's only query), `definition_id + due_at`, `lease_expires_at` |
| `outbox` | Domain events, written in the same transaction as the change | `processed + created_at`, `idempotency_key` unique |
| `notification_intents` | "Something wants to reach her" — before any policy | `state + created_at`, `dedupe_key` unique |
| `preference_versions` | Her settings, versioned so a queued message honours the latest | `user_id + version` |
| `policy_decisions` | allow / hold / suppress + reason, per intent | `intent_id`, `user_id + decided_at` |
| `delivery_attempts` | Created → queued → accepted → delivered → opened → failed | `intent_id`, `state + next_retry_at` |
| `device_subscriptions` | Web-push endpoints and keys | `user_id`, `endpoint` unique |
| `action_receipts` | She pressed Done — the answer returning to the domain | `occurrence_id` unique |
| `audit_events` | Who/what/when, for staff review | `user_id + at`, `actor + at` |

**Retention:** occurrences and attempts are capped with a TTL index; audit and
receipts are not. Deleting an account revokes subscriptions and cancels future
optional jobs.

---

## 3. Phases

Each phase ends with tests that pass and nothing user-visible broken.

### Phase 0 — Foundations *(no behaviour change)*
Collections, models in the repo's existing `create_document` / `to_response`
style, indexes wired into `ensure_indexes()`, a transaction helper, the
`ENGINES_ENABLED` flag, and health counters.
**Proof:** app boots, indexes exist, every existing endpoint unchanged.

### Phase 1 — Reminder Engine core
States Draft · Scheduled · Due · Snoozed · Completed · Cancelled · Expired.
One-off, recurring and event-relative schedules. UTC instant **plus** intended
IANA zone and local time. The tick endpoint, leasing, bounded catch-up,
expiry-instead-of-burst. `REM-UC-001 … 012`.
**Proof:** timezone/DST property tests; kill a worker mid-tick; fire two ticks
at once; simulate a six-hour outage and assert no burst.

### Phase 2 — Policy layer
Preference versions, quiet hours, the shared attention budget, the fatigue
pause (two ignored prompts pause that series), safety isolation.
`NOTIFY-UC-004, 009, 010`; `DAY-UC-007`.
**Proof:** a discretionary message inside quiet hours is held; a safety message
in the same window is not.

### Phase 3 — Notification Engine
Intents, the categorised inbox (adapter onto today's collection), dedupe, TTL,
bounded retry with backoff, dead-letter, and the honest state split between
*provider accepted* / *delivered* / *opened* / *acted on*.
`NOTIFY-UC-001 … 012`.

### Phase 4 — Channels
Web push (VAPID) + `device_subscriptions`. One provider interface so email /
SMS / WhatsApp are configuration later. Per-message cost counted **before**
dispatch; over-budget discretionary messages are suppressed, never escalated
(NOTIFY-UC-015).

### Phase 5 — Domain wiring, and A10 as the acceptance test
Bookings → reminder → **follow-up asking whether it actually happened**. A
two-stage schedule whose second stage depends on an outcome the system does not
yet have. If this works, the engine works. Then A1, A7, A8, A9, A11, A12, A13
become configuration.

### Phase 6 — Operations
Staff endpoints for queue lag, overdue jobs, failures, suppression reasons and
template rollback — role-scoped and audited (NOTIFY-UC-011).

---

## 4. How correctness gets proven

The repo has **no tests at all**. This build adds the first ones, and they are
the deliverable as much as the code is.

- **pytest + a throwaway Mongo database** per run, with fixtures.
- **Property tests on schedule maths** — across timezones, DST transitions in
  both directions, leap days, and a member who travels mid-series.
- **Failure injection** — kill mid-tick, duplicate tick, clock skew, provider
  timeout, Mongo failover, Redis absent.
- **Idempotency** — the same event delivered twice produces one message.
- **The A10 two-stage test**, end to end.
- **A load test to set the service level** — the catalogue is explicit: *"do
  not invent a delivery guarantee."* The number comes from measurement.

---

## 5. What this will not claim

- **No exactly-once delivery** across third-party transports. Reduce
  duplicates, reconcile ambiguity, never pretend.
- **No browser timer** anywhere in the authoritative path.
- **AI proposes, deterministic code disposes.** It may suggest a time or
  shorter wording; it may never move a deadline, assess risk, decide
  escalation, write crisis wording, or invent a stock shortage.
- **No dark patterns.** No guilt, no fabricated urgency, no frequency increase
  because someone is sad or likely to leave.

---

## 6. How I would work

Roles, held deliberately and in this order on every phase:

- **Architect** — the decision, the failure mode, the thing that is expensive
  to change later. Written down before code.
- **Full-stack engineer** — the implementation, in the repo's existing idiom,
  not a new one.
- **Product engineer** — does this actually help her, and what does it cost in
  attention and money.
- **User** — drive the real thing afterwards and read what it actually sent.

### Agents
I would write the engine core myself — one coherent author, because the failure
modes are subtle and spread across files. I would use agents for work that is
parallel and independently verifiable, and I verify every result by running it:

| Agent | Task | Why it suits an agent |
|---|---|---|
| Test author | The pytest suite per phase | Wide, mechanical, checkable by running it |
| Adversarial reviewer | Attack the schedule/timezone/lease maths | A second pair of eyes that did not write it |
| Performance auditor | Index coverage, query plans, N+1s | Measurement, not judgement |

I would **not** delegate the policy layer or any safety path. One author, and
I review it.

---

## 7. What I need from you before starting

1. **Which outbound channels at launch?** In-app and web push I build
   regardless. Email / SMS / WhatsApp each need a provider account and carry a
   per-message cost. Adding one later is configuration, not code.
2. **Cloud Scheduler is allowed?** One new GCP resource, effectively free, and
   it is what makes a deadline fire while her phone is off.
3. **Anything I must not touch.** My default is that nothing existing changes
   behaviour until the flag is switched on.

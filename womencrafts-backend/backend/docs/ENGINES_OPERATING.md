# Running the engines

Everything here is built and tested. Nothing is switched on.

**Tests:** `./venv/bin/python -m pytest tests/ -q` (192, no database needed) and
`./venv/bin/python tests/acceptance_engines.py` (33, needs a live MongoDB, and
cleans up after itself).

---

## What is wired, and what each one needed

Nine domain wirings, proven against the real database (5 goals, 31 events,
45 circles, 321 orders, 57 members).

| Ask | Wiring | What the real data taught it |
|---|---|---|
| A7 goal deadlines | `sync_goals` | `goals.by` is **free text** — "by December", "soon" — because the screen asks for her own words. A bare month resolves to its last day; "soon" is skipped rather than guessed at |
| A8 events & webinars | `sync_events` | Times are display labels (`"6:00 PM"`), not 24-hour strings. Splitting on the colon killed the whole sweep with one `int("00 PM")` |
| A1 / A11 / A12 / A13 | `sync_daily_digests` + `assemble_day` | One recurring rule each for morning and evening, per **member** — keying off `preference_versions` meant they existed for nobody, because nothing writes that collection until the engine does. Content is assembled **at dispatch**, so a digest never describes a week-old day |
| A5 cycle | `sync_cycle` | `declared_last_start` is null for every profile, so prediction is impossible — but `checkin` and `pill` were switched on with times saved, and had never been acted on. Those need no prediction |
| Seller tasks | `sync_seller_tasks` | Order states are capitalised (`"New"`, `"Making"`). A lowercase filter silently matched nothing across 321 orders |
| Savings circles | `sync_savings_circles` | Private, per member, three days before the month turns. Never names who has not paid; the amount lives in her reminder only |
| A2 travel | `travel_start/checkin/end` | Safety class, `keep_instant`, server-side — exempt from quiet hours, budget and fatigue, all of which would otherwise be a way to silence it |
| A10 mentoring | `me.py` bookings | Reminder before, follow-up after, both scheduled at booking time |

Sweeps require a separate scheduled POST to `/api/v1/internal/engines/sweep`.
They are claimed once an hour fleet-wide; calling `/tick` alone does not run
domain sweeps. Each sweep fails independently.

`LOOKAHEAD_DAYS = 45`: a goal due in December is not scheduled in September.
A reminder created three months early is one she has forgotten agreeing to.

---

## Turning it on

Two environment variables, in this order. The first without the second gives
you an engine that never ticks — correct, and silent.

```bash
ENGINES_ENABLED=true
ENGINES_TICK_SECRET=<a long random string>   # required in every environment
```

The application requires `X-Engines-Key` for tick, sweep and engine health in
every environment. Cloud Run IAM, where configured, is an additional protection,
not a replacement for the header. An empty secret refuses every call. Do not
remove authentication to resolve scheduler 401 responses.

---

## Making time arrive

The API runs with `--min-instances 0`. It scales to zero, so nothing inside it
can be relied on to know what time it is. Cloud Scheduler calls the tick, which
both wakes an instance and gives it work.

```bash
PROJECT=womsakhi
REGION=asia-south1
SERVICE_URL=$(gcloud run services describe womsakhi-api \
    --region $REGION --format 'value(status.url)')

# A service account that may invoke the API, and nothing else.
gcloud iam service-accounts create engines-tick \
    --display-name "WomSakhi engines tick"

gcloud run services add-iam-policy-binding womsakhi-api \
    --region $REGION \
    --member "serviceAccount:engines-tick@${PROJECT}.iam.gserviceaccount.com" \
    --role roles/run.invoker

gcloud scheduler jobs create http engines-tick \
    --location $REGION \
    --schedule "* * * * *" \
    --uri "${SERVICE_URL}/api/v1/internal/engines/tick" \
    --http-method POST \
    --headers "X-Engines-Key=${ENGINES_TICK_SECRET}" \
    --oidc-service-account-email "engines-tick@${PROJECT}.iam.gserviceaccount.com" \
    --attempt-deadline 60s \
    --max-retry-attempts 1
```

Provision a second scheduler job for the `/sweep` endpoint on an hourly
schedule with the same authentication. Allow a longer deadline than the tick:
domain synchronization can take tens of seconds. Confirm both jobs in staging
before enabling delivery in production. The secret must already be securely
provided to the shell and the API; do not commit it or paste it into logs.

Scheduler administrators can inspect job configuration. Restrict access to
these jobs, rotate the shared header with the API setting, and verify whether
the deployed Cloud Run service actually requires IAM authentication. An OIDC
token alone does not protect a publicly invokable service's internal routes.

**Why `--max-retry-attempts 1`.** A retried tick is harmless — every step is
idempotent — but a scheduler that retries aggressively during an incident adds
load to a system already struggling. One minute later there is another tick
anyway.

**Why `--attempt-deadline 60s`.** A tick that cannot finish in a minute is
doing too much; the batch size is what to lower, not the deadline to raise.

---

## Reading whether it is working

```bash
curl -H "x-engines-key: $ENGINES_TICK_SECRET" \
     https://api.womsakhi.com/api/v1/internal/engines/health
```

| Field | Healthy | What it means when it is not |
|---|---|---|
| `lag_seconds` | under ~120 | **The number that matters.** Above a few minutes means Cloud Scheduler is not calling, or a tick is dying part-way |
| `due_now` | small and falling | A backlog. Raise `ENGINES_TICK_BATCH`, or find out why dispatch is slow |
| `held` | rises overnight, falls at 07:00 | Quiet hours working. If it only rises, `release_held` is not running |
| `failed_deliveries` | near zero | A provider is down, or its credentials are wrong |
| `dead_letter` | zero | Something gave up after five attempts. `/ops` says which channel and why |

`/internal/engines/ops` gives the fuller picture: suppression reasons over 24
hours, cost by channel, and the ten most recent dead letters.

A spike in `budget_exhausted` is a **product** problem, not an infrastructure
one — something is raising more optional messages than the attention budget
allows, and the fix is upstream.

---

## Turning channels on

Each is independent. A missing provider means that channel declines and the
message still arrives in-app — never an error.

```bash
# Web push
VAPID_PUBLIC_KEY=...      # also served to the browser at /engines/push/key
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hello@womsakhi.com
# needs: pip install pywebpush

# SMS
SMS_PROVIDER=twilio       # or msg91
SMS_ACCOUNT_SID=...
SMS_AUTH_TOKEN=...
SMS_FROM=+91...
SMS_COST_MICROS=600       # per message, for the budget check

# WhatsApp — Meta Cloud API
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_ID=...
WHATSAPP_TOKEN=...
WHATSAPP_COST_MICROS=800
```

**WhatsApp needs approved templates before it will send anything** outside a
24-hour customer-service window. `payload.wa_template` names the approved
template; the title and body become its two parameters. Free text fails at
Meta, not here.

**Cost is checked before dispatch.** An optional message that would exceed the
budget is suppressed, never escalated to a cheaper channel — which is the
difference between a budget and a suggestion.

---

## Turning it off in a hurry

```bash
gcloud scheduler jobs pause engines-tick --location asia-south1
```

Nothing is lost. Occurrences stay `scheduled`, held intents stay held, and the
next tick after resuming picks up where it stopped — except optional work older
than `ENGINES_CATCHUP_MINUTES`, which expires rather than arriving in a heap.
That is deliberate (REM-UC-008).

`ENGINES_ENABLED=false` does the same thing from the application side and takes
effect on the next request.

---

## What it does not promise

- **Not exactly-once.** Duplicates are reduced and ambiguous outcomes are
  reconciled. Across third-party transports, nobody can honestly promise more.
- **`provider_accepted` is not `delivered`.** Only an in-app row and an action
  receipt are certain. The states are kept apart on purpose.
- **No service-level number yet.** It comes from a load test, not from
  optimism.


---

## Eleven bugs an adversarial review found, and what changed

Recorded because each one is a trap the next person will otherwise re-dig.

| # | The bug | The fix |
|---|---|---|
| 1 | An intent was written, then the worker was killed before dispatching. The occurrence sat at `due` with a null lease — which `release_dead_leases` deliberately cannot see — and the dedupe key blocked every retry. **A travel check-in deadline could be lost permanently while the tick reported success.** | `raise_intent` takes over an intent still in `created`; `resume_orphans` sweeps any that were abandoned, safety first |
| 2 | `ends_at` is member-settable and comes back from Mongo **naive**. Comparing it to an aware instant raised `TypeError` inside the tick — for every member, every minute. One reminder with an end date stopped all recurring series | `aware()` coercion at every boundary; `_weekdays()` survives a malformed `days`; `top_up_horizons` fails per rule, not per cluster |
| 3 | `release_held` and `retry_failed` listed rows instead of claiming them. Ten instances → **ten inbox rows and ten buzzes for one reminder**, and ten ALLOW decisions that then read as ten against a budget of two | Both claim with `find_one_and_update`, the pattern `claim_due` already used |
| 4 | **"Later" was completely non-functional.** Snooze reuses the same row, so the retry built an identical dedupe key, hit the unique index, and was dropped — while the tick counted it delivered | The bucket carries a snooze generation |
| 5 | `drain_outbox` had no claim, and `_handle` is not idempotent — ten drains took a rule from version 1 to 11, with a window where the series had zero live occurrences. `emit`'s idempotency key was a **wall clock**, and a bare `except` swallowed failures inside the caller's transaction | Outbox rows are claimed; the key is content-derived; only `DuplicateKeyError` is swallowed |
| 6 | `top_up_horizons` took 500 rules with no sort, so **rule 501 onward was never topped up** and its reminders silently stopped 48 hours later | Least-recently-filled first, which rotates fairly through any number |
| 7 | `rebuild_for_zone` implemented the whole `drift` feature and **had no callers**. Changing timezone did nothing for two days | `retune_for_zone`, called from `PUT /engines/preferences` |
| 8 | Every channel defaults to off, so a missed check-in wrote one inbox row and **sent nothing to her phone** | A safety alert asks for every transport that exists; each adapter still declines if it has no credentials |
| 9 | The version check happened before policy and a live provider call — a reminder she had cancelled in that window still went out | Re-checked immediately before dispatch |
| 10 | The attention budget was read-then-write, so two instances both saw `used=0` and a cap of two became four | The slot is reserved atomically and withdrawn if it loses |
| 11 | Three queries had no covering index, and `outbox`'s was `sparse` — which the planner may reject for `{processed_at: null}`, scanning the collection every tick | Three indexes added, `sparse` dropped |

**What the review confirmed was already right:** the DST maths (verified by
execution in four zones), the `claim_due` lease pattern, safety's exemption
from every policy rule, and `edit` cancelling rather than deleting.

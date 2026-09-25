# The two engines — the complete list, before anything is built

**Status: for approval. Nothing here is implemented yet.**

Every ID below is quoted from the product catalogue (§24 and the module
sections) or from the team review of 24 September. Nothing is invented for this
document. Where something you asked for is *not* engine work, it says so
plainly, because the difference decides what actually arrives.

---

## 1. What the two engines are

The catalogue is explicit that these are **two logical modules sharing one
piece of reliable infrastructure** — not two services, and not fourteen
separate features.

| Component | Owns | Example |
|---|---|---|
| **Module / domain service** | The truth: the task, order, appointment, cycle log, event | "The appointment was moved to Thursday" |
| **Reminder Engine** | What needs attention, when; recurrence, completion, snooze, expiry, cancellation | Recalculates the reminder from the new time |
| **Shared policy layer** | Consent, eligibility, sensitivity, quiet hours, attention budget, priority | Holds an optional prompt during quiet hours |
| **Notification Engine** | Inbox, channel choice, rendering, dispatch, retry, receipts, audit | Sends one approved push, keeps the inbox item |
| **AI** | Suggestions *inside* policy — never final authority over permission or a safety deadline | Suggests a shorter Telugu message, or a better hour |

The rule that makes it trustworthy: **a reminder is not a notification.** A
reminder can sit in My Day and send nothing at all. And **opening a message
does not complete the task** — the answer goes back to the module that owns it.

---

## 2. Reminder Engine — 12 use cases

| ID | What it does |
|---|---|
| REM-UC-001 | Create a reminder from picture/time presets and review the schedule before it starts |
| REM-UC-002 | One-off, recurring and event-relative schedules, with timezone semantics (UTC instant + intended local time) |
| REM-UC-003 | **Done, Later, Skip, Stop** — quick actions, no typing ever required |
| REM-UC-004 | Cancel or recalculate when the source task changes |
| REM-UC-005 | Restart workers without losing due occurrences or doing the work twice |
| REM-UC-006 | Tell one occurrence from an entire series when editing ("this time" vs "every time") |
| REM-UC-007 | Validate AI schedule proposals against consent and allowed windows |
| REM-UC-008 | Expire stale optional reminders — **no burst of old messages after an outage** |
| REM-UC-009 | Keep safety deadlines isolated from optional engagement schedules |
| REM-UC-010 | Synchronise completion and cancellation across her devices |
| REM-UC-011 | Show the reason, the next due time and editable recurrence in plain words |
| REM-UC-012 | Honour pause, deletion and withdrawn consent in work already queued |

## 3. Notification Engine — 15 use cases

| ID | What it does |
|---|---|
| NOTIFY-UC-001 | Route **every** module through one shared policy — no module gets its own back door |
| NOTIFY-UC-002 | One localised, categorised inbox with secure deep links |
| NOTIFY-UC-003 | Ask for web-push permission in context; refusing leaves the app fully usable |
| NOTIFY-UC-004 | Enforce **quiet hours**, a global discretionary budget and a fatigue pause |
| NOTIFY-UC-005 | Render approved, discreet content that matches her explicit preferences |
| NOTIFY-UC-006 | Deduplicate, expire, retry with per-provider rules |
| NOTIFY-UC-007 | Separate "provider accepted it" from "it was delivered" from "she acted on it" |
| NOTIFY-UC-008 | Fall back to another channel **only** under agreed consent and safety rules |
| NOTIFY-UC-009 | Re-check permission and source state in the moment before dispatch |
| NOTIFY-UC-010 | Less often / In-app only / Pause / Off — with immediate effect on unsent work |
| NOTIFY-UC-011 | Staff console: failures, queue lag, cost, suppression — role-scoped and audited |
| NOTIFY-UC-012 | Keep essential workflows running on approved templates when AI is unavailable |
| NOTIFY-UC-013 | Approved business-messaging channels (e.g. WhatsApp) under the same rules as every other channel |
| NOTIFY-UC-014 | Show her which channel carries which category, and let her remove one without losing the rest |
| NOTIFY-UC-015 | Count per-message cost before dispatch; an over-budget discretionary message is **suppressed, not escalated** |

**27 use cases across the two engines.**

---

## 4. Your expectations, answered one by one

### "Automatic notifications"
Yes — NOTIFY-UC-001 to 015. Every module goes through one policy, one inbox,
one dispatcher. In-app first, web push where she has allowed it, email/SMS/
WhatsApp only under NOTIFY-UC-008 and 013.

### "Reminders"
Yes — REM-UC-001 to 012. Presets, not free text, so a woman who does not type
easily can still set one. Plain-language preview before recurrence starts.

### "Confirmations"
Yes, and this is the part most products get wrong. The engine separates
**sent → accepted by provider → delivered → opened → acted on** (NOTIFY-UC-007).
That means:
- Order and booking confirmations are transactional and always delivered
  (§24.4, "Order/booking/security event").
- **A10 from the team review** — a mentor appointment books a reminder, and
  afterwards a follow-up asks *whether it actually happened*. That is a
  two-stage schedule whose second stage depends on an outcome the system does
  not yet know. It is REM-UC-004 reconciliation, and it is the acceptance test
  for the whole engine.

### "Engagement activities based on mood"
Yes, within strict limits that already exist in the catalogue:
- CYCLE-UC-034 — choose a mood and a preferred support style
- CYCLE-UC-035 — a brief **reviewed** encouragement with quick replies
- CYCLE-UC-036 — control channel, schedule, quiet periods, stop; queued prompts honour the change
- CYCLE-UC-037 — suppress repetitive, ignored or stale prompts
- CYCLE-UC-018 — a mood reset activity
- DAY-UC-011/012/013 — optional first-visit mood card; support card on open; general / scripture / no encouragement

The hard boundary, quoted: *"Do not infer that silence means distress, consent,
worsening health or interest. Do not increase frequency because someone is
lonely, sad, young or unlikely to return."*

### "Quiet"
Yes — NOTIFY-UC-004 plus the attention policy in §24.4:
- At most **one** proactive wellbeing prompt per local day
- **Two unanswered prompts pause that series**
- A combined discretionary budget (starting default: two per local day, at
  least four hours apart) shared across **all** modules, so no module can spend
  its own private allowance
- Quiet hours, sleep, school hours and cohort rules take precedence
- Safety alerts ring through regardless — and safety uses a *separate* agreed
  policy, never ordinary quiet-hour suppression

### "Automatic quotes sending"
**Partly — and this is the one I want to be straight with you about.**
The engine can schedule and deliver the message. It cannot *generate* the
quote. That is **EARN-UC-035** ("request a custom product quote with scope,
revision limit and delivery date approved by both sides"), which is a separate
build in Earn. The team's A4 depends on it, not on the engines.

So: engines deliver, chase and follow up a quote. Producing the quote is its
own piece of work, and I would sequence it right after.

---

## 5. What the engines unlock, module by module (§24.5)

| Module | The helpful reminder | What stops or changes it |
|---|---|---|
| My Day / mood | Opted-in morning check-in, one chosen support card | Skip, stale mood, pause, cap, consent withdrawn |
| Cycle / wellness | Confirm an open log, a chosen habit, a clinician-entered schedule | Corrected log, action done, pause, reviewed care route |
| Earn / Market | Order action, service booking, seller stock task | Order change, cancellation, task done — **AI never invents a shortage** |
| Circles | Invitation, relevant reply, chosen digest | Leave, mute, block, removed content, revoked role |
| Learn / mentoring | Session preparation, workshop start, chosen study reminder | Rescheduled, cancelled, or activity completed |
| Jobs / benefits | Saved-opportunity deadline, application follow-up | Expiry, listing withdrawn, she declines or completes |
| Help / rights | Booked adviser meeting, saved action checklist | Case closed, source invalidated, consent withdrawn |
| Scripture | Chosen approved passage | Preference off, no licensed version, cap, fatigue pause |
| Travel | Check-in deadline and agreed contact escalation | A valid check-in advances it; arrival or cancellation ends it |

---

## 6. The team's 14 asks, and which the engines actually deliver

**11 of 14 become configuration rather than construction** once the engines
exist:

| Delivered by the engines alone | A1 today's tasks · A7 goal reminders · A8 event & webinar reminders · A9 follow-up tasks · A11 daily priority list from calendar + tasks · A12 end-of-day summary · A13 daily predefined priorities |
|---|---|
| **Engines + one more piece** | A2 traveller tracking (+ travel session, SAFE-UC-036) · A5 cycle detection (+ cycle engine) · A10 mentor follow-up (+ bookings) · A14 shopping list (+ basket) |
| **Not engine work** | A3 search suggestions (search + recommendation) · A4 automatic quotations (EARN-UC-035) · A6 mood activities (needs reviewed content and a reviewer) |

---

## 7. What these engines will NOT do

Stating this now so nobody is surprised later. All quoted from the catalogue:

- **No guaranteed delivery.** *"Do not claim exactly-once delivery across
  third-party transports."* A provider acknowledgement does not prove she saw it.
- **No browser timer is authoritative.** Server scheduling only — which is the
  whole point of SAFE-UC-036: a check-in deadline that survives a closed phone.
- **AI has no final say.** It returns a constrained proposal — an approved
  content ID, an allowed window, a draft — and deterministic code accepts,
  revises or rejects it. Approved static templates keep the service working
  during an AI outage.
- **No clinical thresholds or medication schedules from a model's guess.**
- **Health, faith, exact location and case details never reach** provider logs,
  analytics or notification previews.
- **No dark patterns.** No guilt, no fabricated urgency, no "your friends are
  leaving", no cross-selling from health or religion data.

---

## 8. What I would build, in order

| Step | What | Why first |
|---|---|---|
| 0 | Durable records: ReminderDefinition, ReminderOccurrence, Outbox, NotificationIntent, PreferenceVersion, PolicyDecision, DeliveryAttempt, DeviceSubscription, ActionReceipt, AuditEvent | §24.6 names these; everything else sits on them |
| 1 | Scheduler + worker with restart recovery, idempotent due processing, bounded catch-up | REM-UC-005/008 — the app has **no scheduler at all** today |
| 2 | Shared policy layer: consent, quiet hours, attention budget, fatigue pause | NOTIFY-UC-004/009 — before a single message is sent |
| 3 | Inbox + in-app delivery | NOTIFY-UC-002 — works without any push permission |
| 4 | Web push, then approved outbound channels | NOTIFY-UC-003/008/013 |
| 5 | A10 end to end as the acceptance test | Two-stage reconciliation proves the engine |
| 6 | Point the other ten asks at it | Configuration, not construction |

**Verified in the backend today, not assumed:** there is no APScheduler, no
Celery, no cron — only FastAPI `BackgroundTasks` and `asyncio.create_task`,
both of which die with the request or the process. `PUT /cycle/reminders`
stores *preferences only*; nothing sends them. The notification routes list,
mark read and dismiss — nothing produces them. Step 1 is genuinely from zero.

---

## 9. One decision I need from you

**Which outbound channels do we commit to at launch?** In-app and web push I
would build regardless. Email, SMS and WhatsApp each carry a per-message cost
(NOTIFY-UC-015), a provider contract and, for WhatsApp, template approval. The
engine is designed so adding one later changes configuration, not code — so it
is safe to start with in-app plus push, and it is also safe to add more now if
you already know which.

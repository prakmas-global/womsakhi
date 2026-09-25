bass# WomSakhi — implementation plan against Catalogue V2.3

Written for the founder, and for the design, engineering, operations and QA
people who will work from it. Prepared 20 September 2026 against
`WomSakhi_Expanded_Product_Catalogue_V2.md` (revision 2.3, 480 registry entries,
30 scenarios) and against the code as it stands in this repository today.

This is a plan, not a promise. Where the catalogue says a decision belongs to a
lawyer, a clinician, a safeguarding owner or a payment partner, this plan says
so and stops; it does not schedule around a gate it cannot open.

---

## 1. How this document works

Three things are kept apart on purpose, because mixing them is how a plan starts
lying:

| | What it means |
|---|---|
| **Built** | The journey runs end to end against real records in this repository, and I have exercised it |
| **Part-built** | Some of it exists — usually the screens or the reads — and a named piece is missing |
| **Not started** | No code answers this |

Every phase below states what unblocks it, what it delivers, and what must be
true before it can be called done. Registry IDs are the catalogue's, so a ticket
can always be traced back to the specification.

Effort sizes are **S / M / L** relative to each other, judged from this
codebase. They are my estimates, not commitments, and they exclude the review
time of any gate.

---

## 2. Measured baseline — what exists today

Counted on 20 September 2026 from the repository, not from memory:

| Surface | Measured |
|---|---|
| Backend | **431 endpoints** across 50 route modules, 44 model modules |
| Member app | **126 routes**, 8 navigation sections, 91 screens listed in the nav tree |
| Public + dashboard | 57 further routes (183 total) |
| Languages | **18 message files** (`en, hi, te, ta, kn, ml, mr, gu, bn, pa, or, ur, ar, es, fr, pt, id, sw`) |
| Design system | One token source (`ux/tokens.css`), a dashboard contract, 9 corner radii on one scale, spacing on a 2px/4px grid |
| Accessibility | Sideways scroll 0, clipped text 0, sub-12px text 0, unreadable text 15 app-wide (all on internal pages) at 390/768/1440 in both themes |

Module by module, against the catalogue's own areas:

| Area | Entries | Status | What is actually there |
|---|---|---|---|
| AUTH | 22 | Part-built | signup, signin, session, signout, signout-everywhere, forgot/reset password. **No age or cohort field on the member record at all** |
| CYCLE | 39 | Built (core) | 7 endpoints, 15 screens, engine with 28 checks: setup, day logging, moods, symptoms, reminders, discreet mode, delete, export |
| EARN | 39 | Part-built | shop (11), market (5), catalog, services, payout, group-buy. Payments sandbox only |
| CIRCLE | 33 | Part-built | community (19), messages (11), member messages (7), circles screens |
| LEARN | 27 | Part-built | programs (10), content (12), skills, enrolment, certificates |
| JOBS | 32 | Part-built | opportunities, applications, assess; no employer verification or expiry |
| HEALTH | 26 | Part-built | health screens, mentors, appointments (bookings) |
| SAFE | 38 | Part-built | helplines, trusted contacts, alert + stand-down, reports; `/app/travel` screen. **No server-side deadlines** |
| FASHION | 23 | Part-built | market and catalogue cover it as a category, as the catalogue asks |
| PLAT | 17 | Part-built | reports (11), roles (10), verification (10), uploads, search, analytics, backups |
| DAY | 13 | Part-built | home, saved, goals, journey; no attention budget or shared-device mode |
| AI | 10 | Part-built | ai (15), sakhi (17); no permission modes, preview-before-write or kill switch |
| MONEY | 8 | Part-built | money (5), wallet (6); savings pot is a record, which is the correct starting point |
| TRUST | 10 | Part-built | reports + admin\_community/safety/growth; no case IDs, appeals or service hours |
| REM | 12 | **Not started** | **No scheduler, no durable timer, no outbox anywhere in the backend** |
| NOTIFY | 12 | Part-built | in-app inbox (10 endpoints), channel preferences. No web push, no policy layer, no dispatch-time consent recheck |
| AGE | 14 | **Not started** | no date of birth, no cohort, no guardian role, no server-side age enforcement |
| LANG | 8 | Part-built | 18 locales, language switch; no audio labels, no reviewed high-stakes translation process |
| UX | 16 | Part-built | low-typing patterns exist in places; no picture-led template system |
| DESIGN | 8 | Built | token source, component states, contrast and responsive audits are in place and measured |
| ASSET | 8 | Part-built | assets exist and are optimised; **no versioned asset manifest** |
| LOCAL | 12 | **Not started** | no nearby, no map, no member requests |
| BENEFIT | 8 | **Not started** | no schemes, eligibility or deadline tracking |
| RIGHTS | 4 | Part-built | `/app/rights` and `/app/haq` exist as content; no country packs, sources or effective dates |
| CARE | 8 | **Not started** | no care requests or task board |
| EVENT | 8 | Part-built | bookings and appointments exist; no capacity, waitlist or organizer tools |
| CREATOR | 8 | **Not started** | no creator studio or licensed downloads |
| SPIRIT | 4 | **Not started** | no faith preference or passage library |
| DATA | 5 | **Not started** | no provider register, rights check or content versioning |
| GROWTH | 8 | Part-built | growth (14), admin\_growth (17), referrals |

**The honest headline:** the app is wide and shallow against this catalogue. Most
areas have screens and reads; what is missing is concentrated in a small number
of *shared* capabilities that the catalogue makes mandatory for every module.
Those are the subject of Phase 0.

---

## 3. The seven structural gaps

These block many registry entries at once. Nothing in Phases 1–6 is worth
starting before its dependencies here are met, because each one is a promise the
catalogue requires us to be able to keep.

### G1 — There is no scheduler

§24 makes a Reminder Engine and a Notification Engine foundational for every
module. Today the backend has no durable timer, no outbox, no worker and no
retry. Cycle reminders, order updates, deadline reminders, the five-day check-in
and every travel deadline all depend on this. **`SAFE-UC-036` (deadlines survive
a closed browser) is currently impossible.**

### G2 — There is no age or cohort data

§15 requires server-side age enforcement on APIs, uploads, messaging, search,
recommendations, exports, deep links and background jobs. The member record has
no date of birth and no cohort. Until it does, every child and teen entry is
unimplementable, and — more urgently — the app cannot truthfully say who it is
for.

### G3 — Consent is not a record

The catalogue wants consent receipts, versioned policies, withdrawal that
reaches queued jobs and indexes (`PLAT-UC-017`), and per-action AI permission
modes (`AI-UC-001`). Today consent is implied by use.

### G4 — Notifications have no policy layer

Quiet hours, attention budget, fatigue pause, suppression, dispatch-time
recheck, sensitive-content rules for lock screens: none are enforced. The inbox
exists; the policy in front of it does not.

### G5 — Trust operations have no case spine

`TRUST-UC-001..010` need a case ID, an owner, an appeal to a different reviewer,
evidence preservation and published service hours. Reports exist; cases do not.

### G6 — No content provenance

Rights, scripture, schemes and imported events all require source, version,
licence, effective date, reviewer and withdrawal (`DATA-UC-001..005`). Nothing
in the codebase records where a piece of content came from.

### G7 — Payments are sandbox-only, and that is a licensing wall

Commerce, ticketed events, paid mentoring and creator downloads all wait behind
it. This is not an engineering task; it needs a partner and a legal review.

---

## 4. The phases

Each phase is dependency-complete: it can be released on its own and leaves the
app truthful. Phase 0 is not optional — the catalogue's F controls say a later
module must ship them with its first release, not postpone them.

### Phase 0 — Foundation (the F bundle)

**Goal:** a member can join, be correctly classified, control what she has
agreed to, be reminded of something, report a problem to a named owner, and
leave with her data. Everything after this inherits it.

| # | Feature | IDs | Size | Notes |
|---|---|---|---|---|
| 0.1 | **Reminder Engine** — durable schedules, occurrences, states (Draft/Scheduled/Due/Snoozed/Completed/Cancelled/Expired), restart recovery, idempotent due processing, bounded catch-up | REM-UC-001..012 | L | Solves G1. Start as one module in the existing backend, not a new service (§24.6) |
| 0.2 | **Outbox + workers** — atomic domain change + event, at-least-once consumers with idempotency, priority queues so digests cannot delay safety | §6 async design | M | Prerequisite for 0.1 and 0.3 |
| 0.3 | **Notification policy layer** — consent, quiet hours, attention budget, fatigue pause, suppression, dispatch-time recheck, neutral lock-screen previews | NOTIFY-UC-001..012 | L | Solves G4. Inbox already exists and is kept |
| 0.4 | **Age and cohort** — date of birth on the member record, cohort resolution, server-side enforcement on every API, uploads, search, exports and deep links; unknown age gets the conservative experience | AGE-UC-001, 007, 013, 014 | L | Solves G2. **Adults-only at first**: minors are truthfully declined, not half-served |
| 0.5 | **Consent receipts** — versioned policies, receipts, withdrawal that reaches queued jobs, indexes and share links | PLAT-UC-017, AGE-UC-003 | M | Solves G3 |
| 0.6 | **AI permission modes** — manual / suggestion-only (default) / narrowly preauthorized per action type; preview before any write; undo; kill switch; outage independence | AI-UC-001..010 | M | Sakhi and the AI routes exist; this is the governor in front of them |
| 0.7 | **Trust cases** — case ID, owner, triage, evidence, appeal to a different reviewer, backup owner for overdue, published service hours | TRUST-UC-001..010 | M | Solves G5 |
| 0.8 | **Shared-device privacy mode** and attention budget in My Day | DAY-UC-007, DAY-UC-009 | S | Small, and it makes the wellbeing pilot honest |
| 0.9 | **Asset manifest** — versioned, per asset: use case, screen, source, licence, alt text, variants, approval | ASSET-UC-001..008 | S | Solves part of G6 for imagery |

**Exit criteria.** A reminder survives a worker restart. A notification is held
by quiet hours and cancelled by withdrawal before dispatch. A minor cannot
obtain an adult capability through the API, a deep link or a queued job. A
report produces a case ID with an owner. Consent withdrawal empties the queue.

**Gates:** safeguarding owner appointed before any child release (§15.4); the
age-assurance method chosen with a specialist, not guessed.

---

### Phase 1 — Private wellbeing, completed honestly

**Goal:** finish the journey that is already the furthest along, under the new
policy layer.

Already built: the tracker, its engine, 15 screens, moods, symptoms, discreet
mode, delete and export.

| # | Feature | IDs | Size |
|---|---|---|---|
| 1.1 | Five-day open-log check-in — Still bleeding / Ended / Date is wrong / Not sure / Skip, with no automatic ending and no diagnosis | CYCLE-UC-038, §20.3 | S |
| 1.2 | Reviewed care cards and red-flag routing; urgent symptoms bypass ordinary queues | CYCLE-UC-039, HEALTH | M + **clinical gate** |
| 1.3 | Mood support with fatigue rules — one proactive prompt per local day, two unanswered prompts pause the series, Not now / Quiet for now / Off | CYCLE-UC-034..037, S23 | M (needs 0.3) |
| 1.4 | Observed vs estimated dates shown differently; predictions pausable independently of logging; offline log merges once | CYCLE-UC-031..033 | S |
| 1.5 | Morning mood card on first visit of the local day, skippable and disableable, never blocking Help or shopping | DAY-UC-011..013, S24 | S |

**Exit criteria.** Skipping mood leaves every module usable. No care text ships
without clinician review. No wellbeing push exists without its own opt-in.

---

### Phase 2 — Community and opportunity pilot (the L bundle)

**Goal:** she joins a circle, contributes, finds a mentor or a local seller and
sends a controlled enquiry.

| # | Feature | IDs | Size |
|---|---|---|---|
| 2.1 | Invitations that cannot outlive revocation; leaked links die | CIRCLE-UC-031 | S |
| 2.2 | New-member history visibility rules, including attachments and search | CIRCLE-UC-033 | M |
| 2.3 | Peer mentor applications with a badge that states its reviewed scope | LEARN-UC-026 | M |
| 2.4 | **Picture-led creation templates** for circle, shop, service and product — selection over typing, editable suggested names, draft save, Back/Edit/Discard/Undo that do exactly what they say | UX-UC-002..003, 011..014, S20, S22 | L |
| 2.5 | Home-business fulfilment zones and pickup windows without publishing a home address | EARN-UC-038 | S |
| 2.6 | Assistant/operator permissions scoped to named shops; ownership and payout changes need owner reauthentication | EARN-UC-039 | M |
| 2.7 | Voluntary invite only — no contact upload, no silent messaging | GROWTH-UC-002 | S |

**Exit criteria.** A shop draft can be created without mandatory prose. A
suggested name is always editable. Discard cannot be undone by a late autosave.
Sellers can report abuse.

---

### Phase 3 — Transactional commerce *(gated)*

**Blocked by G7.** Nothing here starts until a payment partner and the legal
review exist. When it does, the catalogue is explicit that it ships as one
piece: catalogue, stock reservation, payments, receipts, returns, disputes and
reconciliation together, or not at all.

| # | Feature | IDs | Size |
|---|---|---|---|
| 3.1 | Price/stock/delivery revalidation before payment, with buyer approval of changed totals | FASHION-UC-023 | M |
| 3.2 | Expiring service-slot holds; concurrent buyers cannot double-book | EARN-UC-036 | M |
| 3.3 | Custom quotes with scope, revision limit and delivery date agreed by both sides | EARN-UC-035 | M |
| 3.4 | Refunds, disputes and settlement reconciliation | TRUST-UC-006 | L |
| 3.5 | Webhook authenticity, reconciliation against provider records, dead-letter handling | §6 | M |

---

### Phase 4 — Learn and work

| # | Feature | IDs | Size |
|---|---|---|---|
| 4.1 | Employer verification and job expiry with reconfirmation before relisting | JOBS-UC-032 | M |
| 4.2 | Application withdrawal, with an honest explanation of what cannot be recalled | JOBS-UC-031 | S |
| 4.3 | Content rights and versioning for learning material, with correction notices | CREATOR-UC-004, DATA | M |
| 4.4 | Mentoring cancellation, reschedule and no-show rules | LEARN-UC-027 | S |
| 4.5 | Career-goal learning recommendations the member approves before her profile changes | GROWTH-UC-005 | S |

---

### Phase 5 — Travel monitoring *(gated)*

**Do not start until** the device matrix is tested and the operations staffing
question is answered. The catalogue is blunt: do not advertise monitoring that
nobody is doing.

| # | Feature | IDs | Size |
|---|---|---|---|
| 5.1 | Journey-specific watcher group with acceptance, backup roles and Accepted/Waiting/Unavailable states | SAFE-UC-035 | M |
| 5.2 | **Server-side deadlines** that survive a closed or sleeping browser | SAFE-UC-036 | M (needs 0.1) |
| 5.3 | Stale location labelled as stale; delivery, acknowledgement and arrival kept distinct | SAFE-UC-033, 037 | M |
| 5.4 | Cancel/end atomically stops future escalation and revokes scoped links | SAFE-UC-034, 038 | S |
| 5.5 | Labelled contact-alert test that cannot be mistaken for a real emergency | SAFE-UC-031 | S |

**Exit criteria.** No background-GPS claim anywhere in the product. One
escalation per occurrence, per recipient, per channel. A watcher cannot mark a
traveller safe by reading an alert.

---

### Phase 6 — Expansion

Ordered by what the earlier phases make possible, not by appetite.

| # | Feature | IDs | Size | Needs |
|---|---|---|---|---|
| 6.1 | **Nearby** — list and map by chosen place, no GPS required, privacy-preserving counts, truthful coverage, no precise stranger locations | LOCAL-UC-001..012, S26 | L | 0.4 |
| 6.2 | **Benefits and schemes** — eligibility explanation with official source and last-checked date, document checklist, deadline reminders, member-reported status kept separate from verified status | BENEFIT-UC-001..008 | L | 0.1, G6 |
| 6.3 | **Rights packs** — country then state, with source, section, effective date, reviewer; explanation kept distinct from official text | RIGHTS-UC-001..004, S27 | L | G6 + **legal reviewer** |
| 6.4 | **Care coordination** — request, task board, claim, rota, completion | CARE-UC-001..008 | M | — |
| 6.5 | **Events** — capacity, waitlist, change acceptance, check-in without publishing attendees | EVENT-UC-001..008 | M | 3 for paid |
| 6.6 | **Scripture and faith** — private preference, licensed passage library with exact edition and citation, immediate stop | SPIRIT-UC-001..004, S28 | M | G6 + **licences** |
| 6.7 | **Creator products** — licensed downloads, previews, version history | CREATOR-UC-001..008 | M | 3 |
| 6.8 | **Content provenance service** — provider register, rights check, quarantine, versioned publication, withdrawal that reaches caches | DATA-UC-001..005 | L | Solves G6; 6.2/6.3/6.6 all wait on it |

---

## 5. Gates that are not engineering decisions

The plan cannot open these. Each needs a named owner and a date.

| Gate | Blocks | Owner |
|---|---|---|
| Payment partner + licensing | Phase 3 entirely, paid events, paid mentoring, creator downloads | Founder, finance, legal |
| Clinical review of care content | 1.2, and any personalised health guidance | Clinical lead |
| Safeguarding owner + child policy | All AGE entries beyond adults-only; any child release | Founder, safeguarding, legal |
| Age-assurance method | 0.4's evidence design | Privacy specialist |
| Legal content reviewer per country | 6.3, and any rights claim | Qualified legal reviewer |
| Scripture licences per edition | 6.6 | Content operations |
| Travel operations staffing | Phase 5's honesty, not its code | Safety operations |
| Women-only eligibility policy + appeals | Public launch wording | Founder, trust lead |

---

## 6. How work is cut and what "done" means

Per §10, every ticket carries: stable ID, origin, release gate, actor, trigger,
consent and preconditions, flows, screen IDs, fields and validation, API
contract, permission checks, state transitions, notification template, retention
and deletion behaviour, analytics events, acceptance examples, dependency
tickets and owners.

A slice is done when (§17.4): the business outcome works; permissions and age
gates pass; simple view and supported languages work; responsive layouts have
been inspected at 320/360/390/768/1024/1440; accessibility tests pass; shared
tokens and components are used; required visuals are integrated and verified;
privacy and failure paths are covered; integrations are real or honestly
disabled; and unresolved gates are named.

Status sequence: proposed → clarified → approved → designed → implemented →
verified → released. An engineering flag never clears a policy or clinical gate.

---

## 7. What I recommend doing first

One slice, dependency-complete, and it is the one everything else waits on:

**0.1 + 0.2 + 0.3 — the scheduler, the outbox and the notification policy
layer.**

Why this and not a visible feature: eleven areas of the catalogue are specified
in terms of reminders and notifications, the two engines are the only items the
catalogue calls foundational for *every* module, and the travel deadline
requirement (`SAFE-UC-036`) is impossible without them. Every day we add
features without it is a day of features that cannot remind anyone of anything.

Immediately after it, **0.4 (age and cohort)** — because until the member record
knows who she is, the product cannot honestly answer the founder's own all-age
requirement, and every later module would have to be retrofitted.

Both are backend-weighted, which also suits where this repository currently is:
the member app is wide and well-finished; the spine underneath it is what is
thin.

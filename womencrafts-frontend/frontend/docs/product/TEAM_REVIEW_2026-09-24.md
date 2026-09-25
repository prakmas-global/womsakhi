# Team review, 24 September 2026 — what to implement

Source: 13 handwritten review sheets (`Womsakhi-user-ux/mockups-2026-09-24/`,
`mock-01` … `mock-13`), read by OCR. The team walked the architecture module by
module, marked each item **Built** or **upcoming**, and added new asks.

Two useful facts before the list:

- **Their Built/upcoming marks agree with the code.** Spot-checked against the
  repository: Buy together, Set up with help, Report a problem, My rights, Money
  owed to me, cycle tracker, my shop, orders — all marked Built, all present.
  The review is accurate, so its *new* asks can be taken at face value.
- **Most of the new asks need the same thing first.** Fourteen of them are
  automations, and every one depends on the Reminder and Notification engines,
  which do not exist in the backend yet.

Each item below says whether it exists today, verified by searching the code —
not assumed.

---

## A. AI agents and automation workflows

Written twice (sheets 02 and 12), which makes it the review's main theme.
**None of this exists today**: there is no scheduler, no durable timer and no
outbox in the backend.

| # | What they asked for | Depends on |
|---|---|---|
| A1 | Reminders for today's tasks | Reminder Engine |
| A2 | Tracking of women travellers | Reminder Engine + travel session (SAFE-UC-036) |
| A3 | Suggestions for what the user is trying to search | Search + recommendation |
| A4 | Automatically generated quotations | Seller quotes (EARN-UC-035) |
| A5 | Detect from the period tracker | Cycle engine + Reminder Engine |
| A6 | Mood-based activities and games | Motivation + reviewed content |
| A7 | Goal tracking reminders | Reminder Engine |
| A8 | Event and webinar reminders | Reminder Engine + events |
| A9 | Follow-up task reminders | Reminder Engine |
| A10 | Mentor reminder when an appointment is booked, **and a follow-up asking whether it actually happened** | Reminder Engine + bookings |
| A11 | Calendar + tasks producing a daily priority list | Reminder Engine + calendar |
| A12 | End-of-day summary | Reminder Engine |
| A13 | Daily predefined priorities | Reminder Engine |
| A14 | Shopping list with automatic item reminders | Reminder Engine + basket |

**Read this as one feature, not fourteen.** Eleven of the fourteen are the same
capability — a durable schedule, a policy check, one delivered message, an
answer that returns to the module — pointed at different domains. Building the
engines once makes all of them small; building them one at a time makes
fourteen half-schedulers.

A10 is worth calling out: *"reminder for follow-up task, if the appointment
took place or not"* is a two-stage schedule where the second stage depends on
an outcome the system does not know yet. That is exactly the reconciliation
behaviour the engine must have (REM-UC-004), and a good acceptance test for it.

---

## B. New modules

| # | Item | Home | Exists today |
|---|---|---|---|
| B1 | **Music** — mind relaxation, refreshment | My health | No |
| B2 | **Self-defence** | Learn & work | No |
| B3 | **Sign language** | Learn & work | No |
| B4 | **Government and bank awareness** — fixed deposits, withdrawals, and the rest | Learn & work | No |
| B5 | **Share my profile** | My account | No |
| B6 | **Connect a social platform** | My account | No |

B1–B4 are content modules: each needs reviewed material, a source and a
reviewer before it ships, not just a screen. B4 in particular is financial
guidance and belongs under the same review as EARN-UC-049.

B5 and B6 are the first features in this product that push a member's
information *outward*. They need the sharing rules the catalogue already sets:
nothing about her circles, health, cases or location travels with a shared
profile, and a link preview never exposes a private group (GROWTH-UC-001).

---

## C. Payments

Requested methods, networks and instruments:

| Kind | Asked for |
|---|---|
| Methods | Visa, Mastercard, PayPal, Razorpay, Apple Pay, BHIM UPI / PhonePe / GPay |
| Card networks | Visa, Mastercard, American Express, RuPay (India), UnionPay (China), JCB (Japan) |
| Instruments | Credit-card EMI — HDFC, ICICI, SBI |

**None of these is in the code.** More importantly, this list does not change
the payments position: the blocker has never been which cards to accept, it is
the partner and the licensing review. The useful work that can start now is the
provider-agnostic order, refund and reconciliation layer, so that whichever
partner is chosen plugs into a settled contract.

EMI deserves its own decision. Offering instalments is a credit product in most
jurisdictions and carries disclosure duties; it is not a checkout toggle.

---

## D. Languages

Their list of 19: English, Telugu, Hindi, Chinese, Arabic, French, Portuguese,
German, Japanese, Korean, Russian, Turkish, Vietnamese, Bengali, Indonesian,
Marathi, Tamil, Spanish, Italian.

The app ships 18 today: `en hi te ta kn ml mr gu bn pa or ur ar es fr pt id sw`.

| | |
|---|---|
| **To add (8)** | Chinese, German, Japanese, Korean, Russian, Turkish, Vietnamese, Italian |
| **On their list and already shipping (11)** | English, Telugu, Hindi, Arabic, French, Portuguese, Bengali, Indonesian, Marathi, Tamil, Spanish |
| **Shipping but absent from their list (7)** | Kannada, Malayalam, Gujarati, Punjabi, Odia, Urdu, Swahili |

**The last row is a question, not a task.** Those seven are already translated
and in the product. Dropping them would remove languages from women who may be
using them. I have not removed anything — please confirm whether the list was
meant as *additions* or as a *replacement*.

Two things travel with any new language: a font that actually has the glyphs,
and a human review of the safety, health and consent wording (LANG-UC-007).
Chinese, Japanese, Korean and Russian each need a font check before they can be
called supported.

---

## E. Sign-up and sign-in fixes

From sheet 09, written partly in Telugu:

| # | Item | Note |
|---|---|---|
| E1 | A **Back button at step 2** of Create an account | *"step 2 daggara back button avasaram vuntundi"* |
| E2 | **Capture a photo with the camera**, not upload only | *"capture photo ayitey best"* — since a photo is being uploaded anyway |
| E3 | **Language dropdown on the sign-in screen** | So she picks her language before reading anything |

These three are small, self-contained and need no engine, no partner and no
reviewer. They are the cheapest items on this page and they sit on the first
screen anybody sees.

---

## F. What the review confirmed

The sheets transcribe the module tree and mark it up. Confirmed as Built: Home,
My goals, Saved, Calendar, Ask Sakhi, cycle tracker, health guides,
encouragement, mentors and sessions, my shop, what I sell, orders, my money,
money in/money out, Discover, Fashion, Buy together, my groups, messages,
saving together, set up with help, my rights, money owed to me, report a
problem, get help now.

Marked upcoming, matching the plan: Quiet time, shop tools, selling as a group,
people nearby, checkout, after you buy, travelling safely, in danger now,
spotting a scam, if someone targets you, teach and sell what you make,
step-by-step plan.

---

## What this changes about the build order

Nothing — it sharpens it. The review's largest ask is fourteen automations that
all sit on two engines that do not exist. That is the same conclusion the
implementation plan reached from the other direction, and it is now the team's
ask as well as the plan's recommendation.

Suggested sequence:

1. **E1–E3** — three small fixes on the first screen, shippable this week.
2. **The Reminder and Notification engines** (Phase 0) — after which A1, A7,
   A8, A9, A11, A12, A13 are configuration rather than construction.
3. **A2, A5, A10** — the automations that also need travel, cycle and booking
   reconciliation.
4. **B1–B4** — content modules, gated on their reviewers.
5. **D** — the eight languages, once the drop-or-add question is answered.
6. **C** — when the payment partner exists.

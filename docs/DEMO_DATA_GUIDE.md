# Demo data walkthrough

Added **312 labelled demo records across 58 collections** in `womencrafts_dev` on 31 October 2026. Existing catalogue data remains available alongside these examples. The seed uses existing active member accounts; it does not create logins, change passwords, grant roles, approve pending accounts or overwrite real records.

## Accounts and connected journeys

Use normal email-code sign-in for these existing accounts. Staff can find them in the Users list. No new password or test OTP has been configured.

| Existing member | Pays / learns from | Teaches / receives from |
| --- | --- | --- |
| Rani | Paandu Kantipudi | Sahithi L |
| Sahithi L | Rani | Paandu Kantipudi |
| Paandu Kantipudi | Sahithi L | Rani |

Each member has **16 demo payment records**: eight outgoing and eight incoming. Courses and mentoring each have awaiting-payment, reference-submitted, recipient-confirmed and declined examples.

All example names, titles, references and descriptions use `[DEMO]` or `DEMO-`. UPI destinations are deliberately **non-payable**. Do not make a real payment for an example. A confirmed demo record is a simulated acknowledgement, not evidence that money moved.

## Where to look

| Area | Open | What the demo shows |
| --- | --- | --- |
| Home / dashboard | `/app`, `/dashboard` | Summaries and progress derived from the connected examples |
| Learning | `/app/programs`, `/app/bookings`, `/app/certificates` | 15 courses, pending and active learners, three completed journeys/certificates, upcoming/completed/cancelled bookings |
| Teaching | `/app/teach` | Owned courses and learners in each payment stage; open Learners to review a submitted demo reference |
| Mentoring | `/app/mentors`, `/app/mentoring` | Provider profiles and 12 session requests across four payment stages |
| My Payments | `/app/payments` | Both directions, four statuses, references, confirmation dates and review links |
| Work | `/app/work/profile`, `/app/work/posts`, `/app/applications` | Demo skill profiles, 12 job posts and 12 applications spanning applied, shortlisted, offered and closed |
| Find talent | `/app/work/find` | Select Tailoring or Blouse stitching to see the other members’ labelled demo profiles |
| Portfolio / saved | `/app/you`, `/app/saved` | Sample work pictures and saved opportunities |
| Shops / market | `/app/documents`, `/app/market` | Nine product examples including drafts, pictures, 36 orders, nine reviews and nine selling operations |
| Renting | `/app/rent`, `/app/rent/mine` | Three practice sewing machines and connected rental requests |
| My Money | `/app/money` | Income, groceries and phone spending, upcoming bills, notes and monthly totals |
| Customer dues (under My Money) | `/app/books` | Owed, promised and paid orders, plus matching confirmed course and mentoring income |
| Chits / locker | `/app/khata/chits`, `/app/vault` | A practice chit record and earmarked budget/history; no money held or transferred |
| Community | `/app/community`, `/app/circles` | Groups, membership, posts, replies, stories, events and registrations |
| Skill exchange / group buy | `/app/library`, `/app/group-buy` | Skill offers, connected exchange requests and group-buy participation |
| Messages / notifications | `/app/messages`, `/app/notifications` | Clearly marked practice conversations and read in-app notifications; no external delivery |
| Wellbeing / doctor history | `/app/health`, `/app/health/doctors` | Sample walking activity, existing health content and cancelled practice consultation history; no fictional diagnosis or prescription |
| Family / school | `/app/school` | Sample child, school-material task and checklist |
| Safety / support | Member Help and staff Safety/Support screens | Resolved practice reports, help tickets and declined fee-help examples; no active emergency or wallet grant |
| Digital / assessments | `/app/digital`, `/app/assess` | A finished phone step and a practice attempt below pass mark |
| Reminders / Sakhi | `/app/reminders`, `/app/sakhi` | Paused reminders and a labelled practice prompt; no background delivery or invented AI response |
| Staff content / calendar / feedback | `/dashboard/content`, `/dashboard/calendar`, `/dashboard/feedback` | Published, draft and scheduled content, calendar entries, appointments and sample feedback |
| Reports / analytics | `/dashboard/reports`, `/dashboard/analytics` | Existing report definitions and metrics derived from the populated database |

Some routes above are module entry points; use the existing navigation for their subpages. Exact inserted collection totals and pending-course review links are in [DEMO_DATA_REPORT.json](DEMO_DATA_REPORT.json).

## Two useful exercises

### 1. Understand a UPI payment

Sign in as Rani and open My Payments. “Payments I make” shows payments to Paandu; “Payments to me” shows Sahithi’s payments. Open a submitted course payment from Sahithi and review its demo reference in Learners. Confirm it only as a practice action. The record becomes **Confirmed received** and the payer’s course opens. No gateway, bank transfer or wallet credit is involved.

The dataset also includes already-confirmed and declined examples, so no action is necessary to compare results. A submitted reference remains **Awaiting confirmation** until the recipient acknowledges it.

### 2. Understand the personal notebook

The initial demo-only entries for each member are:

| Record | Amount |
| --- | ---: |
| Income | ₹2,500 |
| Groceries | ₹400 |
| Phone recharge | ₹150 |
| Received minus spent | **₹1,950** |

Existing personal entries, if any, contribute to the displayed totals as well. Upcoming demo bills are separate. Record the ₹100 demo bill as paid: recorded spending increases by ₹100, the monthly difference decreases by ₹100, and the bill moves to Completed. Undo removes that linked expense and returns the bill to Upcoming. Neither action sends money.

## Reusing the dataset

From `womencrafts-backend/backend`:

```bash
# Read-only plan
venv/bin/python scripts/seed_showcase.py

# Add missing examples; existing records and edited examples stay unchanged
venv/bin/python scripts/seed_showcase.py --apply --report /tmp/showcase-report.json
```

The command refuses production environments. Stable demo IDs and insert-only writes prevent duplicate records on rerun. Rows carry `demo_batch=module_showcase_v1` and `demo_key` for identification. Existing personal settings, contacts, health history and user verification remain unchanged.

Authentication, real emergency contacts, active SOS, provider credentials, wallet credits, payouts and actual backup/security/notification delivery outcomes are deliberately not fabricated. Their setup/status screens continue to reflect real application state.

## Validation

- Full backend suite: **743 passed, 3 existing skips**.
- Showcase checks validate insert-only behavior, idempotence, preserved identities/notes, payment separation, development-only execution and member API reads.
- Read-only checks against the running development API passed for all three members plus staff appointments, calendar, content, feedback and reports (95 checks, plus Find Talent reads).
- Referenced images exist in the frontend’s bundled assets.

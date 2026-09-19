---
status: accepted
updated: 2026-09-19
tags: [adr, health, privacy]
---

# ADR-017: Cycle tracking is built, private by construction

**Status:** accepted · **Code:** `app/core/cycle.py`, `app/routes/cycle.py`, `components/ux/cycle/`

## The question

The September research recommended against building a period tracker. It gave five reasons, all recorded in `components/ux/wellness/data.ts`:

- The market is saturated and free.
- Engagement is monthly.
- Flo has about 1.5M monthly users in India.
- India's DPDP Act forbids behavioural monitoring of anyone under 18.
- Period data is the most enforcement-exposed category in consumer software.

On 2026-09-18 the owner decided to build it anyway, with daily check-ins, reminders and mood-led suggestions. The research had also hypothesised that *health is the front door and livelihood is what she finds inside* (see [[Research findings Sept 2026]]). A tracker is the everyday reason to open a health app.

## Decision

Build it, and design the risks out instead of accepting them.

- **Adults only, asked before anything is stored.** Setup requires her to say she is 18 or over. A "no" writes nothing, and the guides stay open to her.
- **Hers alone** ([[ADR-007 Ownership comes from the token]]):
  - There is no staff route and no admin view.
  - No Sakhi tool reads it.
  - The only export goes to her.
- **Minimum data.** It stores one answer a day (was she on her period), plus an optional mood, feelings, symptoms and a note. It never stores flow volume, sexual activity, contraception or pregnancy results.
- **Gone when she says.** One request deletes her profile, every day she logged, and every cycle reminder already in her feed.
- **Discreet mode.** It hides the Home card and rewrites every reminder to "A reminder you asked for". A lock screen is the most public surface an app has.
- **Derived, never stored** ([[Derive, never store what you can compute]]):
  - Cycle length, the next date, the fertile window, the phase and "running long" are all arithmetic on her answers.
  - A stored prediction is wrong the day she logs a late start.
- **No stand-in data.** The rest of the app falls back to a fixture when a request fails. This module shows an honest empty or error state instead, because "Day 18 of 28" from a fixture is a false statement about her body.

## The medical lines, and where they come from

- **Periods usually last 2 to 7 days** (NHS). The owner's rule is to check in with her past day 5. That check compares the period against *her* usual length, and at day 8 it escalates to "see a doctor". The reference design's "3–5 days is normal" was not used, because it tells women with a normal period that theirs is abnormal.
- **The fertile window is the 5 days before ovulation plus the day itself** (Wilcox et al., NEJM 1995). Ovulation is 14 days before the *next* period. The screens say it is a guide, not contraception.
- **21 to 35 days is a typical adult cycle** (ACOG). Outside that range, or varying by more than a week, the insight says it is worth mentioning to a doctor.

## Reminders without a scheduler

Cloud Run has no job runner. Reminders are filed into her notification feed by `tick()`, which rides on the unread-badge request every screen already makes. A unique index on `(user_id, dedupe_key)` makes each reminder once-only.

Pushing a notification to a closed phone needs two things: Web Push keys and a Cloud Scheduler job calling the same function. That is the next step, and nothing here has to change for it.

## Before launch

- The guides were drafted from NHS, WHO, ACOG and NICE guidance. **A registered doctor must review them.**
- The four health mentors are demo data, like every other mentor. **Real, verified practitioners must replace them.**

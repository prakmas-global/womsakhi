---
status: stable
updated: 2026-08-17
tags: [ops, data]
---

# Seeding

Two seeders, doing different jobs.

**`app/core/seed.py` + the per-module `seed()` functions** — run at startup,
fill a collection only *if it is empty*. Cheap and safe.

**`app/core/seed_depth.py`** — run by hand, converges the database to a known,
realistic state.

```bash
cd womencrafts-backend/backend
python3 scripts/seed_depth.py            # converge
python3 scripts/seed_depth.py --report   # counts only, change nothing
```

## Why the second one exists

"Fill if empty" has a failure mode: once a table holds a single row it never
grows again. `bookings` sat at **1** for months, so "My bookings" was empty for
all 54 members. Every join table was the same — 1 enrolment, 1 registration, 1
circle membership. The member screens looked unfinished when they were starving.

| | before | after |
|---|---|---|
| services / programmes / mentors | 5 / 5 / 6 | 42 / 28 / 24 |
| bookings / enrolments | 1 / 1 | 61 / 75 |
| circle members / event registrations | 1 / 1 | 51 / 114 |
| certificates / trusted contacts | 0 / 0 | 20 / 24 |
| wallet transactions / backups | 9 / 0 | 136 / 5 |

## How it stays safe to re-run

- **Every seeded row carries `seed_key`.** Writes upsert on it, so running twice
  gives the same database as running once.
- **Rows without a `seed_key` are never touched.** Anything a person created is
  invisible to it.
- **`prune` removes seeded rows no longer generated**, so shrinking a fixture
  shrinks the data rather than leaving orphans.
- **Upserts match the NATURAL key where one exists** — `enrollments` on
  (user_id, program_id), `circle_members` on (user_id, circle_id). Matching only
  on `seed_key` made a legacy row invisible to the upsert, and the insert hit
  the unique index and killed the run.
- **`adopt_legacy` claims pre-existing rows** rather than duplicating them. The
  oldest match keeps its `_id`, so a booking pointing at a service keeps working.
  Deleting and re-creating would have broken every reference.
- **Deterministic RNG**, so the same fixtures produce the same data everywhere.

## Not run at startup, deliberately

Wiring it into boot held the server open long enough that it never began
listening — several hundred Atlas round trips is fine for a script and far too
slow for a boot step.

## Demo logins

Every Active member gets one. The password lives in `seed_depth.py`; it is not
recorded here, per [[Secrets]]. Sign in as any of them to see a populated app —
`priya.sharma@example.com` has bookings, programmes, certificates and a wallet.

Pending and Rejected members deliberately get **no** login: those states exist to
be reviewed from the staff side, and a rejected applicant who could still sign in
would be a bug.

## Identity documents

The verification queue is seeded with six applicants, each with a **1×1
placeholder PNG** — never a realistic-looking ID. Per
[[ADR-011 ID documents are never publicly reachable]], a plausible fake identity
in a database that gets copied to laptops is a liability with no upside.

The file still has to exist, though: a queue row whose "view document" button
404s is a dead control, and those were deliberately cleared out of the admin
module earlier.

Related: [[Testing]], [[Demo accounts]], [[Data model]]

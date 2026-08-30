---
status: stable
updated: 2026-08-15
tags: [ops]
---

# Demo accounts

Seeded by `app/core/seed.py`. Eight members across a deliberate spread of
states — `Active`, `Pending`, `Inactive`, `Rejected` — so verification and
moderation screens have something real to render.

Priya Sharma · Aisha Khan · Neha Patel · Sneha Joshi · Pooja Verma ·
Ananya Singh · Kavita Rao · Meera Iyer — all `@example.com`.

## Credentials

**Not written here.** Passwords live in `backend/.env` and in the seed script,
and this vault is committed to the repo. See [[Secrets]] for the general rule.

If you need them: read the seed script.

## Why the spread of states matters

A seed where everyone is `Active` makes half the admin dashboard look finished
when it isn't. Empty states, pending queues and rejection flows only get
exercised if the data contains those cases. Keep the spread when adding seeds.

Also worth keeping: one member with a **Rejected** verification and one
**Awaiting review**. Those two drive the whole [[Admin dashboard|verification]]
queue.

## Test accounts for permissions

[[Testing]] creates deliberately under-privileged staff accounts at runtime
rather than seeding them. That's how the unguarded `/roles` endpoint was found —
see [[ADR-007 Ownership comes from the token]]. A seeded admin can't catch that
class of bug, because it can do everything.

Related: [[Running locally]], [[Permissions and Roles]]

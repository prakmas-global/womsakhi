---
status: accepted
updated: 2026-08-15
tags: [adr, safety, privacy]
---

# ADR-003 — Anonymous reports still identify the reporter to staff

**Status:** accepted · **Code:** `app/models/safety.py`, `app/routes/admin_safety.py`

## Decision

When a member files a report with `anonymous: true`, `user_id` **is still
stored**. Her identity is never shown to the person reported, or to any other
member. It is visible to staff handling the report.

"Anonymous" here means *hidden from the person you reported*. It does not mean
*unattributable*.

## Why

**You cannot act on a report you cannot follow up.** Serious reports need a
conversation with the reporter — what happened, when, is she safe now. A truly
anonymous report is often un-actionable, which means the feature would offer
protection it can't deliver.

**Report abuse is itself a safety problem.** A fully anonymous channel is a
harassment vector. Someone filing twenty false reports against one member has to
be stoppable, and that requires knowing it's the same someone.

## The part that makes this acceptable

**She is told, in the UI, before she files.** The trade-off is stated plainly on
the form — staff will see who you are, the person you're reporting will not.

That sentence is not optional decoration. Without it this design is a lie about
privacy, and a privacy lie on a safety feature is about the worst thing this
product could do. If you redesign the report form, that text moves with it.

## Consequences

- No member-facing endpoint ever returns the reporter on an anonymous report.
- Staff access is a [[Permissions and Roles|permission]], not a role assumption.

Related: [[Safety]], [[ADR-011 ID documents are never publicly reachable]]

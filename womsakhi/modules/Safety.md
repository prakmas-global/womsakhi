---
status: stable
updated: 2026-08-15
tags: [module, safety]
---

# Safety

**Code:** `app/models/safety.py`, `app/routes/safety.py`, `app/routes/admin_safety.py`

Not a settings sub-page. On a women-only platform this is a first-class part of
the product.

## Three things

- **Trusted contacts** — who she wants reached if she raises an alert
- **Alerts** — one-tap "I need help", logged so staff can act and so there is a
  record afterwards
- **Reports** — someone behaved badly and it needs handling quietly

## Helplines are hardcoded, deliberately

The India-wide helpline list lives in **code**, not the database. Two reasons,
both non-negotiable:

1. **It must work when the database is down.** A safety number that depends on
   Atlas being up is not a safety number.
2. **It must not be editable from the admin panel.** Anyone who compromises an
   admin account should not be able to redirect a distressed woman's helpline
   call.

This is a case where the less flexible design is the correct one. Resist making
it configurable.

## Anonymous reports

Not fully anonymous, and she is told so before filing. See
[[ADR-003 Anonymous reports still identify the reporter]] — including why the
explanatory text on the form is load-bearing and must move with any redesign.

## Support fund

Lives here on the staff side. Approving a request writes the credit in the same
operation — [[ADR-004 Approving a grant is the ledger entry]].

Related: [[Money]], [[ADR-011 ID documents are never publicly reachable]]

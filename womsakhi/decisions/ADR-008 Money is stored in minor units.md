---
status: accepted
updated: 2026-08-15
tags: [adr, money]
---

# ADR-008 — Money is stored in minor units

**Status:** accepted · **convention:** fields end `_minor`

## Decision

Every monetary value is an **integer of paise**. `₹499.50` is `49950`. Field
names carry the suffix: `amount_needed_minor`, `granted_minor`, `balance_minor`.

## Why

Floats can't hold decimal money. `0.1 + 0.2 == 0.30000000000000004` is not a
curiosity, it's a reconciliation failure once it's summed across a ledger. There
is no rounding strategy that fixes it, because the error is in the
representation, not the arithmetic.

Integers of the smallest unit are exact, sum exactly, and compare exactly.

## Consequences

- **Conversion happens at the edges only.** API accepts rupees from a form,
  multiplies by 100 immediately: `int(round(body.granted * 100))`. Display
  divides at render. Everything in between is integer.
- **`round()` before `int()`.** `int(4.995 * 100)` is `499`, because the float
  is `499.4999…`. Truncation silently loses a paisa on values that came from a
  float in the first place.
- **The `_minor` suffix is the contract.** A money field without it is either a
  bug or a display string. Keep the suffix even when it feels verbose — it's the
  thing that stops someone adding a rupee value to a paise value.

Related: [[Money]], [[ADR-004 Approving a grant is the ledger entry]]

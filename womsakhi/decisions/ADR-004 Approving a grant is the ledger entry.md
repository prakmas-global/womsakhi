---
status: accepted
updated: 2026-08-15
tags: [adr, money]
---

# ADR-004 — Approving a grant *is* the ledger entry

**Status:** accepted · **Code:** `app/routes/admin_safety.py`

## Decision

Approving a support-fund request writes the wallet credit **in the same
operation**. There is no "approved" state that waits for someone to also top up
a wallet.

```python
if granted_minor > 0:
    # The grant IS the ledger entry. One action, not two.
```

## Why

A grant that exists only as a status is a grant that never reaches her.

Two-step designs — approve now, disburse later — fail in a specific, predictable
way: the second step is a human remembering. The status board says "approved",
everyone believes the money moved, and the woman waiting on it has ₹0. She has
no way to tell the difference between "approved and paid" and "approved and
forgotten", because her screen says approved either way.

Collapsing the two makes the failure mode honest. If the credit can't be
written, the approval fails, and staff see that it failed.

## Consequences

- `granted_minor <= 0` on an approval is rejected outright. An approval for
  nothing is a mistake, not a valid state.
- Declining writes no ledger entry, obviously.
- Amounts are in minor units throughout — see
  [[ADR-008 Money is stored in minor units]].

Related: [[Money]], [[The support fund is why this is not a marketplace]]

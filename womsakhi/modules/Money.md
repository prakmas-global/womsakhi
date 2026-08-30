---
status: stable
updated: 2026-08-15
tags: [module, money]
---

# Money

**Code:** `app/routes/payments.py`, `app/routes/wallet.py`, `app/routes/billing.py`,
`app/models/wallet.py`

Payments, wallet, and the support fund.

## Integers, always

Every amount is an integer of paise, in a field ending `_minor`. See
[[ADR-008 Money is stored in minor units]] — including the `round()` before
`int()` trap, which loses a paisa silently.

## The support fund

Members who can't afford a programme fee apply; staff review; an approved grant
credits the wallet **in the same operation** —
[[ADR-004 Approving a grant is the ledger entry]].

An approval for zero is rejected outright. An approval that grants nothing is a
mistake, not a valid state.

## Why this module shapes the whole product

The fund's existence is a statement about who the members are, and it's the
reason personalisation is free. See
[[The support fund is why this is not a marketplace]] and
[[ADR-001 Everything personal is free]].

Related: [[Safety]], [[Entitlements]]

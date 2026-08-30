---
status: accepted
updated: 2026-08-15
tags: [adr, money, entitlements]
---

# ADR-001 — Everything personal is free

**Status:** accepted · **Code:** `app/core/entitlements.py`

## The question

We built a [[Theme engine]] and a [[Layout engine]]. Both are the kind of thing
SaaS products put behind a Pro tier. Should we?

## Decision

No. Every personal customisation feature ships **free and on by default**. The
tier machinery exists, and it is set to `FREE` for all of them:

```python
Feature.THEME_CUSTOM:   Scope.FREE
Feature.LAYOUT_NAV:     Scope.FREE
Feature.LAYOUT_RESIZE:  Scope.FREE
Feature.LAYOUT_WIDGETS: Scope.FREE
```

Money, if it ever comes, comes from **organisations** — another NGO licensing
the platform and wanting its own logo, its own default palette, and layout
templates pushed to a whole team. Those are already gated at `Scope.ORG`.

## Why

**The members can't pay.** This platform runs a [[Money|support fund]] because a
meaningful share of them cannot afford a ₹500 course fee. Charging that same
woman to reorder her own menu is incoherent. See
[[The support fund is why this is not a marketplace]].

**Some of it isn't decoration.** Text size and contrast are accessibility. A
paywall in front of "make the text big enough for me to read" is wrong, and in
several jurisdictions it is a legal exposure. These stay free permanently, not
provisionally.

**The buyer with a budget is an organisation.** An NGO licensing a white-label
deployment has a procurement line for software. That is a real sale. A member
who needed a grant is not a customer, and building as though she were distorts
the whole product.

## Why build the seam at all, then

Because retrofitting it is the expensive part, not using it.

Threading an entitlement check through 80 finished screens later means touching
every one of them. Doing it now costs a dict lookup. The seam is insurance with
an almost-zero premium — and if the answer stays "free forever", it cost a file.

## How to change your mind

One line. `Feature.THEME_CUSTOM: Scope.PRO`. The checks, the locked states and
the account tier field already exist and already work.

Do not do this for `TEXT_SIZE` or `HIGH_CONTRAST`. If you're reading this
because someone asked you to, push back and point them here.

## Consequences

- `scope_of()` falls back to `FREE` on anything unrecognised, never up. A
  corrupted tier field loses features rather than granting them.
- Clients get the whole map from one call (`enabled_features()`) rather than
  asking per feature, so no screen needs a round trip to know what to render.

Related: [[Entitlements]], [[ADR-004 Approving a grant is the ledger entry]]

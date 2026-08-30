---
status: stable
updated: 2026-08-15
tags: [engine, money]
---

# Entitlements

**Location:** `app/core/entitlements.py`

A three-tier seam — `free` → `pro` → `org` — sitting in front of every
customisation feature. Today **every personal feature is `free`**. The seam
exists so that stays a choice rather than an accident.

Full reasoning: [[ADR-001 Everything personal is free]].

## Shape

```python
Scope:   FREE < PRO < ORG          # ordered; each tier includes those before it
Feature: theme.presets, theme.custom, a11y.text_size, a11y.contrast,
         layout.nav, layout.resize, layout.widgets,      # all FREE
         org.branding, org.default_theme,
         org.layout_templates, org.custom_domain          # all ORG
```

Three functions:

- `scope_of(user)` — reads `user["entitlement"]`, falls back to `FREE`
- `allows(user, feature)` — index comparison on `ORDER`
- `enabled_features(user)` — the whole map in one call

## Design notes

**Tier lives on the account, not in code.** Raising a customer to `org` is a
field update, not a deploy.

**Unknown values fall back to `FREE`, never up.** A corrupted or renamed tier
loses features rather than granting them. Failing closed is the only safe
direction for anything that gates access.

**Clients get the whole map at once.** `enabled_features()` returns every flag,
so no screen needs a round trip to decide what to render, and there's no
per-feature request waterfall.

**`FEATURES.get(feature, Scope.ORG)`** — an unregistered feature defaults to the
*highest* tier. A new feature someone forgot to register is locked, not
accidentally free for everyone.

## What paid would actually look like

Not member features. Organisation licensing: another NGO runs WomSakhi with its
own logo, its own default palette, and layout templates pushed to a whole role.
That's `org.*`, already gated, currently unimplemented.

Related: [[The support fund is why this is not a marketplace]], [[Layout engine]]

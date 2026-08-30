---
status: stable
updated: 2026-08-15
tags: [module]
---

# Onboarding

**Code:** `app/routes/theme.py`, `src/app/app/welcome/page.tsx`

Four steps after account creation: `welcome` → `appearance` → `language` →
`needs`.

Progress is stored per step (`POST /theme/onboarding/step`) rather than as a
single completion flag, so someone who closes the app on step 3 returns to step
3 — not to the start, and not past it.

## Why appearance comes second

Choosing colours is the first moment the app feels like *hers* rather than
something she was given. Putting it early means every subsequent screen is
already in her palette — which is a much stronger signal that the choice
mattered than showing it once on a settings page.

It's also the easiest step. An early, low-stakes, visibly-effective choice is a
good way to start; a form is not.

## The screens that get the most scrutiny

First thing a new member sees, and the population includes people for whom this
is a first app. Constraints:

- **No emoji** — [[ADR-010 No emoji in the interface]]
- Premium icons, sized and themed
- Every step skippable; nothing here is a gate
- Language chosen here persists to the account —
  [[ADR-006 Language lives on the account]]

## No onboarding for staff

Staff get the theme picker in settings. They were hired; they don't need to be
welcomed by software.

Related: [[Theme engine]], [[Member app]]

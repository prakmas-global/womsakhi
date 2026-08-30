---
status: accepted
updated: 2026-08-15
tags: [adr, design]
---

# ADR-010 — No emoji in the interface

**Status:** accepted · requested directly by the product owner

## Decision

No emoji anywhere in the UI. Icons come from **lucide-react**, sized and
coloured with the design system.

## Why

**Emoji render differently on every platform.** The same character is a
different drawing on Android, iOS and Windows. A design cannot be verified if
its glyphs change per device.

**They don't take the theme.** An emoji is a bitmap the OS owns. It cannot use
`var(--color-brand-600)`, so under a teal theme every emoji stays whatever
colour Apple picked. The whole [[Theme engine]] stops at their border.

**They read as unserious.** This app handles safety alerts and grant
applications. A 🎉 next to an approved grant is the wrong register.

**Accessibility.** Screen readers announce emoji names verbatim, which produces
sentences nobody wants read aloud.

## Consequences

- Icons must be **semantically chosen, not type-derived**. Deriving from a
  category gave four distinct icons across twelve services — see
  [[Derive, never store what you can compute]].
- Onboarding got extra attention here. It's the first thing a new member sees,
  and it's where decorative filler is most tempting.

Related: [[Onboarding]], [[Theme engine]]

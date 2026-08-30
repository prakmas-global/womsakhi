---
status: accepted
updated: 2026-08-15
tags: [adr, theming]
---

# ADR-002 — Theme via CSS variables, not classes

**Status:** accepted · **Code:** `src/theme-engine/`

## Decision

Runtime theming works by overwriting ~54 CSS custom properties on
`document.documentElement`. No theme classes, no per-theme stylesheets, no
colour threaded through React.

The mechanism is explained in
[[Tokens reference variables, so themes are free]] — read that first, it's the
load-bearing idea.

## Rejected alternatives

**A stylesheet per theme.** Can't support custom colours. You cannot pre-build a
stylesheet for a hex the user hasn't picked yet, and custom colour was a
requirement.

**A `theme-forest` class on `<body>`.** Same problem, plus specificity wars with
Tailwind's own output.

**Colour through React context.** ~929 call sites, and each new component is a
fresh chance to forget. Also re-renders the tree on every theme change, which
makes live preview while dragging a colour picker feel bad.

## Consequences

- **No hardcoded brand hex, anywhere.** This is the rule people break. Two real
  bugs came from it — see [[Tokens reference variables, so themes are free]].
- **Dark mode derives, it isn't chosen.** One seed produces both palettes. See
  [[Derive, never store what you can compute]].
- **First paint needs the theme server-side**, or the app flashes default pink
  before the client applies. Solved by `ThemeStyle.tsx`, a server component that
  reads the theme cookie and emits `<style>:root{…}</style>` in the document.

## The trap that cost an afternoon

`ThemeStyle` was exported from `theme-engine/index.ts` along with everything
else. It's a **server** component — it imports `next/headers`. So every client
component importing anything from the barrel dragged `next/headers` into the
client bundle, and the app died.

It is now deliberately excluded from the barrel, with a comment saying why.
Import it by path. If you "tidy that up", the app breaks.

Related: [[Theme engine]], [[ADR-010 No emoji in the interface]]

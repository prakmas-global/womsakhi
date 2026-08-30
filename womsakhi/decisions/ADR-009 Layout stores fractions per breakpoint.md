---
status: accepted
updated: 2026-08-15
tags: [adr, layout]
---

# ADR-009 — Layout stores fractions, per breakpoint

**Status:** accepted · **Code:** `app/models/layout.py`

## Decision

Saved layout stores **proportions** (`0.38`), keyed **per breakpoint**
(`mobile` / `tablet` / `desktop`). Sidebar width is the deliberate exception and
stores pixels. Everything is clamped when read.

Reasoning in [[Fractions not pixels]] and [[Clamp on read, not on write]].

## Shape

```
nav      app        -> { order, hidden, pinned, collapsed, tabs }
sidebar  breakpoint -> px            (64…420)
panes    screen:pane -> breakpoint -> fraction  (0.2…0.8)
charts   screen:chart -> px          (140…640)
columns  screen:table -> column -> px (60…640)
widgets  screen      -> [{ id, span 1…4, hidden }]
```

One document per user, in `user_layouts`. Small enough to fetch alongside the
session, which matters — layout has to be known before first paint or the app
visibly rearranges itself after load.

## Why one document rather than a row per preference

A row-per-preference schema means N queries or a join to render a screen, and
the whole point is to have this in hand *early*. The document is a few hundred
bytes. Mongo is happy. Fetch it once, hand it to the provider.

## Limits are product decisions, not arbitrary

- `PANE_MIN = 0.2` — below a fifth of the row, a pane holds no readable content
  and reads as a rendering bug.
- `SIDEBAR_MAX = 420` — a rail dragged wider on an ultrawide would swallow a
  laptop screen when the layout travels.
- `span 1…4` — the widget grid is four columns at desktop. Span 5 is
  meaningless, not just ugly.

Related: [[Layout engine]], [[Cannot trap yourself]]

---
status: living
updated: 2026-08-15
tags: [reference]
---

# Third-party services

What's integrated, what it costs, what needs an account.

## Live

| Service | For | Account |
|---|---|---|
| MongoDB Atlas | Database | yes |
| Anthropic | [[Sakhi]] | yes — key in `.env` |
| Azure Speech | [[Sakhi]] voice | yes — key in `.env` |

## Libraries — free, no signup

| Package | Size | For |
|---|---|---|
| `culori` | — | OKLCH colour maths, [[Theme engine]] |
| `lucide-react` | tree-shaken | all icons, [[ADR-010 No emoji in the interface]] |
| `@dnd-kit/core` + `sortable` | ~12KB | drag and drop, [[Layout engine]] |
| `react-resizable-panels` | ~8KB | split panes |
| `@tanstack/react-query` | — | server state |
| `@tanstack/react-form` | — | forms |

## Why `@dnd-kit` over `react-beautiful-dnd`

Keyboard accessibility out of the box. `react-beautiful-dnd` is mouse-first and
is no longer maintained. A customisation feature that can only be operated by
dragging excludes exactly the users most likely to need customisation — see
[[Cannot trap yourself]].

## Not integrated

Video calling and calendar sync have been discussed but not chosen. Both need an
account and probably a paid tier — worth a decision before building against
either.

Related: [[Secrets]]

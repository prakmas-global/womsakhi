---
status: stable
updated: 2026-08-15
tags: [engine, theming]
---

# Theme engine

**Location:** `src/theme-engine/` · **Portable:** yes — imports only `culori`
and `lucide-react`, nothing from the app.

A user picks one colour. The entire application — backgrounds, borders, shadows,
scrollbars, skeletons, chart series, category chips, focus rings — becomes a
coherent palette built around it, in light and dark, without a rebuild.

Mechanism: [[Tokens reference variables, so themes are free]]. Decision record:
[[ADR-002 Theme via CSS variables, not classes]].

## Files

| File | Does |
|---|---|
| `palette.ts` | Seed hex → 11-step OKLCH scale |
| `surfaces.ts` | ~54 semantic tokens per mode, derived from the seed's hue |
| `categorical.ts` | 8 maximally-distinct category colours |
| `apply.ts` | Merge all three, write to the DOM, persist |
| `presets.ts` | The 8 built-in themes |
| `ThemeEngineProvider.tsx` | React surface: `theme`, `committed`, `setTheme`, `preview` |
| `ThemePicker.tsx` | Presets tab + custom tab |
| `ThemeStyle.tsx` | **Server** component — first paint, no flash |
| `__checks__/audit.mjs` | Permanent contrast audit |

## Why OKLCH

Colour scales built in HSL are perceptually uneven — `hsl(60, 100%, 50%)`
(yellow) is far brighter than `hsl(240, 100%, 50%)` (blue) at identical
"lightness". Generate a scale that way and yellow themes come out washed while
blue themes come out muddy.

OKLCH's L axis tracks *perceived* lightness. Fix `l = 0.577` across hues and you
get steps that genuinely match. That's what makes one generator work for eight
presets and any custom hex.

## Contrast is targeted at white specifically

This is the subtle one and it cost a bug.

The engine originally checked the seed against its *ideal* foreground — the
better of black or white. Forest green passed that check comfortably. But the
design system always renders `text-white` on brand buttons, and green-on-white
measured **4.06:1**, under the 4.5:1 threshold.

So `darkenUntilWhiteReads()` walks lightness down until white specifically is
readable, floor `l >= 0.28`. Target the foreground you actually render, not the
one that would be optimal.

Found by looking at the running app, not by reading the maths. The maths was
self-consistently wrong.

## Category colours use the golden angle

8 hues at **137.5°** apart, not `360/8 = 45°`. At 45° neighbouring categories
land in the same visual family and a list stops being scannable. 137.5° scatters
them. Slots are assigned by hashing the category name, then probing forward on
collision — so "Beauty" keeps its colour forever even when categories are added.

## The picker bug — read this before touching ThemePicker

Reported as: *"I can select a single pellet but when I click, it reverts to old
colours."*

Cause: `ThemePicker` synced its local seed state from `theme`, and `theme` is
`preview ?? committed`. An `onBlur` handler cleared the preview, context snapped
back to the committed value, and the sync effect **overwrote the colour the user
had just chosen** — one frame after they chose it.

Fix: the provider exposes `committed` separately from `theme`. The picker syncs
from `committed`, tracks a `dirty` flag, drives preview from an effect, and has
no `onBlur`.

**Rule: a control that both reads and writes a value must read the committed
value, never the previewed one.** Otherwise it fights its own preview.

## Admin can set a member's theme

`MemberThemeControl` — presets only, for support calls. Choosing a *custom*
colour on someone's behalf is a decision to make with her, not for her. She is
always notified: silently changing how a person's app looks destroys trust in
the product.

Related: [[Layout engine]], [[Entitlements]], [[ADR-010 No emoji in the interface]]

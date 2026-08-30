---
status: accepted
updated: 2026-08-16
tags: [adr, theming, accessibility, design-system]
---

# ADR-013 — Colour only ever comes from a token

**Status:** accepted · **Code:** `theme-engine/surfaces.ts`, `design-system/tokens.css`

## The problem, measured

An audit of all 87 screens found **2,679 text nodes failing WCAG AA**, and the
cause of both that and "themes only change the buttons" turned out to be one
thing: **~2,800 elements used raw Tailwind colours instead of tokens.**

```
text-slate-400  on a card   2.39:1   (needs 4.5)   1,153 nodes, 43 screens
text-slate-500  on a card   4.32:1                   883 nodes, 43 screens
emerald-600 on emerald-50   3.47:1                   188 nodes, 25 screens
brand-600   on brand-50     4.22:1                   169 nodes, 14 screens
```

Raw Tailwind greys don't participate in theming, so an orange app kept
blue-grey captions, indigo auth gradients and grey chart gridlines. 1,258 text
usages were raw; only 303 used the themed token.

## Decision

**No colour is written literally anywhere.** Every colour comes from a token
that the theme engine derives per theme, per mode.

```
text-ink          headings, primary copy       >= 7:1
text-ink-muted    secondary copy               >= 4.5:1
text-ink-subtle   meta: dates, counts, hints   >= 4.5:1
text-ink-faint    DECORATIVE ONLY              >= 3:1

bg-canvas / bg-surface / bg-surface-hover / bg-surface-inset
border-line / border-line-strong
bg-status-{ok,warn,danger,info}-{bg,ink,border,solid}
text-brand-ink / text-violet-ink   accent text that reads on any surface
```

Three literal exceptions, all third-party brand marks: Google, Microsoft,
Mastercard. Recolouring those would misrepresent someone else's brand.

## Targets are searched, not chosen

The values are computed until they MEET their contrast target, not picked by
eye. Picking would fix one theme and break another — what reads on pale pink is
different on dark teal. See `readableTone()`.

## Four things this got wrong first

Each was invisible under the default theme, which is why they had survived.

**1. Measured against the wrong surface.** Tokens were tuned against `--surface`
(the card). Text also sits on `--background` and `--surface-inset`, which are
darker — the tokens then measured 3.90:1 on insets across 43 screens. **Contrast
must hold on the worst background, not the kindest.**

**2. Out-of-gamut colours clip.** Teal at chroma 0.17 is outside sRGB. The
conversion silently clips each channel, which changes lightness — so the search
asked for a darker colour, got the same bright cyan back, and never converged.
Forest and ocean shipped text at **1.45:1**. Fixed with `clampChroma`.

**3. Float versus 8-bit.** A colour landing exactly on 4.50 measures 4.49 once
painted. Targets now carry a 0.15 margin.

**4. `visibility: hidden` keeps its box** — unrelated to colour but the same
class of error: see [[Adapt, never crop]].

## The API must not send class names

`settings_security.py` returned `note_color: "text-slate-400"` and the sessions
screen applied it verbatim. That is the leak worth naming, because it defeated
every safeguard at once:

- No frontend search finds it — **a class name living in Python is invisible to
  anything that greps TypeScript**.
- It survived the codemod, the static audit and a full 87-screen sweep, and
  rendered text at **2.37:1** while every check reported zero.

The API now sends a semantic tone (`"ok"`, `"subtle"`, `"warn"`, `"danger"`)
and the client maps it. `checks/tokens.mjs` scans the backend for class names
too, so the next one fails a check instead of shipping.

**The API describes meaning. The client decides colour.**

## Blind spots are the real failure mode

Every literal that survived did so because **two things were blind at the same
place**. Neither the codemod nor the check looked there, so it read as clean.

| Where | Missed by |
|---|---|
| `src/lib/` | not in the codemod's roots, not in the check's roots |
| `settings_security.py` | a class name in Python; every check greps TypeScript |
| CSS comments | the check's line-based comment strip missed `/* … */` spans |
| `theme-engine/` | correctly exempt, but had to be reasoned about explicitly |

The lesson is not "add lib/". It is that **a check and the change it verifies
must not share an assumption about where code lives.** The check now walks
`app`, `components`, `design-system`, `theme-engine`, `layout-engine`, `lib`,
`context`, `i18n` — and the backend.

## Two things that made verification lie

Worth recording, because both produced confident, wrong "all clear" results.

**A stale dev server.** Next had been running since before the codemods and was
serving compiled chunks for classes that no longer existed in source. Deleting
`.next` changed the numbers. Any measurement of a long-running dev server is
suspect after a bulk edit.

**Checks that fight each other.** `contrast.mjs` and `screens.mjs` both change
the signed-in account's theme, so running them together made each measure the
other's colours — four phantom failures that vanished on a clean run. They now
take a lock file.

## Consequences

- **Zero raw colour classes.** Any `text-slate-*`, `bg-emerald-50` or `#hex`
  reappearing is a regression, and `checks/contrast.mjs` will catch it.
- **Dark mode needs no overrides.** Tokens resolve per mode, so the `dark:`
  variants that used to hand-supply colours were deleted — they only pinned raw
  hues back in.
- **Charts follow the theme.** `useChartTheme` reads `--chart-*` and no longer
  branches on light/dark, so charts don't re-render on a mode flip.
- **Verified**: 8 themes × 2 modes × 10 screens, plus all 87 screens × 2 modes.
  **0 failures**, from 2,679.

Related: [[Tokens reference variables, so themes are free]], [[Theme engine]], [[Testing]]

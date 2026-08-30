---
status: stable
updated: 2026-08-15
tags: [idea, layout, ux]
---

# Adapt, never crop

If a user can resize a component, the component has to answer for every size it
can be given. The failure mode is not a crash — it is a chart that keeps drawing
itself at 240px inside a 140px card and spills over whatever is underneath.

Reported as: *"it just looks like it's cropped"*. Correct, and the fix is not
smaller margins.

## Three levels, in order of preference

**1. Container queries** (`@container` + `@sm:`/`@md:`) for anything CSS can
express: padding, type scale, hiding a legend. Tailwind v4 ships these in core.
Free, and never flashes.

**2. Fill, don't fix.** Inside anything resizable, a chart takes `height: 100%`
of what's left, not a fixed 230px. The card's header and footer keep their size;
the middle absorbs the change. This one rule prevents most overflow — a fixed
height in a resizable box *is* the bug.

**3. Change what is rendered** — [[useContainerSize]] via `ResizeObserver`, for
what CSS cannot do. A donut at 180px should not be a smaller donut; it should be
a stacked bar. At 120px it should be a number.

## The donut, as the worked example

| Size | Renders | Why |
|---|---|---|
| `lg` | ring + legend with values | room for everything |
| `md` | ring + centre total | legend no longer fits |
| `sm` | horizontal stacked bar | proportion without needing a radius |
| `xs` | the total, and the largest share | nothing with structure fits |

Each step keeps the question the chart answers — *how is this split?* — and
drops only the precision the space cannot carry.

## Rules that came out of building it

- **Measure both axes.** A 400×70 box is wide and still cannot hold a bar plus
  its labels. Width alone gives a wrong answer, so `bucketFor` has a height
  floor.
- **The component owns its whole representation.** The dashboard drew its own
  legend outside the donut; the donut therefore could not know when the legend
  no longer fit, and it overflowed. Legend moved inside.
- **Clip as a backstop.** Content should adapt on its own, but a cell with a
  fixed height also gets `overflow-hidden`. An overlapping dashboard looks
  broken in a way a clipped card never does.
- **Lists scroll, with a fade.** A card shorter than its list has to cut a row.
  A hard edge through a row reads as a bug; a short fade reads as "more below",
  which is true.
- **Nothing renders at a guessed size.** Until the first measurement, render
  nothing — a first paint at the wrong size is a visible jump.

## `visibility: hidden` still occupies space

Worth its own heading, because it shipped a broken rail to the user.

Nav labels were hidden with `visibility: hidden` so they could fade. But a
hidden element **keeps its box in the layout** — and the label was a flex child
with `flex-1`, so it still ate the whole row and pushed the ICON off the left
edge of a 64px rail. Every nav item rendered as an empty pill.

To hide something that must also give its space back, collapse the box:

```css
opacity: 0;
flex: 0 0 0px;
width: 0;
min-width: 0;
margin: 0;
overflow: hidden;
visibility: hidden;   /* only for the reading order */
```

`display: none` would also work but cannot be transitioned. Collapsing the flex
basis animates just as smoothly and actually returns the width.

## Clip structurally, don't chase elements

The rail had a decorative glow at `scale-125` bleeding 8px over the page, plus
flyouts escaping by design. Rather than fix each, the rail now sets
`overflow-x: hidden` and nothing is allowed out. The drag handle moved fully
inside it as a result — a handle straddling a clipping edge is only half
grabbable, which is worse than one slightly narrower.

Related: [[Layout engine]], [[Fractions not pixels]], [[Clamp on read, not on write]]

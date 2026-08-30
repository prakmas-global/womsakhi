---
status: stable
updated: 2026-08-15
tags: [idea, layout]
---

# Fractions not pixels

The [[Layout engine]] stores a dragged split pane as `0.38`, not `380px`.

The reason is that a pixel is not a portable unit. Someone drags a detail pane
to 380px on a 1920-wide monitor — that's 20% of the row, a sensible reading
column. Open the same saved layout on a 1280 laptop and 380px is 30% of the row.
On a phone it is the entire screen and the list beside it has vanished.

The user did not say "380 pixels". They said "about a fifth". Store what they
meant.

## The one exception

Sidebar width is stored in **pixels**, and that is deliberate.

A navigation rail's useful width is absolute, not proportional. It needs to fit
"Support fund" without wrapping — that's a text measurement, and text doesn't
get wider on a bigger monitor. 248px is right on every screen that can afford
248px. A proportional sidebar would be a useless 90px sliver on a laptop and an
absurd 400px canyon on an ultrawide.

Rule of thumb: **proportional if it holds content that reflows, absolute if it
holds content of fixed intrinsic size.** Panes reflow. Nav labels don't.

## Per breakpoint, not one value scaled

Desktop, tablet and phone are three different layouts, not one layout resized.
Widening a detail pane on a monitor says nothing about what you want on a phone,
where the same screen is probably not split at all.

So the store is keyed `{screen}:{pane} -> {mobile, tablet, desktop}`. Three
independent numbers. Most stay unset and fall through to the default, which is
fine — an unset value is not a missing value, it's "no opinion yet".

Related: [[ADR-009 Layout stores fractions per breakpoint]], [[Clamp on read, not on write]]

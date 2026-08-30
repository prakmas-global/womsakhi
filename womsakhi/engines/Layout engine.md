---
status: stable
updated: 2026-08-15
tags: [engine, layout]
---

# Layout engine

**Location:** `src/layout-engine/` (frontend), `app/models/layout.py` +
`app/routes/layout.py` (backend) · **Portable:** yes, same rule as
[[Theme engine]] — no app imports.

> [!note] State
> Done and verified: the store, the engine, every primitive, both shells, the
> admin dashboard's widget grid, and resizable charts. **38 backend + 53 browser
> checks.** Remaining: split panes on the list↔detail screens and table column
> widths — the primitives exist, each screen opts in with one line.

Lets a person arrange her own app: reorder and hide navigation, resize the
sidebar, drag split panes, set chart heights and column widths, and rearrange
dashboard widgets. Both apps, every breakpoint.

## Core decisions

- [[Fractions not pixels]] — proportions travel between screens, pixels don't
- [[Clamp on read, not on write]] — the store can never produce an unusable app
- [[ADR-009 Layout stores fractions per breakpoint]] — the record
- [[Cannot trap yourself]] — the invariant that constrains every control

## Storage

One document per user in `user_layouts`, fetched with the session. Small on
purpose: layout must be known *before* first paint, or the app visibly
rearranges itself a moment after load — which reads as a bug even though the
final state is correct.

Same first-paint problem as theming, same solution: a cookie mirror read
server-side.

## Files

| File | Does |
|---|---|
| `types.ts` | Shape, limits, breakpoints, the unhideable set |
| `storage.ts` | localStorage mirror + first-paint cookie |
| `LayoutEngineProvider.tsx` | State, debounced saves, all setters |
| `LayoutStyle.tsx` | **Server** component — sidebar width, no jump |
| `ResizeHandle.tsx` | Pointer + keyboard resizing for anything in pixels |
| `ResizableSidebar.tsx` / `useSidebarVariable.ts` | The nav rail |
| `SplitPane.tsx` | List↔detail, proportional, stacks on phones |
| `ResizableBox.tsx` | Chart and panel heights |
| `SortableList.tsx` | Reordering, keyboard-accessible |
| `WidgetGrid.tsx` | Dashboard cards: reorder, span, hide |
| `useCustomNav.ts` | Applies saved order/visibility to the app's nav |
| `CustomiseBar.tsx` | The mode switch and the way back |

## One CSS variable for the shell

The admin shell is fixed-position, so the rail, the top bar and the content
offset can't be siblings in a flex container — each needs the width
independently. They all read `--wc-sidebar-width`.

Three components reading one variable stay in step by construction. Three
components each holding their own copy of the number do not, and the way that
fails is a top bar overlapping the sidebar mid-drag. It also means a drag costs
one property write per frame instead of re-rendering three subtrees.

The server writes the same variable from the cookie, so it is correct before
any JavaScript runs.

## How a screen opts in

One line each. That is the point of the primitives — there is no per-screen
persistence, clamping or keyboard code to get wrong.

```tsx
<SplitPane id="members" list={<List />} detail={<Detail />} />
<AreaTrend data={…} id="growth" chartLabel="Member growth" />
<WidgetGrid screen="dashboard" columns={3} widgets={[…]} />
useCustomNav("staff", NAV_ITEMS)
```

**Charts opt in from inside.** `ChartFrame` lives within the chart components,
so a screen adds `id="growth"` and gets a resizable chart. Seventeen screens use
these charts; wrapping each one at the call site would have been seventeen
chances to forget and seventeen slightly different ids.

`ChartFrame` derives the screen key from the pathname and **strips record ids** —
resizing a chart on one member's page resizes it on every member's page. Without
that, a saved height would apply to exactly one record and look broken
everywhere else.

**The widget grid takes a column count.** The admin dashboard is designed in
thirds; the grid defaults to quarters. `columns={3}` keeps the existing
arrangement exactly as it was — adding customisation should not silently
redesign a screen that was already signed off.

Note the Tailwind trap in there: `xl:grid-cols-${columns}` never generates,
because Tailwind scans source text. The classes are written out longhand.

## Deliberately not resizable

Donut charts and radial gauges. They are square, sized by one `size` prop;
dragging height alone would distort them into ovals. Sparklines under ~150px
with their axes turned off are also left alone — a drag grip on a decorative
element is noise.

## Libraries

- `@dnd-kit/core` + `@dnd-kit/sortable` (~12KB) — drag and drop, keyboard
  accessible out of the box, which `react-beautiful-dnd` is not
- `react-resizable-panels` (~8KB) — split panes with proper ARIA separators

Both free, MIT, no signup.

`react-resizable-panels` v4 is **not** the v3 API most examples show: `Group`
not `PanelGroup`, `Separator` not `PanelResizeHandle`, and `onLayoutChanged`
carries `meta.isUserInteraction` — which is the flag that stops a save firing on
mount, on window resize, and on constraint recomputation. Without checking it,
an incidental relayout overwrites a deliberate choice.

## Why an engine rather than per-screen state

26 screens have a list↔detail split. Implementing resize per screen means 26
implementations, 26 chances to forget persistence, 26 different minimum widths.
One `<SplitPane id="members">` primitive that reads and writes the store means a
screen opts in with one line and inherits clamping, persistence, keyboard
support and reset for free.

Related: [[Theme engine]], [[Entitlements]]

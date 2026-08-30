---
status: stable
updated: 2026-08-15
tags: [reference, layout]
---

# useContainerSize

**Location:** `src/layout-engine/useContainerSize.ts` · built on `use-resize-observer`

Answers "how big am I?" rather than "how big is the window?" — the distinction
that makes [[Adapt, never crop]] possible.

```ts
const { ref, width, height, bucket, measuring } = useContainerSize();
```

## Buckets

Chosen from what the content needs, not from device sizes — these describe a
card, not a screen.

| Bucket | Condition |
|---|---|
| `xs` | height < 110, or width < 200 |
| `sm` | width ≥ 200 |
| `md` | width ≥ 300 **and** height ≥ 170 |
| `lg` | width ≥ 460 **and** height ≥ 240 |

The height floor exists because a 400×70 box is wide and still cannot hold a
labelled bar. Without it the component tries, and the labels spill.

## Why a library and not a hand-rolled ResizeObserver

`use-resize-observer` batches through `requestAnimationFrame`. That is what
stops the browser throwing *"ResizeObserver loop completed with undelivered
notifications"* when a measured element's own resize changes its size again —
which is exactly what happens when a chart inside a resizable card reflows.

## When NOT to use it

If CSS can express the change, use a container query instead — `@container` with
`@sm:`/`@md:`. Cheaper, and it cannot flash. This hook is for when the *rendered
output* has to differ, not just its styling.

Related: [[Layout engine]], [[Theme engine]]

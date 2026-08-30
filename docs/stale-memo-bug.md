# The stale-memo bug — found ten times, now measured

**Status: found and measured 2026-08-26. Fixes held until the parallel agents
finish, to avoid two writers on one file.**

## The shape

```tsx
const { data: EVENTS } = useEvents();          // arrives from the server, later
const shown = useMemo(
  () => EVENTS.filter(...),
  [tab, kinds],                                //  ← EVENTS is not here
);
```

`useResource` returns a mock fallback first and the real data a moment later.
If the memo does not depend on the data, it is computed **once, from the
fallback, and never again**. The screen then shows invented content for the
whole session — and because the fallback is a plausible-looking mock, nothing
about it looks broken.

The counts usually give it away if you look: they are computed *outside* the
memo, so the header reads the server while the list underneath does not.

## Measured impact

| Route | On the server | Shown to her |
|---|---:|---|
| `/app/events` | 4 real events | **none of them** — shows "Craft Mela — Jaipur, 24 MAY", a mock, while the header says "4 coming up" |
| `/app/applications` | 7 real applications | **none of them** |
| `/app/support-fund` | 4 schemes | 3 of 4 |
| `/app/library` | 0 swaps seeded | could not tell |

`/app/applications` is the worst of these: a woman checking whether anyone has
replied to seven job applications is shown a different set entirely.

## Every instance found so far

Fixed during phases 7–12: `mentors` (showed 6 of 24), `opportunities` (invented
job listings all session), `programs` ×2 (course list and its category chips).

Found by lint, not yet fixed: `applications` ×2, `events`, `library`,
`support-fund`, `dashboard/notifications`.

**Ten instances.** That is not a bug to keep fixing one at a time.

## The rule

`react-hooks/exhaustive-deps` ships as a **warning** in
`eslint-config-next/core-web-vitals`, which is why all ten shipped. Promoting it
to `error` in `eslint.config.mjs` would have caught every one.

Before promoting it, the six outstanding instances have to be fixed, or the
build breaks. Do them together, in one pass, when no other agent holds those
files.

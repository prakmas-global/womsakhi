---
status: stable
updated: 2026-08-15
tags: [ops, testing]
---

# Testing

Two layers, and the second one is where the real bugs came from.

## Backend suites — 141 checks

Live in the scratchpad, run against a live server.

| Suite | Checks | Covers |
|---|---|---|
| `test_new_modules.py` | 36 | growth, community, safety endpoints |
| `test_admin_loop.py` | 30 | every admin action end to end |
| `test_staff.py` | 24 | staff account, activity log |
| `test_theme.py` | 18 | theme persistence, admin-set-member-theme |
| `test_permissions.py` | 17 | granular permissions, **as an under-privileged user** |
| `test_backup.py` | 16 | backup and restore |
| `test_layout.py` | 38 | layout store, clamping, no-clobber, reset |

## Browser sweeps — Puppeteer

`full-sweep.mjs` walks all **43 member** and **44 staff** screens, at multiple
viewports, collecting console errors and measuring what actually rendered.
`theme-final.mjs` covers 12 theme × mode combinations. `picker.mjs` /
`picker2.mjs` exist because of the [[Theme engine|picker bug]].

## The lesson worth keeping

**The valuable bugs were found by driving the app, not by reading the code.**

- Forest green failing contrast at 4.06:1 — the maths was self-consistently
  wrong, so reading it proved nothing.
- `/roles` accepting writes with no guard — the code *looked* like the routes
  around it.
- The picker reverting colours — a timing interaction between two correct
  functions.

None were visible in a diff. All were obvious within seconds of using the app as
a restricted user, with a non-default theme, at a viewport nobody develops at.

Corollary: **test as the least privileged user, not the most.** An admin token
passes everything, which is exactly why it proves nothing about authorisation.

## My own recurring test bugs

Listed because I made each of these more than once:

- Measuring a transparent element and concluding it was black.
- Comparing counts against a capped list — notifications cap at 50, activity at
  100. The test was wrong, not the API.
- Writing a selector that matched `<html>`, which carries the theme's inline
  variables and therefore "passes" any colour assertion.

When a test fails, check the test first. That was the correct call more often
than not.

## Layout testing

`layout-browser.mjs` — 32 checks. The ones worth having:

- **The shell stays in step.** Sidebar, top bar and content offset are measured
  together after a drag. They read one CSS variable, and the test proves it.
- **Keyboard only.** Arrows, Home and End resize the rail with no pointer.
- **[[Cannot trap yourself]].** Hides every item that will allow it, then checks
  reset is still reachable, an exit from customise mode remains, and the hidden
  items are listed so they can be restored. Then actually resets and confirms
  everything came back.
- **It really persisted.** Reloads, then reads the account through the API — so
  a value living only in React state can't pass.

## Running them

```bash
npm run check                 # everything, fails fastest first
npm run check:tokens          # static, <1s — nothing bypasses the tokens
npm run check:contrast        # 8 themes × 2 modes, sampled screens
npm run check:contrast:full   # …× every route (~30 min)
npm run check:screens         # every route: a11y, overflow, errors, contrast
npm run check:fast            # ~4s · source-only: tokens, names, types
npm run check:a11y            # every control has an accessible name
npm run check:keyboard        # focus visible, no traps, skip link first
npm run check:feedback        # one way to say what happened (static)
npm run check:toast           # toasts announce, hold on hover; Escape means no
npm run check:rail            # navigation rail geometry, every route
npm run check:states          # empty / loading / error states
npm run check:api             # every GET endpoint against real data
```

## Two ways a check can lie

Both of these produced a confident "all clear" that was wrong.

**A stale dev server.** Next served compiled chunks for classes deleted hours
earlier. `rm -rf .next` changed the numbers. After any bulk edit, restart before
believing a measurement.

**Checks that mutate shared state.** `contrast.mjs` and `screens.mjs` both set
the account's theme, so running them concurrently made each measure the other's
colours. They now take a lock file rather than relying on remembering.

## Checks live in the repo, not the scratchpad

`frontend/checks/` — `contrast.mjs`, `screens.mjs`, `_shared.mjs`. They were in
a temp directory until a cleanup wiped every one of them mid-task. A check that
isn't committed isn't a check; it's a thing somebody did once.

- **`contrast.mjs`** — WCAG AA across 8 themes × 2 modes. Token colours rotate
  with the hue, so a pairing that passes on pink can fail on green: a green
  badge at 2.86:1 survived a full 87-screen sweep because the account it ran
  under happened to be pink. **One theme measures one eighth.**
- **`screens.mjs`** — every route from the file tree, desktop + dark + phone.
  Contrast, accessible names, labels, overflow, stuck loaders, console errors.

- **`tokens.mjs`** — static, sub-second, no browser. Proves nothing bypasses
  the tokens: no raw palette class, no literal hex, no hue-carrying `rgb()`.
  It also scans the **backend** for CSS class names, after one shipped from
  Python and rendered text at 2.37:1 while every frontend check said zero.

Both browser checks measure colour by painting to a 1×1 canvas and reading the
pixel back.
Parsing `lab()`/`oklab()` with a regex and treating the numbers as RGB produced
~1,400 phantom failures on the first run.

`sweep-rail.mjs` — **every screen in both modules, enumerated from the file
tree** rather than a hand-written list, so a screen cannot be missed by being
forgotten. Checks that every nav icon is fully inside the rail at a sane size,
that nothing paints outside it, and that the console is clean. 76 screens.

That sweep exists because a collapsed rail shipped with its icons pushed out of
view on *every page*, and it was caught by the user looking at a screenshot —
not by any of the 84 checks that were passing at the time. Those checks all
asked "does the feature work?"; none asked "does the screen look right?".

Still to do: every screen × 3 breakpoints once per-screen adoption lands.

Two failures on the first run were both **test** bugs, not product bugs: the
customise button lives inside a dropdown the test never opened, and `/app`
correctly redirected the staff account it was signed in as. Same lesson as
above — check the test first.

Related: [[Known issues]], [[Demo accounts]]

## Two speeds

`npm run check:fast` reads the source and finishes in about four seconds.
`npm run check` drives ~230 page loads through six browsers and takes about ten
minutes.

Use the fast one while working, the slow one before calling anything done. They
are not interchangeable and the split is deliberate — see
[[The check that runs in a second]] for why, and for the two occasions the fast
one was wrong in opposite directions.

## What each browser check is the authority on

| check | authority on |
| --- | --- |
| `contrast` | text legibility, 8 themes × 2 modes |
| `screens` | accessible names, heading structure, landmarks, overflow, stuck loaders, console errors |
| `keyboard` | focus visibility, keyboard traps, skip link |
| `states` | empty / loading / error states |
| `feedback` | no browser dialogs, no unannounced timer flags, no unguarded deletes |
| `toast` | toasts appear, announce, pause on hover; confirm dialog traps focus and Escape means no |
| `api` | every GET endpoint against real data |
| `rail` | navigation rail geometry |

## Long checks must be detached, and must not race the dev server

`contrast.mjs --full` is 78 screens x 16 theme/mode combinations — about forty
minutes. It died twice before it ever produced a result, and neither failure was
a real one:

- **Editing `src/` while it runs.** Next recompiles underneath it and
  navigations fail with `net::ERR_ABORTED`, which reads exactly like a broken
  screen. Do not touch the frontend while a sweep is running.
- **Session teardown closing Chrome**, which surfaces as
  `ConnectionClosedError: Connection closed.` mid-run. Start it detached:

```bash
nohup node checks/contrast.mjs --full > /tmp/sweep.log 2>&1 < /dev/null &
```

(`setsid` does not exist on macOS.)

It also takes `/tmp/womsakhi-checks.lock`. A killed run leaves the lock behind
and the next one waits forever on a message that looks like slow progress —
delete it when no `contrast.mjs` process is alive. `pkill -f contrast.mjs` does
not reliably kill it either; check with `pgrep` and use `kill -9`.

## A test that can only pass once is worse than no test

`scratchpad/test_sakhi.py` booked a fixed date and time. It passed on the first
run and failed on every one after — the app's own double-booking guard rejected
the repeat, and the suite reported three failures that looked like a product
regression in the confirm gate.

The guard was right; the test was wrong. Any suite that writes real records has
to make its fixture unique per run.

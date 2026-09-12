# Checks

Browser-driven checks that run against the **running app**, not a build.

They live in the repo rather than a scratch directory because the useful ones
were repeatedly lost to cleanup, and because a check that isn't committed isn't
a check — it's a thing somebody did once.

```bash
# both servers must be up
node checks/contrast.mjs        # WCAG AA across every theme × mode
node checks/screens.mjs         # per-screen a11y + overflow + console errors
node checks/rail.mjs            # navigation rail geometry on every route
```

Each exits non-zero on failure, so they can be chained in CI.

## Why they measure with a canvas

App colours resolve to `lab()` / `oklab()`. Parsing those with a regex and
treating the numbers as RGB produced ~1,400 phantom failures on the first run.
Painting each colour to a 1×1 canvas and reading the pixel back gives true
sRGB whatever the source colour space.

## Why contrast is checked per theme

Token values rotate with the hue, so a pairing that passes on pink can fail on
green. A green badge at 2.86:1 survived a full 87-screen sweep because the
account it ran under happened to be pink. One theme measures one eighth.

## Running them

```bash
node checks/tokens.mjs           # static, <1s — nothing bypasses the tokens
node checks/contrast.mjs         # 8 themes × 2 modes, sampled screens (~3 min)
node checks/contrast.mjs --full  # …× every route (~30 min)
node checks/screens.mjs          # every route: a11y, overflow, errors, contrast
node checks/rail.mjs             # navigation rail geometry, every route
npx tsx src/theme-engine/__checks__/ink.mjs   # token maths, no browser
```

`contrast.mjs` and `screens.mjs` both change the signed-in account's theme, so
they take a lock file — running two at once made each measure the other's
colours and produced four phantom failures.

## What each check actually asserts

- `tokens.mjs` — static; no literal colour or type size escapes the tokens
- `contrast.mjs` — WCAG AA across every theme × mode
- `screens.mjs` — per-screen a11y, overflow and console errors
- `rail.mjs` — navigation rail geometry on every route
- `phone.mjs` — every dashboard screen at 390px, plus the off-canvas drawer:
  it opens, Escape closes it, tapping away closes it, navigating closes it,
  and above `lg` it is a permanent column again
- `split.mjs` — the layout engine's split pane on the screen that adopted it:
  drags, persists across a reload, moves with arrow keys, stacks on a phone
- `sakhi.mjs` — a real conversation with the assistant: she answers from her
  own records, asks before changing anything, and hands distress to a helpline.
  **Slowest by far, and it costs money on every run.**
- `ux-dead.mjs` — **no button in the member app does nothing.** Static sweep of
  every `<Btn>` and every `SectionHead action=` in `src/app/app`: each must
  carry a `href` or an `onClick`. The only exemption is a busy label ending in
  `…`, which is the disabled half of a conditional. It then renders the six
  Phase 6 screens in both themes, and finally *presses* both feedback
  components — `ActionBtn` must swap its label and swap it back, `NoteBtn` must
  open a box that refuses to send empty.
- `media-urls.mjs` — **no hostname is ever stored in the database.** `POST
  /uploads` used to store the absolute URL it had just built, so a file
  uploaded from a laptop carried `http://localhost:8020` into production and
  the browser refused it — 40 CORS errors on a real phone, on images that were
  served correctly the whole time. Nothing caught it: the value was right on
  the machine that wrote it, the screenshot checks never read the console, and
  `api.mjs` saw a 200 with a poisoned string inside. It asserts in three
  independent places — only `app/core/media.py` may read `MEDIA_BASE_URL`; the
  database holds no loopback URL (asked of the backend, which owns the Mongo
  driver); and a real upload stores a path, returns a URL that loads, and older
  absolute rows still read back without being double-prefixed.
- `ux-nav.mjs` — every route resolves to the right mode and rail section
- `ux-states.mjs` — every route has a loading state and an error state, and the
  error names what failed in her words
- `ux-phase2/4/5.mjs`, `ux-<module>.mjs` — one per module, asserting the thing
  that module exists to do

## Three ways these checks lied before they were trusted

**`scrollWidth > clientWidth` is not "the page overflows".** `body` is
`overflow-x: clip`, and a table inside its own `overflow-x-auto` container is
*supposed* to be wider than the viewport. Measuring that way reported 41 broken
screens when 5 were. `phone.mjs` tries to scroll the window instead, and ignores
anything inside a scroller.

**A loose selector matches the wrong component.** Both `SplitPane` and
`ResizeHandle` render `role="separator"`, so a bare query produced one false
failure and three false passes. Narrow it with the `aria-label` too.

**Assert the thing you think you are asserting.** A nav check that clicked a
link inside a collapsed group navigated nowhere and failed for the wrong
reason; it now proves the URL changed first.

**A working-looking button is not a working button.** Sixty-six `<Btn>` elements
across thirty-three screens had neither a destination nor a handler. Every one
of them hovered, rippled and pressed exactly like the real ones, so no amount of
looking would have found them — only `ux-dead.mjs` did. Count the word in a
sentence and you count the explanation too: assert on the badge, not the prose.

**Wait for the element, do not guess at a delay.** `settle: 1200` read the error
alert as `null` on a cold compile and took the whole run down with it. Every
read of something that appears asynchronously now waits for it.

## Before believing a result

**Restart the dev server after a bulk edit.** Next serves compiled chunks for
classes that no longer exist in source; a stale server reported a class the
codebase had not contained for hours.

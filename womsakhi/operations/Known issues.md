---
status: living
updated: 2026-08-22
tags: [ops]
---

# Known issues

## ~~Members were told they were staff~~ — FIXED 2026-08-17

`/users/me` never set `audience`, so `UserResponse` fell back to its default of
`"staff"`. Sign-in set it correctly, so the member app worked until the first
reload — after which the shell saw `audience: "staff"`, decided this was not a
member, and redirected her out of her own app.

Now derived inside `UserModel.to_response`, so every endpoint that serialises a
user agrees. A value that only one code path sets will eventually disagree with
the paths that do not.


Honest list. Things that are wrong or unfinished, kept visible rather than
quietly dropped.

## ~~Hydration warning, dev only~~ — FIXED 2026-08-15

Was: a React hydration warning on 1–2 random pages per sweep, blamed on
`RouteProgress` and left unfixed.

The real cause was an explicit `<head>` in the root layout. It fought Next's own
head management, and the server ended up emitting `<meta charset>` where the
client rendered the first `<body>` child — which is why the warning appeared to
come from whatever happened to render first, and why it seemed random.

Fix: drop the explicit `<head>` and render `<ThemeStyle />` / `<LayoutStyle />`
inside `<body>`. React 19 hoists `<style>` itself, and styles in `<body>` apply
identically. **0 hydration errors across 10 pages.**

Lesson worth keeping: it was attributed to the component that rendered at the
mismatch point, not the one that caused it. When a hydration diff names a
component, check what comes *before* it.


## ~~Analytics measured a website that does not exist~~ — FIXED 2026-08-22

Was: the whole Analytics screen read one seeded snapshot — 48,592 visitors and
182,340 page views, for a platform with 46 members — and the date-range selector
was documented in the code as "display only", sent to the server and discarded.

Now every figure is counted from `members`, `bookings` and `enrollments` inside
the selected window, and every delta is a real comparison against the preceding
window of the same length. Four panels changed meaning rather than being
fabricated further: device share → members by segment, traffic sources →
bookings by service type, top pages → most-booked services, referrers → how
members found us. Nothing in WomSakhi records a page view, so those questions
had no honest answer.

The `analytics_*` collections still exist in MongoDB, unread and unwritten. They
were left rather than dropped — deleting data is not something to do quietly.

## ~~Sakhi's safety gate only understands three languages~~ — FIXED 2026-08-22

Now covers all 18. Done in the same pass as the language rollout rather than
after it: shipping Tamil while the distress gate only read English would have
meant a woman in danger writing in her own language and tripping nothing.

## Sakhi has no memory between conversations

Each conversation replays only its own turns. She will not remember something a
member told her last week in a different thread — including her intake answers,
which are stored on her account but not yet fed to the assistant. Deliberate for
now (it is also the safer default), but it will read as forgetfulness.

## The staff copilot is not built

The 12 `/ai` endpoints behind the admin AI screen are still the seeded,
canned ones from Phase 8. Only the member assistant is real. A staff member
reading that screen has no way to tell the difference, which is the part worth
fixing first.

## ~~Languages: most untranslated~~ — ALL 18 SHIPPED 2026-08-22

Every registered language now has a complete catalogue and renders for real:
en, hi, ur, mr, ta, bn, te, gu, kn, ml, pa, or, ar, es, fr, pt, id, sw.

Each was machine-verified before it was allowed to ship — 327/327 keys, every
`{placeholder}` intact, text confirmed to be in its own script — and then driven
in a browser by `checks/i18n.mjs`: **17/17 render** with the correct `lang`,
correct `dir`, and a font that can actually draw the script. See [[ADR-016]].

**Two real bugs this uncovered, both invisible until measured:**

- **The script fonts were loaded and referenced by nothing.**
  `Noto_Sans_Devanagari` and `Noto_Naskh_Arabic` were applied to `<body>` in
  `layout.tsx`, but no font stack ever named them — so Hindi and Urdu had been
  falling back to whatever the device happened to have, for as long as they have
  existed. On a device without the script that is empty boxes: the language
  switch appears to work and the screen cannot be read. `--font-scripts` in
  `tokens.css` now names all ten, and the eight missing Noto families are
  loaded. Loading a font and never naming it in a stack is the same as not
  loading it.
- **Sakhi's distress gate did not speak the new languages.** Covered in the same
  pass — see [[ADR-016]] for the two matching mistakes that only showed up under
  test.

## Translations have not been read by a native speaker

15 of the 18 catalogues are marked `reviewed: false`. That is an honest record,
not a defect: they are complete and correct in structure, and no person who
speaks the language has read them. The [[Safety]] and [[Money]] strings are
where a reviewer's time is worth the most. Flip `reviewed` per language in
`i18n/locales.ts` as each one is checked.

## ~~Full theme sweep not done~~ — RUN CLEAN 2026-08-22

`contrast.mjs --full` finally ran end to end over the finished code:
**0 failing text nodes across 8 themes x 2 modes x 78 screens.** `screens.mjs`
agrees from the other direction — 234 screen x viewport combinations, 0 contrast
failures, no problems.

It took three attempts, and neither of the first two failures was real:

- **Attempt 1** died because `src/` was being edited underneath it. Next
  recompiles and navigations fail `net::ERR_ABORTED`, which reads exactly like a
  broken screen.
- **Attempt 2** died when a session teardown closed Chrome
  (`ConnectionClosedError`). Run it detached — see [[Testing]].

The same trap caught the `screens` run: one page reported FAILED TO LOAD because
a translation file was saved mid-sweep. It was re-run rather than explained
away, and came back clean. A check you talk your way out of is not a passing
check.

## ~~`org.*` features are gated but unimplemented~~ — BUILT 2026-08-22

All four now exist behind `routes/org.py`, and each is guarded by **two**
different questions, because either alone is a hole: `require_super_admin` (is
this person allowed to change the whole installation?) and `require_feature`
(has this installation licensed it?). A Super Admin on the free tier is refused;
so is an org-tier account operated by a Viewer.

- **org.branding** — name, logo and wordmark. Rendered by the rail; the marks
  fall back independently, so an org with a logo but no wordmark gets its logo
  beside WomSakhi's wordmark rather than a broken image.
- **org.default_theme** — the palette a new account *starts from*. It never
  overrides a choice. That needed a new fact: `theme_id` cannot answer "did she
  choose?", because every account is created holding `"womsakhi"` — choosing the
  default and never opening the picker looked identical. `theme_chosen` is set
  only by the endpoint a person's decision goes through.
- **org.layout_templates** — save a layout, push it to a role. Writes only to
  accounts with **no layout of their own**, and reports how many it skipped.
  Silently resetting someone's arrangement is how a "customise" feature loses
  people's trust for good.
- **org.custom_domain** — issues a token and checks it in a real DNS TXT record.
  Unreachable DNS resolves to `failed`, never `verified`: a verified flag that
  nothing checks is a claim the product makes on its own behalf.

Verified by `scratchpad/test_org.py` — 26 checks, including every refusal.

## ~~The staff dashboard does not work on a phone~~ — FIXED 2026-08-22

Was: every `/dashboard` screen overflowed horizontally at 390px — measured
458–653px of content in a 390px viewport. The cause was the shell, not the
screens: a fixed 248px navigation rail with a matching content inset and no
phone breakpoint left 142px of usable width.

Fixed with the off-canvas drawer this note asked for. Below `lg` the inset is
zero, the rail slides in over the page from a button in the top bar, and it
closes on Escape, on a tap away, and on navigating. Above `lg` nothing changed.

Three things had to go with it, found by measuring rather than by looking:

- The **top bar itself** was 128px too wide on 43 of 44 screens — search pill
  plus five icons plus the name. Search collapses to an icon below `sm`; help
  and settings are hidden there (both reachable elsewhere).
- Four **flex rows refused to shrink** (`min-width: auto` is the default on a
  flex and grid child), so a filter row or a pagination strip stayed one long
  line inside a card narrower than itself.
- The check that found all this was itself wrong at first: `body` is
  `overflow-x: clip`, so `scrollWidth > clientWidth` reports a table that is
  *correctly* scrolling inside its own container as a failure. `checks/phone.mjs`
  now tries to scroll the window and ignores anything inside a scroller.

**0 of 44 screens** scroll sideways or push content off-screen. The drawer is
driven for real in the same check, because an overflow number says nothing
about whether the navigation is still reachable.

## ~~Layout engine: per-screen adoption~~ — DONE 2026-08-22

The engine, both shells and the customise mode were already done. **23 dashboard
screens now opt in** (2026-08-22) — every two-column list↔detail and
content↔aside screen. Their divider drags, remembers where it was left per
breakpoint, moves with arrow keys, and stacks on a phone.

Adoption is one line because of `ResizableColumns`, a thin wrapper that takes
the two halves as ordinary **children** rather than as `list`/`detail` props.
Converting 23 signed-off layouts into prop position would have been a lot of
edits for no behaviour change, and every edit a chance to move something.

**All 25 are converted**, including the two three-column screens
(`/dashboard/appointments`, `/dashboard/messages`). Rather than special-case
them, `ResizableColumns` was generalised to N columns — a separate three-panel
primitive would have been two components with the same behaviour, drifting
apart. Each column stores its own fraction (`<id>:col<n>`), which is what lets a
three-column screen remember both of its dividers instead of just the first.

One constraint fell out of that: a 20%/80% band is unsatisfiable with three
columns, because one panel at its maximum leaves 10% each for the other two —
below their own minimum. The floor now scales with the column count.

### What the codemod got wrong, twice

Both were caught by `tsc` and a browser sweep, and both are the reason the
conversion was verified per screen rather than trusted:

- **Self-closing `<div … />` broke the depth walk.** Counting `<div` and
  `</div>` without excluding self-closing tags sent one closing tag 229 lines
  past where it belonged.
- **Inserting an import after "the last import line"** landed *inside* a
  multi-line `import { … }` block. Anchor on a line that ends in `;`.

A third failure was in the checking, not the code: the verification sweep waited
1.1s and reported Analytics as unconverted, when it simply had seven API calls
still in flight. It has both its dividers.

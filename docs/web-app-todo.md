# WomSakhi web app — what is left

Agreed 2026-08-24. **Web is finished before any mobile work starts.**
**Backend wiring happens last**, after every screen exists — Praveen's call.

| | |
|---|---|
| Target | **~445 screens** across 44 modules |
| Built | **~445** across 71 routes (100%) |
| Pending | **0** — `/app/sakhi` is frozen by instruction, done last |

Every screen runs on mock data from 13 `data.ts` files under `src/components/ux/`,
shaped to match the real API responses so wiring later is a change of source,
not a rewrite.

---

## Phase 1 — Close the visible seams · DONE 2026-08-24

Guarded by `checks/ux-detail.mjs` (25 assertions) and `checks/ux-nav.mjs`.

- [x] `programs/[id]` — course detail
- [x] `programs/[id]/lesson/[n]` — **new**, the lesson player Learning had no way to reach
- [x] `events/[id]` — event detail
- [x] `stories/[id]` — story detail
- [x] `bookings/[id]` — booking detail
- [x] `checkout/[orderId]` — payment
- [x] `explore/program/[id]` — redirects to `/app/programs/[id]`
- [x] `explore/service/[id]` — redirects to `/app/mentors/[id]`
- [ ] `sakhi` — **frozen by instruction, do last**

The two `explore/*` routes were duplicate copies of screens that live in Learning
and Mentors. Redirected rather than maintained twice — Discover is a lens over the
app, not a second store of it. Old links still land correctly.

---

## Phase 2 — Dead ends · DONE 2026-08-24

Guarded by `checks/ux-phase2.mjs` (26 assertions) and `checks/ux-nav.mjs` (42 routes).

- [x] **Course player + lesson pages** — landed in Phase 1
- [x] **Product editor / add product** — `documents/product/[id]`, `/new`
- [x] **Order detail + tracking** — `documents/order/[id]`
- [x] **Checkout flow** — landed in Phase 1
- [x] **Circle creation** — `circles/new`, two steps, maths shown before inviting
- [x] **Skill Exchange chat thread** — `library/[id]`, agreement pinned above the chat
- [x] **Public profile preview** — `profile/preview`, states what is withheld

Every entry point was wired at the same time: Edit/Restock/Add on products, Open
on an order, "Start your own circle", Message on an exchange, and "See it as
others do" on the profile. Nothing in the app now opens onto nothing.

---

## Phase 3 — Loading and error · DONE 2026-08-24

Guarded by `checks/ux-states.mjs` — walks **every** route in both states.

- [x] **Error states — 47 of 47 routes**
- [x] **Loading states — 47 of 47 routes**
- [x] Next's own `loading.tsx` + `error.tsx` on all **49 route segments** (98 files)

Built as architecture rather than 38 hand-edits:

- `kit/state.tsx` — `ScreenSkeleton` (four shapes) and `ScreenError`, defined once.
- `whatFailedFor(pathname)` — the error names what failed *in her words*
  ("your money", "this lesson"), derived from the route so no screen can forget it.
- Per-route `loading.tsx` / `error.tsx` — Next wires these automatically, so they
  fire on a genuinely slow connection and on real thrown errors, with **no page
  changes at all**.
- `?state=loading` / `?state=error` on any screen — a review affordance, and a
  link support can send to reproduce what a woman saw. Delete when the API lands.

The shell stays visible in both states: nav and search keep working, because the
app is not broken — one screen is.

---

## Phase 4 — Partly-built modules · DONE 2026-08-24

Guarded by `checks/ux-phase4.mjs` (30 assertions).

- [x] **My Shop / Marketplace** — **services**, reviews and ratings
- [x] **Savings Circles / SHG** — pay-in flow that names who is waiting
- [x] **Goals & Milestones** — `progress/goals`, every goal needs a number and a date
- [x] **Emergency SOS** — press-and-hold alert + contacts shipped in Safety

### The gap Praveen found

A member could sell **a thing in a box** and nothing else. There was no way to
list stitching to measure, mehendi, tuition, cooking or childcare — which is how
most women on WomSakhi actually earn. Four "offer" buttons were also dead.

Services now live beside products under "What you sell", because to her they are
one thing: what she earns from. They are a **separate editor** because the
questions differ — a service has a rate, a place and a travel distance, not
stock. Forcing both into one form would ask a tailor how many haircuts she has
left.

**Every way to offer something now leads somewhere — 6 of 6 verified.**

---

## Phase 5 — The ten modules · DONE 2026-08-24

Guarded by `checks/ux-phase5.mjs` (29 assertions) and `ux-nav.mjs` (50 routes).

- [x] Health & Wellbeing — `/app/health`
- [x] Legal Aid & Rights — `/app/rights`
- [x] Family & Childcare — `/app/family`
- [x] Transport & Safe Travel — `/app/travel`
- [x] Skill Assessment — `/app/assess`
- [x] Digital Literacy — `/app/digital`
- [x] Insurance & Pension — `/app/cover`
- [x] Group Buying — `/app/group-buy`
- [x] Voice Mode — `/app/settings/voice`
- [x] Offline Mode — `/app/settings/offline`

### A seventh mode

Six of the ten fitted existing sections. The other four — health, rights,
family, getting about — are **not about earning**. They are about what *stops* a
woman earning, which every other module quietly assumes is handled. They needed
a home, so **Wellbeing** is now the seventh top-level mode.

Measured before adding it: 369px spare in the topbar, tabs average 72px. Seven
fits with room.

### The thread running through all ten

**Say what is free, and where.** Cost and not knowing are the two barriers —
almost never willingness. A free haemoglobin test, an Anganwadi 800 metres away,
₹20-a-year accident cover, a free lawyer on 15100. Every one of those is
something members are entitled to and mostly do not use because nobody told
them the price.

Sakhi's speech pipeline was **not touched** — Voice Mode configures it only.

---

## Phase 6 — Long tail · DONE 2026-08-24

Guarded by `checks/ux-dead.mjs` (34 assertions) and `ux-nav.mjs` (56 routes),
`ux-states.mjs` (66 routes).

Found by measurement, not memory: a sweep for `<Btn>` with no `href` and no
`onClick` found **66 dead buttons across 33 screens**. Widening it to section
headings took it to **80 across 40**. Not one was visible in review — they look
like working buttons, they highlight on hover, they ripple on press.

### New screens (6) — all built

- [x] **Withdraw** `/app/wallet/withdraw` — available and pending never added
      together; the fee says **None** rather than being omitted; it says when the
      money lands in days she can plan around
- [x] **Statement & receipts** `/app/wallet/statement` — a PDF a bank will accept,
      with money in, money out and the closing balance at the top
- [x] **Payment methods** `/app/settings/payments` — exactly one Primary, **named
      on the row** rather than implied by order
- [x] **Saved items** `/app/saved` — a saved thing carries a clock; expired ones
      are shown greyed, not silently dropped
- [x] **How to apply for a scheme** `/app/support-fund/[id]` — written backwards
      from the counter: which office, which paper, and what to do when refused
- [x] **Document vault** `/app/documents/vault` — open, download or replace any
      paper, with **where each one is already being used** on the row

### Wire the rest — 80 of 80

- [x] Buttons that navigate — Receipt, Book again, Visit the shop, Edit profile,
      Terms, Privacy, Add, Change email, Alert me
- [x] Buttons that leave the app — Directions and Open in maps now build a real
      Google Maps URL; Send on WhatsApp builds a real `wa.me` link
- [x] Ten dead `SectionHead action=` headings — "See all", "Manage", "Edit",
      "Settings", "View", "Download"

### Two components, so this stays fixed

**`ActionBtn`** — the button answers on itself. The label becomes the
confirmation for two seconds and then returns, with `aria-live` so a screen
reader hears it. No provider, no portal, no state in the page. Used for Remind
me, Alert me, Add to calendar, Tell me if a place opens, and every Share (which
copies a real link and says whether the clipboard allowed it).

**`NoteBtn`** — the buttons that need words back: Leave a note, Reply, Say
hello, Start a chat, Report someone, Pick a time, Ask for a session. A portalled
box with an optional star rating that **names who will read it before she
types**, and refuses to send empty.

### The durable part

- [x] `checks/ux-dead.mjs` — three layers:
      1. **Source** — every `<Btn>` and `SectionHead action=` in `src/app/app`
         must carry a handler or a destination. Exhaustive, instant, no flake.
         Fails on a button written dead *today*, not on one somebody remembers to
         open. The only exemption is a busy label ending in `…`, which is the
         disabled half of a conditional.
      2. **Surface** — the six new screens rendered in both themes: contrast,
         hit targets, clipping, sideways scroll, image 404s.
      3. **Pressed** — ActionBtn is clicked and its label read back; NoteBtn is
         opened and its Send button checked as blocked while empty.

### What the check caught that review did not

- The scheme page hid **"ask for an acknowledgement slip"** — the single most
  important instruction on it — behind an accordion tap. All five steps are now
  open; a procedure you cannot read at a glance is not a procedure.
- Every bookmark in the app pointed nowhere, and **nothing linked to Saved at
  all**. It is now a section under Home.

### Still to become real at backend wiring

Downloads (certificate PDF, statement PDF, receipts) confirm with "Getting it
ready…" and hold. They become real files when the API lands — the button, the
label and the handler are all in place.

---

## After all screens exist

### Backend wiring · 16 of 41 modules live · 2026-08-24

Full detail in [`backend-wiring.md`](backend-wiring.md). The short version:

- [x] **One hook, `useResource`** — falls back to the mock rather than to
      nothing, never leaves her on a spinner, cancels on unmount
- [x] **`<SourceNote>`** — says on the screen when she is looking at example
      figures rather than her own. On a money screen an unlabelled fallback is
      not graceful degradation, it is a lie about her balance
- [x] **16 modules wired** — Earn, Withdraw, Statement, Notifications, Bookings,
      Certificates, Your papers, Refer, Circles, Sakhi Local, Mentors, Your
      journey, Sakhi, Verification, session, theme
- [ ] **10 modules have no server at all** — Find work, Applications, Events,
      the four Wellbeing modules, Insurance, Buying together, Prove your skills,
      Using a phone, Saved, Search, and her payout accounts. Each needs a
      router, a model and admin tooling before a screen can read it
- [ ] Rename the collision: backend `/wallet/support` (asking us for help
      paying) vs the screen `/app/support-fund` (government schemes)

### Sakhi · DONE 2026-08-24

The last route on the old design. Re-skinned onto the `--ux-*` system and given
a home in the navigation — she was reachable only from a floating launcher and
two stray links, which is why her page had no shell at all.

**The chat pipeline was not touched.** All six `data-sakhi` hooks the assistant
checks depend on are preserved, and so are the three decisions the old file
argued for: the confirmation is a card in the thread rather than a dialog that
covers what it is asking about, both its buttons are the same size, and the
safety reply looks deliberately unlike a chat bubble.

### Real downloads · DONE 2026-08-24

Every download produced nothing before, which is worse than a dead button — a
dead button teaches her the app is broken, a lying one teaches her the file is
somewhere she cannot find.

- **`printDocument`** opens a clean page and calls the browser's print dialogue.
  Save as PDF is in every one of them, so she gets a real PDF with selectable
  text that a bank can read — no library, no backend, ~200 bytes of code.
- **`downloadCsv`** writes a real file through a Blob, with the BOM that makes
  Excel render ₹ and Devanagari instead of mojibake.
- Statement, every receipt, every certificate, and the vault's record sheet.

### Still to do

- [ ] Build the ten missing routers, then wire the remaining modules
- [ ] Re-run every check against live data
- [ ] Then, and only then, start the React Native app

## Standing rules

- **Sakhi is frozen** until the very end.
- **Port 3000 is Praveen's Slesha project** — never touch it. Web runs on
  **3100**, API on **8020**.
- Every module ships with a check in `checks/` and is registered in
  `checks/all.mjs`. **27 checks green** at the time of writing.
- Every screen must pass in **both themes**: 0 contrast failures, 0 undersized
  hit targets, 0 clipped text, 0 sideways scroll.
- Measure on the surface the user meets, and state the number.

## Known gap in this plan

The full 44-module list was never written down. The **14 new modules** in
Phases 4 and 5 have recorded counts and are exact. Phases 2, 3 and 6 are
reconstructed from the code — the totals are sound, the labels may shift.
Worth writing the complete list out properly.

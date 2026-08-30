# Module 1 — Money · every screen, every button

Twelve screens. Chosen first because a mistake here costs her actual money, and
because it contains every interaction type in the app — list, detail, form,
multi-step flow, confirmation, printable document, live balance — so whatever
is built here becomes the pattern the other modules reuse.

## What is already right

- **Withdraw moves money.** Verified: ₹500 → ₹300, ledger debited, overdraw
  refused with her own figures, ₹100 floor, same idempotency key twice
  withdraws once.
- **Payment methods** are server-truth: add, make primary, remove, all round-trip.
- **The balance is summed from the ledger**, so the figure and the list cannot
  disagree.
- **Statement and receipts print** real PDFs through the browser's own dialogue.

## The bug that decided the order

`/bookings` "Yes, cancel" **only sets local state.** The endpoint
`POST /me/bookings/{id}/cancel` exists and is never called. She cancels, the
server never hears, and on the day it counts as a no-show — the mentor holds an
hour for a woman who thought she had told her.

---

## Where we stopped — 2026-08-25, mid-module

Typecheck clean, both servers up, nothing half-written.
`checks/ux-money-module.mjs` **is written but has never been run** — that is
the next command.

### Done, and proven

| | |
|---|---|
| **The cancel bug** | Fixed and measured in a browser: 1 cancelled before, 2 after. **The server heard it.** |
| **Goals** | New `goals` collection, `/me/goals` CRUD. Money goals read the ledger and *refuse* to be edited by hand; counted ones she moves herself; six goals is refused at five |
| **`/money/overview`** | Earn opened with four requests. **294ms → 73ms, 8 queries → 5** |
| **Schemes / Cover** | "Start the application" and "I already have this" now persist through `/reference/{id}/mark` |
| **Payments** | Wired to real orders. "Try again" starts a **fresh** order — the server gives a declined payment its own record on purpose, and reopening the refused one lands her on a payment already declined |
| **Statement** | Month tabs were three hard-coded strings showing identical rows, on a document a bank is asked to accept. Now derived from the ledger, and the rows are filtered by the month she picked |

### The four reusables, built once for every module after this

- **`useAction`** — optimistic write, rollback on failure, named error, per-row
  busy flag. Six screens had hand-rolled it and the differences were where the
  bugs were.
- **`<Money>` / `formatMoney`** — **seven copies** of the rupee formatter across
  seven data files, already drifted (one returned "Free" for zero). Now one.
  `formatWholeRupees` is deliberately a separate *name*, because job pay is
  stored as whole rupees and passing it to the paise formatter renders a wage
  ten times too small.
- **`<ConfirmButton>`** — press, confirm in place, act. Both buttons the same
  size; says what it costs someone else.
- **`<Rows>` / `rowMemo`** — virtualises past a threshold and does nothing at
  all below it. The ledger is flattened into one list so it can be.

### Next, in order

1. **Run `node checks/ux-money-module.mjs`** — it presses every button and asks
   the server whether it heard. Never run yet.
2. Fix whatever it finds.
3. `/checkout/[orderId]` — confirm must send the `Idempotency-Key` the API
   already honours.
4. `bench.py --compare` — check the query count has not risen.
5. Re-run `ux-money.mjs` and `ux-account.mjs`, which touch these screens.
6. Then module 2.

### One TODO below turned out to be wrong

"Try again must resume the order, not start a second one" — the backend already
handles this, deliberately, with the reason written down: a *failed* order gets
its own record because that history is what you need when somebody disputes a
charge. The fix belonged on the frontend, and that is where it went.

---

## Backend

- [ ] **Goals** — no endpoint exists at all. `earning_goals`: label, target in
      minor units, month. Progress computed from the ledger, never stored.
- [ ] **`/me/bookings/{id}/cancel`** — verify it frees the slot and notifies
      whoever was holding it.
- [ ] **Order retry** — `/payments/orders` currently creates a *new* order for a
      failed one. It should resume the existing one, or say why it cannot.
- [ ] **`/wallet/insights` needs a goal** — it returns `goal: null` because
      nothing stores one. Wire it once goals exist.
- [ ] **Rename `/wallet/support`** → `/wallet/fee-help`. It means *asking us for
      help paying*, and it currently collides with the schemes screen.
- [ ] **One `/money/overview`** — Earn opens with four requests (wallet,
      insights, payout accounts, goal). One endpoint, `gather`ed, one round trip.

## Frontend — screen by screen

| Screen | To do |
|---|---|
| `/wallet` | Filter chips should not re-render the list; virtualise the ledger past ~50 rows |
| `/wallet/withdraw` | Done — verify the empty-accounts path end to end |
| `/wallet/statement` | Month tabs currently show the same data for every month; make the range real |
| `/payments` | "Try again" must resume the order, not start a second one |
| `/checkout/[orderId]` | Confirm must carry the idempotency key the API already honours |
| `/settings/payments` | Done |
| `/support-fund` | "How to apply" / "Track it" reach the detail; the detail's state must persist |
| `/support-fund/[id]` | "Start the application" and "Withdraw" only set local state — call `/reference/{id}/mark` |
| `/cover` | "I have this" must persist through the same mark endpoint |
| `/bookings` | **Cancel must reach the server.** Optimistic, with a refetch on failure |
| `/bookings/[id]` | Same, plus Receipt should print the real order |
| `/progress/goals` | Entirely local. Needs the new endpoint, and progress from the ledger |

## Reusable, global scope

Everything below is built once in `components/ux/kit` and used by every module
after this one.

- [ ] **`useAction`** — the write counterpart to `useResource`. Optimistic
      update, rollback on failure, a named error, and a busy flag. Every
      "cancel / join / apply / mark" button in the app is the same shape, and
      six screens have hand-rolled it slightly differently.
- [ ] **`<Money>`** — one component that renders an amount. Minor units in,
      formatted once. Eleven screens format rupees eleven ways today.
- [ ] **`<ConfirmButton>`** — press, confirm in place, act. `/bookings` and
      `/bookings/[id]` each hand-roll this with different wording.
- [ ] **`<Rows>`** — a list that virtualises past a threshold, so a woman with
      four hundred transactions does not render four hundred nodes.

## Performance

**Backend**

- [ ] One `/money/overview` instead of four requests
- [ ] Projections on the ledger read — the list needs six fields, not the document
- [ ] Index check: every money query explained, and any collection scan fixed
- [ ] Cache nothing per-person; the shared halves (schemes, cover) already are

**Frontend**

- [ ] Virtualise the ledger and the payments list
- [ ] `React.memo` the row components — a filter change re-renders every row today
- [ ] Route-level prefetch for Withdraw from Earn: it is the next tap
- [ ] No layout shift when the balance arrives — reserve its height

## Done means

- [ ] Every button on all twelve screens either navigates, calls the API, or is
      a dialog toggle. Nothing changes only local state that the server should know.
- [ ] `checks/ux-money.mjs` extended to press each one and assert the server saw it
- [ ] `bench.py` query count for the money endpoints does not rise
- [ ] Both themes, no contrast or hit-target failures

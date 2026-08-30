# Backend wiring — what is live, and what has no server behind it

Measured against the running API's own OpenAPI document, not against memory.
Re-check with `curl -s localhost:8020/openapi.json`.

## How a screen reads data now

Every wired screen goes through **one hook**, `useResource`
(`src/lib/use-resource.ts`), and it does three things no screen should repeat:

1. **Falls back to the mock rather than to nothing.** A module whose endpoint
   does not exist keeps working exactly as it did.
2. **Never leaves her on a spinner.** The fallback renders from the first frame
   and is replaced when the real data lands.
3. **Cancels on unmount**, so a reply never arrives at a component that is gone.

Whenever the fallback is showing, `<SourceNote>` says so on the screen:

> These are example figures, not yours. We could not reach WomSakhi just now.

That line matters most on the money screens. An unlabelled fallback there is
not graceful degradation — it is a lie about her balance.

## Wired — every screen

**31 of 31 member screens read the server. Measured in a browser: zero fell back
to a fixture, zero threw.**

| Module | Endpoint |
|---|---|
| Today · Your journey · Notifications | `/me/summary`, `/me/progress`, `/me/notifications` |
| Her name, photo, unread count (every screen) | the session + `/me/unread` |
| Find work · Applications | `/growth/opportunities`, `/growth/applications` |
| Events + detail | `/growth/events` |
| Courses + course + lesson | `/me/programs`, `/catalog/programs` |
| Mentors + detail + her sessions | `/growth/mentors`, `/growth/mentors/requests/mine` |
| Circles + detail + pay | `/community/circles`, `…/posts` |
| Sakhi Local + story | `/community/stories` |
| Her business + order/product/service | `/shop/*` |
| Skill exchange + thread | `/exchange/swaps`, `/exchange/threads` |
| Earn · Statement · Withdraw | `/wallet`, `/wallet/insights`, `/me/payout/*` |
| Payments · Checkout · Payment methods | `/payments/orders`, `/me/payout/accounts` |
| Schemes · Cover · the four Wellbeing topics | `/schemes`, `/cover`, `/wellbeing/*` |
| Buying together · Prove your skills · Using a phone | `/group-buy`, `/assess`, `/digital` |
| Saved · Search · Explore | `/saved`, `/search`, assembled from the modules that own each record |
| Certificates · Your papers · Profile · Refer | `/me/certificates`, `/me/documents`, `/me/profile`, `/me/referrals` |
| Sakhi | `/sakhi/*` — was already live |

### What the adapters refuse to invent

The rule throughout: a field the API does not carry is **derived, or defaulted
to the unflattering answer** — never made up.

- **A route's safety after dark** is three-valued. `null` means nobody has
  checked, and the screen says so. Defaulting an unknown to "fine after dark"
  is the one fabrication in this app that could get a woman hurt, because she
  plans a journey home around it.
- **A job is not "verified"** and has no match score. Both would be badges that
  persuade her to trust a stranger on nothing.
- **A mentor session** is a *request* until somebody accepts it, and the screen
  shows the time she asked for rather than a time nobody confirmed.
- **A scheme's eligibility** is not asserted. Whether she qualifies depends on
  her papers and her business; claiming it sends her to a counter to be turned
  away.
- **A health check's last date** is "Never" unless she marked it done.
- **What she earned at a past mela** is not shown at all — the takings went into
  her hand, not through us.
- **`avgReply` on the Work rail is gone.** The server records when she applied,
  not when anyone replied, so there was no honest average to print.
- **A circle's turn order** is not rendered. A savings circle is a financial
  commitment between real women; an invented turn order has somebody expecting
  a payout nobody agreed to.
- **Repeat buyers, response rate, skill demand and the twelve-month trend** are
  all *computed from her own records* rather than stored — so they cannot drift
  from the list sitting beside them.

### Two classes of bug this pass produced, and how they were caught

**Stale memos.** A screen that filtered a module constant kept a `useMemo`
without it in the deps. Once the constant became hook state, the filtered view
was computed once from the fallback and never again — Mentors showed six of
twenty-four until a filter happened to change. `react-hooks/exhaustive-deps`
finds every instance.

**Reading the clock during render.** Events split upcoming from past with
`Date.now()` in the component body, which makes the same props produce
different output. Moved into the fetcher, where time is allowed to move.

## A naming collision worth fixing

The backend's **`/wallet/support`** is *asking WomSakhi for help paying*.
The screen at **`/app/support-fund`** is *government schemes*. Two different
things sharing a word. Rename one before they get wired to each other.

## What is still not real

Downloads produce genuine files now — the statement and every receipt and
certificate print through the browser's own dialogue, and the statement also
writes a real CSV. What they carry is still the mock's reference numbers on any
module that is not yet wired.

The one honest exception is the document vault: the *scan* of her Aadhaar lives
on a server this app cannot reach, so "Print its record" prints the **record**
— what we hold, when it was checked, where it is used — and says on the page
that it is not a copy of the paper itself.

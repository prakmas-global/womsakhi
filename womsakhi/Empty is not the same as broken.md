---
status: stable
updated: 2026-08-17
tags: [idea, ux, errors]
---

# Empty is not the same as broken

An audit found **97 catch blocks that swallow their error** and 60 screens that
track an error variable but never render it. Exactly one screen in the whole app
showed an error state.

The consequence is worse than a missing message. When a request failed, a list
screen caught it, fell through to its empty state, and told the user:

> **No members yet** · Showing 0 to 0 of 0 users

Every stat read **0**. Nothing looked broken, so nobody reported it — the screen
was confidently, quietly wrong.

## The rule

**A failed request must never be indistinguishable from an empty one.**

Those are different facts and they need different words. "There is nothing here"
is information. "We could not reach the server" is a problem with an action.
Rendering the first when the second is true is not an omission, it is a false
statement the interface makes on its own.

## Why it is fixed centrally

Per-screen handling means editing 87 files and remembering forever. An axios
interceptor records every failure and `<ConnectionBanner>` reports it — once, at
the root, covering both apps and every screen written from here on.

Per-screen `ErrorState` still matters where a retry can be scoped to one list.
The banner is the floor, not the ceiling.

## What it deliberately does not do

- **Not a toast.** A toast is for something that happened and is over. This is a
  *state*: the data on screen is stale until something changes.
- **Not a modal.** Whatever loaded before the failure is still worth reading.
- **Not shown for 401** — that means signed out, and the app already redirects.
- **Not shown for 404** — usually "this was deleted", which the screen should
  explain in context.

## Empty states need a way forward

"No services match your filters" and "No services yet" are different situations:
one wants the filter cleared, the other wants a way to create the first. Fourteen
screens rendered a bare sentence with neither. `NoResults` takes `filtered` and
offers the right one.

## Loading states need a shape

"Loading services…" in a merged cell is honest but shapeless — the table has no
height until data lands, so the page jumps and the eye loses its place.
`SkeletonRows` holds the space in the right columns.

Related: [[Adapt, never crop]], [[Testing]]

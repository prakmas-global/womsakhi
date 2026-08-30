---
status: stable
updated: 2026-08-18
tags: [idea, ux, feedback]
---

# Say it once, in one place

**66 files each kept their own `saved` boolean and their own
`setTimeout(() => setSaved(false), 2500)`.**

Every one picked its own duration, its own wording, its own position on the
page. Most did not clear the timer on unmount. And each one made its own
private decision about the question that actually matters:

> Is a failure worth mentioning?

Several answered no.

## What that cost, concretely

**`/dashboard/users`** — resetting a member's password wrote its result into
`resetNote`, which rendered in a **green** box. The failure path wrote to the
same variable. So a reset that failed was reported to the admin in the colour
reserved for success.

**`/dashboard/settings`** — a save failure called `setErrorKey(key)`, the *same*
flag the empty-field check uses. A network error therefore told the admin
**"Platform Name is required."** about a field that was filled in. The
interface blamed her for the server's problem.

**`/dashboard/settings/roles`** — `permSaved` was set on every successful save
and rendered *nowhere*. Saving permissions gave no feedback of any kind.

None of these are exotic. They are what happens when 66 places each solve the
same problem alone.

## The rule that decides which channel

A **toast** reports something that happened and is over: saved, sent, deleted.

It is the wrong shape for two other things, and using it for them is a
regression, not a migration:

- **Form validation** stays next to its field. A message that names a field and
  then disappears before you reach it is worse than no message — you now know
  something is wrong and have lost the only clue about where.
- **A failed load** is a *state*, not an event. The data is still missing after
  the toast fades. That is [[Empty is not the same as broken]]'s job.

## What survived the migration

Not every in-place flag was wrong. A copy button whose icon turns into a tick
puts the feedback exactly where the action was — better than a message in the
far corner. Same for the tick beside each of the nine Save rows in platform
settings.

What made those wrong was being **silent**: the icon swap announces nothing, so
a screen-reader user pressing Copy got no confirmation at all.

So the rule is not *"no local flags"*. It is **nothing happens unannounced** —
and the check enforces exactly that, allowing a timer flag when a toast fires
alongside it. See [[A label that points at nothing]].

## Two details that carry the design

**Hover and focus hold the toast.** Reaching for Undo must not be a race
against the timer — and by keyboard it is a race you lose, because tabbing to
the button takes longer than the toast lives. Toasts carrying an action also
start at nine seconds rather than four.

**The live region is mounted permanently, even when empty.** A region added to
the page at the same moment as its content is often missed entirely: the screen
reader has nothing to notice a change against. It has to be there first.

## Undo is only offered where it is true

Publishing is reversible — the row exists either way — so Undo can be honest.
Deleting is not, so it gets a confirmation dialog instead.

A toast saying "Undo" beside something that cannot be undone is a promise the
interface does not keep, which is worse than not offering it at all.


## The failure nobody sees

Beyond the flags, an audit found **70 `catch` blocks in action paths that do
nothing at all**. Not loads — actions. Things somebody pressed a button to do:

```
billing        savePlan · cancelSubscription · savePayment · handleAutoPay
sessions       confirmSignOut · confirmRevokeAll
integrations   connect · syncNow · confirmDisconnect
messages       sendComposer · attachFile · submitBroadcast
```

Press **Cancel subscription**, have the request fail, and the screen says
nothing. There is no way to tell a failure from a dead button.

A load failure is covered — [[Empty is not the same as broken]] put a banner at
the root for exactly that. An action failure is not: the banner can say a
request failed, but only the screen knows *which action* did not happen.

## Silence is sometimes right, but it has to be argued

Of the 70, twenty-four had a comment. Reading them one at a time separated two
kinds.

**Reasons that hold**, and stay silent:

| where | why |
| --- | --- |
| `signOut` | the session is gone locally either way |
| `copy` | clipboard blocked in some in-app browsers — the value is on screen |
| booking `confirm` | the booking already succeeded; the failure is in a follow-up step |
| notifications `open` | the badge corrects itself on next load |
| `router.prefetch` | a performance hint; failing is invisible and harmless |

**A reason that does not hold:** `"keep the modal open"`, written on four
billing handlers. It explains the *control flow*, not why the user should be
kept in the dark. A subscription cancellation that fails leaves her looking at
an open dialog with no idea whether it worked.

The distinction is the point: silence is a legitimate choice, but it has to be
a choice, with the argument written down where the next person can check it.

## Machine-written copy is not copy

Deriving each message from its function name produced *"Could not new
message"*, *"Could not form"*, *"Could not mutate status"*, *"Could not auto
pay"*.

This is text a person reads at the moment something has gone wrong — the worst
moment to hand her generated English. All 61 messages are written by hand,
keyed by **file and function**, because `submitForm` exists in four files and
means something different in each. The transform refuses to run if any site
lacks written copy rather than falling back to a guess.

Related: [[Empty is not the same as broken]], [[Cannot trap yourself]], [[The check that runs in a second]]

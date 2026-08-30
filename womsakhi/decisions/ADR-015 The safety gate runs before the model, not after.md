---
status: accepted
updated: 2026-08-22
tags: [adr, ai, safety]
---

# ADR-015 — The safety gate runs before the model, not after

**Status:** accepted · **Code:** `core/sakhi/safety.py`, `core/sakhi/engine.py`

## Decision

Every message a member sends is screened **before any request is made to any
model**. When the gate fires, no model is called at all. She is shown a fixed
reply written by a person, plus real numbers from the same hardcoded list the
[[Safety]] screen uses, and a human is told.

The order in `engine.respond()` is fixed:

```
safety gate  ->  budget check  ->  model  ->  tools  ->  answer
```

## Why before, and not as a filter on the way out

Screening the *answer* means the model has already decided what to say to a
woman in danger. At that point the only remaining choice is whether to show it —
and something has to judge, in the moment, whether a generated reply was good
enough. That is a judgement no one should be making at request time.

Screening the *question* means the situation never reaches the model. There is
nothing to evaluate and nothing to suppress, because nothing was generated.

It is also faster, and that is not a small point: an API call is seconds, and
these are the seconds that matter most.

## Why the reply is a fixed string

Nothing in that reply is generated, which means nothing in it can be
hallucinated, jailbroken, or reworded into something softer on a bad day. The
numbers come from the same constant the Safety screen renders — so a number can
never be right in one place and stale in the other.

From [[Sakhi]]: *she is not a safety feature.* An assistant must never sit
between a woman in distress and a real number.

## It is tuned to over-fire

A false positive costs one extra tap past a helpline she did not need. A false
negative costs something this project is not willing to risk. When the two
errors are that unequal, the threshold does not belong in the middle.

Matching is on **phrases, not words** — `"hit"` matches "I hit my sales target",
`"he hits me"` does not. Checked against exactly those cases.

## What it does not cover

English, Hindi (Devanagari and Latin script) and Urdu — the three languages
[[Internationalisation]] actually delivers. **A phrase in one of the twelve
registered-but-untranslated languages will not match.** That is a real gap, and
it is in [[Known issues]] rather than assumed away.

## The reply is never replayed to the model

Safety turns are stored with `kind="safety"` and excluded from
`SakhiMessageModel.REPLAYED`. She sees them in her transcript; the model never
does. Feeding a person's carefully written crisis reply back as conversation
history would teach the model to imitate it — which is the one thing it must
not do.

Related: [[Safety]], [[Sakhi]], [[ADR-014 An assistant may propose a change, never make one]]

---
status: accepted
updated: 2026-08-22
supersedes: the translation rule in ADR-006
tags: [adr, i18n, safety]
---

# ADR-016 — Languages ship on machine verification; review is tracked separately

**Status:** accepted · **Code:** `src/i18n/locales.ts`, `checks/i18n.mjs`

## What changed

[[ADR-006 Language lives on the account]] carried a rule: *machine-translated
strings should never reach real users without a native speaker reading them
first.* Under it, 15 of 18 registered languages showed "coming soon" and fell
back to English.

**That rule is superseded.** Language is the feature this product is for — a
woman who reads Tamil and not English is the person WomSakhi exists to reach,
and holding a finished translation until a reviewer is found meant she got
English indefinitely. Waiting was not the safe option; it was the invisible one.

## The bar a language must clear

The old rule guarded against a real failure: a language that *appears* to work
while quietly showing English, or empty boxes. That failure is now caught
mechanically, before a catalogue is allowed to exist. Every one is checked for:

- **all 327 keys present** — a gap renders an English sentence mid-screen
- **every `{placeholder}` preserved exactly** — a lost `{name}` leaves a hole in
  the sentence; a renamed one crashes the formatter
- **text genuinely in its own script**, not English passed through — the failure
  nobody can see coming, because the switch appears to work
- **actually different from English**

A catalogue failing any of these is **rejected, not shipped**. `checks/i18n.mjs`
then drives a real browser per language and confirms it renders: correct `lang`,
correct `dir`, text in the right script, and a font that can actually draw it.

## Two flags, and they are not the same switch

`translated` decides whether she can pick it. `reviewed` records whether a human
who speaks it has read the file. Folding them together is what forced the old
all-or-nothing choice.

`reviewed: false` is not a warning that the language is broken — it is an
honest record of what has and has not been checked by a person. Do not set it
true because a translation looks fine.

## What this does not prove, and what it cost

Machine verification proves a language is complete, correctly scripted and
structurally sound. **It does not prove a sentence reads naturally**, or that a
phrase carries the right weight in context. Those are the reasons a native
reader still matters, and the [[Safety]] and [[Money]] strings are where their
time should go first.

The accepted risk is a clumsy sentence. The rejected risk was a woman reading
English because we were waiting for a reviewer who never arrived.

## The gap this opened, and closed

Adding 14 languages created a safety hole immediately: Sakhi's distress gate
only recognised English, Hindi and Urdu, so a woman writing
*"என் கணவர் என்னை அடிக்கிறார்"* would have tripped nothing — no helpline, message
straight to the model. The phrase lists now cover every shipped language, and
that was done in the same pass, not after. A language rollout that outruns its
own safety net is worse than no rollout.

Two things that only surfaced by testing it:
- Tamil puts the object between subject and verb, so `"கணவர் அடிக்கிறார்"`
  never matched a real sentence. Match the verb phrase, not the pair.
- The habitual form ("he beats me") belongs in `abuse`; only the acute forms
  ("save me", "he will kill me") belong in `immediate_danger`. Two languages had
  it in the wrong bucket and out-matched the right one, because the urgent list
  is tested first.

Related: [[ADR-006 Language lives on the account]], [[Internationalisation]],
[[ADR-015 The safety gate runs before the model, not after]]

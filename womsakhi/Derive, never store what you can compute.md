---
status: stable
updated: 2026-08-15
tags: [idea, theming]
---

# Derive, never store what you can compute

Two bugs, same root cause, worth stating as a rule.

**Category colours went pink under an amber theme.** Seeded category rows had a
literal hex in the database. Rendering preferred the stored value over the
derived one, so nine categories stayed brand-pink while the rest of the app
turned amber. Fix: always derive from the name, ignore the stored colour.

**Service icons duplicated.** Icons were chosen from the service *type*, so
"Beauty & Makeup" and "Mehndi Design" — both type `beauty` — both rendered
Sparkles. A list of twelve services showed four distinct icons. Fix:
`icon_for_service(name, type)`, matching name keywords first and falling back to
type.

The rule: **if a value is a pure function of other values, compute it.** Storing
it creates a second source of truth that starts correct and drifts. The stored
copy is always the one that's wrong, and it wins, because reads prefer it.

Store it only when the derivation is expensive or when a human has deliberately
overridden it. Neither applied here.

Corollary for [[Theme engine]]: dark mode is derived from the same seed as
light, not chosen separately. A user picks one colour, not two. Ask for two and
half of them will pick a pair that doesn't work.

Related: [[Tokens reference variables, so themes are free]], [[Community]]

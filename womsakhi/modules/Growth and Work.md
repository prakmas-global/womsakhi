---
status: stable
updated: 2026-08-15
tags: [module]
---

# Growth and Work

**Code:** `app/routes/growth.py`, `app/routes/admin_growth.py`, `app/models/growth.py`

Events, mentors, opportunities, applications. The route from "learned a skill"
to "earning from it" — arguably the point of the whole platform.

## Applications

Withdraw used to promise *"you can apply again later"* and the API returned
`409` forever. The screen said one thing and the system did another.

Fixed by making the API match the promise. Worth recording the general rule:
**when copy and behaviour disagree, the copy is usually the correct
specification.** Someone wrote that sentence because it's what a person would
reasonably expect. Changing the sentence to match a restrictive API is fixing
the symptom.

## Service icons are name-first

`icon_for_service(name, type)` matches keywords in the name before falling back
to type. Type-derived icons gave "Beauty & Makeup" and "Mehndi Design" the same
Sparkles glyph. See [[Derive, never store what you can compute]].

Related: [[Member app]], [[Community]]

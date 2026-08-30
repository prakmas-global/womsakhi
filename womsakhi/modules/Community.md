---
status: stable
updated: 2026-08-15
tags: [module]
---

# Community

**Code:** `app/routes/community.py`, `app/routes/admin_community.py`

Circles, the conversations in them, and success stories.

## Access rules

- Author comes from the token — [[ADR-007 Ownership comes from the token]]
- A member edits and deletes only her own posts
- **Joining a circle is the only thing that grants read access to a private
  one.** Not a role, not a permission, not staff status by default.

## Moderation hides, never deletes

`hidden: true`. Full reasoning in [[ADR-005 Moderation hides, never deletes]].

The rule that gets broken by new code: **every member-facing query must filter
`hidden`.** A new endpoint that forgets it leaks moderated content straight back
into the feed. Check this on any new read path.

## Category colours are derived

Categories get colours from the [[Theme engine]]'s categorical palette by
hashing the name, never from a stored hex. Storing them caused categories to
stay brand-pink under an amber theme —
[[Derive, never store what you can compute]].

Related: [[Member app]], [[Safety]]

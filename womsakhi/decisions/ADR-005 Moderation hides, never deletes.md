---
status: accepted
updated: 2026-08-15
tags: [adr, community, moderation]
---

# ADR-005 — Moderation hides, never deletes

**Status:** accepted · **Code:** `app/routes/community.py`, `app/routes/admin_community.py`

## Decision

Staff moderation sets `hidden: true`. It never removes the document. Hidden
posts vanish from every member-facing query; the record survives.

## Why

**The report needs its evidence.** A post is usually hidden *because* someone
reported it. Deleting the post destroys the thing the report is about, which
makes the report impossible to review and impossible to appeal.

**Moderation is reversible; deletion isn't.** Staff act fast on safety, which
means they sometimes act wrong. `toggle_hidden` restores in one click. There is
no undo for a deleted document.

**Patterns need history.** "This member has had four posts hidden" is a
meaningful signal. It doesn't exist if the posts are gone.

## Consequences

- **Every member-facing query must filter `hidden`.** This is the rule that gets
  broken — a new endpoint that forgets the filter leaks moderated content back
  into the feed. Check it on any new read path.
- The author is notified when her post is hidden. Silent moderation makes people
  think the product is broken rather than that they broke a rule.
- Members deleting their *own* posts is a different action and does delete.
  Hiding is a staff action; self-deletion is hers.

Related: [[Community]], [[ADR-003 Anonymous reports still identify the reporter]]

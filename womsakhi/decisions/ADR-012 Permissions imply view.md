---
status: accepted
updated: 2026-08-15
tags: [adr, permissions]
---

# ADR-012 — Holding an action implies holding view

**Status:** accepted · **Code:** `app/core/permissions.py`

## Decision

Granting `users.edit` automatically grants `users.view`. The implied permission
is added when a role is saved:

```python
view = f"{module}.{VIEW}"
if view in valid:
    kept.add(view)
```

## Why

`users.edit` without `users.view` is a role that can change a member's details
but cannot open her record. It is never what anyone meant. It is always a
mis-click in a checkbox grid with 62 entries.

Two ways to handle a state that's always a mistake: reject it with an error, or
make it impossible. Rejecting means an admin ticks a box, saves, gets told off,
and hunts for which of 62 checkboxes upset it. Implying means it just works.

Permission grids are used rarely and under pressure. Optimise for the person who
opens it twice a year.

## Consequences

- The saved permission set may be **larger** than what was ticked. The UI shows
  implied permissions as checked-and-disabled, so nobody thinks the save
  silently ignored them.
- Unknown permission strings are **dropped** on save, not stored. A renamed
  permission doesn't linger as a dead grant.
- Implication only ever *adds* `view`. It does not chain — `users.delete` does
  not imply `users.edit`. Deleting and editing are genuinely different
  authorities.

## Route ordering trap

`/roles/me/permissions` was being shadowed by `/roles/{role_id}/permissions`,
so `me` was parsed as a role id. FastAPI matches in registration order —
**literal routes must be registered before parameterised ones**. Easy to
reintroduce by adding a route in the wrong place in the file.

Related: [[Permissions and Roles]], [[ADR-007 Ownership comes from the token]]

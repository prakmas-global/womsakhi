---
status: stable
updated: 2026-08-15
tags: [module, security]
---

# Permissions and Roles

**Code:** `app/core/permissions.py`, `app/core/rbac.py`, `app/routes/roles.py`,
`components/admin/RolePermissionPanel.tsx`

**62 permissions**, `module.action`. Enforced by `require_permission()` on the
route, not by checking a role name.

## Two layers

1. **Audience** — `member` → `/app`, `staff` → `/dashboard`. Enforced in
   `proxy.ts` and again per route. This is the wall.
2. **Permission** — what a staff member can do inside the wall.

Role names are a *label on a permission set*, never a thing to branch on. Code
that reads `if role == "supervisor"` is a bug waiting for the day someone
creates a second supervisor-like role.

Reasoning: [[Two apps, one backend]].

## Implication

Holding `users.edit` grants `users.view` automatically — see
[[ADR-012 Permissions imply view]], which also documents the route-ordering trap
that made `/roles/me/permissions` unreachable.

## Circular import, for when it happens again

Adding `require_active_member` to `deps.py` created `rbac ↔ deps`. Resolved by
putting it in `rbac.py`, which already imports `deps`.

General shape: **the more specific module imports the more general one, never
both ways.** `deps` is general. `rbac` is specific. Guards live in `rbac`.

## The bug that mattered

`POST/PATCH/DELETE /roles` had no guard. A restricted account created a role and
got `201` — trivially escalating to every permission in the system. Now
super-admin only.

Found by [[Testing]] as an under-privileged user. An admin token would have
passed, which is the whole argument for testing as the least privileged user.

Related: [[ADR-007 Ownership comes from the token]], [[Admin dashboard]]

---
status: living
updated: 2026-08-15
tags: [reference]
---

# API surface

FastAPI. Routers in `app/routes/`, registered in `main.py`.

**The live docs at `http://localhost:8000/docs` are better than any list here**
and cannot go stale. Use them for payload shapes.

## Routers

```
auth  me  users  members  verification  roles  staff_account
programs  enrollment  catalog  services  appointments  calendar
community  admin_community  growth  admin_growth  safety  admin_safety
payments  wallet  billing  analytics  dashboard  reports  segments
messages  conversation  notifications  feedback  content  uploads
settings_platform  settings_security  backups  theme  layout  ai
```

`admin_*` routers are the staff-side counterpart to a member router. That naming
is the boundary: if you're adding a staff endpoint, it belongs in an `admin_*`
file behind a [[Permissions and Roles|permission]], not as a role-conditional
branch inside the member router.

## Rules for every new endpoint

1. **Member endpoints derive the owner from the token.** Staff endpoints declare
   a target and check a permission.
   [[ADR-007 Ownership comes from the token]]
2. **Register literal routes before parameterised ones.** `/roles/me/…` before
   `/roles/{id}/…`, or `me` gets parsed as an id.
   [[ADR-012 Permissions imply view]]
3. **Member-facing reads filter `hidden`.**
   [[ADR-005 Moderation hides, never deletes]]
4. **`request: Request` cannot follow defaulted parameters.** Python syntax, not
   a FastAPI quirk. Adding it to an existing signature means reordering
   everything after it, which is why the audit log records no IP — the change
   wasn't worth touching every signature for.

Related: [[Data model]], [[Running locally]]

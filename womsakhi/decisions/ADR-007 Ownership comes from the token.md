---
status: accepted
updated: 2026-08-15
tags: [adr, security, auth]
---

# ADR-007 — Ownership comes from the token, never the request

**Status:** accepted · **applies to:** every write endpoint

## Decision

Any endpoint that writes a row belonging to someone takes the owner from the
authenticated token. It never reads an owner out of the request body or path,
even when the client "obviously" knows it.

```python
doc = {"user_id": me["id"], ...}   # yes
doc = {"user_id": body.user_id, ...}  # never
```

## Why

This is the single most common way multi-tenant apps leak. If `user_id` arrives
in the body, then the API's real contract is "write anything to anyone's
account, and please be nice about it". Client-side validation isn't validation —
the request is one `curl` away from being anything.

It is also the cheapest rule in the codebase to follow, which is why there's no
excuse for exceptions. The token is already parsed. The user is already loaded.
Taking the id from a different place is *more* typing.

## The staff exception, and its guard

Staff endpoints do act on other people's rows — that's the job. Those take the
target id from the path, and they are guarded by a
[[Permissions and Roles|permission check]], not by a role name and not by hope.

The split is: **member endpoints derive the owner, staff endpoints declare the
target and check permission.** If a member endpoint ever accepts a target id,
that's the bug.

## What testing found

`POST/PATCH/DELETE /roles` had **no guard at all**. A deliberately
under-privileged test account created a role and got a `201`. Escalating from
there to any permission in the system is trivial.

It now requires super-admin. Worth noting how it was found: not by reading the
code, but by a test that logged in as a restricted user and tried everything.
See [[Testing]].

Related: [[Two apps, one backend]], [[ADR-012 Permissions imply view]]

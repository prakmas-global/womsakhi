---
status: accepted
updated: 2026-08-15
tags: [adr, security, privacy, verification]
---

# ADR-011 — ID documents are never publicly reachable

**Status:** accepted · non-negotiable

## Decision

Uploaded identity documents are never served from a public URL. They are
**streamed to authenticated staff holding the verification permission**, and
every view is written to an audit log.

No public path. No signed URL that outlives the request. No "unguessable"
filename.

## Why

Members upload government ID to get verified. That is the most sensitive data in
the system, belonging to the population least able to absorb the consequences of
a leak. On a women-only platform, an ID document leak is not a compliance
incident — it can be a physical safety incident.

"Unguessable URL" is not access control. It's an access control that fails
permanently and silently the first time a URL is logged, proxied, shared, or
indexed.

## The audit log is the point

Streaming to authenticated staff stops outsiders. The audit log is what handles
the insider case: a staff member browsing IDs out of curiosity leaves a trail
with a name and a timestamp. Knowing that the trail exists is most of the
deterrent.

## Consequences

- No `<img src>` to a document path. Views go through the streaming endpoint.
- Backups containing documents inherit the same restriction — see
  [[Backup and Restore]].
- Related to but stricter than [[ADR-007 Ownership comes from the token]]: here,
  even the *owner* fetching her own document goes through the same guarded path.

Related: [[Safety]], [[Secrets]]

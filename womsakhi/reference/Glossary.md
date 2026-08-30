---
status: living
updated: 2026-08-15
tags: [reference]
---

# Glossary

Words this project uses in a specific way.

**Audience** — `member` or `staff`. The token field that decides which app you
land in. Coarser and more important than a role.
[[Two apps, one backend]]

**Breakpoint** — `mobile` | `tablet` | `desktop`. Layout stores a separate value
per breakpoint. [[Fractions not pixels]]

**Committed vs preview** — a committed theme is saved; a preview is what you're
currently looking at while dragging. Confusing them caused the picker bug.
[[Theme engine]]

**Entitlement** — account tier: `free`, `pro`, `org`. Everything personal is
`free`. [[ADR-001 Everything personal is free]]

**Grant** — an approved support-fund request. Writing the credit *is* the
approval. [[ADR-004 Approving a grant is the ledger entry]]

**Hidden** — moderated, not deleted. Invisible to members, intact in the
database. [[ADR-005 Moderation hides, never deletes]]

**Minor units** — integer paise. `49950` is ₹499.50.
[[ADR-008 Money is stored in minor units]]

**Permission** — `module.action`, 62 of them. Checked per route. Not a role.
[[Permissions and Roles]]

**Sakhi** — friend, companion. The planned assistant. [[Sakhi]]

**Scale** — the 11 steps generated from one seed colour, `50` through `950`.
[[Theme engine]]

**Seed** — the single hex a user picks. Everything else is derived from it.

**Slot** — a category's colour index, 1–8, from hashing its name.
[[Derive, never store what you can compute]]

**WomSakhi** — current name. Was WomenCrafts. Old name still appears in
directory names (`womencrafts-backend`, `womencrafts-frontend`) and package
names; that's cosmetic and hasn't been worth a rename.

---
status: living
updated: 2026-08-22
tags: [moc]
---

# WomSakhi

A women-only platform. Verified members learn skills, find paid work, and reach
help quickly. Two front-ends, one FastAPI backend, one MongoDB.

- **Member app** `/app` — phone-first. This is the product.
- **Staff dashboard** `/dashboard` — desktop-first. This is how it gets run.

They share auth but not layout, not navigation, and not tone. See
[[Two apps, one backend]] for why they were never merged.

---

## If you read three notes, read these

1. [[ADR-001 Everything personal is free]] — where money comes from, and why
   not from members. The decision most likely to be forgotten.
2. [[Theme engine]] — how one variable swap recolours the entire app.
3. [[ADR-007 Ownership comes from the token]] — the rule that keeps one
   member's data out of another's account.

---

## Big ideas

Notes that explain a mechanism you can't infer from any single file.

- [[Tokens reference variables, so themes are free]]
- [[Fractions not pixels]]
- [[Clamp on read, not on write]]
- [[Adapt, never crop]]
- [[Empty is not the same as broken]]
- [[Say it once, in one place]]
- [[A label that points at nothing]]
- [[Where am I]]
- [[The check that runs in a second]]
- [[Cannot trap yourself]]
- [[Derive, never store what you can compute]]
- [[Two apps, one backend]]
- [[The support fund is why this is not a marketplace]]

## Decisions

Append-only. Each one records what was tried and what broke.

| # | Decision |
|---|---|
| 001 | [[ADR-001 Everything personal is free]] |
| 002 | [[ADR-002 Theme via CSS variables, not classes]] |
| 003 | [[ADR-003 Anonymous reports still identify the reporter]] |
| 004 | [[ADR-004 Approving a grant is the ledger entry]] |
| 005 | [[ADR-005 Moderation hides, never deletes]] |
| 006 | [[ADR-006 Language lives on the account]] |
| 007 | [[ADR-007 Ownership comes from the token]] |
| 008 | [[ADR-008 Money is stored in minor units]] |
| 009 | [[ADR-009 Layout stores fractions per breakpoint]] |
| 010 | [[ADR-010 No emoji in the interface]] |
| 011 | [[ADR-011 ID documents are never publicly reachable]] |
| 012 | [[ADR-012 Permissions imply view]] |
| 013 | [[ADR-013 Colour only ever comes from a token]] |
| 014 | [[ADR-014 An assistant may propose a change, never make one]] |
| 015 | [[ADR-015 The safety gate runs before the model, not after]] |
| 016 | [[ADR-016 Languages ship on machine verification, review is tracked separately]] |

## Modules

- [[Member app]] · [[Admin dashboard]]
- [[Safety]] — helplines, alerts, reports, trusted contacts
- [[Community]] — circles, posts, stories
- [[Growth and Work]] — events, mentors, opportunities, applications
- [[Money]] — payments, wallet, support fund
- [[Permissions and Roles]] · [[Onboarding]] · [[Internationalisation]]
- [[Backup and Restore]]
- [[Sakhi]] — the assistant

## Engines

Self-contained subsystems. No app imports, liftable into another project.

- [[Theme engine]] · [[Layout engine]] · [[Entitlements]]
- [[useContainerSize]] — how a component measures itself

## Operations

- [[Running locally]] · [[Demo accounts]] · [[Seeding]] · [[Testing]] · [[Secrets]]
- [[Known issues]]

## Reference

- [[Data model]] · [[API surface]] · [[Third-party services]] · [[Glossary]]

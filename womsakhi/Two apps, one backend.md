---
status: stable
updated: 2026-08-15
tags: [idea, architecture]
---

# Two apps, one backend

`/app` is for members. `/dashboard` is for staff. Same Next.js project, same
FastAPI, deliberately not the same interface.

The temptation is to build one app and hide things by role. It's less code. It
is also wrong here, and the reasons are worth writing down because "just use
role flags" will look attractive again in six months.

**Different device.** Members are on a phone, one-handed, often on a slow
connection. Staff are on a desktop with a lot of rows on screen. That's not a
responsive breakpoint, it's a different information density.

**Different tone.** A member sees "Get help now". Staff see "Open safety
alerts — 3 unassigned". Same underlying row. Wording that works for one is
alarming or bureaucratic for the other.

**Different failure mode.** A member seeing a staff control is a security
incident. A staff member seeing a member control is a confusing afternoon. When
the failure modes are that asymmetric, you want a wall, not a conditional.

The wall is the **audience split** in the token: `member` lands on `/app`,
`staff` on `/dashboard`, enforced server-side in `proxy.ts` and again on every
route. Role checks are the second layer, not the first.

See [[Permissions and Roles]] for what happens inside the staff wall, and
[[ADR-007 Ownership comes from the token]] for the rule underneath both.

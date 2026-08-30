---
status: stable
updated: 2026-08-15
tags: [module]
---

# Admin dashboard

**Route:** `/dashboard` · **Screens:** 44 · **Audience:** `staff`

Desktop-first, high information density. 12 navigation groups against the member
app's flatter structure — staff work across the whole system, members work in
one area at a time.

## Areas

Members and verification · Programmes and enrolment · [[Growth and Work]] ·
[[Community]] moderation · [[Safety]] queues and support fund ·
[[Money]] · Analytics · [[Permissions and Roles]] · Platform settings ·
[[Backup and Restore]]

## Every control does something

A pass over the dashboard found **16 dead controls** — buttons, chevrons and
sections that rendered but did nothing. All 16 now work. Six screens had UI with
no backend at all; each got real endpoints.

Worth stating as a standard: **a control that doesn't work is worse than a
control that doesn't exist.** A missing feature reads as "not built yet". A
button that does nothing reads as "broken", and it costs a support conversation
every time someone presses it.

## Staff acting on a member's behalf

Two places staff can change a member's own settings:

- [[Theme engine|MemberThemeControl]] — presets only, member is notified
- Verification decisions

The pattern in both: **the member finds out.** Silent changes to someone's
account, even helpful ones, make software feel untrustworthy.

Related: [[Member app]], [[ADR-012 Permissions imply view]]

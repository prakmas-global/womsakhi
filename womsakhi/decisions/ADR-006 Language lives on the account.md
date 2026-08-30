---
status: accepted
updated: 2026-08-15
tags: [adr, i18n]
---

# ADR-006 — Language lives on the account, not the URL

**Status:** accepted

## Decision

Locale is a field on the user, resolved server-side. No `/hi/…` or `/en/…` path
prefix, no locale in the route.

## Why

**She changes device, not language.** A member picks Hindi once during
[[Onboarding]] and expects Hindi on her phone, on a borrowed laptop, and after
reinstalling. Account storage gives that for free; a URL prefix gives it only if
every link everywhere carries the prefix.

**Shared links stay correct for the recipient.** With a prefix, a member sending
a circle link to a friend sends *her* language. Account-based, each person reads
it in her own.

**Staff can see what she sees.** Support asking "what does your screen say?"
works when locale is a known account property.

## Cost of this choice

Pages can't be statically generated per locale — rendering needs the request.
Given that nearly every screen here is authenticated and personalised anyway,
static generation was never on the table. The cost is real but we weren't
spending it.

## Current state

15 languages are registered; most are **not yet translated** and fall back to
English. The registry is the plan, not the delivery — don't read the language
list as a list of supported languages. Tracked in [[Known issues]].

Related: [[Internationalisation]], [[Onboarding]]

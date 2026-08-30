---
status: partial
updated: 2026-08-15
tags: [module, i18n]
---

# Internationalisation

Locale is an account field, resolved server-side. No URL prefix — reasoning in
[[ADR-006 Language lives on the account]].

## Current state — read this before promising anything

**15 languages are registered. Most are not translated** and fall back to
English.

The registry is the plan, not the delivery. The language picker is not a list of
supported languages. Tracked in [[Known issues]].

## What translation will actually require

- Every user-facing string through the translation layer, including error
  messages — which is where untranslated text usually survives longest, because
  errors are the screens nobody screenshots.
- Number, date and currency formatting per locale.
- Layout tolerance for longer strings. German and Tamil run considerably longer
  than English; a nav item sized to fit "Wallet" will break.

That last one interacts with the [[Layout engine]]: `SIDEBAR_MIN = 64` assumes
icon-only. Label-bearing widths need to be checked per locale, not once in
English.

Related: [[Onboarding]]

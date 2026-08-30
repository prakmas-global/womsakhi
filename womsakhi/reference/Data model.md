---
status: living
updated: 2026-08-15
tags: [reference]
---

# Data model

MongoDB Atlas via Motor. Models in `app/models/`, one file per area.

Collections deliberately **not** listed field-by-field here — that would drift
within a week and then actively mislead. Read the model file; it's the truth.
This note records only the things a model file doesn't tell you.

## Conventions that hold everywhere

- **Money** — integer paise, field suffix `_minor`.
  [[ADR-008 Money is stored in minor units]]
- **Ownership** — `user_id` from the token, never the request.
  [[ADR-007 Ownership comes from the token]]
- **Moderation** — `hidden: bool`, never deletion.
  [[ADR-005 Moderation hides, never deletes]]
- **Timestamps** — `created_at` / `updated_at`, UTC-aware
  (`datetime.now(timezone.utc)`). Naive datetimes compare wrongly against aware
  ones and throw at runtime rather than at write time.

## Where derived values are forbidden

Category colours and service icons must **not** be stored. Both caused bugs when
they were. [[Derive, never store what you can compute]]

## Notable collections

- `user_layouts` — one doc per user, all customisation.
  [[ADR-009 Layout stores fractions per breakpoint]]
- `roles` — permission sets; implication applied on save.
  [[ADR-012 Permissions imply view]]

Related: [[API surface]]

# Launch hardening: automation and staff sign-in security

Verified 26 September 2026.

## Automation engine

- The real-database acceptance suite covers scheduling, dispatch, quiet hours, safety priority, attention budgets, domain event changes, idempotent actions, ownership, outages, snooze, orphan recovery and concurrent workers.
- The acceptance check was corrected to inspect `member_notifications`, the inbox members actually read, after an older assertion still referenced the retired operator collection.
- Result: 33/33 checks passed, with all synthetic engine records removed by the test cleanup.

## Authenticator sign-in

- Staff can configure any RFC 6238 TOTP authenticator from Settings → Security.
- The seed is encrypted at rest with a key derived from the server signing secret.
- Setup verifies the current password and a live six-digit code before activation.
- Eight recovery codes are shown once, stored only as keyed digests, and consumed after one successful use.
- A staff login with 2FA enabled receives an explicit second-step challenge after the correct password.
- Setup, enable, and disable operations enter the append-only audit log.
- Result: 9/9 live checks passed; the temporary account was removed afterwards.

Production payment, email, public URL, push and scheduler credentials remain deployment inputs and are listed separately from application functionality.
## Additional production fail-closed controls

- Production refuses to start with simulated AI, sandbox or unknown payment adapters, local application/media URLs, local CORS origins, disabled engines, or a missing engine tick secret.
- Assigned staff dashboard totals, charts, recent members, recent appointments, activity and exports are derived from the same server-side record scope used by the directory.
- A live Regional Admin acceptance test confirmed that out-of-region names and counts are excluded.

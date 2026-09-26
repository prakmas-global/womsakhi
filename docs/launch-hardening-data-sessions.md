# Live-data and session hardening

This cross-cutting pass advances plan items 10, 12, 26, 29, and 30.

## Changes

- Production startup can never run demo seeders, even if `DEMO_SEED_ENABLED` is accidentally left true.
- A production database or index failure now stops startup instead of opening an API with no persistence.
- RBAC backfill remains an idempotent operational startup task and no longer depends on demo seeding.
- `useResource` reports failed requests as `error`; it no longer labels or serves fixture data as a fallback.
- Business, money, work, learning, events, entitlements, referrals, circles, mentors, notifications, bookings, and certificate adapters now use empty safe shapes until live data arrives.
- The member shell no longer borrows a fixture woman's name, avatar, unread count, or profile progress.
- Money screens start at zero and explicitly identify a failed load instead of showing plausible sample balances.
- A static launch guard prevents the core adapters from reintroducing translated fixture rows.
- A browser regression check covers staff → sign-out → member → sign-out → staff in one cookie jar, including wrong-audience redirects.
- Non-fixed-price marketplace orders are rejected before any seller lookup or stock mutation.

## Verification

- `npm run build`: pass.
- `npx tsc --noEmit`: pass.
- `npm run check:no-mock-data`: pass.
- `npm run check:session-switch`: 13/13 pass.
- `python -m pytest -q`: 267 pass, 2 skipped because they require a throwaway MongoDB integration environment.

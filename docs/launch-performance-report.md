# WomSakhi launch performance report

Date: 2026-09-26

## Shipped improvements

- The English launch bundle imports only the English message catalogue. The 17 future-language catalogues remain in source control for the later multilingual release.
- Removed unused non-Latin web fonts from the English critical path.
- Deferred Sakhi speech, recording, and conversation code until the member opens Sakhi.
- Removed an unused global React Query provider and its runtime packages.
- Added a 20-second interactive API timeout so a stalled connection reaches the existing retry/error UI instead of spinning forever.
- Converted referenced launch artwork from multi-megabyte PNG files to dimension-preserving WebP assets and removed unused originals.
- Added browser/CDN caching for static artwork while keeping the service worker uncacheable so releases update immediately.
- Bumped the service-worker cache version to retire old artwork and script caches.
- Overlapped independent region-count queries; the seeded region endpoint's warm median fell from about 1,035 ms to about 198 ms locally.
- Replaced the circle-sisters N+1 profile lookups with two batched reads; warm response time fell from about 818 ms and 29 queries to about 140 ms and 5 queries.
- Patched Next.js from 16.2.7 to 16.3.6, clearing all reported npm vulnerabilities.
- Kept one warm Cloud Run instance for both API and web services and enabled startup CPU boost to remove production scale-to-zero cold starts.
- Added `npm run check:performance` to prevent oversized JavaScript chunks, oversized public images, or accidental non-English catalogue imports from returning.

## Measurements

| Metric | Before | After |
| --- | ---: | ---: |
| Largest production JS chunk | 1,741 KiB | 419 KiB |
| Public asset directory | 86 MB | 23 MB |
| Public images over 750 KiB | 14 | 0 |
| Admin regions warm median | 1,035 ms | 198 ms |
| Circle sisters warm response | 818 ms / 29 queries | 140 ms / 5 queries |
| Production route build | 211 routes | 211 routes |
| npm high/critical vulnerabilities | 3 | 0 |

The performance budget allows a maximum 750 KiB JavaScript chunk and 750 KiB public image. This is a regression ceiling, not the target for every file.

## Verification

- Next.js 16.3.6 production build: passed, 211 routes.
- TypeScript: passed.
- Backend tests: 307 passed, 2 intentionally skipped because they require a disposable live database.
- Image quality check: 67 app artwork assets have sufficient natural resolution.
- Performance budget: passed.
- Navigation map: 154 routes and 122 navigation nodes passed.
- Launch functional gaps: 19 of 19 persisted API workflows passed.

## Production configuration still required for a full public launch

These are account or infrastructure values, so they are intentionally not stored in the repository:

- Razorpay key ID, key secret, and webhook signing secret; switch `PAYMENT_PROVIDER` from `sandbox` to `razorpay`.
- A verified Mailgun domain and API key, or equivalent production SMTP credentials.
- VAPID public/private keys for browser push notifications.
- An automation tick secret, `ENGINES_ENABLED=true`, Cloud Scheduler API enablement, and a scheduled call to the internal engine tick route.
- Production mode, demo seeding disabled, and the production cookie domain when the service is promoted from the current hosted test configuration to the public launch configuration.

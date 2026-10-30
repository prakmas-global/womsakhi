# WomSakhi technical module inventory

Generated from the working-tree source by `python3 scripts/generate_module_inventory.py`.
Snapshot generated: **2026-10-31**. No application or database imports are executed.

Start with the [module and feature guide](MODULES_AND_FEATURES.md) for product behaviour and user journeys.

## Counting rules

- A page is one `page.tsx` file under the frontend App Router, including redirects and dynamic detail pages.
- `[id]`, `[handle]` and similar segments are parameters, not literal IDs.
- Route groups such as `(auth)` do not appear in the browser URL.
- Tabs, dialogs, loading/error files and API route handlers are not additional pages in this count.
- A backend operation is one HTTP-method decorator on a registered router, including hidden-schema operations.
- Router prefixes below include `/api/v1`; a prefix alone need not have a directly callable GET endpoint.
- The registration-level permission column is not a complete access policy. Endpoint dependencies and internal guards also apply.

## Summary

| Area | Page files |
| --- | ---: |
| Member | 200 |
| Staff | 69 |
| Authentication, public and other | 20 |
| Total | 289 |

Registered router objects: **109**. HTTP operations on those routers: **1006**.

## Member pages

| Browser route | Source | Notes |
| --- | --- | --- |
| `/app` | [womencrafts-frontend/frontend/src/app/app/page.tsx](<../womencrafts-frontend/frontend/src/app/app/page.tsx>) |  |
| `/app/applications` | [womencrafts-frontend/frontend/src/app/app/applications/page.tsx](<../womencrafts-frontend/frontend/src/app/app/applications/page.tsx>) |  |
| `/app/assess` | [womencrafts-frontend/frontend/src/app/app/assess/page.tsx](<../womencrafts-frontend/frontend/src/app/app/assess/page.tsx>) |  |
| `/app/bookings` | [womencrafts-frontend/frontend/src/app/app/bookings/page.tsx](<../womencrafts-frontend/frontend/src/app/app/bookings/page.tsx>) |  |
| `/app/bookings/[id]` | [womencrafts-frontend/frontend/src/app/app/bookings/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/bookings/[id]/page.tsx>) | Parameterized route |
| `/app/books` | [womencrafts-frontend/frontend/src/app/app/books/page.tsx](<../womencrafts-frontend/frontend/src/app/app/books/page.tsx>) |  |
| `/app/books/proof` | [womencrafts-frontend/frontend/src/app/app/books/proof/page.tsx](<../womencrafts-frontend/frontend/src/app/app/books/proof/page.tsx>) |  |
| `/app/books/season` | [womencrafts-frontend/frontend/src/app/app/books/season/page.tsx](<../womencrafts-frontend/frontend/src/app/app/books/season/page.tsx>) |  |
| `/app/bringing` | [womencrafts-frontend/frontend/src/app/app/bringing/page.tsx](<../womencrafts-frontend/frontend/src/app/app/bringing/page.tsx>) |  |
| `/app/certificates` | [womencrafts-frontend/frontend/src/app/app/certificates/page.tsx](<../womencrafts-frontend/frontend/src/app/app/certificates/page.tsx>) |  |
| `/app/checkout/[orderId]` | [womencrafts-frontend/frontend/src/app/app/checkout/[orderId]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/checkout/[orderId]/page.tsx>) | Parameterized route; Contains a redirect |
| `/app/circle` | [womencrafts-frontend/frontend/src/app/app/circle/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circle/page.tsx>) | Contains a redirect |
| `/app/circles` | [womencrafts-frontend/frontend/src/app/app/circles/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/page.tsx>) |  |
| `/app/circles/[id]` | [womencrafts-frontend/frontend/src/app/app/circles/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/[id]/page.tsx>) | Parameterized route |
| `/app/circles/[id]/pay` | [womencrafts-frontend/frontend/src/app/app/circles/[id]/pay/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/[id]/pay/page.tsx>) | Parameterized route |
| `/app/circles/create` | [womencrafts-frontend/frontend/src/app/app/circles/create/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/create/page.tsx>) |  |
| `/app/circles/join/[code]` | [womencrafts-frontend/frontend/src/app/app/circles/join/[code]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/join/[code]/page.tsx>) | Parameterized route |
| `/app/circles/new` | [womencrafts-frontend/frontend/src/app/app/circles/new/page.tsx](<../womencrafts-frontend/frontend/src/app/app/circles/new/page.tsx>) |  |
| `/app/collect` | [womencrafts-frontend/frontend/src/app/app/collect/page.tsx](<../womencrafts-frontend/frontend/src/app/app/collect/page.tsx>) |  |
| `/app/community` | [womencrafts-frontend/frontend/src/app/app/community/page.tsx](<../womencrafts-frontend/frontend/src/app/app/community/page.tsx>) |  |
| `/app/community/friends` | [womencrafts-frontend/frontend/src/app/app/community/friends/page.tsx](<../womencrafts-frontend/frontend/src/app/app/community/friends/page.tsx>) |  |
| `/app/community/u/[handle]` | [womencrafts-frontend/frontend/src/app/app/community/u/[handle]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/community/u/[handle]/page.tsx>) | Parameterized route |
| `/app/contracts` | [womencrafts-frontend/frontend/src/app/app/contracts/page.tsx](<../womencrafts-frontend/frontend/src/app/app/contracts/page.tsx>) |  |
| `/app/contracts/together` | [womencrafts-frontend/frontend/src/app/app/contracts/together/page.tsx](<../womencrafts-frontend/frontend/src/app/app/contracts/together/page.tsx>) |  |
| `/app/cover` | [womencrafts-frontend/frontend/src/app/app/cover/page.tsx](<../womencrafts-frontend/frontend/src/app/app/cover/page.tsx>) | Contains a redirect |
| `/app/digital` | [womencrafts-frontend/frontend/src/app/app/digital/page.tsx](<../womencrafts-frontend/frontend/src/app/app/digital/page.tsx>) |  |
| `/app/discover` | [womencrafts-frontend/frontend/src/app/app/discover/page.tsx](<../womencrafts-frontend/frontend/src/app/app/discover/page.tsx>) |  |
| `/app/documents` | [womencrafts-frontend/frontend/src/app/app/documents/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/page.tsx>) |  |
| `/app/documents/listings` | [womencrafts-frontend/frontend/src/app/app/documents/listings/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/listings/page.tsx>) |  |
| `/app/documents/new` | [womencrafts-frontend/frontend/src/app/app/documents/new/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/new/page.tsx>) |  |
| `/app/documents/new/sent` | [womencrafts-frontend/frontend/src/app/app/documents/new/sent/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/new/sent/page.tsx>) |  |
| `/app/documents/order/[id]` | [womencrafts-frontend/frontend/src/app/app/documents/order/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/order/[id]/page.tsx>) | Parameterized route |
| `/app/documents/product/[id]` | [womencrafts-frontend/frontend/src/app/app/documents/product/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/product/[id]/page.tsx>) | Parameterized route |
| `/app/documents/service/[id]` | [womencrafts-frontend/frontend/src/app/app/documents/service/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/service/[id]/page.tsx>) | Parameterized route |
| `/app/documents/store` | [womencrafts-frontend/frontend/src/app/app/documents/store/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/store/page.tsx>) |  |
| `/app/documents/vault` | [womencrafts-frontend/frontend/src/app/app/documents/vault/page.tsx](<../womencrafts-frontend/frontend/src/app/app/documents/vault/page.tsx>) |  |
| `/app/earn` | [womencrafts-frontend/frontend/src/app/app/earn/page.tsx](<../womencrafts-frontend/frontend/src/app/app/earn/page.tsx>) |  |
| `/app/events` | [womencrafts-frontend/frontend/src/app/app/events/page.tsx](<../womencrafts-frontend/frontend/src/app/app/events/page.tsx>) |  |
| `/app/events/[id]` | [womencrafts-frontend/frontend/src/app/app/events/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/events/[id]/page.tsx>) | Parameterized route |
| `/app/explore` | [womencrafts-frontend/frontend/src/app/app/explore/page.tsx](<../womencrafts-frontend/frontend/src/app/app/explore/page.tsx>) |  |
| `/app/explore/program/[id]` | [womencrafts-frontend/frontend/src/app/app/explore/program/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/explore/program/[id]/page.tsx>) | Parameterized route; Contains a redirect |
| `/app/explore/service/[id]` | [womencrafts-frontend/frontend/src/app/app/explore/service/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/explore/service/[id]/page.tsx>) | Parameterized route |
| `/app/family` | [womencrafts-frontend/frontend/src/app/app/family/page.tsx](<../womencrafts-frontend/frontend/src/app/app/family/page.tsx>) |  |
| `/app/feedback` | [womencrafts-frontend/frontend/src/app/app/feedback/page.tsx](<../womencrafts-frontend/frontend/src/app/app/feedback/page.tsx>) |  |
| `/app/goals` | [womencrafts-frontend/frontend/src/app/app/goals/page.tsx](<../womencrafts-frontend/frontend/src/app/app/goals/page.tsx>) |  |
| `/app/group-buy` | [womencrafts-frontend/frontend/src/app/app/group-buy/page.tsx](<../womencrafts-frontend/frontend/src/app/app/group-buy/page.tsx>) |  |
| `/app/haq` | [womencrafts-frontend/frontend/src/app/app/haq/page.tsx](<../womencrafts-frontend/frontend/src/app/app/haq/page.tsx>) |  |
| `/app/haq/[id]` | [womencrafts-frontend/frontend/src/app/app/haq/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/haq/[id]/page.tsx>) | Parameterized route |
| `/app/haq/papers` | [womencrafts-frontend/frontend/src/app/app/haq/papers/page.tsx](<../womencrafts-frontend/frontend/src/app/app/haq/papers/page.tsx>) |  |
| `/app/haq/recover` | [womencrafts-frontend/frontend/src/app/app/haq/recover/page.tsx](<../womencrafts-frontend/frontend/src/app/app/haq/recover/page.tsx>) |  |
| `/app/health` | [womencrafts-frontend/frontend/src/app/app/health/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/page.tsx>) |  |
| `/app/health/change` | [womencrafts-frontend/frontend/src/app/app/health/change/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/change/page.tsx>) |  |
| `/app/health/cover` | [womencrafts-frontend/frontend/src/app/app/health/cover/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cover/page.tsx>) |  |
| `/app/health/cycle` | [womencrafts-frontend/frontend/src/app/app/health/cycle/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/page.tsx>) |  |
| `/app/health/cycle/check` | [womencrafts-frontend/frontend/src/app/app/health/cycle/check/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/check/page.tsx>) |  |
| `/app/health/cycle/daily` | [womencrafts-frontend/frontend/src/app/app/health/cycle/daily/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/daily/page.tsx>) |  |
| `/app/health/cycle/insights` | [womencrafts-frontend/frontend/src/app/app/health/cycle/insights/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/insights/page.tsx>) |  |
| `/app/health/cycle/learn` | [womencrafts-frontend/frontend/src/app/app/health/cycle/learn/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/learn/page.tsx>) |  |
| `/app/health/cycle/learn/[slug]` | [womencrafts-frontend/frontend/src/app/app/health/cycle/learn/[slug]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/learn/[slug]/page.tsx>) | Parameterized route |
| `/app/health/cycle/log` | [womencrafts-frontend/frontend/src/app/app/health/cycle/log/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/log/page.tsx>) |  |
| `/app/health/cycle/medicines` | [womencrafts-frontend/frontend/src/app/app/health/cycle/medicines/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/medicines/page.tsx>) |  |
| `/app/health/cycle/mood` | [womencrafts-frontend/frontend/src/app/app/health/cycle/mood/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/mood/page.tsx>) |  |
| `/app/health/cycle/period` | [womencrafts-frontend/frontend/src/app/app/health/cycle/period/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/period/page.tsx>) |  |
| `/app/health/cycle/reminders` | [womencrafts-frontend/frontend/src/app/app/health/cycle/reminders/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/reminders/page.tsx>) |  |
| `/app/health/cycle/report` | [womencrafts-frontend/frontend/src/app/app/health/cycle/report/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/report/page.tsx>) |  |
| `/app/health/cycle/settings` | [womencrafts-frontend/frontend/src/app/app/health/cycle/settings/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/settings/page.tsx>) |  |
| `/app/health/cycle/start` | [womencrafts-frontend/frontend/src/app/app/health/cycle/start/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/start/page.tsx>) |  |
| `/app/health/cycle/symptoms` | [womencrafts-frontend/frontend/src/app/app/health/cycle/symptoms/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/symptoms/page.tsx>) |  |
| `/app/health/cycle/today` | [womencrafts-frontend/frontend/src/app/app/health/cycle/today/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/cycle/today/page.tsx>) |  |
| `/app/health/doctors` | [womencrafts-frontend/frontend/src/app/app/health/doctors/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/doctors/page.tsx>) |  |
| `/app/health/fertility` | [womencrafts-frontend/frontend/src/app/app/health/fertility/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/fertility/page.tsx>) |  |
| `/app/health/fitness` | [womencrafts-frontend/frontend/src/app/app/health/fitness/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/fitness/page.tsx>) |  |
| `/app/health/games` | [womencrafts-frontend/frontend/src/app/app/health/games/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/page.tsx>) |  |
| `/app/health/games/breathe` | [womencrafts-frontend/frontend/src/app/app/health/games/breathe/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/breathe/page.tsx>) |  |
| `/app/health/games/bubbles` | [womencrafts-frontend/frontend/src/app/app/health/games/bubbles/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/bubbles/page.tsx>) |  |
| `/app/health/games/garden` | [womencrafts-frontend/frontend/src/app/app/health/games/garden/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/garden/page.tsx>) |  |
| `/app/health/games/numbers` | [womencrafts-frontend/frontend/src/app/app/health/games/numbers/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/numbers/page.tsx>) |  |
| `/app/health/games/pairs` | [womencrafts-frontend/frontend/src/app/app/health/games/pairs/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/pairs/page.tsx>) |  |
| `/app/health/games/puzzle` | [womencrafts-frontend/frontend/src/app/app/health/games/puzzle/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/puzzle/page.tsx>) |  |
| `/app/health/games/rangoli` | [womencrafts-frontend/frontend/src/app/app/health/games/rangoli/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/games/rangoli/page.tsx>) |  |
| `/app/health/mentors` | [womencrafts-frontend/frontend/src/app/app/health/mentors/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/mentors/page.tsx>) |  |
| `/app/health/mind` | [womencrafts-frontend/frontend/src/app/app/health/mind/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/mind/page.tsx>) |  |
| `/app/health/nutrition` | [womencrafts-frontend/frontend/src/app/app/health/nutrition/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/nutrition/page.tsx>) |  |
| `/app/health/pregnancy` | [womencrafts-frontend/frontend/src/app/app/health/pregnancy/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/pregnancy/page.tsx>) |  |
| `/app/health/records` | [womencrafts-frontend/frontend/src/app/app/health/records/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/records/page.tsx>) |  |
| `/app/health/reminders` | [womencrafts-frontend/frontend/src/app/app/health/reminders/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/reminders/page.tsx>) |  |
| `/app/health/sleep` | [womencrafts-frontend/frontend/src/app/app/health/sleep/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/sleep/page.tsx>) |  |
| `/app/health/strength` | [womencrafts-frontend/frontend/src/app/app/health/strength/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/strength/page.tsx>) |  |
| `/app/health/today` | [womencrafts-frontend/frontend/src/app/app/health/today/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/today/page.tsx>) |  |
| `/app/health/videos` | [womencrafts-frontend/frontend/src/app/app/health/videos/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/videos/page.tsx>) |  |
| `/app/health/workouts` | [womencrafts-frontend/frontend/src/app/app/health/workouts/page.tsx](<../womencrafts-frontend/frontend/src/app/app/health/workouts/page.tsx>) | Contains a redirect |
| `/app/help` | [womencrafts-frontend/frontend/src/app/app/help/page.tsx](<../womencrafts-frontend/frontend/src/app/app/help/page.tsx>) |  |
| `/app/helpdesk` | [womencrafts-frontend/frontend/src/app/app/helpdesk/page.tsx](<../womencrafts-frontend/frontend/src/app/app/helpdesk/page.tsx>) |  |
| `/app/incase` | [womencrafts-frontend/frontend/src/app/app/incase/page.tsx](<../womencrafts-frontend/frontend/src/app/app/incase/page.tsx>) |  |
| `/app/intake` | [womencrafts-frontend/frontend/src/app/app/intake/page.tsx](<../womencrafts-frontend/frontend/src/app/app/intake/page.tsx>) |  |
| `/app/journey` | [womencrafts-frontend/frontend/src/app/app/journey/page.tsx](<../womencrafts-frontend/frontend/src/app/app/journey/page.tsx>) |  |
| `/app/khata` | [womencrafts-frontend/frontend/src/app/app/khata/page.tsx](<../womencrafts-frontend/frontend/src/app/app/khata/page.tsx>) | Contains a redirect |
| `/app/khata/chits` | [womencrafts-frontend/frontend/src/app/app/khata/chits/page.tsx](<../womencrafts-frontend/frontend/src/app/app/khata/chits/page.tsx>) |  |
| `/app/khata/chits/[id]` | [womencrafts-frontend/frontend/src/app/app/khata/chits/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/khata/chits/[id]/page.tsx>) | Parameterized route |
| `/app/khata/chits/new` | [womencrafts-frontend/frontend/src/app/app/khata/chits/new/page.tsx](<../womencrafts-frontend/frontend/src/app/app/khata/chits/new/page.tsx>) |  |
| `/app/kitchen` | [womencrafts-frontend/frontend/src/app/app/kitchen/page.tsx](<../womencrafts-frontend/frontend/src/app/app/kitchen/page.tsx>) |  |
| `/app/learn` | [womencrafts-frontend/frontend/src/app/app/learn/page.tsx](<../womencrafts-frontend/frontend/src/app/app/learn/page.tsx>) |  |
| `/app/library` | [womencrafts-frontend/frontend/src/app/app/library/page.tsx](<../womencrafts-frontend/frontend/src/app/app/library/page.tsx>) |  |
| `/app/library/[id]` | [womencrafts-frontend/frontend/src/app/app/library/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/library/[id]/page.tsx>) | Parameterized route |
| `/app/market` | [womencrafts-frontend/frontend/src/app/app/market/page.tsx](<../womencrafts-frontend/frontend/src/app/app/market/page.tsx>) |  |
| `/app/market/[id]` | [womencrafts-frontend/frontend/src/app/app/market/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/market/[id]/page.tsx>) | Parameterized route |
| `/app/mentoring` | [womencrafts-frontend/frontend/src/app/app/mentoring/page.tsx](<../womencrafts-frontend/frontend/src/app/app/mentoring/page.tsx>) |  |
| `/app/mentors` | [womencrafts-frontend/frontend/src/app/app/mentors/page.tsx](<../womencrafts-frontend/frontend/src/app/app/mentors/page.tsx>) |  |
| `/app/mentors/[id]` | [womencrafts-frontend/frontend/src/app/app/mentors/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/mentors/[id]/page.tsx>) | Parameterized route |
| `/app/messages` | [womencrafts-frontend/frontend/src/app/app/messages/page.tsx](<../womencrafts-frontend/frontend/src/app/app/messages/page.tsx>) |  |
| `/app/messages/report/[id]` | [womencrafts-frontend/frontend/src/app/app/messages/report/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/messages/report/[id]/page.tsx>) | Parameterized route |
| `/app/money` | [womencrafts-frontend/frontend/src/app/app/money/page.tsx](<../womencrafts-frontend/frontend/src/app/app/money/page.tsx>) |  |
| `/app/notifications` | [womencrafts-frontend/frontend/src/app/app/notifications/page.tsx](<../womencrafts-frontend/frontend/src/app/app/notifications/page.tsx>) |  |
| `/app/onboarding` | [womencrafts-frontend/frontend/src/app/app/onboarding/page.tsx](<../womencrafts-frontend/frontend/src/app/app/onboarding/page.tsx>) |  |
| `/app/opportunities` | [womencrafts-frontend/frontend/src/app/app/opportunities/page.tsx](<../womencrafts-frontend/frontend/src/app/app/opportunities/page.tsx>) |  |
| `/app/opportunities/[id]` | [womencrafts-frontend/frontend/src/app/app/opportunities/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/opportunities/[id]/page.tsx>) | Parameterized route |
| `/app/payments` | [womencrafts-frontend/frontend/src/app/app/payments/page.tsx](<../womencrafts-frontend/frontend/src/app/app/payments/page.tsx>) |  |
| `/app/phone` | [womencrafts-frontend/frontend/src/app/app/phone/page.tsx](<../womencrafts-frontend/frontend/src/app/app/phone/page.tsx>) |  |
| `/app/profile` | [womencrafts-frontend/frontend/src/app/app/profile/page.tsx](<../womencrafts-frontend/frontend/src/app/app/profile/page.tsx>) |  |
| `/app/profile/preview` | [womencrafts-frontend/frontend/src/app/app/profile/preview/page.tsx](<../womencrafts-frontend/frontend/src/app/app/profile/preview/page.tsx>) |  |
| `/app/programs` | [womencrafts-frontend/frontend/src/app/app/programs/page.tsx](<../womencrafts-frontend/frontend/src/app/app/programs/page.tsx>) |  |
| `/app/programs/[id]` | [womencrafts-frontend/frontend/src/app/app/programs/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/programs/[id]/page.tsx>) | Parameterized route |
| `/app/programs/[id]/lesson/[n]` | [womencrafts-frontend/frontend/src/app/app/programs/[id]/lesson/[n]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/programs/[id]/lesson/[n]/page.tsx>) | Parameterized route |
| `/app/progress` | [womencrafts-frontend/frontend/src/app/app/progress/page.tsx](<../womencrafts-frontend/frontend/src/app/app/progress/page.tsx>) | Contains a redirect |
| `/app/progress/goals` | [womencrafts-frontend/frontend/src/app/app/progress/goals/page.tsx](<../womencrafts-frontend/frontend/src/app/app/progress/goals/page.tsx>) | Contains a redirect |
| `/app/refer` | [womencrafts-frontend/frontend/src/app/app/refer/page.tsx](<../womencrafts-frontend/frontend/src/app/app/refer/page.tsx>) |  |
| `/app/reminders` | [womencrafts-frontend/frontend/src/app/app/reminders/page.tsx](<../womencrafts-frontend/frontend/src/app/app/reminders/page.tsx>) |  |
| `/app/rent` | [womencrafts-frontend/frontend/src/app/app/rent/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/page.tsx>) |  |
| `/app/rent/[id]` | [womencrafts-frontend/frontend/src/app/app/rent/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/[id]/page.tsx>) | Parameterized route |
| `/app/rent/[id]/edit` | [womencrafts-frontend/frontend/src/app/app/rent/[id]/edit/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/[id]/edit/page.tsx>) | Parameterized route |
| `/app/rent/bookings` | [womencrafts-frontend/frontend/src/app/app/rent/bookings/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/bookings/page.tsx>) |  |
| `/app/rent/bookings/[id]` | [womencrafts-frontend/frontend/src/app/app/rent/bookings/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/bookings/[id]/page.tsx>) | Parameterized route |
| `/app/rent/mine` | [womencrafts-frontend/frontend/src/app/app/rent/mine/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/mine/page.tsx>) |  |
| `/app/rent/new` | [womencrafts-frontend/frontend/src/app/app/rent/new/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rent/new/page.tsx>) |  |
| `/app/rights` | [womencrafts-frontend/frontend/src/app/app/rights/page.tsx](<../womencrafts-frontend/frontend/src/app/app/rights/page.tsx>) |  |
| `/app/safe-money` | [womencrafts-frontend/frontend/src/app/app/safe-money/page.tsx](<../womencrafts-frontend/frontend/src/app/app/safe-money/page.tsx>) |  |
| `/app/safety` | [womencrafts-frontend/frontend/src/app/app/safety/page.tsx](<../womencrafts-frontend/frontend/src/app/app/safety/page.tsx>) |  |
| `/app/sakhi` | [womencrafts-frontend/frontend/src/app/app/sakhi/page.tsx](<../womencrafts-frontend/frontend/src/app/app/sakhi/page.tsx>) |  |
| `/app/saved` | [womencrafts-frontend/frontend/src/app/app/saved/page.tsx](<../womencrafts-frontend/frontend/src/app/app/saved/page.tsx>) |  |
| `/app/schedule` | [womencrafts-frontend/frontend/src/app/app/schedule/page.tsx](<../womencrafts-frontend/frontend/src/app/app/schedule/page.tsx>) |  |
| `/app/school` | [womencrafts-frontend/frontend/src/app/app/school/page.tsx](<../womencrafts-frontend/frontend/src/app/app/school/page.tsx>) |  |
| `/app/search` | [womencrafts-frontend/frontend/src/app/app/search/page.tsx](<../womencrafts-frontend/frontend/src/app/app/search/page.tsx>) |  |
| `/app/services` | [womencrafts-frontend/frontend/src/app/app/services/page.tsx](<../womencrafts-frontend/frontend/src/app/app/services/page.tsx>) |  |
| `/app/settings` | [womencrafts-frontend/frontend/src/app/app/settings/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/page.tsx>) |  |
| `/app/settings/account` | [womencrafts-frontend/frontend/src/app/app/settings/account/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/account/page.tsx>) |  |
| `/app/settings/answers` | [womencrafts-frontend/frontend/src/app/app/settings/answers/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/answers/page.tsx>) |  |
| `/app/settings/appearance` | [womencrafts-frontend/frontend/src/app/app/settings/appearance/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/appearance/page.tsx>) |  |
| `/app/settings/data` | [womencrafts-frontend/frontend/src/app/app/settings/data/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/data/page.tsx>) |  |
| `/app/settings/delivery` | [womencrafts-frontend/frontend/src/app/app/settings/delivery/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/delivery/page.tsx>) |  |
| `/app/settings/language` | [womencrafts-frontend/frontend/src/app/app/settings/language/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/language/page.tsx>) |  |
| `/app/settings/notifications` | [womencrafts-frontend/frontend/src/app/app/settings/notifications/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/notifications/page.tsx>) |  |
| `/app/settings/offline` | [womencrafts-frontend/frontend/src/app/app/settings/offline/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/offline/page.tsx>) |  |
| `/app/settings/payments` | [womencrafts-frontend/frontend/src/app/app/settings/payments/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/payments/page.tsx>) |  |
| `/app/settings/quiet-hours` | [womencrafts-frontend/frontend/src/app/app/settings/quiet-hours/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/quiet-hours/page.tsx>) |  |
| `/app/settings/security` | [womencrafts-frontend/frontend/src/app/app/settings/security/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/security/page.tsx>) |  |
| `/app/settings/voice` | [womencrafts-frontend/frontend/src/app/app/settings/voice/page.tsx](<../womencrafts-frontend/frontend/src/app/app/settings/voice/page.tsx>) |  |
| `/app/shop` | [womencrafts-frontend/frontend/src/app/app/shop/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/page.tsx>) |  |
| `/app/shop/buyers` | [womencrafts-frontend/frontend/src/app/app/shop/buyers/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/buyers/page.tsx>) |  |
| `/app/shop/disputes` | [womencrafts-frontend/frontend/src/app/app/shop/disputes/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/disputes/page.tsx>) |  |
| `/app/shop/live` | [womencrafts-frontend/frontend/src/app/app/shop/live/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/live/page.tsx>) |  |
| `/app/shop/preorders` | [womencrafts-frontend/frontend/src/app/app/shop/preorders/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/preorders/page.tsx>) |  |
| `/app/shop/pricing` | [womencrafts-frontend/frontend/src/app/app/shop/pricing/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/pricing/page.tsx>) |  |
| `/app/shop/slots` | [womencrafts-frontend/frontend/src/app/app/shop/slots/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/slots/page.tsx>) |  |
| `/app/shop/subscriptions` | [womencrafts-frontend/frontend/src/app/app/shop/subscriptions/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/subscriptions/page.tsx>) |  |
| `/app/shop/voice` | [womencrafts-frontend/frontend/src/app/app/shop/voice/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/voice/page.tsx>) |  |
| `/app/shop/wholesale` | [womencrafts-frontend/frontend/src/app/app/shop/wholesale/page.tsx](<../womencrafts-frontend/frontend/src/app/app/shop/wholesale/page.tsx>) |  |
| `/app/stories` | [womencrafts-frontend/frontend/src/app/app/stories/page.tsx](<../womencrafts-frontend/frontend/src/app/app/stories/page.tsx>) |  |
| `/app/stories/[id]` | [womencrafts-frontend/frontend/src/app/app/stories/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/stories/[id]/page.tsx>) | Parameterized route |
| `/app/support-fund` | [womencrafts-frontend/frontend/src/app/app/support-fund/page.tsx](<../womencrafts-frontend/frontend/src/app/app/support-fund/page.tsx>) | Contains a redirect |
| `/app/support-fund/[id]` | [womencrafts-frontend/frontend/src/app/app/support-fund/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/support-fund/[id]/page.tsx>) | Parameterized route; Contains a redirect |
| `/app/swap` | [womencrafts-frontend/frontend/src/app/app/swap/page.tsx](<../womencrafts-frontend/frontend/src/app/app/swap/page.tsx>) |  |
| `/app/teach` | [womencrafts-frontend/frontend/src/app/app/teach/page.tsx](<../womencrafts-frontend/frontend/src/app/app/teach/page.tsx>) |  |
| `/app/teach/[id]` | [womencrafts-frontend/frontend/src/app/app/teach/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/app/teach/[id]/page.tsx>) | Parameterized route |
| `/app/teach/new` | [womencrafts-frontend/frontend/src/app/app/teach/new/page.tsx](<../womencrafts-frontend/frontend/src/app/app/teach/new/page.tsx>) |  |
| `/app/together` | [womencrafts-frontend/frontend/src/app/app/together/page.tsx](<../womencrafts-frontend/frontend/src/app/app/together/page.tsx>) |  |
| `/app/together/assist` | [womencrafts-frontend/frontend/src/app/app/together/assist/page.tsx](<../womencrafts-frontend/frontend/src/app/app/together/assist/page.tsx>) |  |
| `/app/together/learn` | [womencrafts-frontend/frontend/src/app/app/together/learn/page.tsx](<../womencrafts-frontend/frontend/src/app/app/together/learn/page.tsx>) | Contains a redirect |
| `/app/together/move` | [womencrafts-frontend/frontend/src/app/app/together/move/page.tsx](<../womencrafts-frontend/frontend/src/app/app/together/move/page.tsx>) |  |
| `/app/travel` | [womencrafts-frontend/frontend/src/app/app/travel/page.tsx](<../womencrafts-frontend/frontend/src/app/app/travel/page.tsx>) |  |
| `/app/travel/journey` | [womencrafts-frontend/frontend/src/app/app/travel/journey/page.tsx](<../womencrafts-frontend/frontend/src/app/app/travel/journey/page.tsx>) |  |
| `/app/trust` | [womencrafts-frontend/frontend/src/app/app/trust/page.tsx](<../womencrafts-frontend/frontend/src/app/app/trust/page.tsx>) |  |
| `/app/vault` | [womencrafts-frontend/frontend/src/app/app/vault/page.tsx](<../womencrafts-frontend/frontend/src/app/app/vault/page.tsx>) |  |
| `/app/vault/history` | [womencrafts-frontend/frontend/src/app/app/vault/history/page.tsx](<../womencrafts-frontend/frontend/src/app/app/vault/history/page.tsx>) |  |
| `/app/vault/privacy` | [womencrafts-frontend/frontend/src/app/app/vault/privacy/page.tsx](<../womencrafts-frontend/frontend/src/app/app/vault/privacy/page.tsx>) |  |
| `/app/vault/rules` | [womencrafts-frontend/frontend/src/app/app/vault/rules/page.tsx](<../womencrafts-frontend/frontend/src/app/app/vault/rules/page.tsx>) |  |
| `/app/vault/showing` | [womencrafts-frontend/frontend/src/app/app/vault/showing/page.tsx](<../womencrafts-frontend/frontend/src/app/app/vault/showing/page.tsx>) |  |
| `/app/verified` | [womencrafts-frontend/frontend/src/app/app/verified/page.tsx](<../womencrafts-frontend/frontend/src/app/app/verified/page.tsx>) |  |
| `/app/verify` | [womencrafts-frontend/frontend/src/app/app/verify/page.tsx](<../womencrafts-frontend/frontend/src/app/app/verify/page.tsx>) |  |
| `/app/voice` | [womencrafts-frontend/frontend/src/app/app/voice/page.tsx](<../womencrafts-frontend/frontend/src/app/app/voice/page.tsx>) |  |
| `/app/wallet` | [womencrafts-frontend/frontend/src/app/app/wallet/page.tsx](<../womencrafts-frontend/frontend/src/app/app/wallet/page.tsx>) | Contains a redirect |
| `/app/wallet/statement` | [womencrafts-frontend/frontend/src/app/app/wallet/statement/page.tsx](<../womencrafts-frontend/frontend/src/app/app/wallet/statement/page.tsx>) | Contains a redirect |
| `/app/wallet/withdraw` | [womencrafts-frontend/frontend/src/app/app/wallet/withdraw/page.tsx](<../womencrafts-frontend/frontend/src/app/app/wallet/withdraw/page.tsx>) |  |
| `/app/welcome` | [womencrafts-frontend/frontend/src/app/app/welcome/page.tsx](<../womencrafts-frontend/frontend/src/app/app/welcome/page.tsx>) |  |
| `/app/wellness` | [womencrafts-frontend/frontend/src/app/app/wellness/page.tsx](<../womencrafts-frontend/frontend/src/app/app/wellness/page.tsx>) |  |
| `/app/work` | [womencrafts-frontend/frontend/src/app/app/work/page.tsx](<../womencrafts-frontend/frontend/src/app/app/work/page.tsx>) |  |
| `/app/work/find` | [womencrafts-frontend/frontend/src/app/app/work/find/page.tsx](<../womencrafts-frontend/frontend/src/app/app/work/find/page.tsx>) |  |
| `/app/work/post` | [womencrafts-frontend/frontend/src/app/app/work/post/page.tsx](<../womencrafts-frontend/frontend/src/app/app/work/post/page.tsx>) |  |
| `/app/work/posts` | [womencrafts-frontend/frontend/src/app/app/work/posts/page.tsx](<../womencrafts-frontend/frontend/src/app/app/work/posts/page.tsx>) |  |
| `/app/work/profile` | [womencrafts-frontend/frontend/src/app/app/work/profile/page.tsx](<../womencrafts-frontend/frontend/src/app/app/work/profile/page.tsx>) |  |
| `/app/you` | [womencrafts-frontend/frontend/src/app/app/you/page.tsx](<../womencrafts-frontend/frontend/src/app/app/you/page.tsx>) |  |

## Staff pages

| Browser route | Source | Notes |
| --- | --- | --- |
| `/dashboard` | [womencrafts-frontend/frontend/src/app/dashboard/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/page.tsx>) |  |
| `/dashboard/ai` | [womencrafts-frontend/frontend/src/app/dashboard/ai/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/ai/page.tsx>) |  |
| `/dashboard/analytics` | [womencrafts-frontend/frontend/src/app/dashboard/analytics/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/analytics/page.tsx>) |  |
| `/dashboard/analytics/what-women-want` | [womencrafts-frontend/frontend/src/app/dashboard/analytics/what-women-want/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/analytics/what-women-want/page.tsx>) |  |
| `/dashboard/applications` | [womencrafts-frontend/frontend/src/app/dashboard/applications/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/applications/page.tsx>) |  |
| `/dashboard/appointments` | [womencrafts-frontend/frontend/src/app/dashboard/appointments/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/appointments/page.tsx>) |  |
| `/dashboard/calendar` | [womencrafts-frontend/frontend/src/app/dashboard/calendar/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/calendar/page.tsx>) |  |
| `/dashboard/circles` | [womencrafts-frontend/frontend/src/app/dashboard/circles/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/circles/page.tsx>) |  |
| `/dashboard/circles/moderation` | [womencrafts-frontend/frontend/src/app/dashboard/circles/moderation/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/circles/moderation/page.tsx>) |  |
| `/dashboard/content` | [womencrafts-frontend/frontend/src/app/dashboard/content/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/content/page.tsx>) |  |
| `/dashboard/doctors` | [womencrafts-frontend/frontend/src/app/dashboard/doctors/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/doctors/page.tsx>) |  |
| `/dashboard/doctors/consultations` | [womencrafts-frontend/frontend/src/app/dashboard/doctors/consultations/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/doctors/consultations/page.tsx>) |  |
| `/dashboard/events` | [womencrafts-frontend/frontend/src/app/dashboard/events/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/events/page.tsx>) |  |
| `/dashboard/feedback` | [womencrafts-frontend/frontend/src/app/dashboard/feedback/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/feedback/page.tsx>) |  |
| `/dashboard/health-videos` | [womencrafts-frontend/frontend/src/app/dashboard/health-videos/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/health-videos/page.tsx>) |  |
| `/dashboard/learning/assessments` | [womencrafts-frontend/frontend/src/app/dashboard/learning/assessments/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/learning/assessments/page.tsx>) |  |
| `/dashboard/learning/assessments/[id]` | [womencrafts-frontend/frontend/src/app/dashboard/learning/assessments/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/learning/assessments/[id]/page.tsx>) | Parameterized route |
| `/dashboard/learning/certificates` | [womencrafts-frontend/frontend/src/app/dashboard/learning/certificates/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/learning/certificates/page.tsx>) |  |
| `/dashboard/learning/digital-steps` | [womencrafts-frontend/frontend/src/app/dashboard/learning/digital-steps/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/learning/digital-steps/page.tsx>) |  |
| `/dashboard/logout` | [womencrafts-frontend/frontend/src/app/dashboard/logout/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/logout/page.tsx>) |  |
| `/dashboard/market/categories` | [womencrafts-frontend/frontend/src/app/dashboard/market/categories/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/categories/page.tsx>) |  |
| `/dashboard/market/group-buys` | [womencrafts-frontend/frontend/src/app/dashboard/market/group-buys/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/group-buys/page.tsx>) |  |
| `/dashboard/market/listings` | [womencrafts-frontend/frontend/src/app/dashboard/market/listings/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/listings/page.tsx>) |  |
| `/dashboard/market/orders` | [womencrafts-frontend/frontend/src/app/dashboard/market/orders/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/orders/page.tsx>) |  |
| `/dashboard/market/rentals` | [womencrafts-frontend/frontend/src/app/dashboard/market/rentals/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/rentals/page.tsx>) |  |
| `/dashboard/market/reviews` | [womencrafts-frontend/frontend/src/app/dashboard/market/reviews/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/reviews/page.tsx>) |  |
| `/dashboard/market/sellers` | [womencrafts-frontend/frontend/src/app/dashboard/market/sellers/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/market/sellers/page.tsx>) |  |
| `/dashboard/masters` | [womencrafts-frontend/frontend/src/app/dashboard/masters/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/masters/page.tsx>) |  |
| `/dashboard/masters/[list]` | [womencrafts-frontend/frontend/src/app/dashboard/masters/[list]/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/masters/[list]/page.tsx>) | Parameterized route |
| `/dashboard/mentors` | [womencrafts-frontend/frontend/src/app/dashboard/mentors/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/mentors/page.tsx>) |  |
| `/dashboard/mentors/requests` | [womencrafts-frontend/frontend/src/app/dashboard/mentors/requests/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/mentors/requests/page.tsx>) |  |
| `/dashboard/messages` | [womencrafts-frontend/frontend/src/app/dashboard/messages/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/messages/page.tsx>) |  |
| `/dashboard/money/ledger` | [womencrafts-frontend/frontend/src/app/dashboard/money/ledger/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/money/ledger/page.tsx>) |  |
| `/dashboard/money/orders` | [womencrafts-frontend/frontend/src/app/dashboard/money/orders/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/money/orders/page.tsx>) |  |
| `/dashboard/money/payout-accounts` | [womencrafts-frontend/frontend/src/app/dashboard/money/payout-accounts/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/money/payout-accounts/page.tsx>) |  |
| `/dashboard/money/referrals` | [womencrafts-frontend/frontend/src/app/dashboard/money/referrals/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/money/referrals/page.tsx>) |  |
| `/dashboard/money/withdrawals` | [womencrafts-frontend/frontend/src/app/dashboard/money/withdrawals/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/money/withdrawals/page.tsx>) |  |
| `/dashboard/notifications` | [womencrafts-frontend/frontend/src/app/dashboard/notifications/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/notifications/page.tsx>) |  |
| `/dashboard/opportunities` | [womencrafts-frontend/frontend/src/app/dashboard/opportunities/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/opportunities/page.tsx>) |  |
| `/dashboard/programs` | [womencrafts-frontend/frontend/src/app/dashboard/programs/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/programs/page.tsx>) |  |
| `/dashboard/reports` | [womencrafts-frontend/frontend/src/app/dashboard/reports/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/reports/page.tsx>) |  |
| `/dashboard/resources` | [womencrafts-frontend/frontend/src/app/dashboard/resources/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/resources/page.tsx>) |  |
| `/dashboard/resources/wellbeing` | [womencrafts-frontend/frontend/src/app/dashboard/resources/wellbeing/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/resources/wellbeing/page.tsx>) |  |
| `/dashboard/safety` | [womencrafts-frontend/frontend/src/app/dashboard/safety/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/safety/page.tsx>) |  |
| `/dashboard/safety/assist-links` | [womencrafts-frontend/frontend/src/app/dashboard/safety/assist-links/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/safety/assist-links/page.tsx>) |  |
| `/dashboard/safety/reports` | [womencrafts-frontend/frontend/src/app/dashboard/safety/reports/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/safety/reports/page.tsx>) |  |
| `/dashboard/services` | [womencrafts-frontend/frontend/src/app/dashboard/services/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/services/page.tsx>) |  |
| `/dashboard/settings` | [womencrafts-frontend/frontend/src/app/dashboard/settings/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/page.tsx>) |  |
| `/dashboard/settings/activity` | [womencrafts-frontend/frontend/src/app/dashboard/settings/activity/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/activity/page.tsx>) |  |
| `/dashboard/settings/appearance` | [womencrafts-frontend/frontend/src/app/dashboard/settings/appearance/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/appearance/page.tsx>) |  |
| `/dashboard/settings/backup` | [womencrafts-frontend/frontend/src/app/dashboard/settings/backup/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/backup/page.tsx>) |  |
| `/dashboard/settings/help` | [womencrafts-frontend/frontend/src/app/dashboard/settings/help/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/help/page.tsx>) |  |
| `/dashboard/settings/integrations` | [womencrafts-frontend/frontend/src/app/dashboard/settings/integrations/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/integrations/page.tsx>) |  |
| `/dashboard/settings/notifications` | [womencrafts-frontend/frontend/src/app/dashboard/settings/notifications/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/notifications/page.tsx>) |  |
| `/dashboard/settings/organisation` | [womencrafts-frontend/frontend/src/app/dashboard/settings/organisation/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/organisation/page.tsx>) |  |
| `/dashboard/settings/profile` | [womencrafts-frontend/frontend/src/app/dashboard/settings/profile/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/profile/page.tsx>) |  |
| `/dashboard/settings/security` | [womencrafts-frontend/frontend/src/app/dashboard/settings/security/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/security/page.tsx>) |  |
| `/dashboard/settings/sessions` | [womencrafts-frontend/frontend/src/app/dashboard/settings/sessions/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/sessions/page.tsx>) |  |
| `/dashboard/settings/support` | [womencrafts-frontend/frontend/src/app/dashboard/settings/support/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/settings/support/page.tsx>) |  |
| `/dashboard/staff` | [womencrafts-frontend/frontend/src/app/dashboard/staff/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/staff/page.tsx>) |  |
| `/dashboard/stories` | [womencrafts-frontend/frontend/src/app/dashboard/stories/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/stories/page.tsx>) |  |
| `/dashboard/support-fund` | [womencrafts-frontend/frontend/src/app/dashboard/support-fund/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/support-fund/page.tsx>) |  |
| `/dashboard/users` | [womencrafts-frontend/frontend/src/app/dashboard/users/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/page.tsx>) |  |
| `/dashboard/users/deletions` | [womencrafts-frontend/frontend/src/app/dashboard/users/deletions/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/deletions/page.tsx>) |  |
| `/dashboard/users/regions` | [womencrafts-frontend/frontend/src/app/dashboard/users/regions/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/regions/page.tsx>) |  |
| `/dashboard/users/roles` | [womencrafts-frontend/frontend/src/app/dashboard/users/roles/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/roles/page.tsx>) |  |
| `/dashboard/users/segments` | [womencrafts-frontend/frontend/src/app/dashboard/users/segments/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/segments/page.tsx>) |  |
| `/dashboard/users/verification` | [womencrafts-frontend/frontend/src/app/dashboard/users/verification/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/users/verification/page.tsx>) |  |
| `/dashboard/work-skills` | [womencrafts-frontend/frontend/src/app/dashboard/work-skills/page.tsx](<../womencrafts-frontend/frontend/src/app/dashboard/work-skills/page.tsx>) |  |

## Authentication, public and other pages

| Browser route | Source | Notes |
| --- | --- | --- |
| `/` | [womencrafts-frontend/frontend/src/app/page.tsx](<../womencrafts-frontend/frontend/src/app/page.tsx>) | Contains a redirect |
| `/accept-invite` | [womencrafts-frontend/frontend/src/app/(auth)/accept-invite/page.tsx](<../womencrafts-frontend/frontend/src/app/(auth)/accept-invite/page.tsx>) |  |
| `/c/[id]` | [womencrafts-frontend/frontend/src/app/(share)/c/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/(share)/c/[id]/page.tsx>) | Parameterized route |
| `/design-system` | [womencrafts-frontend/frontend/src/app/design-system/page.tsx](<../womencrafts-frontend/frontend/src/app/design-system/page.tsx>) |  |
| `/dev/auth-screens` | [womencrafts-frontend/frontend/src/app/dev/auth-screens/page.tsx](<../womencrafts-frontend/frontend/src/app/dev/auth-screens/page.tsx>) |  |
| `/forgot-password` | [womencrafts-frontend/frontend/src/app/(auth)/forgot-password/page.tsx](<../womencrafts-frontend/frontend/src/app/(auth)/forgot-password/page.tsx>) |  |
| `/h` | [womencrafts-frontend/frontend/src/app/h/page.tsx](<../womencrafts-frontend/frontend/src/app/h/page.tsx>) |  |
| `/join/[code]` | [womencrafts-frontend/frontend/src/app/(share)/join/[code]/page.tsx](<../womencrafts-frontend/frontend/src/app/(share)/join/[code]/page.tsx>) | Parameterized route |
| `/mobile-kit` | [womencrafts-frontend/frontend/src/app/mobile-kit/page.tsx](<../womencrafts-frontend/frontend/src/app/mobile-kit/page.tsx>) |  |
| `/pay/[ref]` | [womencrafts-frontend/frontend/src/app/(open)/pay/[ref]/page.tsx](<../womencrafts-frontend/frontend/src/app/(open)/pay/[ref]/page.tsx>) | Parameterized route |
| `/reset-password` | [womencrafts-frontend/frontend/src/app/(auth)/reset-password/page.tsx](<../womencrafts-frontend/frontend/src/app/(auth)/reset-password/page.tsx>) |  |
| `/s/[handle]` | [womencrafts-frontend/frontend/src/app/(open)/s/[handle]/page.tsx](<../womencrafts-frontend/frontend/src/app/(open)/s/[handle]/page.tsx>) | Parameterized route |
| `/shop/[id]` | [womencrafts-frontend/frontend/src/app/(open)/shop/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/(open)/shop/[id]/page.tsx>) | Parameterized route |
| `/signin` | [womencrafts-frontend/frontend/src/app/(auth)/signin/page.tsx](<../womencrafts-frontend/frontend/src/app/(auth)/signin/page.tsx>) |  |
| `/signup` | [womencrafts-frontend/frontend/src/app/(auth)/signup/page.tsx](<../womencrafts-frontend/frontend/src/app/(auth)/signup/page.tsx>) | Contains a redirect |
| `/sos/[id]` | [womencrafts-frontend/frontend/src/app/sos/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/sos/[id]/page.tsx>) | Parameterized route |
| `/story/[id]` | [womencrafts-frontend/frontend/src/app/(share)/story/[id]/page.tsx](<../womencrafts-frontend/frontend/src/app/(share)/story/[id]/page.tsx>) | Parameterized route |
| `/tour` | [womencrafts-frontend/frontend/src/app/tour/page.tsx](<../womencrafts-frontend/frontend/src/app/tour/page.tsx>) |  |
| `/verify-email` | [womencrafts-frontend/frontend/src/app/verify-email/page.tsx](<../womencrafts-frontend/frontend/src/app/verify-email/page.tsx>) |  |
| `/verify/[code]` | [womencrafts-frontend/frontend/src/app/(check)/verify/[code]/page.tsx](<../womencrafts-frontend/frontend/src/app/(check)/verify/[code]/page.tsx>) | Parameterized route |

## Registered backend router families

Source: [main.py](../womencrafts-backend/backend/main.py). Inspect endpoint dependencies and schemas before using an operation.

| API prefix | Registered router | Operations | Registration module gate | Source |
| --- | --- | ---: | --- | --- |
| `/` | `operations_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/operations.py](<../womencrafts-backend/backend/app/routes/operations.py>) |
| `/api/v1` | `market_categories_router` | 2 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/market_categories.py](<../womencrafts-backend/backend/app/routes/market_categories.py>) |
| `/api/v1` | `mentoring_router` | 10 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/mentoring.py](<../womencrafts-backend/backend/app/routes/mentoring.py>) |
| `/api/v1` | `people_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/people.py](<../womencrafts-backend/backend/app/routes/people.py>) |
| `/api/v1` | `reference_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/reference.py](<../womencrafts-backend/backend/app/routes/reference.py>) |
| `/api/v1` | `services_router` | 0 | `services` | [womencrafts-backend/backend/app/routes/services.py](<../womencrafts-backend/backend/app/routes/services.py>) |
| `/api/v1` | `settings_platform_router` | 0 | `settings` | [womencrafts-backend/backend/app/routes/settings_platform.py](<../womencrafts-backend/backend/app/routes/settings_platform.py>) |
| `/api/v1` | `settings_security_router` | 0 | `settings` | [womencrafts-backend/backend/app/routes/settings_security.py](<../womencrafts-backend/backend/app/routes/settings_security.py>) |
| `/api/v1` | `skills_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/skills.py](<../womencrafts-backend/backend/app/routes/skills.py>) |
| `/api/v1` | `social_router` | 19 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/social.py](<../womencrafts-backend/backend/app/routes/social.py>) |
| `/api/v1/admin/community` | `admin_community_router` | 21 | `community` | [womencrafts-backend/backend/app/routes/admin_community.py](<../womencrafts-backend/backend/app/routes/admin_community.py>) |
| `/api/v1/admin/doctors` | `doctors_admin_router` | 7 | `appointments` | [womencrafts-backend/backend/app/routes/doctors.py](<../womencrafts-backend/backend/app/routes/doctors.py>) |
| `/api/v1/admin/growth` | `admin_growth_router` | 24 | `growth` | [womencrafts-backend/backend/app/routes/admin_growth.py](<../womencrafts-backend/backend/app/routes/admin_growth.py>) |
| `/api/v1/admin/health/videos` | `health_videos_admin_router` | 4 | `content` | [womencrafts-backend/backend/app/routes/health_videos.py](<../womencrafts-backend/backend/app/routes/health_videos.py>) |
| `/api/v1/admin/learning` | `admin_learning_router` | 28 | `learning` | [womencrafts-backend/backend/app/routes/admin_learning.py](<../womencrafts-backend/backend/app/routes/admin_learning.py>) |
| `/api/v1/admin/market` | `admin_market_router` | 32 | `market` | [womencrafts-backend/backend/app/routes/admin_market.py](<../womencrafts-backend/backend/app/routes/admin_market.py>) |
| `/api/v1/admin/market/categories` | `market_categories_admin_router` | 5 | `market` | [womencrafts-backend/backend/app/routes/market_categories.py](<../womencrafts-backend/backend/app/routes/market_categories.py>) |
| `/api/v1/admin/masters` | `masters_admin_router` | 6 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/masters.py](<../womencrafts-backend/backend/app/routes/masters.py>) |
| `/api/v1/admin/money` | `admin_money_router` | 23 | `money` | [womencrafts-backend/backend/app/routes/admin_money.py](<../womencrafts-backend/backend/app/routes/admin_money.py>) |
| `/api/v1/admin/notifications` | `admin_notifications_router` | 1 | `dashboard` | [womencrafts-backend/backend/app/routes/admin_notifications.py](<../womencrafts-backend/backend/app/routes/admin_notifications.py>) |
| `/api/v1/admin/onboarding` | `onboarding_admin_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/onboarding.py](<../womencrafts-backend/backend/app/routes/onboarding.py>) |
| `/api/v1/admin/rentals` | `rentals_admin_router` | 4 | `market` | [womencrafts-backend/backend/app/routes/rentals.py](<../womencrafts-backend/backend/app/routes/rentals.py>) |
| `/api/v1/admin/resources` | `admin_resources_router` | 19 | `resources` | [womencrafts-backend/backend/app/routes/admin_resources.py](<../womencrafts-backend/backend/app/routes/admin_resources.py>) |
| `/api/v1/admin/safety` | `admin_safety_router` | 20 | `safety` | [womencrafts-backend/backend/app/routes/admin_safety.py](<../womencrafts-backend/backend/app/routes/admin_safety.py>) |
| `/api/v1/admin/work` | `work_admin_router` | 5 | `growth` | [womencrafts-backend/backend/app/routes/work_talent.py](<../womencrafts-backend/backend/app/routes/work_talent.py>) |
| `/api/v1/ai` | `ai_router` | 9 | `ai` | [womencrafts-backend/backend/app/routes/ai.py](<../womencrafts-backend/backend/app/routes/ai.py>) |
| `/api/v1/analytics` | `analytics_router` | 11 | `analytics` | [womencrafts-backend/backend/app/routes/analytics.py](<../womencrafts-backend/backend/app/routes/analytics.py>) |
| `/api/v1/appointments` | `appointments_router` | 12 | `appointments` | [womencrafts-backend/backend/app/routes/appointments.py](<../womencrafts-backend/backend/app/routes/appointments.py>) |
| `/api/v1/auth` | `auth_app_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/auth_app.py](<../womencrafts-backend/backend/app/routes/auth_app.py>) |
| `/api/v1/auth` | `auth_router` | 29 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/auth.py](<../womencrafts-backend/backend/app/routes/auth.py>) |
| `/api/v1/backups` | `backups_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/backups.py](<../womencrafts-backend/backend/app/routes/backups.py>) |
| `/api/v1/billing` | `billing_router` | 5 | `settings` | [womencrafts-backend/backend/app/routes/billing.py](<../womencrafts-backend/backend/app/routes/billing.py>) |
| `/api/v1/calendar` | `calendar_router` | 9 | `calendar` | [womencrafts-backend/backend/app/routes/calendar.py](<../womencrafts-backend/backend/app/routes/calendar.py>) |
| `/api/v1/catalog` | `catalog_router` | 4 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/catalog.py](<../womencrafts-backend/backend/app/routes/catalog.py>) |
| `/api/v1/community` | `circle_chat_router` | 15 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/circle_chat.py](<../womencrafts-backend/backend/app/routes/circle_chat.py>) |
| `/api/v1/community` | `community_router` | 25 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/community.py](<../womencrafts-backend/backend/app/routes/community.py>) |
| `/api/v1/community` | `share_member_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/public_share.py](<../womencrafts-backend/backend/app/routes/public_share.py>) |
| `/api/v1/community/swap` | `swap_router` | 4 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/swap.py](<../womencrafts-backend/backend/app/routes/swap.py>) |
| `/api/v1/content` | `content_router` | 13 | `content` | [womencrafts-backend/backend/app/routes/content.py](<../womencrafts-backend/backend/app/routes/content.py>) |
| `/api/v1/courses` | `course_qa_router` | 6 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/course_qa.py](<../womencrafts-backend/backend/app/routes/course_qa.py>) |
| `/api/v1/dashboard` | `dashboard_router` | 10 | `dashboard` | [womencrafts-backend/backend/app/routes/dashboard.py](<../womencrafts-backend/backend/app/routes/dashboard.py>) |
| `/api/v1/doctors` | `doctors_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/doctors.py](<../womencrafts-backend/backend/app/routes/doctors.py>) |
| `/api/v1/engines` | `engines_router` | 33 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/engines.py](<../womencrafts-backend/backend/app/routes/engines.py>) |
| `/api/v1/exchange` | `exchange_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/exchange.py](<../womencrafts-backend/backend/app/routes/exchange.py>) |
| `/api/v1/feedback` | `feedback_router` | 13 | `feedback` | [womencrafts-backend/backend/app/routes/feedback.py](<../womencrafts-backend/backend/app/routes/feedback.py>) |
| `/api/v1/group-buy` | `group_buy_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/group_buy.py](<../womencrafts-backend/backend/app/routes/group_buy.py>) |
| `/api/v1/growth` | `growth_router` | 16 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/growth.py](<../womencrafts-backend/backend/app/routes/growth.py>) |
| `/api/v1/growth/mentors` | `mentor_reviews_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/mentor_reviews.py](<../womencrafts-backend/backend/app/routes/mentor_reviews.py>) |
| `/api/v1/haq` | `haq_catalogue_router` | 2 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/haq_catalogue.py](<../womencrafts-backend/backend/app/routes/haq_catalogue.py>) |
| `/api/v1/health/videos` | `health_videos_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/health_videos.py](<../womencrafts-backend/backend/app/routes/health_videos.py>) |
| `/api/v1/internal/engines` | `engines_internal` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/engines.py](<../womencrafts-backend/backend/app/routes/engines.py>) |
| `/api/v1/layout` | `layout_router` | 11 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/layout.py](<../womencrafts-backend/backend/app/routes/layout.py>) |
| `/api/v1/market` | `market_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/market.py](<../womencrafts-backend/backend/app/routes/market.py>) |
| `/api/v1/masters` | `masters_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/masters.py](<../womencrafts-backend/backend/app/routes/masters.py>) |
| `/api/v1/me` | `home_router` | 2 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/home.py](<../womencrafts-backend/backend/app/routes/home.py>) |
| `/api/v1/me` | `me_export_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/me_export.py](<../womencrafts-backend/backend/app/routes/me_export.py>) |
| `/api/v1/me` | `me_messages_router` | 11 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/me_messages.py](<../womencrafts-backend/backend/app/routes/me_messages.py>) |
| `/api/v1/me` | `me_router` | 38 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/me.py](<../womencrafts-backend/backend/app/routes/me.py>) |
| `/api/v1/me` | `my_records_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/my_records.py](<../womencrafts-backend/backend/app/routes/my_records.py>) |
| `/api/v1/me` | `onboarding_router` | 12 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/onboarding.py](<../womencrafts-backend/backend/app/routes/onboarding.py>) |
| `/api/v1/me/books` | `books_router` | 6 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/books.py](<../womencrafts-backend/backend/app/routes/books.py>) |
| `/api/v1/me/cycle` | `cycle_router` | 10 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/cycle.py](<../womencrafts-backend/backend/app/routes/cycle.py>) |
| `/api/v1/me/goals` | `goals_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/goals.py](<../womencrafts-backend/backend/app/routes/goals.py>) |
| `/api/v1/me/haq` | `haq_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/haq.py](<../womencrafts-backend/backend/app/routes/haq.py>) |
| `/api/v1/me/health` | `health_hub_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/health_hub.py](<../womencrafts-backend/backend/app/routes/health_hub.py>) |
| `/api/v1/me/health/files` | `health_files_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/health_files.py](<../womencrafts-backend/backend/app/routes/health_files.py>) |
| `/api/v1/me/incase` | `incase_router` | 2 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/incase.py](<../womencrafts-backend/backend/app/routes/incase.py>) |
| `/api/v1/me/journeys` | `journeys_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/journeys.py](<../womencrafts-backend/backend/app/routes/journeys.py>) |
| `/api/v1/me/khata` | `khata_router` | 26 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/khata.py](<../womencrafts-backend/backend/app/routes/khata.py>) |
| `/api/v1/me/kitchen` | `kitchen_router` | 4 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/kitchen.py](<../womencrafts-backend/backend/app/routes/kitchen.py>) |
| `/api/v1/me/money` | `money_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/money.py](<../womencrafts-backend/backend/app/routes/money.py>) |
| `/api/v1/me/payout` | `payout_router` | 5 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/payout.py](<../womencrafts-backend/backend/app/routes/payout.py>) |
| `/api/v1/me/portfolio` | `portfolio_router` | 6 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/portfolio.py](<../womencrafts-backend/backend/app/routes/portfolio.py>) |
| `/api/v1/me/school` | `school_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/school.py](<../womencrafts-backend/backend/app/routes/school.py>) |
| `/api/v1/me/standing` | `standing_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/standing.py](<../womencrafts-backend/backend/app/routes/standing.py>) |
| `/api/v1/me/together` | `together_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/together.py](<../womencrafts-backend/backend/app/routes/together.py>) |
| `/api/v1/me/vault` | `vault_router` | 15 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/vault.py](<../womencrafts-backend/backend/app/routes/vault.py>) |
| `/api/v1/me/week` | `week_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/week.py](<../womencrafts-backend/backend/app/routes/week.py>) |
| `/api/v1/member-content` | `member_content_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/content.py](<../womencrafts-backend/backend/app/routes/content.py>) |
| `/api/v1/members` | `members_router` | 20 | `users` | [womencrafts-backend/backend/app/routes/members.py](<../womencrafts-backend/backend/app/routes/members.py>) |
| `/api/v1/messages` | `messages_router` | 12 | `messages` | [womencrafts-backend/backend/app/routes/messages.py](<../womencrafts-backend/backend/app/routes/messages.py>) |
| `/api/v1/money` | `money_overview_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/wallet.py](<../womencrafts-backend/backend/app/routes/wallet.py>) |
| `/api/v1/notifications` | `notifications_router` | 10 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/notifications.py](<../womencrafts-backend/backend/app/routes/notifications.py>) |
| `/api/v1/onboarding` | `onboarding_skills_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/onboarding.py](<../womencrafts-backend/backend/app/routes/onboarding.py>) |
| `/api/v1/org` | `org_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/org.py](<../womencrafts-backend/backend/app/routes/org.py>) |
| `/api/v1/payments` | `payments_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/payments.py](<../womencrafts-backend/backend/app/routes/payments.py>) |
| `/api/v1/programs` | `programs_router` | 17 | `programs` | [womencrafts-backend/backend/app/routes/programs.py](<../womencrafts-backend/backend/app/routes/programs.py>) |
| `/api/v1/public` | `public_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/public.py](<../womencrafts-backend/backend/app/routes/public.py>) |
| `/api/v1/public` | `public_share_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/public_share.py](<../womencrafts-backend/backend/app/routes/public_share.py>) |
| `/api/v1/regions` | `regions_router` | 4 | `users` | [womencrafts-backend/backend/app/routes/regions.py](<../womencrafts-backend/backend/app/routes/regions.py>) |
| `/api/v1/rentals` | `rentals_router` | 19 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/rentals.py](<../womencrafts-backend/backend/app/routes/rentals.py>) |
| `/api/v1/reports` | `reports_router` | 5 | `reports` | [womencrafts-backend/backend/app/routes/reports.py](<../womencrafts-backend/backend/app/routes/reports.py>) |
| `/api/v1/roles` | `roles_router` | 12 | `users` | [womencrafts-backend/backend/app/routes/roles.py](<../womencrafts-backend/backend/app/routes/roles.py>) |
| `/api/v1/safety` | `safety_router` | 9 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/safety.py](<../womencrafts-backend/backend/app/routes/safety.py>) |
| `/api/v1/sakhi` | `sakhi_router` | 17 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/sakhi.py](<../womencrafts-backend/backend/app/routes/sakhi.py>) |
| `/api/v1/saved` | `saved_router` | 3 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/saved.py](<../womencrafts-backend/backend/app/routes/saved.py>) |
| `/api/v1/search` | `search_router` | 1 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/search.py](<../womencrafts-backend/backend/app/routes/search.py>) |
| `/api/v1/segments` | `segments_router` | 6 | `users` | [womencrafts-backend/backend/app/routes/segments.py](<../womencrafts-backend/backend/app/routes/segments.py>) |
| `/api/v1/shop` | `shop_router` | 18 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/shop.py](<../womencrafts-backend/backend/app/routes/shop.py>) |
| `/api/v1/staff` | `staff_account_router` | 18 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/staff_account.py](<../womencrafts-backend/backend/app/routes/staff_account.py>) |
| `/api/v1/staff` | `staff_router` | 12 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/staff.py](<../womencrafts-backend/backend/app/routes/staff.py>) |
| `/api/v1/teach` | `teach_router` | 10 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/teach.py](<../womencrafts-backend/backend/app/routes/teach.py>) |
| `/api/v1/theme` | `theme_router` | 7 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/theme.py](<../womencrafts-backend/backend/app/routes/theme.py>) |
| `/api/v1/uploads` | `uploads_router` | 4 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/uploads.py](<../womencrafts-backend/backend/app/routes/uploads.py>) |
| `/api/v1/users` | `users_router` | 2 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/users.py](<../womencrafts-backend/backend/app/routes/users.py>) |
| `/api/v1/verification` | `verification_router` | 17 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/verification.py](<../womencrafts-backend/backend/app/routes/verification.py>) |
| `/api/v1/wallet` | `wallet_router` | 6 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/wallet.py](<../womencrafts-backend/backend/app/routes/wallet.py>) |
| `/api/v1/work` | `work_talent_router` | 16 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/work_talent.py](<../womencrafts-backend/backend/app/routes/work_talent.py>) |
| `/api/v1/work/employers` | `employers_router` | 4 | Endpoint-specific; inspect source | [womencrafts-backend/backend/app/routes/employers.py](<../womencrafts-backend/backend/app/routes/employers.py>) |

## Developer reference

- Interactive local API docs: `http://localhost:8020/docs`; schema: `http://localhost:8020/openapi.json`.
- Frontend member navigation: [nav-tree.ts](../womencrafts-frontend/frontend/src/components/ux/nav-tree.ts).
- Frontend staff navigation: [Sidebar.tsx](../womencrafts-frontend/frontend/src/components/layout/Sidebar.tsx).
- Frontend permission catalogue: [modules.ts](../womencrafts-frontend/frontend/src/lib/modules.ts).
- Backend validation contracts: `womencrafts-backend/backend/app/schemas/`.
- For source changes, regenerate this inventory and update the prose guide when behaviour changes.

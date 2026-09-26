# WomSakhi member journey — Step 2

Date: 26 September 2026

## Outcome

The signed-in member journey now passes the production route audit on desktop and phone.

| Measure | Result |
| --- | ---: |
| Member page files | 150 |
| Parameterized route families | 20 |
| Concrete destinations exercised | 167 |
| Desktop and phone checks | 334 |
| Final route-level findings | 0 |
| Explicit unfinished shop destinations | 7 |

The raw route-by-route evidence is in `docs/member-journey-step-02.json`. It records the requested route, final route, document status, heading and landmark structure, content size, lingering loaders, overflow, unnamed controls, unlabelled fields, API failures, console errors, forms, and buttons for every visited destination.

## Coverage

- Every non-parameterized member route was opened against a production build.
- Real records were followed for bookings, circles, shop orders, products, services, events, skill exchanges, market listings, mentors, opportunities, programmes, lessons, stories, schemes, and rights.
- Transaction-only destinations were seeded from read APIs so checkout, savings-circle contribution, catalogue programme details, and catalogue service details were included without inventing IDs.
- Both 1440×900 desktop and 390×844 phone layouts were checked.
- Booking back behavior was verified from the bookings list and as a cold deep link.
- A catalogue service was booked through the UI, opened through its generated booking detail route, and cancelled through the UI. The create and cancel requests both completed successfully.
- The three intentional compatibility redirects resolve correctly: `/app/progress` to Journey, `/app/progress/goals` to Goals, and `/app/together/learn` to Library.

## Changes completed

### Session consistency

- Browser API calls now use the same-origin `/api/v1` gateway.
- Server-side API calls use `INTERNAL_API_URL`.
- CLI checks understand the split between the public relative URL and internal absolute URL.
- This removes the local cross-origin session split that could combine a member frontend identity with an older administrator API cookie.

### Broken member journeys

- Replaced the invalid service-to-mentor redirect. A catalogue service now has an API-backed detail screen with date, time, and mode choices, booking confirmation, and links to the created booking and calendar.
- Event details now load through the event-by-ID endpoint. Past-event links from notifications, circles, or saved content no longer fail because the upcoming-events list omitted them.
- Corrected “add product or service” links to use the real four-step `/app/documents/new` flow.
- Restored correct booking back behavior for list navigation and cold deep links.

### Accessibility and page structure

- Added or corrected page titles for Home, daily wellbeing, travel journey, skill-exchange detail, story detail, notifications, and the cycle check screen.
- Removed duplicate responsive page titles where desktop and phone headings overlapped.
- Named circle icon links and product-photo controls.
- Corrected the journey audit so fields wrapped by a `<label>` are recognized as labelled.

### Rendering reliability

- Removed locale-dependent server/browser date differences from Wellness and You by using an explicit `en-IN` locale and `Asia/Kolkata` time zone.
- This removed the production hydration errors on both screens.
- The route audit now waits for hydrated loading states and discovers a bounded sample of real dynamic records instead of crawling every database row.

## Deliberately unfinished member capabilities

Seven shop destinations clearly identify that they do not yet have transactional backends:

1. Dispute mediation
2. Live selling
3. Preorders and material deposits
4. Delivery time slots
5. Subscriptions
6. Voice-created listings
7. Wholesale quotes

These screens remain useful guidance and do not pretend that an operation was completed. They are marked in the DOM and reported separately by the journey audit. Their real APIs and workflows remain required before those capabilities can be advertised as launched.

Other known product gaps from Step 1 remain scheduled for later implementation steps, including device-session history, mentor-request withdrawal, message and circle-file attachments, emailed statements, shared travel journeys, richer goal operations, creche visit recording, automation dispatch, and production-safe removal of demo data and mock fallbacks.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Pass |
| Production build | Pass; existing experimental CSS warnings remain |
| Member navigation map | Pass; 150 routes, 122 navigation nodes |
| Booking back flow | Pass |
| Member journey audit | Pass; 334 checks, 167 destinations, 0 findings |
| Service create/open/cancel transaction | Pass |

## Next step

Step 3 should make all production data behavior safe: prevent demo seeding in production, remove silent mock fallback from member transactional screens, render explicit offline/error/empty states, and add regression coverage for member/admin role switching through the same-origin session gateway.

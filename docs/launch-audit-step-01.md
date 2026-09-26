# WomSakhi launch audit — Step 1

Date: 26 September 2026

## Scope inspected

- Installable Next.js 16 PWA in `womencrafts-frontend/frontend`
- FastAPI and MongoDB backend in `womencrafts-backend/backend`
- Authentication, sessions, RBAC, staff administration, reminders, notifications, automation engines, payments, email, AI, uploads, media, and production configuration
- Member and administrator navigation and representative desktop/mobile flows
- Existing automated checks, backend tests, TypeScript validation, and the production build

This repository does not contain Android or iOS native projects. The product currently ships as an installable responsive PWA.

## Current system size

| Area | Count |
| --- | ---: |
| Frontend routed pages | 226 |
| Member pages | 150 |
| Admin pages | 59 |
| Frontend API client modules | 60 |
| Backend route modules | 73 |
| Registered backend routers | 74 |
| Backend API operations | about 702 |
| Backend model modules | 50 |
| Backend schema modules | 49 |
| Backend test files | 9 |
| Route loading states | 199 |
| Route error states | 193 |

## What is already strong

- The clean member sign-in flow works and lands on a real, API-backed Home screen.
- A clean member session is redirected away from `/dashboard`, and direct member calls to tested admin APIs return `403`.
- The production frontend build completes successfully, and TypeScript passes.
- The API smoke check exercised 267 GET endpoints with no server errors: 207 succeeded and 58 were correctly authentication-gated.
- The member navigation map passes its structural check: 150 routes, 122 named navigation nodes, and no node points to a missing route.
- The backend has meaningful RBAC, per-permission guards, staff invitation tokens, last-Super-Admin protection, audit recording, request IDs, security headers, idempotency helpers, and ownership tests.
- Staff creation, invitation acceptance, role changes, per-person permission grants/denials, suspension, restoration, and session invalidation are implemented.
- The PWA service worker deliberately avoids caching private HTML and API responses, which is appropriate for shared phones.
- The accessibility static check found no nameless controls, heading jumps, or pages without a language declaration.
- Media URLs are stored without environment-specific hostnames, and the media round-trip check passed.

## Launch blockers

### 1. Scheduled automation is disabled

`ENGINES_ENABLED` is not configured and defaults to `false`. Reminders can be created, stored, and listed, but the tick does not dispatch them. Mood-based nudges and other scheduled automation cannot meet the launch requirement until the engine is enabled and a production scheduler calls the tick and sweep endpoints.

### 2. Production services are still in development mode

The backend currently reports these production blockers:

- Payment webhook secret is unset or a development placeholder.
- Payments use the sandbox provider, so no real payment moves.
- Mailgun uses a sandbox domain; most users cannot receive verification or password-reset email.
- `APP_BASE_URL` still points to `http://localhost:3100`, so emailed links would point to a developer machine.
- The environment defaults to `development`.

The document-encryption key, Anthropic key, Azure Speech settings, and VAPID keys are present locally, but production values and deployment ownership still need verification.

### 3. Demo seeding and fallbacks can reach production paths

The application calls `seed_all()` on every backend startup, including production. Empty collections are filled with demo records. The general frontend data hook is also designed to fall back to mock data when an endpoint fails or does not exist. These behaviours conflict with the requirement that launch data be real and API-backed. Production must refuse demo seeding and must render explicit loading, empty, offline, or error states instead of silently substituting fixtures.

### 4. Session origin configuration is inconsistent

The session design and Next.js rewrite expect browser API calls to use the relative `/api/v1` path. The active `.env.local` overrides this with `http://localhost:8020/api/v1`.

During the audit, an existing administrator session and a member sign-in produced a split experience: the member shell showed Priya, Home failed to fetch, and the administrator dashboard could still load through the API session. After an explicit logout and clean member sign-in, Home loaded correctly and `/dashboard` redirected back to `/app`.

This must be fixed and covered by role-switching tests. A browser must never retain or combine member and administrator identity across frontend and API origins.

### 5. Important user journeys are explicitly unfinished

Confirmed missing or local-only operations include:

- Seven shop capability pages use the shared `NotYetScreen`: disputes, live selling, preorders, subscriptions, voice selling, wholesale, and delivery slots. There are 15 `NotYetScreen` references across those pages.
- Quote creation is carried only through `sessionStorage`; there is no quote endpoint.
- Travel journey planning is stored in `localStorage`; there is no journey-sharing backend.
- Message attachment selection exists, but there is no attachment upload endpoint.
- Circle files have no files endpoint.
- Mentor requests cannot be withdrawn through a member API.
- Statements cannot be emailed because there is no send-statement endpoint.
- The family/childcare flow cannot record a creche visit.
- Goal completion exists, but notes, goal renaming, and a goal detail screen are missing.
- Admin reports are generated manually; scheduled or emailed report delivery does not exist.

### 6. Administrator assignment scope is not implemented

The staff system supports roles, module access, and granular permissions. It does not currently model or enforce assignments by region, category, organization/community, or selected members. Staff create/update payloads contain name, email, role, and phone only. There are no assignment scope fields or matching server-side filters.

This means the requested Regional Admin, Category Admin, and selected-member administration model is not yet implemented.

## High-priority quality findings

### Routing and back behaviour

- The structural member navigation map passes.
- Five routes intentionally redirect to another canonical route.
- The back-flow check confirmed that `bookings → booking` has no back control before the broader browser check timed out.
- Direct feature links and notification destinations still require live traversal in Step 2, especially routes that currently redirect or share a main-module screen.

### Forms and time-saving input

- The project has reusable Input and Select primitives and several API-backed option lists.
- Across app and component code there are 43 files using the design-system Select, 77 files with text inputs, and only two searchable/combobox implementations.
- There is no shared searchable, paginated, multi-select component for large member, administrator, region, category, country, or content lists.
- Region/category/member assignment reference APIs are not complete enough to drive the requested dependent dropdown flows.
- Several admin forms still accept category, city, description, audience, or member information as free text.

### Visual consistency and assets

- The token check reports 719 literal colours, including 24 undefined token usages.
- The type-scale check reports 606 arbitrary font sizes.
- The icon check reports 12 unregistered icons that can render as blank circles.
- One mobile hero asset fails the image-quality threshold: `circle-dashboard-hero-mobile.webp` is 1100×549, below the repository's required pixel area.
- The frontend contains 191 visual asset files and the public directory is about 85 MB; several individual PNG files exceed 1 MB and require mobile optimization.
- The production build succeeds but reports seven CSS warnings for unsupported `::scroll-button(...)` syntax in `src/app/ux/mobile.css`.

### Feedback and errors

- The feedback check found an unannounced share confirmation and `window.prompt()` in the Safety screen.
- Cycle logging stores an error twice but never renders it, so a failed write is invisible to the member.
- The shared Home hook catches the original request error and returns `null`, which removes the diagnostic reason and makes a failed request look like empty data.
- Two full-screen waits in `MemberShell.tsx` have no explanatory text.

### Localization

- Hindi and Telugu have complete navigation and screen coverage in the current check.
- Several other advertised languages have core strings but effectively no navigation or screen translation coverage.
- Sixteen navigation keys are missing English `.label` entries.
- Languages shown as “coming soon” need a clear launch policy so users are not offered an incomplete experience.

### Tests

- Backend result: 262 passed, 2 failed, and 2 skipped.
- Both failures are marketplace quote/range-order tests. A new seller eligibility lookup reaches the database before the test's expected quote-order rejection.
- The two skipped tests require a live throwaway MongoDB database and are not covered in CI.
- Nine backend test files cover a backend with roughly 702 operations, leaving substantial CRUD, permission-scope, automation, payment, and end-to-end behaviour unverified.
- The back-flow browser check exposed one missing control and later timed out while navigating the development server. Other browser checks also became unreliable under parallel load, so they must be rerun serially against the production build.

## Verification summary

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass |
| Backend compile | Pass |
| Production frontend build | Pass with 7 CSS warnings |
| API smoke check | Pass; 267 GET operations, 0 server errors |
| Backend pytest | 262 pass, 2 fail, 2 skip |
| Member navigation structure | Pass |
| Static accessibility check | Pass |
| Media URL and upload round trip | Pass |
| Image-quality check | Fail: 1 asset |
| Feedback consistency | Fail: 3 issues |
| Tokens/type/icons/i18n aggregate | Fail |
| Back-flow check | Fail: missing booking-detail back control; later timed out |

## Required external items before launch

These are not needed to begin implementation, but they are required before a real launch:

1. Production domain names for the app and API, plus the final cookie domain.
2. Verified email-sending domain and production Mailgun or SMTP credentials.
3. Razorpay production key ID, secret, and webhook-signing secret if real payments launch now.
4. Production scheduler/IAM configuration for reminder tick and sweep calls.
5. Final legal owner-approved privacy, terms, support, emergency, and account-deletion wording.
6. App-store packaging/accounts only if WomSakhi must ship as native Android/iOS; the current repository is a PWA.

## Recommended order after this audit

Step 2 should run the complete member journey serially against a stable production build and record every route, action, API call, error state, and missing transition. The first implementation work after that should address session consistency, production-safe data behaviour, automation enablement, and the unfinished transactional flows before visual redesign expands across all nested screens.

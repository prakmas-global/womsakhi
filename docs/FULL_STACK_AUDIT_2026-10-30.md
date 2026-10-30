# Full-stack audit — 30 October 2026

## Scope

Reviewed and exercised the Next.js member app, staff dashboard, FastAPI API,
MongoDB persistence, audience routing, session switching, navigation, forms,
shop workflows, circles, goals, wellbeing and reminders. Mutation checks used
synthetic accounts in a separate local MongoDB database, not the configured
Atlas database. The normal development app remains on port 3100.

This is an audit of the checked flows and configurations, not a guarantee
against every possible defect or confirmation of production-provider delivery.

## Changes

- Home work recommendations now pass every filter to the composed backend
  call. Previously FastAPI `Query` objects reached the work-filter logic and
  the Home block silently became unavailable.
- Monthly health reminders advance after today's delivery time has passed.
  Recovery no longer leaves the rule missing until the next day's sweep.
  Regression cases cover month-end dates, year changes, lead times and snoozes.
- Post deletion, friend removal, work-gallery removal and chit actions use the
  shared confirmation dialog. Pending confirmations resolve safely when
  replaced or unmounted. Cancel and Escape preserve the record.
- Authenticator-key clipboard failures and audio playback failures give usable
  feedback. Onboarding progress is announced to assistive technology.
- The optional profile-completion prompt is suppressed on help, safety and
  other focused routes even when it was already open before navigation.
- Banners preserve their shared dimensions while keeping mobile actions
  reachable. Photo decoration no longer creates a banner scrollbar; Learn's
  benefits sit below the banner. Home artwork retains its complete composition.
- Dark-mode primary buttons and selected brand controls use the theme's
  foreground token instead of fixed white text on the lighter brand fill.
- Appointments cards can shrink on small screens. The Programs table anchors
  positioned content within its local scrolling area. The tour clips its slide
  animation without preventing its internal navigation from scrolling.
- Health setup, circle chats, course cards, resource cards, Search and Settings
  have an appropriate page-heading hierarchy. Legacy routes and account setup
  screens have navigation-tree parents without duplicate visible menu items.
- Shared audit authentication now uses OTP endpoints and explicit development
  test accounts. Removed the obsolete password-login dependency from the
  session, shop and circle checks. Browser-free fast checks stay browser-free.
- Audit measurements recognize wrapping labels, decorative hidden controls,
  photo-backed captions, settled tour animations and collapsed desktop rails.

## Verification

| Check | Result |
|---|---|
| Backend suite with local MongoDB | 716 passed, 3 skipped |
| Home/work/health integration regressions | 30 passed |
| TypeScript | Passed |
| Production compilation | Passed |
| API inventory | 354 GET endpoints visited: 350 successful, 3 access-gated, 1 requires suggestion input |
| Member/staff session switching | 13/13 passed |
| Shop operations | 37/37 passed |
| Circle payload persistence | 8/8 passed |
| Goals, wellbeing and reminders | 19/19 passed |
| Draft recovery after reload | Circle and listing forms passed |
| Destructive-action browser checks | Cancel, Escape and one confirmed deletion passed at desktop and phone widths |
| Home banner | 9 checks passed |
| Navigation inventory | 200 member routes, 150 nodes; all destinations have parents |
| Image quality | 77 referenced assets passed |
| Live-data adapters | 7 checked files have no silent demo-data fallback |
| Feedback consistency | Passed |
| Final affected-route heading/layout rechecks | 24 passed |
| Distinct dark-mode contrast rechecks | 6 screens passed |
| Programs, Appointments and tour overflow | Zero page-level sideways scrolling at 390px and 820px |

The broad production sweep exercised 238 static Admin and Member routes at
desktop light, desktop dark, tablet and phone sizes: **952 combinations**, with
no uncaught page exceptions or failed document loads. A separate member crawl
covered **202 unique destinations / 404 desktop-and-phone checks**, including
real detail links. The sweeps exposed the accessibility, contrast and layout
issues above; focused rechecks verify the affected screens after their fixes.
The final source was also typechecked and compiled.

Flat-background contrast is measured using browser-resolved colors. Text over
photography and gradients needs visual review and is not declared compliant by
an ancestor-background approximation.

## Remaining limits and maintenance findings

- Repository-wide lint still reports existing React effect/ref/memoization
  issues and warnings (70 errors and 72 warnings in the final lint run). The
  literal-color/token check also has existing debt.
  These checks are not represented as passing.
- Email inbox delivery, Firebase SMS, live payment settlement, external AI
  responses and production scheduler delivery were not independently verified.
  The API audit leaves the AI time-suggestion endpoint without a query rather
  than making a paid provider call. Internal engine and entitlement-gated
  endpoints correctly remain unavailable to ordinary audit sessions.
- The backend has three explicit skipped tests. The standard local app still
  uses sandbox payments, disabled scheduled automation and keyword matching
  when the optional semantic-matching dependency is absent.
- Browser navigation and GET sweeps do not substitute for every possible
  transaction. Persistence and ownership behavior are additionally exercised
  by the local database-backed backend suite and the specific flow checks.

See `womencrafts-frontend/frontend/checks/README.md` for the OTP-based audit
setup. Temporary diagnostic ledgers were written under `/tmp`; they contain
audit-account results, not production-account exports.

## Startup, contextual encouragement and home pathways

The opening MP4 deliberately held the page for approximately six seconds and replayed after extended time away. Replaced it with the existing static welcome artwork, a brief fade and a one-second hard stop independent of hydration. It appears once per tab, skips reduced-motion/data-saving preferences, and no longer replays when returning to the tab. Development route compilation and backend/network latency remain separate costs.

Fresh-tab Chrome measurements against the normal development app (`/signin`, same local machine; not a production or slow-network benchmark):

| Run | Before HTML / usable | After HTML / usable | Opening video requests before / after |
| --- | --- | --- | --- |
| 1 | 206 / 7,096 ms | 400 / 1,135 ms | 1 / 0 |
| 2 | 143 / 6,917 ms | 106 / 789 ms | 1 / 0 |

Added a shared quote section to member and permitted staff pages, including pages whose banners previously suppressed encouragement. It selects from 36 original WomSakhi lines across 12 topics, with English and Hindi copy, stable initial selection, another-thought and native-share/clipboard controls. Removed the old duplicate quote from supporting rails. New sections have a synchronized, locally saved English/हिन्दी switch because Hindi is currently unavailable as a whole-app language; this does not enable an incomplete global catalogue.

Home now offers three practical paths: learn a skill, sell or teach, and work from home. Each has three links into existing modules. The remote-work link initializes the work board with Remote and All work on its first API request. The opportunities server wrapper validates URL values before passing initial filters to its existing client screen. Mobile Home now distinguishes loading from failure and offers retry plus useful pathways during failures; it no longer displays a skeleton forever after a failed home request. Guidance recognizes unpaid household work, lets women choose their own pace and avoids income promises.

Validation completed against an isolated local audit API/database, with synthetic member and staff accounts:

- Production build and final TypeScript check passed; targeted ESLint passed for new quote/language/pathway components, splash code and opportunities wrapper.
- Twelve focused browser assertions passed: mobile home content, quote rotation and copying, first-request Remote filtering, synchronized Hindi controls, five contextual module quotes with mobile width checks, staff quote, injected home failure/retry recovery, and no uncaught runtime errors.
- Eight layout checks passed at 390px and 1440px across Home, Learn, Work and Messages; reduced-motion welcome bypass passed.
- Normal frontend on port 3100 and backend on port 8020 remain running. Audit services were isolated; normal account data and email delivery were not modified for these checks.


## Form controls and store showcase gallery

Updated the shared member/admin controls and global focus rules on 30 October 2026:

- Replaced custom image cursors with standard arrow, pointer and text cursors. Typing carets follow text colour; disabled controls use the disabled cursor.
- Shared fields now use flat surfaces, one theme-aware focus halo and consistent invalid borders. Compound fields highlight their outer frame, with no second outline on the inner input. Focus no longer changes corner radius.
- Native required semantics and caller-provided descriptions are retained by design-system inputs. Member text/area controls accept native field options, hints and errors; mobile fields retain at least 16px text. Bound selects expose touched validation, disabled state and accessible combobox semantics.
- Store settings use a real submit form for name/tagline, length hints, organisation autofill, busy-state controls and a retry state on load failure. Existing logo/cover uploads have clearer guidance and controls.
- Added an ordered store gallery capped at eight photos, multi-file upload, per-file resizing/progress, automatic incremental saves, reorder/removal and buyer-facing image viewing. The API persists normalized media paths, returns gallery URLs and invalidates the public-shop cache after edits. Removed the extra Next public-shop cache so it cannot hide saved changes behind a second cache.
- Store logo/cover/gallery references now prevent deletion of their still-used uploads from the media library.

Validation:

- Source scan found 123 page files declaring field controls; checked 109 statically addressable form-related routes, including supplementary shared-form destinations. Dynamic-ID pages and every conditional wizard/modal state were not exhaustively driven in this pass.
- Final combined browser results: 109 routes, 150 visible fields, no observed runtime errors, missing focus treatment, changing focus corner radius or horizontal overflow in those checked states.
- Explicit light/dark and mobile/desktop checks verified normal, invalid and disabled field states on member/staff surfaces. Screenshots were visually inspected.
- Real browser uploads verified cover selection, two-photo upload, persisted ordering, reload, removal, anonymous public visibility, fresh public data after an edit, keyboard image navigation and Escape dismissal.
- Backend: 23 tests passed across `test_store.py`, `test_listing_media.py` and `test_upload_ownership.py`, using local test data. Added regression coverage for gallery persistence, limits, public-cache invalidation, isolation, clearing and protection of store media in use.
- Targeted frontend ESLint passed. Production validation used `npm run build -- --webpack`; the default Turbopack production builder failed on an existing Playfair Display font import in the developer auth-screen gallery. An earlier build of the form changes succeeded before generated build output was cleared; the final Webpack result is the relevant final-source check.

During the broad check, local disk space ran out. Removed disposable audit builds and cleared a 23 GB generated development cache with the frontend stopped, then restarted it. The test MongoDB and temporary compiler were restarted after that failure; affected checks were rerun. Normal account data and environment configuration were not changed for the audit. The app remains available on port 3100 with its normal backend on port 8020.


## Three core journeys and release operations

Product scope confirmed: English for this release; bank payouts and additional languages are later work, and the native mobile app is developed in parallel.

- Home offers Learn a skill, Sell something and Work from home. Each has one primary next action and an expandable three-step guide. The goal preference survives reload locally; progress is derived from member-owned backend records through `/api/v1/me/journeys`. No successful activity is invented when progress cannot load. Missing course records are excluded from active resume links.
- Courses accept the Free filter from the Home action. Remote-work navigation retains its first-request Remote/All work filter and does not require profile completion before browsing. Main course, shop, work and application screens provide a return trail.
- The default Turbopack production build now passes. Removed the redundant developer-gallery Playfair font and set explicit frontend build/tracing roots. The standalone artifact has `server.js` at its root and was served with copied public/static assets, matching the Docker packaging layout.
- Added independent web/API liveness and dependency-readiness endpoints, bounded process-local Prometheus metrics behind `MONITORING_TOKEN`, a read-only probe CLI, and prepared scrape/alert configuration. Health and metrics never return connection strings or credentials.
- Expanded the explicit application full-backup set to include core shop/work records. An isolated restore drill checks persisted learning, user-store cover/gallery references, listings, work profiles and applications plus sample public/private file hashes. This does not establish managed cloud snapshots, PITR, object retention or production RTO/RPO.
- PR CI now provisions local MongoDB and runs the backend regression suite/recovery drill; it also checks the standalone server entrypoint. Deployment configuration declares startup/liveness/readiness probes and checks dependency readiness after rollout. Optional monitoring-secret binding is controlled by the repository variable `MONITORING_SECRET_NAME`, containing a secret name rather than its value.

Validation evidence:

- Default production build passed with Turbopack, including TypeScript.
- Complete backend suite: **730 passed, 3 skipped**; the three skips are the existing development-docs and explicitly disabled policy cases. The expanded restore drill was rerun successfully after adding store references and separate file paths.
- Production standalone web server: ten recorded browser cases passed at 390px and 1440px for primary actions, return paths, saved goal, Free and first-request Remote filters, actionable progress failure and no runtime/static-chunk errors. The browser test is read-only and does not itself submit a new enrolment, publish a listing or send a work application.
- Real isolated API outage: web liveness remained HTTP 200, web readiness returned HTTP 503, then readiness returned HTTP 200 after the API restarted without restarting the web server. The same-process MongoDB unavailable/recovered readiness transition is covered by a backend regression test.
- Healthy production-web/API probes and protected metrics checks passed. Workflow and monitoring YAML parsed, and workflow shell blocks passed `bash -n`; alert delivery and cloud service configuration were not executed.

See [Production operations](PRODUCTION_OPERATIONS.md) for reproducible commands and deployment boundaries. No production traffic changes, destructive production restores or external alert messages were performed.

## Unified personal money workspace

Replaced the competing My Khata and household-money entry screens with one My Money workspace at `/app/money`. It has Money in & out, Bills & plans, and Notes. Navigation, earning cards and rental references use the same name. Old notebook links redirect, while chits and business customer dues remain linked specialist tools.

Monthly summaries show received, spent and their difference, with an explanation that the difference is not a cash or bank balance. Future bills do not count as spending. Recording a bill as paid creates one linked expense with a chosen payment date. The expense is the canonical payment state; deterministic IDs and atomic upserts prevent retry duplication. Undo deletes that expense and reopens the bill. Existing paid flags remain completed without creating historical expenses. Linked entries/bills cannot be edited or removed directly before undoing their payment record.

Existing note, entry, plan and PIN collections are retained without copying records. The bill APIs now honor the notebook PIN. Hide amounts covers the entire workspace. Unavailable notebook, plan and note responses show retry states rather than an empty-success screen. Added the money collections to the explicit full-backup set.

Validation: the complete backend suite passed **736 tests, with 3 existing skips**. The final default production build passed with TypeScript, and targeted workspace ESLint and the navigation inventory passed. Browser acceptance on the production standalone build used a synthetic member in a fresh local database: income/expense totals, plan/payment/undo persistence, expense-to-bill navigation, PIN locking/unlocking, hidden amounts, phone light/dark layouts and explicit data failure states. No real transfers, production database writes or external messages were performed.

See [Money workspace](MONEY_WORKSPACE.md) for the member flow, storage boundaries and API contract.

## My Money and platform credits

Reviewed the personal notebook against the platform wallet. The old wallet UI described refunds/support/referral credits as earnings available to withdraw, offered withdrawal actions and fabricated bank-verifiable statement references. Replaced it with WomSakhi credits under My Money, preserving `/app/wallet` and `/app/wallet/statement` URLs. The notebook links to credits, but personal entries and bill payments do not change the platform ledger. The credits screen reads the existing wallet endpoint directly without waiting for goals, payout methods or chart aggregations. Balance and activity retain exact paise; the visible history explicitly covers the latest 200 records, and its CSV is an activity export rather than a bank statement. Failed reads do not show fallback balances or empty-success messages.

Bank payouts are deferred. Removed member withdrawal actions and arrival-time promises from these screens and the Home rail. The old withdrawal page explains the future feature. The compatibility API returns HTTP 501 before database access or idempotency replay, preventing phantom deductions from old clients. Existing saved payout details remain manageable with future-release wording. Home wallet-derived figures now say credits rather than earned income.

Validation: final production build and targeted ESLint passed. Navigation inventory passed for 200 routes and 150 nodes. Full backend suite: **738 passed, 3 existing skips**. Production browser acceptance verified exact credit amounts, debit/credit filters, hidden amounts, CSV output, mobile light/dark overflow, deferred withdrawal and unchanged balance, and actionable unavailable-data messages without runtime exceptions. The complete personal notebook browser regression also passed after the navigation change. All write checks used synthetic accounts and throwaway local databases.

## Direct UPI release model

The current release presents My Money as the personal notebook and My Payments as direct-UPI payment activity. Wallet and statement URLs redirect to My Payments; historical wallet data is retained. Home no longer presents a held-money balance. Course and mentoring payers submit their UPI transaction reference, and only the recipient can confirm receipt. Blank references are rejected; recipient confirmations carry a timestamp and confirming account ID. Submitting a reference does not confirm payment, unlock paid content, transfer money or mint a wallet credit.

Added a member-scoped activity read over existing course and mentorship payment records, including sent/received direction, references, confirmation dates and review links. Earlier gateway orders are labelled as earlier records rather than recipient acknowledgements. The release defaults to `DIRECT_UPI_ONLY=true`: gateway order creation, confirmation and webhook work reject before provider/database calls or idempotency replay. Legacy checkout links redirect to My Payments. Bank payouts remain unavailable. New bank-account entry is hidden; UPI entry and upkeep of historical saved details remain available.

Production browser acceptance exercised two synthetic accounts: course and mentor reference submission, pending status, recipient review/confirmation, redirects, hidden amounts, mobile light/dark layouts, blocked gateway confirmation, and honest unavailable-data states. The test simulated recipient acknowledgement and did not open a UPI app or move real money. See [Direct UPI payments](DIRECT_UPI_PAYMENTS.md) for current scope and the evidence boundary.

Final direct-UPI validation: **741 backend tests passed, 3 existing skips**; targeted payment checks **29 passed**; final production build (including TypeScript), targeted ESLint and navigation inventory passed. The production browser lifecycle check passed for both course and mentoring payer/recipient flows. Declined recipient decisions remain declined rather than being relabelled as a generic cancellation. Existing financial records were not migrated or deleted.

## My Money and Customer dues

Grouped the previous “Who owes you money” entry under My Money and renamed it Customer dues, retaining `/app/books` and its records. The notebook tracks personal income/spending; the business screen defaults to outstanding customer payments and separates upcoming work and received payments. Removed its competing paid-income headline and the incorrect claim that every unpaid record is overdue. Business records are not added automatically to notebook totals.

Added usable manual customer create/edit/remove forms and an explicit receipt-date step. Receipt saves update the same row and clear its due date. Repeated saves do not create a second income record; old clients without a date get today on the first received transition. Blank customer names, nonpositive amounts and future receipt dates are rejected; optional due dates can be cleared. Confirmed course/mentoring business records link to My Payments. The customer page differentiates loading, error and empty data.

Validation: default production build (including TypeScript), targeted ESLint and navigation inventory passed. Full backend suite **745 passed, 3 existing skips**. A production browser check with synthetic data passed customer create → receipt → edit → remove, exact paise, unchanged personal notebook totals, hidden amounts, mobile light/dark layouts and explicit unavailable-data messages. Normal development accounts and demo data were not modified by these isolated workflow checks.

## Business income summary

Simplified `/app/books/proof` into Business income summary. Removed purpose-selection cards, the artificial “make statement” step, persuasion copy about landlords/lenders and the nonexistent verification-link claim. The page now shows received-payment totals, the monthly average, receipt count and monthly breakdown; unpaid dues and upcoming work remain excluded. Navigation, the Customer dues shortcut and the error screen use the new name. Preview, share and clean print/PDF output use the same data, exact paise and record-keeping description; no certificate or official-acceptance claim is made.

Validation: production build including TypeScript, targeted ESLint and navigation inventory passed. Read-only production browser checks against development receipt data verified matching preview/share/print content, absent purpose and verification claims, mobile light/dark layouts, and separate failed/empty states. Share/print were intercepted locally; no document was sent and no business data was modified. Backend aggregation logic is unchanged; only its API description was corrected.

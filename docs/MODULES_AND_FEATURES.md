# WomSakhi: modules and features

Source review date: **30 October 2026**. Audience: product owners, developers, testers and operations staff.

This guide describes features present in the current repository. It does not certify that external providers are configured or that every feature has passed production acceptance testing. Route counts refer to `page.tsx` files, including detail pages and redirects, rather than distinct business modules.

## Contents

1. [Product overview and access](#1-product-overview-and-access)
2. [Home and personal organisation](#2-home-and-personal-organisation)
3. [Learning and teaching](#3-learning-and-teaching)
4. [Work and hiring](#4-work-and-hiring)
5. [Selling, shopping and rentals](#5-selling-shopping-and-rentals)
6. [Money, records and entitlements](#6-money-records-and-entitlements)
7. [Community and communication](#7-community-and-communication)
8. [Health and wellness](#8-health-and-wellness)
9. [Help, safety and family](#9-help-safety-and-family)
10. [Profile and settings](#10-profile-and-settings)
11. [Administration](#11-administration)
12. [Shared features](#12-shared-features)
13. [End-to-end journeys](#13-end-to-end-journeys)
14. [Architecture and operation](#14-architecture-and-operation)
15. [Dependencies and acceptance boundaries](#15-dependencies-and-acceptance-boundaries)

For every page file and registered backend router, see the [technical inventory](MODULE_TECHNICAL_INVENTORY.md). Older files such as `modules.md` and `backend-wiring.md` are historical snapshots; their screen counts and implementation-status statements should not be treated as the current inventory.

## 1. Product overview and access

WomSakhi combines learning, work, small-business tools, community and wellbeing for women. A member can begin with existing skills, choose activities that fit her time, and maintain her own records. Earning is one possible journey; participation does not require running a business.

| Area | Entry point | Intended user | Main purpose |
| --- | --- | --- | --- |
| Member app | `/app` | Signed-in member | Learning, work, selling, personal records and support |
| Staff dashboard | `/dashboard` | Staff with granted permissions | Operate services, manage content and support members |
| Public pages | `/s/[handle]`, `/shop/[id]`, `/pay/[ref]` and other public routes | Visitors or customers | Shared shops, payment references and public information |
| Authentication | `/signin`, `/signup` | New and returning users | Identify the user and establish a session |

The member bottom navigation has five destinations: **Home, Learn, Work, Earn and Community**. **Health & Wellness, Help and You** are additional branches in the member navigation tree. A module can contain several pages without becoming a separate bottom-navigation item.

Authentication supports code-based email sign-in and registration, session refresh, sign-out, session management, optional phone/Firebase flows and additional app/QR handoff endpoints. Staff invitations and two-factor flows are also represented. Available methods depend on backend options and configuration; the existence of legacy password-named pages does not imply that a password is the primary login method.

**Access:** member APIs generally require an active member; staff APIs apply module and, where implemented, action permissions and assignment/region restrictions. Hiding a menu item is presentation, while backend guards control access. Super Admin manages staff access; ordinary members do not receive staff rights by signing in.

## 2. Home and personal organisation

**Purpose:** help a member decide what to do next without navigating every module.

| Feature | Pages | Behaviour |
| --- | --- | --- |
| Personal home | `/app` | Greeting, journey and activity summaries, learning/work recommendations and links to relevant modules |
| Start from home | Section on Home | Three choices: Learn a skill, Sell something, Work from home; one prominent action resumes from saved records, with an expandable three-step guide |
| Discovery | `/app/discover`, `/app/explore`, `/app/search` | Recommendations, grouped exploration and search across supported content |
| Journey and goals | `/app/journey`, `/app/goals`, `/app/progress` | View progress and maintain goals; financial progress comes from records rather than arbitrary manual figures |
| Calendar and bookings | `/app/schedule`, `/app/bookings`, `/app/bookings/[id]` | Review classes, events and booked sessions; inspect and cancel supported bookings |
| Saved items | `/app/saved` | Return to saved opportunities/content supported by each module |
| Notifications | `/app/notifications` | Review notifications and mark them read |
| Reminders | `/app/reminders` | Create and manage personal reminders through the reminder engine |
| Ask Sakhi | `/app/sakhi` | Conversational assistance, subject to the configured AI service |

**Main flow:** sign in → see Home → choose a goal or activity → open the relevant module → return to journey, applications, orders or bookings to track it.

The home aggregation API is `GET /api/v1/me/home`; `GET /api/v1/me/journeys` derives the three journey actions from member-owned course, store, work-profile and application records. Session and shell bootstrapping are separate. Mobile Home distinguishes loading from failure: if home data fails, a retry and the independent home pathways remain available.

## 3. Learning and teaching

**Entry:** `/app/learn`. Learning as a student and offering a course as a teacher are connected but distinct activities.

| Module | Pages | Main features |
| --- | --- | --- |
| Courses | `/app/programs` and nested pages | Browse courses, inspect lessons and fees, enrol, open lessons, record completion and view progress |
| Mentors | `/app/mentors` and detail pages | Browse mentor profiles and request a session; requests remain subject to acceptance |
| Skill exchange | `/app/library` and detail/thread pages | Offer a skill, find an exchange and communicate through an exchange thread |
| Assessments | `/app/assess` | Read an assessment, submit answers and review supported skill outcomes |
| Certificates | `/app/certificates` | View issued certificates and use available print/share/verification features |
| Digital literacy | `/app/digital` | Follow practical phone-use steps and record completion |
| Teaching | `/app/teach`, `/app/teach/[id]` | Create and edit a course, maintain lessons, publish/unpublish and review learners; paid-course claims have confirm/decline actions |
| Offering mentoring | `/app/mentoring` | Maintain a mentoring profile, pause/resume availability and accept/decline incoming requests; record payment receipt/completion where supported |
| Service activation | `/app/services` | View and manage the member's selling, teaching and mentoring service presence |

**Student flow:** Learn → course details → enrolment/payment step if applicable → lessons → recorded progress → certificate when requirements allow.

**Teacher flow:** My services → create a course → add course and lesson information → publish → manage learners. **Mentor flow:** create a mentoring profile → receive a request → accept or decline → coordinate the session → record its outcome.

Backend ownership includes `catalog`, `me`, `skills`, `exchange`, `teach`, `mentoring` and `course_qa`. Staff manage programs, assessments, digital steps and certificates in their corresponding dashboard modules.

## 4. Work and hiring

**Entry:** `/app/work`. Supports both finding work and posting work for others.

| Feature | Pages | What it provides |
| --- | --- | --- |
| Find work | `/app/opportunities`, detail pages | Browse jobs, orders and freelance opportunities; filter by supported work modes and switch between personalised, all and saved views |
| Work profile | `/app/work/profile` | Maintain skills and work information and control discoverability |
| Find talent | `/app/work/find` | Search women who opted into being discoverable and start a conversation |
| Post work | `/app/work/post`, `/app/work/posts` | Create and maintain job posts, view applicants and manage supported application stages |
| Applications | `/app/applications`, `/app/intake` | Apply to suitable work, provide relevant information and follow application status |
| Employer information | `/app/verified` | Review available employer/payment information before accepting work |
| Larger orders | `/app/contracts`, `/app/contracts/together` | Explore larger opportunities and information about working or bidding together |
| Work evidence | `/app/trust` and portfolio/work-history APIs | Present supported work history and records; evidence depends on recorded activity |

**From-home flow:** Home → Work from home → browse opportunities → work board opens at `/app/opportunities?where=Remote&view=all` → review pay, time and skills → apply → track the application. URL filters are validated and applied to the first work-list request.

**Hiring flow:** post a job → applicants respond → review applicants → communicate → update the application stage → record completion where supported. A conversation includes consent-related actions such as sharing a number or indicating no interest.

Backend ownership: `growth`, `work_talent`, `portfolio`, `employers` and `standing`. Staff use Growth & Work for opportunities, applications, work-skill taxonomy and related requests. A listing is not automatically a guarantee of employment, employer verification or payment.

## 5. Selling, shopping and rentals

**Entry:** `/app/earn` → `/app/services` or `/app/documents`. Although the path says `documents`, this branch is **My shop**, not the personal identity-document vault.

### My shop and selling tools

- **Store settings** (`/app/documents/store`): shop name, tagline, logo, wide cover photo, availability and open/closed settings. Name/tagline changes use an explicit save; picture changes save automatically.
- **Store showcase gallery:** select several photos together, maintain up to eight photos, reorder or remove them and preview the result. Photos appear on the public shop page, with a keyboard-accessible image viewer. Each successful upload saves separately so a later failure does not discard earlier photos.
- **Listings** (`/app/documents/listings`, `/app/documents/new`): add a product or service, describe it, upload images, set its price, edit, pause or remove it.
- **Orders and details** (`/app/documents` and nested order/product/service pages): review orders and advance or cancel them through supported actions.
- **Customer reviews:** read reviews and reply through the shop API.
- **Business papers** (`/app/documents/vault`): keep shop-related licence/proof records.
- **Selling tools** (`/app/shop` and nested pages): business-operation records such as advances, repeat arrangements and appointments where the corresponding tool supports them.
- **Customers and pricing** (`/app/shop/buyers`, `/app/shop/pricing`): customer information derived from records and pricing support.
- **Public shop and collection** (`/app/collect`, `/s/[handle]`, `/shop/[id]`): share the shop or supported collection reference with people outside the app.
- **Home-food guidance** (`/app/kitchen`): food-business information and associated records. Regulatory amounts or eligibility shown by content require separate current verification before being used as advice.

**Seller flow:** create store → add a listing → share/browse the listing → receive an order or enquiry → manage fulfilment → maintain sales/cost records.

### Market, group buying and rentals

| Module | Pages | Main features |
| --- | --- | --- |
| Marketplace | `/app/market` | Browse women's listings, inspect a product/service, ask the seller and place supported orders |
| Group buying | `/app/group-buy` | Browse and join supported pooled purchases; participation and fulfilment depend on the group-buy record |
| Rent & borrow | `/app/rent`, `/app/rent/new`, `/app/rent/mine`, `/app/rent/bookings` | List an item, set daily pricing and deposit, request a quote/booking and track bookings |
| Rental lifecycle | Nested rental detail pages | Accept/decline/cancel, record handover and return, record deposit return, raise a problem and leave a review as allowed by state and role |

Backend ownership: `shop`, `market`, `group_buy`, `rentals`, `market_categories` and `kitchen`. Staff manage listings, orders, reviews, sellers/licences, categories, group buys and rentals under Market & Shops. A recorded deposit or payment is not by itself proof of an external transfer.

## 6. Money, records and entitlements

These tools serve different purposes. A wallet ledger, a handwritten money record, a savings plan and an external bank account are separate records.

| Module | Pages | Main features and boundaries |
| --- | --- | --- |
| Customer dues (under My Money) | `/app/books`, `/app/books/proof`, `/app/books/season` | Track outstanding customer payments, upcoming work and received payments. Add/edit/remove manual records; record the actual receipt date. Business income summary shows recorded received payments by month, with matching share/print output; separate from the personal notebook and not an income certificate. |
| My Money | `/app/money` | One personal notebook with **Money in & out**, **Bills & plans**, and **Notes**. Monthly received/spent/difference; optional PIN, hide amounts and calculator. Old `/app/khata` links redirect here with supported tab/calculator parameters preserved. |
| Chits | `/app/khata/chits` and nested pages | Manage a chit record, members, order, monthly decisions and payment acknowledgements |
| My Payments | `/app/payments` | Direct-UPI course and mentoring payment records; sent/received filters, reference submissions, awaiting-confirmation and recipient-confirmed states. No wallet balance or gateway checkout. |
| Old Wallet links | `/app/wallet`, `/app/wallet/statement` | Redirect to My Payments; historical backend credit records are retained without being presented as money held by WomSakhi. |
| Saved UPI details / future payouts | `/app/settings/payments`, `/app/wallet/withdraw` | UPI entry is available; existing saved bank details remain manageable. The old withdrawal page explains the deferred feature, and the API returns HTTP 501 without deductions. |
| Personal locker | `/app/vault` and nested pages | Maintain pockets, money-set-aside records, rules, history and visibility/showing-phone preferences |
| Entitlements / Haq | `/app/haq`, `/app/haq/papers`, `/app/haq/recover` | Maintain an entitlement profile, scheme/application tracking, paper readiness and delayed/recovery records |
| Scheme/cover reference | `/app/support-fund`, `/app/cover` and related detail routes | Browse supported reference information and record application/ownership markers; some older URLs redirect to newer destinations |

**Personal money flow:** record income or spending in Money in & out; keep future expenses in Bills & plans. Recording a bill as paid creates one linked expense, protected against retry duplication. Undo removes that expense and reopens the bill. Previously completed plans stay completed without inventing an expense. Monthly difference means received minus spent in recorded entries, not a bank balance. Notes, entries, plans and PIN settings keep their existing storage. See [Money workspace architecture](MONEY_WORKSPACE.md).

**Business records:** customer dues remain in Business books. Legacy wallet records and locker moves are separate; promised customer payments and old credit amounts are not added to the personal notebook summary. Current UPI payment activity lives in My Payments.

**Current payment flow:** request a paid course or accepted mentoring session → pay its provider externally using the displayed UPI ID → submit the transaction reference from the UPI app → show Awaiting confirmation → recipient checks their account and confirms receipt. A submitted reference never marks itself paid. Free courses open without payment. My Payments brings these existing records together; it does not create wallet credit, a bank balance or a second transaction ledger. Gateway order creation, confirmation and webhook processing are disabled when `DIRECT_UPI_ONLY=true` (the release default). See [Direct UPI payments](DIRECT_UPI_PAYMENTS.md).

**Withdrawal boundary:** bank payouts are deferred for this release. `POST /api/v1/me/payout/withdraw` returns HTTP 501 before account reads, idempotency replay or ledger writes. No credit is deducted and no transfer is initiated. Existing historical credit records and saved payout details remain unchanged.

**Locker/chit boundary:** these pages maintain application records and preferences. They are not evidence of a bank deposit, escrow account, regulated savings product or automatic external money movement.

Backend ownership: `books`, `khata`, `money`, `wallet`, `money_overview`, `payout`, `payments`, `vault`, `haq`, `haq_catalogue` and `reference`. Staff oversee payment orders, withdrawals, ledger entries, payout accounts and referrals in Money & Payouts.

## 7. Community and communication

**Entry:** `/app/community`; the older `/app/circle` route remains represented for compatibility.

| Module | Pages | Main features |
| --- | --- | --- |
| Social feed | `/app/community` | Create/edit/delete own posts, like posts, comment and report supported content |
| Friends | `/app/community/friends`, `/app/community/u/[handle]` | Send, accept, decline or cancel requests; view friends/suggestions and supported member profiles |
| Circles | `/app/circles`, `/app/circles/create`, detail pages | Create/join groups and participate in group communication |
| Circle chat | Circle detail/chat pages | Send/read/delete permitted messages, mark read and manage group information, admins, membership and invites according to role |
| Savings circles | `/app/circles/new`, circle payment/detail pages | Create and follow supported contribution-related circle records |
| Messages | `/app/messages` | Conversations with members and relevant buyers, mentors or work contacts |
| Events | `/app/events`, `/app/events/[id]` | Browse events, view details and use supported participation actions |
| Stories | `/app/stories` | Read published women's stories and discover relevant examples |
| Helping each other | `/app/together` and nested pages | Consent-based helper links/tasks, peer learning and moving-house support |
| Pass it on | `/app/swap` | Offer/find things other members no longer need |
| Referrals | `/app/refer` | Review and use the supported referral journey |

**Flow:** find a person/group/event → inspect its details → request friendship, join or participate → communicate → use report/moderation actions when needed. Group-admin privileges are distinct from platform staff privileges.

Backend ownership includes `social`, `circle_chat`, `community`, `me_messages`, `growth`, `together` and `swap`. Staff moderate circles/posts and manage success stories; events are under Growth & Work.

## 8. Health and wellness

**Entry:** `/app/wellness`. The `/app/health` branch also contains public-health and support-oriented information. Health features organise personal records and content; recording data does not establish a clinical diagnosis.

| Module | Main route | Features represented in the implementation |
| --- | --- | --- |
| Fitness | `/app/health/fitness` | Activity-related tracking/content and access to workout guidance |
| Workouts | `/app/health/workouts` | At-home movement content |
| Nutrition & diet | `/app/health/nutrition` | Food/diet-related content and personal entries |
| Sleep | `/app/health/sleep` | Sleep/rest-related entries and supporting content |
| Mental wellness | `/app/health/mind`, `/app/health/today` | Mood/wellbeing check-ins and supportive activities |
| Games & stress relief | `/app/health/games` | Breathing, bubbles, garden, numbers, pairs, puzzle and rangoli pages |
| Fertility | `/app/health/fertility` | Cycle-related information and access to cycle tracking |
| Cycle tracker | `/app/health/cycle` and nested pages | Setup, period/daily logs, symptoms, mood, reminders, personal patterns, guides, medicines, settings and report pages |
| Pregnancy | `/app/health/pregnancy` | Pregnancy-related information and personal tracking surfaces |
| Health records | `/app/health/records` | Personal record entries and private health-file upload/read/delete support |
| Appointments & reminders | `/app/health/reminders` | Record and manage supported health reminders/appointments |
| Mentor connect | `/app/health/mentors` | Find relevant peer/mentor support |
| Doctor consultation | `/app/health/doctors` | Browse doctors and slots, request a booking, view own consultations, cancel/reschedule and manage supported notes/sharing |
| Health videos | `/app/health/videos` | Browse published health media; staff maintain the catalogue |
| Public-health support | `/app/health/strength`, `/app/health/cover`, `/app/health/change` | Checklists, recorded care tasks, cover information and menopause-related resources |

**Personal tracking flow:** choose a health area → record relevant information → review history/summary → adjust reminders/settings → use export or deletion actions supported by that area.

**Consultation flow:** choose a doctor → inspect available slots → request/book → staff confirm as required → attend through the arranged channel → staff record completion. Booking management does not establish that an embedded video-call or clinical service is supplied by this app.

Backend ownership: `health_hub` (`/me/health`), `health_files`, `cycle`, `doctors`, `health_videos`, `my_records` and relevant reminder-engine routes. Private health files use authenticated storage, separate from public shop images; encryption at rest depends on the configured document key.

## 9. Help, safety and family

**Entry:** `/app/helpdesk`. Immediate help remains the primary action on safety pages; encouragement is supplementary.

| Module | Pages | Main features |
| --- | --- | --- |
| Help | `/app/help`, `/app/helpdesk` | Find guidance and available support options |
| Safety centre | `/app/safety` | Trusted contacts, alert creation/stand-down and safety reports; staff can review recorded alerts/reports |
| Money traps | `/app/safe-money` | Fraud-awareness content and relevant support information |
| Rights | `/app/rights` | Published rights/legal-support resources; content availability is not legal representation |
| Family and childcare | `/app/family` | Relevant local/support information and associated actions |
| School year | `/app/school` | Maintain child records and school-related tasks, fees/forms/date reminders |
| When home is uncertain | `/app/bringing` | Support-oriented information and communication material |
| If something happens | `/app/incase` | Record personal wishes/answers for supported emergency-planning prompts |
| Travel | `/app/travel`, `/app/travel/journey` | Travel information and journey start/check-in/end records through the tracking engine |
| Read-aloud | `/app/voice` | Voice/read-aloud settings and capabilities available through configured browser/service support |
| Feedback | `/app/feedback` | Submit feedback for staff review |

**Safety boundary:** the reviewed safety route records an alert and names trusted contacts for staff to reach. Its implementation explicitly says direct contact SMS delivery is not wired there. A successful alert record must not be documented as proof that contacts received an SMS or that emergency services were dispatched.

Backend ownership includes `safety`, `engines`, `school`, `incase`, `together`, `my_records`, `reference` and member feedback/content routes. Helpline data has a public endpoint so a signed-out visitor can retrieve it; this guide intentionally does not reproduce numbers or treat stored data as independently verified current advice.

## 10. Profile and settings

**Entry:** `/app/you`.

- **Profile:** `/app/profile` and `/app/profile/preview` maintain personal details and preview supported public-facing information.
- **Verification:** `/app/verify` manages supported identity-verification submissions; staff review verification separately.
- **Account:** `/app/settings/account` maintains account details; phone confirmation also has `/app/phone`.
- **Preferences:** `/app/settings/language`, `/app/settings/notifications`, `/app/settings/quiet-hours` and `/app/settings/delivery` control available language and notification options.
- **Appearance/accessibility:** settings include appearance, text-size and related presentation controls where present; see the inventory for exact routes.
- **Payments:** `/app/settings/payments` manages payout-account details.
- **Privacy/security:** available settings cover privacy, security and supported data export/deletion/session actions. Deletion requests are distinct from immediate deletion of all stored data.
- **Referral and support links:** reachable through the member account/navigation surfaces.

The whole-app locale catalogue currently enables English; Hindi and other catalogue entries are marked unavailable for global selection. This release keeps Home guidance and encouragement in English as well. Translation content remains available in source for a future release.

## 11. Administration

Staff entry is `/dashboard`. Navigation is permission-filtered, and backend route guards remain necessary even when a link is hidden. The grantable module catalogue has **20 keys**; Masters is an additional dashboard destination whose individual lists have their own module permissions.

| Staff module | Main pages | Features |
| --- | --- | --- |
| Dashboard | `/dashboard` | Operational summaries and links to work requiring attention |
| Users | `/dashboard/users` and children | Member records, verification, roles, segments, regions and deletion requests; staff administration at `/dashboard/staff` |
| Appointments | `/dashboard/appointments`, `/dashboard/doctors`, `/dashboard/doctors/consultations` | Manage appointments and doctor records; confirm, complete or cancel supported consultations |
| Services & Types | `/dashboard/services` | Maintain service/type catalogue records used in booking and operations |
| Programs | `/dashboard/programs` | Manage learning-program records and supported enrolment/content operations |
| Calendar | `/dashboard/calendar` | View/manage supported scheduled activity |
| Messages | `/dashboard/messages` | Staff inbox and communication workflows |
| Community | `/dashboard/circles`, `/dashboard/circles/moderation`, `/dashboard/stories` | Manage circles, moderate supported content/reports and maintain published stories |
| Growth & Work | `/dashboard/opportunities`, `/dashboard/applications`, `/dashboard/work-skills`, `/dashboard/events`, `/dashboard/mentors`, `/dashboard/mentors/requests` | Maintain opportunities, application workflow, skill taxonomy, events, mentors and mentor requests |
| Market & Shops | `/dashboard/market/*` | Listings, orders, reviews, rental issues/settlement records, group buys, sellers/licences and shop categories |
| Money & Payouts | `/dashboard/money/*` | Payment records, withdrawals, wallet ledger, payout accounts and referrals |
| Learning | `/dashboard/learning/*` | Assessments/questions/attempts, digital steps and certificates; supported certificate issuance, revocation, reinstatement and exports |
| Resources | `/dashboard/resources`, `/dashboard/resources/wellbeing` | Reference catalogue and wellbeing cards/activities, including review/publication states |
| Safety & Support | `/dashboard/safety`, `/dashboard/safety/reports`, `/dashboard/support-fund`, `/dashboard/safety/assist-links` | Review alerts/reports, support-fund records and helper links |
| Analytics | `/dashboard/analytics`, `/dashboard/analytics/what-women-want` | Aggregate insights, including onboarding-needs reporting |
| Reports | `/dashboard/reports` | Supported operational reporting/export surfaces |
| Content | `/dashboard/content`, `/dashboard/health-videos` | Content-library records and published health media |
| Feedback | `/dashboard/feedback` | Review and manage submitted member feedback |
| Command Center | `/dashboard/ai` | AI-assisted operational tools, subject to configured provider and permissions |
| Masters | `/dashboard/masters` | Maintain permitted cross-module lists, add/edit/disable supported items and reorder lists |
| Settings | `/dashboard/settings/*` | General settings, staff profile, appearance, security, notifications, organisation, integrations, backup/restore, sessions, activity, support and help |

### Operational workflows

**Verification:** member submits supported documents → authorised staff review → update verification outcome → member sees the recorded result.

**Content:** create/edit a resource, assessment, program or media record → use its review/publication actions → check member visibility. Publication rules differ by content type; a draft should not be assumed visible.

**Work:** create/review an opportunity → inspect applications → update the supported stage → communicate with the applicant. Staff assignments and regional scope may restrict the records visible to an operator.

**Support:** review an incoming alert/report/ticket → inspect permitted details → record the relevant action/outcome. Recording a case does not guarantee external delivery or resolution.

**Organisation:** configure supported branding/theme/layout templates/domain settings subject to permissions and entitlement checks. A custom domain still requires DNS/hosting and verification outside a simple UI preference.

**Backups:** create/list/download a supported database backup, manage its schedule and restore through guarded operations. A database backup should not be assumed to include every separately stored media/private file or to prove disaster recovery until restoration is tested.

## 12. Shared features

| Capability | What is shared |
| --- | --- |
| Navigation | Member section tree, page ownership and back destinations; staff module-filtered sidebar with supported customisation |
| Responsive layout | Member desktop/mobile shells and staff layout; pages may intentionally use different layouts for chat or fitted boards |
| Banners | Shared banner styling, size rules and section mapping where banners apply |
| Encouragement | One shared page-quote section in the member shell and permitted staff layout; 36 original lines across 12 topics, another-thought and share/copy controls; English UI for this release |
| Quote topics | Home, learning, work, earning, money, community, health, safety, rights, family, account and staff; selected by route with a fallback topic |
| Language | English for this release; additional languages follow after feature finalisation |
| Loading/errors | Shared data-resource hooks and page loading/error surfaces; unavailable data is not a successful fabricated balance or list |
| Forms and feedback | Native cursors; shared flat fields, theme-aware focus/error states, hints and required semantics; mobile field sizing; shared confirmation, validation, busy-state and toast patterns where adopted |
| Media | Public image upload/serving for appropriate content and separate protected document/health-file paths |
| Sessions | Cookie-based browser session handling, refresh and supported session revocation |
| Notifications | Personal notifications plus reminder/preferences/delivery machinery; channel delivery depends on adapters and configuration |
| Startup | Static welcome, brief fade, once per tab, with a one-second hard stop; skipped for reduced motion/data-saving preferences |

## 13. End-to-end journeys

### A. Begin earning from an existing household skill

1. Sign in and complete the relevant profile information.
2. Home → Sell something → name the shop and set availability.
3. Add one product/service with photos, details and a price.
4. Share the store or let buyers discover the listing in Market.
5. Respond to enquiries, manage the order and record fulfilment.
6. Maintain business records in Books or personal income/spending in My Money and review the result.

The member chooses capacity and timing. Store creation does not itself create customers or guarantee income.

### B. Find work that can be done at home

1. Home → Work from home → create/update the work profile.
2. Open from-home opportunities with Remote and All work selected.
3. Read the actual role, payment, skill and time details.
4. Apply and follow progress in My applications.
5. Communicate through supported channels and record completion where available.

### C. Learn before offering a service

1. Learn → browse a relevant course or digital-literacy step.
2. Enrol and complete the available learning activity.
3. Request mentor support or use peer exchange when appropriate.
4. Take an assessment or obtain a certificate when eligible in the implementation.
5. Add the skill to the work profile or create an appropriate service/course.

### D. Rent an item instead of buying it

1. Browse Rent & borrow and inspect terms/pricing.
2. Request a quote and booking.
3. Owner accepts or declines.
4. Record handover, return and deposit-return state.
5. Raise a problem or leave a review through supported actions.

### E. Manage personal wellbeing alongside work

1. Open Health & Wellness and choose a relevant area.
2. Record only the information the member wants to keep.
3. Review personal history and reminders.
4. Use mentor/doctor booking or support resources as appropriate.
5. Manage private records, export or deletion using supported controls.

## 14. Architecture and operation

| Layer | Location | Responsibility |
| --- | --- | --- |
| Frontend | `womencrafts-frontend/frontend` | Next.js App Router, React, TypeScript, member/staff/public UI |
| Member navigation | `src/components/ux/nav-tree.ts` | Sections, destinations, hierarchy and route ownership |
| Staff navigation | `src/components/layout/Sidebar.tsx` | Staff module links and grouped destinations |
| Permissions catalogue | `src/lib/modules.ts` | Frontend module keys and route-to-module mapping |
| API clients | `src/lib/*-api.ts`, `src/lib/api.ts` | Typed calls, request/session handling and module adapters |
| Backend | `womencrafts-backend/backend` | FastAPI routes, business rules, authentication and authorisation |
| API registration | `main.py` | Registers router families under `/api/v1` |
| Persistence | `app/db`, `app/models`, `app/schemas` | MongoDB access/indexes, stored records and validation contracts |
| Background work | `app/engines` | Reminders and supported automation; requires enabled workers/configuration |

**Typical request:** browser opens a page → server boot/session or client API adapter retrieves permitted data → FastAPI validates identity, permissions and input → module logic reads/writes MongoDB or protected files → UI presents data/status. External services are called only by configured integration paths.

**Local operation:** run `npm run dev` or `./dev.sh` from the repository root. Frontend: `http://localhost:3100`; backend: `http://localhost:8020`; API: `http://localhost:8020/api/v1`; interactive API reference: `http://localhost:8020/docs`. Logs: `.dev-logs/frontend.log` and `.dev-logs/backend.log`. Use `npm run stop` or `./stop.sh` to stop the local services. Configuration belongs in the appropriate environment files; this guide contains no secret values or login codes.

The technical inventory links every page file and every router registered in `main.py`. For exact request/response schemas and required fields, consult the running API docs and source schemas. Route existence alone does not mean that the route is public or permitted for every staff role.

## 15. Dependencies and acceptance boundaries

| Capability | Implementation evidence | What must be established separately |
| --- | --- | --- |
| Email OTP | Email adapters and auth start/verify flows | A working delivery provider, sender/domain setup and actual inbox receipt; the file adapter does not deliver email |
| Mobile OTP | Phone/Firebase and related auth routes | Enabled method, configured provider/project, quota and device delivery |
| Checkout | Sandbox and Razorpay adapters, server-side price computation and payment verification | Correct enabled provider, credentials, webhook setup and live/test-mode acceptance checks |
| Bank withdrawal | Account checks and wallet debit record | An actual external payout/settlement integration; not present in the reviewed withdrawal handler |
| Safety alerts | Alert/report persistence and staff review | Actual outbound contact delivery/emergency response; direct SMS is explicitly not wired in the reviewed safety handler |
| AI assistance | Sakhi/Command Center routes and provider abstraction | Configured provider credentials, availability, cost limits and response quality |
| Reminders | Engine, preferences and channel-related routes | Running jobs and successful delivery for each enabled channel |
| Health/privacy | Personal entries and authenticated private-file access | Configured encryption/storage policies and appropriate clinical/service operations |
| Government/rights content | Reference catalogue and application markers | Current external eligibility, rates, rules and actual submission/approval; markers do not submit to government portals |
| Language | English global catalogue and release UI | Complete/reviewed catalogues before enabling other whole-app languages |
| Offline access | Web manifest and some local preferences | A verified offline workflow; do not assume every API-backed action works without connectivity |

This is a source-based feature guide. Validation history and observed issues are documented separately in [the full-stack audit](FULL_STACK_AUDIT_2026-10-30.md). New release acceptance should exercise the actual deployed provider configuration and the relevant member-to-staff workflows.


## Current release operations

The three Home journeys now have a single prominent next action, a persisted local goal choice, member-owned progress from `/me/journeys` and a return trail on their main screens. Learning can begin with the Free course filter; work can be browsed with From home selected before completing a profile. Progress failure leaves useful links available.

Bank payouts and additional languages are deferred by product scope, and the native mobile app is developed separately. Operational endpoints, production-build checks, monitoring configuration and recovery evidence are described in [Production operations](PRODUCTION_OPERATIONS.md). Cloud rollout and delivered alert activation are separate from local validation.

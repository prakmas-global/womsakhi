# WomSakhi Expanded Product Catalogue V2

Prepared 20 September 2026. Product proposal for founder, design, engineering, operations and QA.

Revision 2.1 adds the founder's all-age audience requirement, age-appropriate safeguards, multilingual low-literacy UX, responsive design and CSS consistency, visual asset production, and a Codex implementation contract. Sections 13–18 are normative additions. Their age and design requirements override earlier generic adult assumptions without changing existing use-case IDs. Keep this catalogue as one maintained source of truth.

Revision 2.2 added section 19: reusable picture-led shop, product, service and form templates, plus opt-in mood-responsive encouragement with selectable replies and explicit fatigue controls. Historical totals at that revision: 428 registry entries and 23 detailed scenarios.

Revision 2.3 adds sections 20–24: web-first delivery, daily companionship, trusted travel groups, nearby circles, inclusive occupation templates, country-specific rights, optional scripture, a researched API/content acquisition register, and the shared Reminder and Notification Engines. Current totals: 480 registry entries and 30 detailed scenarios. These sections override conflicting earlier release and monetization proposals. Native mobile and WomSakhi revenue-model decisions are deferred; provider operating costs remain part of readiness planning. Research checked 20 September 2026.

## Executive decision

Build a women-centred platform around three useful outcomes: trusted connection, earning opportunities and practical everyday support. Preserve the broader vision, but release complete journeys rather than fragments of every module. AI should reduce effort while leaving consequential choices with the member.

This is an expanded planning catalogue, not a claim that every entry is implementation-ready. It contains a consolidated stable-ID registry, additional scenario specifications, launch bundles, dependencies, research references, growth proposals and unresolved policy decisions. Engineering estimates, legal opinions, clinical protocols and supplier commitments are not implied.

The earlier Word catalogue remains the historical first draft. This companion revises its priorities and corrects its count: there were 262 registry entries, not 224. Its detailed safety section also mislabelled missed check-in detection as SAFE-UC-009; the canonical ID is SAFE-UC-010. SAFE-UC-009 remains journey extension or destination change.

## 1 Product structure

Seven experience areas need not mean seven mobile navigation tabs. Test five primary tabs—Home, Circles, Earn, Grow and Market—with persistent access to Help and configurable Wellbeing shortcuts. This navigation is a proposal to validate, not a fixed screen design.

| Experience | Responsibilities | Shared implementation boundary |
|---|---|---|
| My Day | Next actions, private check-ins, saved shortcuts, progress | Reads authorized summaries; does not duplicate domain records |
| Circles | Membership, posts, chat, events, requests, care coordination | One membership and permissions service |
| Earn | Seller workspace, products, services, orders, business insights | Same catalogue and orders used by Market |
| Grow | Learning, jobs, mentoring, benefits and opportunities | Shared profiles, booking and content systems |
| Wellbeing | Optional cycle tracking, mood, habits, health navigation | Sensitive data boundary separate from commerce and employment |
| Market | Buyer discovery, fashion, local services, checkout | Fashion is a category, not a second marketplace engine |
| Help and Safety | Support, rights, trusted contacts, travel sessions | Operational incident service, not an unmonitored chatbot |

Authentication, consent, the Reminder Engine, the Notification Engine, payments, mentoring, search, accessibility, moderation and audit are shared capabilities. The two engines in section 24 serve every module through one shared policy layer; they are distinct logical responsibilities and need not start as separate deployed services. Do not count their appearances in multiple screens as different backend systems.

### Operating assumptions and boundaries

- The product audience includes girls and women across all ages, education levels, languages and digital experience, including rural members and older adults. Use age-appropriate experiences, not a universal adult feature set. Child and guardian journeys are core scope; enable each cohort only after its safeguarding and regional compliance gates pass. An India-first launch remains a geography proposal, not an age restriction.
- Women-only membership is the stated product goal. OTP establishes contact possession, not gender. Publish eligibility rules, use self-attestation and proportionate review, and provide appeals. Do not infer gender from faces, voices or names, or ask for invasive medical evidence. Define explicitly how transgender women are included; do not use menstruation as an eligibility test.
- Keep cycle tracking optional. A member can use every unrelated module without disclosing reproductive or mood information.
- An emergency contact or verified parent/guardian may be a man without becoming a community member. A separate guardian role grants only approved child-support functions, not access to the women's community or unrestricted health records. A contact link grants only its explicit scope. External employer and professional access also requires a separately approved policy and isolated role.
- A WomSakhi guide helps members use the platform. A peer mentor shares experience. A verified professional works within a checked scope. AI is labelled as AI. These are four distinct identities.
- Track My Way supports contact coordination; it does not guarantee rescue or imply police integration. Do not advertise 24-hour human monitoring unless it is staffed and tested.
- Savings pots start as goal and contribution records only. Actual pooling, lending, custody, wallet balances and escrow are disabled until the operating model, legal review and authorized partners are approved.
- Clinical and emergency decisions use reviewed policies and explicit workflows, not unconstrained model output. Financial, employment and legal features require jurisdiction-specific review before launch.

## 2 Research and evidence

This is a targeted benchmark of accessible first-party sources, not an exhaustive worldwide market study. Features below are WomSakhi proposals unless a source explicitly supports the observation. No source implies an available integration or permission to copy content.

| Source checked | Supported observation | Proposed WomSakhi adaptation |
|---|---|---|
| [Shopify Inbox](https://apps.shopify.com/inbox) | Its assistant uses store catalogue, inventory and policy context | Merchant-approved answer library, availability-aware replies, clear human handoff |
| [Google Personal Safety](https://support.google.com/pixelphone/answer/7055029?hl=en) | Safety checks and emergency sharing have permission, device and regional constraints | Explicit session consent, deterministic deadlines, degraded-state warnings and contact acknowledgement |
| [myScheme](https://www.myscheme.gov.in/) | Eligibility-based scheme discovery includes required documents and application guidance | Explain possible matches, show official sources and verification dates, track member-reported application progress |
| [HerKey](https://www.herkey.com/) | Jobs, companies, sessions and events appear together | Connect learning, mentoring and job discovery; do not infer placement effectiveness from the homepage |
| [NHS period pain guidance](https://www.nhs.uk/symptoms/period-pain/) | Self-care guidance distinguishes symptoms requiring medical review | Approved care cards and escalation rules reviewed by a clinician before release |

Peanut's accessible landing page did not expose enough content for feature validation. India's 112 website could not be retrieved in this pass; emergency numbers, regional coverage and any integration must be verified independently before release. These are research gaps, not evidence that either service is unavailable.

## 3 Registry conventions and release gates

Origin labels: **U** = directly requested capability; **R** = research-inspired adaptation with a listed source; **P** = product recommendation. U does not mean every implementation detail was approved. Research-inspired controls can still require original engineering and professional validation.

Release labels: **F** = foundation before public pilot; **L** = first pilot journey; **N** = next validated release; **X** = expansion after evidence of demand; **G** = gated pending partner, policy or specialist review. These are recommendations, not dates or automatic ticket priorities.

All public modules inherit F controls: API authorization, report/block, consent, data deletion/export paths, private notifications, audit, accessibility, support ownership and secure media handling. A later module must ship these with its first release, not postpone them. A gate overrides a release label.

### Proposed release bundles

| Bundle | End-to-end result | Required capabilities | Do not launch if |
|---|---|---|---|
| F Trust foundation | Member can join, control visibility, recover access and get help within her approved cohort | AUTH including age routing and guardian flow; PLAT privacy, audit, support, moderation, feature switches; AI permissions | Reports have no owner, recovery bypasses restrictions, or child protection is incomplete |
| L Community and opportunity pilot | Member joins a circle, contributes, finds a mentor or local seller and sends a controlled enquiry | Circle invitations, membership, chat/posts, role controls, content reporting; simple shops; mentor directory | Invitations bypass membership eligibility or sellers cannot report abuse |
| L Optional private wellbeing pilot | Member records a quick check-in, edits it and receives a reviewed care card | Cycle logging, consent, uncertainty, private notifications, deletion, red-flag resources | Unreviewed generated remedies or diagnostic claims appear |
| N Transactional commerce | Buyer completes an order; seller fulfils; cancellation/refund and settlement reconcile | Catalogue, stock reservation, provider payments, receipts, returns, disputes and moderation together | Payments work but refunds, fulfilment or reconciliation do not |
| N Learn and work | Learner finishes a resource; candidate applies to a verified opportunity and tracks it | Content rights, progress, employer verification, job expiry, reporting, application tracking | Placement claims are unsupported or scam reports cannot be handled |
| G Travel monitoring pilot | Member starts, extends, completes or escalates a monitored session | Every safety dependency including no-response and outage handling; device validation | Tracking is stale without warning, contacts cannot receive alerts, or monitoring is unstaffed but advertised as staffed |
| X Expansion | More local communities, creator products, events and automation | Operational capacity, acceptable trust metrics, demand evidence | Acquisition outpaces response capacity |

## 4 Additional use case registry

Every row below describes a distinct addition or decomposition. When a row extends an existing ID, the relationship is named; do not implement a duplicate service. Shared controls in section 3 apply to every row. Section 5 expands selected critical journeys into testable scenarios.

### DAY My Day and low effort interaction

Actors: member and support guide. Dependencies: profile, consent, authorized domain summaries, notification settings. Screen family: Home, Quick check-in, Preferences, Action history. Event payloads must not contain symptoms or private chat text.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| DAY-UC-001 | Pick up to three current goals; home changes without making unrelated profile fields mandatory | P | L |
| DAY-UC-002 | Pin and reorder shortcuts; preferences persist across authorized devices | P | L |
| DAY-UC-003 | Submit one-tap check-in; reuse the same record in Cycle and Wellbeing rather than creating duplicates | U | L |
| DAY-UC-004 | Resume incomplete work; member returns to the last saved draft with a visible timestamp | P | L |
| DAY-UC-005 | Select Done, Later or Not relevant; the next-action queue updates without repeated questions | U | L |
| DAY-UC-006 | Explain a recommendation; member sees its allowed inputs and can switch it off | P | L |
| DAY-UC-007 | Set attention budget and quiet hours; optional reminders respect it while active safety sessions use separate agreed rules | P | F |
| DAY-UC-008 | Correct remembered preferences; future suggestions stop using superseded values | P | L |
| DAY-UC-009 | Use shared-device privacy mode; sensitive cards stay hidden until deliberate unlock | P | F |
| DAY-UC-010 | Use voice entry; transcript is reviewed before saving and raw audio follows the chosen retention setting | U | N |

### AI Assistance and automation control

Actors: member, domain owner, AI operations reviewer. Dependencies: scoped tool gateway, consent, approved sources, audit and kill switches. Extends PLAT, not a new unrestricted chatbot. Screen family: Assistant, Approval preview, Automation settings, Feedback.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| AI-UC-001 | Choose manual, suggestion-only or narrowly preauthorized mode per action type; default is suggestion-only | U | F |
| AI-UC-002 | Preview a proposed write with recipient, cost and changed fields; confirmation is bound to that exact action | P | F |
| AI-UC-003 | Approve a recurring rule; its scope, limits and expiry are visible and revocable | U | N |
| AI-UC-004 | Refuse unsupported advice; show approved resources or a human route instead of fabricated facts | P | F |
| AI-UC-005 | Escalate to a guide; member selects the context to share and sees expected response availability | U | L |
| AI-UC-006 | Mark advice harmful; linked content and model version enter a review queue without broadly exposing health data | P | F |
| AI-UC-007 | Undo a reversible change; irreversible actions disclose their cancellation or remediation path | P | F |
| AI-UC-008 | Continue during model outage; core logging, purchases and deterministic safety scheduling remain independent of generation | P | F |
| AI-UC-009 | Answer store questions from approved catalogue facts; unavailable facts produce a seller handoff, not invented stock | R Shopify | N |
| AI-UC-010 | Protect tools from malicious listing or document instructions; untrusted content cannot grant permissions | P | F |

### CARE Care coordination

Actors: requester, beneficiary, invited helper, coordinator. Dependencies: circles, task assignment, consent and reporting. Non-clinical help only; not a replacement for emergency response. Screen family: Care request, Task board, Invitation, Completion.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| CARE-UC-001 | Create a private care request with task, time and audience; location stays coarse until accepted | P | N |
| CARE-UC-002 | Invite a beneficiary to approve sharing; another person's health details are not published without authority | P | N |
| CARE-UC-003 | Claim a task; competing claims resolve to one assignee unless multiple helpers were requested | P | N |
| CARE-UC-004 | Coordinate meals, errands or appointment transport; each has an owner and due time | P | N |
| CARE-UC-005 | Arrange a recurring rota; helper can accept individual occurrences without accepting all future dates | P | X |
| CARE-UC-006 | Request a replacement; original helper remains recorded and member is told if nobody accepts | P | N |
| CARE-UC-007 | Confirm completion or dispute it; acknowledgement creates a traceable task history | P | N |
| CARE-UC-008 | Close a care circle; temporary access and location links expire while necessary audit records remain restricted | P | N |

### BENEFIT Schemes scholarships and grants

Actors: member, content reviewer and guide. Dependencies: verified source records, opt-in eligibility inputs, reminders. Screen family: Discovery, Eligibility explanation, Checklist, Application tracker. Discovery is not submission or approval.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| BENEFIT-UC-001 | Match declared circumstances to possible schemes; show unknown eligibility rather than guessing | R myScheme | N |
| BENEFIT-UC-002 | Explain eligibility with official source and last checked date; member can correct inputs | R myScheme | N |
| BENEFIT-UC-003 | Build a document checklist without requiring uploads; member marks preparation progress | R myScheme | N |
| BENEFIT-UC-004 | Follow the official application link; external-site handoff is labelled | R myScheme | N |
| BENEFIT-UC-005 | Track member-reported status separately from verified provider status | P | N |
| BENEFIT-UC-006 | Subscribe to a deadline reminder; timezone, closing date and source changes are handled | P | N |
| BENEFIT-UC-007 | Report an expired or suspicious opportunity; reviewer can unpublish it and notify affected subscribers | P | F when enabled |
| BENEFIT-UC-008 | Discover verified scholarships and business grants; sponsored placement is labelled and does not promise awards | P | X |

### MONEY Financial confidence and savings records

Actors: member, shop owner, invited recordkeeper. Dependencies: private ledger, export and permissions. Screen family: Budget, Goal, Contribution history. Separate personal and business figures. These are recordkeeping proposals, not investment recommendations or payment authorization.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| MONEY-UC-001 | Record income and expenses manually; member can distinguish an estimate from confirmed money received | P | N |
| MONEY-UC-002 | Set a savings goal; progress reflects recorded amounts, not a bank balance claim | U pots | N |
| MONEY-UC-003 | Create a contribution-record group; each member consents and edits retain history | U pots | N |
| MONEY-UC-004 | Record an external contribution with evidence; disputed or unverified entries do not count as settled | P | N |
| MONEY-UC-005 | Send an opt-in contribution reminder without public shaming or exposing amounts to outsiders | P | N |
| MONEY-UC-006 | Export a ledger and reconcile opening balance, entries and closing balance | P | N |
| MONEY-UC-007 | Learn budgeting and fraud prevention from reviewed educational content | P | N |
| MONEY-UC-008 | Enable actual pooled funds only after partner and jurisdiction approval; custody and dispute responsibility must be disclosed | U pots | G |

### LOCAL Local discovery and member requests

Actors: seeker, provider, moderator. Dependencies: coarse location, catalogue, circles and consented messaging. Screen family: Nearby, Request composer, Offers, Accepted request.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| LOCAL-UC-001 | Search by manually selected neighbourhood without granting device location | P | N |
| LOCAL-UC-002 | Post a need with category, budget range and deadline to an allowed audience | P | N |
| LOCAL-UC-003 | Receive provider responses without revealing phone number or home address | P | N |
| LOCAL-UC-004 | Accept an offer; any resulting paid work links to the existing service order system | P | N |
| LOCAL-UC-005 | Mark a request fulfilled, withdrawn or expired; stop soliciting further responses | P | N |
| LOCAL-UC-006 | Verify a business profile claim; do not equate address verification with quality or personal safety | P | N |
| LOCAL-UC-007 | Report suspicious offers; moderator can freeze contact pending review | P | F when enabled |
| LOCAL-UC-008 | Open a city chapter only when organizers, supply and support capacity meet pilot criteria | P | X |

### EVENT Events and experiences

Actors: organizer, attendee, moderator. Extends CIRCLE-UC-018 and LEARN-UC-016 with shared event records. Screen family: Event detail, Booking, Waitlist, Organizer dashboard.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| EVENT-UC-001 | Create a workshop with language, accessibility, venue visibility and conduct rules | P | N |
| EVENT-UC-002 | Reserve a free seat; capacity cannot be exceeded by concurrent requests | P | N |
| EVENT-UC-003 | Join a waitlist; offered seats expire and move to the next eligible person | P | N |
| EVENT-UC-004 | Publish a material time or venue change; attendees receive a clear acceptance or cancellation choice | P | N |
| EVENT-UC-005 | Check in without publishing attendee identities to the entire circle | P | N |
| EVENT-UC-006 | Cancel an event and notify attendees; paid refunds use shared payment reconciliation | P | N |
| EVENT-UC-007 | Sell tickets with fees, cancellation terms and provider confirmation disclosed | P | G commerce |
| EVENT-UC-008 | Report an event incident independently of the organizer and preserve relevant evidence | P | F when enabled |

### CREATOR Creator products and teaching operations

Actors: trainer, creator, learner, reviewer. Extends Learn content and Earn digital listings. Screen family: Creator studio, Rights declaration, Resource detail, Purchases.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| CREATOR-UC-001 | Create a reusable template or learning download with clear licence and permitted use | P | X |
| CREATOR-UC-002 | Preview a resource before purchase; private source files remain protected | P | X |
| CREATOR-UC-003 | Deliver the purchased version through authorized access; repeat downloads respect licence limits | P | G commerce |
| CREATOR-UC-004 | Update learning content with a version history and correction notices | P | N |
| CREATOR-UC-005 | Caption and translate a lesson; creator reviews generated text, especially high-stakes claims | U video | N |
| CREATOR-UC-006 | Handle copyright complaints with temporary restriction, evidence and appeal | P | F when enabled |
| CREATOR-UC-007 | View completion and satisfaction aggregates; do not expose individual private learning struggles | P | N |
| CREATOR-UC-008 | Offer a recurring membership only with explicit renewal consent and straightforward cancellation | P | X |

### TRUST Operations and resolution

Actors: reporter, caseworker, reviewer, appeals owner. Extends PLAT moderation and support. Screen family: Report, My cases, Review queue, Appeal. Moderators cannot browse arbitrary health records or private messages without an authorized case purpose.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| TRUST-UC-001 | Submit a report across shops, jobs, circles or mentoring; receive a case ID and block option | P | F |
| TRUST-UC-002 | Triage urgency with a documented human review path; AI may assist but does not decide permanent sanctions | P | F |
| TRUST-UC-003 | Preserve relevant reported evidence; record origin, access and retention basis | P | F |
| TRUST-UC-004 | Restrict a dangerous listing or account with reason and reviewer identity recorded | P | F |
| TRUST-UC-005 | Appeal to a different reviewer where feasible; decision and explanation are delivered | P | F |
| TRUST-UC-006 | Track refund or service disputes without revealing unrelated member data to either party | P | N |
| TRUST-UC-007 | Route overdue cases to a backup owner; disclose actual service hours | P | F |
| TRUST-UC-008 | Revoke expired professional credentials and pause affected services while preserving user access to records | P | F when enabled |
| TRUST-UC-009 | Exercise incident response and provider outage runbooks; record recovery test outcomes | P | F |
| TRUST-UC-010 | Disable unsafe AI or sensitive feature per region without shutting down basic account access | P | F |

### GROWTH Responsible acquisition and future business options

Actors: member, organizer, merchant, growth analyst. Dependencies: consent, fraud checks, useful supply and support capacity. Screen family: Share, Referral terms, Programme, Billing.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| GROWTH-UC-001 | Share an eligible public shop or event link; private circles never become public through link previews | P | N |
| GROWTH-UC-002 | Invite a friend voluntarily; contacts are not uploaded or messaged without consent | P | L |
| GROWTH-UC-003 | Attribute a referral after a genuine completed action with caps and self-referral checks | P | X |
| GROWTH-UC-004 | Run a local ambassador programme with organizer review, disclosures and member complaints | P | X |
| GROWTH-UC-005 | Recommend learning for a self-selected career goal and let the member approve profile updates | R HerKey pattern | N |
| GROWTH-UC-006 | Reserved future option: merchant subscriptions; no current pricing or subscription implementation | P | Deferred by founder |
| GROWTH-UC-007 | Label sponsorships; never target them using cycle, mood, incident or precise travel data | P | X |
| GROWTH-UC-008 | Measure first useful outcome and repeat success without counting distress or emergency interactions as engagement wins | P | F |

### Extensions to existing modules

These IDs continue the original sequences. Dependencies and actors inherit the original module plus the named shared capability.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| AUTH-UC-021 | Change a phone number with reauthentication, old-channel notice where safe and session review | P | F |
| AUTH-UC-022 | Resolve a stolen-account complaint without letting a new OTP bypass an existing restriction | P | F |
| CYCLE-UC-031 | Pause predictions independently from private historical logging | P | L |
| CYCLE-UC-032 | Record a log offline and merge once; duplicate delivery cannot create two periods | P | L |
| CYCLE-UC-033 | Show observed and estimated dates differently; a forecast never becomes a confirmed health log | P | L |
| EARN-UC-035 | Request a custom product quote with scope, revision limit and delivery date approved by both sides | P | N |
| EARN-UC-036 | Place an expiring service-slot hold; concurrent buyers cannot reserve the same capacity | P | N |
| EARN-UC-037 | Restock from a receipt suggestion only after matching SKU, unit and quantity and seller approval | U AI | N |
| EARN-UC-038 | Define home-business fulfilment zones and pickup windows without publishing a private address | P | L |
| EARN-UC-039 | Limit assistant or staff permissions to named shops; ownership and payout changes require owner reauthentication | U assisted shop | F when enabled |
| CIRCLE-UC-031 | Revoke leaked invite links; expired or revoked tokens cannot admit new members | U invites | L |
| CIRCLE-UC-032 | Summarize a discussion only when the circle permits AI; summary links to messages visible to the reader | P | N |
| CIRCLE-UC-033 | Control new-member history visibility, with explicit rules for attachments and search | P | L |
| LEARN-UC-026 | Apply as a peer mentor without professional claims; badge states the reviewed scope rather than universal expertise | U mentors | L |
| LEARN-UC-027 | Cancel or reschedule mentoring with refund and no-show rules where paid | P | N |
| SAFE-UC-031 | Run a clearly labelled contact-alert test; it must not resemble a real emergency | R Google pattern | G travel |
| SAFE-UC-032 | Require contact acknowledgement and escalate to an agreed backup; delivery alone does not mean help accepted | P | G travel |
| SAFE-UC-033 | Show stale location age and tracking degradation; never label old coordinates live | R Google constraints | G travel |
| SAFE-UC-034 | Revoke a travel-sharing link and expire access at session end | P | G travel |
| HEALTH-UC-026 | Separate member-entered, imported and professionally verified data in a health summary | P | N |
| FASHION-UC-023 | Revalidate price, stock and delivery before payment; buyer approves changed totals | P | N |
| JOBS-UC-031 | Withdraw an application and explain what recipient records cannot automatically be recalled | P | N |
| JOBS-UC-032 | Expire stale jobs and request employer reconfirmation before relisting | P | N |
| PLAT-UC-017 | Complete consent withdrawal across queued jobs, indexes and sharing links, not only the visible UI | P | F |

## 5 Detailed priority scenarios

These scenarios are ready for design and engineering elaboration, not final signed-off specifications. Proposed API names describe contracts; they do not claim a deployed backend. All require authorization, validation, accessible errors and automated tests.

### S01 Secure membership and recovery

IDs: AUTH-UC-001, 003–010, 012–017, 018–022. Actors: applicant, member, verified guardian where required, support reviewer. Trigger: register, login or recover access. Preconditions: supported region, age-appropriate eligibility policy and required guardian consent. Child registration follows S19 and cannot inherit adult permissions.

Flow: choose contact channel; request rate-limited challenge; verify; accept the current membership and privacy terms; choose display name and visibility; optionally enable passkey; enter Home without health questions. On recovery, verify the configured recovery factors and review active sessions. Disputed account control enters a manual path rather than bypassing restrictions.

Rules and exceptions: uniform errors reduce account enumeration; resend invalidates or clearly versions challenges; verification attempts are bounded; lost numbers and SIM changes have a documented path. Members can appeal eligibility decisions. No appearance-based AI classification.

Screens: Welcome, Verify, Eligibility, Minimal profile, Recovery, Sessions, Appeal. Records: Account, ContactVerification, ConsentReceipt, Session, Restriction, Appeal. Contracts: request/verify challenge; list/revoke session; open recovery case. Notifications: new sign-in and recovery notices, privacy-preserving by default. QA: expired OTP fails; duplicate verify cannot create duplicate users; restricted accounts remain restricted after recovery; appeal is visible only to authorized reviewers.

### S02 One tap cycle and mood logging

IDs: CYCLE-UC-001–009, 017, 028, 031–033; DAY-UC-003. Actor: member. Trigger: home shortcut or opted-in discreet reminder. Preconditions: separate health consent; tracking enabled.

Flow: tap Period started, Period ended or Mood; accept local date or edit; optionally select symptoms; save with an idempotency key; show undo; offer one relevant approved next step. Prediction update runs separately and can fail without losing the log.

Rules and exceptions: no response is missing data, not an inferred symptom. A member may skip all mood fields. Future dates are predictions, not observed records. Timezone changes preserve the original event date and timezone. Conflicting offline edits require a merge decision rather than silent overwrite.

Screens: Quick log, Calendar, Edit log, Consent, History. Records: HealthConsent, CycleEvent, SymptomObservation, PredictionRange with model version and input provenance. Contracts: create/update/delete observation; list history; get prediction. Notifications contain no period detail unless enabled. QA: double tap creates one event; undo recalculates derived predictions; unauthorized staff and recruiters receive no health data; insufficient history shows uncertainty rather than a precise claim. Proposed usability target: an established member can log a start or end in two taps without typing.

### S03 Possible late period and approved care

IDs: CYCLE-UC-010–013, 025–026, 029–030; HEALTH-UC-022. Actors: member, clinical content reviewer. Trigger: opted-in forecast follow-up or submitted concerning symptoms.

Flow: compare observed history with the prediction range; ask whether a period was unlogged; offer correction or private approved information; let member pause reminders; offer professional support when appropriate. For urgent concerns, replace entertainment suggestions with an approved care pathway.

Rules: clinical reviewer owns thresholds, wording, exclusions and review dates. AI cannot diagnose pregnancy, infer miscarriage, recommend unreviewed herbs or change medication. Forecasts are not contraception or confirmed ovulation information. Do not disclose suspected pregnancy to an emergency contact or mentor. Reviewed self-care and escalation separation is informed by [NHS guidance](https://www.nhs.uk/symptoms/period-pain/); a regional clinician must approve the actual WomSakhi protocol.

Records: PromptEligibility, reviewed CareCard, ContentVersion, SuppressionPreference. Contracts: eligible care cards; save feedback; request professional directory. QA: paused tracking sends no reminder; correcting an old event invalidates stale alerts; no active content version yields a safe informational fallback; mood distress is not automatically attributed to menstruation.

### S04 Mood relief without intrusive engagement

IDs: CYCLE-UC-018–021, 030; DAY-UC-007. Trigger: member chooses a mood or asks for support. Preconditions: member has opted into suggestions.

Flow: offer Calm down, Talk, Small activity or Skip; serve a short accessible activity; ask optional helpfulness feedback; offer a human resource if requested. Jokes and games are optional and stop when serious distress is expressed. Do not present a game as treatment or force streaks.

Screens: Mood selection, Activity, Support options. Data: voluntary mood event, content ID, feedback, consent. API: get approved activity by chosen preference, save feedback. QA: dismissal stops the session; quiet hours are honoured; health notifications remain discreet; crisis-resource path works when AI is unavailable; no model prompt includes unrelated circle messages.

### S05 Create and operate a shop for another woman

IDs: EARN-UC-002–007, 031, 034, 039. Actors: assisting member and represented owner. Trigger: choose Create for someone else. Preconditions: both eligible owners and operators follow account policy.

Flow: draft name and shop type; invite the owner through an explicitly approved contact; owner verifies and accepts ownership and scoped operator access; owner controls payout setup; publish after listing checks. Owner may revoke operator access or transfer ownership through a reviewed, reauthenticated flow.

Rules: the inviter is not automatically the legal seller or payout beneficiary. Unaccepted shops remain private drafts. A neighbour who declines is not contacted repeatedly. Revocation invalidates sessions and pending operator jobs for that shop.

Screens: Setup, Owner invitation, Role review, Shop dashboard. Data: Shop, OwnershipConsent, OperatorGrant, PayoutReference. Contracts: create draft, accept ownership, grant/revoke operator, publish. QA: operator cannot change payout; rejection prevents publication; user A cannot edit user B's shop by substituting an ID; duplicate acceptance creates one grant. Notifications identify the shop and requested role, without exposing private identity documents.

### S06 Photo voice and receipt assisted catalogue

IDs: EARN-UC-008–013, 037; AI-UC-002. Actor: seller. Trigger: photo, voice note or receipt upload. Preconditions: upload permission and shop role.

Flow: upload and scan media; extract a draft; show uncertain fields; seller chooses SKU and units; preview title, price, stock delta and taxes; validate; approve; save once. Photo descriptions must not invent ingredients, authenticity, medical claims or warranties. Receipt restock is a proposed delta, not an automatic count.

Data: MediaAsset, ExtractionDraft, Product, Variant, StockMovement, ApprovalReceipt. Contracts: upload, extract draft, validate product, apply approved stock delta. Exceptions: unreadable receipts, malicious files, duplicate image, mismatched currency, pack-versus-unit ambiguity, extraction timeout. QA: repeated receipt cannot silently double stock; rejected draft makes no live change; permission revoked between draft and approval blocks the write; source media is deleted according to policy.

### S07 Product checkout fulfilment and refund

IDs: FASHION-UC-004–011, 023; EARN-UC-017–020, 025–026, 032. Actors: buyer, seller, payment provider, support. Trigger: checkout. Gate: payments, refunds, fulfilment support and reconciliation approved together.

Flow: validate seller and listing; choose variant; obtain shipping quote; confirm total and policy snapshot; reserve stock; initiate provider payment; wait for verified callback; confirm order; fulfil; deliver; allow eligible cancellation/return; reconcile refund and settlement. Never use the browser success screen as the sole payment proof.

State model: draft → awaiting_payment → confirmed → fulfilling → shipped → delivered. Cancellation and return are controlled branches. Payment and refund have separate states so pending settlement is not confused with fulfilment. Failed payments release stock; late callbacks reconcile rather than create a second order.

Records: Cart, Quote, Reservation, Order, PaymentAttempt, Shipment, Return, Refund, LedgerEntry. Contracts: quote, checkout, provider webhook, fulfil, request return, approve refund. QA: two buyers cannot buy one remaining unit; repeated callbacks settle once; totals use explicit currency and minor units; refunded totals cannot exceed captured value; address visibility is limited to fulfilment needs. Service jobs and digital purchases reuse payment primitives but have distinct delivery and cancellation policies.

### S08 Service booking and cancellation

IDs: EARN-UC-011, 035–036; LEARN-UC-027. Actors: provider and customer. Preconditions: published duration, capacity, timezone, service scope and cancellation policy.

Flow: select service and slot; hold briefly; confirm scope and price; pay if required; confirm booking; remind; attend; mark completed or dispute. If hold expires, payment processing must not silently confirm an unavailable slot; reconcile or refund through a declared path.

Data: AvailabilityRule, SlotHold, Booking, PolicySnapshot, CompletionEvidence. Contracts: list slots, hold, confirm, reschedule, cancel. QA: concurrent holds obey capacity; daylight-saving changes display correctly; provider cancellation releases capacity and triggers applicable refund; address is withheld until needed; no-show disputes are reviewable. Reminders reveal no sensitive service category unless member opts in.

### S09 Circle membership and protected conversations

IDs: CIRCLE-UC-001–016, 021, 027–033. Actors: owner, admin, moderator, member, invitee. Trigger: create or accept invitation.

Flow: select type and privacy; configure posting/invite rules; issue expiring invite; invitee completes eligibility checks; approve where required; apply least privilege; show history according to policy. Removing a member revokes live subscriptions, attachment access and search results—not just sidebar visibility.

Templates: business, neighbourhood, college, technology, return-to-work, learning, care, parenting, hobby, friendship, volunteering, event, private support and savings-record group. Templates set defaults, not unchangeable powers. No public discovery of secret-circle membership.

Records: Circle, Membership, InviteToken, RoleGrant, Message, Post, Report. Contracts: create, issue/revoke invite, accept, change role, send message, remove member. QA: leaked revoked link fails; last owner must transfer or archive; blocked users cannot initiate new private messages; unauthorized message search is empty; moderator review sees reported evidence only. Decide encryption architecture before promising WhatsApp-equivalent security; server AI summaries and end-to-end encryption have different trust implications.

### S10 Learning publishing and mentor qualification

IDs: LEARN-UC-001–025, 026; CREATOR-UC-004–006. Actors: learner, trainer, guide, verifier. Trigger: publish lesson, apply as mentor or enroll.

Flow: applicant states expertise and evidence; reviewer assigns peer or professional scope; create a profile; submit owned or licensed content; moderate; publish; learner enrolls; resume progress; complete applicable assessment; issue a clearly described completion record. A completion badge is not a professional licence.

Exceptions: external video removed, embedding blocked, copyright complaint, expired credential, no mentor available, learner requests refund, course materially changes. These have visible states, not broken players or hidden queues.

Records: MentorProfile, CredentialReview, ContentLicence, CourseVersion, Enrollment, Progress, Booking. Contracts: apply/review mentor, publish content, enroll, save progress, book session. QA: provider cannot award herself verified-professional status; deletion of a video leaves a graceful explanation; accessible captions are available for published core lessons; private sessions are not recorded by default. Shared guide routing avoids separate mentor implementations in every module.

### S11 Track My Way and missed check-in escalation

IDs: SAFE-UC-002–014, 024–027, 030–034. Actors: member, selected trusted contact and optional staffed operator. Gate: device and outage validation; verified contact reachability; operational owner.

Flow: select destination, expected arrival and interval; show disclosure and escalation sequence; validate permissions and contact test; server acknowledges creation of timed session; request check-in; member chooses Safe, Extend, End or Need help. After the configured grace period, atomically recheck session state and send the preauthorized contact alert. Contact acknowledgement is tracked separately. No acknowledgement invokes the approved backup route.

Proposed states: prepared, active, checkin_due, overdue, alert_sent, contact_acknowledged, ended and cancelled; tracking quality is a separate healthy/degraded/unavailable attribute. A contact acknowledgement does not prove the member is safe. Only an appropriate member confirmation or documented operator resolution closes an incident.

Records: SafetySession, ConsentSnapshot, Deadline, LastLocation with timestamp and accuracy, ContactGrant, AlertAttempt, Acknowledgement. Contracts: start, heartbeat, check-in, extend, end, send alert, acknowledge. Notifications are a critical service dependency. An offline phone cannot supply a fresh location; a server can still act on an already registered deadline if its own dependencies work. Do not promise network-free delivery.

QA: app closed, phone off, denied background location, token expiry, low battery, stale GPS, provider outage, restart during deadline, duplicated worker event, late safe response racing escalation. Use event versions and idempotent delivery keys. Alert text says missed check-in, not confirmed attack. Mark last location age. Show reduced capability before travel starts; failure of session creation must never display Monitoring active. Jokes are opt-in and not required while driving. No LLM decision sits on the critical deadline path.

### S12 Private health navigation and records

IDs: HEALTH-UC-001–025, 026. Actor: member; professional only when separately authorized. Trigger: symptom entry, appointment preparation or record import.

Flow: select goal; optionally log observation; view approved resources; prepare questions; select practitioner; share a chosen summary only after preview; revoke future access. Imported, self-reported and verified facts remain visibly distinct. Do not infer diagnoses from correlation charts.

Records: HealthObservation, Provenance, DocumentGrant, PractitionerScope, Appointment, Reminder. Contracts: log, export, grant/revoke access, directory lookup. QA: shared report excludes unselected cycle data; expired grant fails; booking a coach does not expose medical documents; medication reminders copy a member or clinician schedule and never generate new dosing instructions; deletion removes search and AI retrieval eligibility. Crisis and urgent resources must work without conversational AI.

### S13 Jobs and return to work

IDs: JOBS-UC-001–022, 025–032. Actors: candidate, authorized employer, reviewer and mentor. Trigger: post job or search/apply. Preconditions: employer policy approved; organization verified for stated claims.

Flow: employer submits work type, location, pay basis, requirements and expiry; review; publish; candidate chooses profile visibility; see explainable matches; preview application; submit once; track status; withdraw or report. Training suggestions are optional and cannot imply guaranteed hiring.

Records: Organization, EmployerGrant, Verification, JobVersion, CandidateProfile, Application, StatusEvent. Contracts: publish/expire job, search, preview/submit/withdraw application, report. QA: duplicate apply is safe; expired jobs cannot accept new submissions; forged organization claims enter review; contact details are not bulk exposed; AI never adds invented experience. Health, pregnancy, cycle and safety signals cannot enter ranking. Interview practice is separate from live assessment assistance or impersonation. A withdrawal cannot promise deletion from every recipient system; clearly show the actual scope.

### S14 Benefits and deadline assistance

IDs: BENEFIT-UC-001–008. Actor: member and source reviewer. Trigger: Find opportunities. Preconditions: official source record and last-review date.

Flow: ask only required eligibility questions; show potential match and missing facts; explain source rules; build checklist; link to official application; member records progress; remind before a verified deadline. Data such as income is private and not reused for advertising.

Records: OpportunityVersion, EligibilityRule, MemberInput, Checklist, ApplicationNote, Reminder. Contracts: match, explain, save checklist, report stale source. QA: expired source suppresses apply action or marks uncertainty; unknown eligibility is not shown as approved; deadline edits reschedule reminders; official status is not fabricated from a member note. This flow is inspired by [myScheme](https://www.myscheme.gov.in/) discovery, not a claimed integration.

### S15 Care requests and local services

IDs: CARE-UC-001–008; LOCAL-UC-001–007. Actors: beneficiary, requester, helper/provider. Trigger: ask for help. Preconditions: appropriate sharing authority and audience.

Flow: describe a bounded task; choose trusted audience; approve responses; confirm helper; reveal only necessary logistics; record completion or dispute; close access. A paid local task creates a service order; a voluntary care task must not misleadingly imply insurance, professional vetting or guaranteed attendance.

Records: HelpRequest, BeneficiaryConsent, Offer, Assignment, LogisticsGrant, Completion. Contracts: create, respond, accept, replace helper, complete. QA: two acceptances do not create accidental duplicate assignments; helper withdrawal is visible; revoked grant removes address access; urgent medical situations are redirected to emergency resources rather than waiting for volunteers.

### S16 Contribution records without fund custody

IDs: CIRCLE-UC-023; MONEY-UC-002–006. Actors: group organizer, contributor, reviewer. Trigger: create a pot record. Preconditions: clear no-custody disclosure.

Flow: define goal, expected contributions and visibility; invite participants; record an externally made contribution; optionally attach proof; recipient acknowledges or disputes; update recorded progress; export. A screenshot is evidence submitted by a member, not bank verification.

Records: Goal, MemberAgreement, ContributionRecord, EvidenceReference, Acknowledgement, Adjustment. Contracts: propose contribution, acknowledge, dispute, adjust, export. QA: organizer cannot silently rewrite settled history; disputed entries do not count as confirmed; no interest or return is promised; app does not collect, rotate or distribute group money. Actual pooled funds remain MONEY-UC-008 gated.

### S17 AI approval and safe execution

IDs: AI-UC-001–010; PLAT-UC-017. Actors: member, tool gateway, reviewer. Trigger: AI proposes an action. Preconditions: authenticated user, scoped consent and authorized data retrieval.

Flow: retrieve only permitted records; produce schema-validated draft; show exact changes and impact; member approves; gateway rechecks permissions, limits, record versions and approval expiry; execute idempotently; record receipt; allow undo or remediation. A materially changed price, recipient or payload needs renewed approval.

Records: ActionDraft, Approval, ConsentScope, ExecutionReceipt, Feedback. Contracts: draft, validate, approve, execute, revoke. QA: malicious uploaded instructions cannot invoke tools; stale approvals fail; revoked consent cancels queued optional automation; AI timeout does not block manual operation; no prompt logs contain full health records by default. Travel escalation uses a dedicated preauthorized policy rather than waiting for approval from an unresponsive member.

### S18 Reports appeals and operations

IDs: TRUST-UC-001–010; AUTH-UC-014; PLAT-UC-010, 014–015. Actors: reporter, caseworker, appeals reviewer. Trigger: report or automated flag.

Flow: select category and evidence; offer block; acknowledge case; triage; assign owner and due time; investigate only relevant records; take proportionate action; notify safely; provide appeal; close with retention policy. Serious allegations are not publicly exposed as proven facts.

Records: Case, EvidenceGrant, Assignment, Decision, Appeal, AccessAudit. Contracts: report, assign, restrict, decide, appeal. QA: reporter identity is not leaked to the accused; paid status cannot suppress reports; abandoned queue items escalate; permanent sanctions have a human route; reviewer actions are logged and searchable without exposing raw health text to analytics. Service hours and escalation capacity must be agreed before setting response-time promises.

## 6 Shared implementation and data requirements

### Domain ownership

| Domain | Core records | Events other domains may receive | Data they must not receive by default |
|---|---|---|---|
| Identity | Account, role, consent, verification | Account restricted, role revoked, consent withdrawn | Identity documents and recovery evidence |
| Community | Circle, membership, post, message | Invitation accepted, membership revoked | Private message bodies or secret memberships |
| Commerce | Shop, product, booking, order, refund | Order confirmed, booking changed, refund reconciled | Payout credentials and unnecessary delivery addresses |
| Health | Cycle event, observation, care card | Member-approved generic reminder eligibility | Symptoms, reproductive data and health documents |
| Safety | Session, contact grant, deadline, alert | Authorized contact alert or generic session status | Full route history to commerce, jobs or circle admins |
| Learning and work | Enrollment, skill evidence, application | Member-approved completion and application status | Private mentor conversations and unrelated application data |

Use a modular backend with explicit boundaries before multiplying microservices. Extract high-load or high-risk workers when justified. Server authorization must enforce owner, resource and purpose on every request. Human administrators need scoped access and audited break-glass procedures, not unrestricted browsing.

### Async work and failure design

- Use a transactional outbox or equivalent durable mechanism for order, notification and safety events. Consumers tolerate duplicate delivery; do not assume exactly-once messaging.
- Separate critical safety deadlines from optional AI summaries and marketing queues. Queue pressure must not delay incident work behind promotional work.
- Verify payment webhook authenticity; reconcile against provider records; support retries, dead-letter handling and operator resolution.
- Use record versions for concurrent edits and expiring reservations. Include timestamps, timezone and currency explicitly.
- Index only content visible to the requester. Revocation must invalidate cached search results, subscriptions and signed media access within an agreed bound.
- Keep health and travel telemetry out of general analytics. Define retention by purpose, including backups, exports, legal holds and provider copies.
- Test the device matrix before promising background monitoring: web, PWA and native implementations must have individually validated capability descriptions. Until validated, web offers contact setup and manual help, not an asserted continuous guardian.
- Do not promise end-to-end encrypted chat until the chosen architecture and reporting, recovery and AI tradeoffs are reviewed.

### Required screen states and reusable assets

Every enabled journey needs loading, empty, saved draft, validation error, permission denied, offline/degraded, rate-limited, expired, conflict, retry, cancelled, restricted and completed states where applicable. Design screen IDs against use-case IDs; do not invent a separate screen for each backend operation.

Track icons, illustrations, avatars and care-card media per screen with source, licence, localization text alternatives and responsive variants. Section 16 makes asset selection, authorized generation, optimization and integration part of implementation acceptance. This document update specifies that work; it does not itself generate the production image set. Never use real-looking professional avatars to imply a nonexistent verified person.

## 7 AI permissions and trust rules

| Action | Default behaviour | Required approval |
|---|---|---|
| Suggest an approved learning item | Allowed from consented preferences | Member can disable personalization |
| Draft a shop description | Draft only | Seller approves publication and factual claims |
| Change stock from receipt | Draft a reconciled delta | Authorized seller confirms SKU, units and quantity |
| Log symptoms or period dates | Never invent missing observations | Member input or explicitly approved import |
| Submit a job application | Preview only | Candidate confirms job and exact application |
| Change payout or transfer shop | No autonomous change | Owner reauthentication and applicable review |
| Contact emergency recipients | Deterministic policy only | Prior session-specific consent; manual SOS remains available |
| Diagnose or prescribe | Out of scope for general AI | Qualified clinical pathway, separately governed |
| Restrict a user permanently | Flag and prioritize review | Human decision and appeal route |

An AI audit record should retain action type, source IDs, versions, policy result and outcome with minimized content. Keeping every raw conversation indefinitely is not an acceptable default. Benchmark hallucinations, harmful advice, source mismatch, prompt injection, demographic bias, local-language quality and context leakage before enabling new AI actions.

## 8 Growth model and sustainability

These are hypotheses to test, not forecasts or promises of funding. Start with one or two pilot communities where women already have reasons to transact and support each other, such as a neighbourhood network and a training cohort. Recruit credible organizers and enough real suppliers before acquiring broad demand.

| Growth loop | First value | Repeat value | Guardrail |
|---|---|---|---|
| Community | Join a useful trusted circle | Helpful answers, events and support | Report rate, response quality, member control |
| Seller | Publish and receive a qualified enquiry | Completed orders and repeat buyers | Fraud, refund and fulfilment outcomes |
| Learning to work | Complete a useful lesson or portfolio task | Relevant applications and interviews | No guaranteed placement claims or pressured course purchase |
| Mentoring | Receive a useful answer or session | Follow-through on agreed goals | Credential scope, no-show rate and misconduct handling |
| Local requests | Find a willing helper or provider | Fulfilled recurring needs | Address privacy and provider reliability |

Revenue-model decisions are deferred by the founder. Preserve earlier monetization ideas only as a future discussion backlog; do not design Pro limits, subscription tiers, platform commissions or upsells in the current specification. First complete the feature catalogue and assess user value and operating requirements. Provider API fees, hosting and moderation costs still need budgets. Product/service prices and trainer fees, where applicable, are distinct from choosing WomSakhi's revenue model. Account deletion, abuse reporting and basic emergency information must remain accessible.

### Metrics and proposed evaluation plan

| Metric | Definition | Interpretation |
|---|---|---|
| First-value rate | Eligible activated members completing one chosen useful journey / activated members in cohort | Better than raw sign-ups; track by chosen goal |
| Time to first value | Elapsed time from onboarding completion to that outcome | Identify unnecessary forms and missing supply |
| Repeat useful outcome | Members repeating a chosen useful action in a defined 28-day window | Do not use crisis activity as a positive engagement goal |
| Seller activation | Approved shops receiving a qualified enquiry or completed order / approved published shops | Distinguish catalogue-only and transactional pilots |
| Mentor reliability | Completed sessions / confirmed sessions, with reasons for cancellations | Separate member cancellation from provider failure |
| Safety reliability | Due checks processed and delivery attempts within approved operational thresholds | Delivery is not rescue; inspect failures and false alarms |
| Trust responsiveness | Case acknowledgement and resolution time by severity | Set staffed service levels before advertising them |
| Automation usefulness | Accepted valid suggestions minus correction burden and harmful-action incidents | More automation is not automatically better |
| Operating readiness | Provider, hosting, support, moderation and AI costs per relevant outcome | Budget reliable delivery without selecting a revenue model |

Proposed pilot method: interview intended members and organizers; run moderated usability tasks; test an invite-only cohort; review support and failure data weekly; expand one dependency-complete journey at a time. No calendar commitment or numeric retention target is asserted without cohort and budget information.

## 9 Decisions and specialist gates

| Decision | Recommended default | Owner before launch |
|---|---|---|
| Geography and language | India-first pilot; select languages from actual cohort | Founder and operations |
| Age policy | All ages in product scope; cohort-specific permissions and verified guardian support where required; gate child release until validated | Founder, safeguarding and legal reviewer |
| Women-only eligibility and appeals | Clear inclusive written policy, no biometric gender inference | Founder and trust lead |
| External contacts and employer users | Isolated non-community roles only if approved | Founder, security and legal reviewer |
| Clinical scope | Logging and reviewed education before personalized clinical services | Clinical lead |
| Mentors | Separate peer, guide and professional scopes | Mentor operations |
| Cash handling and savings pots | Non-custodial records first | Finance, legal reviewer and payment partner |
| Travel monitoring | Web foreground location and server-timed check-ins with explicit degraded states; native background capability deferred | Web engineering, reliability and safety operations |
| Emergency integrations | Do not claim dispatch or responder access without agreement and verification | Safety operations |
| Messaging privacy | Document encryption and abuse-report design before implementation | Security and product |
| Seller categories | Begin with a reviewed allowlist; restrict high-risk goods | Commerce operations |
| Rights content | Region-specific reviewed content with effective and review dates | Qualified legal content reviewer |
| Biometrics and identity documents | Minimize collection and retention; distinguish account security from eligibility | Privacy and security |
| Support promises | Publish only staffed hours and achievable escalation service levels | Operations |

## 10 Development handoff and change control

For each selected use case, a ticket must link: stable ID; origin; release gate; actor; trigger; consent and preconditions; main and alternate flows; screen IDs; fields and validation; API contract; permission checks; state transitions; notification template; retention and deletion behaviour; analytics events; acceptance examples; dependency tickets; product and QA owners.

Status sequence: proposed → clarified → approved → designed → implemented → verified → released. A new idea enters proposed status; it does not silently change approved scope. A policy or clinical gate cannot be cleared by an engineering completion flag.

Immediate planning direction: maintain the complete catalogue before the founder selects first-version scope. Earlier bundles and phases are dependency proposals, not approved scope cuts. Development targets a responsive web application first. Once a slice is selected, deliver it end to end with required controls and manual fallbacks; native mobile comes later. Travel monitoring and money custody remain capability-gated.

## 11 Consolidated original registry

The following section preserves all 262 original IDs and titles for traceability. U means the capability was directly requested; other original additions are conservatively marked P rather than retroactively claimed as researched. The original numbered-order priority assignment is withdrawn. Dependencies and revised release gates below override the first Word draft. A registry row is a backlog scope item, not a complete implementation ticket.

### AUTH Women Only Identity and Authentication

Create a secure women-centred community without invasive gender surveillance.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| AUTH-UC-001 | Register with mobile OTP | U | F |
| AUTH-UC-002 | Register with email and verification | P | F |
| AUTH-UC-003 | Accept women-only community declaration | U | F |
| AUTH-UC-004 | Complete age and region declaration | P | F |
| AUTH-UC-005 | Create profile with minimum data | U | F |
| AUTH-UC-006 | Choose privacy and discoverability | P | F |
| AUTH-UC-007 | Enable passkey or biometric sign-in | P | F |
| AUTH-UC-008 | Enable two-factor authentication | P | F |
| AUTH-UC-009 | Recover account securely | P | F |
| AUTH-UC-010 | Manage trusted devices and sessions | P | F |
| AUTH-UC-011 | Optional identity verification badge | P | N |
| AUTH-UC-012 | Report suspected ineligible account | P | F |
| AUTH-UC-013 | Moderation review of eligibility report | P | F |
| AUTH-UC-014 | Appeal account restriction | P | F |
| AUTH-UC-015 | Block and mute another member | P | F |
| AUTH-UC-016 | Download personal data | P | F |
| AUTH-UC-017 | Delete account and data | P | F |
| AUTH-UC-018 | Guardian-supported minor account | U | F implementation; G child release |
| AUTH-UC-019 | Consent refresh after policy change | P | F |
| AUTH-UC-020 | Admin audit of sensitive access | P | F |

### CYCLE AI Cycle Mood and Daily Care

Reduce logging effort through one-tap check-ins while keeping health guidance explainable and non-diagnostic.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| CYCLE-UC-001 | Set cycle preferences and goals | U | L |
| CYCLE-UC-002 | Log period start with one tap | U | L |
| CYCLE-UC-003 | Log period end with one tap | U | L |
| CYCLE-UC-004 | Quick-log flow intensity | U | L |
| CYCLE-UC-005 | Quick-log pain and symptoms | U | L |
| CYCLE-UC-006 | Quick-log mood and energy | U | L |
| CYCLE-UC-007 | Correct or delete a log | P | F when module enabled |
| CYCLE-UC-008 | Predict next period range | U | L |
| CYCLE-UC-009 | Show confidence and uncertainty | P | F when module enabled |
| CYCLE-UC-010 | Detect a possibly missed period | U | N |
| CYCLE-UC-011 | Ask pregnancy-context question privately | P | N |
| CYCLE-UC-012 | Offer evidence-reviewed self-care guidance | U | F when module enabled |
| CYCLE-UC-013 | Flag red-flag symptoms for clinical care | P | F when module enabled |
| CYCLE-UC-014 | Create medication or supplement reminder | U | N |
| CYCLE-UC-015 | Create hydration sleep and movement nudges | U | N |
| CYCLE-UC-016 | Personalize suggestion frequency | U | F when module enabled |
| CYCLE-UC-017 | Quiet mode and notification privacy | P | F when module enabled |
| CYCLE-UC-018 | Mood reset activity | U | L |
| CYCLE-UC-019 | Guided breathing or grounding | U | L |
| CYCLE-UC-020 | Short distraction game | U | L |
| CYCLE-UC-021 | Journal by text or voice | P | N |
| CYCLE-UC-022 | Generate weekly pattern summary | P | N |
| CYCLE-UC-023 | Prepare doctor-visit summary | P | N |
| CYCLE-UC-024 | Share selected report with clinician | P | N |
| CYCLE-UC-025 | Menopause perimenopause or irregular-cycle mode | P | L |
| CYCLE-UC-026 | PCOS endometriosis and postpartum preference | P | L |
| CYCLE-UC-027 | Wearable or health-platform import | P | X — consented integration |
| CYCLE-UC-028 | Export and erase health data | P | F when module enabled |
| CYCLE-UC-029 | Human mentor referral | U | N |
| CYCLE-UC-030 | Crisis-support escalation | P | F when module enabled |

### EARN Earn and Women Owned Shops

Let a member start and operate a product or service business for herself or, with consent, for someone she supports.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| EARN-UC-001 | Choose seller persona | U | L |
| EARN-UC-002 | Create shop for self | U | L |
| EARN-UC-003 | Create assisted shop for another woman | U | L |
| EARN-UC-004 | Obtain represented-owner consent | U | F when module enabled |
| EARN-UC-005 | Name and brand shop | U | L |
| EARN-UC-006 | Select product service or hybrid shop | U | L |
| EARN-UC-007 | AI-guided shop setup | U | L |
| EARN-UC-008 | Upload product by photo | U | L |
| EARN-UC-009 | AI draft title description and category | U | L |
| EARN-UC-010 | Add variants price tax and stock | P | N |
| EARN-UC-011 | Create service package and availability | U | N |
| EARN-UC-012 | Voice-based catalogue entry | P | N |
| EARN-UC-013 | Receipt-based inventory suggestion | P | N |
| EARN-UC-014 | Import catalogue in bulk | P | N |
| EARN-UC-015 | Publish unpublish or schedule listing | P | L |
| EARN-UC-016 | Manage inventory and low-stock alerts | P | N |
| EARN-UC-017 | Receive and confirm order | P | N |
| EARN-UC-018 | Pack ship deliver or arrange pickup | P | N |
| EARN-UC-019 | Track order status | P | N |
| EARN-UC-020 | Handle cancellation return refund and dispute | P | F when module enabled |
| EARN-UC-021 | Chat with buyer safely | P | L |
| EARN-UC-022 | Create coupon bundle and loyalty offer | P | N |
| EARN-UC-023 | Share shop and product link | P | L |
| EARN-UC-024 | View sales expenses profit and payout | P | N |
| EARN-UC-025 | Manage wallet bank and payout | P | G — see decisions |
| EARN-UC-026 | Issue invoice or receipt | P | N |
| EARN-UC-027 | Request business mentor | U | L |
| EARN-UC-028 | Book mentoring session | U | N |
| EARN-UC-029 | Receive AI growth suggestions | U | N |
| EARN-UC-030 | Run community group order | P | N |
| EARN-UC-031 | Hire helper and assign staff permissions | U | N |
| EARN-UC-032 | Moderate prohibited or unsafe products | P | F when module enabled |
| EARN-UC-033 | Rate buyer and seller | P | N |
| EARN-UC-034 | Pause close or transfer shop | P | L |

### CIRCLE Circles Community and Messaging

Support trusted groups for friendship, business, learning, care and shared goals.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| CIRCLE-UC-001 | Create a circle | U | L |
| CIRCLE-UC-002 | Choose predefined circle type | U | L |
| CIRCLE-UC-003 | Create custom circle type | U | L |
| CIRCLE-UC-004 | Set public private secret or approval-based access | U | L |
| CIRCLE-UC-005 | Name describe and brand circle | U | L |
| CIRCLE-UC-006 | Invite by contact link QR or username | U | L |
| CIRCLE-UC-007 | Approve or reject join request | U | L |
| CIRCLE-UC-008 | Join through invite | U | L |
| CIRCLE-UC-009 | Assign owner admin moderator and member roles | U | F when module enabled |
| CIRCLE-UC-010 | Configure granular permissions | U | F when module enabled |
| CIRCLE-UC-011 | Remove suspend or reinstate member | U | F when module enabled |
| CIRCLE-UC-012 | Leave circle or transfer ownership | P | F when module enabled |
| CIRCLE-UC-013 | One-to-one and group chat | U | L |
| CIRCLE-UC-014 | Send voice photo video file and location | P | L |
| CIRCLE-UC-015 | Create threaded discussion | U | L |
| CIRCLE-UC-016 | Create post with comments and reactions | U | L |
| CIRCLE-UC-017 | Create poll | P | N |
| CIRCLE-UC-018 | Create event and RSVP | P | N |
| CIRCLE-UC-019 | Create announcement | P | L |
| CIRCLE-UC-020 | Pin bookmark and search content | P | L |
| CIRCLE-UC-021 | Mute customize and digest notifications | P | F when module enabled |
| CIRCLE-UC-022 | Create business circle | U | L |
| CIRCLE-UC-023 | Create savings or contribution circle | U | N records only; G for actual funds |
| CIRCLE-UC-024 | Create study tech or career circle | U | L |
| CIRCLE-UC-025 | Create neighbourhood or college circle | U | L |
| CIRCLE-UC-026 | Create care or parenting circle | P | L |
| CIRCLE-UC-027 | Report content member or circle | P | F when module enabled |
| CIRCLE-UC-028 | Emergency moderator intervention | P | F when module enabled |
| CIRCLE-UC-029 | Content and spam moderation | P | F when module enabled |
| CIRCLE-UC-030 | Archive export or delete circle | P | F when module enabled |

### LEARN Learn Teach and Mentoring

Enable women to learn, teach, mentor and earn from trusted knowledge.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| LEARN-UC-001 | Browse learning catalogue | U | L |
| LEARN-UC-002 | Search filter and recommend learning | P | L |
| LEARN-UC-003 | Enroll in free or paid learning | P | N |
| LEARN-UC-004 | Watch hosted video | U | N |
| LEARN-UC-005 | Open approved external video | U | L |
| LEARN-UC-006 | Download permitted material | P | N |
| LEARN-UC-007 | Track progress and resume | P | N |
| LEARN-UC-008 | Complete quiz assignment or project | P | N |
| LEARN-UC-009 | Earn certificate or badge | P | N |
| LEARN-UC-010 | Create learning goal and plan | P | N |
| LEARN-UC-011 | Apply to become mentor or trainer | U | L |
| LEARN-UC-012 | Verify mentor credentials | P | F when module enabled |
| LEARN-UC-013 | Create mentor profile | U | L |
| LEARN-UC-014 | Publish course workshop or resource | U | N |
| LEARN-UC-015 | Upload video or link content | U | N |
| LEARN-UC-016 | Schedule live class | P | N |
| LEARN-UC-017 | Create cohort or study circle | P | N |
| LEARN-UC-018 | Book one-to-one mentoring | U | N |
| LEARN-UC-019 | Match mentor by language goal and availability | U | L |
| LEARN-UC-020 | Chat before and after session | U | L |
| LEARN-UC-021 | Rate and report mentor | P | F when module enabled |
| LEARN-UC-022 | Manage mentor payout | P | G — see decisions |
| LEARN-UC-023 | AI learning coach | P | N |
| LEARN-UC-024 | Translate caption and summarize lesson | P | N |
| LEARN-UC-025 | Moderate copyright and harmful content | P | F when module enabled |

### SAFE Help Safety Rights and Travel Guardian

Provide discreet help, rights education and consent-based travel monitoring while clearly separating support from emergency services.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| SAFE-UC-001 | Open discreet help hub | U | L |
| SAFE-UC-002 | Configure emergency contacts | U | L |
| SAFE-UC-003 | Verify emergency contact consent | U | L |
| SAFE-UC-004 | Start Track My Way | U | G — complete travel bundle |
| SAFE-UC-005 | Choose destination route and expected arrival | U | G — complete travel bundle |
| SAFE-UC-006 | Choose 15 or 30 minute check-in | U | G — complete travel bundle |
| SAFE-UC-007 | Receive one-tap safety check | U | G — complete travel bundle |
| SAFE-UC-008 | Request joke prompt or calming companion | U | G — complete travel bundle |
| SAFE-UC-009 | Extend journey or change destination | P | G — complete travel bundle |
| SAFE-UC-010 | Detect missed check-in | U | G — complete travel bundle |
| SAFE-UC-011 | Escalate to trusted contacts | U | G — complete travel bundle |
| SAFE-UC-012 | Trigger manual SOS | U | G — complete travel bundle |
| SAFE-UC-013 | Call local emergency service | P | L |
| SAFE-UC-014 | Send live location and safety card | U | G — complete travel bundle |
| SAFE-UC-015 | Use covert or quick-exit interface | P | G — complete travel bundle |
| SAFE-UC-016 | Record incident notes evidence and timeline | P | G — complete travel bundle |
| SAFE-UC-017 | Find nearby police hospital shelter or support | P | G — complete travel bundle |
| SAFE-UC-018 | Read rights by country and region | U | L |
| SAFE-UC-019 | Use guided complaint checklist | P | N |
| SAFE-UC-020 | Connect to verified legal or NGO support | U | N |
| SAFE-UC-021 | Report harassment in app | P | F when module enabled |
| SAFE-UC-022 | Block stalker or abusive user | P | F when module enabled |
| SAFE-UC-023 | Safety plan for domestic abuse | P | N |
| SAFE-UC-024 | Lost connectivity fallback | P | G — complete travel bundle |
| SAFE-UC-025 | Battery and location permission alert | P | G — complete travel bundle |
| SAFE-UC-026 | End trip and confirm safe arrival | P | G — complete travel bundle |
| SAFE-UC-027 | Delete or limit location history | P | F when module enabled |
| SAFE-UC-028 | Admin review of safety incident | P | F when module enabled |
| SAFE-UC-029 | Post-incident wellbeing follow-up | P | N |
| SAFE-UC-030 | False-alarm cancellation with safety PIN | P | G — complete travel bundle |

### HEALTH Health and Wellness

Support preventive wellness, navigation and habit-building without presenting AI as a doctor.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| HEALTH-UC-001 | Create wellness profile and goals | U | L |
| HEALTH-UC-002 | Daily one-tap wellbeing check-in | U | L |
| HEALTH-UC-003 | Track sleep hydration movement and meals | U | L |
| HEALTH-UC-004 | Track symptoms and triggers | P | L |
| HEALTH-UC-005 | Create habit and reminder | U | L |
| HEALTH-UC-006 | View trends and correlations | P | N |
| HEALTH-UC-007 | Receive evidence-reviewed wellbeing suggestions | U | L |
| HEALTH-UC-008 | Book verified doctor counsellor or coach | U | G — see decisions |
| HEALTH-UC-009 | Prepare appointment questions | P | N |
| HEALTH-UC-010 | Store documents and prescriptions privately | P | N |
| HEALTH-UC-011 | Medication reminder and adherence log | P | N |
| HEALTH-UC-012 | Pregnancy and postpartum pathway | P | G — see decisions |
| HEALTH-UC-013 | Menopause pathway | P | G — see decisions |
| HEALTH-UC-014 | Mental wellbeing check-in | U | L |
| HEALTH-UC-015 | Stress anxiety and sleep exercises | P | L |
| HEALTH-UC-016 | Nutrition planning by culture and budget | P | N |
| HEALTH-UC-017 | Fitness plan by level and limitations | P | G — see decisions |
| HEALTH-UC-018 | Sexual and reproductive health education | P | N |
| HEALTH-UC-019 | Preventive screening reminders | P | G — see decisions |
| HEALTH-UC-020 | Chronic-condition support preference | P | G — see decisions |
| HEALTH-UC-021 | Connect to peer support circle | P | N |
| HEALTH-UC-022 | Red-flag triage and emergency direction | P | F when module enabled |
| HEALTH-UC-023 | Consent-based caregiver sharing | P | N |
| HEALTH-UC-024 | Export health summary | P | N |
| HEALTH-UC-025 | Delete health data | P | F when module enabled |

### FASHION Women Focused Fashion Marketplace

Create a marketplace for women-focused products with inclusive discovery and trusted commerce.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| FASHION-UC-001 | Browse category and collection | U | L |
| FASHION-UC-002 | Search filter and sort | U | L |
| FASHION-UC-003 | Personalized recommendation | P | N |
| FASHION-UC-004 | View product detail and seller trust | U | L |
| FASHION-UC-005 | Select size colour and variant | U | L |
| FASHION-UC-006 | Use size guide and fit profile | P | L |
| FASHION-UC-007 | Save wishlist and collection | P | N |
| FASHION-UC-008 | Add to cart and checkout | U | N |
| FASHION-UC-009 | Apply coupon wallet or gift card | P | G — see decisions |
| FASHION-UC-010 | Choose address delivery and pickup | P | N |
| FASHION-UC-011 | Track cancel return exchange and refund | P | N |
| FASHION-UC-012 | Rate review and upload photo | P | N |
| FASHION-UC-013 | Ask seller a question | P | L |
| FASHION-UC-014 | Shop local women-owned brands | P | L |
| FASHION-UC-015 | Shop by occasion budget body fit and values | P | N |
| FASHION-UC-016 | Virtual try-on where appropriate | P | X |
| FASHION-UC-017 | Create outfit board | P | X |
| FASHION-UC-018 | Gift product privately | P | X |
| FASHION-UC-019 | Report counterfeit unsafe or inappropriate listing | P | F when module enabled |
| FASHION-UC-020 | Moderate restricted products | P | F when module enabled |
| FASHION-UC-021 | Manage loyalty and referral | P | X |
| FASHION-UC-022 | Cross-border language currency tax and shipping | P | G — see decisions |

### JOBS Jobs Work and Talent

Connect women to inclusive work, flexible opportunities and trusted hiring.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| JOBS-UC-001 | Create candidate profile | U | N |
| JOBS-UC-002 | Build or upload resume | P | N |
| JOBS-UC-003 | AI resume improvement with approval | P | N |
| JOBS-UC-004 | Set job preferences and privacy | P | N |
| JOBS-UC-005 | Search filter and save jobs | U | N |
| JOBS-UC-006 | Receive explainable job matches | P | N |
| JOBS-UC-007 | Apply in app | U | N |
| JOBS-UC-008 | Track application status | P | N |
| JOBS-UC-009 | Schedule interview and reminders | P | N |
| JOBS-UC-010 | Prepare interview with AI coach | P | N |
| JOBS-UC-011 | Request human career mentor | P | N |
| JOBS-UC-012 | Create return-to-work profile | P | N |
| JOBS-UC-013 | Discover remote part-time freelance and local work | P | N |
| JOBS-UC-014 | Create employer profile | U | N |
| JOBS-UC-015 | Verify employer | P | F when module enabled |
| JOBS-UC-016 | Post job | U | N |
| JOBS-UC-017 | Manage applicants and shortlist | P | N |
| JOBS-UC-018 | Message candidate safely | P | N |
| JOBS-UC-019 | Schedule interview | P | N |
| JOBS-UC-020 | Make offer and close job | P | N |
| JOBS-UC-021 | Post gig or task | P | X |
| JOBS-UC-022 | Submit proposal and deliver work | P | X |
| JOBS-UC-023 | Escrow milestone or payout | P | G — see decisions |
| JOBS-UC-024 | Rate employer and worker | P | X |
| JOBS-UC-025 | Report scam discrimination or harassment | P | F when module enabled |
| JOBS-UC-026 | Moderate unsafe or illegal job | P | F when module enabled |
| JOBS-UC-027 | Salary skill and career insights | P | X |
| JOBS-UC-028 | Learning-to-job recommendation | P | N |
| JOBS-UC-029 | Referral through circle | P | X |
| JOBS-UC-030 | Talent pool and availability status | P | X |

### PLAT Shared Platform Capabilities

Capabilities reused across modules.

| ID | Original use case | Origin | Revised phase or gate |
|---|---|---|---|
| PLAT-UC-001 | Unified home and personalized feed | U | L |
| PLAT-UC-002 | Global search | P | L |
| PLAT-UC-003 | Notification centre | P | F |
| PLAT-UC-004 | Mentor directory and booking | U | L |
| PLAT-UC-005 | Payments wallet refunds and payouts | P | N — prerequisite for commerce; G for custody |
| PLAT-UC-006 | KYC and seller verification | P | N — prerequisite for commerce; G for custody |
| PLAT-UC-007 | Localization and accessibility | P | F |
| PLAT-UC-008 | Voice input and low-literacy mode | U | L |
| PLAT-UC-009 | Offline and low-bandwidth behaviour | P | F |
| PLAT-UC-010 | Trust safety and moderation console | P | F |
| PLAT-UC-011 | Admin content and configuration | P | F |
| PLAT-UC-012 | Feature flags and experimentation | P | F |
| PLAT-UC-013 | Consent and privacy centre | P | F |
| PLAT-UC-014 | Audit logs | P | F |
| PLAT-UC-015 | Customer support and grievance flow | P | F |
| PLAT-UC-016 | Analytics with privacy controls | P | F |

## 12 Coverage and completion boundary

The catalogue now distinguishes platform areas, baseline requirements, new opportunities, critical scenario specifications, research observations and gated proposals. Some original entries remain broad epics and overlap shared services; do not estimate total effort by counting IDs. Full field-level contracts and scenario-specific tests still need elaboration for the chosen release bundle. No claim is made that every possible feature worldwide is covered.

Revision 2.0 contained 372 registry IDs and 18 detailed scenarios. Revision 2.1 adds the explicit requirements and scenarios below. Registry counts describe planning records, not independent modules or completed technical specifications.

## 13 Universal experience requirements

### 13.1 Product promise and inclusion

The intended experience is one a family can trust and a girl or woman can use with dignity and increasing independence. Trust must come from demonstrable safety, clarity and useful outcomes—not surveillance, claims of perfect protection or a label such as best in the world. Adults retain autonomy; supporting families does not make fathers or partners default account controllers.

Do not equate age, rural location, education or English proficiency with ability. Offer language, guidance density, text size and audio preferences explicitly. A skilled older member can use the full interface; a young adult can choose guided mode. Never label a mode illiterate, uneducated or village mode. Suggested labels: Simple view, More options, Listen and Help me.

Create supported routes for children using a guardian's device, women sharing a family phone, first-time smartphone users, low-vision members, motor-impaired members, and people with intermittent connectivity. Independent infant or toddler accounts are not required: very young children use an adult-operated, minimal-data co-use experience.

Language rollout proposal: validate Telugu, Hindi and English with the first Indian pilot, then expand from actual demand; this is not a claim those translations exist. Provide native-script language names, localized help and notifications, and human-reviewed safety, health and consent wording. Centralize translation keys, pluralization, number/date/currency formatting and font fallbacks; no hardcoded English-only controls. When supporting right-to-left languages, test full reading order and logical layout rather than merely right-aligning text. Preserve user-entered names and source content, label machine translations and make originals available. If reliable speech recognition is unavailable for a language or accent, retain usable picture-and-label choices rather than forcing English or voice.

### 13.2 Low typing and image-led forms

Apply these rules to create, read, update and delete flows—not only onboarding:

1. Start from intent: show a few picture-plus-label choices such as Join a group, Learn, Sell something or Get help. Progressive disclosure must not hide essential safety or legal information.
2. Prefer previously confirmed data, suggested choices, category cards, date pickers, quantity steppers, selectable examples and optional voice over repeated typing. Always offer Other, Edit, None or Not sure where valid.
3. Images supplement localized labels and accessible names; never require users to guess an icon or understand English. Provide optional replayable audio instructions. Do not autoplay sensitive health text on a shared phone.
4. For circle creation, select a pictured purpose, privacy option and suggested cover; choose or edit a suggested name; preview; create. Ask for a custom description only if useful. Invite after creation instead of blocking the flow with an address-book request.
5. For shop creation, select pictured business type and product/service mode; offer editable names and cover choices; request only necessary owner information; preview. Let catalogue and fulfilment setup happen progressively before publication, with explicit readiness checks.
6. For product creation, choose Take photo, Choose photo or Add without photo where permitted; extract a draft; review uncertain values; confirm. A photo may suggest a category, but cannot certify ingredients, authenticity, stock, age suitability or safety.
7. For edits, prefill known values, highlight changed fields and retain unsaved progress. For deletion, show the exact target and consequence; undo reversible changes and confirm destructive ones. Avoid type-to-confirm by default; use an accessible deliberate confirmation unless security genuinely requires stronger proof.
8. Show one clear primary action and a predictable Back action per step. Keep work after validation errors, app interruption, language changes or reconnect. Sensitive local drafts need expiry and shared-device protection.
9. Preserve consent and review despite tap-reduction goals. Publishing, payments, contacting people, health sharing and deletion may require more steps than ordinary logging.
10. AI fills drafts, not facts. Mark suggestions clearly, make correction easy and preserve provenance. No silent symptom inference, gender inference or guardian approval.

Proposed usability acceptance targets, to validate with actual participants rather than claim as achieved: routine period start/end logging within two taps after setup; standard circle creation without mandatory free text when a suggested name is accepted; no retyping unchanged fields on an edit; at least 90% unassisted completion of selected low-risk pilot tasks per tested cohort and language. Record sample sizes, failures and assistance—do not hide weaker cohorts behind a pooled average.

### 13.3 Prevent module confusion

Use one canonical record and one plain-language name per concept. Member-facing labels may be simpler than internal module names.

| User intent | Canonical destination | Cross-link rule |
|---|---|---|
| Buy a product or book a service | Market | Opens the same listing created in Earn |
| Sell, manage stock or fulfil an order | Earn / My shop | Buyer preview is a view, not a copied listing |
| Join or message a group | Circles / My groups | Care and study groups use the same membership system |
| Learn a skill or meet a mentor | Grow / Learn and mentors | Mentoring elsewhere links to the same directory and booking |
| Find work | Grow / Jobs | Shop hiring links to the jobs service, not a second application inbox |
| Record a period or mood | Wellbeing / My health | Optional private module; never a membership requirement |
| Track a journey or get urgent help | Help and Safety | Prominent and distinct from routine platform support |
| Find a scheme or scholarship | Grow / Opportunities | Source and application status stay in one record |

Each destination needs a brief localized purpose statement, representative examples and a clear next action. Keep labels, active states and back behaviour stable across devices. Do not rename tabs unpredictably through AI. Use in-context links instead of forcing members to understand backend modules. A capability hidden by age policy must be denied by the API too, not merely removed from navigation.

## 14 Responsive design system and CSS contract

### 14.1 Design foundation

Premium means coherent typography, space, hierarchy, useful imagery, clear feedback and reliable interaction. It does not mean tiny text, excessive gradients, heavy animation or decorative cards around everything. Preserve the approved WomSakhi logo, faces, shapes and colours when those source assets are supplied; do not redraw or recolour the logo through image generation. Recover the approved repository brand kit before assigning final palette values. If absent, document a provisional palette and ask for the missing canonical asset instead of inventing an approved one.

Use one versioned design-token source for colour, typography, spacing, radii, shadows, borders, opacity, layering, motion, breakpoints and component sizes. Components reference semantic tokens rather than their own arbitrary CSS values. Fixed literals may exist in the token definition and documented exceptions, not scattered throughout screens. Use the repository's existing styling stack; do not introduce a competing CSS framework solely for a new module.

Token namespaces should distinguish primitive values, semantic roles and component tokens. Examples: colour.action.primary, colour.text.body, colour.surface.raised, colour.status.danger, space.controlGap, radius.card, type.body and motion.feedback. A single token change should update all relevant modules. Light, dark, high-contrast and easy-view variants must use the same semantics if offered; do not launch partially styled themes.

### 14.2 Colour and typography

- Use the approved primary brand colour for a consistent action hierarchy, neutral surfaces for readability and restrained supporting colours for navigation or illustration. No scientific claim is made that one hue universally creates trust or suits all women.
- Reserve semantic danger, warning, success and information roles consistently. Colour is always reinforced by wording, shape or icon; a selected image tile also has a visible selection indicator and accessible state.
- Measure each text/background and control pairing in every state. Text requires at least 4.5:1 contrast for ordinary text and 3:1 for qualifying large text under WCAG AA. Relevant UI boundaries and indicators require 3:1 under the non-text criterion, with its defined exceptions. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Use readable type with fonts that actually support each script. Suggested product defaults are a 16 CSS-pixel-equivalent body size and comfortable line height, with user enlargement; these are design proposals, not a guarantee of accessibility. Telugu, Hindi and other scripts may need different metrics without changing the hierarchy.
- Avoid text embedded in generated artwork. UI text stays in localized components so it can resize, translate and be read by assistive technology. Never truncate critical prices, safety states, consent or error instructions.

### 14.3 Responsive behaviour

Use content-driven layout changes, flexible grids, min/max sizing, container-aware components and logical CSS properties. Verify representative viewport widths at 320, 360, 390, 768, 1024 and 1440 CSS pixels plus intermediate widths, portrait/landscape, zoom, browser chrome and the onscreen keyboard. These test widths are coverage samples, not mandated media-query breakpoints.

| Surface | Small-screen behaviour | Larger-screen behaviour |
|---|---|---|
| Navigation | Few clearly labelled destinations with safe-area clearance | Stable sidebar or expanded navigation using the same labels |
| Forms | Single clear column; controls remain visible above keyboard | Bounded reading width; related fields may share a row |
| Product and image choices | Legible tiles and generous touch targets | Denser grid only while preserving labels and selection clarity |
| Conversations | Thread and member details as separate views | Optional master-detail panes with correct focus handling |
| Data tables | Prioritized details or accessible local scrolling where necessary | Full comparison table; preserve column relationships |
| Dialogues and sheets | Accessible full-height or bottom-sheet treatment when suitable | Bounded modal or inline editing according to task |
| Safety action | Always reachable without obscuring forms or content | Equally visible; never hidden in hover-only menus |

No body-level horizontal scrolling on ordinary forms or reading pages. Avoid hover-only functionality, drag-only sorting and tiny icon-only controls. Product target for primary touch controls is at least 44 by 44 CSS pixels, preferably larger in guided view; this is stricter than the WCAG 2.2 AA 24-pixel target criterion with its spacing and exception rules. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### 14.4 Component inventory and consistency checks

Create or reuse accessible Button, IconButton, TextField, OTPInput, SelectableImageCard, ChoiceChip, DateInput, QuantityStepper, FilePicker, VoiceInput, Stepper, FormSummary, Dialog, Toast, InlineError, EmptyState, Skeleton, ProfileBadge, PermissionNotice and StatusTimeline primitives. A visual state matrix must cover default, hover where applicable, focus, selected, loading, disabled, invalid and success states.

Use one spacing scale, type scale, icon family and stroke convention; shared radii and elevation; standardized field heights, labels, help text and errors. Do not copy CSS per module, depend on arbitrary z-index values, use blanket important overrides or ship unreviewed global selectors. Encapsulate component styles and document intentional exceptions. Test long translations, error text, nested overlays, scroll lock and focus restoration. CSS linting and visual regression are release evidence, not a substitute for usability testing.

### 14.5 Accessibility and performance gates

Target WCAG 2.2 AA for the web experience. Test semantic structure, accessible names, keyboard operation, focus visibility and order, screen readers, announcements, contrast, text enlargement and reflow. Avoid redundant entry and inaccessible authentication challenges. Automated scans alone cannot establish conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Additional WomSakhi gates: verify VoiceOver and TalkBack flows where supported, reduced motion, large text, disabled animations, captions for speech, visual alternatives to audio and persistent errors rather than toast-only failures. Simple view cannot remove essential controls or safeguards. Audio consent is replayable but never automatically accepted.

Test a representative low-memory Android phone as well as recent devices; throttle network and CPU; check interrupted uploads and reconnects. Set measured per-route asset and JavaScript budgets after inspecting the existing stack. Lazy-load noncritical media, provide correctly sized responsive sources, reserve image dimensions, avoid autoplay video and keep basic actions independent of decorative downloads. Record device, network, route, latency and failures; do not call performance verified from a desktop screenshot.

## 15 All-age capabilities and safeguarding

### 15.1 Cohorts are UX groupings not legal definitions

The following bands help design content and interaction. Legal age thresholds, guardian consent, allowable work and sensitive-data rules must be established separately per jurisdiction and current commencement dates. A declared birthday alone is not a robust age-assurance system; select proportionate, privacy-preserving checks with specialists, without speculative face-based age or gender classification.

| Design cohort | Useful experiences | Product-default limits before specialist approval |
|---|---|---|
| Under 6 | Guardian-operated stories, simple learning, healthy routines and safety education | No independent social account, public profile, chat with strangers, commerce or employment |
| 6–12 | Guided learning, creative activities, confidence and digital-safety education in approved spaces | Closed moderated participation; no adult discovery, stranger DMs, public location, jobs, payouts or public selling |
| 13–17 | Study, skills, age-appropriate wellbeing education, reviewed youth mentoring, future-career exploration | Youth-specific spaces; required guardian processes; no adult marketplace seller powers, recruitment contact or unrestricted generative companion by default |
| 18–59 | Relevant adult capabilities according to consent and jurisdiction | Preferences and permissions, not stereotypes about marriage, motherhood or education |
| 60 and above | Full eligible adult access plus optional easier reading, voice, trusted assistance and wellness tools | No automatic loss of autonomy, forced simplified mode or family access |

All bands are in product scope. Cohorts may release in stages only as their protections are ready; do not advertise unsupported child functionality as already available. Adult features remain available to eligible adults irrespective of education or digital confidence.

### 15.2 Cross-module permission matrix

| Capability | Children | Teens | Adults |
|---|---|---|---|
| Learning | Curated child content and moderated cohorts | Age-reviewed learning, creative work and career education | General and specialist learning within policy |
| Circles | Approved closed spaces; explicit staff boundaries | Youth-only or specifically reviewed mixed-age programmes | Member-controlled adult circles |
| Direct messaging | No unsupervised stranger contact | No unsolicited adult contact; approved safeguarded channels only | Consent and block/report controls |
| Health | Reviewed education and carefully scoped family support | Age-appropriate information and privacy-aware help | Optional tracking and approved clinical routes |
| Shops and payments | No independent selling, borrowing or payout account | No adult commercial powers by default; future limited programmes require review | Eligible services and commerce with verification |
| Jobs | No recruitment or work marketplace | Career exploration only by default; lawful youth work requires a separate approved pathway | Verified jobs and permitted gig work |
| Location and travel | Off by default; any guardian function requires dedicated legal and safety approval | Off by default; no routine behavioural tracking | Explicit session consent and all travel gates |
| AI | Curated bounded activities, not open-ended relationship simulation | Age-reviewed assistance with escalation and no secrecy prompts | Scoped approved assistance |
| Advertising and profiling | No targeted ads or behavioural personalization | No targeted ads or behavioural personalization | Consent-based permitted personalization; sensitive-domain exclusions remain |

Age policy is enforced server-side for APIs, uploads, messaging, search, recommendations, exports, deep links and background jobs. An adult invite cannot promote a child into adult access. Use deterministic age-appropriate content selection and member preferences, not covert profiling. Uncertain age gets the conservative experience and a review route.

### 15.3 Guardian role and autonomy

Provide a separate guardian portal for a verified mother, father or other authorized guardian. Verify the relationship through an approved process; an OTP on a phone is not evidence of legal guardianship. Explain in the child's language what a guardian can see. Account management does not automatically include private journals, reproductive data, exact whereabouts or every conversation. Define sensitive-data access with clinical, safeguarding and legal review.

Support multiple children without cross-child data leakage, permitted co-guardians, disputed guardianship, revocation and recovery. A suspected abusive guardian or a child's request for help requires a specialist safeguarding route, not an automatic notification to the alleged abuser. Do not promise confidentiality that mandatory duties prevent; give age-appropriate explanations.

Reassess permissions when a cohort threshold changes. At adulthood, obtain the member's own choices and end guardian privileges unless explicitly reauthorized; do not publish a profile or enroll her in adult circles automatically. Assistance for older adults is separately invited, scoped, auditable and revocable.

### 15.4 Content operations and legal readiness

Appoint a safeguarding owner; review age-appropriate content, moderator training, incident escalation, professional conduct and reporting obligations before opening child accounts. Provide easily understood Help and Report controls. Child content must not include manipulative streaks, shame, sexualized imagery, body-rating tools, persuasive purchasing or pressure to keep secrets. Youth peer support is moderated and is not a replacement for professional care.

The UK ICO Children's Code is a useful design benchmark for high-privacy defaults, data minimization, child interests and visible parental controls; it is not a universal legal permission to launch. [ICO age-appropriate design code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/)

For India, the official [MeitY DPDP Rules 2025 entry](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa) was identified, but the operative text was not exposed through this browsing route. Counsel must verify the current Act, rules, phased commencement, exemptions, child consent, tracking and advertising restrictions and sector-specific duties before launch. No legal compliance certification is claimed here. Repeat the assessment for each new country rather than extrapolating one country's thresholds.

## 16 Visual asset production and integration

### 16.1 Required deliverables during implementation

Codex is expected to identify, source or generate, validate and integrate the visual assets required by the selected implementation slice. Merely leaving prompts, remote broken URLs or generic placeholders is not a completed visual deliverable. This requirement does not grant missing tool access, paid API budget, copyright rights or permission to upload sensitive member data to a generation service.

Before designing a screen, list its required illustrations, covers, selectable category images, icons, empty-state imagery and contextual photos. Reuse approved assets first. Use a supported image-generation tool when available and authorized for new raster illustrations; use consistent vector icons and real UI components for exact controls. Never replace an interactive screen with a generated screenshot. Real product photographs must not be substituted with invented goods without clear seller approval and honest disclosure.

If generation is unavailable, inspect permitted alternatives, reuse approved assets and record precisely which assets are blocked, with dimensions, prompts and reference requirements. Do not mark the visual slice complete; do not claim a tool ran. Ask only for the missing capability or decision and continue unrelated safe work.

### 16.2 Asset manifest

Maintain a versioned manifest with asset ID, use-case ID, screen ID, intended role, source/reference, generation prompt or licence, status, local file path, dimensions, aspect ratio, theme variants, crop/focal point, alpha requirement, optimized sizes, language-free artwork requirement, alt text/decorative status and approval. Suggested status sequence: planned → sourced/generated → inspected → approved → integrated → verified; blocked is explicit.

Show diverse ages, skin tones, abilities and everyday contexts respectfully, without infantilizing older women or stereotyping rural members. Child imagery must be age-appropriate. Prefer a coherent illustration direction rather than unrelated stock styles across modules. Maintain light direction, detail level, perspective and palette compatibility for related sets. Logo assets stay exact; preserve their faces, leaf forms and colours when supplied.

Verify crop and safe areas at actual mobile size; optimize formats and file weights; include fallback rendering and intrinsic dimensions. Alt text explains meaning, not decoration. Avoid baked-in labels and tiny details that make image choices unrecognizable. Test actual comprehension of pictograms with intended users.

Screen preview exports retain the established convention `Screen [number]. [Screen Name].png` when screen numbers are assigned. Production asset filenames can use stable ASCII slugs and a mapping manifest. Do not silently renumber existing screens. Generated visual previews, actual reusable assets and screenshot QA are distinct deliverables and must not be confused.

## 17 Codex implementation contract for VS Code

### 17.1 Scope and honest capability checks

This catalogue is the product specification supplied to Codex; it is not an automatic execution engine or a guarantee of a production-ready app from one prompt. Repository access, configured tools, model capabilities, credentials, tests, reference assets and explicit authorization determine what can actually be completed. Official documentation explains project instructions through [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills) and separate [image-generation capabilities](https://developers.openai.com/api/docs/guides/image-generation). Do not assume those capabilities are enabled in a particular VS Code session.

When authorized to implement a slice, Codex must inspect existing architecture, applicable AGENTS.md files, package scripts, feature flags, approved brand files, local assets and current tests before changing code. Preserve unrelated work. Treat all catalogue API names as proposed until mapped to actual code. Document current coverage and gaps rather than starting a parallel app or restyling the entire repository without scope.

### 17.2 Required implementation sequence

1. Read this complete catalogue in manageable sections and resolve the selected use-case IDs, age/language policies and gates. Record unresolved product decisions; do not fabricate answers to legal or safety questions.
2. Audit the current slice's UX, component library, tokens, backend/data contracts and assets. Build a traceability checklist covering use case → screen/state → component → API/permission → asset → test.
3. Reuse the approved design system. Establish missing shared primitives first, with semantic tokens and local-language layouts. Prepare representative narrow/wide layouts and all required states before polishing happy paths alone.
4. Implement image-led low-typing flows, accessible alternatives, form persistence and visible review. Design missing screens and contextual assets in the approved style; maintain the manifest in section 16.
5. Implement real domain behaviour and server permissions, including age policy. Keep unavailable integrations honestly disabled or sandboxed. Production screens must not silently use fixture balances, fake safety status, invented professionals or dummy payment success.
6. Test business logic, authorization, concurrency, failures, accessibility, localization, responsive layouts and assets. Run the app, inspect screenshots at representative sizes and fix visual defects. If a tool or device test cannot be run, record it as unverified, not passed.
7. Review against acceptance gates, supply evidence and summarize changed files, commands, test results, known gaps and remaining decisions. Do not deploy, migrate live data, message users, buy services or change paid-provider configuration without the necessary scope and approval.
8. Update implementation status and traceability, not the product requirements merely to match unfinished code. Work in reviewable slices; do not attempt every registry item in a single uncontrolled change.

### 17.3 Durable repository handoff

Recommended future repository path: `docs/product/WomSakhi_Expanded_Product_Catalogue_V2.md`. This is a suggested placement, not a file already installed in the user's repository. Keep a short pointer in an existing AGENTS.md when the user authorizes that edit; do not replace existing repository instructions or paste the entire catalogue into every prompt. Keep approved design tokens, asset manifest, decision log and implementation tracker beside their existing equivalents.

Suggested task text to use with the catalogue:

> Read the WomSakhi catalogue, including revision 2.3 sections 13–24, and the repository's applicable instructions. Preserve the full catalogue; audit the repository and implement the founder-selected web scope in dependency-complete slices. Native mobile and platform monetization are deferred. Treat responsive layouts, picture-led editable templates, low-typing forms, gentle opt-in mood interactions, supported languages, age-based access, shared CSS/design tokens, required assets and all error states as acceptance requirements. Use available authorized image-generation tooling for missing raster assets; disclose unavailable tools and mark blocked assets honestly. Build the shared Reminder and Notification Engines with deterministic consent, fatigue, cancellation and safety rules; AI may propose timing and content only within those rules. Implement provider adapters only from checked documentation and approved content rights; never invent credentials, nearby members, legal provisions or scripture quotations. Do not promise continuous web background tracking. Do not relax child-safety, clinical, payment or privacy gates. Run applicable tests and visually inspect the implementation. Report evidence, gaps and the next safe slice. Do not deploy or perform live external actions without authorization.

### 17.4 Definition of done

A slice is complete only when its approved business outcome works; permissions and age gates pass; easy-view and supported-language flows work; responsive screenshots have been inspected; applicable accessibility tests pass; shared tokens/components are used; required visuals are integrated and verified; privacy/failure paths are covered; real integrations or declared disabled states are truthful; and unresolved gates are clearly identified. A polished screenshot alone, an asset prompt alone or passing type checks alone is insufficient.

## 18 Additional UX and age use cases

These 48 rows extend the catalogue without renumbering the earlier 372 entries. U denotes the new founder requirements; implementation controls labelled P are proposed details. F means required when the affected experience launches; child releases retain the G safeguarding gate.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| UX-UC-001 | Choose pictured intent with localized label and optional audio; arrive at the correct module | U | F |
| UX-UC-002 | Create a circle from image choices and editable suggestions without mandatory free text for the default path | U | L |
| UX-UC-003 | Create a shop using category pictures, guided choices and progressive required fields | U | L |
| UX-UC-004 | Edit a prefilled form, review changes and resume safely after interruption | U | F |
| UX-UC-005 | Delete an exact record with accessible consequence review and undo where possible | U | F |
| UX-UC-006 | Switch Simple view or More options without losing state, permissions or important information | P | F |
| UX-UC-007 | Navigate by Buy, Sell, Learn, Groups or Help with stable cross-module labels | U | F |
| UX-UC-008 | Complete core flows across validated narrow, wide, zoomed and keyboard-visible layouts | U | F |
| UX-UC-009 | Use keyboard, screen reader or non-drag alternative for all core interactions | P | F |
| UX-UC-010 | Complete cohort-based usability tasks; record unassisted success, errors and time rather than claiming quality by appearance | P | F |
| DESIGN-UC-001 | Resolve approved brand assets and establish one versioned semantic token source | U | F |
| DESIGN-UC-002 | Reuse component states across modules; detect divergent spacing, typography and field styling | U | F |
| DESIGN-UC-003 | Validate contrast and non-colour status cues across supported themes and states | P | F |
| DESIGN-UC-004 | Resize script-aware typography without clipped controls or critical content | U | F |
| DESIGN-UC-005 | Audit responsive layouts and eliminate unintended page overflow and obstructed actions | U | F |
| DESIGN-UC-006 | Honour reduced motion and accessible input preferences across shared components | P | F |
| DESIGN-UC-007 | Run CSS lint and visual regression checks; record approved exceptions instead of accumulating overrides | U | F |
| DESIGN-UC-008 | Test low-bandwidth and low-memory scenarios against measured route budgets | P | F |
| ASSET-UC-001 | Map each required visual to use-case and screen IDs before implementation | U | F |
| ASSET-UC-002 | Reuse exact approved logo artwork without changing faces, leaves or colours | U | F |
| ASSET-UC-003 | Generate missing raster visuals through available authorized tooling in a coherent approved style | U | F when needed |
| ASSET-UC-004 | Review age suitability, representation, factual honesty, source rights and provenance | P | F |
| ASSET-UC-005 | Optimize responsive variants, crop, fallback, dimensions and accessible alternatives | U | F |
| ASSET-UC-006 | Integrate actual assets into running screens and inspect at mobile and desktop sizes | U | F |
| ASSET-UC-007 | Record unavailable generation as a blocker with exact requirements; never claim placeholder prompts are finished imagery | P | F |
| ASSET-UC-008 | Export approved screen previews with stable numbered names and map production asset files separately | U | F when exported |
| AGE-UC-001 | Determine a permitted cohort using approved age assurance with minimal retained data | U | F; G child release |
| AGE-UC-002 | Establish a verified guardian relationship through a separate limited-access role | U | F; G child release |
| AGE-UC-003 | Present child-readable and guardian-readable notices and record required consent and assent separately | P | F; G child release |
| AGE-UC-004 | Offer guardian-operated co-use for very young children without adult social permissions | U | G |
| AGE-UC-005 | Route a child to reviewed learning and closed moderated activities | U | G |
| AGE-UC-006 | Route a teen to youth skills, age-appropriate wellbeing and approved mentoring | U | G |
| AGE-UC-007 | Deny adult jobs, seller powers, payouts and unsolicited adult contact in minor APIs as well as UI | P | F; G child release |
| AGE-UC-008 | Enforce guardian scopes across health, messages, location and exports; explain what is visible | P | F; G child release |
| AGE-UC-009 | Handle disputed or abusive guardians through a safeguarded review route without notifying the alleged abuser automatically | P | F; G child release |
| AGE-UC-010 | Transition cohorts without silently publishing profiles or retaining expired guardian privileges | P | F; G child release |
| AGE-UC-011 | Offer larger text and guided actions to any adult, not only by age classification | U | F |
| AGE-UC-012 | Invite and revoke a scoped trusted helper for an adult while preserving the member's autonomy | P | N |
| AGE-UC-013 | Filter age-appropriate content without targeted ads, behavioural profiling or coercive engagement for minors | P | F; G child release |
| AGE-UC-014 | Recheck cohort and region eligibility on deep links, invitations and queued actions; unknown age never unlocks adult powers | P | F |
| LANG-UC-001 | Select language using self-language names and optional audio before complex onboarding | U | F |
| LANG-UC-002 | Hear and replay localized instructions without automatic disclosure of sensitive content | U | F |
| LANG-UC-003 | Use labels and images together with a non-audio accessible alternative | U | F |
| LANG-UC-004 | Enter optional speech, inspect or hear the transcript and correct it before saving | U | N |
| LANG-UC-005 | Change language midway through a form without losing entered values or consent history | U | F |
| LANG-UC-006 | Render supported scripts, text direction, dates, currency and long translations correctly | P | F |
| LANG-UC-007 | Review high-stakes translations with qualified native-language reviewers before release | P | F |
| LANG-UC-008 | Support first-time and shared-phone members without equating education, location or English proficiency with ability | U | F |

### S19 Age routing and guardian onboarding

IDs: AUTH-UC-018; AGE-UC-001–010, 013–014. Actors: girl, verified guardian, safeguarding reviewer. Trigger: registration or cohort change. Preconditions: supported cohort/region and child-service release gate approved.

Flow: choose language and optional audio; determine cohort with the approved process; show the correct notice; establish required guardian relationship; collect consent and age-appropriate assent; explain visible information; provision minimum permissions; land in a reviewed child or teen home. Very young children use the separate co-use mode. Failed guardian verification never drops the user into an adult account.

Records: AgeAssuranceResult with minimized evidence, RegionPolicyVersion, GuardianRelationship, ConsentReceipt, CapabilityGrant, SafeguardingCase. Contracts: resolve cohort policy; verify guardian; accept consent; grant/revoke scoped access; reevaluate transition. Notifications are privacy-aware and suppressed from an alleged abusive guardian pending safeguarding review where appropriate under the approved protocol.

QA: adult invitation cannot override a child restriction; changing a profile birthday does not immediately unlock commerce; expired guardian access fails on exports; siblings cannot read one another's records; a father sees only the guardian portal; adulthood transition requires fresh choices; denied or withdrawn consent stops prohibited processing and queued actions; unsupported jurisdiction shows a truthful limited state.

### S20 Picture-led circle creation in a local language

IDs: UX-UC-001–002, 004, 006–009; LANG-UC-001–005; CIRCLE-UC-001–010. Actor: eligible member with little typing confidence. Trigger: Create group. Preconditions: group-creation capability permitted for her cohort.

Flow: display a few meaningful purpose cards with pictures, translated labels and optional audio; select purpose; choose an editable suggested name and cover; select permitted privacy using a plain example; preview; confirm; invite later. Persist choices during Back, language switch and interruption. A custom name can be typed or spoken, but a suggested-name path must not force typing.

Records: DraftCircle, CoverAssetReference, LocalePreference, CirclePrivacy and RolePolicy. Contracts: fetch permitted templates and covers; validate draft; create circle idempotently. AI suggestions are marked and cannot select public visibility on behalf of a member. A cover gallery does not open unrestricted external image search for children.

QA: duplicate create produces one group; picture failure leaves a usable labelled choice; audio is replayable and optional; screen reader identifies selected state; names do not clip in long scripts; private is the conservative default; age-forbidden templates are absent and rejected by API; offline draft is labelled unsynced; quick confirmation does not skip privacy review.

### S21 Screen and asset completion by Codex

IDs: DESIGN-UC-001–008; ASSET-UC-001–008. Actor: implementation agent and human reviewer. Trigger: authorized implementation of a screen or journey. Preconditions: repository, task scope and relevant reference assets accessible; generation tool availability checked.

Flow: map approved use cases to screen states; inspect existing design system; identify asset gaps; source or generate authorized assets; validate imagery; implement semantic-token components and responsive variants; integrate files; run tests and inspect actual screenshots; update evidence and asset status. Fix low-resolution crops, missing labels, inconsistent icons and broken paths before marking complete.

Records: implementation checklist, design decision, asset manifest and test evidence—not new end-user personal data. If references or tools are missing, report the specific block and continue unrelated work without inventing assets or claiming completion. No production member data is uploaded to an external image service as a convenience.

QA: every required asset path exists; logo remains the approved original; raster assets have responsive sizing and fallbacks; localized UI text is not baked into art; layout works with enlarged text; appropriate screenshot sizes are inspected; failed or unrun tests are explicitly listed; fixture-only states are not presented as real operational functionality.

### Revision 2.1 validation summary

420 unique registry IDs: 262 preserved original entries, 110 additions from revision 2.0 and 48 new UX, design, asset, language and age entries. There are 21 detailed scenarios. All-age scope supersedes the earlier adult-only recommendation. Child cohorts remain subject to explicit safeguarding and regional release gates, not a promise of unrestricted adult capabilities. No application code, production imagery or live service has been created by this document update.

## 19 Ready-made visual templates and considerate mood interactions

These requirements refine the existing low-typing and wellbeing journeys. Build on the shared components, consent system and notification scheduler; do not create duplicate form engines or a separate mood database. The defaults below are product proposals for pilot validation, not claims of clinical efficacy.

### 19.1 Select a ready-made starting point

Shop, service and product creation should feel like selecting and adapting a useful example rather than completing a blank form. Start with localized picture cards, for example Tailoring, Handmade jewellery, Tutoring, Home baking or Art and crafts. Show only categories permitted for the member's age, region and seller policy; example categories are not automatic permission to sell regulated goods or services.

Each template includes an example image, localized name, short explanation, suggested categories, optional cover, applicable field schema and editable draft content. Allow a Blank/custom option. Changing a name alone may be enough to save an initial shop draft; publishing still requires accurate owner, price, availability, fulfilment and other mandatory information. Never prefill real stock, licences, qualifications, ingredients, bank details, ratings or consent with invented values.

| Form | Prefer selection over typing | Member must review |
|---|---|---|
| Shop | Business-type card, shop style, cover, suggested editable name, delivery/pickup choices | Ownership, final name, service area and publication readiness |
| Service | Service template, duration chips, available days, time slots, location mode and package options | Scope, actual price, availability, qualifications where required and cancellation terms |
| Product | Category photo card, own photo, colour/size chips, units and quantity steppers | Actual product identity, images, price, stock, variants and factual claims |
| General forms | Prior confirmed values, radio/image cards, date picker, selectable examples, optional voice | Changed values, required declarations and consequential actions |

Provide keyboard and screen-reader equivalents for every visual selection. A missing image must leave a usable labelled choice. Display a small number of relevant options first, with Browse all or search when needed. Do not force a user through dozens of images to answer a simple question. Keep suggested names editable by text or optional voice; explain suggested content clearly.

Template artwork is a category illustration or draft cover, not evidence of an actual product. Mark sample product images as examples; require an accurate image or a truthful supported no-photo presentation before publishing a real product. Do not copy another seller's brand, listing or reviews. Store template version and distinguish untouched defaults from user-confirmed values.

### 19.2 Predictable navigation and corrections

| Control | Required behaviour |
|---|---|
| Back | Return to the previous step with selections and edits intact |
| Edit | Open the relevant field or step from the preview without restarting the form |
| Change template | Preview affected fields; preserve confirmed edits or obtain explicit reset permission |
| Cancel/Close | For meaningful unsaved work, offer Continue editing, Save draft or Discard; leaving an untouched form needs no unnecessary prompt |
| Save draft | Store incomplete work privately; distinguish Saved from Waiting to sync |
| Undo | Revert the last supported change without silently undoing unrelated edits |
| Preview | Show the final member-facing result and any missing publication requirements |
| Publish/Confirm | Validate current permissions and required facts, then perform the operation once |

Never erase edits merely because a member changes language, switches a template, presses Back or loses connection. Explicit discard removes the draft and prevents a queued autosave from restoring it. Use record versions to handle concurrent devices. Do not call an unsynced draft safely saved to the account. Avoid unnecessary confirmations for reversible selections; preserve deliberate confirmation for publication, money, sharing and deletion.

### 19.3 Mood selected by the member

Offer simple illustrated choices with localized labels: Happy, Calm, Tired, Stressed, Sad, Not sure and Skip. These are optional self-reports, not diagnoses. Let the member choose what would help: A kind message, Something calming, A small activity, Talk to someone or Quiet for now. Do not infer her mood from her face, voice tone, period phase, age, inactivity or a failed purchase.

Respond with one short, reviewed and culturally appropriate encouragement or activity, then optional quick replies. Example original encouragement: “One small step is enough for today.” Avoid fake quotations or invented author attribution. Do not tell someone to simply be positive or claim the app understands her better than real people.

| Member selection | Example response or option | Quick replies |
|---|---|---|
| Happy | Offer a small celebration or an optional gratitude prompt | Save this moment / Nice, thanks / No thanks |
| Tired | Offer a brief pause or a quiet experience | Gentle activity / Quiet for now / Skip |
| Stressed | Offer a short approved calming activity or human support | Try it / Talk to someone / Not now |
| Sad | Offer a gentle message and the option to reach support | Kind message / Talk to someone / Skip |
| Not sure | Offer choices without assigning a mood | Calm activity / Just browsing / Skip |
| Quiet for now | Acknowledge the preference without asking another question | Optional preference settings only |

After an activity, ask at most one optional follow-up within that session: Helpful, Not helpful, Something else or Stop for now. A reply may change the next care card, tone or optional reminder timing; it must not silently change saved work, medication, safety deadlines, eligibility, prices, jobs or product recommendations. Do not use mood to sell products, target ads or pressure engagement.

Mood features work independently of period tracking and are subject to the age and clinical boundaries already specified. For child cohorts, use reviewed age-appropriate activities and approved consent settings; no covert profiling, dependency-building messages or automatic disclosure to a guardian. Serious distress routes to approved support rather than more quotes; a sad selection alone is not an emergency and does not trigger contact alerts.

### 19.4 Messages without notification fatigue

Default to an in-app response when the member actively checks in. Proactive mood notifications require separate opt-in and a chosen channel/time; enabling push for orders is not consent to mood messages. Offer In app only, Occasional encouragement, My chosen schedule and Off. Keep health detail out of lock-screen text by default; use a neutral invitation such as “A little encouragement, if you’d like it.”

Proposed conservative pilot defaults after opt-in:

- No more than one unsolicited wellbeing prompt per local calendar day across Cycle and Health combined. Member-requested interactions do not count toward this limit. A user may choose fewer or disable them.
- Respect quiet hours, timezone changes, notification availability and the global attention budget. Do not stack the same quote through push, email and in-app popups.
- Treat a self-reported mood as current only for its session by default. Do not label her sad days later; if a schedule needs context later, offer a neutral optional check-in. Any longer personalization window must be explicit and revocable.
- Not now ends the current prompt and suppresses further unsolicited wellbeing prompts for the rest of that local day. Quiet for now offers a duration choice; a simple default is the rest of the day. Off cancels all queued optional mood messages immediately.
- Two consecutive unanswered proactive wellbeing prompts pause that series until the member actively re-enables it or requests another reminder. Silence means no answer, not a worsening mood.
- Helpful or Not helpful changes only permitted future suggestions; it does not create a chain of follow-up notifications. Stop ends the current interaction immediately.
- Do not place optional mood popups over checkout, form review, driving/travel interaction or a safety incident. A mood snooze does not cancel a separately consented active safety session; explain that distinction clearly.
- Notification opens are not the main success metric. Measure perceived helpfulness, opt-outs, unwanted-message reports and whether members can control the experience.

The scheduler must recheck consent, suppression and current session state immediately before dispatch. Delayed or retried messages expire when no longer appropriate. Never catch up a queue of old mood quotes after a long offline period. Store minimal consent, preference and response metadata; keep raw mood content out of general engagement analytics.

### 19.5 New use case entries

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| UX-UC-011 | Select a pictured shop template, adapt its editable name and choices, and save a private draft with minimal typing | U | L |
| UX-UC-012 | Create a service or product from permitted templates and selectable fields while confirming factual details | U | L when enabled |
| UX-UC-013 | Back, Edit, Cancel, Save draft, Discard and Undo preserve or remove exactly the intended work | U | F |
| UX-UC-014 | Change template without losing confirmed edits; review resets, sample imagery and publication readiness | P | F when templates enabled |
| CYCLE-UC-034 | Choose a mood and preferred support style through optional labelled visual selections | U | L |
| CYCLE-UC-035 | Receive a brief reviewed encouragement with quick replies that steer only permitted next suggestions | U | L |
| CYCLE-UC-036 | Control message channel, schedule, quiet periods and stop preferences; queued prompts honour changes | U | F when mood prompts enabled |
| CYCLE-UC-037 | Suppress repetitive, ignored or stale prompts; do not infer distress or emergency from silence | P | F when mood prompts enabled |

### S22 Create from a visual template and revise safely

IDs: UX-UC-011–014; EARN-UC-001–011. Actors: permitted seller or authorized shop operator. Trigger: Create shop, Add product or Add service. Preconditions: category and role are permitted; templates and sample media reviewed.

Flow: select illustrated template; choose suggested name and relevant options; confirm necessary facts; preview; edit any field or go Back; save draft or publish when ready. Switching templates shows changed defaults and preserves confirmed values. Cancel presents only relevant save/discard choices. No template selection creates a public listing by itself.

Records: TemplateVersion, FormDraft, FieldProvenance, UserConfirmedFields, Preview and PublishResult. Contracts: list permitted templates; instantiate draft; preview template switch; patch draft with expected version; discard draft; validate/publish idempotently. Notifications: save status is inline; no promotional messages or invitations are sent automatically.

Acceptance: the template-first shop draft can be created without mandatory custom prose; suggested names remain editable; Back retains values; Discard cannot be undone by late autosave; changing language preserves work; an unavailable photo leaves a labelled card; switching template does not overwrite edited price or description silently; publication rejects invented or missing mandatory values; a duplicate publish request creates one record.

### S23 Considerate mood response and opt-in follow-up

IDs: CYCLE-UC-034–037; DAY-UC-007; AI-UC-003. Actor: eligible member. Trigger: voluntary mood selection or an opted-in scheduled neutral check-in. Preconditions: supported cohort, consent and reviewed localized content.

Flow: member chooses a mood and support preference; app offers one relevant short message or activity; member taps Helpful, Something else, Not now or Stop; app records the chosen preference; next suggestions reflect only that permitted feedback. Proactive delivery occurs only within the explicit schedule and fatigue rules. If consent is absent, do not send a push to ask why.

Records: MemberMoodEvent, SupportPreference, PromptConsent, NotificationBudget, SuppressionUntil, PromptAttempt, ReviewedContentVersion and OptionalFeedback. Contracts: save check-in; select reviewed content; update prompt preference; cancel queued prompts; record quick reply. Recheck suppression at send time and make duplicate deliveries idempotent. Use an approved static content fallback if AI is unavailable.

Acceptance: no opt-in means no proactive mood push; app still works when mood is skipped; quiet hours block delivery; Not now stops that day's unsolicited wellbeing prompts; Off cancels queued work; two unanswered prompts pause the series; old mood is not presented as current; no sad-label notification appears on the lock screen by default; repeated taps do not create duplicate messages; serious distress follows the existing reviewed support route; controls work through selection without required typing.

### Revision 2.2 validation summary

428 unique registry IDs and 23 detailed scenarios. Eight new entries clarify template-driven creation and considerate mood interaction. Previous revisions and IDs are preserved for traceability. These are specification updates only; application behaviour, templates and notifications have not been deployed by this document edit.

## 20 Web-first everyday companionship and trusted journeys

### 20.1 Product direction

The full vision remains in this catalogue. The founder will decide first-version scope after reviewing it; phase labels remain proposals. Develop responsive web experiences for desktop, tablet and mobile browsers now. Native Android/iOS development is later. A PWA may improve installation and offline access but must not be used to imply native background-location capabilities. No current Pro, subscription or revenue-model design is required.

WomSakhi should feel like a warm, practical companion: easy to return to, easy to leave, and useful without lengthy forms. It must identify AI assistance honestly and encourage real human support. Avoid dependency language, guilt, streak-loss pressure or claims that the app is a person's only reliable friend.

### 20.2 Morning and on-open experience

Show a small optional picture-and-label mood card on the first relevant visit of the member's local day: Happy, Calm, Tired, Worried, Sad, Mixed, Prefer not to say. Let the member choose a different wake time for night shifts. Never block Help, shopping, messages or other tasks with a mood question. A member may turn the card off.

After a selection, offer one appropriate card: encouragement, an optional light joke, breathing, music/activity, a trusted friend, or practical support. Ask for preferred support with pictures and short labels. Humour must be requested or previously preferred, not forced on distress. The selected mood can change the featured card and gentle illustration; keep navigation, button meanings, contrast and layout stable. Do not make a sad user's entire interface dark or alarming.

Mood is self-reported, not fetched from GPS, face, voice or messages. Display its time and allow change/delete. A prior day's mood must not silently become today's fact. Optional retention for trends requires an explicit setting. Apply section 19's opt-in, daily cap, quiet hours, suppression and two-unanswered-prompt pause. Scripture is an optional content preference under section 21.4, not a default assumption.

### 20.3 Period duration check-in

If an enabled cycle record remains open after five days, offer an optional selection: Still bleeding, Ended, Date is wrong, Not sure, Skip. Do not automatically end it, diagnose a problem or send an emergency alert. NHS describes periods as commonly lasting 2–7 days, usually around five; more than five alone is not an abnormality rule. [NHS periods](https://www.nhs.uk/conditions/periods/).

If the member reports prolonged/heavy bleeding, pain or concern, route through clinician-reviewed questions and care information. Longer than seven days, frequent product changes and disruption to daily life are among indicators discussed by NHS; this catalogue does not implement a clinical scoring rule. Urgent symptoms must bypass entertainment and ordinary mentor queues. Comfort guidance must be reviewed; AI cannot invent remedies or dosing. [NHS heavy periods](https://www.nhs.uk/conditions/heavy-periods/).

### 20.4 My trusted travel group

Members choose a small trusted group for each journey: primary watcher, backup watchers and emergency contacts. A circle admin does not automatically receive anyone's travel location. Invited watchers accept their role and availability; the traveller sees Accepted, Waiting or Unavailable. A verified phone number establishes contactability, not trustworthiness. Contacts who are fathers or other men may receive restricted safety invitations without gaining women-member community access.

One low-typing setup offers destination or time-only journey, expected arrival, 15/30-minute or custom supported check-in, named recipients, approved fallback channel and a clear escalation preview. Reuse previously confirmed settings, but visibly confirm recipients and active sharing each time. Optional light conversation may accompany a voluntary stop/check-in; avoid distracting a traveller who is driving or crossing roads.

| State | Member experience | Required server behaviour |
|---|---|---|
| Draft | Choose route/time, interval and trusted people | No monitoring or alerts until explicit start |
| Active | See next deadline, location freshness and watcher acknowledgement | Persist deadlines and authorized recipients independently of the browser |
| Due | I'm okay, Need help, Extend, End trip | Record one response and advance the deadline only after server acknowledgement |
| Overdue | Show the agreed grace period and pending escalation | Execute the pre-agreed escalation; do not interpret silence as proof of harm |
| Escalated | Show who was notified and who acknowledged | Send factual overdue message and last-known timestamp; bounded retries/fallbacks |
| Closed/cancelled | Confirm sharing ended | Cancel future work; revoke session links; retain only policy-approved audit data |

An explicit Need help action bypasses the ordinary grace period according to the reviewed emergency policy. A missed routine check-in follows the policy the member agreed at start; urgent flows must not wait for an AI mood assessment. A watcher can acknowledge or call, but cannot mark the traveller safe merely by reading the alert. Show whether a professional operations team actually exists and its staffed hours; never claim someone is monitoring if nobody accepted.

Continuous fresh GPS cannot be guaranteed by a web app when a browser is hidden, suspended, closed or offline. Show last update time and accuracy; label stale location rather than drawing a moving marker. Use server timers for overdue detection; closing the tab must not cancel them. Web push availability is separate from background GPS. Test supported browsers, denied permissions, lost internet and device sleep before enabling a safety claim. [W3C Geolocation](https://www.w3.org/TR/geolocation/), [MDN background-page behaviour](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## 21 Nearby connection, occupations, rights and optional spiritual support

### 21.1 Nearby women and circles

Provide List and Map views with picture categories: Circles, Workshops, Meetups, Mentors, Services and Opportunities. Location may be a manually selected village/city, destination or permission-based current area. GPS permission is not required to browse a chosen place. Saved places must not expose home addresses.

Nearby counts mean eligible, opted-in WomSakhi listings or members in the selected area, not all women physically nearby. Do not invent activity in an empty region. Show coverage and freshness; offer online workshops, a larger area or Create a circle when there are no matches.

Default to circle/event area markers and privacy-preserving aggregate counts. Suppress small groups using a reviewed minimum threshold, limit repeated fine-grained queries and avoid exact individual distance, route, online status or precise home/work pins. No public discovery of children's locations or individual profiles through nearby search. Eligible adult companion discovery requires separate opt-in, expiring availability and mutual acceptance before private contact. Membership checks cannot guarantee that a stranger is safe.

For a meetup, support public venue, organizer identity, purpose, age eligibility, language, accessibility, capacity, waiting list, cancellations, co-host permissions, participant reporting and a clear safety contact. Do not imply organizer verification validates every participant. Private venue details are disclosed only to approved attendees when appropriate. Trusted travel watchers and nearby social discovery are separate permissions and records.

### 21.2 Occupation and life-role picture library

Use optional multi-select cards with short localized labels, audio labels and search: Farmer, Artisan, Tailor, Home cook, Shop owner, Street vendor, Domestic worker, Teacher, Student, Healthcare worker, Technology worker, Office worker, Caregiver, Homemaker, Mother, Military/service member, Veteran, Retired, Returning to work, Looking for work, Other and Skip. Roles can overlap and change. They must not determine a woman's worth, access to Help or presumed literacy.

| Selected goal | Picture-led shortcut | Required confirmation |
|---|---|---|
| Sell something | Choose food/crafts/clothing/product template | Actual product, price, stock, images and legal category requirements |
| Offer a service | Choose tailoring/tutoring/repair/care template | Skills, availability, service area, price and any required credentials |
| Find work | Choose occupation, location/remote, hours and experience cards | Candidate controls any profile or application disclosure |
| Teach or mentor | Choose topic, format, language and available slots | Qualifications where needed; general mentor is not a licensed adviser |
| Host an event | Choose workshop/meetup/legal clinic/learning circle | Organizer, date/time, venue, capacity and publication preview |

One selection can create an editable private draft; public publishing requires a preview and confirmation of factual details. AI must not invent stock, credentials, military affiliation, earnings, customer reviews or product photographs. Template illustrations remain labelled examples. Protect military postings, duty schedules and other sensitive occupations from unnecessary collection. Provide assisted onboarding with explicit owner approval and revocable operator access, as already specified for shops created for neighbours.

### 21.3 Rights library and legal mentorship

Create country packs, then state/province packs where needed. A constitution, statute, regulation, court judgment, government guidance and a mentor's explanation are distinct content types. No universal women-only API supplies all applicable law. Include rights topics through picture cards: Safety/violence, Workplace, Pay, Maternity, Marriage/family, Property/inheritance, Education, Online abuse, Housing, Disability, Migration and Legal aid. These are research categories, not claims that identical entitlements exist everywhere.

Ask Country/region, Topic and relevant non-sensitive choices before selecting information. Mood may change the explanation's tone, never which law is declared applicable. Faith preference must not select personal-law treatment automatically; where legally relevant, a qualified reviewer defines questions, jurisdiction and exceptions. Show source, section/article, effective date, reviewed date, language and whether the material is an explanation or official text. Do not fabricate section numbers or claim a legal outcome.

Legal programmes include plain-language rights workshops, moderated Q&A, private appointments, referral clinics and topic circles. Verify each legal adviser's credential, jurisdiction, scope and review expiry. Separate community educators from lawyers; a general mentor cannot provide regulated services merely by choosing a badge. Support conflict checks, privacy, appointment cancellation and professional complaint routes. Do not post case details publicly by default. Urgent help stays reachable without entering a narrative.

### 21.4 Scripture and faith preferences

Offer optional content choices: Bhagavad Gita/Sanatana learning, Bible, Quran, other approved traditions, general encouragement and None. Multiple choices are allowed. Ask privately; do not infer religion from name, clothing, language, location or circles. Let the member change or erase the preference. Do not disclose faith in profiles, jobs, shopping or lock-screen previews by default.

Select from a reviewed, licensed passage library mapped to voluntary themes such as hope, patience, gratitude and courage. Store exact edition, translator, chapter/verse, language, source and required attribution. Distinguish source text, transliteration, translation and a separately labelled explanation. Never present generated text as scripture. A generated translation is not a substitute for a verified licensed edition.

Respect context, denominational differences, age appropriateness and the member's choice. Do not use scripture to shame distress, demand obedience to abuse, discourage medical/legal help or push religious conversion. Spiritual encouragement supplements practical support; immediate-help pathways take precedence. Children receive only approved age-appropriate experiences under the applicable cohort policy. Original encouragement remains available if licensed content is unavailable, but the app must not silently substitute one religion's text for another.

## 22 API and content acquisition catalogue

This is a targeted provider shortlist, not an exhaustive survey of every world API. Public pages were checked on 20 September 2026. Prices, quotas, permitted uses and account flows can change. No reviewed hosted service is represented as guaranteed lifetime-free. Free access, open-source software, public-domain content and licensed redistribution are different permissions. A key alone does not grant bulk download, offline storage, embeddings, model training or commercial reuse rights.

### 22.1 Providers, account steps and restrictions

| Provider / source | Fit and access/cost evidence | Setup steps and launch limitation |
|---|---|---|
| [Geoapify](https://www.geoapify.com/pricing/) | Geocoding/maps/routing; free tier advertises 3,000 credits/day; paid API 10 is US$59/month for 10,000/day, excluding taxes. Credit cost varies by API. Commercial free-tier use requires attribution. | Sign up through My Projects; create a project/key; select APIs; configure key restrictions and usage monitoring. Review attribution and terms. Maps do not identify WomSakhi companions or certify safe routes. |
| [Public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) | Limited public geocoding, absolute maximum 1 request/second across the app; attribution and identifying client required. No autocomplete or systematic area harvesting. | No key-based paid plan on this public endpoint. Do not make it the generic production default. Use a suitable hosted supplier or properly operated self-hosted instance; self-hosting costs money and data obligations remain. Never send confidential location details. |
| [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Event/venue discovery; documented default 5,000 calls/day and 5 requests/second. Broad events, not comprehensive village workshops. Price and commercial reuse agreement require confirmation. | Register through developer portal; obtain API key; test country/location/category searches; review display/cache terms and actual coverage. Keep key server-side. Include source and booking link; never represent imported inventory as WomSakhi-hosted. |
| [Eventbrite developer docs](https://www.eventbrite.com/platform/docs/introduction) | Candidate for organizer integrations. Documentation fetch was rate-limited; current discovery scope, pricing and terms not verified. | Pending supplier validation: review current docs, obtain organizer authorization and confirm endpoints before committing. Do not assume a global public workshop feed or scrape listings. |
| [Adzuna developer portal](https://developer.adzuna.com/) | Job-ad search by keywords/location; API registration is offered. Exact quota, commercial price and country coverage were not verified. | Register for API access; obtain credentials shown by portal; confirm country support, attribution, application links, retention and costs. Test expiry/deduplication. Do not promise all occupations or local informal work are covered. |
| [India Code migration notice](https://www.indiacode.nic.in/) | Official notice points to [indiacode.gov.in](https://indiacode.gov.in/). The new site's contents could not be verified in this research session. Not a verified bulk API. | Editorial team verifies official statute and amendment sources, lawful reuse and current text; request an approved feed if needed. No invented API/key steps. Do not publish an unreviewed India pack based on this migration notice. |
| [Indian Kanoon pricing](https://api.indiankanoon.org/pricing/) and [API documentation](https://api.indiankanoon.org/documentation/) | Prepaid legal search/document API. Listed INR/request: search 0.50; original document 0.50; document 0.20; fragment 0.05; metadata 0.02. Signup test credit ₹500; conditional noncommercial allowance needs provider verification. | Register for API service, generate a token, prepay when required, call HTTPS with token authorization from server. Confirm storage/reuse rights. Use judgments for research with official-source verification; they are not a complete current statute or personalised-advice engine. |
| [GovInfo developer hub](https://www.govinfo.gov/developers) | US federal public-information API, bulk repository and feeds linked by official developer hub. Does not cover every state or local law. | Follow hub's API documentation to obtain required access credentials and current limits; select collections and check reuse notices. Exact current pricing/key issuance not verified here; do not promise unrestricted hosting or universal legal coverage. |
| [CourtListener / Free Law Project](https://wiki.free.law/c/courtlistener/help/api) | US legal research; REST and bulk options. Current page says API access through memberships/commercial agreements; do not label unlimited-free. | Contact/join through provider links; confirm coverage, plan, agreement and credentials; assess permitted storage. Exact price requires provider confirmation. Not a replacement for jurisdiction-specific official legislation. |
| [Quran Foundation developer docs](https://api-docs.quran.foundation/) | Chapters, verses, translations and related content. Server application credentials and scopes; no end-user Quran.com login required for content API. Price/SLA and content reuse must be confirmed. | Create developer-console application; choose backend/server type; securely save secret; request scopes, test pre-live access, obtain production approval. Each translation/audio needs rights review; API permission is not automatically bulk-republication permission. |
| [Tanzil text licence](https://tanzil.net/docs/Text_License) | Quran Arabic text available for verbatim distribution with its specified attribution, link and copyright notice; page identifies CC BY 3.0 and prohibits changing text. | Download permitted text, preserve notices and source, checksum and monitor updates. No hosted key needed for local import. Translation/audio permissions are separate. Do not edit canonical text during normalization or generation. |
| [API.Bible](https://api.bible/) | Starter $0/month: 5,000 calls, selected version limits, noncommercial restrictions. Pro listed from $29/month with 150,000 calls; commercial translation licences may add fees from $10/month/translation. Availability differs by edition. | Register, choose eligible plan/versions, obtain dashboard API key and configure backend. Obtain applicable translation permissions and caching rights. WomSakhi's commerce features may affect noncommercial eligibility even before platform subscriptions exist. |
| [World English Bible](https://ebible.org/eng-web/) | Public-domain English edition and downloadable formats; suitable candidate for permitted local hosting. Infrastructure still has costs. | Choose exact edition/download, retain provenance, checksum and verse references; no API key for the download route. Validate public-domain notice for selected files; do not assume other translations or recordings have the same status. |
| [Bhagavad Gita source site](https://bhagavadgita.com/) and its linked [RapidAPI listing](https://rapidapi.com/bhagavad-gita-bhagavad-gita-default/api/bhagavad-gita3) | Provider site links to API listing. Listing prices, quotas, translation and bulk-storage permissions could not be verified. Do not label lifetime-free or all content open-source. | Follow official API link, create marketplace account, inspect current plan and terms, obtain key only after accepting suitable rights/costs. Request permission per translation/commentary. Alternative: editorially source a demonstrably permitted edition for local hosting. |

Account creation, purchasing, credentials and dataset imports have not been performed by this document update. Account steps marked unverified are a procurement checklist, not a tested integration recipe. Recheck provider terms immediately before implementation. Never paste keys into this catalogue, screenshots or source control.

### 22.2 WomSakhi-owned and partner data

The primary source for nearby women, trusted friends, private circles and genuine local workshops must be WomSakhi's consented records and authorized partners. External event APIs supplement coverage. Offer low-typing organizer creation, CSV import for authorized partners, reviewed NGO/college/self-help-group submissions, and source-linked manual curation. Imports must retain permission and organizer identity; publication is reviewed and stale/cancelled entries expire.

Local jobs, women's benefits, legal-aid contacts and informal occupations need regional partners and editorial stewardship where feeds are absent. Do not fill empty markets with synthetic people, workshops, jobs or reviews. A country pack can explicitly say Not yet covered and provide reviewed official links.

### 22.3 Curated database, not uncontrolled model training

Build a retrieval-backed content service. Ingestion means storing/indexing permitted material for cited retrieval, not automatically training a model. Training rights require a separate decision and agreement. Raw law or scripture should not be placed into a model and treated as authoritative memory.

| Record | Required fields |
|---|---|
| Provider | Source, owner, access method, terms URL/version, rights scope, quota, cost, secret reference, contact, last verification |
| Content version | Stable ID, source URL/ID, original language, permitted file/checksum, licence, attribution, imported time, review status, superseded version |
| Legal provision | Country, subdivision, instrument type/title, section/article, effective interval, amendment/repeal links, official source, reviewer, next review |
| Scripture passage | Tradition, work, edition, translator, chapter/verse, canonical exact text, language, permitted theme tags, explanation separate, reviewer |
| Event/job | Source ID, organizer/employer, permission, locality, timezone, dates/expiry, eligibility, source URL, last checked, cancellation status |
| Recommendation | Content version, explicit user preferences used, policy version, reason label, consent scope, feedback; no unnecessary sensitive payload |

Pipeline: approved source → rights check → permitted fetch → quarantine/validation → human review where required → versioned publication → retrieval → source-linked presentation → update/withdrawal. Reject missing jurisdiction, unknown edition, broken provenance, expired rights and unreviewed generated passages. Keep legal summaries distinct from official texts; label unofficial translations.

Use adapters, bounded retries, backoff, quota accounting, circuit breakers and dead-letter review. Honour source-specific cache/retention limits, deletion and attribution. Treat imported HTML and documents as untrusted input, including prompt injection. Never execute instructions embedded in retrieved content. Provider outages should yield approved cached content only where allowed, or a clear unavailable state.

### 22.4 Production content and standards gates

Each enabled country/language/topic must have a coverage matrix, approved sources, effective-date review, licensed translations, support ownership, reporting/correction route and outage fallback. Recheck legal updates through approved sources; quarantine uncertain changes until review. Do not claim every country's laws are covered at launch. Country privacy, child-consent, location, electronic-message, commerce and professional-service obligations require local review of actual launch operations; a generic global compliance badge is insufficient.

Accessibility target: WCAG 2.2 AA, with keyboard/screen-reader and low-literacy usability checks in each launch language. Pictures supplement labels and optional audio; colour is never the sole meaning. Existing section 14 remains the visual contract. [W3C WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/).

Before activating a supplier: approve rights → create organization-owned account → choose permitted plan → store restricted credentials → implement sandbox adapter → validate real coverage → approve costs/alerts → verify failure behaviour → enable only the supported scope. Free-tier exhaustion must not silently disable active travel escalation. Keep at least one reviewed non-AI path for essential help.

## 23 New use cases and acceptance scenarios

Entries below extend existing registries without renumbering. Phase C means catalogue requirement; the founder selects delivery scope later. Applicable foundation, safety and content gates remain mandatory when enabled.

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| DAY-UC-011 | Optional first-visit mood card respects local day, work schedule, Skip and Off | U | C |
| DAY-UC-012 | On-open support card reflects a current voluntary mood without changing navigation semantics | U | C |
| DAY-UC-013 | Choose general, selected-scripture or no encouragement without losing app access | U | C |
| CYCLE-UC-038 | After five days of an open period log, confirm status without assuming illness | U | C |
| CYCLE-UC-039 | Concerning answers use reviewed care information and qualified help rather than generated remedies | U | C |
| SAFE-UC-035 | Create a journey-specific trusted watcher group with acceptance and backup roles | U | C |
| SAFE-UC-036 | Run check-in deadlines on the server despite closed or sleeping browser | U | C |
| SAFE-UC-037 | Distinguish stale location, message delivery, watcher acknowledgement and confirmed arrival | P | C |
| SAFE-UC-038 | Cancel/end trip atomically stops future escalation and revokes scoped sharing links | P | C |
| LOCAL-UC-009 | Browse pictured circles, mentors and events by chosen place without requiring GPS | U | C |
| LOCAL-UC-010 | Show only consented, privacy-protected nearby counts with truthful coverage labels | U | C |
| LOCAL-UC-011 | Eligible adults mutually accept companion connection; minors remain outside public nearby discovery | U | C |
| LOCAL-UC-012 | Move from nearby circle to a moderated meetup with organizer and venue controls | U | C |
| UX-UC-015 | Multi-select occupation and life-role cards support rural, caregiving, service and retired members | U | C |
| UX-UC-016 | Occupation/goal selection creates editable shop, service, job or workshop drafts with minimal typing | U | C |
| RIGHTS-UC-001 | Select country/subdivision and rights topic using labelled pictures | U | C |
| RIGHTS-UC-002 | Read or hear a reviewed plain-language explanation with source and effective date | U | C |
| RIGHTS-UC-003 | Book jurisdiction-appropriate verified legal mentorship or workshop | U | C |
| RIGHTS-UC-004 | Unknown, expired or conflicting law produces a scoped limitation and qualified referral | P | C |
| SPIRIT-UC-001 | Privately choose, change or erase scripture preferences, including None | U | C |
| SPIRIT-UC-002 | Receive a reviewed exact passage and edition citation matching chosen theme/language | U | C |
| SPIRIT-UC-003 | Separate canonical passage, translation and explanation; reject invented quotations | P | C |
| SPIRIT-UC-004 | Stop spiritual prompts immediately without changing other notification permissions | P | C |
| DATA-UC-001 | Register provider terms, quotas, costs, permissions and verification dates | U | C |
| DATA-UC-002 | Quarantine imported law/scripture until rights, provenance and review pass | P | C |
| DATA-UC-003 | Update or withdraw affected content and retrieval indexes when source/rights change | P | C |
| DATA-UC-004 | Import authorized local organizer opportunities where external coverage is absent | U | C |
| DATA-UC-005 | Source outage or quota limit yields a permitted fallback and truthful status | P | C |

### S24 Morning encouragement without compulsory disclosure

IDs: DAY-UC-011–013, SPIRIT-UC-001–004. Member opens Home and may choose a mood or Skip. A current choice plus explicit support preferences selects one reviewed card; no preference means neutral general content or none. Records: day/timezone, optional mood, content/version, preference and feedback. Acceptance: skipping leaves every permitted module available; old moods are not relabelled current; changing faith preference cancels queued incompatible prompts; no valid licence yields a safe fallback; no scripture is fabricated.

### S25 Trusted journey with an unavailable browser

IDs: SAFE-UC-035–038. Member starts a trip after seeing recipients and escalation settings. Primary watcher accepts; server stores deadlines. Browser sleeps; location becomes stale while server check-in schedule continues. No response triggers the agreed overdue policy, with factual message and timestamp. Records: session, schedule version, grants, delivery attempts and acknowledgements. Acceptance: no background-GPS promise; one escalation per occurrence/recipient/channel; denial of location still permits time-only check-ins; failed contact delivery is visible; cancellation racing with a deadline cannot create a new authorized send after cancellation is committed; previously submitted provider messages may be unrecallable and are disclosed accurately.

### S26 Find a local workshop through pictures

IDs: LOCAL-UC-009–012, UX-UC-015–016, DATA-UC-004. Member selects a village/city and occupation or interest picture; List/Map returns eligible actual circles and events. Member opens an organizer card and requests to join. Records: consent, coarse search area, listing version, membership request and optional RSVP. Acceptance: no precise stranger locations; child accounts cannot invoke adult discovery through the API; no-result view offers online or larger-area choices; duplicate imports merge by provider/source ID; cancelled workshops cannot accept new RSVPs.

### S27 Understand a workplace rights question

IDs: RIGHTS-UC-001–004. Member taps Workplace, country and relevant region; hears or reads reviewed content with legal source and date. She may book a qualified adviser and control which information to share. Records: scoped topic request, content version and appointment grant. Acceptance: mood does not decide applicable law; unsupported country never receives another country's advice as local; missing section references fail publication; expired credentials remove regulated booking eligibility; public circles do not receive private case facts.

### S28 Import and safely revise a content collection

IDs: DATA-UC-001–005, SPIRIT-UC-002–003. Content operator registers rights and imports a permitted edition or legal collection. Validation and review precede publication. Changed law, revoked rights or corrected scripture text creates a new version and removes invalid retrieval candidates. Acceptance: exact source integrity retained; deletion/withdrawal reaches caches according to policy; no generated passage passes as canonical; quota failures do not cause uncontrolled retries; every displayed item resolves to its approved source version.

## 24 Two shared engines: reminders and notifications

These are foundational product capabilities for every enabled module. Their purpose is timely help with less effort. Measure useful completed actions and member-reported helpfulness, not maximum time in the app or maximum messages sent. A notification is not always a reminder, and a reminder can remain in My Day without sending anything externally.

### 24.1 Clear ownership

| Component | Owns | Example |
|---|---|---|
| Module/domain service | Actual task, order, appointment, cycle log, journey or event truth | Appointment was rescheduled |
| Reminder Engine | What needs attention, when, recurrence, completion, snooze, expiry and cancellation | Recalculate appointment reminder from the new time |
| Shared policy layer | Consent, audience eligibility, sensitivity, quiet hours, attention budget, priority and template permission | Hold an optional prompt during quiet hours |
| Notification Engine | In-app inbox, channel selection, rendering, dispatch, retry, provider receipts and delivery audit | Send one approved push and preserve inbox item |
| AI assistance | Optional suggestions within policy; no final authority over permission or safety deadlines | Suggest a shorter localized message or a preferred learning time |

Domain changes produce durable events. A scheduled reminder produces a notification intent when due. Direct events such as a new order may produce an intent immediately. Every intent passes the same policy check before dispatch. Responses return to the owning domain; opening a message does not complete its task.

### 24.2 Reminder Engine requirements

- Support one-off, recurring, event-relative and explicit condition-based schedules, with start/end dates and expiry. Store UTC instants plus intended IANA timezone/local time. Ask whether travel-related timezone changes should preserve local time or original time for ordinary schedules; safety deadlines use unambiguous elapsed time.
- Use template choices such as Morning, Evening, Before event, 15 minutes and Tomorrow, with editable details. Show a plain-language preview before enabling recurrence. No free text is required for common reminders.
- Maintain states Draft, Scheduled, Due, Snoozed, Completed, Cancelled and Expired. Each occurrence has its own ID and schedule version. Completing one occurrence does not delete a recurring series; support This time and Entire series choices.
- Reconcile reminders when a period log is corrected, appointment moves, workshop is cancelled, job expires, order is fulfilled or user withdraws consent. Do not continue reminders for an already satisfied condition.
- Done, Later, Skip today, Change time and Stop are visible quick actions. Undo applies only where meaningful and must not restart old safety escalation inadvertently.
- Use persistent server scheduling, restart recovery, idempotent due processing, bounded catch-up and explicit missed-schedule policies. After an outage, expire old encouragement instead of sending a burst. Active safety sessions have their own reviewed recovery policy.
- Authorize all task actions server-side and reconcile edits across devices. No browser timer or AI request is the authoritative scheduler. Do not create clinical thresholds or medication schedules from a model's guess.

### 24.3 Notification Engine requirements

- Provide one inbox with clear categories: My reminders, Orders/bookings, Circles, Learning/jobs and Safety/account. Each item has icon, short label, time, reason and a permitted deep link. Sensitive details require authentication; a shared-device preview remains neutral.
- Support in-app delivery first, permission-based web push and approved email/SMS or other contracted channels as needed. Request browser permission in context after explaining value. Denial leaves the app usable; do not repeatedly trigger permission prompts.
- Separate Created, Policy-held, Queued, Provider-accepted, Delivered where observable, Opened where observable, Action-confirmed, Failed, Expired and Suppressed. A provider acknowledgement does not prove the person saw the message. Some channels cannot supply delivery/open evidence.
- Deduplicate by intent/occurrence, recipient, schedule version and channel. Set TTLs, bounded retries with backoff, invalid-token cleanup, signed provider callbacks and dead-letter review. Do not claim exactly-once delivery across third-party transports; reduce duplicates and reconcile ambiguous outcomes.
- Fall back to another channel only under the saved policy and recipient permission. Do not send push, email and SMS simultaneously for ordinary encouragement. Contact escalation can use separately agreed multi-channel rules.
- Recheck consent, current task state, blocked users, age policy, template version, budget and expiry immediately before dispatch. Messages already handed to a provider may not be recallable; cancellation blocks new dispatches and records in-flight uncertainty.
- Keep health, faith, exact location and case details out of provider logs, analytics and notification previews by default. Protect subscription endpoints and credentials. Do not use public topic subscriptions for sensitive personal notifications.
- Provide an operations console for queue lag, overdue jobs, quotas, failures, opt-outs, suppression reasons and template rollback. Staff access is role-scoped and audited.

### 24.4 Respectful attention policy

The following are configurable starting product defaults, to validate with women across ages, languages and digital confidence levels. They are not industry-mandated numeric limits.

| Message class | Default behaviour | AI authority |
|---|---|---|
| Optional mood/quote/activity | In-app by default; explicit opt-in for outbound; at most one proactive wellbeing prompt per local day; two unanswered prompts pause that series | Select an approved relevant card or suggest timing within user-approved windows |
| Optional discovery/learning nudge | Off until selected; may join a digest; combined discretionary outbound budget initially two per local day with at least four hours between | Rank relevant opted-in material; may reduce or suppress, not exceed budget |
| User-created reminder | Preview exact schedule; coalesce where member agrees; stop on completion/cancellation | Suggest a schedule; no silent deadline change |
| Order/booking/security event | Deliver needed transactional information; consolidate duplicates; separate controls and required notices from optional engagement | Plain-language assistance only; factual state comes from domain records |
| Active travel safety | Explicit session-specific intervals, grace and recipients; separate agreed policy from ordinary quiet hours and fatigue suppression | No power to postpone escalation, infer safety from mood or select new recipients |

One card shown after a voluntary check-in is a user-initiated response, not permission to start a push series. Digest budgets apply across all modules so each module cannot consume its own independent allowance. Stop, Not now and notification settings must work without typing. Not now suppresses that day's unsolicited wellbeing prompts; a user-requested immediate response remains possible. Sleep/quiet periods, school hours and cohort rules take precedence as applicable.

Offer Less often, Only important, In-app only, Pause until date and Off. Show Why this reminder? in plain language. Do not infer that silence means distress, consent, worsening health or interest. Do not increase frequency because someone is lonely, sad, young or unlikely to return. No guilt, fabricated urgency, fear of losing friends or cross-selling based on health/religion.

### 24.5 Shared module workflows

| Module | Trigger and helpful reminder | Stop or update condition |
|---|---|---|
| My Day / mood | Opted-in morning check-in and one selected support card | Skip, stale mood, pause, cap or consent withdrawal |
| Cycle / wellness | Confirm an open log, a chosen habit or member/clinician-entered schedule | Corrected log, completed action, pause or reviewed care route |
| Earn / Market | Order action, service booking, seller stock task | Order change, cancellation, completed task; AI does not invent shortages |
| Circles | Invitation, relevant reply or chosen digest | Leave, mute, block, removed content or revoked role |
| Learn / mentoring | Session preparation, workshop start, chosen study reminder | Rescheduled/cancelled session or completed activity |
| Jobs / benefits | Saved opportunity deadline or application follow-up | Expiry, withdrawn listing, member declines or completes |
| Help / rights | Booked adviser meeting or explicitly saved action checklist | Case/task closed, source invalidation or consent withdrawn |
| Scripture | Chosen daily/occasional approved passage | Preference off, no licensed version, cap or fatigue pause |
| Travel | Check-in deadline and agreed contact escalation | Valid check-in advances deadline; arrival/cancellation ends session |

### 24.6 AI and workflow architecture contract

Begin with two logical modules sharing reliable infrastructure; use separate deployable services only when scale or operational isolation warrants it. Central rules must remain consistent. Required records: ReminderDefinition, ReminderOccurrence, DomainEvent/Outbox, NotificationIntent, PreferenceVersion, PolicyDecision, DeliveryAttempt, DeviceSubscription, ActionReceipt and AuditEvent. Sensitive detail remains in its protected domain; events carry minimal references.

Commit domain changes and outbox events atomically. Workers consume at least once with idempotency. Versioned cancellation/completion must invalidate queued occurrences, and dispatch must validate current authorization. Avoid racing independent AI agents. AI returns a constrained proposal—approved content ID, allowed time window or concise draft—then deterministic validation accepts, revises or rejects it. Approved static templates keep core service working during AI outages.

Use priority queues so ordinary digests cannot delay active safety work. Add per-provider and per-recipient limits, fairness, burst protection, circuit breakers and capacity alarms. Determine service-level targets from tested load and safety policy before launch; do not invent a delivery guarantee. Deleting an account revokes subscriptions and cancels future optional jobs, subject to applicable retention and operational duties.

### 24.7 Implementation options and setup

| Option | Fit / cost status | Setup and limitation |
|---|---|---|
| [Browser Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) | Standard browser mechanism using a service worker and subscription; transport is not a durable scheduler | Serve over supported secure environment, register service worker, request permission on user action, store protected subscription and implement backend delivery. Verify device/browser compatibility. Background push does not grant continuous GPS. |
| [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) | Hosted transport option for web; assess [current Firebase pricing](https://firebase.google.com/pricing) and other backend costs before procurement | Create organization-owned Firebase project, register web app, follow Web setup, configure service worker and server credentials, test token lifecycle and failure handling. Keep reminder logic and safety policy in WomSakhi. |
| [Temporal workflows](https://docs.temporal.io/workflows) | Durable workflow candidate; review [repository licence](https://github.com/temporalio/temporal/blob/main/LICENSE) and self-host/cloud operating costs | Evaluate existing stack first; provision environment and workers; persist workflow IDs, signals and cancellation; follow [timer documentation](https://docs.temporal.io/develop/typescript/workflows/timers). Self-hosting is not cost-free. Cloud account/plan requires current pricing review. |
| [Twilio India SMS pricing](https://www.twilio.com/en-us/sms/pricing/in) | Paid SMS candidate; dynamic exact rates were not verified here | Create business account, confirm supported country/route and sender-registration requirements, configure credentials and delivery callbacks, test permitted recipients, fund only after cost approval. SMS is not a guaranteed emergency service; no lifetime-free assumption. |

Choose one scheduling implementation and a small set of necessary transports after repository review; do not install every candidate. Notification-management vendors may be evaluated later, but must enforce the same WomSakhi policy and data boundaries. Provider accounts are not created by this catalogue.

### 24.8 Engine use case registry

| ID | Use case and observable outcome | Origin | Phase |
|---|---|---|---|
| REM-UC-001 | Create a reminder from picture/time presets and review the schedule | U | C |
| REM-UC-002 | Persist one-off, recurring and event-relative schedules with timezone semantics | U | C |
| REM-UC-003 | Offer Done, Later, Skip and Stop without mandatory typing | U | C |
| REM-UC-004 | Cancel or recalculate when the source task changes | P | C |
| REM-UC-005 | Restart workers without losing due occurrences or creating duplicate work | P | C |
| REM-UC-006 | Distinguish one occurrence from an entire series when editing | P | C |
| REM-UC-007 | Validate AI schedule proposals against consent and allowed windows | U | C |
| REM-UC-008 | Expire stale optional reminders without an outage recovery burst | P | C |
| REM-UC-009 | Isolate safety deadlines from optional engagement schedules | U | C |
| REM-UC-010 | Synchronize completion and cancellation across devices | P | C |
| REM-UC-011 | Show reason, next due time and editable recurrence clearly | U | C |
| REM-UC-012 | Honour pause, deletion and revoked consent in queued work | P | C |
| NOTIFY-UC-001 | Route every module through a shared notification policy | U | C |
| NOTIFY-UC-002 | Provide a localized categorized inbox with secure deep links | U | C |
| NOTIFY-UC-003 | Request web-push permission contextually with usable denial fallback | P | C |
| NOTIFY-UC-004 | Enforce quiet hours, global discretionary budget and fatigue pause | U | C |
| NOTIFY-UC-005 | Render approved discreet content matching explicit preferences | U | C |
| NOTIFY-UC-006 | Deduplicate, expire and retry with bounded provider-specific rules | P | C |
| NOTIFY-UC-007 | Distinguish provider acceptance, observable delivery and user action | P | C |
| NOTIFY-UC-008 | Use fallback channels only under agreed consent and safety rules | P | C |
| NOTIFY-UC-009 | Recheck permission and source state immediately before dispatch | P | C |
| NOTIFY-UC-010 | Offer Less often, In-app only, Pause and Off with immediate effect on unsent work | U | C |
| NOTIFY-UC-011 | Monitor failures, queue lag, costs and suppression with audited staff access | P | C |
| NOTIFY-UC-012 | Continue essential workflows with approved templates when AI is unavailable | P | C |

### S29 A useful reminder without repeated interruption

IDs: REM-UC-001–008, 010–012; NOTIFY-UC-001–006, 009–010. Member selects a learning reminder and an optional mood prompt. The engine checks the combined attention budget, quiet time and live task state. Member taps Done on another device before dispatch. Acceptance: pending learning send is suppressed; the completed task stays complete after retry; a duplicate event produces no additional intent; daylight-saving transitions follow the documented rule once; Stop cancels unsent series work; ignored mood prompts pause per policy. No extra channel is added to regain attention.

### S30 Travel deadline during provider or AI failure

IDs: REM-UC-005, 009; NOTIFY-UC-006–009, 011–012. An active journey becomes overdue while AI is unavailable and the primary transport fails. The deterministic workflow uses the approved factual template, attempts the pre-agreed fallback within bounds, and records failure/acknowledgement accurately. Acceptance: ordinary digest backlog does not block the safety queue; an unavailable fallback is shown as unavailable; stale location is labelled; provider acceptance is not labelled watcher acknowledgement; forged callbacks are rejected; late retries cannot revive a closed trip; no model output changes escalation recipients or deadline.

### 24.9 Verification and success measures

Test quiet-hour boundaries, timezone changes, duplicate/out-of-order events, consent revocation races, worker restarts, cancelled jobs, expired listings, token expiry, provider timeout ambiguity, repeated callbacks, cross-account access, malicious deep links, browser sleep and queue overload. Test notification settings with screen readers and supported local languages. Use synthetic time for deterministic deadline tests and a controlled device matrix for real delivery behaviour.

Track helpfulness, successful task completion, time saved, opt-out/mute rates, duplicate rate, stale-message rate, due-job lag, failure recovery and acknowledged safety escalation. Count notification opens only as a diagnostic measure. Never optimize for compulsive use or increase pressure because a member is vulnerable. Conduct periodic member interviews, especially with rural, older and low-literacy participants, to check that reminders feel supportive.

### Revision 2.3 validation summary

480 unique registry entries and 30 detailed scenarios. This revision adds 52 entries and seven scenarios, preserves earlier IDs, makes the two shared engines explicit, defers native mobile and revenue-model choices, and records provider evidence and unverified items separately. No application, live notification workflow, provider account or content database has been deployed by updating this specification.







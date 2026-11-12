# WomSakhi release, monitoring and recovery

Updated 31 October 2026. Current release scope: English web journeys for learning, selling and finding work from home. Bank payouts and additional languages are deferred; the mobile app is developed separately. No production database restore or cloud rollout is performed by the checks described here.

## Reminder scheduling and delivery

Personal reminders support a daily local time, selected weekdays, or an interval within a daily window. Water reminders live under Health → Appointments & Reminders at `/app/health/reminders/water`, separately from the general reminders list. Existing water reminders appear there automatically, and water notifications open that Health page. The water shortcut opens a 30-minute schedule from 08:00 to 21:00; the member can change the interval, hours and days before saving. The server previews five actual upcoming instants without creating records. Interval reminders stay on their local time grid and respect quiet hours; missed intervals are not delivered in a burst after downtime.

Members can edit, pause/resume, stop, snooze one occurrence for 15 minutes, skip one occurrence, or mark it done. Snooze does not move the rest of the series. Completing a one-off finishes that reminder. Completing a repeating occurrence keeps its future schedule. Editing or stopping a series also prevents old held messages and retries from being delivered.

Production uses the authenticated `/api/v1/internal/engines/tick` endpoint on a one-minute scheduler cadence with `ENGINES_ENABLED=true`. Keep `ENGINES_LOCAL_WORKER=false` in production. Queues, leases, idempotency keys and receipts are stored in MongoDB; a browser timer is not responsible for delivery.

For local development, `ENGINES_ENABLED=true` and `ENGINES_LOCAL_WORKER=true` start a 30-second background loop with the API. It writes a heartbeat to `engine_runtime/local_worker`, stops on application shutdown, and retries failed ticks. This development mode permits in-app and consented browser push only; it blocks email, SMS and WhatsApp, skips verification follow-up emails, and does not dispatch safety escalations. It is not a replacement for the production scheduler.

The Reminders page shows actual delivery preferences and device subscription state. Device notifications require a configured VAPID pair, a service worker and the member's browser permission. The Enable device notifications button saves both the subscription and push preference. Disabled or In-app only preferences remain explicit. Browser and operating-system restrictions may delay notifications; do not promise exact-second background alarms. See [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

Reminder regression checks: `tests/test_reminder_intervals.py`, `tests/test_reminders_functional.py`, and `tests/test_reminder_worker.py`. The database tests use unique databases on local MongoDB port 27099 and never use the ordinary development database. `checks/reminders-functional.mjs` targets an isolated API on 8031 and production frontend on 3111 with a provisioned `reminders.audit@example.com` test member and a fixed test login code; external messaging is disabled in that environment.

## Latest isolated end-to-end verification (31 October 2026)

The full backend run completed with **782 passed and 3 skipped**, using local
MongoDB on 27099. The three skips are one development-only documentation gate
and two legacy policy tests explicitly marked as skipped. Database-backed
recovery, authentication, ownership, course payment gates, reading, health,
reminder and other module tests ran rather than being skipped for lack of MongoDB.

A separately built production frontend on 3111 used only the disposable API on
8031. Its `ALLOWED_ORIGINS` included the preview origin; ordinary app/API ports
3100/8020 and their database were left running. External messaging, payment
credentials and paid AI calls were disabled in the test service.

| Check | Result |
| --- | --- |
| Water logging | Save/reload, daily summary, shared Wellness total, reminder links, undo and desktop/mobile layout passed |
| Recurring reminders | Preview/create/reload, 30-minute schedule, edit, pause/resume, in-app delivery, snooze and stop passed |
| Core journeys | Learn, Sell and Work, initial filters and unavailable-progress fallback passed on desktop/mobile |
| My Money | Income/expense, bill payment/undo, PIN, hidden amounts and unavailable-data states passed |
| Store operations | 37 checks passed across seven create/list/update/archive workflows |
| Community and related workflows | 15 checks passed for circles, goals, wellbeing availability and one-off reminders |
| Article/book reader | Pagination, durable bookmarks, reload, font controls and failed-save/retry passed; free-course preview remains disabled and paid public previews remain blocked |
| Session switching | 13 checks passed for staff/member sign-in, sign-out and role routing |
| Member route sweep | 366 checks across 183 destinations on desktop/mobile; 0 findings, 0 explicit not-ready states; see [route ledger](ui-showcase/e2e-journey-2026-10-31.json) |
| API survey | 360 GET endpoints exercised: 356 successful, 3 intentionally access-gated, 1 requiring query parameters, 0 not found and 0 server errors |
| Build and types | Production build, TypeScript and the updated browser-check lint passed |

The water regression exposed a 4-pixel desktop overflow from negative horizontal
margins on sticky side columns. Those margins now apply vertically only, keeping
shadow padding inside the page. The full water flow and core journeys passed
again against the corrected production build. The reader check resets its initial
page so repeated runs can reuse the same synthetic book. The member route audit
also recognizes `.ux-skeleton` during redirect loading, instead of measuring an
unfinished page as missing its heading.

This verifies isolated application behavior, not a production rollout. Live email,
SMS, WhatsApp, browser push delivery to a real device, paid AI and actual UPI money
movement were not exercised. The static performance guard reports a 419 KiB largest
JavaScript chunk (within its budget) but flags two original branding PNGs above
750 KiB; those supplied master assets were preserved.

## Health contract

Both the web server and API expose:

| Endpoint | Meaning | Healthy response | Failure response |
| --- | --- | --- | --- |
| `/health/live` | The process can answer requests | HTTP 200, `status: alive` | Process/network failure |
| `/health/ready` | The service and required database path can serve traffic | HTTP 200, `status: ready` | HTTP 503, `status: unavailable` |

API readiness pings MongoDB with a two-second deadline. Web readiness checks API readiness with a three-second deadline. Neither returns exception details or connection strings, and both disable response caching. Keep liveness independent of database availability so a database outage does not cause a restart loop. The deployment smoke gate now checks readiness on both deployed services. The older API `/health` is retained for compatibility and is not a database readiness check.

Read-only scheduler/uptime command, run from the repository root:

```bash
python3 ops/check_services.py \
  --web https://app.womsakhi.com \
  --api https://api.womsakhi.com
```

It prints a JSON result per check and exits nonzero if any check fails. Schedule every minute, alert after two consecutive failures, and check for two consecutive successes after remediation. These paths must first be included in a deployed release; a 404 on the previous release is not a database outage.

Cloud Run supports startup, liveness and readiness checks. The deployment workflow now declares startup on `/health/ready`, liveness on `/health/live` and dependency readiness on `/health/ready` for both services. Startup allows twelve attempts at ten-second intervals; liveness uses three failures thirty seconds apart; readiness needs two successes after failure. These settings take effect on deployment, not from editing this repository. [Google Cloud health-check documentation](https://docs.cloud.google.com/run/docs/configuring/healthchecks).

## Metrics and alerts

Set `MONITORING_TOKEN` on the API from a secret manager. Blank disables `/internal/metrics` with HTTP 404; incorrect or missing credentials receive HTTP 401. For the repository Cloud Run deployment workflow, set the GitHub repository variable `MONITORING_SECRET_NAME` to the name of an existing Secret Manager secret and grant the runtime service account access. The workflow then includes `MONITORING_TOKEN` in its secret bindings; leaving the variable blank keeps metrics disabled. The configured scraper sends `Authorization: Bearer …`. Never place this token in a URL, screenshot, public frontend variable or committed configuration.

The endpoint exports Prometheus counters for response classes and methods, a request-duration histogram, in-flight requests and process uptime. It records no user IDs, raw paths, query strings or personal content. Labels have bounded cardinality. Counters are per process and reset on restart; scrape each instance or use the platform's request metrics for service-wide Cloud Run SLOs. A load-balanced scrape of one arbitrary instance is not a complete service aggregate.

The API's existing `X-Request-ID`, `Server-Timing` and slow-query logs complement these metrics. Use the request ID to investigate a failure without publishing private request bodies.

Prepared configuration:

- [Prometheus scrape configuration](../ops/monitoring/prometheus.yml): set the actual target and mount its secret file.
- [Alert rules](../ops/monitoring/alerts.yml): unavailable scrape, elevated 5xx rate and sustained p95 latency. Low-volume guards reduce misleading alerts.
- The read-only probe can also verify protected metrics with `--metrics` and `MONITORING_TOKEN` supplied through its environment.

The rules are deployment artifacts, not evidence of a live monitoring installation. An operator must wire an alert receiver/channel and perform a delivered-alert test. The scraper failure alert covers invalid credentials as well as service/network failures; investigate before restarting anything. Run the readiness probe separately because a reachable metrics endpoint does not prove MongoDB is ready.

## Reproducible pre-release checks

Frontend, from `womencrafts-frontend/frontend`:

```bash
npm ci
npm run build
```

The default Turbopack build is the release check. The redundant Playfair font in the developer-only auth gallery was removed, and both builders/standalone tracing now use the frontend directory as their root. The standalone artifact must contain `server.js` at its root, plus copied `public/` and static output, matching the Dockerfile. Do not substitute a development server for the production smoke check.

Backend, from `womencrafts-backend/backend`:

```bash
pip install -r requirements-test.txt
python -m pytest -q
```

DB-backed tests use only a local MongoDB on port 27099. Tests skip if it is absent; a skipped restore test does not establish recovery. PR CI now provisions local MongoDB so those checks run there. `tests/test_production_recovery.py` creates a uniquely named throwaway database, writes core learning/shop/work records, backs them up, removes them, restores them and checks equality against persisted data. It also restores sample public and opaque private files and verifies SHA-256 hashes. It never targets the ordinary application database.

## Backups: what must be recoverable

Maintain three independent recovery inputs:

1. **Database:** managed MongoDB snapshots/PITR appropriate to the agreed recovery point, retained outside the running application. Application backups are useful for selected business records but are not a complete substitute for managed recovery.
2. **Object/private media:** separate backups or versioned copies of public images, gallery photos and encrypted private documents. Database exports contain references, not these bytes.
3. **Configuration and keys:** retained image digests, environment configuration and secret-manager versions, including `DOCUMENT_ENCRYPTION_KEY`. Restoring encrypted documents without the matching key does not restore access to them.

The application's explicit full-backup set now includes shop listings/orders/reviews/operations and work profiles/taxonomies. Its schedule remains a stored preference rather than a running backup job. Do not claim scheduled protection until an external job is configured and successful runs are monitored. Identity-document and token exclusions still apply; inspect the full collection set before treating an application export as a complete disaster-recovery snapshot.

Record snapshot age, collection/document counts, object hashes, encryption-key version and last successful restore-drill time. Define RPO/RTO with the operator from measured staging drills; this local drill does not establish production timings or a guaranteed recovery window.

## Recovery procedure

1. Identify the incident using readiness checks, request IDs and metrics. Decide whether it is an application regression, dependency outage, missing object or data loss.
2. For a dependency outage, retain data and restore connectivity/capacity first. Liveness can remain healthy while readiness is unavailable. Confirm readiness returns without a forced application restart.
3. For an application regression, roll traffic back to a previously validated image/revision. Keep web/API compatibility and secret versions in view; a web image contains its build-time API rewrite.
4. For data loss, stop relevant writes and take a forensic snapshot before making changes. Restore to a separate database first. Verify ownership, learning progress, store/gallery references and application states there.
5. Restore required object versions and keys in that isolated environment. Verify files by hash and exercise authenticated reads and anonymous shop browsing.
6. Promote a validated restore only during an authorised maintenance procedure. The app's restore action replaces selected collections and requires Super Admin confirmation; it is not an atomic database-wide rollback.
7. Rerun readiness, metrics, session and three-journey smoke checks. Verify the alert resolves and record the incident, chosen snapshot and measured recovery time.

Cloud Run traffic rollback does not re-run deployment health checks or verify external dependencies. Check the target revision before and after moving traffic. An operator can use `gcloud run services update-traffic SERVICE --to-revisions REVISION=100` with the correct project/region. This is a production change and is not run by the local checks. [Google Cloud rollback documentation](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration).

## Deployment boundary

Local evidence can establish that the production artifact starts, the readiness contract works, access is protected, and an isolated database/file restore preserves test data. It cannot establish that cloud probes, managed snapshots, object retention or delivered alert notifications are enabled. Validate those in the actual deployed environment and record the evidence before marking operational launch readiness complete.

## Current payment release mode

Keep `DIRECT_UPI_ONLY=true` for this release. Providers receive UPI payments externally and confirm submitted transaction references in the course/mentoring screens. No gateway credentials are required for this mode; gateway checkout/confirmation/webhook endpoints are blocked. Bank payouts remain unavailable. Historical provider adapters and credit records are retained for compatibility and future development, not enabled as a current payment service. See [Direct UPI payments](DIRECT_UPI_PAYMENTS.md).

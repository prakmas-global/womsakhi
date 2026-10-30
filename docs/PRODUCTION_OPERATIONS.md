# WomSakhi release, monitoring and recovery

Updated 30 October 2026. Current release scope: English web journeys for learning, selling and finding work from home. Bank payouts and additional languages are deferred; the mobile app is developed separately. No production database restore or cloud rollout is performed by the checks described here.

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

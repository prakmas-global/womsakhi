"""Bounded, process-local HTTP metrics. Never records URLs, query strings or identities."""
from collections import Counter
from threading import Lock
from time import monotonic

BUCKETS = (0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10)


class HttpMetrics:
    def __init__(self):
        self.lock = Lock()
        self.started = monotonic()
        self.requests = Counter()
        self.buckets = Counter()
        self.duration = 0.0
        self.inflight = 0

    def enter(self):
        with self.lock:
            self.inflight += 1

    def leave(self, method, status, seconds):
        method = method if method in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"} else "OTHER"
        status_class = f"{min(5, max(1, status // 100))}xx"
        with self.lock:
            self.inflight -= 1
            self.requests[(method, status_class)] += 1
            self.duration += seconds
            for bucket in BUCKETS:
                if seconds <= bucket:
                    self.buckets[bucket] += 1

    def render(self):
        with self.lock:
            total = sum(self.requests.values())
            lines = ["# HELP womsakhi_http_requests_total Completed HTTP requests.", "# TYPE womsakhi_http_requests_total counter"]
            lines.extend(f'womsakhi_http_requests_total{{method="{m}",status_class="{s}"}} {n}' for (m, s), n in sorted(self.requests.items()))
            lines += ["# HELP womsakhi_http_request_duration_seconds HTTP request latency.", "# TYPE womsakhi_http_request_duration_seconds histogram"]
            lines.extend(f'womsakhi_http_request_duration_seconds_bucket{{le="{b}"}} {self.buckets[b]}' for b in BUCKETS)
            lines += [f'womsakhi_http_request_duration_seconds_bucket{{le="+Inf"}} {total}',
                      f"womsakhi_http_request_duration_seconds_sum {self.duration:.6f}",
                      f"womsakhi_http_request_duration_seconds_count {total}",
                      "# TYPE womsakhi_http_inflight gauge", f"womsakhi_http_inflight {self.inflight}",
                      "# TYPE womsakhi_uptime_seconds gauge", f"womsakhi_uptime_seconds {monotonic() - self.started:.3f}"]
            return "\n".join(lines) + "\n"


metrics = HttpMetrics()


class OperationalMetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path", "").startswith(("/health", "/internal/metrics")):
            return await self.app(scope, receive, send)
        status = 500
        start = monotonic()
        metrics.enter()

        async def capture(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture)
        finally:
            metrics.leave(scope.get("method", "OTHER"), status, monotonic() - start)

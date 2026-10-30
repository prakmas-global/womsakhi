#!/usr/bin/env python3
"""Read-only uptime probe, suitable for a scheduler. Never logs credentials or response bodies."""
import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def check(url, expected, timeout):
    start = time.monotonic()
    try:
        with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=timeout) as response:
            status = response.status
            body = json.load(response)
        ok = status == 200 and body.get("status") == expected
    except HTTPError as error:
        status, ok = error.code, False
    except (URLError, TimeoutError, ValueError, OSError):
        status, ok = 0, False
    return {"ok": ok, "http_status": status, "elapsed_ms": round((time.monotonic() - start) * 1000)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--web", required=True, help="Web origin, e.g. http://localhost:3113")
    parser.add_argument("--api", required=True, help="API origin without /api/v1")
    parser.add_argument("--metrics", action="store_true", help="Also check protected metrics with MONITORING_TOKEN from the environment")
    parser.add_argument("--timeout", type=float, default=5)
    args = parser.parse_args()
    results = {}
    for service, base in (("web", args.web), ("api", args.api)):
        parsed = urlsplit(base)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            parser.error("Use a plain HTTP(S) origin without credentials or query parameters")
        for name, expected in (("live", "alive"), ("ready", "ready")):
            results[f"{service}_{name}"] = check(base.rstrip("/") + f"/health/{name}", expected, args.timeout)
    if args.metrics:
        token = os.environ.get("MONITORING_TOKEN", "")
        if not token:
            parser.error("MONITORING_TOKEN is required with --metrics")
        try:
            req = Request(args.api.rstrip("/") + "/internal/metrics", headers={"Authorization": f"Bearer {token}"})
            with urlopen(req, timeout=args.timeout) as response:
                ok = response.status == 200 and "womsakhi_http_requests_total" in response.read().decode()
                status = response.status
        except HTTPError as error:
            status, ok = error.code, False
        except (URLError, TimeoutError, ValueError, OSError):
            status, ok = 0, False
        results["api_metrics"] = {"ok": ok, "http_status": status}
    print(json.dumps(results, sort_keys=True))
    return 0 if all(result["ok"] for result in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())

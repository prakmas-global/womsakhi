"""Operational checks must distinguish a living process from an available dependency."""
from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.operations import HttpMetrics, OperationalMetricsMiddleware
from app.routes import operations


@pytest.fixture
async def client():
    from main import app
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def test_readiness_fails_and_recovers_without_restarting(client, monkeypatch):
    db = AsyncMock()
    monkeypatch.setattr(operations, "raw_database", lambda: db)
    db.command.side_effect = RuntimeError("mongodb://secret-host?password=secret")
    assert (await client.get("/health/live")).status_code == 200
    down = await client.get("/health/ready")
    assert down.status_code == 503 and "secret" not in down.text
    assert down.headers["cache-control"] == "no-store"
    db.command.side_effect = None
    db.command.return_value = {"ok": 1}
    assert (await client.get("/health/ready")).json()["status"] == "ready"


async def test_metrics_require_configured_secret(client, monkeypatch):
    monkeypatch.setattr(operations.settings, "MONITORING_TOKEN", "")
    assert (await client.get("/internal/metrics")).status_code == 404
    monkeypatch.setattr(operations.settings, "MONITORING_TOKEN", "test-monitoring-only")
    assert (await client.get("/internal/metrics")).status_code == 401
    assert (await client.get("/internal/metrics", headers={"Authorization": "Bearer wrong"})).status_code == 401
    metrics = await client.get("/internal/metrics", headers={"Authorization": "Bearer test-monitoring-only"})
    assert metrics.status_code == 200 and "womsakhi_http_requests_total" in metrics.text
    assert "test-monitoring-only" not in metrics.text


def test_metrics_have_bounded_labels_and_cumulative_histograms():
    metrics = HttpMetrics()
    for method, status, duration in [("GET", 200, .04), ("ODD-SECRET", 599, .4)]:
        metrics.enter()
        metrics.leave(method, status, duration)
    rendered = metrics.render()
    assert 'method="OTHER",status_class="5xx"' in rendered
    assert 'le="0.05"} 1' in rendered and 'le="+Inf"} 2' in rendered
    assert "womsakhi_http_inflight 0" in rendered
    assert "ODD-SECRET" not in rendered


async def test_metrics_count_unhandled_failure_and_balance_inflight(monkeypatch):
    from app.core import operations as module
    sample = HttpMetrics()
    monkeypatch.setattr(module, "metrics", sample)
    async def crash(scope, receive, send):
        raise RuntimeError("failure")
    middleware = OperationalMetricsMiddleware(crash)
    with pytest.raises(RuntimeError):
        await middleware({"type": "http", "path": "/test/private-id", "method": "GET"}, None, None)
    assert 'status_class="5xx"} 1' in sample.render()
    assert sample.inflight == 0 and "private-id" not in sample.render()

"""The deferred payout feature must never debit credits, including via old clients."""
import httpx
import pytest
from fastapi import FastAPI

from app.core.rbac import require_active_member
from app.routes import payout


@pytest.mark.asyncio
async def test_withdrawal_is_unavailable_before_any_database_access(monkeypatch):
    app = FastAPI()
    app.include_router(payout.router)
    app.dependency_overrides[require_active_member] = lambda: {"_id": "release-test-member"}

    def forbidden_database():
        pytest.fail("Deferred payout accessed the database")

    monkeypatch.setattr(payout, "get_database", forbidden_database)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(2):
            result = await client.post("/me/payout/withdraw", json={"amount_minor": 10000}, headers={"Idempotency-Key": "old-mobile-retry"})
            assert result.status_code == 501
            assert "No credits have been deducted" in result.json()["detail"]


@pytest.mark.asyncio
async def test_direct_upi_release_never_invokes_gateway_or_database(monkeypatch):
    from app.routes import payments
    from app.core.config import settings
    monkeypatch.setattr(settings, 'DIRECT_UPI_ONLY', True)
    def forbidden(*args, **kwargs):
        pytest.fail('Direct UPI attempted gateway or database access')
    monkeypatch.setattr(payments, 'get_provider', forbidden)
    monkeypatch.setattr(payments, 'get_database', forbidden)
    app = FastAPI()
    app.include_router(payments.router)
    app.dependency_overrides[require_active_member] = lambda: {'_id': 'upi-test-member'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        methods = (await client.get('/payments/methods')).json()
        assert methods['provider'] == 'direct_upi'
        assert [row['key'] for row in methods['methods']] == ['upi']
        for path, body in [('/payments/orders', {'purpose': 'program', 'reference_id': '123'}), ('/payments/orders/123/confirm', {'method': 'upi', 'provider_payload': {}}), ('/payments/webhook', {})]:
            response = await client.post(path, json=body, headers={'Idempotency-Key': 'cached-old-payment'})
            assert response.status_code == 501, response.text

"""Process liveness, dependency readiness and secret-protected operational metrics."""
import asyncio
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse, Response

from app.core.config import settings
from app.core.operations import metrics
from app.db.mongodb import raw_database

router = APIRouter(tags=["Operations"])
NO_STORE = {"Cache-Control": "no-store"}


@router.get("/health/live")
async def live():
    # A database outage must not trigger an endless process-restart loop.
    return JSONResponse({"status": "alive"}, headers=NO_STORE)


@router.get("/health/ready")
async def ready():
    try:
        await asyncio.wait_for(raw_database().command("ping"), timeout=2)
    except Exception:
        return JSONResponse({"status": "unavailable", "checks": {"database": "unavailable"}}, status_code=503, headers=NO_STORE)
    return JSONResponse({"status": "ready", "checks": {"database": "ok"}}, headers=NO_STORE)


async def require_monitoring_token(authorization: str = Header(default="")):
    token = settings.MONITORING_TOKEN
    if not token:
        raise HTTPException(404, "Not found")
    if not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Monitoring credentials required")


@router.get("/internal/metrics", include_in_schema=False)
async def operational_metrics(_: None = Depends(require_monitoring_token)):
    return Response(metrics.render(), media_type="text/plain; version=0.0.4", headers=NO_STORE)

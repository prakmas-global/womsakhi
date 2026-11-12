"""Optional local reminder clock; production uses the authenticated tick endpoint."""
import asyncio
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.db.mongodb import get_database

log = logging.getLogger(__name__)


async def run():
    from app.engines.tick import run_tick
    while True:
        try:
            result = await run_tick()
            await get_database()["engine_runtime"].update_one(
                {"_id": "local_worker"}, {"$set": {
                    "last_tick_at": datetime.now(timezone.utc), "result": result,
                    "channels": ["inapp", "push"], "last_error": ""}}, upsert=True)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Local reminder tick failed; retrying next minute")
        await asyncio.sleep(30)


def start():
    if settings.ENGINES_ENABLED and settings.ENGINES_LOCAL_WORKER and not settings.is_production:
        return asyncio.create_task(run(), name="local-reminder-worker")
    return None

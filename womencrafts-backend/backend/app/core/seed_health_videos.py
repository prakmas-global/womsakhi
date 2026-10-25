"""
A starter library for Health & Wellness → Watch & listen.

Every video in `data/health_videos_starter.json` is a real, public YouTube
video from a named health or yoga source, checked to exist and to allow
embedding (YouTube oEmbed) when the list was made. They are loaded through the
same model staff use (`VideoIn`), so each one is exactly what a staff member
could have added by hand; staff can edit, hide or delete them in the dashboard
like any other.

    python -m app.core.seed_health_videos            # add the ones not there yet
    python -m app.core.seed_health_videos --dry-run  # say what would be added

A video already in the library (same link) is left alone, so running it twice
adds nothing. Refuses in production unless `--production` is given: there,
what members see is the content team's decision.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.db.mongodb import get_database
from app.routes.health_videos import VIDEOS, VideoIn, youtube_id

DATA = Path(__file__).parent / "data" / "health_videos_starter.json"


async def main(dry_run: bool = False, production: bool = False) -> None:
    if settings.is_production and not production:
        print("Refusing to load starter videos in production without --production.")
        return
    from app.db import mongodb
    if mongodb._client is None:
        await mongodb.connect_db()
    db = get_database()
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    have = {youtube_id(d.get("url", "")) or d.get("url", "") async for d in db[VIDEOS].find({}, {"url": 1})}
    added = skipped = 0
    for i, row in enumerate(rows):
        body = VideoIn(**{k: v for k, v in row.items() if k in VideoIn.model_fields}, order=row.get("order", i))
        key = youtube_id(body.url) or body.url
        if key in have:
            skipped += 1
            continue
        print(f"  + {body.category:<13} {body.title}")
        if not dry_run:
            now = datetime.now(timezone.utc)
            await db[VIDEOS].insert_one({**body.model_dump(), "created_at": now, "updated_at": now, "created_by": "starter-library"})
        have.add(key)
        added += 1
    print(f"{'Would add' if dry_run else 'Added'} {added}; {skipped} already in the library.")


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv, production="--production" in sys.argv))

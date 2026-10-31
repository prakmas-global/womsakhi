"""Development only: venv/bin/python scripts/seed_reading_demo.py."""
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core.seed_reading_demo import seed_reading_demo
from app.db.mongodb import connect_db,get_database,close_db

async def main():
    if settings.is_production:
        raise RuntimeError('Reading demo data is development-only')
    await connect_db()
    try:
        db=get_database()
        users=await db.users.find({'role':'Member','verification_status':'active','is_active':True}).to_list(length=100)
        if not users:raise RuntimeError('No active development members found')
        print(json.dumps(await seed_reading_demo(db,users),indent=2))
    finally:
        await close_db()

if __name__=='__main__':asyncio.run(main())

"""Run from backend: venv/bin/python scripts/seed_showcase.py [--apply] [--report PATH]."""
import argparse,asyncio,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.seed_showcase import BATCH,plan_showcase
from app.db.mongodb import connect_db,close_db

async def main(args):
    await connect_db()
    try:
        plan=await plan_showcase()
        report={'batch':BATCH,'users':[{'name':u.get('full_name') or 'Member','id':str(u['_id'])} for u in plan.users],
                'collections':await plan.apply() if args.apply else {c:{'planned':len(d)} for c,d in plan.docs.items()},'examples':plan.examples,
                'excluded':['identities and verification','credentials and external deliveries','active SOS alerts','wallet credits, gateway orders and bank payouts','fabricated backups, security incidents and operational successes']}
        if args.apply:
            db=plan.db
            names=await db.list_collection_names()
            gate=asyncio.Semaphore(6)
            async def count(name):
                async with gate: return name,await db[name].count_documents({'demo_batch':BATCH})
            snapshot={name:count for name,count in await asyncio.gather(*(count(name) for name in names)) if count}
            report['batch_totals']={'records':sum(snapshot.values()),'collections':len(snapshot),'counts':snapshot}
        text=json.dumps(report,indent=2)
        if args.report: Path(args.report).write_text(text+'\n')
        print(text)
    finally: await close_db()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--report');asyncio.run(main(parser.parse_args()))

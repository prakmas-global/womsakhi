"""
Score the matcher against `matching_cases.CASES`.

Run:  venv/bin/python scripts/eval_matching.py

Reports top-3 accuracy overall and split by script, because the two used to
differ enormously and an average hides that. A woman reading Telugu getting
worse answers than a woman reading English is the failure that matters most
here, and it is invisible in a single number.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.eval.matching_cases import CASES, hit  # noqa: E402


async def main() -> int:
    from app.db.mongodb import connect_db, close_db, get_database
    from app.core import matching
    from app.models.service import ServiceModel
    from app.models.program import ProgramModel

    await connect_db()
    db = get_database()
    services = [s async for s in db[ServiceModel.collection_name].find({})]
    programs = [p async for p in db[ProgramModel.collection_name].find({})]
    print(f"  catalogue: {len(services)} services, {len(programs)} programmes\n")

    by_script: dict[str, list[bool]] = {}
    rows = []
    for c in CASES:
        ranked = matching.rank(c["q"], needs=[], services=services, programs=programs)
        results = ranked["services"] + ranked["programs"]
        names = [r.get("name", "") for r in results[:3]]
        ok = hit(names, c["accept"])
        latin = c["lang"] in ("en", "hi-latin")
        by_script.setdefault("latin script" if latin else "her own script", []).append(ok)
        rows.append((ok, c["lang"], c["q"][:38], names[:2]))

    for ok, lang, q, names in rows:
        print(f"  {'ok  ' if ok else '✗   '} [{lang:8}] {q:40} → {', '.join(n[:26] for n in names)}")

    total = [ok for ok, *_ in rows]
    print(f"\n  top-3 accuracy: {sum(total)}/{len(total)} = {100*sum(total)/len(total):.0f}%")
    for script, hits in by_script.items():
        print(f"    {script:16} {sum(hits)}/{len(hits)} = {100*sum(hits)/len(hits):.0f}%")

    await close_db()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

"""How much should meaning outweigh keywords? Swept, not guessed."""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.eval.matching_cases import CASES, hit  # noqa: E402


async def main() -> int:
    from app.db.mongodb import connect_db, close_db, get_database
    from app.models.service import ServiceModel
    from app.models.program import ProgramModel
    from app.core import matching

    await connect_db()
    db = get_database()
    services = [s async for s in db[ServiceModel.collection_name].find({})]
    programs = [p async for p in db[ProgramModel.collection_name].find({})]

    for weight in (0, 12, 30, 60, 150, 1000):
        matching._SEMANTIC_WEIGHT = float(weight)
        latin, own, allh = [], [], []
        for c in CASES:
            r = matching.rank(c["q"], needs=[], services=services, programs=programs)
            names = [i.get("name", "") for i in (r["services"] + r["programs"])[:3]]
            ok = hit(names, c["accept"])
            allh.append(ok)
            (latin if c["lang"] in ("en", "hi-latin") else own).append(ok)
        label = "keywords only" if weight == 0 else ("meaning only (keywords irrelevant)" if weight >= 1000 else f"weight {weight}")
        print(f"  {label:36} overall {100*sum(allh)/len(allh):3.0f}%"
              f"   latin {100*sum(latin)/len(latin):3.0f}%   own script {100*sum(own)/len(own):3.0f}%")
    await close_db()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

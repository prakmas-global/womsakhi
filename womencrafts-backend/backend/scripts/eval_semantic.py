"""Which text should an item be matched ON? Measured, not guessed."""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.eval.matching_cases import CASES, hit  # noqa: E402


def name_only(i):  return (i.get("name") or i.get("title") or "").strip()
def with_cat(i):   return " — ".join(p for p in [name_only(i), (i.get("category") or i.get("type") or "").strip()] if p)
def with_desc(i):  return " — ".join(p for p in [with_cat(i), (i.get("description") or i.get("desc") or "").strip()] if p)


async def main() -> int:
    from app.db.mongodb import connect_db, close_db, get_database
    from app.models.service import ServiceModel
    from app.models.program import ProgramModel
    from app.core import semantic
    import numpy as np

    await connect_db()
    db = get_database()
    items = [s async for s in db[ServiceModel.collection_name].find({})]
    items += [p async for p in db[ProgramModel.collection_name].find({})]
    print(f"  {len(items)} catalogue items\n")

    model = semantic._get_model()
    for label, fn in [("name only", name_only), ("name + category", with_cat), ("name + category + description", with_desc)]:
        texts = [fn(i) for i in items]
        vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        latin_hits, own_hits, all_hits = [], [], []
        for c in CASES:
            q = model.encode([c["q"]], normalize_embeddings=True, show_progress_bar=False)[0]
            sims = vecs @ q
            top = [items[j].get("name") or items[j].get("title") or "" for j in np.argsort(-sims)[:3]]
            ok = hit(top, c["accept"])
            all_hits.append(ok)
            (latin_hits if c["lang"] in ("en", "hi-latin") else own_hits).append(ok)
        print(f"  {label:32} overall {sum(all_hits):2}/{len(all_hits)} = {100*sum(all_hits)/len(all_hits):3.0f}%"
              f"   latin {100*sum(latin_hits)/len(latin_hits):3.0f}%"
              f"   own script {100*sum(own_hits)/len(own_hits):3.0f}%")
    await close_db()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

"""
Take the hostnames back out of the database.

`POST /uploads` used to store `f"{MEDIA_BASE_URL}/media/…"` — the absolute URL,
host and all. So a file uploaded from a laptop carried `http://localhost:8020`
into Atlas permanently, and every environment that was not that laptop got a
URL the browser refused. The code no longer does this (app/core/media.py), but
the rows written while it did are still there.

This rewrites those rows to the bare path. `media_url()` puts the right host
back on the way out, so a migrated row renders correctly in every environment
instead of exactly one.

**Only loopback hosts are touched.** `localhost` and `127.0.0.1` are wrong
everywhere except the machine that wrote them, so there is no judgement call.
Rows pointing at a real, reachable host (`https://api.womsakhi.com/media/…`)
are LEFT ALONE and reported: they resolve today, `media_url()` passes them
through untouched, and rewriting them would change what a deployed environment
serves for no gain. Run with --include-host to migrate a named host as well.

**Reversible.** Every old value is written to a backup file BEFORE anything is
written back, and `--restore <file>` puts them all back exactly.

Run:  venv/bin/python -m scripts.migrate_media_urls              # count and show, write nothing
      venv/bin/python -m scripts.migrate_media_urls --strict     # exit 1 if any is left (the check)
      venv/bin/python -m scripts.migrate_media_urls --apply      # migrate
      venv/bin/python -m scripts.migrate_media_urls --restore private_media/backups/<file>.json
"""
import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from bson import ObjectId

from app.db.mongodb import close_db, connect_db, get_database

BACKUP_DIR = Path(__file__).resolve().parents[1] / "private_media" / "backups"
LOOPBACK = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
ABSOLUTE = re.compile(r"^(https?:)?//", re.I)


def _host(url: str) -> str:
    parts = urlsplit(url if not url.startswith("//") else "http:" + url)
    return parts.netloc.rsplit("@", 1)[-1].split(":")[0].strip("[]").lower()


def _media_path(url: str) -> str | None:
    """`http://localhost:8020/media/avatar/x.png` → `media/avatar/x.png`."""
    parts = urlsplit(url if not url.startswith("//") else "http:" + url)
    if not parts.path.startswith("/media/"):
        return None
    return parts.path.lstrip("/")


def _scan(value, path=""):
    """Yield (dotted_path, string, inside_array) for every string in a document."""
    if isinstance(value, str):
        yield path, value, False
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _scan(v, f"{path}.{k}" if path else str(k))
    elif isinstance(value, list):
        for v in value:
            for p, s, _ in _scan(v, path):
                yield p, s, True


async def plan(db, extra_hosts: set[str]):
    """What would change. Reads only."""
    rows, skipped, nested = [], {}, []
    for name in sorted(await db.list_collection_names()):
        async for doc in db[name].find({}):
            for field, val, in_array in _scan(doc):
                if not ABSOLUTE.match(val or ""):
                    continue
                new = _media_path(val)
                if new is None:
                    continue
                host = _host(val)
                if host not in LOOPBACK and host not in extra_hosts:
                    skipped[f"{name}.{field}"] = skipped.get(f"{name}.{field}", 0) + 1
                    continue
                if in_array:
                    nested.append((name, str(doc["_id"]), field, val))
                    continue
                rows.append({"collection": name, "id": str(doc["_id"]),
                             "field": field, "old": val, "new": new})
    return rows, skipped, nested


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually write. Without it, nothing changes.")
    ap.add_argument("--include-host", action="append", default=[],
                    help="Also migrate this host (repeatable). Loopback is always included.")
    ap.add_argument("--restore", metavar="FILE", help="Put a backup file's old values back")
    ap.add_argument("--strict", action="store_true",
                    help="Exit 1 if anything is left to migrate. This is the regression assertion: "
                         "a loopback host in the database is wrong on every machine but one.")
    args = ap.parse_args()

    await connect_db()
    db = get_database()

    if args.restore:
        payload = json.loads(Path(args.restore).read_text())
        rows = payload["rows"]
        print(f"\n  restoring {len(rows)} value(s) from {args.restore}\n")
        for r in rows:
            await db[r["collection"]].update_one(
                {"_id": ObjectId(r["id"])}, {"$set": {r["field"]: r["old"]}}
            )
            print(f"    {r['collection']}.{r['field']}  {r['id']}  ← {r['old']}")
        print(f"\n  restored {len(rows)}\n")
        await close_db()
        return 0

    extra = {h.strip().lower() for h in args.include_host if h.strip()}
    rows, skipped, nested = await plan(db, extra)

    by_coll: dict[str, int] = {}
    for r in rows:
        by_coll[f"{r['collection']}.{r['field']}"] = by_coll.get(f"{r['collection']}.{r['field']}", 0) + 1

    print("\n  TO MIGRATE — absolute URL on a host that is only right on one machine\n")
    if not rows:
        print("    nothing\n")
    for k in sorted(by_coll):
        print(f"    {by_coll[k]:4}  {k}")
    print()
    for r in rows:
        print(f"      {r['collection']}.{r['field']}  {r['id']}")
        print(f"          {r['old']}")
        print(f"       →  {r['new']}")

    if skipped:
        print("\n  LEFT ALONE — absolute, but on a host that resolves. media_url() passes these through.\n")
        for k in sorted(skipped):
            print(f"    {skipped[k]:4}  {k}")

    if nested:
        print("\n  NOT TOUCHED — inside an array, which this script does not rewrite:\n")
        for name, _id, field, val in nested:
            print(f"    {name}.{field}  {_id}  {val}")

    if args.strict:
        await close_db()
        if rows:
            print(f"\n  \033[31mFAIL: {len(rows)} absolute media URL(s) on a loopback host are in the "
                  f"database.\033[0m")
            print("  Something is storing a URL where it should store a path. See app/core/media.py.\n")
            return 1
        print("\n  \033[32mok\033[0m  no loopback media URL is stored anywhere\n")
        return 0

    if not args.apply:
        print("\n  Nothing written. Re-run with --apply to migrate.\n")
        await close_db()
        return 0

    if not rows:
        print("\n  Nothing to write.\n")
        await close_db()
        return 0

    # The backup goes to disk BEFORE the first write, and is read back and
    # verified, so "reversible" is a fact rather than an intention.
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"media-urls-{stamp}.json"
    backup.write_text(json.dumps({"written_at": stamp, "rows": rows}, indent=2))
    assert json.loads(backup.read_text())["rows"] == rows, "backup did not read back"
    print(f"\n  backup written and verified: {backup}")

    done = 0
    for r in rows:
        res = await db[r["collection"]].update_one(
            {"_id": ObjectId(r["id"]), r["field"]: r["old"]},
            {"$set": {r["field"]: r["new"]}},
        )
        done += res.modified_count
    print(f"  migrated {done} of {len(rows)} value(s)")
    print(f"  to undo:  venv/bin/python -m scripts.migrate_media_urls --restore {backup}\n")

    await close_db()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

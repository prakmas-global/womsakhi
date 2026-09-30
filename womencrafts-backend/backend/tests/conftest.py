"""
Shared setup for the backend test suite.

Two things have to be true before a single test module is imported.

**The package is not installed.** `app` is a directory in the repo root, not a
distribution, so the root has to be on `sys.path` before `import app.…`
resolves. Doing it here rather than in each module means a test file can be
run on its own (`pytest tests/test_schedule.py`) from any working directory.

**`Settings` refuses to build without a Mongo URI and a JWT secret.** Importing
anything under `app.engines` pulls in `app.core.config`, which instantiates
`Settings` at import time. The URI below is deliberately unroutable: these
tests never touch a database, and pointing the setting at a dummy makes that a
guarantee rather than a convention — a test that accidentally called
`connect_db()` would fail to connect instead of quietly writing to the real
Atlas cluster named in `.env`.
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Set, not setdefault: a real `.env` sits next to these tests and an env var
# takes precedence over it in pydantic-settings, which is what keeps the test
# process pointed away from the live cluster.
os.environ["MONGODB_URI"] = "mongodb://127.0.0.1:1/womencrafts_test_never_connected"
os.environ.setdefault("JWT_SECRET_KEY", "test-only-not-a-real-secret")
os.environ.setdefault("DB_NAME", "womencrafts_test")

import pytest  # noqa: E402


# Every test in this suite is a pure-function test. `requires_mongo` marks the
# ones that would need a live server, so they are skipped loudly rather than
# left unwritten and forgotten.
requires_mongo = pytest.mark.skip(
    reason="needs a live MongoDB: this path reads or writes a collection. "
           "Run it against a throwaway database once one is wired into CI."
)


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(autouse=True)
def _no_database_client():
    """
    A guard, not a mock.

    `get_database()` raises unless `connect_db()` ran first, so any test that
    strays into a DB path fails with that RuntimeError. This fixture asserts
    the client really is unset, so the guard cannot be defeated by an earlier
    test leaving a connection behind.
    """
    from app.db import mongodb

    assert mongodb._client is None, (
        "a test opened a MongoDB client; this suite must stay offline")
    yield


# ── the throwaway local mongod, for the few tests that need a real one ──────
#
# Never the URI from `.env`: that is the live cluster. These tests talk only to
# a mongod started by hand on 127.0.0.1:27099, and skip cleanly when it is not
# running, so the suite stays green (and offline) everywhere else.
LOCAL_MONGO_HOST = "127.0.0.1"
LOCAL_MONGO_PORT = 27099
LOCAL_MONGO_DB = "womsakhi_authtest"


def local_mongo_reachable() -> bool:
    import socket

    try:
        with socket.create_connection((LOCAL_MONGO_HOST, LOCAL_MONGO_PORT), timeout=0.3):
            return True
    except OSError:
        return False


@pytest.fixture
async def local_mongo():
    """A motor client on the local test mongod, or a skip."""
    if not local_mongo_reachable():
        pytest.skip(f"no local mongod on {LOCAL_MONGO_HOST}:{LOCAL_MONGO_PORT}")
    from motor.motor_asyncio import AsyncIOMotorClient

    client = AsyncIOMotorClient(
        f"mongodb://{LOCAL_MONGO_HOST}:{LOCAL_MONGO_PORT}", serverSelectionTimeoutMS=1500,
    )
    try:
        await client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001
        client.close()
        pytest.skip(f"local mongod did not answer: {exc}")
    yield client
    client.close()

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings
from app.db.instrument import Db

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """
    One client for the process, with the pool warmed before traffic arrives.

    Search sends fifteen queries at once. On the default settings the pool
    starts empty and opens connections on demand, so the first such request
    pays for a TLS handshake to Atlas — about 90ms — on every connection it
    needs beyond the first, and a search that should cost one round trip costs
    six. `minPoolSize` keeps connections standing so the fan-out is genuinely
    parallel rather than parallel-in-name.
    """
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        minPoolSize=12,
        maxPoolSize=100,
        # zlib only: zstd and snappy each need a native module this venv does
        # not have, and naming them made pymongo warn twice on every start.
        compressors="zlib",
        # Fail fast rather than hanging a request for half a minute.
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        retryWrites=True,
    )
    await _client.admin.command("ping")
    print("✅ Connected to MongoDB Atlas")


async def close_db() -> None:
    global _client, _db
    _db = None
    if _client is not None:
        _client.close()
        print("🔌 MongoDB connection closed")


_db: Db | None = None


def get_database() -> AsyncIOMotorDatabase:
    """
    The database handle every route uses.

    Returns an instrumented proxy rather than motor's own object, so that every
    query is counted in the context of the request that made it. The proxy
    forwards everything; the only thing it adds is a clock. Typed as the motor
    database because that is what it behaves as, and because typing it honestly
    would mean re-declaring motor's whole surface for no benefit.
    """
    global _db
    if _client is None:
        raise RuntimeError("Database client is not initialized. Call connect_db() first.")
    if _db is None:
        _db = Db(_client[settings.DB_NAME])
    return _db  # type: ignore[return-value]


def raw_database() -> AsyncIOMotorDatabase:
    """The uninstrumented handle, for startup work that is not a request."""
    if _client is None:
        raise RuntimeError("Database client is not initialized. Call connect_db() first.")
    return _client[settings.DB_NAME]

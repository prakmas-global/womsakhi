"""Password reset changes the credential field that sign-in actually reads."""

from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

from app.models.user import UserModel
from app.models.verification import EmailTokenModel
from app.routes import auth
from app.schemas.auth import ResetPasswordRequest


class _Collection:
    def __init__(self, found: dict):
        self.found = found
        self.updates: list[tuple[dict, dict]] = []

    async def find_one(self, _query: dict) -> dict:
        return self.found

    async def update_one(self, query: dict, update: dict) -> None:
        self.updates.append((query, update))


@pytest.mark.asyncio
async def test_reset_updates_hashed_password_used_by_signin(monkeypatch) -> None:
    user_id = ObjectId()
    token_id = ObjectId()
    user = {"_id": user_id, "email": "member@example.com", "hashed_password": "old-hash"}
    token = {
        "_id": token_id,
        "user_id": str(user_id),
        "token": "valid-reset-token",
        "purpose": EmailTokenModel.PURPOSE_RESET,
        "used_at": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    users = _Collection(user)
    tokens = _Collection(token)
    database = {
        UserModel.collection_name: users,
        EmailTokenModel.collection_name: tokens,
    }

    async def _noop(*_args, **_kwargs) -> None:
        return None

    async def _hash(_password: str) -> str:
        return "new-hash"

    monkeypatch.setattr(auth, "get_database", lambda: database)
    monkeypatch.setattr(auth.ratelimit, "check", _noop)
    monkeypatch.setattr(auth.ratelimit, "forget", _noop)
    monkeypatch.setattr(auth, "hash_password_async", _hash)

    result = await auth.reset_password(
        ResetPasswordRequest(token="valid-reset-token", password="new-password"),
        request=None,
    )

    credential_update = users.updates[0][1]
    assert credential_update["$set"]["hashed_password"] == "new-hash"
    assert "password" not in credential_update["$set"]
    assert credential_update["$inc"]["token_version"] == 1
    assert tokens.updates[0][1]["$set"]["used_at"] is not None
    assert result["message"] == "Your password has been changed. You can sign in with it now."

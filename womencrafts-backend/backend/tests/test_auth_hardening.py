"""Launch-critical authentication controls stay enforced."""

from bson import ObjectId
from pydantic import ValidationError
import pytest

from app.models.verification import EmailTokenModel
from app.routes import auth
from app.schemas.auth import ResetPasswordRequest, SignUpRequest


def test_email_tokens_are_stored_as_one_way_digests() -> None:
    document, raw_token = EmailTokenModel.create_document(
        str(ObjectId()), EmailTokenModel.PURPOSE_VERIFY
    )

    assert raw_token not in document.values()
    assert document["token"] == EmailTokenModel.digest(raw_token)
    query = EmailTokenModel.lookup(raw_token, EmailTokenModel.PURPOSE_VERIFY)
    assert query["token"]["$in"] == [document["token"], raw_token]


@pytest.mark.parametrize(
    "payload",
    [
        lambda password: SignUpRequest(
            full_name="Asha", email="asha@example.com", password=password
        ),
        lambda password: ResetPasswordRequest(token="token", password=password),
    ],
)
def test_new_passwords_cannot_cross_bcrypts_72_byte_boundary(payload) -> None:
    with pytest.raises(ValidationError, match="at most 72 bytes"):
        payload("श" * 25)  # 75 UTF-8 bytes, despite being only 25 characters.


class _Request:
    def __init__(self, token: str):
        self.cookies = {"access_token": token}


class _Users:
    def __init__(self, user: dict):
        self.user = user

    async def find_one(self, _query: dict) -> dict:
        return self.user


class _Database(dict):
    pass


@pytest.mark.asyncio
async def test_session_probe_rejects_a_revoked_token(monkeypatch) -> None:
    user_id = ObjectId()
    user = {
        "_id": user_id,
        "email": "member@example.com",
        "role": "Member",
        "is_active": True,
        "token_version": 2,
    }
    monkeypatch.setattr(
        auth,
        "decode_access_token",
        lambda _token: {"sub": str(user_id), "tv": 1},
    )
    monkeypatch.setattr(auth, "get_database", lambda: _Database(users=_Users(user)))

    assert await auth.session(_Request("revoked")) == {"user": None}

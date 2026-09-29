"""Launch-critical authentication controls stay enforced."""

from bson import ObjectId
from pydantic import ValidationError
import pytest

from app.models.verification import EmailTokenModel
from app.routes import auth


def test_email_tokens_are_stored_as_one_way_digests() -> None:
    document, raw_token = EmailTokenModel.create_document(
        str(ObjectId()), EmailTokenModel.PURPOSE_VERIFY
    )

    assert raw_token not in document.values()
    assert document["token"] == EmailTokenModel.digest(raw_token)
    query = EmailTokenModel.lookup(raw_token, EmailTokenModel.PURPOSE_VERIFY)
    assert query["token"]["$in"] == [document["token"], raw_token]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("98765 43210", "+919876543210"),
        ("+91 98765-43210", "+919876543210"),
        ("09876543210", "+919876543210"),
    ],
)
def test_mobile_numbers_are_stored_as_indian_e164(raw: str, expected: str) -> None:
    assert auth.normalise_phone(raw) == expected


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ("", "Enter your mobile number"),
        ("12345", "valid 10-digit"),
        ("+1 415 555 2671", "Only Indian mobile numbers"),
        ("+91 11 2345 6789", "not a landline"),
    ],
)
def test_mobile_numbers_outside_india_or_landlines_are_refused(raw: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        auth.normalise_phone(raw)


def test_signup_start_normalises_the_phone_it_is_given() -> None:
    payload = auth.SignupStart(email="asha@example.com", phone="98765 43210")
    assert payload.phone == "+919876543210"
    with pytest.raises(ValidationError):
        auth.SignupStart(email="asha@example.com", phone="+1 415 555 2671")


def test_signup_needs_a_real_name() -> None:
    assert auth.SignupComplete(ticket="t", full_name="  Asha   Devi ", is_woman_18_plus=True).full_name == "Asha Devi"
    with pytest.raises(ValidationError, match="full name"):
        auth.SignupComplete(ticket="t", full_name=" A ", is_woman_18_plus=True)


def test_signup_tickets_cannot_be_used_as_sessions_or_for_another_step() -> None:
    from app.core.security import decode_access_token

    ticket = auth._make_ticket("signup", 5, email="asha@example.com", phone="+919876543210")
    # Signed with a derived key: the session decoder does not accept it.
    assert decode_access_token(ticket) is None
    assert auth._read_ticket(ticket, "signup")["email"] == "asha@example.com"
    with pytest.raises(Exception):
        auth._read_ticket(ticket, "mfa")


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

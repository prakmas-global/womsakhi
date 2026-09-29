"""The development test-account door: fixed code for listed emails only."""
from app.core import codes
from app.core.config import settings


def _set(monkeypatch, emails, code):
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", emails)
    monkeypatch.setattr(settings, "TEST_LOGIN_CODE", code)


def test_listed_email_is_a_test_login(monkeypatch):
    _set(monkeypatch, "Member.Test@Example.com, admin.test@example.com", "482913")
    assert codes.is_test_login(codes.EMAIL, "member.test@example.com")
    assert codes.is_test_login(codes.EMAIL, "ADMIN.TEST@example.com")


def test_other_emails_and_phones_are_not(monkeypatch):
    _set(monkeypatch, "member.test@example.com", "482913")
    assert not codes.is_test_login(codes.EMAIL, "someone@example.com")
    assert not codes.is_test_login(codes.SMS, "member.test@example.com")


def test_door_shut_without_a_valid_code(monkeypatch):
    for bad in ("", "12345", "abcdef", "1234567"):
        _set(monkeypatch, "member.test@example.com", bad)
        assert not codes.is_test_login(codes.EMAIL, "member.test@example.com")


def test_door_shut_by_default():
    assert settings.test_login_emails == set() or settings.TEST_LOGIN_CODE

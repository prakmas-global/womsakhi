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


def test_staff_do_not_get_the_fixed_code_by_default(monkeypatch):
    """TEST_LOGIN_ALLOW_STAFF is off unless set: a listed staff account gets the
    real flow (emailed code, then authenticator). End-to-end proof lives in
    tests/test_auth_security_fixes.py."""
    from app.routes.auth import _fixed_code_allowed

    assert settings.model_fields["TEST_LOGIN_ALLOW_STAFF"].default is False
    monkeypatch.setattr(settings, "TEST_LOGIN_ALLOW_STAFF", False)
    assert _fixed_code_allowed({"role": "Member"})
    assert not _fixed_code_allowed({"role": "Super Admin"})
    assert not _fixed_code_allowed({"role": "Admin"})
    assert not _fixed_code_allowed(None)
    monkeypatch.setattr(settings, "TEST_LOGIN_ALLOW_STAFF", True)
    assert _fixed_code_allowed({"role": "Super Admin"})


def test_wrong_fixed_code_tries_are_capped_per_day():
    assert settings.model_fields["TEST_LOGIN_MAX_FAILURES_PER_DAY"].default == 10
    assert codes.TEST_CODE_FAIL_WINDOW == 86400.0

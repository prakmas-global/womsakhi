"""Email readiness follows the selected adapter, not stale credentials."""

from app.core import email


def test_forced_smtp_is_deliverable_even_with_mailgun_sandbox(monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "EMAIL_PROVIDER", "smtp")
    monkeypatch.setattr(email.settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(email.settings, "MAILGUN_API_KEY", "old-development-key")
    monkeypatch.setattr(email.settings, "MAILGUN_DOMAIN", "sandbox.example.mailgun.org")
    monkeypatch.setattr(email.settings, "EMAIL_TEST_MODE", False)

    assert email.get_provider().name == "smtp"
    assert email.can_deliver() is True


def test_file_adapter_is_not_deliverable(monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "EMAIL_PROVIDER", "file")
    monkeypatch.setattr(email.settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(email.settings, "MAILGUN_API_KEY", "old-development-key")
    monkeypatch.setattr(email.settings, "MAILGUN_DOMAIN", "sandbox.example.mailgun.org")

    assert email.get_provider().name == "file"
    assert email.can_deliver() is False

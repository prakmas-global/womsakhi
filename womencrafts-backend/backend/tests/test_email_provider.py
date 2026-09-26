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


def test_branded_template_has_logo_action_fallback_and_support_links(monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "APP_BASE_URL", "https://app.womsakhi.com")

    message = email.approved_email("Asha", "https://app.womsakhi.com/signin")

    assert 'src="https://app.womsakhi.com/womsakhi-email-logo.png"' in message.html
    assert message.html.count('href="https://app.womsakhi.com/signin"') == 2
    assert 'href="https://app.womsakhi.com/contact"' in message.html
    assert 'href="https://app.womsakhi.com/privacy"' in message.html
    assert "Your WomSakhi membership is approved and ready." in message.html


def test_template_escapes_member_supplied_content(monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "APP_BASE_URL", "https://app.womsakhi.com")

    message = email.rejected_email("<script>Asha</script>", "<img src=x onerror=alert(1)>")

    assert "<script>" not in message.html
    assert "<img src=x" not in message.html
    assert "&lt;script&gt;Asha&lt;/script&gt;" in message.html
    assert "&lt;img src=x onerror=alert(1)&gt;" in message.html

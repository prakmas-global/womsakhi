from datetime import datetime, timedelta, timezone

from app.core import email
from app.engines.verification_followups import _next_due


def test_review_followups_are_daily_then_slow_to_three_days() -> None:
    now = datetime(2026, 9, 27, 12, tzinfo=timezone.utc)
    assert _next_due(now, 1) == now + timedelta(days=1)
    assert _next_due(now, 2) == now + timedelta(days=1)
    assert _next_due(now, 3) == now + timedelta(days=3)
    assert _next_due(now, 8) == now + timedelta(days=3)


def test_review_alert_is_numbered_and_uses_authenticated_actions(monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "APP_BASE_URL", "https://app.womsakhi.com")
    message = email.verification_review_alert_email(
        "Admin", "Asha", "asha@example.com", "in_review", "member-123", 4,
    )
    assert "follow-up #4" in message.subject
    assert "Follow-up #4" in message.html
    assert "/dashboard/users/verification?account=member-123" in message.html
    assert "/dashboard/users/verification?account=member-123&assign=member-123" in message.html

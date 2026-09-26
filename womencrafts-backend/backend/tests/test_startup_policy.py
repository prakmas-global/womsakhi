"""Launch-critical startup policy checks."""

from app.core.config import Settings


BASE = {
    "MONGODB_URI": "mongodb://127.0.0.1:1/test",
    "JWT_SECRET_KEY": "test-secret",
}


def test_demo_seed_defaults_on_for_development() -> None:
    settings = Settings(**BASE, ENVIRONMENT="development")
    assert settings.DEMO_SEED_ENABLED is True
    assert settings.is_production is False
    assert settings.should_seed_demo_data is True


def test_production_identity_is_not_controlled_by_demo_seed_flag() -> None:
    settings = Settings(**BASE, ENVIRONMENT="production", DEMO_SEED_ENABLED=True)
    assert settings.is_production is True
    assert settings.DEMO_SEED_ENABLED is True
    assert settings.should_seed_demo_data is False


def test_production_rejects_simulated_ai() -> None:
    settings = Settings(**BASE, ENVIRONMENT="production", ANTHROPIC_API_KEY="")
    assert any("ANTHROPIC_API_KEY" in problem for problem in settings.unsafe_for_production())


def test_production_rejects_unknown_payment_adapter() -> None:
    settings = Settings(**BASE, ENVIRONMENT="production", PAYMENT_PROVIDER="made-up")
    assert any("no such adapter" in problem for problem in settings.unsafe_for_production())


def test_production_rejects_disabled_or_unreachable_automation() -> None:
    settings = Settings(**BASE, ENVIRONMENT="production", ENGINES_ENABLED=False, ENGINES_TICK_SECRET="")
    problems = settings.unsafe_for_production()
    assert any("ENGINES_ENABLED" in problem for problem in problems)
    assert any("ENGINES_TICK_SECRET" in problem for problem in problems)


def test_production_rejects_local_media_and_cors_origins() -> None:
    settings = Settings(**BASE, ENVIRONMENT="production", MEDIA_BASE_URL="http://localhost:8020", ALLOWED_ORIGINS="http://localhost:3100")
    problems = settings.unsafe_for_production()
    assert any("MEDIA_BASE_URL" in problem for problem in problems)
    assert any("ALLOWED_ORIGINS" in problem for problem in problems)


def test_demo_seed_can_be_disabled_locally() -> None:
    settings = Settings(**BASE, ENVIRONMENT="development", DEMO_SEED_ENABLED=False)
    assert settings.should_seed_demo_data is False

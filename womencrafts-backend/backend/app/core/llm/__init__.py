"""
Pick the supplier once, here.

A blank ANTHROPIC_API_KEY is supported for local development. Production
startup rejects it, so simulated assistant answers can never reach members.
"""

from functools import lru_cache

from app.core.config import settings
from app.core.llm.base import (  # re-exported so callers import from one place
    LlmProvider,
    Message,
    StreamEvent,
    ToolCall,
    ToolSpec,
    Turn,
    Usage,
)


@lru_cache()
def get_llm() -> LlmProvider:
    if settings.ANTHROPIC_API_KEY:
        from app.core.llm.claude import ClaudeProvider

        return ClaudeProvider()

    from app.core.llm.mock import MockProvider

    return MockProvider()


def provider_name() -> str:
    return get_llm().name


__all__ = [
    "get_llm",
    "provider_name",
    "LlmProvider",
    "Message",
    "StreamEvent",
    "ToolCall",
    "ToolSpec",
    "Turn",
    "Usage",
]

"""
Langfuse tracing — the window into what Sakhi actually did.

Without this, a conversation that went wrong is a mystery: you have her final
answer and nothing about how she got there. With it, every turn is a tree you
can open — the prompt she was given, the tools she called and what they
returned, how long each step took, and what it cost.

**It is optional, and its absence is silent.** No keys means every function here
becomes a no-op. Observability must never be the reason a woman cannot get an
answer — a tracing backend that is down, slow, or unpaid is not a reason to fail
her request. Every call is wrapped accordingly.

**What is deliberately NOT sent:** the safety gate's output. If a woman
disclosed abuse, that text is not going to a third-party dashboard to sit in a
trace forever. The trace records only that the gate fired and which category —
enough to know it works, nothing that identifies what she said.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Optional

_client = None
_checked = False


def _get():
    """The Langfuse client, or None. Built once, never raises."""
    global _client, _checked
    if _checked:
        return _client
    _checked = True

    from app.core.config import settings

    public = settings.LANGFUSE_PUBLIC_KEY
    secret = settings.LANGFUSE_SECRET_KEY
    if not (public and secret):
        return None
    try:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=public,
            secret_key=secret,
            host=settings.LANGFUSE_HOST,
            environment=settings.LANGFUSE_ENV,
        )
    except Exception:
        _client = None
    return _client


def enabled() -> bool:
    return _get() is not None


@contextmanager
def turn(*, name: str, user_id: str, session_id: str, metadata: Optional[dict] = None):
    """One conversational turn — the root of the trace tree.

    `session_id` is the conversation, so every turn in a conversation groups
    together in the dashboard the way it does in her app.
    """
    client = _get()
    if client is None:
        yield None
        return
    try:
        with client.start_as_current_observation(
            name=name, as_type="agent",
            metadata={**(metadata or {}), "user_id": user_id, "session_id": session_id},
        ) as span:
            yield span
    except Exception:
        yield None


@contextmanager
def generation(*, name: str, model: str, input_: Any = None):
    """One model call inside a turn."""
    client = _get()
    if client is None:
        yield None
        return
    try:
        with client.start_as_current_observation(
            name=name, as_type="generation", model=model, input=input_,
        ) as gen:
            yield gen
    except Exception:
        yield None


@contextmanager
def tool(*, name: str, input_: Any = None):
    """One tool call. Typed as a tool so the dashboard shows it as one."""
    client = _get()
    if client is None:
        yield None
        return
    try:
        with client.start_as_current_observation(
            name=name, as_type="tool", input=input_,
        ) as span:
            yield span
    except Exception:
        yield None


def finish(span, *, output: Any = None, usage: Optional[dict] = None,
           cost: Optional[float] = None, level: Optional[str] = None,
           message: str = "") -> None:
    """Close out an observation with what came back. Never raises."""
    if span is None:
        return
    try:
        payload: dict[str, Any] = {}
        if output is not None:
            payload["output"] = output
        if usage:
            payload["usage_details"] = usage
        if cost is not None:
            payload["cost_details"] = {"total": cost}
        if level:
            payload["level"] = level
        if message:
            payload["status_message"] = message
        if payload:
            span.update(**payload)
    except Exception:
        pass


def flush() -> None:
    client = _get()
    if client is None:
        return
    try:
        client.flush()
    except Exception:
        pass

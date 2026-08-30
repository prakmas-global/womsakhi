"""
The Anthropic adapter — the ONLY file in the backend that imports the SDK.

Named claude.py rather than anthropic.py on purpose: a module named after the
package it imports is a trap waiting for whoever refactors next.

Notes that cost real debugging elsewhere and are settled here:

* **Streaming is not optional.** Answers are read on phones over slow links,
  and a tool-using turn can take many seconds. Streaming also keeps us clear of
  the SDK's long-request guard.
* **The system prompt is cached.** It is long, identical on every turn, and
  billed at a tenth of the price on a hit. Caching is a *prefix* match, so the
  prompt must not contain a clock, a name, or anything else that varies — see
  build_system_prompt, which takes its variable parts as a first user message
  instead.
* **Tool inputs are parsed, never string-matched.** The SDK hands them back as
  a dict; that is what we use.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional

import anthropic

from app.core.config import settings
from app.core.llm.base import (
    LlmProvider,
    Message,
    StreamEvent,
    ToolCall,
    ToolSpec,
    Turn,
    Usage,
)


def _tools_payload(tools: Optional[list[ToolSpec]]) -> list[dict]:
    # Order is stable so the cached prefix stays valid between turns.
    return [
        {
            "name": t.name,
            "description": t.description,
            "input_schema": t.input_schema,
        }
        for t in (tools or [])
    ]


def _messages_payload(messages: list[Message]) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in messages]


def _plain(blocks) -> list[dict]:
    """SDK block objects → plain dicts.

    Everything above this file stores turns in Mongo and replays them on the
    next request, and neither of those can be done with pydantic objects. Doing
    the conversion here keeps it the adapter's problem, which is where it
    belongs.
    """
    out = []
    for block in blocks or []:
        if isinstance(block, dict):
            out.append(block)
        elif hasattr(block, "model_dump"):
            out.append(block.model_dump(exclude_none=True))
    return out


def _usage_from(raw) -> Usage:
    if raw is None:
        return Usage()
    return Usage(
        input_tokens=getattr(raw, "input_tokens", 0) or 0,
        output_tokens=getattr(raw, "output_tokens", 0) or 0,
        cache_read_tokens=getattr(raw, "cache_read_input_tokens", 0) or 0,
        cache_write_tokens=getattr(raw, "cache_creation_input_tokens", 0) or 0,
    )


class ClaudeProvider(LlmProvider):
    name = "anthropic"

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    def _system_blocks(self, system: str) -> list[dict]:
        # An hour, not the default five minutes.
        #
        # Caching is a prefix match over tools → system → messages, and the
        # prefix here is large and static: nineteen tool schemas plus a system
        # prompt deliberately kept byte-identical. It should almost always be a
        # cache hit. It was hitting 16%.
        #
        # The reason is the default five-minute TTL. Women use Sakhi the way
        # anyone uses a helper — a question now, another this evening — so the
        # cache had usually expired before the next turn arrived and the whole
        # prefix was paid for again at full price. An hour matches how the
        # product is actually used rather than how a chat demo is.
        return [{
            "type": "text",
            "text": system,
            "cache_control": {"type": "ephemeral", "ttl": "1h"},
        }]

    async def astream(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: Optional[list[ToolSpec]] = None,
        model: str = "",
        max_tokens: int = 1024,
    ) -> AsyncIterator[StreamEvent]:
        model = model or settings.AI_MODEL_REASONING
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "system": self._system_blocks(system),
            "messages": _messages_payload(messages),
        }
        payload = _tools_payload(tools)
        if payload:
            kwargs["tools"] = payload

        async with self._client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if (
                    event.type == "content_block_delta"
                    and getattr(event.delta, "type", "") == "text_delta"
                ):
                    yield {"type": "text", "text": event.delta.text}

            final = await stream.get_final_message()

        calls = [
            ToolCall(id=b.id, name=b.name, input=dict(b.input or {}))
            for b in final.content
            if b.type == "tool_use"
        ]
        text = "".join(b.text for b in final.content if b.type == "text")

        for call in calls:
            yield {"type": "tool", "call": call}

        yield {
            "type": "turn",
            "turn": Turn(
                stop_reason=final.stop_reason or "",
                text=text,
                tool_calls=calls,
                raw_content=_plain(final.content),
                usage=_usage_from(final.usage),
                model=model,
            ),
        }

    async def complete(
        self,
        *,
        system: str,
        messages: list[Message],
        model: str = "",
        max_tokens: int = 512,
    ) -> Turn:
        model = model or settings.AI_MODEL_ROUTING
        response = await self._client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=_messages_payload(messages),
        )
        text = "".join(b.text for b in response.content if b.type == "text")
        return Turn(
            stop_reason=response.stop_reason or "",
            text=text,
            raw_content=_plain(response.content),
            usage=_usage_from(response.usage),
            model=model,
        )

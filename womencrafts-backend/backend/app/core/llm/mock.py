"""
A provider that needs no key, no network and no money.

It exists so that: the app boots and every screen works when ANTHROPIC_API_KEY
is blank; the test suite can drive the whole conversation loop — including a
tool call and its confirmation — deterministically and for free; and a
contributor without a key can still run WomSakhi end to end.

It is not pretending to be clever. It answers from a handful of rules and says
so. The one behaviour it reproduces faithfully is the SHAPE of a real turn:
text streams in fragments, a tool call arrives as a call, and the turn ends
with a Turn object. That shape is what the engine above it is written against.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional

from app.core.llm.base import (
    LlmProvider,
    Message,
    StreamEvent,
    ToolCall,
    ToolSpec,
    Turn,
    Usage,
)

_PREFIX = "[demo mode] "

_RULES: list[tuple[tuple[str, ...], str]] = [
    (("book", "appointment", "session", "slot"),
     "I can help you book a session. Tell me which service you want and I'll "
     "show you the times that are open."),
    (("cancel",),
     "I can cancel a booking for you. Which one did you mean?"),
    (("programme", "program", "course", "learn", "training"),
     "There are programmes you can join. Say the kind of work you want to do "
     "and I'll find the closest match."),
    (("money", "pay", "fee", "cost", "price"),
     "Anything personal in WomSakhi is free. If something does have a fee, it "
     "is shown before you confirm, never after."),
]


def _last_user_text(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role != "user":
            continue
        if isinstance(message.content, str):
            return message.content.lower()
        if isinstance(message.content, list):
            parts = [
                b.get("text", "")
                for b in message.content
                if isinstance(b, dict) and b.get("type") == "text"
            ]
            if parts:
                return " ".join(parts).lower()
    return ""


def _answer_for(text: str) -> str:
    for keywords, reply in _RULES:
        if any(word in text for word in keywords):
            return reply
    return (
        "I'm running without a model key, so I can only give you set answers. "
        "Everything else in the app works normally — you can use the screens as "
        "usual."
    )


class MockProvider(LlmProvider):
    name = "mock"

    async def astream(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: Optional[list[ToolSpec]] = None,
        model: str = "",
        max_tokens: int = 1024,
    ) -> AsyncIterator[StreamEvent]:
        asked = _last_user_text(messages)

        # A single read-only tool call when the question is clearly about her
        # own records — enough to exercise the loop end to end.
        wants_lookup = any(w in asked for w in ("my booking", "my sessions", "what do i have"))
        available = {t.name: t for t in (tools or [])}
        if wants_lookup and "list_my_bookings" in available:
            call = ToolCall(id="mock_call_1", name="list_my_bookings", input={"which": "upcoming"})
            yield {"type": "tool", "call": call}
            yield {
                "type": "turn",
                "turn": Turn(
                    stop_reason="tool_use",
                    text="",
                    tool_calls=[call],
                    raw_content=[{
                        "type": "tool_use",
                        "id": call.id,
                        "name": call.name,
                        "input": call.input,
                    }],
                    usage=Usage(input_tokens=12, output_tokens=8),
                    model="mock",
                ),
            }
            return

        answer = _PREFIX + _answer_for(asked)
        for word in answer.split(" "):
            yield {"type": "text", "text": word + " "}

        yield {
            "type": "turn",
            "turn": Turn(
                stop_reason="end_turn",
                text=answer,
                tool_calls=[],
                raw_content=[{"type": "text", "text": answer}],
                usage=Usage(input_tokens=12, output_tokens=len(answer.split())),
                model="mock",
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
        answer = _PREFIX + _answer_for(_last_user_text(messages))
        return Turn(
            stop_reason="end_turn",
            text=answer,
            raw_content=[{"type": "text", "text": answer}],
            usage=Usage(input_tokens=8, output_tokens=len(answer.split())),
            model="mock",
        )

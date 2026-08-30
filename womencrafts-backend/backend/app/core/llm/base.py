"""
The port between Sakhi and whichever model is answering her.

Everything above this file talks in the small vocabulary defined here — a list
of messages, a list of tools, and a stream of events. Nothing above it imports
the Anthropic SDK, mentions a model id, or knows what a "content block" is.
That is the whole point: the assistant is the product, the model is a supplier,
and suppliers get replaced.

The stream is deliberately event-based rather than "give me the finished
answer". A woman waiting on a slow phone should see words appear as they are
written, and the caller needs to see a tool call the moment it is requested so
it can stop and ask her before anything is changed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Literal, Optional


# --- what goes in ------------------------------------------------------------

@dataclass
class ToolSpec:
    """One thing Sakhi is allowed to do.

    `writes` is the important field. A read is safe to run the moment the model
    asks for it; a write changes her records and must be confirmed by her first.
    That distinction lives here, in data, and not in the wording of a prompt —
    see app/core/sakhi/tools.py.
    """
    name: str
    description: str
    input_schema: dict
    writes: bool = False
    confirm_template: str = ""      # how we describe the action back to her


@dataclass
class Message:
    """One turn. `content` is either plain text or a list of raw blocks.

    Raw blocks exist so an assistant turn containing tool calls can be replayed
    to the model verbatim on the next request — the API requires the tool_use
    block it produced to come back unchanged, alongside its result.
    """
    role: Literal["user", "assistant"]
    content: Any


# --- what comes out ----------------------------------------------------------

@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class Turn:
    """The end of one model turn: everything it said, and why it stopped."""
    stop_reason: str = ""
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_content: Any = None          # replayed verbatim on the next request
    usage: Usage = field(default_factory=Usage)
    model: str = ""


# Stream events. Small on purpose — the route turns these straight into SSE.
#   {"type": "text",      "text": "..."}          a fragment of her answer
#   {"type": "tool",      "call": ToolCall}       the model wants to act
#   {"type": "turn",      "turn": Turn}           this turn is complete
StreamEvent = dict


class LlmProvider:
    """Implemented once per supplier. Two methods, both async."""

    name: str = "base"

    async def astream(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: Optional[list[ToolSpec]] = None,
        model: str = "",
        max_tokens: int = 1024,
    ) -> AsyncIterator[StreamEvent]:
        raise NotImplementedError

    async def complete(
        self,
        *,
        system: str,
        messages: list[Message],
        model: str = "",
        max_tokens: int = 512,
    ) -> Turn:
        """Non-streaming, for short internal jobs (classify, title, summarise)."""
        raise NotImplementedError

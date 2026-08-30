"""
The loop: her words in, tool calls run, answer streamed back out.

Order matters here, and it is not negotiable:

    safety gate  ->  budget check  ->  model  ->  tools  ->  answer

The safety gate runs before anything is spent or sent, because a woman in
danger should not wait on an API call. The budget check runs before the model,
because the point of a ceiling is to stop the request, not to regret it.

**The confirm gate is the reason this is a state machine and not a for-loop.**
When the model asks for a tool marked `writes=True`, the loop STOPS mid-turn.
The pending call is written to the conversation, the stream ends with a
`confirm` event, and nothing has changed in the database. Her yes arrives as a
separate HTTP request, which resumes the loop from exactly that point. That
round trip through a person is the whole design — it cannot be skipped by a
cleverly-worded message, because there is no code path from "model asked" to
"database changed" that does not pass through a second request carrying her
decision.

Reads are not gated. Waiting on a confirmation to look something up would make
her tap yes so often that the yes stops meaning anything.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from bson import ObjectId

from app.core.config import settings
from app.core.llm import Message, get_llm
from app.core.llm.usage import budget_state, cost_usd, record
from app.core.plaintext import strip_markdown
from app.core.sakhi import memory, safety, staff_tools, tools as tool_registry, tracing
from app.core.sakhi.prompt import context_message, system_for
from app.models.sakhi import ConversationModel, SakhiMessageModel

# A turn that keeps calling tools is either working or looping. Six is well
# past any real answer and well short of a runaway bill.
MAX_TOOL_ROUNDS = 6


def _recent_transcript(history: list[Message], answer: str) -> str:
    """The last few plain-text turns, for the memory extractor.

    Tool calls and their results are left out: they are plumbing, and feeding
    them in produced "facts" about what the assistant did rather than about her.
    """
    lines = []
    for message in history[-6:]:
        if isinstance(message.content, str) and message.content.strip():
            lines.append(f"{message.role}: {message.content.strip()}")
    if answer.strip():
        lines.append(f"assistant: {answer.strip()}")
    return "\n".join(lines)


def _is_write(tool_name: str, available=None) -> bool:
    """An unknown tool is treated as a write. If the model ever names something
    that is not in the registry, the safe reading is 'this might change data'."""
    tool = tool_registry.find(tool_name, available)
    return True if tool is None else tool.writes


def _conversations(db):
    return db[ConversationModel.collection_name]


def _messages(db):
    return db[SakhiMessageModel.collection_name]


async def _save(db, conversation_id: str, user_id: str, **kwargs) -> dict:
    doc = SakhiMessageModel.create_document(
        conversation_id=conversation_id, user_id=user_id, **kwargs
    )
    result = await _messages(db).insert_one(doc)
    doc["_id"] = result.inserted_id
    await _conversations(db).update_one(
        {"_id": ObjectId(conversation_id)},
        {"$inc": {"message_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return doc


async def _history(db, conversation_id: str) -> list[Message]:
    """Rebuild the exact message list the API expects."""
    cursor = _messages(db).find(
        {
            "conversation_id": conversation_id,
            "kind": {"$in": SakhiMessageModel.REPLAYED},
        }
    ).sort("created_at", 1)
    return [Message(role=doc["role"], content=doc["content"]) async for doc in cursor]


async def _title_from(db, conversation_id: str, text: str) -> None:
    """Name the conversation after her first line, trimmed. No model call —
    a title is not worth a request, and her own words are the best label."""
    convo = await _conversations(db).find_one({"_id": ObjectId(conversation_id)})
    if not convo or convo.get("title") not in ("", "New conversation", None):
        return
    title = " ".join((text or "").split())[:60] or "New conversation"
    await _conversations(db).update_one(
        {"_id": ObjectId(conversation_id)}, {"$set": {"title": title}}
    )


async def ensure_conversation(
    db, *, user_id: str, conversation_id: Optional[str], audience: str, locale: str
) -> dict:
    if conversation_id:
        convo = await _conversations(db).find_one(
            {"_id": ObjectId(conversation_id), "user_id": user_id}
        )
        if convo:
            return convo
    doc = ConversationModel.create_document(
        user_id=user_id, audience=audience, locale=locale
    )
    result = await _conversations(db).insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


# --- the stream --------------------------------------------------------------

async def respond(
    db,
    *,
    me: dict,
    convo: dict,
    text: str,
    audience: str = "member",
) -> AsyncIterator[dict]:
    """Handle one message from her. Yields events; see routes/sakhi.py for the
    wire format."""
    user_id = str(me["_id"])
    conversation_id = str(convo["_id"])

    # The root span stays open for the WHOLE turn, so every model call, tool and
    # confirmation nests under one tree in the dashboard. Entered manually
    # rather than with `with`, because this is an async generator: a client that
    # disconnects mid-answer must still close the span, and `finally` is the
    # only thing that runs on GeneratorExit.
    root_cm = tracing.turn(
        name=f"sakhi.{audience}",
        user_id=user_id,
        session_id=conversation_id,
        metadata={"locale": convo.get("locale", "en")},
    )
    root = root_cm.__enter__()
    try:
        async for event in _respond_inner(
            db, me=me, convo=convo, text=text, audience=audience,
            user_id=user_id, conversation_id=conversation_id, root=root,
        ):
            yield event
    finally:
        tracing.finish(root, output={"completed": True})
        root_cm.__exit__(None, None, None)
        tracing.flush()


async def _respond_inner(
    db, *, me: dict, convo: dict, text: str, audience: str,
    user_id: str, conversation_id: str, root,
) -> AsyncIterator[dict]:
    # 1. Safety, before anything else — and before any spend.
    verdict = safety.screen(text)
    await _save(
        db, conversation_id, user_id,
        kind=SakhiMessageModel.KIND_USER, role="user", content=text, text=text,
    )
    await _title_from(db, conversation_id, text)

    if verdict:
        await _save(
            db, conversation_id, user_id,
            kind=SakhiMessageModel.KIND_SAFETY, role="assistant",
            content=verdict.message, text=verdict.message,
            meta={"category": verdict.category, "helplines": verdict.helplines},
        )
        # Only the category reaches the dashboard. What she wrote in a crisis is
        # not going to a third-party trace to sit there forever.
        with tracing.tool(name="safety.gate", input_={"fired": True}) as span:
            tracing.finish(span, output={"category": verdict.category},
                           level="WARNING", message="distress routed to a human")
        tracing.flush()
        yield {"type": "safety", "category": verdict.category,
               "text": verdict.message, "helplines": verdict.helplines}
        yield {"type": "done", "conversation_id": conversation_id}
        return

    # 2. The ceiling.
    state = await budget_state(db)
    if state["exhausted"]:
        message = (
            "I've reached my limit for this month, so I can't answer right now. "
            "Everything in the app still works normally, and you can message the "
            "team from Messages."
        )
        await _save(
            db, conversation_id, user_id,
            kind=SakhiMessageModel.KIND_ASSISTANT, role="assistant",
            content=message, text=message, meta={"reason": "budget"},
        )
        yield {"type": "text", "text": message}
        yield {"type": "done", "conversation_id": conversation_id}
        return

    async for event in _run_loop(db, me=me, convo=convo, audience=audience):
        yield event


async def _run_loop(db, *, me: dict, convo: dict, audience: str) -> AsyncIterator[dict]:
    """Model -> tools -> model, until it answers or asks to change something."""
    llm = get_llm()
    user_id = str(me["_id"])
    conversation_id = str(convo["_id"])
    # The tool set follows the audience. A staff conversation must never be
    # handed the member tools: those scope by ownership and would answer about
    # the STAFF member's own bookings, which is not what she asked.
    # Staff analysis reasons over aggregates and is low volume; a member asking
    # what she has booked is a lookup and is high volume. They do not need the
    # same model, and pretending they do is where the bill comes from.
    model = settings.AI_MODEL_REASONING if audience == "staff" else settings.AI_MODEL_CHAT

    available = (
        staff_tools.staff_tools() if audience == "staff" else tool_registry.member_tools()
    )
    specs = tool_registry.specs(available)

    for _round in range(MAX_TOOL_ROUNDS):
        history = await _history(db, conversation_id)
        if not history:
            break

        # The varying context rides as a first user turn so the cached system
        # prompt stays byte-identical. See prompt.py.
        remembered = [m["fact"] for m in await memory.recall(db, user_id)]
        primed = [
            Message(role="user", content=context_message(
                name=me.get("full_name", "").split(" ")[0] if me.get("full_name") else "",
                locale=convo.get("locale", "en"),
                today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                memories=remembered,
                intake=((me.get("ai_context") or {}).get("last_intake_text") or "")[:300],
            )),
            Message(role="assistant", content="Understood."),
            *history,
        ]

        turn = None
        gen_span_cm = tracing.generation(
            name="sakhi.answer",
            model=model,
            input_={"messages": len(primed), "tools": len(specs)},
        )
        gen_span = gen_span_cm.__enter__()
        async for event in llm.astream(
            system=system_for(audience),
            messages=primed,
            tools=specs,
            model=model,
            max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
        ):
            if event["type"] == "text":
                yield {"type": "text", "text": event["text"]}
            elif event["type"] == "turn":
                turn = event["turn"]

        tracing.finish(
            gen_span,
            output=(turn.text[:2000] if turn else ""),
            usage={"input": turn.usage.input_tokens, "output": turn.usage.output_tokens,
                   "cache_read": turn.usage.cache_read_tokens} if turn else None,
            cost=cost_usd(turn.model, turn.usage) if turn else None,
        )
        gen_span_cm.__exit__(None, None, None)

        if turn is None:
            break

        await record(db, user_id=user_id, model=turn.model, usage=turn.usage, surface=audience)

        # Store the assistant turn verbatim — tool_use blocks and all.
        #
        # Except the plain text, which is stripped of Markdown first. The model
        # is asked not to write asterisks and, on this model, does anyway when
        # it is quoting a guide that uses them. The live surfaces already handle
        # it — the browser strips each sentence before showing it, the voice
        # before speaking it — but what is SAVED is what she sees when she opens
        # the conversation again, and stars would be sitting in it.
        #
        # `raw_content` is left exactly as it came: it is replayed back to the
        # model as conversation history, and rewriting a model's own turn before
        # feeding it back is how you teach it that it said something it did not.
        await _save(
            db, conversation_id, user_id,
            kind=SakhiMessageModel.KIND_ASSISTANT, role="assistant",
            content=turn.raw_content, text=strip_markdown(turn.text),
        )

        if turn.stop_reason != "tool_use" or not turn.tool_calls:
            # Learn from the exchange AFTER her answer is on screen. She never
            # waits for this, and a failure in it is silent — see memory.py.
            asyncio.create_task(memory.learn_from(
                db, user_id=user_id, conversation_id=conversation_id,
                transcript=_recent_transcript(history, turn.text),
            ))
            yield {"type": "done", "conversation_id": conversation_id}
            return

        # A write anywhere in this turn stops everything. Running the reads and
        # holding the write back would leave her approving one half of an
        # action whose other half already happened.
        writes = [c for c in turn.tool_calls if _is_write(c.name, available)]
        if writes:
            call = writes[0]
            sentence = await tool_registry.describe(call.name, call.input, me)
            pending = {
                "id": call.id,
                "tool": call.name,
                "args": call.input,
                "sentence": sentence,
                "asked_at": datetime.now(timezone.utc),
            }
            await _conversations(db).update_one(
                {"_id": ObjectId(conversation_id)}, {"$set": {"pending_action": pending}}
            )
            with tracing.tool(name=f"confirm:{call.name}", input_=call.input) as cspan:
                tracing.finish(cspan, output={"asked": sentence})
            tracing.flush()
            yield {
                "type": "confirm",
                "action_id": call.id,
                "tool": call.name,
                "sentence": sentence,
                "conversation_id": conversation_id,
            }
            return

        # Reads: run them all and feed every result back in one user turn.
        results = []
        for call in turn.tool_calls:
            yield {"type": "tool", "name": call.name}
            with tracing.tool(name=call.name, input_=call.input) as tspan:
                output = await tool_registry.run(call.name, call.input, me, available)
                tracing.finish(
                    tspan, output=output,
                    level="ERROR" if output.get("error") else None,
                    message=str(output.get("error", ""))[:200],
                )
            results.append({
                "type": "tool_result",
                "tool_use_id": call.id,
                "content": json.dumps(output, default=str),
            })
        await _save(
            db, conversation_id, user_id,
            kind=SakhiMessageModel.KIND_TOOL_RESULT, role="user",
            content=results, text="",
            meta={"tools": [c.name for c in turn.tool_calls]},
        )

    yield {"type": "done", "conversation_id": conversation_id}


# --- her answer to a confirmation -------------------------------------------

async def resolve(
    db, *, me: dict, convo: dict, action_id: str, approve: bool, audience: str = "member"
) -> AsyncIterator[dict]:
    """Run the pending write, or decline it, then let the model close the loop.

    The pending action is read from the CONVERSATION, never from the request —
    the request carries only an id and a yes/no. What runs is what was shown to
    her, not what a caller says was shown to her.
    """
    user_id = str(me["_id"])
    conversation_id = str(convo["_id"])
    pending = convo.get("pending_action")

    if not pending or pending.get("id") != action_id:
        yield {"type": "error", "message": "That action is no longer waiting."}
        yield {"type": "done", "conversation_id": conversation_id}
        return

    # Clear it first. A second click, a retry or a double-submit then finds
    # nothing pending instead of running the write twice.
    await _conversations(db).update_one(
        {"_id": ObjectId(conversation_id)}, {"$set": {"pending_action": None}}
    )

    if approve:
        output = await tool_registry.run(pending["tool"], pending.get("args") or {}, me)
        ok = not output.get("error")
        readable = pending.get("sentence") or pending["tool"]
        text = f"Done — {readable[:-1].lower()}." if ok else f"That didn't work: {output['error']}"
    else:
        output = {"declined": True}
        ok = True
        text = "No problem — I've left it as it was."

    await _save(
        db, conversation_id, user_id,
        kind=SakhiMessageModel.KIND_TOOL_RESULT, role="user",
        content=[{
            "type": "tool_result",
            "tool_use_id": action_id,
            "content": json.dumps(output, default=str),
            **({"is_error": True} if not ok else {}),
        }],
        text="",
        meta={"tool": pending["tool"], "approved": approve},
    )
    await _save(
        db, conversation_id, user_id,
        kind=SakhiMessageModel.KIND_ACTION, role="assistant",
        content=text, text=text,
        meta={"tool": pending["tool"], "approved": approve, "ok": ok},
    )

    # The tool name travels with the result so the app can refresh exactly what
    # changed. Without it the screen she is looking at keeps showing the booking
    # she just cancelled until she reloads the page by hand — the write lands in
    # the database and nothing on screen says so.
    yield {"type": "action", "approved": approve, "ok": ok, "text": text,
           "tool": pending["tool"],
           "result": {k: v for k, v in output.items() if k != "error"} or None}
    yield {"type": "done", "conversation_id": conversation_id}

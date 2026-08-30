"""
Sakhi's HTTP surface.

Answers stream as Server-Sent Events. SSE rather than a WebSocket because the
traffic is one-directional once a message is sent, it survives proxies that
mangle upgrades, and it reconnects on its own — on a phone drifting between
towers, that last one is not a small thing.

Every endpoint is guarded by `require_active_member`, so the caller is a real,
admitted member before a single line here runs. Nothing in this file accepts a
user id.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.llm import provider_name
from app.core.llm.usage import budget_state
from app.core.rbac import require_active_member, require_staff
from app.core.sakhi import engine, memory
from app.core import voice as voice_service
from app.db.mongodb import get_database
from app.models.sakhi import ConversationModel, SakhiMessageModel
from app.schemas.sakhi import (
    ChatRequest,
    ConfirmRequest,
    Conversation,
    ConversationDetail,
    MessageResponse,
    SakhiMessage,
    SakhiMemory,
    SakhiStatus,
    SpeakRequest,
    SpeechResponse,
)

router = APIRouter(prefix="/sakhi", tags=["Sakhi"])

DISCLOSURE = "Sakhi is an assistant, not a person. She can be wrong — check anything important."


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


async def _stream(source: AsyncIterator[dict]) -> AsyncIterator[str]:
    """Turn engine events into SSE frames.

    A failure mid-answer is sent down the open stream as an `error` event rather
    than raised: the response has already started, so there is no status code
    left to change, and a silent cut-off looks like the app broke.
    """
    try:
        async for event in source:
            yield _sse(event)
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "error", "message": f"Something went wrong: {exc}"})
        yield _sse({"type": "done"})


_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",     # nginx would otherwise hold the whole answer
}


@router.get("/status", response_model=SakhiStatus, summary="Is Sakhi available")
async def sakhi_status(me: dict = Depends(require_active_member)):
    state = await budget_state(get_database())
    return SakhiStatus(
        enabled=not state["exhausted"],
        provider=provider_name(),
        voice=voice_service.available(),
        budget={"exhausted": state["exhausted"]},
        disclosure=DISCLOSURE,
    )


@router.post("/chat", summary="Say something to Sakhi (streams)")
async def chat(payload: ChatRequest, me: dict = Depends(require_active_member)):
    db = get_database()
    convo = await engine.ensure_conversation(
        db,
        user_id=str(me["_id"]),
        conversation_id=payload.conversation_id,
        audience=ConversationModel.AUDIENCE_MEMBER,
        locale=me.get("locale", "en"),
    )
    if convo.get("pending_action"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "There's something waiting for your yes or no first.",
        )
    return StreamingResponse(
        _stream(engine.respond(db, me=me, convo=convo, text=payload.text)),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/confirm", summary="Approve or decline a pending action (streams)")
async def confirm(payload: ConfirmRequest, me: dict = Depends(require_active_member)):
    db = get_database()
    convo = await db[ConversationModel.collection_name].find_one(
        {"_id": ObjectId(payload.conversation_id), "user_id": str(me["_id"])}
    )
    if not convo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return StreamingResponse(
        _stream(engine.resolve(
            db, me=me, convo=convo,
            action_id=payload.action_id, approve=payload.approve,
        )),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/staff/chat", summary="Ask Sakhi, as staff (streams)")
async def staff_chat(payload: ChatRequest, me: dict = Depends(require_staff)):
    """The same engine, a different tool set and a different prompt.

    Separate from /chat rather than a flag on it: the guard is the difference
    that matters, and a single endpoint deciding its own audience from the
    caller's role is one refactor away from deciding it wrong.
    """
    db = get_database()
    convo = await engine.ensure_conversation(
        db,
        user_id=str(me["_id"]),
        conversation_id=payload.conversation_id,
        audience=ConversationModel.AUDIENCE_STAFF,
        locale=me.get("locale", "en"),
    )
    if convo.get("pending_action"):
        raise HTTPException(status.HTTP_409_CONFLICT, "There's something waiting on your answer first.")
    return StreamingResponse(
        _stream(engine.respond(db, me=me, convo=convo, text=payload.text, audience="staff")),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.get("/conversations", response_model=list[Conversation], summary="My conversations")
async def conversations(me: dict = Depends(require_active_member)):
    cursor = get_database()[ConversationModel.collection_name].find(
        {"user_id": str(me["_id"])}
    ).sort("updated_at", -1).limit(50)
    return [Conversation(**ConversationModel.to_response(doc)) async for doc in cursor]


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetail,
    summary="One conversation, with its messages",
)
async def conversation_detail(conversation_id: str, me: dict = Depends(require_active_member)):
    db = get_database()
    convo = await db[ConversationModel.collection_name].find_one(
        {"_id": ObjectId(conversation_id), "user_id": str(me["_id"])}
    )
    if not convo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    cursor = db[SakhiMessageModel.collection_name].find({
        "conversation_id": conversation_id,
        "kind": {"$in": SakhiMessageModel.VISIBLE},
    }).sort("created_at", 1)

    return ConversationDetail(
        **ConversationModel.to_response(convo),
        messages=[SakhiMessage(**SakhiMessageModel.to_response(d)) async for d in cursor],
    )


@router.delete(
    "/conversations/{conversation_id}",
    response_model=MessageResponse,
    summary="Delete a conversation",
)
async def delete_conversation(conversation_id: str, me: dict = Depends(require_active_member)):
    """Really deletes. A conversation with an assistant is personal data, and
    'archived' is not what she means when she asks for it to be gone."""
    db = get_database()
    result = await db[ConversationModel.collection_name].delete_one(
        {"_id": ObjectId(conversation_id), "user_id": str(me["_id"])}
    )
    if not result.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    await db[SakhiMessageModel.collection_name].delete_many({
        "conversation_id": conversation_id,
        "user_id": str(me["_id"]),
    })
    return MessageResponse(message="Deleted")


# --- what she has told Sakhi before -----------------------------------------

@router.get("/memory", response_model=list[SakhiMemory], summary="What Sakhi remembers about me")
async def my_memory(me: dict = Depends(require_active_member)):
    """Everything Sakhi has kept, in her own words.

    Listed in full rather than summarised. Memory a person cannot inspect is
    surveillance however good the intent, so this is the whole store — and the
    delete below really deletes.
    """
    rows = await memory.recall(get_database(), str(me["_id"]))
    return [SakhiMemory(**r) for r in rows]


@router.delete("/memory/{memory_id}", response_model=MessageResponse, summary="Forget one thing")
async def forget_one(memory_id: str, me: dict = Depends(require_active_member)):
    removed = await memory.forget(get_database(), str(me["_id"]), memory_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return MessageResponse(message="Forgotten")


@router.delete("/memory", response_model=MessageResponse, summary="Forget everything")
async def forget_all(me: dict = Depends(require_active_member)):
    removed = await memory.forget(get_database(), str(me["_id"]))
    return MessageResponse(message=f"Forgot {removed} thing(s)")


# --- her voice ---------------------------------------------------------------

@router.post("/speak", response_model=SpeechResponse, summary="Say this out loud, with mouth shapes")
async def speak(payload: SpeakRequest, me: dict = Depends(require_active_member)):
    """Synthesise one line and return the audio together with its mouth track.

    Separate from /chat rather than folded into it: she should be able to read
    an answer silently and press play afterwards, and a woman on a metered
    connection should not be made to download audio she never asked to hear.
    """
    if not voice_service.available():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Her voice isn't set up on this installation.",
        )
    # HER ACCOUNT DECIDES, not the browser.
    #
    # The language of the words is chosen from `me["locale"]` when the model
    # writes them. If the voice were allowed to come from somewhere else, the
    # two could disagree — and they did: a tab left open from before she
    # switched, or a switch made on another device, sends a stale locale, and
    # she reads Telugu while hearing English.
    #
    # There is no version of "speak this in a language other than the one it is
    # written in" that is useful to her, so the client's value is a fallback for
    # accounts with nothing set, never an override.
    locale = me.get("locale") or payload.locale or "en"
    try:
        result = await voice_service.speak(payload.text, locale)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Could not speak: {exc}")
    return SpeechResponse(
        audio=result.audio_b64,
        mime=result.mime,
        duration_ms=result.duration_ms,
        mouth=result.mouth,
        voice=voice_service.voice_for(locale),
    )

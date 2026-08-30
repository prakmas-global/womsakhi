"""
Everything Sakhi is allowed to do, and nothing else.

Two rules hold this file together.

**Permission lives below the model, never in the prompt.** No tool takes a user
id, a member id or a "whose" argument. Every handler is handed the caller's own
account — resolved from her session cookie long before any of this runs — and
filters by it. A model that decides to be helpful and pass someone else's id has
nowhere to put it. This mirrors the rule the whole /me router is built on
([[ADR-007 Ownership comes from the token]]); the difference is only that the
caller is now a model instead of a screen.

**The write tools call the real endpoint functions.** `book_session` does not
reimplement booking — it calls `me.create_booking`, the same coroutine the app's
own Book button reaches. Route handlers are ordinary async functions; only
FastAPI's dependency injection is skipped, and `me` is passed explicitly in its
place. So the double-booking check, the notification, the price parsing and
every future fix live in exactly one place ([[Say it once, in one place]]). A
second implementation would drift, and the copy that drifts is always the one
without a UI in front of it.

`writes=True` on a spec is not documentation. The engine refuses to run any tool
carrying it until she has said yes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from fastapi import HTTPException

from app.core.llm.base import ToolSpec
from app.core.sakhi import confirm_text
from app.core.matching import NEEDS, rank
from app.db.mongodb import get_database
from app.models.enrollment import BookingModel, EnrollmentModel
from app.models.program import ProgramModel
from app.models.service import ServiceModel
from app.routes import catalog as catalog_routes
from app.routes import community as community_routes
from app.routes import growth as growth_routes
from app.routes import me as me_routes
from app.routes import payments as payments_routes
from app.schemas.me import BookingCreate, CancelRequest

Handler = Callable[[dict, dict], Awaitable[dict]]


@dataclass
class Tool:
    spec: ToolSpec
    handler: Handler

    @property
    def name(self) -> str:
        return self.spec.name

    @property
    def writes(self) -> bool:
        return self.spec.writes


# --- small helpers -----------------------------------------------------------

def _service_brief(doc: dict) -> dict:
    payload = ServiceModel.to_response(doc)
    return {
        "id": payload["id"],
        "name": payload.get("name", ""),
        "type": payload.get("type", ""),
        "duration": payload.get("duration", ""),
        "price": payload.get("price", ""),
        "description": (payload.get("description", "") or "")[:200],
    }


def _program_brief(doc: dict) -> dict:
    payload = ProgramModel.to_response(doc)
    cap = int(payload.get("cap") or 0)
    enrolled = int(payload.get("enrolled") or 0)
    return {
        "id": payload["id"],
        "name": payload.get("name", ""),
        "category": payload.get("category", ""),
        "duration": payload.get("duration", ""),
        "seats_left": max(0, cap - enrolled) if cap else None,
        "is_full": bool(cap and enrolled >= cap),
        "description": (payload.get("desc", "") or "")[:200],
    }


async def _open_services() -> list[dict]:
    cursor = get_database()[ServiceModel.collection_name].find(
        {"status": {"$in": catalog_routes.OPEN_SERVICE_STATUSES}}
    )
    return [doc async for doc in cursor]


async def _open_programs() -> list[dict]:
    cursor = get_database()[ProgramModel.collection_name].find(
        {"status": {"$in": catalog_routes.OPEN_PROGRAM_STATUSES}}
    )
    return [doc async for doc in cursor]


# --- reads -------------------------------------------------------------------

async def _find_help(me: dict, args: dict) -> dict:
    """The existing intake matcher, reused. Deterministic, and every suggestion
    carries a reason — the model may relay those, not invent new ones."""
    text = (args.get("text") or "").strip()
    services = await _open_services()
    programs = await _open_programs()
    ranked = rank(
        text,
        args.get("needs") or [],
        [ServiceModel.to_response(s) for s in services],
        [ProgramModel.to_response(p) for p in programs],
    )
    # Only the fields an answer is built from. The full objects carry price
    # tiers, tones, icons, ratings and booking counts — a dozen fields per row
    # that cost tokens on the next call and never reach her. Measured: this
    # result was 1304 tokens before the trim.
    keep = ["id", "name", "type", "category", "duration", "price", "mode", "reason"]
    return {
        "needs": ranked.get("needs", []),
        "services": _slim(ranked.get("services", []), keep, limit=4),
        "programs": _slim(ranked.get("programs", []), keep, limit=4),
    }


async def _search_services(me: dict, args: dict) -> dict:
    rows = await catalog_routes.list_services(
        q=(args.get("query") or None), type=None, me=me
    )
    return {"services": [r.model_dump() for r in rows][:8]}


async def _search_programs(me: dict, args: dict) -> dict:
    rows = await catalog_routes.list_programs(
        q=(args.get("query") or None), category=None, me=me
    )
    return {"programs": [r.model_dump() for r in rows][:8]}


async def _list_my_bookings(me: dict, args: dict) -> dict:
    which = (args.get("which") or "upcoming").lower()
    status_map = {
        "upcoming": BookingModel.STATUS_UPCOMING,
        "past": BookingModel.STATUS_COMPLETED,
        "cancelled": BookingModel.STATUS_CANCELLED,
    }
    rows = await me_routes.my_bookings(state=status_map.get(which), me=me)
    return {
        "which": which,
        "bookings": [
            {
                "id": r.id,
                "service": r.service_name,
                "date": r.date,
                "time": r.time,
                "mode": r.mode,
                "status": r.status,
            }
            for r in rows
        ][:8],
    }


async def _list_my_programs(me: dict, args: dict) -> dict:
    rows = await me_routes.my_programs(state=None, me=me)
    return {
        "programs": [
            {
                "id": r.id,
                "program_id": r.program_id,
                "name": r.program_name,
                "status": r.status,
                "progress": getattr(r, "progress", None),
            }
            for r in rows
        ][:8],
    }


async def _my_summary(me: dict, args: dict) -> dict:
    summary = await me_routes.my_summary(me=me)
    return summary.model_dump()


# --- the rest of the app -----------------------------------------------------
#
# She used to have tools for services, programmes and bookings, and nothing
# else. Asked about the library or her circle she answered "I don't have a tool
# for that" — honest, and useless. An assistant that can only see a tenth of the
# app is not wrong when it says it cannot help; it is just not much of an
# assistant. These are the other things a woman actually asks about.
#
# All read-only, all scoped to her by the same rule as everything above: the
# handler is handed her account and the route filters by it.
#
# NOTE: these route functions declare FastAPI `Query(...)` defaults. Calling one
# without passing an argument hands the *Query object itself* to the query
# builder instead of a value, so every parameter is passed explicitly here.

def _slim(rows, keys: list[str], limit: int = 8) -> list[dict]:
    """Keep the fields worth spending tokens on, and only those that exist."""
    out = []
    for r in rows[:limit]:
        d = r.model_dump() if hasattr(r, "model_dump") else dict(r)
        row = {}
        for k in keys:
            v = d.get(k)
            if v in (None, ""):
                continue
            # A description is there to be matched on, not repeated back. One
            # line is enough for the model to tell two options apart.
            if isinstance(v, str) and len(v) > 140:
                v = v[:137].rstrip() + "…"
            row[k] = v
        out.append(row)
    return out


async def _search_library(me: dict, args: dict) -> dict:
    """The passages that answer her, not a list of things she could go and read.

    Returning titles made this a search box: "here are three guides" leaves her
    to read them herself, on a phone, possibly in her third language. The
    passages come back so the model can answer in her own words and say which
    guide it came from.
    """
    from app.core import rag
    from app.models.content import ContentItemModel

    q = (args.get("q") or "").strip()
    db = get_database()
    query: dict = {"status": "Published"}
    if args.get("type"):
        query["type"] = args["type"]
    docs = [d async for d in db[ContentItemModel.collection_name].find(query)]

    found = rag.search(q, docs) if q else None
    if found:
        return {
            "passages": found,
            "note": "Answer from these in her language. Say which guide it came from.",
        }

    # Nothing close enough, or no model: fall back to what exists, honestly.
    rows = await me_routes.library(q=q or None, type=args.get("type") or None, me=me)
    return {
        "items": _slim(rows, ["id", "title", "type", "desc"]),
        "note": "No passage answered her closely. Do not invent one.",
    }


async def _list_circles(me: dict, args: dict) -> dict:
    rows = await community_routes.list_circles(
        q=args.get("q") or "", mine=bool(args.get("mine")), me=me
    )
    return {"circles": _slim(rows, ["id", "name", "topic", "members", "joined", "desc"])}


async def _list_events(me: dict, args: dict) -> dict:
    rows = await growth_routes.list_events(
        category=args.get("category") or "", mode=args.get("mode") or "",
        mine=bool(args.get("mine")), past=bool(args.get("past")), me=me,
    )
    return {"events": _slim(rows, ["id", "title", "date", "time", "mode", "category",
                                   "venue", "registered", "seats_left"])}


async def _list_mentors(me: dict, args: dict) -> dict:
    rows = await growth_routes.list_mentors(
        q=args.get("q") or "", expertise=args.get("expertise") or "", me=me
    )
    return {"mentors": _slim(rows, ["id", "name", "expertise", "role", "bio",
                                    "languages", "requested"])}


async def _list_opportunities(me: dict, args: dict) -> dict:
    rows = await growth_routes.list_opportunities(
        q=args.get("q") or "", kind=args.get("kind") or "",
        mode=args.get("mode") or "", saved=bool(args.get("saved")), me=me,
    )
    return {"opportunities": _slim(rows, ["id", "title", "org", "kind", "mode",
                                          "location", "pay", "deadline"], limit=6)}


async def _my_certificates(me: dict, args: dict) -> dict:
    rows = await me_routes.my_certificates(me=me)
    return {"certificates": _slim(rows, ["id", "title", "issued", "program_name", "code"])}


async def _my_progress(me: dict, args: dict) -> dict:
    result = await me_routes.my_progress(me=me)
    return result.model_dump()


async def _my_messages(me: dict, args: dict) -> dict:
    rows = await me_routes.my_messages(me=me)
    return {"messages": _slim(rows, ["id", "text", "sender", "created_at", "read"], limit=10)}


async def _my_records(me: dict, args: dict) -> dict:
    """One tool for the eight things that were one tool each.

    `my_certificates`, `my_progress`, `my_payments`, `my_messages`,
    `my_wallet`, `my_documents`, `my_notifications` and `my_referrals` all took
    no arguments and all meant "read one of my own records". Eight separate
    schemas cost about 45 tokens each in overhead alone, on every single
    message, and nothing here is cached — see the note in prompt.py. Folded into
    one enum they cost that overhead once.
    """
    kind = (args.get("kind") or "").strip()
    handler = _RECORD_KINDS.get(kind)
    if handler is None:
        return {"error": f"Unknown kind '{kind}'.", "kinds": sorted(_RECORD_KINDS)}
    return await handler(me, args)


async def _my_wallet(me: dict, args: dict) -> dict:
    from app.routes import wallet as wallet_routes

    w = await wallet_routes.my_wallet(me=me)
    d = w.model_dump() if hasattr(w, "model_dump") else dict(w)
    # Only the balance and the last few movements. The full history is a screen
    # she can open; the model needs enough to answer "how much do I have?".
    d["transactions"] = (d.get("transactions") or [])[:8]
    return d


async def _my_documents(me: dict, args: dict) -> dict:
    rows = await me_routes.my_documents(me=me)
    return {"documents": _slim(rows, ["id", "name", "kind", "status", "sent", "note"])}


async def _my_notifications(me: dict, args: dict) -> dict:
    rows = await me_routes.my_notifications(me=me)
    return {"notifications": _slim(rows, ["id", "title", "text", "when", "read"], limit=10)}


async def _read_stories(me: dict, args: dict) -> dict:
    rows = await community_routes.list_stories(mine=bool(args.get("mine")), me=me)
    return {"stories": _slim(rows, ["id", "title", "author", "trade", "text"], limit=6)}


async def _my_referrals(me: dict, args: dict) -> dict:
    r = await me_routes.my_referrals(me=me)
    return r.model_dump() if hasattr(r, "model_dump") else dict(r)


async def _my_payments(me: dict, args: dict) -> dict:
    rows = await payments_routes.my_orders(me=me)
    return {"payments": _slim(rows, ["id", "item", "amount", "status", "date", "method"])}


# --- writes (every one of these waits for her yes) ---------------------------

async def _book_session(me: dict, args: dict) -> dict:
    payload = BookingCreate(
        service_id=args["service_id"],
        date=args["date"],
        time=args["time"],
        mode=args.get("mode") or "Online",
        note=args.get("note") or "",
    )
    booking = await me_routes.create_booking(payload, me)
    return {
        "booked": True,
        "id": booking.id,
        "service": booking.service_name,
        "date": booking.date,
        "time": booking.time,
    }


async def _cancel_booking(me: dict, args: dict) -> dict:
    booking = await me_routes.cancel_booking(
        args["booking_id"], CancelRequest(reason=args.get("reason") or ""), me
    )
    return {"cancelled": True, "id": booking.id, "service": booking.service_name}


async def _join_program(me: dict, args: dict) -> dict:
    enrollment = await me_routes.enroll(args["program_id"], me)
    return {"joined": True, "id": enrollment.id, "name": enrollment.program_name}


async def _leave_program(me: dict, args: dict) -> dict:
    result = await me_routes.leave_program(args["program_id"], me)
    return {"left": True, "message": getattr(result, "message", "")}


_RECORD_KINDS: dict[str, Handler] = {
    "summary": _my_summary,
    "progress": _my_progress,
    "certificates": _my_certificates,
    "payments": _my_payments,
    "wallet": _my_wallet,
    "documents": _my_documents,
    "notifications": _my_notifications,
    "messages": _my_messages,
    "referrals": _my_referrals,
}


# --- the registry ------------------------------------------------------------

_NEED_KEYS = [n["key"] for n in NEEDS]

MEMBER_TOOLS: list[Tool] = [
    Tool(
        ToolSpec(
            name="find_help",
            description=(
                "Match what she says she needs against the services and programmes "
                "that are open. Use this whenever she describes a situation or a "
                "goal in her own words rather than naming something exactly. Each "
                "result carries a reason — relay that reason, never invent one."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Her words, as she said them."},
                    "needs": {
                        "type": "array",
                        "items": {"type": "string", "enum": _NEED_KEYS},
                        "description": "Optional need keys, if she picked them.",
                    },
                },
                "required": ["text"],
            },
        ),
        _find_help,
    ),
    Tool(
        ToolSpec(
            name="search_services",
            description="Search bookable services by name. Use when she names something specific.",
            input_schema={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": [],
            },
        ),
        _search_services,
    ),
    Tool(
        ToolSpec(
            name="search_programs",
            description="Search programmes she can join by name or subject.",
            input_schema={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": [],
            },
        ),
        _search_programs,
    ),
    Tool(
        ToolSpec(
            name="list_my_bookings",
            description="Her own bookings. Use before cancelling, or when she asks what she has.",
            input_schema={
                "type": "object",
                "properties": {
                    "which": {"type": "string", "enum": ["upcoming", "past", "cancelled"]}
                },
                "required": ["which"],
            },
        ),
        _list_my_bookings,
    ),
    Tool(
        ToolSpec(
            name="list_my_programs",
            description="The programmes she has joined, and how far along she is.",
            input_schema={"type": "object", "properties": {}, "required": []},
        ),
        _list_my_programs,
    ),
    Tool(
        ToolSpec(
            name="book_session",
            description=(
                "Book one session for her. Call search_services or find_help first "
                "so the service id is real. Never guess a date or a time — if she "
                "has not given both, ask her.\n"
                "Mode is NOT worth a question: if she did not say, use 'Online'. "
                "She is shown the mode in the confirmation and can decline, so "
                "asking first only adds a step before she has agreed to anything."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "service_id": {"type": "string"},
                    "date": {"type": "string", "description": "ISO date, e.g. 2026-09-04"},
                    "time": {"type": "string", "description": "Slot label, e.g. 10:00 AM"},
                    "mode": {"type": "string", "enum": ["Online", "In person"]},
                    "note": {"type": "string"},
                },
                "required": ["service_id", "date", "time"],
            },
            writes=True,
            confirm_template="Book {service} on {date} at {time}, {mode}?",
        ),
        _book_session,
    ),
    Tool(
        ToolSpec(
            name="cancel_booking",
            description="Cancel one of her upcoming bookings. Call list_my_bookings first to get the id.",
            input_schema={
                "type": "object",
                "properties": {
                    "booking_id": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["booking_id"],
            },
            writes=True,
            confirm_template="Cancel {service}?",
        ),
        _cancel_booking,
    ),
    Tool(
        ToolSpec(
            name="join_program",
            description="Enrol her in a programme. Call search_programs or find_help first for a real id.",
            input_schema={
                "type": "object",
                "properties": {"program_id": {"type": "string"}},
                "required": ["program_id"],
            },
            writes=True,
            confirm_template="Join {name}?",
        ),
        _join_program,
    ),
    Tool(
        ToolSpec(
            name="leave_program",
            description="Withdraw her from a programme she has joined.",
            input_schema={
                "type": "object",
                "properties": {"program_id": {"type": "string"}},
                "required": ["program_id"],
            },
            writes=True,
            confirm_template="Leave {name}?",
        ),
        _leave_program,
    ),

    Tool(
        ToolSpec(
            name="my_records",
            description=(
                "Read one of her own records. kind: summary (what is coming up), "
                "progress, certificates, payments, wallet (her balance), documents, "
                "notifications, messages (her thread with the team), referrals."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["summary", "progress", "certificates", "payments",
                                 "wallet", "documents", "notifications", "messages",
                                 "referrals"],
                    }
                },
                "required": ["kind"],
            },
        ),
        _my_records,
    ),

    # --- the rest of the app, read-only --------------------------------------
    Tool(
        ToolSpec(
            name="search_library",
            description=(
                "Read the guides written for members — pricing, getting paid, "
                "selling online, borrowing, accounts, rights at work, food "
                "safety. Returns the actual passages that answer her, so answer "
                "FROM them and name the guide. Use this whenever she asks how to "
                "do something or what something means, rather than answering "
                "from your own knowledge. If nothing comes back, say so."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "Words to search for"},
                    "type": {"type": "string", "description": "Article, Guide, Video"},
                },
                "required": [],
            },
        ),
        _search_library,
    ),
    Tool(
        ToolSpec(
            name="list_circles",
            description=(
                "The circles she can join, or with mine=true only the ones she is "
                "already in. Use for anything about her group, other women, or "
                "where to talk to people."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "mine": {"type": "boolean", "description": "Only circles she has joined"},
                },
                "required": [],
            },
        ),
        _list_circles,
    ),
    Tool(
        ToolSpec(
            name="list_events",
            description=(
                "Events she can attend, or with mine=true the ones she has "
                "registered for. Bookings and events are different things — a "
                "booking is a session with one person, an event is a gathering."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "mine": {"type": "boolean"},
                    "past": {"type": "boolean", "description": "Include ones already held"},
                    "category": {"type": "string"},
                },
                "required": [],
            },
        ),
        _list_events,
    ),
    Tool(
        ToolSpec(
            name="list_mentors",
            description="Mentors she can ask for, by name or by what they know.",
            input_schema={
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "expertise": {"type": "string"},
                },
                "required": [],
            },
        ),
        _list_mentors,
    ),
    Tool(
        ToolSpec(
            name="list_opportunities",
            description=(
                "Work, orders and openings posted for members. Use this for "
                "anything about earning, jobs, or finding customers."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "kind": {"type": "string", "description": "Job, Order, Grant"},
                },
                "required": [],
            },
        ),
        _list_opportunities,
    ),
    Tool(
        ToolSpec(
            name="read_stories",
            description=(
                "Success stories from other members, in their own words. Use when "
                "she is discouraged, or asks whether anyone like her has done this. "
                "Relay what a woman actually said; never invent a story."
            ),
            input_schema={
                "type": "object",
                "properties": {"mine": {"type": "boolean", "description": "Only ones she wrote"}},
                "required": [],
            },
        ),
        _read_stories,
    ),
]

_BY_NAME = {t.name: t for t in MEMBER_TOOLS}


def member_tools() -> list[Tool]:
    return MEMBER_TOOLS


def specs(tools: list[Tool]) -> list[ToolSpec]:
    return [t.spec for t in tools]


def find(name: str, available: Optional[list[Tool]] = None) -> Optional[Tool]:
    """Look a tool up, optionally within a specific set.

    The set matters: staff and members have different tools, and a global
    lookup would happily return a member tool to a staff conversation.
    """
    if available is not None:
        return next((t for t in available if t.name == name), None)
    return _BY_NAME.get(name)


async def describe(name: str, args: dict, me: dict) -> str:
    """The sentence she is shown before a write runs.

    Built from the database, not from the model's own words — so what she
    approves is what the code is about to do, even if the model described it
    loosely a moment earlier.

    Worded in HER language. The values still come from her records; only the
    sentence around them is translated, so the guarantee above survives. A woman
    reading Telugu should not be handed an English sentence at the one moment
    she is agreeing to something that changes her records.
    """
    tool = find(name)
    if not tool or not tool.writes:
        return ""
    db = get_database()
    locale = me.get("locale") or "en"

    if name == "book_session":
        service = await db[ServiceModel.collection_name].find_one(
            {"_id": _oid(args.get("service_id"))}
        )
        # The mode is shown, not asked. She sees "online" or "in person" before
        # she agrees, which is the point at which correcting it is cheap.
        mode = (args.get("mode") or "Online").strip()
        return confirm_text.template("book_session", locale).format(
            service=(service or {}).get("name") or confirm_text.unnamed("session", locale),
            date=args.get("date", ""),
            time=args.get("time", ""),
            mode=confirm_text.mode_word(mode, locale),
        )
    if name == "cancel_booking":
        booking = await db[BookingModel.collection_name].find_one(
            {"_id": _oid(args.get("booking_id")), "user_id": str(me["_id"])}
        )
        return confirm_text.template("cancel_booking", locale).format(
            service=(booking or {}).get("service_name") or confirm_text.unnamed("booking", locale)
        )
    if name in ("join_program", "leave_program"):
        program = await db[ProgramModel.collection_name].find_one(
            {"_id": _oid(args.get("program_id"))}
        )
        return confirm_text.template(name, locale).format(
            name=(program or {}).get("name") or confirm_text.unnamed("program", locale)
        )
    return tool.spec.confirm_template


def _oid(value):
    from app.core.serializers import to_object_id

    try:
        return to_object_id(value or "")
    except Exception:
        return None


async def run(name: str, args: dict, me: dict,
              available: Optional[list[Tool]] = None) -> dict:
    """Execute one tool. A refused or failed action comes back as data, not an
    exception — the model needs to read what went wrong and tell her plainly."""
    tool = find(name, available)
    if not tool:
        return {"error": f"No such tool: {name}"}
    try:
        return await tool.handler(me, args or {})
    except HTTPException as exc:
        return {"error": str(exc.detail), "status": exc.status_code}
    except KeyError as exc:
        return {"error": f"Missing required detail: {exc}"}
    except Exception as exc:  # noqa: BLE001 - surfaced to the model, logged upstream
        return {"error": f"That did not work: {exc}"}

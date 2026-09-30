"""
One shape for every failure, and a thread to pull when one is reported.

Two problems this solves, both of which only show up once real people are using
the thing:

**A support ticket with nothing to trace.** "It said something went wrong" is
unactionable. Every response now carries an `X-Request-Id`, every error body
repeats it, and every log line for that request is stamped with it — so "it
said 7f3a9c" is a grep away from the exact request, its route, its query count
and its duration.

**A stack trace on a phone.** FastAPI's default for an unhandled exception is a
500 with no body; a misconfigured deployment turns that into a traceback. Both
are wrong for a woman on a bus. She gets one sentence she can act on, and the
detail goes to the log where it belongs.

The envelope is deliberately small:

    {"error": {"message": "…", "request_id": "7f3a9c2e"}}

No error codes, because nothing on the client branches on one — the screens key
their wording off the route, which they already know. Adding a taxonomy nobody
reads is a taxonomy that drifts.
"""

from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger("womsakhi.error")

_request_id: ContextVar[str] = ContextVar("request_id", default="")

HEADER = "X-Request-Id"


def current_request_id() -> str:
    return _request_id.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Stamp every request with an id, and honour one the caller already had.

    Honouring an inbound id matters the moment anything sits in front of this —
    a proxy, a gateway, a mobile client that generates its own — because an id
    that changes at each hop cannot follow a request across them.
    """

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get(HEADER) or uuid.uuid4().hex[:8]
        token = _request_id.set(rid)
        # On the scope too, so an exception handler outside this middleware's
        # frame can still find it.
        request.state.request_id = rid
        try:
            response = await call_next(request)
        finally:
            _request_id.reset(token)
        response.headers[HEADER] = rid
        return response


def _envelope(message: str, rid: str, status_code: int, extra: dict | None = None,
              headers: dict | None = None) -> JSONResponse:
    body = {"message": message, "request_id": rid}
    # A few flows do branch: the sign-in screen has to tell "wrong code" from
    # "authenticator needed" from "set up your authenticator". Those raise a
    # dict with a `code` and a `message`; the extra keys ride alongside the
    # sentence rather than replacing it, so every other screen keeps working.
    if extra:
        body.update({k: v for k, v in extra.items() if k not in body})
    return JSONResponse(
        status_code=status_code,
        content={"error": body},
        headers={HEADER: rid, **(headers or {})},
    )


def safe_validation_summary(errors) -> list[dict]:
    """
    What a validation failure may put in a log: where, what kind, and the
    sentence. Never `input` or `ctx`.

    Under pydantic v2 each error carries the value that failed (`input`) and
    often the constraint with the value echoed back (`ctx`). On the auth routes
    that is her email, her phone number, the one-time code she typed; on a body
    that failed to parse, the whole body. Logs are kept longer and read by more
    people than the database, so none of it goes there.
    """
    out = []
    for err in errors or ():
        if not isinstance(err, dict):
            continue
        out.append({
            "loc": [str(p) for p in err.get("loc", ())],
            "type": str(err.get("type", "")),
            "msg": str(err.get("msg", "")),
        })
    return out


def install(app: FastAPI) -> None:
    """Register the handlers. Called once from `main`."""

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        rid = getattr(request.state, "request_id", "")
        # `detail` on a raised HTTPException is written for a person — every
        # `raise HTTPException(…, "You already have a request with us")` in this
        # codebase is a sentence, not a code — so it passes straight through.
        detail = exc.detail
        if isinstance(detail, dict) and "message" in detail:
            return _envelope(str(detail["message"]), rid, exc.status_code,
                             extra={k: v for k, v in detail.items() if k != "message"},
                             headers=getattr(exc, "headers", None))
        return _envelope(str(detail), rid, exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        rid = getattr(request.state, "request_id", "")
        # Pydantic's own message names the field and says what was wrong with
        # it, which is more use than "invalid request". The full list goes to
        # the log; the first one goes to her.
        first = (exc.errors() or [{}])[0]
        where = " → ".join(str(p) for p in first.get("loc", ()) if p != "body")
        message = first.get("msg", "That request was not valid")
        log.warning("validation %s %s — %s", request.method, request.url.path, safe_validation_summary(exc.errors()))
        return _envelope(f"{where}: {message}" if where else message, rid, 422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        rid = getattr(request.state, "request_id", "")
        # The traceback goes to the log, with the id. She gets a sentence.
        log.exception("unhandled %s %s [%s]", request.method, request.url.path, rid)
        return _envelope(
            "Something went wrong at our end. Nothing you have done has been lost — "
            "please try again in a moment.",
            rid, 500,
        )

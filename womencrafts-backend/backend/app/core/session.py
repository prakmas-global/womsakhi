"""
Session cookies.

The token used to live in localStorage, where any XSS bug could read it. For an
app holding women's identity documents that is not an acceptable trade, so the
session now travels in a cookie the browser attaches automatically and
JavaScript cannot touch:

    HttpOnly  — unreadable from JS, so XSS cannot steal the session
    SameSite  — not sent on cross-site requests, which blunts CSRF
    Secure    — HTTPS only (off for local http://localhost development)

The Authorization header still works. That is deliberate: scripts, tests and any
future mobile client have no cookie jar, and dropping header auth would break
them for no security gain.
"""

from fastapi import Response

from app.core.config import settings

COOKIE_NAME = "access_token"


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")

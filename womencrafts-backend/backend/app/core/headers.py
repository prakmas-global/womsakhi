"""
The headers a browser needs in order to defend the app for us.

There were none. Not a weak set — none: the API answered every request with
`server`, `content-type` and the timing headers, and nothing else. Everything
below is a browser-side control we were simply declining to switch on.

What each one is actually for here:

**X-Content-Type-Options: nosniff** — `/media` serves files members upload. The
allow-list in `models/upload.py` is raster images only, so this is defence in
depth rather than a live hole, but MIME sniffing is exactly how "it's only a
JPEG" becomes script running on the API's own origin.

**X-Frame-Options / frame-ancestors: none** — nothing in this product is meant
to be embedded in someone else's page, and an app about a woman's money and her
safety plan is a poor thing to have silently framed.

**Referrer-Policy: strict-origin-when-cross-origin** — URLs here carry document
ids and email-confirmation tokens. `?token=…` leaking to a third-party host in
a Referer header is the kind of quiet mistake that is impossible to notice.

**HSTS, only over HTTPS.** Sent when the request actually arrived over TLS, so
local development on plain http never sets it. This matters more than the usual
"browsers ignore it anyway": pinning `localhost` to HTTPS in a developer's
browser breaks every other project on that machine, and it is remembered for
months.

**CSP is deliberately narrow, not absent.** This origin serves JSON and
uploaded images; it is not where the app's HTML lives. So the policy forbids
scripts and framing outright rather than trying to describe a front end that
isn't here. `/docs` is the exception — Swagger UI legitimately loads a script
and a stylesheet from a CDN, and a policy that breaks the API documentation is
a policy someone will delete rather than fix.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

#: Sent on every response.
BASE = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # No browser feature on this list has any business being used by a JSON API.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    # Legacy header, still read by some corporate proxies; harmless where it is
    # not. The real control is the CSP below.
    "X-XSS-Protection": "0",
}

#: The API's own responses: no scripts, no frames, no plugins, nothing embedded.
API_CSP = (
    "default-src 'none'; "
    "img-src 'self' data:; "
    "media-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)

#: Swagger UI and ReDoc pull their assets from jsdelivr. Narrower than "unsafe
#: everything", wider than the policy above, and confined to these three paths.
DOCS_CSP = (
    "default-src 'none'; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'"
)

DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

#: Two years, the value HSTS preload requires. Subdomains included: a forgotten
#: `staging.` on plain http is a place to strip a session cookie from.
HSTS = "max-age=63072000; includeSubDomains"


def _is_https(request: Request) -> bool:
    # Behind our ingress the socket is plain http and the scheme is in the
    # header. Same trust assumption as `ratelimit._client_ip`: this only ever
    # runs behind our own proxy.
    forwarded = request.headers.get("x-forwarded-proto", "")
    if forwarded:
        return forwarded.split(",")[0].strip() == "https"
    return request.url.scheme == "https"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        for header, value in BASE.items():
            # Never clobber a header a route set deliberately — `read_document`
            # sets its own `Cache-Control` and is entitled to win.
            response.headers.setdefault(header, value)

        path = request.url.path
        is_docs = any(path.startswith(p) for p in DOCS_PATHS)
        response.headers.setdefault(
            "Content-Security-Policy", DOCS_CSP if is_docs else API_CSP
        )

        if _is_https(request):
            response.headers.setdefault("Strict-Transport-Security", HSTS)

        return response

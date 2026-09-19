"""
Media URLs: relative in the database, absolute in the response.

**The bug this exists to prevent.** `POST /uploads` used to compute
`f"{settings.MEDIA_BASE_URL}/media/{kind}/{name}"` and store *that* string on
the row. So the host the file was uploaded from was baked into the database
permanently. An image uploaded from a developer's laptop carried
`http://localhost:8020` into production, where the browser refused it — forty
CORS errors on a real phone, on images that existed and were served correctly.
Nothing caught it, because the value was right on the machine that wrote it and
only wrong everywhere else.

The host is not a property of the file. It is a property of the *environment
reading* the file, and it changes: `localhost:8010` → `localhost:8020` →
`api.womsakhi.com`. So the database stores what does not change — the path,
`media/avatar/x.png` — and the absolute URL is built here, on the way out, from
whatever `MEDIA_BASE_URL` this process was started with.

**Two directions, and both matter.**

`to_media_path` runs on the way IN. The frontend gets an absolute URL back from
an upload and PATCHes it straight onto a profile, so without this the host would
walk back into the database by a second route — and then get copied again when a
post denormalises the author's avatar. Applied as a pydantic validator rather
than at each route, because most routes write with `**body.model_dump()` and
never name the field at all.

`media_url` runs on the way OUT, and deliberately passes through anything that
is already absolute. There are rows holding `https://api.womsakhi.com/media/…`
from an earlier repair and they still resolve; re-prefixing them would produce
`https://api.womsakhi.com/https://api.womsakhi.com/…`. External images — a
stock photo, a gravatar — pass through for the same reason.
"""

from typing import Annotated, Optional
from urllib.parse import urlsplit

from pydantic import BeforeValidator

from app.core.config import settings

# Schemes that are already a complete reference to some bytes. Never touched in
# either direction.
_ABSOLUTE_SCHEMES = ("http://", "https://", "data:", "blob:", "//")

# A dev machine, under any of the names it answers to.
_LOOPBACK = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def _is_our_host(netloc: str) -> bool:
    """
    Is this host one of ours — i.e. is `/media/x.png` on it the same file we
    would serve ourselves?

    Only a yes here lets `to_media_path` drop the host. A `/media/` path on
    somebody else's domain is somebody else's image and is left alone.
    """
    if not netloc:
        return False
    netloc = netloc.lower()
    if netloc == urlsplit(settings.MEDIA_BASE_URL).netloc.lower():
        return True
    host = netloc.rsplit("@", 1)[-1].split(":")[0].strip("[]")
    if host in _LOOPBACK:
        return True
    # Hosts this API has been served from before or may be served from next.
    # A setting rather than a literal, because the previous version of this
    # mistake was a hostname that could not be changed without a deploy.
    extra = {h.strip().lower() for h in settings.MEDIA_ALT_HOSTS.split(",") if h.strip()}
    return host in extra


def to_media_path(value: Optional[str]) -> Optional[str]:
    """
    What gets stored. An absolute URL to our own media becomes the path alone.

        https://api.womsakhi.com/media/avatar/x.png  →  media/avatar/x.png
        http://localhost:8020/media/avatar/x.png     →  media/avatar/x.png
        /media/avatar/x.png                          →  media/avatar/x.png
        https://images.example.com/cat.jpg           →  unchanged
        ""                                           →  ""
    """
    if not value or not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return text
    if text.startswith(("data:", "blob:")):
        return text
    if text.startswith(("http://", "https://", "//")):
        parts = urlsplit(text if not text.startswith("//") else "http:" + text)
        if parts.path.startswith("/media/") and _is_our_host(parts.netloc):
            return parts.path.lstrip("/")
        return text
    # Already relative. Normalise the leading slash so one shape is stored.
    return text.lstrip("/")


def media_url(value: Optional[str]) -> str:
    """
    What gets sent. A stored path becomes a URL this environment can load.

        media/avatar/x.png                           →  {MEDIA_BASE_URL}/media/avatar/x.png
        https://api.womsakhi.com/media/avatar/x.png  →  unchanged (see module docstring)
        ""                                           →  ""
    """
    if not value or not isinstance(value, str):
        return ""
    text = value.strip()
    if not text:
        return ""
    if text.startswith(_ABSOLUTE_SCHEMES):
        return text
    # Art that ships inside the web app (`public/ux/...`) is served by the app
    # itself, from whatever host she loaded it on — never by the API.
    if text.startswith("/ux/"):
        return text
    return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{text.lstrip('/')}"


# The field type for anything a woman can upload an image into. Put this on the
# schema and every route that writes the field — including the ones that write
# it as `**body.model_dump()` without naming it — stores a path.
MediaRef = Annotated[str, BeforeValidator(to_media_path)]
MediaRefOptional = Annotated[Optional[str], BeforeValidator(to_media_path)]

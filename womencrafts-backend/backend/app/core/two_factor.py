"""Small RFC 6238 authenticator implementation for staff sign-in."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    key = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        return ""


def code_at(secret: str, timestamp: int | None = None) -> str:
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    counter = int((timestamp if timestamp is not None else time.time()) // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{number:06d}"


def matched_step(secret: str, code: str, timestamp: int | None = None) -> int | None:
    """
    The 30-second time-step (counter) this code belongs to, or None.

    One step either side of now is accepted for clock drift. The caller stores
    the step it accepted and refuses the same or an earlier one next time, so a
    code seen over her shoulder cannot be typed in again within its minute.
    """
    clean = "".join(ch for ch in str(code) if ch.isdigit())
    if len(clean) != 6 or not secret:
        return None
    now = int(timestamp if timestamp is not None else time.time())
    found = None
    for step in (-1, 0, 1):
        at = now + step * 30
        if hmac.compare_digest(code_at(secret, at), clean) and found is None:
            found = at // 30
    return found


def verify_code(secret: str, code: str, timestamp: int | None = None) -> bool:
    return matched_step(secret, code, timestamp) is not None


def provisioning_uri(secret: str, email: str) -> str:
    label = quote(f"WomSakhi:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer=WomSakhi&digits=6&period=30"


def new_recovery_codes(count: int = 8) -> list[str]:
    return [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(count)]


def recovery_digest(code: str) -> str:
    clean = str(code).strip().upper().replace(" ", "")
    return hmac.new(settings.JWT_SECRET_KEY.encode(), clean.encode(), hashlib.sha256).hexdigest()


def provisioning_qr_svg(uri: str) -> str:
    """
    The provisioning URI as an inline SVG QR code.

    `omitsize` gives the SVG a viewBox and no fixed width/height, so it SCALES
    to whatever box the screen puts it in. With a fixed size it was cropped to
    the box instead — and a QR code with its edges cut off cannot be scanned.
    Black on white with the standard 4-module quiet zone: the most reliable
    combination for every authenticator app's camera.
    """
    import io

    import segno

    buffer = io.BytesIO()
    segno.make(uri, error="m").save(buffer, kind="svg", border=4, dark="#000000", light="#ffffff",
                                    xmldecl=False, svgns=True, nl=False, omitsize=True)
    return buffer.getvalue().decode("utf-8")

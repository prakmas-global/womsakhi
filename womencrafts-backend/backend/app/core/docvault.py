"""
Encrypting identity documents at rest.

**What is true today.** A woman's Aadhaar or PAN card is written to
`PRIVATE_MEDIA_DIR` as an ordinary file. That directory is not statically
mounted, the filenames carry 12 hex characters of uuid, the only reader is an
admin endpoint that records who opened it, and as of this change the directory
is mode 0700. That is a genuinely careful setup and it defends the *web* path
well.

It does not defend the *disk*. Anyone who ends up with the bytes — a stolen
backup, a snapshot, a misconfigured rsync, a laptop, a support engineer with
shell — reads a scan of a government ID belonging to a woman who may be hiding
from someone. There is no second door on that. The web hardening is a lock on
the front of a building whose back wall is a curtain.

**What this module does.** AES-256-GCM, one fresh 96-bit nonce per file,
authenticated so a tampered file fails loudly rather than decrypting to
rubbish. The stored format is a small self-describing envelope, so a future key
rotation can tell versions apart without guessing:

    b"WSV1" | nonce (12 bytes) | ciphertext+tag

**The key.** From `DOCUMENT_ENCRYPTION_KEY` if set — 32 bytes, base64 or hex.
If it is not set, this module is OFF and says so; it does not quietly derive a
key from `JWT_SECRET_KEY`. A derived key sounds convenient and means the day
someone rotates the JWT secret is the day every identity document on the
platform becomes unreadable, discovered months later by an admin trying to open
one. Encryption whose key can be rotated away by an unrelated routine change is
worse than none, because it is believed.

**This is not switched on yet, and here is exactly why.** The write happens in
`routes/verification.py::save_document_file` and the read in that module's
`read_document`; both are owned by another agent and neither may be edited from
here. Encrypting the files without changing those two functions would make
every existing document unreadable through the only endpoint that reads them —
breaking a live surface to improve a threat model, which is the wrong trade in
that order.

So the primitives are here, tested, and inert. Turning it on is:

  1. set `DOCUMENT_ENCRYPTION_KEY` (see `generate_key`)
  2. in `save_document_file`, wrap each chunk write — or simplest, call
     `docvault.encrypt_file(destination)` once the file is closed
  3. in `read_document`, stream `docvault.decrypt_bytes(target.read_bytes())`
     through a `Response` instead of `FileResponse`
  4. walk PRIVATE_MEDIA_DIR calling `encrypt_file` on what is already there —
     `decrypt_bytes` passes plaintext through, so this can run gradually
     rather than as a flag day

Steps 2 and 3 have to land together, and step 4 only after both.
"""

from __future__ import annotations

import base64
import binascii
import os
from pathlib import Path
from typing import Optional

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

#: Marks a file this module wrote, and which version wrote it. Rotation adds
#: WSV2 alongside rather than replacing, so old files stay readable.
MAGIC = b"WSV1"
NONCE_BYTES = 12
KEY_BYTES = 32

_ENV_VAR = "DOCUMENT_ENCRYPTION_KEY"


class VaultUnavailable(RuntimeError):
    """No usable key. Callers decide whether that is fatal; nothing here guesses."""


def generate_key() -> str:
    """A fresh base64 key, for putting in .env. Never logged, never stored here."""
    return base64.b64encode(os.urandom(KEY_BYTES)).decode("ascii")


def _decode_key(raw: str) -> bytes:
    raw = raw.strip()
    for decode in (base64.b64decode, binascii.unhexlify):
        try:
            key = decode(raw)
            if len(key) == KEY_BYTES:
                return key
        except Exception:  # noqa: BLE001 - try the next encoding
            continue
    raise VaultUnavailable(
        f"{_ENV_VAR} must be {KEY_BYTES} bytes, base64 or hex encoded. "
        "Generate one with docvault.generate_key()."
    )


def _key() -> bytes:
    # Through `settings`, not `os.environ`: the key belongs in .env, and
    # pydantic-settings reads that file into the Settings object rather than
    # into the process environment. Reading os.environ first would have missed
    # a correctly-configured key and reported encryption as off.
    raw = settings.DOCUMENT_ENCRYPTION_KEY or os.environ.get(_ENV_VAR, "")
    if not raw:
        raise VaultUnavailable(
            f"{_ENV_VAR} is not set — document encryption is off. "
            "This is the default; see this module's docstring."
        )
    return _decode_key(raw)


def available() -> bool:
    """Whether a usable key is configured. Safe to call anywhere; never raises."""
    try:
        _key()
        return True
    except VaultUnavailable:
        return False


def is_encrypted(blob: bytes) -> bool:
    """Cheap check on the first four bytes, so a mixed directory can be migrated."""
    return blob[: len(MAGIC)] == MAGIC


def encrypt_bytes(plaintext: bytes) -> bytes:
    nonce = os.urandom(NONCE_BYTES)
    return MAGIC + nonce + AESGCM(_key()).encrypt(nonce, plaintext, MAGIC)


def decrypt_bytes(blob: bytes) -> bytes:
    """
    Decrypt, or pass through untouched if this file predates encryption.

    Passing plaintext through is what lets a migration run gradually instead of
    as a flag day — during it, some files are encrypted and some are not, and
    the read path must not care which.
    """
    if not is_encrypted(blob):
        return blob
    head = len(MAGIC)
    nonce = blob[head : head + NONCE_BYTES]
    try:
        return AESGCM(_key()).decrypt(nonce, blob[head + NONCE_BYTES :], MAGIC)
    except InvalidTag as exc:
        # Wrong key, or the file was altered. Both are worth stopping for: a
        # silently corrupt ID scan shown to a reviewer is how a real applicant
        # gets rejected for something that never happened.
        raise VaultUnavailable(
            "This document could not be decrypted — wrong key, or the file has been altered."
        ) from exc


def encrypt_file(path: Path) -> bool:
    """
    Encrypt one file in place. Returns False if it already was.

    Writes a temporary file beside the original and renames over it, because a
    process killed halfway through an in-place rewrite leaves an identity
    document that is neither readable nor recoverable.
    """
    blob = path.read_bytes()
    if is_encrypted(blob):
        return False
    tmp = path.with_suffix(path.suffix + ".enc-tmp")
    tmp.write_bytes(encrypt_bytes(blob))
    tmp.chmod(0o600)
    tmp.replace(path)
    return True


def read_file(path: Path) -> bytes:
    """Plaintext bytes of a stored document, encrypted or not."""
    return decrypt_bytes(path.read_bytes())


def status() -> dict:
    """For a health or settings screen: is this on, without revealing anything."""
    return {"encryption_at_rest": available(), "algorithm": "AES-256-GCM", "envelope": MAGIC.decode()}

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

The verification write and read paths use these primitives whenever a valid
key is configured. Plaintext legacy files still open during migration; the
`backfill` command seals them in place after the read path is deployed.
"""

from __future__ import annotations

import base64
import binascii
import errno
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


def _restrict_permissions(path: Path) -> None:
    """Make local files owner-only when the storage supports POSIX modes.

    Cloud Run's GCS FUSE mount is protected by bucket IAM rather than Unix
    mode bits and returns EPERM/ENOTSUP for chmod even after a successful
    write. Treat those two storage semantics as equivalent security controls;
    keep raising every other chmod error so a normal disk cannot silently
    become more permissive.
    """
    try:
        path.chmod(0o600)
    except OSError as exc:
        unsupported = {errno.EPERM, errno.ENOTSUP}
        if hasattr(errno, "EOPNOTSUPP"):
            unsupported.add(errno.EOPNOTSUPP)
        if exc.errno not in unsupported:
            raise


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
    sealed = encrypt_bytes(blob)
    tmp.write_bytes(sealed)
    _restrict_permissions(tmp)
    try:
        tmp.replace(path)
    except OSError:
        # Some production object-storage mounts support reads and writes but do
        # not implement an atomic rename. The old implementation surfaced this
        # as "Could not store that document securely" after a successful
        # upload. Keep the atomic path for normal disks and use a verified
        # direct write only on mounts that reject rename.
        path.write_bytes(sealed)
        _restrict_permissions(path)
        tmp.unlink(missing_ok=True)
    if not is_encrypted(path.read_bytes()[: len(MAGIC)]):
        path.unlink(missing_ok=True)
        raise VaultUnavailable("The encrypted document could not be verified after storage.")
    return True


def read_file(path: Path) -> bytes:
    """Plaintext bytes of a stored document, encrypted or not."""
    return decrypt_bytes(path.read_bytes())


def status() -> dict:
    """For a health or settings screen: is this on, without revealing anything."""
    return {"encryption_at_rest": available(), "algorithm": "AES-256-GCM", "envelope": MAGIC.decode()}


# ─────────────────────────────────────────────────────────────────────────────
# Command line
#
# `python -m app.core.docvault <command>`. Referenced from this module's own
# docstring and from `config.unsafe_for_production()`, and until now it did not
# exist — the instructions for turning encryption on pointed at a command that
# was not there.
# ─────────────────────────────────────────────────────────────────────────────

def _iter_documents() -> list[Path]:
    """Every stored document, encrypted or not."""
    root = Path(settings.PRIVATE_MEDIA_DIR)
    if not root.exists():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file() and not p.name.endswith(".enc-tmp"))


def _cli(argv: list[str]) -> int:
    command = (argv[0] if argv else "help").lower()

    if command == "generate":
        # Printed, because there is no other way to hand someone a new key —
        # but it goes to stdout only, is never logged, and is not written to
        # any file by this command. The operator decides where it lives.
        print(generate_key())
        return 0

    if command == "status":
        files = _iter_documents()
        encrypted = sum(1 for p in files if is_encrypted(p.read_bytes()[:8]))
        print(f"  key configured : {'yes' if available() else 'NO'}")
        print(f"  algorithm      : AES-256-GCM ({MAGIC.decode()} envelope)")
        print(f"  documents      : {len(files)}")
        print(f"  encrypted      : {encrypted}")
        print(f"  plaintext      : {len(files) - encrypted}")
        if files and not available():
            print("\n  Every document above is readable by anyone who gets the bytes.")
        return 0

    if command == "backfill":
        if not available():
            print(f"  {_ENV_VAR} is not set, so there is nothing to encrypt with.")
            print("  Generate one:  python -m app.core.docvault generate")
            return 1
        files = _iter_documents()
        done = skipped = failed = 0
        for path in files:
            try:
                if encrypt_file(path):
                    done += 1
                else:
                    skipped += 1
            except Exception as exc:  # noqa: BLE001
                # Never abort the run: one unreadable file must not leave the
                # remaining hundred in plaintext.
                failed += 1
                print(f"  !! {path.name}: {exc}")
        print(f"  encrypted {done}, already encrypted {skipped}, failed {failed}")
        if failed:
            print("  Re-run after looking at the failures above; this is safe to repeat.")
        return 1 if failed else 0

    print(__doc__.strip().splitlines()[0])
    print()
    print("  python -m app.core.docvault generate   a fresh key for .env")
    print("  python -m app.core.docvault status     what is encrypted right now")
    print("  python -m app.core.docvault backfill   encrypt everything not yet encrypted")
    print()
    print("  Back the key up before running backfill. Losing it means every")
    print("  identity document on the platform is permanently unreadable.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(_cli(sys.argv[1:]))

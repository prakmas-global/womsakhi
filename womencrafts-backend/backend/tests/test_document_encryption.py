from pathlib import Path

from app.core import docvault


def test_encryption_falls_back_when_storage_mount_cannot_rename(monkeypatch, tmp_path) -> None:
    key = docvault.generate_key()
    monkeypatch.setattr(docvault.settings, "DOCUMENT_ENCRYPTION_KEY", key)
    document = tmp_path / "identity.jpg"
    document.write_bytes(b"private identity document")

    def unsupported_rename(_self: Path, _target: Path):
        raise OSError("rename is not supported by this mounted storage")

    monkeypatch.setattr(Path, "replace", unsupported_rename)

    assert docvault.encrypt_file(document) is True
    assert document.read_bytes().startswith(docvault.MAGIC)
    assert docvault.read_file(document) == b"private identity document"
    assert not document.with_suffix(".jpg.enc-tmp").exists()

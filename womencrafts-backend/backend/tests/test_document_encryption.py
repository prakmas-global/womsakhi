from pathlib import Path
import errno

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


def test_encryption_accepts_gcs_fuse_chmod_semantics(monkeypatch, tmp_path) -> None:
    key = docvault.generate_key()
    monkeypatch.setattr(docvault.settings, "DOCUMENT_ENCRYPTION_KEY", key)
    document = tmp_path / "identity.jpg"
    document.write_bytes(b"private identity document")
    def gcs_fuse_chmod(path: Path, _mode: int):
        raise OSError(errno.EPERM, "Operation not permitted", str(path))

    def gcs_fuse_rename(path: Path, _target: Path):
        raise OSError(errno.EPERM, "Operation not permitted", str(path))

    monkeypatch.setattr(Path, "chmod", gcs_fuse_chmod)
    monkeypatch.setattr(Path, "replace", gcs_fuse_rename)

    assert docvault.encrypt_file(document) is True
    assert document.read_bytes().startswith(docvault.MAGIC)
    assert docvault.read_file(document) == b"private identity document"

"""
The selfie face check: a photo with more than one person is refused with
"too_many_faces"; a photo it cannot read, or one where no face is found, is
let through for the reviewer.

Pure — no database. The detector itself is exercised on plain drawn images
(no faces); the "two people" path is driven by stubbing the count, since the
repo carries no photographs of real people.
"""

import io

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core import faces
from app.routes import verification


def _upload(data: bytes, content_type: str = "image/jpeg") -> UploadFile:
    return UploadFile(io.BytesIO(data), filename="selfie.jpg", headers=Headers({"content-type": content_type}))


def _plain_jpeg() -> bytes:
    cv2 = pytest.importorskip("cv2")
    np = pytest.importorskip("numpy")
    img = np.full((480, 640, 3), 200, dtype=np.uint8)
    cv2.rectangle(img, (200, 120), (440, 360), (40, 90, 160), -1)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_count_people_cannot_read_is_none():
    pytest.importorskip("cv2")
    assert faces.count_people(b"%PDF-1.7 not a photo") is None


def test_count_people_no_face_is_zero():
    assert faces.count_people(_plain_jpeg()) == 0


async def test_crowded_selfie_is_refused(monkeypatch):
    monkeypatch.setattr(faces, "count_people", lambda data: 2)
    file = _upload(b"\xff\xd8 photo bytes")
    with pytest.raises(HTTPException) as err:
        await verification._refuse_crowded_selfie(file)
    assert err.value.status_code == 422
    assert err.value.detail["code"] == "too_many_faces"
    assert err.value.detail["message"].startswith("Too many faces are visible")


@pytest.mark.parametrize("people", [0, 1, None])
async def test_selfie_alone_or_unknown_passes_and_rewinds(monkeypatch, people):
    monkeypatch.setattr(faces, "count_people", lambda data: people)
    file = _upload(b"\xff\xd8 photo bytes")
    await verification._refuse_crowded_selfie(file)
    # The file is saved next, so it must be read from the start again.
    assert await file.read() == b"\xff\xd8 photo bytes"


async def test_non_image_selfie_is_not_checked(monkeypatch):
    def boom(data):
        raise AssertionError("a PDF must not reach the face counter")
    monkeypatch.setattr(faces, "count_people", boom)
    await verification._refuse_crowded_selfie(_upload(b"%PDF-1.7", "application/pdf"))

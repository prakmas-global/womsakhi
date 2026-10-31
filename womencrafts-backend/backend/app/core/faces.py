"""
How many people are in a selfie.

The verification selfie must show the applicant alone — a photo with a friend
or a crowd behind her cannot be matched to one person by a reviewer. This
counts the faces in the picture with YuNet, OpenCV's small neural face
detector (the model file ships in app/core/data, ~230 KB; no network, a few
tens of milliseconds per photo).

Two rules keep it from refusing a genuine selfie:

  · The selfie is "Photo holding ID", so the ID card's printed photo is often
    in the picture. A face counts as a person only when it is at least
    PERSON_SHARE of the largest face's width; the printed face on a card held
    up to the camera is far smaller than hers (about a third of her width or
    less, while someone beside or just behind her is well over a third).
  · A photo where no face is found is not refused here. Detectors miss faces
    in dim light, at an angle or behind a dupatta; a reviewer still sees every
    selfie, so a miss must never block an applicant.

Anything that cannot be decoded as an image (a PDF, HEIC the decoder does not
know) is passed through untouched for the reviewer.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

log = logging.getLogger(__name__)

MODEL = Path(__file__).parent / "data" / "face_detection_yunet_2023mar.onnx"
#: How sure the detector must be before a face counts. High: a false "second face" would wrongly refuse her selfie.
MIN_SCORE = 0.8
#: A face counts as a person when it is at least this share of the largest face's width.
PERSON_SHARE = 0.35
#: The longest side the photo is scaled to before looking — faster, and steadier on huge phone photos.
WORK_SIDE = 960

# One detector per thread: FaceDetectorYN keeps its input size as state.
_local = threading.local()


def _detector(w: int, h: int):
    import cv2  # local: the app starts even where OpenCV is not installed
    det = getattr(_local, "det", None)
    if det is None:
        det = _local.det = cv2.FaceDetectorYN.create(str(MODEL), "", (w, h), MIN_SCORE, 0.3, 50)
    det.setInputSize((w, h))
    return det


def count_people(data: bytes) -> int | None:
    """
    The number of people (large faces) in the photo, or None when the photo
    could not be read or OpenCV is not available — the caller then lets it
    through for a person to review.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:  # pragma: no cover - only on an install without OpenCV
        log.warning("faces: OpenCV is not installed; selfie face check skipped")
        return None
    if not MODEL.is_file():  # pragma: no cover - a broken checkout
        log.warning("faces: %s is missing; selfie face check skipped", MODEL.name)
        return None
    try:
        img = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:  # noqa: BLE001 - any decode failure means "cannot tell"
        return None
    if img is None or img.size == 0:
        return None
    h, w = img.shape[:2]
    scale = WORK_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]
    try:
        _, faces = _detector(w, h).detect(img)
    except cv2.error:  # pragma: no cover - a model the installed OpenCV cannot run
        log.exception("faces: detector failed; selfie face check skipped")
        return None
    if faces is None or len(faces) == 0:
        return 0
    widths = [float(f[2]) for f in faces]
    biggest = max(widths)
    return sum(1 for fw in widths if fw >= biggest * PERSON_SHARE)

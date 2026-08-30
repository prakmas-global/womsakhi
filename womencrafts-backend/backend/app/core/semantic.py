"""
Matching by meaning, in whatever language she wrote it.

The keyword matcher this sits in front of scored 19% on the evaluation set, and
the failure was not spread evenly: a query in Telugu, Tamil, Kannada, Bengali,
Punjabi or Urdu matched no keyword at all, fell through to the fallback, and got
the SAME default list every time regardless of what was asked. A woman typing in
her own script was not being matched — she was being shown a menu.

Keywords cannot fix that. You would need every word for "stitching" in eighteen
languages, plus the ways people actually spell them on a phone keyboard, plus
"silai" and "kutthu" and the rest. That list is never finished.

An embedding model puts a sentence somewhere in space by what it MEANS, and a
multilingual one puts the same meaning in the same place whatever the script. So
"నేను ఇంటి నుండి కుట్టు పని చేసి డబ్బు సంపాదించాలి" lands near "Tailoring &
Stitching" without anyone writing a Telugu keyword list.

── Why this model ────────────────────────────────────────────────────────────
`paraphrase-multilingual-MiniLM-L12-v2`: 50+ languages including every one this
app speaks, 384 dimensions, ~470MB, and it runs on the CPU in the same process.
No API, so it costs nothing per query and stays fast on a request path that runs
for every woman doing intake. It also means HER WORDS NEVER LEAVE THE SERVER —
what she types when she is describing being out of money is not something to
send to a third party for scoring.

── Why the keyword path stays ────────────────────────────────────────────────
If the model cannot load, matching degrades to what it did before rather than
failing. Someone asking for help gets a worse answer, never an error.
"""

from __future__ import annotations

import logging
import threading
from typing import Iterable, Optional

log = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_model = None
_load_failed = False
_lock = threading.Lock()

# Catalogue embeddings, keyed by the text they were built from. The catalogue
# changes rarely and this process serves many requests, so re-encoding the same
# forty items per intake would be pure waste.
_cache: dict[str, "object"] = {}


def available() -> bool:
    """Can we match by meaning at all? False sends callers back to keywords."""
    return _get_model() is not None


def _get_model():
    global _model, _load_failed
    if _model is not None or _load_failed:
        return _model
    with _lock:
        if _model is not None or _load_failed:
            return _model
        try:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(MODEL_NAME)
            log.info("semantic matching ready (%s)", MODEL_NAME)
        except Exception as exc:  # noqa: BLE001
            # Not fatal. Matching falls back to keywords; nobody sees an error.
            _load_failed = True
            log.warning("semantic matching unavailable, falling back to keywords: %s", exc)
    return _model


def describe(item: dict) -> str:
    """The text an item is matched ON.

    Name alone is too thin — "Tiffin Service Setup" does not contain the word
    food. The description and category are what let a sentence about cooking
    find it.
    """
    parts = [
        item.get("name") or item.get("title") or "",
        item.get("category") or item.get("type") or "",
        item.get("description") or item.get("desc") or "",
    ]
    return " — ".join(p.strip() for p in parts if p and p.strip())


def encode(texts: list[str]):
    """Embed, reusing anything already seen."""
    model = _get_model()
    if model is None:
        return None
    fresh = [t for t in texts if t not in _cache]
    if fresh:
        vectors = model.encode(fresh, normalize_embeddings=True, show_progress_bar=False)
        for text, vec in zip(fresh, vectors):
            _cache[text] = vec
    return [_cache[t] for t in texts]


def score(query: str, items: list[dict]) -> Optional[list[float]]:
    """How close each item is to what she wrote. None means keywords instead."""
    if not query.strip() or not items:
        return None
    model = _get_model()
    if model is None:
        return None
    try:
        import numpy as np

        item_vectors = encode([describe(i) for i in items])
        query_vector = model.encode([query], normalize_embeddings=True, show_progress_bar=False)[0]
        # Normalised vectors, so the dot product IS the cosine similarity.
        return [float(np.dot(query_vector, v)) for v in item_vectors]
    except Exception as exc:  # noqa: BLE001
        log.warning("semantic scoring failed, falling back to keywords: %s", exc)
        return None


def warm() -> None:
    """Load the model ahead of the first woman who needs it.

    Cold load is tens of seconds. Doing that inside her request means she waits
    for it, so the app calls this at startup instead.
    """
    _get_model()

"""
Sakhi's voice, and the mouth shapes that go with it.

Azure's neural TTS emits **viseme events** alongside the audio: a mouth-shape id
and its offset in milliseconds, for every sound. That is the whole reason this
service was chosen over a warmer-sounding one. The common alternative — driving
a jaw from audio loudness — always reads as a puppet, because loudness is not a
vowel: "oo" and "ee" are the same volume and completely different mouths.

**The key never leaves this process.** Synthesis happens server-side and the
browser receives audio plus a timing track. A speech key shipped to the client
is a key published to the world ([[Secrets]]).

**Audio is not stored.** It is generated, streamed once, and dropped. Her voice
saying her own words is personal data, and there is no reason to keep it.
"""

from __future__ import annotations

import asyncio
import base64
import re
from xml.sax.saxutils import escape
from dataclasses import dataclass, field

from app.core.config import settings
from app.core.plaintext import strip_markdown

# Locale -> the neural voice she speaks in. Confirmed against the portal's Voice
# Gallery; see docs/azure-speech.md. A locale we have no voice for falls back to
# Indian English rather than failing — she should still speak.
VOICES: dict[str, str] = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ur": "ur-IN-GulNeural",
    "ta": "ta-IN-PallaviNeural",
    "bn": "bn-IN-TanishaaNeural",
    "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "pa": "pa-IN-VaaniNeural",
    "ar": "ar-EG-SalmaNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "pt": "pt-BR-FranciscaNeural",
    "id": "id-ID-GadisNeural",
    "sw": "sw-KE-ZuriNeural",
}
FALLBACK_VOICE = "en-IN-NeerjaNeural"

# Azure returns 22 viseme ids. The avatar does not need 22 drawings — it needs
# to know how far the mouth opens, how wide it spreads, and how round it is.
# Everything else is detail a viewer cannot see at avatar size.
#
#   open  0 closed .. 1 wide open       jaw
#   wide  0 pursed .. 1 spread          corners
#   round 0 flat   .. 1 rounded         lips forward ("oo")
#
# id 21 (p/b/m) and id 0 (silence) are the two that MUST close completely —
# a "b" with the mouth open is the single most obvious lip-sync failure.
SHAPES: dict[int, tuple[float, float, float]] = {
    0:  (0.00, 0.35, 0.00),   # silence
    1:  (0.55, 0.55, 0.00),   # æ ə ʌ
    2:  (0.85, 0.45, 0.00),   # ɑ
    3:  (0.70, 0.30, 0.45),   # ɔ
    4:  (0.45, 0.60, 0.00),   # ɛ ʊ
    5:  (0.35, 0.45, 0.15),   # ɝ
    6:  (0.25, 0.85, 0.00),   # j i ɪ
    7:  (0.25, 0.10, 0.95),   # w u
    8:  (0.55, 0.25, 0.70),   # o
    9:  (0.75, 0.40, 0.35),   # aʊ
    10: (0.60, 0.30, 0.55),   # ɔɪ
    11: (0.70, 0.50, 0.10),   # aɪ
    12: (0.30, 0.45, 0.05),   # h
    13: (0.30, 0.35, 0.35),   # ɹ
    14: (0.35, 0.55, 0.00),   # l
    15: (0.15, 0.75, 0.00),   # s z
    16: (0.25, 0.45, 0.40),   # ʃ tʃ dʒ ʒ
    17: (0.20, 0.60, 0.00),   # ð
    18: (0.12, 0.55, 0.00),   # f v  — lower lip to teeth
    19: (0.25, 0.60, 0.00),   # d t n θ
    20: (0.30, 0.50, 0.00),   # k g ŋ
    21: (0.00, 0.40, 0.00),   # p b m — CLOSED
}


@dataclass
class Speech:
    audio_b64: str
    mime: str = "audio/mpeg"
    duration_ms: int = 0
    # [{at: ms, open: f, wide: f, round: f}] — everything the avatar needs.
    mouth: list[dict] = field(default_factory=list)


def voice_for(locale: str) -> str:
    return VOICES.get((locale or "en").split("-")[0], FALLBACK_VOICE)


# --- saying the name right ---------------------------------------------------
#
# Left as plain text, "WomSakhi" comes out with the wrong vowel — near enough to
# "W-M-Sakhi" to be heard as letters rather than a name. It is not being spelled
# out (a spelled version takes about 3.2s against 2.0s for the word, so the
# voice is reading it whole); the vowel in "Wom" is simply wrong.
#
# A brand name is the one word an assistant must never fumble, and there is no
# spelling of it in Latin letters that every one of seventeen voices reads the
# same way. So it is given explicitly, in IPA, and the voice is told rather than
# asked: "WOHM SAA-khee".
#
# Anything with real pronunciation in it has to go through SSML, which is why
# synthesis below builds a document instead of passing a bare string.
_BRAND = re.compile(r"\bWom\s*-?\s*Sakhi\b", re.IGNORECASE)
_BRAND_IPA = "ˈwoːm ˈsaːkʰiː"


# Sentence ends across the scripts this app speaks — a Hindi line ends in "।",
# an Urdu one in "۔", and neither should have a Latin full stop bolted on.
_ENDINGS = ".!?।॥۔؟:…"


def speakable(text: str) -> str:
    """The words without the formatting, and with a pause after each point.

    The stripping itself lives in `plaintext` because retrieval needs the same
    rule — see the note there. What is voice-specific is the line endings: a
    bullet list with no punctuation is spoken as one breathless sentence, and
    a full stop per line is what makes the voice pause and what gives the
    sentence-splitter in the browser something to cut on.
    """
    lines = []
    for line in strip_markdown(text).splitlines():
        line = line.strip()
        if not line:
            continue
        if line[-1] not in _ENDINGS:
            line += "."
        lines.append(line)
    return "\n".join(lines).strip()


def _ssml(text: str, locale: str) -> str:
    """Wrap her words so the brand name is pronounced rather than guessed at."""
    safe = escape(speakable(text))
    spoken = _BRAND.sub(
        f'<phoneme alphabet="ipa" ph="{_BRAND_IPA}">WomSakhi</phoneme>', safe
    )
    voice = voice_for(locale)
    # The voice name carries its own locale — "te-IN-ShrutiNeural" is Telugu
    # whatever xml:lang claims — but the document needs one and a mismatch makes
    # some voices hesitate.
    lang = "-".join(voice.split("-")[:2])
    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{lang}"><voice name="{voice}">{spoken}</voice></speak>'
    )


def available() -> bool:
    return bool(settings.AZURE_SPEECH_KEY)


def _synthesize_blocking(text: str, locale: str) -> Speech:
    import azure.cognitiveservices.speech as speechsdk

    cfg = speechsdk.SpeechConfig(
        subscription=settings.AZURE_SPEECH_KEY, region=settings.AZURE_SPEECH_REGION
    )
    cfg.speech_synthesis_voice_name = voice_for(locale)
    # MP3 rather than WAV: this travels to a phone on a slow connection, and
    # 48kbit mono is indistinguishable for speech at a fraction of the bytes.
    cfg.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
    )

    synth = speechsdk.SpeechSynthesizer(speech_config=cfg, audio_config=None)
    frames: list[dict] = []

    def on_viseme(evt):
        openness, wide, rounded = SHAPES.get(evt.viseme_id, SHAPES[0])
        frames.append({
            "at": evt.audio_offset // 10_000,   # 100ns ticks -> ms
            "open": openness, "wide": wide, "round": rounded,
        })

    synth.viseme_received.connect(on_viseme)
    result = synth.speak_ssml_async(_ssml(text, locale)).get()

    if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
        detail = ""
        if result.reason == speechsdk.ResultReason.Canceled:
            detail = str(result.cancellation_details.error_details)
        raise RuntimeError(f"Speech synthesis failed: {detail or result.reason}")

    # Always end closed. Without a final rest frame the mouth freezes mid-vowel
    # on the last word, which looks like the avatar has crashed.
    duration = int(result.audio_duration.total_seconds() * 1000) if result.audio_duration else 0
    frames.append({"at": max(duration, frames[-1]["at"] + 120 if frames else 120),
                   "open": 0.0, "wide": 0.35, "round": 0.0})

    return Speech(
        audio_b64=base64.b64encode(result.audio_data).decode("ascii"),
        duration_ms=duration,
        mouth=frames,
    )


async def speak(text: str, locale: str = "en") -> Speech:
    """Synthesis is blocking C code, so it goes to a thread — otherwise it stalls
    the event loop and every other request waits on one woman's sentence."""
    return await asyncio.to_thread(_synthesize_blocking, text.strip()[:1200], locale)

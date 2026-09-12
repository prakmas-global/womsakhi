/**
 * What to SAY when the microphone does not work.
 *
 * Every microphone in this app was wired the same way:
 *
 *     r.onerror = () => { setListening(false) }
 *
 * — the button lights up, goes dark again, and nothing else happens. On a
 * screen built for a woman who is speaking *because* reading is the hard part,
 * "nothing happened" is indistinguishable from "this app is broken", and the
 * most common cause by far is the one she could fix in two taps if anybody
 * told her: the browser is holding the microphone permission.
 *
 * So the failure gets words. Each message names what went wrong and what to do
 * next, and every one of them ends with the way out that always works — type
 * it instead. The text box is never taken away, which is what makes that
 * honest advice rather than a brush-off.
 *
 * Kept here rather than in any one screen because three screens have this
 * microphone — Ask Sakhi, the help composer, and the search palette — and a
 * message that only one of them shows is a message two thirds of the app is
 * still silent about.
 */

export type SpeechTone = "danger" | "warn" | "info";

export interface SpeechFailure {
  tone: SpeechTone;
  title: string;
  description: string;
}

/**
 * The browser's own error codes, as named in the Web Speech API.
 *
 * `aborted` is deliberately absent: it is what fires when SHE presses stop, or
 * when the screen navigates away mid-sentence. Announcing an error for an
 * outcome the user asked for is noise, and noise is how real messages get
 * ignored. `no-speech` is present but only as `info` — she opened her mouth
 * and the phone heard nothing, which is a nudge, not a fault.
 */
const FAILURES: Record<string, SpeechFailure> = {
  "not-allowed": {
    tone: "danger",
    title: "Your microphone is blocked",
    description:
      "This browser is not letting the app listen. Tap the lock or settings icon next to the web address, turn the microphone on for this site, then press the mic again. You can type your question in the meantime.",
  },
  "service-not-allowed": {
    tone: "danger",
    title: "Your microphone is blocked",
    description:
      "Your phone or browser has turned off speech for this site. Open your browser's site settings, allow the microphone, then press the mic again. You can type your question in the meantime.",
  },
  "audio-capture": {
    tone: "danger",
    title: "No microphone found",
    description:
      "Nothing on this device offered a microphone — another app may be holding it. Close anything that is recording or on a call, then press the mic again. You can type your question in the meantime.",
  },
  network: {
    tone: "danger",
    title: "Listening needs the internet",
    description:
      "Your words are turned into text online, and the connection dropped. Check your signal and press the mic again. You can type your question in the meantime.",
  },
  "language-not-supported": {
    tone: "warn",
    title: "This browser cannot listen in that language",
    description:
      "Try switching the language to English and pressing the mic again, or type your question in the language you want.",
  },
  "no-speech": {
    tone: "info",
    title: "I did not hear anything",
    description: "Press the mic and speak close to the phone, or type your question instead.",
  },
};

/** The last resort, for a code nobody has seen before. */
const UNKNOWN: SpeechFailure = {
  tone: "danger",
  title: "The microphone stopped",
  description:
    "Something interrupted the listening. Press the mic to try again, or type your question instead.",
};

/**
 * Shown where the browser has no recogniser at all.
 *
 * The microphone is not drawn on those browsers — a button that cannot work is
 * worse than no button — so this is the backstop for the paths that can still
 * reach `listen()` without one.
 */
export const SPEECH_UNSUPPORTED: SpeechFailure = {
  tone: "warn",
  title: "This browser cannot listen",
  description:
    "Speaking works in Chrome and in Safari. Here, type your question and you will get the same answer.",
};

/**
 * Turn a `SpeechRecognitionErrorEvent` into something she can act on.
 *
 * Returns `null` for the codes that are not failures — `aborted`, and an
 * absent code — so the caller can stay quiet rather than inventing an error.
 */
export function speechFailure(code: unknown): SpeechFailure | null {
  if (typeof code !== "string" || !code) return null;
  if (code === "aborted") return null;
  return FAILURES[code] ?? UNKNOWN;
}

/** Does this browser have speech recognition? Safe to call on the server. */
export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

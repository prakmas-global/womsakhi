"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Listening, using the browser's own speech recognition.
 *
 * Deliberately NOT the Azure SDK in the browser. Azure would need a token minted
 * server-side, a websocket, and ~1MB of JavaScript before she can hear the first
 * word — on the phones this app is built for, that is the difference between
 * talking to her and giving up. The browser's recogniser is already there, costs
 * nothing, and starts instantly.
 *
 * The trade is coverage: this is Chrome and Safari. Firefox has no support, and
 * those users keep the text box, which is why the text box never goes away.
 */

/*
  The Web Speech API, typed by hand.

  TypeScript ships no lib for it and the vendor-prefixed constructor is not on
  `Window`, so this used to be eight `any`s. These are the members this file
  actually touches — narrow on purpose, because a wider guess would be a
  fiction with a type annotation on it.
*/
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

/** Neither constructor is on `Window`, and Safari only has the prefixed one. */
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function recogniserCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function getRecogniser(): SpeechRecognitionLike | null {
  const Ctor = recogniserCtor();
  return Ctor ? new Ctor() : null;
}

export function listeningSupported(): boolean {
  return Boolean(recogniserCtor());
}

export function useListening(locale: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const stop = useCallback(() => {
    try {
      ref.current?.stop();
    } catch {
      /* Nothing to tell her. `stop()` throws only when recognition was already
         stopped, which is the state she asked for — reporting it would be
         announcing a failure to reach an outcome that has been reached. */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const rec = getRecogniser();
    if (!rec) {
      setError("This browser can't listen. You can type instead.");
      return;
    }
    ref.current = rec;
    // Interim results matter more than they look: seeing her own words appear
    // as she speaks is what tells a woman the microphone is actually working.
    rec.lang = locale;
    rec.continuous = false;
    rec.interimResults = true;
    setHeard("");
    setError("");

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      setHeard(final || interim);
      if (final.trim()) {
        setListening(false);
        finalRef.current(final.trim());
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
      // "no-speech" means she opened her mouth and nothing came out. That is not
      // an error worth showing — it is a prompt to try again.
      if (e?.error === "not-allowed") setError("Microphone permission is off.");
      else if (e?.error && e.error !== "no-speech" && e.error !== "aborted")
        setError("Couldn't hear that. Try again?");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [locale]);

  useEffect(() => () => {
    try {
      ref.current?.abort();
    } catch {
      /* Unmount cleanup, and there is nobody left to tell: this component is
         being removed from the page as this line runs. Aborting a recognition
         that has already ended is the only way it throws. */
    }
  }, []);

  return { listening, heard, error, start, stop, supported: listeningSupported() };
}

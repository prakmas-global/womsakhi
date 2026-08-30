"use client";

import { useCallback, useRef, useState } from "react";

import { apiSakhiSpeak } from "@/lib/sakhi-api";
import type { MouthFrame } from "./SakhiAvatar";

/**
 * Her voice and her words, arriving together.
 *
 * They used not to. The reply streamed onto the screen token by token, and only
 * once the whole thing had finished was it sent to be synthesised — so a woman
 * read the entire answer, waited several seconds in silence, and THEN heard it
 * spoken. Two versions of the same sentence, seconds apart. Nothing about that
 * reads as a person talking to you.
 *
 * So the reply is spoken a sentence at a time, as it arrives, and each sentence
 * appears on screen at the moment its audio starts playing. The two are the same
 * event now rather than two events that happen to be about the same words.
 *
 * The side effect is that she starts talking far sooner: the first sentence is
 * synthesised while the model is still writing the second, instead of everything
 * waiting for the last full stop.
 *
 * ── Why one sentence ahead ──────────────────────────────────────────────────
 * Synthesis takes about as long as a short sentence takes to say. Requesting the
 * next one while the current one plays hides that almost entirely; requesting
 * them all at once would flood the endpoint and arrive out of order.
 *
 * ── Sentence ends are not just full stops ───────────────────────────────────
 * Devanagari and Marathi end a sentence with "।", Urdu with "۔", Arabic asks
 * with "؟". Splitting on "." alone would hand Hindi one enormous run-on
 * sentence and lose the whole benefit for the languages that need it most.
 */

const ENDINGS = /([.!?।॥۔؟…]+)(\s|$)/;

/**
 * Markdown, removed once per sentence.
 *
 * The library guides are written with bold headings and the model quotes them
 * back, so replies arrive with "**" in them. The server strips it before
 * synthesis — a voice reads "**" as "asterisk asterisk" — but the same string
 * is what goes on screen, and the bubbles render plain text, so without this
 * she is heard correctly and *read* with stars all over her.
 *
 * Doing it here rather than on each streamed token is what makes it safe: by
 * the time a sentence reaches the queue it is whole, so there is no half-open
 * "**" to mangle.
 */
function plain(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")       // [text](url)
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")           // `code`
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")             // # heading
    .replace(/^\s{0,3}[-*+•]\s+/gm, "")             // - bullet
    .replace(/(\*{1,3}|_{1,3})(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2")
    .replace(/(\*{1,3}|_{1,3})(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2")
    .replace(/[*_`#]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
/** Below this, a fragment is held back and joined to the next one. */
const TOO_SHORT = 24;

export interface Speech {
  speaking: boolean;
  /** performance.now() at the moment audio actually began. */
  startedAt: number;
  track: MouthFrame[];
}

export function useSpeech({
  locale,
  onReveal,
  onSilent,
}: {
  locale: string;
  /** Called as each sentence STARTS being spoken — this is what puts it on screen. */
  onReveal: (sentence: string) => void;
  /** Called when her voice fails, so the words can be shown anyway. */
  onSilent: (text: string) => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [track, setTrack] = useState<MouthFrame[]>([]);

  const buffer = useRef("");           // streamed text not yet a whole sentence
  const queue = useRef<string[]>([]);  // sentences waiting their turn
  const ahead = useRef<Promise<Awaited<ReturnType<typeof apiSakhiSpeak>> | null> | null>(null);
  const busy = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);               // bumped to abandon everything in flight

  const stop = useCallback(() => {
    run.current += 1;
    audio.current?.pause();
    audio.current = null;
    buffer.current = "";
    queue.current = [];
    ahead.current = null;
    busy.current = false;
    setSpeaking(false);
  }, []);

  const synth = useCallback(
    (line: string) => apiSakhiSpeak(line, locale).catch(() => null),
    [locale],
  );

  const pump = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const mine = run.current;

    while (queue.current.length && run.current === mine) {
      const line = plain(queue.current.shift()!);
      if (!line) continue;
      const speech = await (ahead.current ?? synth(line));
      ahead.current = null;
      if (run.current !== mine) break;

      // Start the next one cooking while this one plays.
      if (queue.current.length) ahead.current = synth(queue.current[0]);

      if (!speech) {
        // No voice for this line — she still gets to read it.
        onReveal(line);
        onSilent(line);
        continue;
      }

      await new Promise<void>((done) => {
        const el = new Audio(`data:${speech.mime};base64,${speech.audio}`);
        audio.current = el;
        el.onplay = () => {
          // The words appear HERE, not when the text arrived from the model.
          onReveal(line);
          setTrack(speech.mouth);
          setStartedAt(performance.now());
          setSpeaking(true);
        };
        el.onended = () => done();
        el.onerror = () => { onReveal(line); done(); };
        void el.play().catch(() => { onReveal(line); done(); });
      });
    }

    busy.current = false;
    if (run.current === mine) setSpeaking(false);
  }, [synth, onReveal, onSilent]);

  /** Feed streamed text in. Whole sentences are spoken as soon as they exist. */
  const push = useCallback((chunk: string) => {
    buffer.current += chunk;
    for (;;) {
      const m = ENDINGS.exec(buffer.current);
      if (!m) break;
      const cut = m.index + m[1].length;
      const line = buffer.current.slice(0, cut).trim();
      // Hold a very short fragment back — "Yes." on its own is a clipped noise,
      // and it reads better joined to what follows.
      if (line.length < TOO_SHORT && buffer.current.length > cut) break;
      buffer.current = buffer.current.slice(cut).replace(/^\s+/, "");
      if (line) queue.current.push(line);
    }
    if (queue.current.length) void pump();
  }, [pump]);

  /** The model has finished: speak whatever is left, however short. */
  const flush = useCallback(() => {
    const rest = buffer.current.trim();
    buffer.current = "";
    if (rest) queue.current.push(rest);
    if (queue.current.length) void pump();
  }, [pump]);

  /** A one-off line that is not part of a stream (a greeting, a confirmation). */
  const speak = useCallback((text: string) => {
    const line = text.trim();
    if (!line) return;
    queue.current.push(line);
    void pump();
  }, [pump]);

  return { speaking, startedAt, track, push, flush, speak, stop };
}

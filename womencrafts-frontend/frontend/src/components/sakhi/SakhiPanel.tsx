"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, Square, X } from "lucide-react";

import SakhiFace, { type MouthFrame } from "./SakhiFace";
import {
  apiSakhiSpeak,
  sakhiChat,
  sakhiConfirm,
  type Helpline,
  type SakhiEvent,
} from "@/lib/sakhi-api";

/**
 * Sakhi, as a face you talk to.
 *
 * She speaks her answer and her mouth moves with it. The rule that shapes this
 * component: **the text is the product, the voice is an addition.** Her words
 * appear as they stream, before any audio exists — a woman on a slow connection
 * reads the answer immediately and hears it a moment later, rather than staring
 * at a silent face waiting for speech to synthesise.
 *
 * Audio is fetched only once the answer is complete, because a sentence
 * synthesised in fragments sounds like a robot reading a list.
 */

type Bubble =
  | { kind: "user" | "sakhi"; text: string }
  | { kind: "safety"; text: string; helplines: Helpline[] };

export default function SakhiPanel({ onClose }: { onClose: () => void }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [streaming, setStreaming] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; sentence: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [track, setTrack] = useState<MouthFrame[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles.length, streaming, pending]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  /** Speak a finished answer, starting mouth and audio on the same tick. */
  const say = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      const speech = await apiSakhiSpeak(text);
      stopSpeaking();
      const audio = new Audio(`data:${speech.mime};base64,${speech.audio}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      // The clock starts when the browser actually begins playing, not when we
      // asked it to — decode latency would otherwise offset every mouth shape.
      audio.onplay = () => {
        setStartedAt(performance.now());
        setSpeaking(true);
      };
      setTrack(speech.mouth);
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      // Losing her voice must not lose her answer. The text is already on screen.
    }
  }, [stopSpeaking]);

  const consume = useCallback((event: SakhiEvent, buf: { text: string }) => {
    switch (event.type) {
      case "text":
        buf.text += event.text;
        setStreaming(buf.text);
        break;
      case "safety":
        setBubbles((p) => [...p, { kind: "safety", text: event.text, helplines: event.helplines }]);
        break;
      case "confirm":
        setConversationId(event.conversation_id);
        setPending({ id: event.action_id, sentence: event.sentence });
        void say(event.sentence);
        break;
      case "action":
        setBubbles((p) => [...p, { kind: "sakhi", text: event.text }]);
        void say(event.text);
        break;
      case "error":
        setError(event.message);
        break;
      case "done": {
        if (event.conversation_id) setConversationId(event.conversation_id);
        const finished = buf.text;
        buf.text = "";
        if (finished.trim()) {
          setBubbles((p) => [...p, { kind: "sakhi", text: finished }]);
          void say(finished);
        }
        setStreaming("");
        break;
      }
    }
  }, [say]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    stopSpeaking();
    setBubbles((p) => [...p, { kind: "user", text: message }]);
    setDraft("");
    setError("");
    setBusy(true);
    const buf = { text: "" };
    try {
      await sakhiChat(message, conversationId, (e) => consume(e, buf));
    } finally {
      setBusy(false);
      setStreaming("");
    }
  }

  async function answer(approve: boolean) {
    if (!pending || !conversationId) return;
    const action = pending;
    setPending(null);
    setBusy(true);
    const buf = { text: "" };
    try {
      await sakhiConfirm(conversationId, action.id, approve, (e) => consume(e, buf));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wc-card flex h-[min(86vh,780px)] w-[min(94vw,420px)] flex-col overflow-hidden p-0">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-base font-bold text-ink">Sakhi</p>
          <p className="text-2xs text-ink-subtle">
            {speaking ? "Speaking…" : busy ? "Thinking…" : "Ask me anything"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {speaking && (
            <button onClick={stopSpeaking} aria-label="Stop speaking"
                    className="btn-outline h-9 w-9 p-0">
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="btn-outline h-9 w-9 p-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* her face */}
      <div className="flex shrink-0 justify-center bg-brand-tint/40 pt-1">
        <SakhiFace track={track} playing={speaking} startedAt={startedAt} size={210} />
      </div>

      <p className="border-y border-line bg-status-warn-bg px-3 py-1.5 text-center text-3xs leading-snug text-status-warn-ink">
        Sakhi is an assistant, not a person. She can be wrong — check anything important.
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
        {bubbles.length === 0 && !streaming && (
          <ul className="space-y-1.5">
            {["What sessions do I have coming up?",
              "I want to start earning from home",
              "Which programmes can I join?"].map((s) => (
              <li key={s}>
                <button onClick={() => void ask(s)} className="btn-outline w-full text-start text-xs">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        {bubbles.map((b, i) =>
          b.kind === "user" ? (
            <p key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-sm text-white">
              {b.text}
            </p>
          ) : b.kind === "safety" ? (
            <div key={i} className="rounded-xl border-2 border-status-danger-border p-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{b.text}</p>
              <ul className="mt-2 space-y-1">
                {b.helplines.map((h) => (
                  <li key={h.number}>
                    <a href={`tel:${h.number}`} className="btn-danger w-full text-xs">
                      Call {h.number} · {h.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p key={i} className="wc-soft max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3 py-2 text-sm text-ink">
              {b.text}
            </p>
          ),
        )}

        {streaming && (
          <p className="wc-soft max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3 py-2 text-sm text-ink">
            {streaming}
          </p>
        )}

        {pending && (
          <div className="rounded-xl border-2 border-brand-200 p-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
              Shall I do this?
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{pending.sentence}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => void answer(true)} className="btn-primary text-sm">Yes, do it</button>
              <button onClick={() => void answer(false)} className="btn-outline text-sm">No, leave it</button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
        className="flex items-end gap-2 border-t border-line p-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!!pending}
          placeholder="Ask anything…"
          className="wc-inset min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle disabled:opacity-60"
        />
        <button type="submit" disabled={!draft.trim() || busy || !!pending}
                aria-label="Send" className="btn-primary h-10 w-10 shrink-0 p-0 disabled:opacity-50">
          <Send className="h-4 w-4 rtl:rotate-180" />
        </button>
      </form>
    </div>
  );
}

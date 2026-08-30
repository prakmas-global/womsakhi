"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, MessageSquare, Mic, Send, Square, X } from "lucide-react";

import SakhiAvatar, { type MouthFrame } from "./SakhiAvatar";
import { useT } from "@/i18n";
import { useListening } from "./useListening";
import { useSpeech } from "./useSpeech";
import { dataChanged } from "@/lib/data-changed";
import {
  apiSakhiSpeak,
  sakhiChat,
  sakhiConfirm,
  type Helpline,
  type SakhiEvent,
} from "@/lib/sakhi-api";

/**
 * Sakhi, as a person you talk to — not a chat window with her photo on it.
 *
 * The difference is what the panel is FOR. A chat window is for reading; this is
 * for talking. She greets you out loud the moment she arrives and the main
 * control is a microphone. Text is still there, because some women are in a room
 * where they cannot speak and because one browser cannot listen — but it is the
 * fallback, not the point.
 *
 * ── Why she docks instead of taking the screen ──────────────────────────────
 * She sits in a panel on the side, and the app stays visible and usable behind
 * her. A full-screen takeover makes asking her something feel like leaving what
 * you were doing — you have to close her to check the thing she just mentioned.
 * Beside the page, she is someone helping with the screen you are already on.
 * On a phone there is no "beside", so she takes the sheet instead.
 *
 * ── Why she speaks the instant she opens ────────────────────────────────────
 * Browsers refuse to play audio that no gesture asked for. The tap that opens
 * her IS that gesture, so her greeting is synthesised and played inside that
 * same interaction. Wait until after the first answer and the browser has
 * already decided you are not allowed to make noise — which is exactly why the
 * first build was silent.
 */

type Turn =
  | { who: "her" | "you"; text: string }
  | { who: "safety"; text: string; helplines: Helpline[] };

export default function SakhiStage({
  onClose,
  locale = "en-IN",
}: {
  onClose: () => void;
  locale?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<{ id: string; sentence: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  // She arrives on her own. The transcript is there when you want it, not
  // wrapped around her by default — a window with her face in the corner is a
  // chat app, whereas she standing there and a window you can open is someone
  // who came over.
  const [showChat, setShowChat] = useState(false);
  // Her opening line was hardcoded English. A woman who set the app to Telugu
  // read a Telugu panel and was greeted in English, out loud, before she had
  // said anything — the first thing Sakhi ever does, in the wrong language.
  const t = useT();
  const GREETING = t("sakhi.greeting");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeted = useRef(false);
  const thread = useRef<HTMLDivElement>(null);
  // True while sentences arriving belong to one continuing reply, so they join
  // one bubble instead of scattering into several.
  const growing = useRef(false);

  // Her words appear as she says them. `onReveal` fires when a sentence's
  // audio actually starts, which is what keeps the two in step — see useSpeech.
  const {
    speaking, startedAt, track,
    push: pushSpeech, flush: flushSpeech, speak, stop: stopSpeaking,
  } = useSpeech({
    locale,
    onReveal: (line) =>
      setTurns((p) => {
        const last = p[p.length - 1];
        // Sentences of one reply join into one bubble rather than scattering
        // into several — she is saying one thing, not five.
        if (last && last.who === "her" && !("helplines" in last) && growing.current) {
          return [...p.slice(0, -1), { who: "her", text: `${last.text} ${line}`.trim() }];
        }
        growing.current = true;
        return [...p, { who: "her", text: line }];
      }),
    onSilent: () => setNote(t("sakhi.tapSpeaker")),
  });

  const consume = useCallback((event: SakhiEvent, buf: { text: string }) => {
    switch (event.type) {
      case "text":
        // Deliberately NOT painted on screen here. Text used to appear the
        // instant it arrived and the voice caught up seconds later, which is
        // two versions of the same sentence rather than one person talking.
        // It goes to the voice, and the voice puts it on screen as it says it.
        buf.text += event.text;
        pushSpeech(event.text);
        break;
      case "safety":
        // Distress is the one place that does not wait for a voice. The
        // helpline goes up the moment it exists.
        stopSpeaking();
        growing.current = false;
        setTurns((p) => [...p, { who: "safety", text: event.text, helplines: event.helplines }]);
        speak(event.text);
        break;
      case "confirm":
        setConversationId(event.conversation_id);
        setPending({ id: event.action_id, sentence: event.sentence });
        growing.current = false;
        speak(event.sentence);
        break;
      case "action":
        growing.current = false;
        speak(event.text);
        // The write has already landed in the database. Tell the screen, or the
        // programme she just left stays on it until she reloads by hand — which
        // reads as Sakhi having done nothing at all.
        if (event.approved && event.ok) dataChanged(event.tool);
        break;
      case "done": {
        if (event.conversation_id) setConversationId(event.conversation_id);
        buf.text = "";
        flushSpeech();          // speak whatever did not end in a full stop
        setThinking(false);
        break;
      }
    }
  }, [pushSpeech, flushSpeech, speak, stopSpeaking]);

  const ask = useCallback(async (text: string) => {
    const message = text.trim();
    growing.current = false;
    if (!message) return;
    stopSpeaking();
    setTurns((p) => [...p, { who: "you", text: message }]);
    setDraft("");
    setThinking(true);
    const buf = { text: "" };
    try {
      await sakhiChat(message, conversationId, (e) => consume(e, buf));
    } finally {
      setThinking(false);
    }
  }, [conversationId, consume, stopSpeaking]);

  const { listening, heard, error: micError, start, stop, supported } =
    useListening(locale, (text) => void ask(text));

  // She greets inside the opening gesture — see the note at the top.
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    growing.current = false;
    speak(GREETING);          // the queue puts it on screen as she says it
  }, [speak, GREETING]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the newest line in view. She is beside the thread, not above it, so
  // only this column scrolls — she never slides off the top mid-sentence.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, thinking, pending]);

  // Two things must never hide behind a toggle: a helpline she is offering,
  // and a confirmation she is waiting on. Both open the transcript themselves.
  useEffect(() => {
    if (pending || turns[turns.length - 1]?.who === "safety") setShowChat(true);
  }, [turns, pending]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  async function answer(approve: boolean) {
    if (!pending || !conversationId) return;
    const action = pending;
    setPending(null);
    setThinking(true);
    const buf = { text: "" };
    try {
      await sakhiConfirm(conversationId, action.id, approve, (e) => consume(e, buf));
    } finally {
      setThinking(false);
    }
  }

  const last = [...turns].reverse().find((t) => t.who === "her" || t.who === "safety");
  const status = listening ? t("sakhi.listening")
    : thinking ? t("sakhi.thinking")
    : speaking ? t("sakhi.speaking")
    : t("sakhi.tapToTalk");

  // What she last said, for the bubble beside her when the transcript is shut.
  const latest = listening && heard
    ? heard
    : (last && "text" in last ? last.text : "");

  return (
    /*
      Only Sakhi arrives. She stands on the page with her controls at her feet,
      and the conversation is a window you open beside her if you want to read
      it back. Opening a panel around her would make this a chat app that
      happens to have a portrait in it; this way someone came over, and the
      transcript is incidental.
    */
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-end gap-2 p-2 pb-[82px]
      sm:inset-x-auto sm:end-3 sm:gap-3 sm:p-3 sm:pb-4">
      {showChat && (
        <div className="wc-card pointer-events-auto flex min-w-0 flex-1 flex-col overflow-hidden p-0
          h-[62vh] sm:h-[min(520px,76vh)] sm:w-[360px] sm:flex-none">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-ink">Sakhi</p>
              <p className="truncate text-2xs text-ink-subtle">{status}</p>
            </div>
            <button onClick={() => setShowChat(false)} aria-label={t("sakhi.hideChat")}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-subtle hover:bg-surface-hover">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={thread} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {turns.map((t, i) => {
              if (t.who === "you") {
                return (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
                      {t.text}
                    </p>
                  </div>
                );
              }
              const danger = t.who === "safety";
              return (
                <div key={i} className="flex flex-col items-start">
                  <p className={`max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-relaxed ${
                    danger ? "bg-status-danger-bg text-status-danger-ink" : "bg-surface-inset text-ink"
                  }`}>
                    {t.text}
                  </p>
                  {danger && "helplines" in t && (
                    <ul className="mt-2 w-full space-y-1.5">
                      {t.helplines.map((h) => (
                        <li key={h.number}>
                          <a href={`tel:${h.number}`} className="btn-danger w-full text-xs">
                            Call {h.number} · {h.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {listening && heard && (
              <div className="flex justify-end">
                <p className="max-w-[88%] rounded-2xl rounded-br-md border-2 border-dashed border-brand-200 px-3 py-2 text-[13px] leading-relaxed text-brand-ink">
                  {heard}
                </p>
              </div>
            )}

            {thinking && !speaking && (
              <div className="flex justify-start">
                <span className="flex gap-1 rounded-2xl rounded-bl-md bg-surface-inset px-3 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle"
                          style={{ animationDelay: `${d * 140}ms` }} />
                  ))}
                </span>
              </div>
            )}

            {pending && (
              <div className="rounded-xl border-2 border-brand-200 p-3">
                <p className="text-sm font-semibold text-ink">{pending.sentence}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => void answer(true)} className="btn-primary text-xs">{t("sakhi.confirmYes")}</button>
                  <button onClick={() => void answer(false)} className="btn-outline text-xs">{t("sakhi.confirmNo")}</button>
                </div>
              </div>
            )}

            {(micError || note) && (
              <p className="text-xs text-ink-subtle">{micError || note}</p>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-auto relative flex shrink-0 flex-col items-center">
        <span className="sr-only" aria-live="polite">{status}</span>

        {/*
          Close sits at her shoulder, not in the capsule at her feet.
          The bottom-right corner is the most contested space on the screen —
          the phone tab bar is there, and in development Next draws its own
          badge on top of everything, which silently swallows taps on whatever
          is beneath it. A control you need to reach every single time must not
          live where something else can cover it.
        */}
        <button
          onClick={onClose}
          aria-label={t("sakhi.close")}
          className="absolute -end-1 top-0 z-10 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-subtle shadow-lg transition hover:bg-surface-hover hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        {/* One line of what she just said, so you can follow her without
            opening anything. The full thread is a click away. */}
        {!showChat && latest && (
          <div className="relative mb-1.5 w-[190px] rounded-2xl bg-surface px-3 py-2 shadow-xl ring-1 ring-line sm:w-[250px]">
            <p className="line-clamp-4 text-[13px] leading-relaxed text-ink">{latest}</p>
            <span className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-surface" />
          </div>
        )}

        {/* She is larger when she is on her own, and steps aside when the
            transcript is open so the words have room. */}
        <div className={showChat ? "w-[92px] sm:w-[200px]" : "w-[150px] sm:w-[252px]"}>
          <SakhiAvatar track={track} playing={speaking} startedAt={startedAt} greeting={greeted.current} />
        </div>

        {/* her controls, at her feet */}
        <div className="-mt-4 flex items-center gap-1 rounded-full border border-line bg-surface/95 px-1.5 py-1.5 shadow-xl backdrop-blur sm:gap-1.5 sm:px-2">
          <button onClick={() => setTyping((v) => !v)} aria-label={t("sakhi.typeInstead")}
                  aria-pressed={typing}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    typing ? "bg-brand-tint text-brand-ink" : "text-ink-subtle hover:bg-surface-hover"}`}>
            <Keyboard className="h-4 w-4" />
          </button>

          {speaking ? (
            <button onClick={stopSpeaking} aria-label={t("sakhi.stop")}
                    className="grid h-12 w-12 place-items-center rounded-full bg-surface-inset text-ink-muted ring-2 ring-brand-200">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => (listening ? stop() : start())}
              disabled={!supported || thinking || !!pending}
              aria-label={listening ? t("sakhi.stop") : t("sakhi.talk")}
              className={`grid h-12 w-12 place-items-center rounded-full text-white shadow-lg transition disabled:opacity-40 ${
                listening ? "animate-pulse bg-status-danger-solid ring-2 ring-status-danger-border"
                          : "bg-brand-600 ring-2 ring-brand-200"
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}

          <button onClick={() => setShowChat((v) => !v)} aria-pressed={showChat}
                  aria-label={showChat ? t("sakhi.hideChat") : t("sakhi.showChat")}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    showChat ? "bg-brand-tint text-brand-ink" : "text-ink-subtle hover:bg-surface-hover"}`}>
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>

        {typing && (
          <form
            onSubmit={(e) => { e.preventDefault(); void ask(draft); setTyping(false); }}
            className="mt-2 flex w-[190px] items-center gap-2 rounded-full border border-line bg-surface p-1 shadow-xl sm:w-[252px]"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("sakhi.placeholder")}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none"
            />
            <button type="submit" disabled={!draft.trim()} aria-label={t("sakhi.send")}
                    className="btn-primary h-9 w-9 shrink-0 p-0 disabled:opacity-40">
              <Send className="h-4 w-4 rtl:rotate-180" />
            </button>
          </form>
        )}

        {!showChat && (micError || note) && (
          <p className="mt-1.5 max-w-[190px] text-center text-2xs text-ink-subtle sm:max-w-[252px]">
            {micError || note}
          </p>
        )}
      </div>
    </div>
  );
}

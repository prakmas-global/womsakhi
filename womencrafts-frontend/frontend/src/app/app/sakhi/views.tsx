"use client";

/**
 * Everything Sakhi draws, separated from everything Sakhi does.
 *
 * ── Why the split is here ───────────────────────────────────────────────────
 * The page was 1,054 lines holding the conversation loop, the streaming state,
 * the tool-approval flow AND six view components. The views take fully-typed
 * props and close over none of that state, which is what makes this a genuine
 * responsibility boundary rather than a line-count exercise: the page owns
 * *what happens*, this file owns *what it looks like*.
 *
 * Reading the approval flow no longer means scrolling past the rail's search
 * box, and changing the rail cannot touch the streaming logic.
 */

import { useGreeting } from "@/lib/use-greeting";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useI18n, LOCALES } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CAN, FOLLOW_UPS, MODE_PREFIX, STARTERS, WONT } from "@/components/ux/sakhi/prompts";
import { Actions, Answer, Cites, Composer, DraftCard, Ico, ModeSwitch, Picker, StopPill, Typing } from "@/components/ux/sakhi/parts";
import {
  apiSakhiConversation,
  apiSakhiConversations,
  apiSakhiDelete,
  apiSakhiPin,
  apiSakhiRate,
  apiSakhiRename,
  apiSakhiSave,
  apiSakhiSaved,
  apiSakhiStatus,
  apiSakhiUnsave,
  sakhiChat,
  type SakhiSaved,
  sakhiConfirm,
  type Helpline,
  type SakhiConversation,
  type SakhiEvent,
} from "@/lib/sakhi-api";

/**
 * Ask Sakhi.
 *
 * ── Three things here are deliberate and worth not undoing ──────────────────
 *
 * **The confirmation is a card in the thread, not a dialog.** A dialog on a
 * phone covers the conversation it is asking about, so she has to remember what
 * she asked while deciding whether to allow it. The card sits inline with the
 * sentence the *server* built from the database, and both buttons are the same
 * size — "no" is not a smaller, greyer afterthought.
 *
 * **A safety reply looks nothing like Sakhi.** When the gate fires the answer
 * renders as a bordered panel with tappable phone numbers, never as a chat
 * bubble. She should be able to tell at a glance that this is not the assistant
 * talking.
 *
 * **The disclosure is always visible**, under the composer where she is
 * typing — not behind an info icon that gets read once and never again.
 *
 * ── What is wired, and what is not ──────────────────────────────────────────
 * Streaming, conversations, history, delete, the pending-action confirm and
 * stop all go to the real API. Mode is a real instruction prepended to the
 * message. Language really switches the app's locale. Voice really uses the
 * browser's recogniser where it exists, and hides itself where it does not.
 *
 * Naming, pinning, thumbs and saved answers all go to the server too. They
 * lived in `localStorage` first, which made them per-device — a member who
 * pinned a conversation on a borrowed phone found it unpinned on her own. They
 * are hers, so they live with her account.
 */

export type Bubble =
  | { kind: "user"; text: string; file?: string }
  | { kind: "assistant"; text: string; tools?: string[]; id?: string }
  | { kind: "action"; text: string; ok: boolean }
  | { kind: "safety"; text: string; helplines: Helpline[] };

/** "2m" · "4h" · "Yesterday" · "14 Aug". Short enough for a 320px rail. */
function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  if (mins < 48 * 60) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(then));
}

export function ConvBar({
  title, mode, locale, pinned, onRename, onPin, onShare,
}: {
  title: string; mode: string; locale: string; pinned: boolean;
  onRename: () => void; onPin: () => void; onShare: () => void;
}) {
  const chip = "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold";
  const chipStyle = { background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)",
                      color: "var(--ux-muted)" } as const;
  const tool = "ux-press grid h-[32px] w-[32px] place-items-center rounded-[8px]";

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b pb-3" style={{ borderColor: "var(--ux-line)" }}>
      <b className="truncate text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>{title}</b>
      <span className={chip} style={chipStyle}><Icons.Zap className="h-[12px] w-[12px]" />{mode}</span>
      <span className={chip} style={chipStyle}><Icons.Globe className="h-[12px] w-[12px]" />{locale}</span>
      <span className="ms-auto flex gap-0.5">
        <button type="button" onClick={onRename} title="Rename" aria-label="Rename this conversation"
                className={tool} style={{ color: "var(--ux-faint)" }}>
          <Icons.PenLine className="h-[15px] w-[15px]" />
        </button>
        <button type="button" onClick={onPin} title={pinned ? "Unpin" : "Pin"}
                aria-label={pinned ? "Unpin this conversation" : "Pin this conversation"} aria-pressed={pinned}
                className={tool} style={{ color: pinned ? "var(--ux-brand)" : "var(--ux-faint)" }}>
          <Icons.Pin className="h-[15px] w-[15px]" />
        </button>
        <button type="button" onClick={onShare} title="Share" aria-label="Share"
                className={tool} style={{ color: "var(--ux-faint)" }}>
          <Icons.Share2 className="h-[15px] w-[15px]" />
        </button>
      </span>
    </div>
  );
}

/* ── the always-on disclosure ───────────────────────────────────────────── */

export function Disclosure({ text }: { text: string }) {
  return (
    <p className="mt-2.5 flex items-center justify-center gap-2 text-center text-[0.75rem]"
       style={{ color: "var(--ux-muted)" }}>
      <Icons.Sparkles className="h-[13px] w-[13px] shrink-0" />
      {text || "Sakhi can be wrong — check anything important before you act on it."}
    </p>
  );
}

/* ── welcome ────────────────────────────────────────────────────────────── */

export function Welcome({
  first, onPick, canVoice, children, switcher,
}: {
  first: string; onPick: (q: string) => void; canVoice: boolean;
  children: React.ReactNode; switcher: React.ReactNode;
}) {
  const greeting = useGreeting();
  return (
    <section className="relative overflow-hidden rounded-[20px] p-6 text-center sm:p-8"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[-90px] h-[400px] w-[400px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, var(--ux-brand-tint-2), transparent 70%)" }} />
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/sakhi-still.webp" alt="Sakhi" draggable={false}
             className="ux-bob mx-auto block h-[150px] w-[150px] object-contain" />
        <h2 className="mt-4 text-[clamp(1.3125rem,2.8vw,1.875rem)] font-extrabold leading-tight tracking-[-0.03em]"
            style={{ color: "var(--ux-ink)" }}>
          {greeting}, {first || "friend"}.<br />
          <span style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                         WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            What do you need today?
          </span>
        </h2>
        <p className="mt-2 text-[0.875rem]" style={{ color: "var(--ux-muted)" }}>
          Work, money, a course, or something you do not understand — ask{canVoice ? " or speak" : ""}.
        </p>

        <div className="mx-auto mt-6 max-w-[700px] text-start">{children}</div>

        {canVoice && (
          <div className="mt-5">{switcher}</div>
        )}

        <p className="mb-3 mt-8 text-start text-[0.6875rem] font-bold uppercase tracking-[0.18em]"
           style={{ color: "var(--ux-faint)" }}>
          Try asking
        </p>
        <div className="grid grid-cols-1 gap-2.5 text-start sm:grid-cols-2">
          {STARTERS.map((s) => (
            <button key={s.title} type="button" onClick={() => onPick(s.ask)}
                    className="ux-card ux-tile group flex items-center gap-3 rounded-[16px] p-3.5 text-start"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                             ["--ux-glow" as string]: `color-mix(in oklab, var(${s.ink}) 22%, transparent)` }}>
              <span className="ux-tile-ic grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                    style={{ background: `var(${s.tint})`, color: `var(${s.ink})` }}>
                <Ico name={s.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-bold" style={{ color: "var(--ux-ink)" }}>{s.title}</span>
                <span className="mt-0.5 block text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{s.note}</span>
              </span>
              <Icons.ArrowRight className="h-[15px] w-[15px] shrink-0 transition-transform group-hover:translate-x-0.5"
                                style={{ color: "var(--ux-faint)" }} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── voice ──────────────────────────────────────────────────────────────── */

export function Voice({
  heard, listening, onToggle, onEnd, locale, setLocale, localeItems, showWords, onToggleWords, switcher,
}: {
  heard: string; listening: boolean; onToggle: () => void; onEnd: () => void;
  locale: string; setLocale: (v: string) => void;
  localeItems: { value: string; label: string; note?: string }[];
  showWords: boolean; onToggleWords: () => void; switcher: React.ReactNode;
}) {
  const here = localeItems.find((l) => l.value === locale)?.label ?? "English";
  return (
    <section className="relative overflow-hidden rounded-[20px] p-8 text-center"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[-110px] h-[440px] w-[440px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, var(--ux-brand-tint-2), transparent 70%)" }} />
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/sakhi-still.webp" alt="Sakhi" draggable={false}
             className="ux-bob mx-auto block h-[180px] w-[180px] object-contain" />

        <div className="ux-eq mx-auto mt-5 flex h-[52px] items-center justify-center gap-[4px]" aria-hidden>
          {[16, 30, 46, 26, 52, 22, 36, 14].map((h, i) => (
            <i key={h} className="block w-[5px] rounded-full"
               style={{ height: h, animationDelay: `${i * 0.06}s`, opacity: listening ? 1 : 0.25,
                        background: "linear-gradient(180deg, var(--ux-rib-2), var(--ux-rib-3))" }} />
          ))}
        </div>

        {/* Hideable, because a live transcript of your own voice is a comfort
            to some and a distraction to others. */}
        {showWords && (
          <p className="mx-auto mt-5 max-w-[520px] text-[1.125rem] font-semibold leading-relaxed"
             style={{ color: "var(--ux-ink)" }}>
            {heard ? `“${heard}”` : "I am listening…"}
          </p>
        )}
        <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
          {listening ? `Speak in ${here} — stop when you are done` : "Tap the microphone to speak again"}
        </p>

        <div className="mt-6">{switcher}</div>

        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Picker icon="Globe" title="Language" label={here}
                  items={localeItems} value={locale} onPick={setLocale} />
          <button type="button" onClick={onToggleWords}
                  aria-pressed={showWords}
                  className="ux-press flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[0.8125rem] font-bold"
                  style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
            <Ico name={showWords ? "EyeOff" : "Eye"} className="h-4 w-4" />
            {showWords ? "Hide the words" : "Show the words"}
          </button>
          <button type="button" onClick={onToggle}
                  className="ux-press flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[0.8125rem] font-bold"
                  style={listening
                    ? { background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)", border: "1px solid var(--ux-pink)" }
                    : { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            <Ico name={listening ? "MicOff" : "Mic"} className="h-4 w-4" />
            {listening ? "Stop listening" : "Speak"}
          </button>
          <button type="button" onClick={onEnd}
                  className="ux-press flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[0.8125rem] font-bold"
                  style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
            <Icons.X className="h-4 w-4" /> End voice
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── the thread ─────────────────────────────────────────────────────────── */

export function Thread({
  bubbles, streaming, toolRunning, pending, onAnswer, busy,
  saved, toggleSave, votes, setVote, onRetry, onFollowUp, onStop, onChangeDraft,
}: {
  bubbles: Bubble[]; streaming: string; toolRunning: boolean;
  onStop: () => void; onChangeDraft: (t: string) => void;
  pending: { id: string; sentence: string } | null;
  onAnswer: (approve: boolean) => void; busy: boolean;
  saved: SakhiSaved[]; toggleSave: (t: string) => void;
  votes: Record<number, "up" | "down">; setVote: (i: number, v: "up" | "down", id?: string) => void;
  onRetry: () => void; onFollowUp: (q: string) => void;
}) {
  const lastAssistant = bubbles.map((b) => b.kind).lastIndexOf("assistant");

  return (
    <div className="flex flex-col gap-4">
      {bubbles.map((b, i) => {
        if (b.kind === "user") {
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[76%] rounded-[16px] rounded-br-[4px] px-4 py-3 text-[0.875rem] leading-relaxed"
                   style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                            color: "var(--ux-on-brand)" }}>
                {b.file && (
                  <span className="mb-2 flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[0.75rem]"
                        style={{ background: "var(--ux-on-brand-track)" }}>
                    <Icons.Paperclip className="h-[13px] w-[13px] shrink-0" />
                    <span className="truncate">{b.file}</span>
                  </span>
                )}
                {b.text}
              </div>
            </div>
          );
        }

        if (b.kind === "safety") {
          /* Deliberately unlike a chat bubble — she must be able to tell at a
             glance that this is not the assistant talking. */
          return (
            <section key={i} className="rounded-[16px] p-4"
                     style={{ background: "var(--ux-tint-pink)", border: "1px solid var(--ux-pink)" }}>
              <p className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.12em]"
                 style={{ color: "var(--ux-pink-ink)" }}>
                <Icons.LifeBuoy className="h-[15px] w-[15px]" /> Help, right now
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: "var(--ux-ink)" }}>{b.text}</p>
              <ul className="mt-3 space-y-2">
                {b.helplines.map((h) => (
                  <li key={h.number}>
                    <a href={`tel:${h.number}`}
                       className="ux-press flex min-h-[44px] items-center gap-3 rounded-[12px] px-3.5"
                       style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-pink)" }}>
                      <Icons.Phone className="h-4 w-4 shrink-0" style={{ color: "var(--ux-pink-ink)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-bold" style={{ color: "var(--ux-ink)" }}>{h.name}</span>
                        <span className="block truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{h.desc}</span>
                      </span>
                      <span className="shrink-0 text-[0.8125rem] font-bold" style={{ color: "var(--ux-pink-ink)" }}>{h.number}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (b.kind === "action") {
          return (
            <p key={i} className="flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-[0.75rem] font-semibold"
               style={{ background: b.ok ? "var(--ux-tint-green)" : "var(--ux-tint-pink)",
                        color: b.ok ? "var(--ux-green-ink)" : "var(--ux-pink-ink)" }}>
              <Ico name={b.ok ? "CircleCheck" : "CircleX"} className="h-[14px] w-[14px]" />
              {b.text}
            </p>
          );
        }

        return (
          <div key={i} className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
            <div className="min-w-0 max-w-[82%] rounded-[16px] rounded-bl-[4px] p-4"
                 style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <Answer text={b.text} />
              <Cites tools={b.tools ?? []} />
              <Actions
                text={b.text}
                onRetry={i === lastAssistant ? onRetry : undefined}
                onSave={() => toggleSave(b.text)}
                saved={saved.some((s) => s.text === b.text)}
                vote={votes[i] ?? null}
                onVote={(v) => setVote(i, v, b.id)}
              />
            </div>
          </div>
        );
      })}

      {streaming && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
          <div className="min-w-0 max-w-[82%] rounded-[16px] rounded-bl-[4px] p-4"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Answer text={streaming} />
          </div>
        </div>
      )}

      {busy && !streaming && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
          <span className="flex items-center gap-2 rounded-[16px] rounded-bl-[4px] px-4 py-3"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Typing />
            {toolRunning && (
              <span className="text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>looking it up…</span>
            )}
          </span>
        </div>
      )}

      {busy && <StopPill onStop={onStop} />}

      {pending && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <DraftCard sentence={pending.sentence} busy={busy}
                       onApprove={() => onAnswer(true)} onReject={() => onAnswer(false)}
                       onChange={() => onChangeDraft(pending.sentence)} />
          </div>
        </div>
      )}

      {/* Shortcuts for typing, offered once she has an answer to build on. */}
      {!busy && !pending && lastAssistant >= 0 && (
        <div className="ms-[48px] flex flex-wrap gap-2">
          {FOLLOW_UPS.map((q) => (
            <button key={q} type="button" onClick={() => onFollowUp(q)}
                    className="ux-press flex min-h-[38px] items-center gap-2 rounded-full px-4 text-[0.8125rem] font-semibold"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                             color: "var(--ux-ink-2)" }}>
              <Icons.Sparkles className="h-[13px] w-[13px]" style={{ color: "var(--ux-brand)" }} />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── the rail ───────────────────────────────────────────────────────────── */

export function SakhiRail({
  grouped, search, setSearch, openConversation, remove, togglePin, current, total,
}: {
  grouped: { label: string; rows: SakhiConversation[] }[]; total: number;
  search: string; setSearch: (v: string) => void;
  openConversation: (id: string) => void; remove: (id: string) => void;
  togglePin: (id: string) => void; current: string | null;
}) {
  const card = "ux-sq rounded-[16px] p-4";
  const cardStyle = { background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" } as const;

  return (
    <div className="sticky top-4 flex flex-col gap-4">
      <section className={card} style={cardStyle}>
        <h3 className="mb-3 flex items-center gap-2 text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>
          <Icons.Sparkles className="h-[15px] w-[15px]" style={{ color: "var(--ux-brand)" }} />
          What she can do
        </h3>
        <ul className="space-y-2.5">
          {CAN.map((c) => (
            <li key={c.text} className="flex gap-2.5 text-[0.8125rem] leading-snug" style={{ color: "var(--ux-muted)" }}>
              <Ico name={c.icon} className="mt-[2px] h-[15px] w-[15px] shrink-0" />
              {c.text}
            </li>
          ))}
        </ul>
      </section>

      <section className={card} style={cardStyle}>
        <h3 className="mb-3 flex items-center gap-2 text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>
          <Icons.ShieldCheck className="h-[15px] w-[15px]" style={{ color: "var(--ux-pink-ink)" }} />
          What she will not do
        </h3>
        <ul className="space-y-2.5">
          {WONT.map((w) => (
            <li key={w} className="flex gap-2.5 text-[0.8125rem] leading-snug" style={{ color: "var(--ux-muted)" }}>
              <Icons.ShieldCheck className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-pink-ink)", opacity: 0.7 }} />
              {w}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-faint)" }}>
          She drafts and suggests. Anything that moves money or speaks as you needs your yes first —
          in a sentence you can read, with the same-sized button for no.
        </p>
      </section>

      {/*
        Capped, and scrolling inside itself.

        Every conversation was listed, so the rail grew without limit and the
        page's whole scroll length became a function of how much she has asked
        Sakhi — a member with sixty chats had to scroll past sixty of them to
        reach the bottom of a screen that has nothing down there. The card is
        now a fixed object with its own scrollbar.
      */}
      <section className={card} style={cardStyle}>
        <h3 className="mb-3 flex items-center gap-2 text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>
          <Icons.Clock className="h-[15px] w-[15px]" style={{ color: "var(--ux-brand)" }} />
          Your conversations
          {total > 0 && (
            <span className="ms-auto rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
              {total}
            </span>
          )}
        </h3>
        <label className="mb-2 flex h-[36px] items-center gap-2 rounded-[12px] px-3"
               style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
          <Icons.Search className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search your chats" aria-label="Search your conversations"
                 className="w-full bg-transparent text-[0.8125rem] outline-none" style={{ color: "var(--ux-ink)" }} />
        </label>

        {grouped.length === 0 ? (
          <p className="py-3 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {search ? "Nothing matches that." : "Your conversations will be listed here."}
          </p>
        ) : (
          <div className="-me-1 max-h-[340px] space-y-1 overflow-y-auto pe-1"
               style={{ scrollbarWidth: "thin",
                        // Fades the last row rather than slicing it, so it is
                        // obvious there is more below without a scrollbar.
                        maskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)",
                        WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)" }}>
            {grouped.map((g) => (
              <div key={g.label}>
                <p className="px-1 pb-1 pt-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.15em]"
                   style={{ color: "var(--ux-faint)" }}>
                  {g.label}
                </p>
                {g.rows.map((c) => (
                  <div key={c.id} className="group flex items-center gap-1">
                    <button type="button" onClick={() => openConversation(c.id)}
                            className="ux-row flex min-w-0 flex-1 items-baseline gap-2 rounded-[8px] px-2 py-2 text-start text-[0.8125rem]"
                            style={{ background: c.id === current ? "var(--ux-brand-tint)" : "transparent",
                                     color: c.id === current ? "var(--ux-brand)" : "var(--ux-ink-2)" }}>
                      <span className="min-w-0 flex-1 truncate">{c.title || "Untitled"}</span>
                      {/* Four chats can share a title. The time is what tells
                          them apart. */}
                      <span className="shrink-0 text-[0.6875rem] tabular-nums" style={{ color: "var(--ux-faint)" }}>
                        {shortWhen(c.updated_at)}
                      </span>
                    </button>
                    {/* Revealed on hover and on keyboard focus — `opacity-0`
                        alone would hide them from anyone not using a mouse. */}
                    <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button type="button" onClick={() => togglePin(c.id)}
                              aria-label={c.pinned ? "Unpin" : "Pin"}
                              className="ux-press grid h-[28px] w-[28px] place-items-center rounded-[8px]"
                              style={{ color: c.pinned ? "var(--ux-brand)" : "var(--ux-faint)" }}>
                        <Icons.Pin className="h-[14px] w-[14px]" />
                      </button>
                      <button type="button" onClick={() => remove(c.id)} aria-label="Delete"
                              className="ux-press grid h-[28px] w-[28px] place-items-center rounded-[8px]"
                              style={{ color: "var(--ux-faint)" }}>
                        <Icons.Trash2 className="h-[14px] w-[14px]" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "@/components/ux/icons";
import { ChatInput, SendButton } from "./chat";

/**
 * Ask Sakhi — the pieces.
 *
 * Presentation only. Every one of these is dumb on purpose: the page owns the
 * stream, the conversation and the pending action, and this file owns how they
 * look. Splitting it the other way is how a chat screen becomes impossible to
 * change.
 */

export function Ico({ name, className, sw = 1.9 }: { name: string; className?: string; sw?: number }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={sw} />;
}

/* ── a dropdown that closes the way people expect ───────────────────────── */

export function Picker({
  icon, label, items, value, onPick, title,
}: {
  icon: string; label: string; title: string;
  items: { value: string; label: string; note?: string }[];
  value: string; onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); wrap.current?.querySelector("button")?.focus(); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button type="button" title={title} aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="ux-hov flex h-[34px] items-center gap-1.5 rounded-[12px] px-2.5 text-xs transition-colors hover:bg-[var(--ux-surface-2)]"
              style={{ color: "var(--ux-muted)" }}>
        <Ico name={icon} className="h-[14px] w-[14px]" />
        <b className="font-semibold" style={{ color: "var(--ux-ink-2)" }}>{label}</b>
        <Icons.ChevronDown className="h-[13px] w-[13px] opacity-60" />
      </button>
      {open && (
        <div role="menu"
             className="ux-pop absolute bottom-[calc(100%+8px)] start-0 z-50 max-h-[280px] w-[230px] overflow-y-auto rounded-[12px] p-1.5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                      boxShadow: "var(--ux-shadow-pop)" }}>
          {items.map((it) => (
            <button key={it.value} type="button" role="menuitem"
                    onClick={() => { onPick(it.value); setOpen(false); }}
                    className="ux-row flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-start"
                    style={{ background: it.value === value ? "var(--ux-brand-tint)" : "transparent",
                             color: it.value === value ? "var(--ux-brand)" : "var(--ux-ink)" }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-medium">{it.label}</span>
                {it.note && <span className="block truncate text-[12px] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>{it.note}</span>}
              </span>
              {it.value === value && <Icons.Check className="h-[14px] w-[14px] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── the composer ───────────────────────────────────────────────────────── */

export function Composer({
  value, onChange, onSend, onMic, listening, busy,
  mode, setMode, locale, setLocale, locales, placeholder, canVoice,
  file, onFile, onClearFile,
}: {
  value: string; onChange: (v: string) => void; onSend: () => void;
  onMic: () => void; listening: boolean; busy: boolean;
  mode: string; setMode: (v: string) => void;
  locale: string; setLocale: (v: string) => void;
  locales: { value: string; label: string; note?: string }[];
  placeholder: string; canVoice: boolean;
  file: File | null; onFile: (f: File | null) => void; onClearFile: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);

  // Grows with what she types, then scrolls. A fixed single line hides the
  // second half of a long question while she is still writing it.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [value]);

  const MODES = [
    { value: "quick", label: "Quick answer", note: "Short and to the point" },
    { value: "steps", label: "Step by step", note: "Explained slowly, in order" },
  ];
  const modeLabel = MODES.find((m) => m.value === mode)?.label ?? "Quick answer";
  const localeLabel = locales.find((l) => l.value === locale)?.label ?? "English";

  return (
    <div className="ux-comp rounded-[20px]"
         style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)" }}>
      {/*
        Attaching is real — the picker opens, the file is held, and its name
        travels with the question. What is NOT real is Sakhi opening it: there
        is no upload endpoint yet, so the chip says so rather than letting a
        member believe her payslip has been read.
      */}
      <input ref={pick} type="file" className="hidden"
             accept="image/*,.pdf,.doc,.docx"
             onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <input ref={shoot} type="file" className="hidden"
             accept="image/*" capture="environment"
             onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      {file && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <span className="flex min-w-0 items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-xs"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
            <Icons.Paperclip className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-faint)" }} />
            <span className="truncate font-semibold" style={{ color: "var(--ux-ink)" }}>{file.name}</span>
            <button type="button" onClick={onClearFile} aria-label="Remove attachment"
                    className="ux-press grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                    style={{ color: "var(--ux-faint)" }}>
              <Icons.X className="h-[12px] w-[12px]" />
            </button>
          </span>
          <span className="text-[12px] lg:text-2xs" style={{ color: "var(--ux-amber-ink)" }}>
            She will see the name, not what is inside it — reading files is coming.
          </span>
        </div>
      )}

      <div className="px-4 pb-1 pt-3.5">
        <textarea
          ref={box}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // messaging app has taught, and getting it backwards loses drafts.
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          placeholder={placeholder}
          aria-label="Ask Sakhi"
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
          style={{ color: "var(--ux-ink)", maxHeight: 150 }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-2"
           style={{ borderColor: "var(--ux-line)" }}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => pick.current?.click()} title="Attach a file"
                  className="ux-press grid h-[34px] w-[34px] place-items-center rounded-[12px] transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{ color: "var(--ux-muted)" }}>
            <Icons.Paperclip className="h-[17px] w-[17px]" />
          </button>
          <button type="button" onClick={() => shoot.current?.click()} title="Photograph a form"
                  className="ux-press grid h-[34px] w-[34px] place-items-center rounded-[12px] transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{ color: "var(--ux-muted)" }}>
            <Icons.Camera className="h-[17px] w-[17px]" />
          </button>
          <span className="h-[20px] w-px" style={{ background: "var(--ux-line-strong)" }} />
          <Picker icon="Zap" title="How she should answer" label={modeLabel}
                  items={MODES} value={mode} onPick={setMode} />
          <span className="h-[20px] w-px" style={{ background: "var(--ux-line-strong)" }} />
          <Picker icon="Globe" title="Language" label={localeLabel}
                  items={locales} value={locale} onPick={setLocale} />
        </div>

        <div className="flex items-center gap-1">
          {canVoice && (
            <button type="button" onClick={onMic}
                    aria-pressed={listening}
                    title={listening ? "Stop listening" : "Speak instead of typing"}
                    className="ux-press grid h-[38px] w-[38px] place-items-center rounded-[12px] transition-colors"
                    style={listening
                      ? { background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }
                      : { color: "var(--ux-muted)" }}>
              <Ico name={listening ? "MicOff" : "Mic"} className="h-[18px] w-[18px]" />
            </button>
          )}
          {/* Stop lives with the answer it interrupts, not down here. */}
          {(
            <button type="button" onClick={onSend} disabled={busy || (!value.trim() && !file)} aria-label="Send"
                    className="ux-press grid h-[38px] w-[38px] place-items-center rounded-[12px] disabled:opacity-40"
                    style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                             color: "var(--ux-on-brand)" }}>
              <Icons.Send className="h-[17px] w-[17px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── the composer, phone-shaped ─────────────────────────────────────────── */

/**
 * What she types into on a phone.
 *
 * The desktop composer above is a box with a toolbar: attach, camera, a
 * divider, "Quick answer ⌄", a divider, "English ⌄", then mic and send. At
 * 390px that toolbar wrapped onto a second row — measured on the screenshot,
 * the microphone and the send button ended up on a line of their own beneath
 * everything else — and it cost ~90px of a screen that has a keyboard eating
 * half of it.
 *
 * A phone composer is a ROW: one attach, the field, one send. The two settings
 * that used to be permanent chips move above the field as a single quiet line,
 * because they are read far more often than they are changed, and they hide
 * altogether once she starts typing.
 */
export function PhoneComposer({
  value, onChange, onSend, onMic, listening, busy,
  mode, setMode, locale, setLocale, locales, placeholder, canVoice,
  file, onFile, onClearFile,
}: {
  value: string; onChange: (v: string) => void; onSend: () => void;
  onMic: () => void; listening: boolean; busy: boolean;
  mode: string; setMode: (v: string) => void;
  locale: string; setLocale: (v: string) => void;
  locales: { value: string; label: string; note?: string }[];
  placeholder: string; canVoice: boolean;
  file: File | null; onFile: (f: File | null) => void; onClearFile: () => void;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const MODES = [
    { value: "quick", label: "Quick answer", note: "Short and to the point" },
    { value: "steps", label: "Step by step", note: "Explained slowly, in order" },
  ];
  const modeLabel = MODES.find((m) => m.value === mode)?.label ?? "Quick answer";
  const localeLabel = locales.find((l) => l.value === locale)?.label ?? "English";
  const typed = value.trim().length > 0;

  return (
    <div>
      <input ref={pick} type="file" className="hidden"
             accept="image/*,.pdf,.doc,.docx"
             onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      {!typed && (
        <div className="ux-chat-tip flex items-center gap-1 pb-1.5">
          <Picker icon="Zap" title="How she should answer" label={modeLabel}
                  items={MODES} value={mode} onPick={setMode} />
          <span className="h-[16px] w-px" style={{ background: "var(--ux-line-strong)" }} />
          <Picker icon="Globe" title="Language" label={localeLabel}
                  items={locales} value={locale} onPick={setLocale} />
        </div>
      )}

      {file && (
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <span className="flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-[12px]"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
            <Icons.Paperclip className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-faint)" }} />
            <span className="truncate font-semibold" style={{ color: "var(--ux-ink)" }}>{file.name}</span>
            <button type="button" onClick={onClearFile} aria-label="Remove attachment"
                    className="ux-press ux-tap-exempt grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                    style={{ color: "var(--ux-faint)" }}>
              <Icons.X className="h-[12px] w-[12px]" />
            </button>
          </span>
          <span className="text-[12px]" style={{ color: "var(--ux-amber-ink)" }}>
            She will see the name, not what is inside it.
          </span>
        </div>
      )}

      <div className="flex items-end gap-1.5 pb-2">
        <button type="button" onClick={() => pick.current?.click()} aria-label="Attach a file"
                className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                style={{ color: "var(--ux-muted)", transform: "none" }}>
          <Icons.Paperclip className="h-[20px] w-[20px]" />
        </button>
        <div className="ux-comp min-w-0 flex-1 rounded-[22px] px-3.5 py-2.5"
             style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
          <ChatInput value={value} onChange={onChange} onSend={onSend}
                     placeholder={placeholder} label="Ask Sakhi" />
        </div>
        {canVoice && !typed && (
          <button type="button" onClick={onMic} aria-pressed={listening}
                  aria-label={listening ? "Stop listening" : "Speak instead of typing"}
                  className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                  style={listening
                    ? { background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)", transform: "none" }
                    : { color: "var(--ux-muted)", transform: "none" }}>
            <Ico name={listening ? "MicOff" : "Mic"} className="h-[21px] w-[21px]" />
          </button>
        )}
        <SendButton onClick={onSend} disabled={busy || (!typed && !file)} busy={busy} label="Send" />
      </div>
    </div>
  );
}

/* ── the message actions ────────────────────────────────────────────────── */

export function Actions({
  text, onRetry, onSave, saved, vote, onVote,
}: {
  text: string; onRetry?: () => void; onSave: () => void; saved: boolean;
  vote: "up" | "down" | null; onVote: (v: "up" | "down") => void;
}) {
  const [copied, setCopied] = useState(false);

  const btn = "ux-row flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs font-semibold";
  return (
    <div className="mt-3 flex flex-wrap gap-0.5 border-t pt-2.5" style={{ borderColor: "var(--ux-line)" }}>
      {/* The button's label already changes to "Copied" — but a label that
          changes on an element that is not a live region announces nothing.
          This is the same confirmation, said out loud, beside the button
          rather than in a corner of the screen. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied." : ""}
      </span>
      <button type="button" className={btn} style={{ color: copied ? "var(--ux-green-ink)" : "var(--ux-muted)" }}
              onClick={async () => {
                // Guarded: `navigator.clipboard` is undefined outside a secure
                // context, and an unhandled rejection here kills the handler.
                try { await navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }
                catch { /* nothing to say — the button simply does not confirm */ }
              }}>
        <Ico name={copied ? "Check" : "Copy"} className="h-[13px] w-[13px]" />
        {copied ? "Copied" : "Copy"}
      </button>

      {onRetry && (
        <button type="button" className={btn} style={{ color: "var(--ux-muted)" }} onClick={onRetry}>
          <Icons.RotateCw className="h-[13px] w-[13px]" /> Try again
        </button>
      )}

      <button type="button" className={btn} onClick={onSave}
              style={{ color: saved ? "var(--ux-brand)" : "var(--ux-muted)" }}>
        <Ico name={saved ? "BookmarkCheck" : "Bookmark"} className="h-[13px] w-[13px]" />
        {saved ? "Saved" : "Save"}
      </button>

      <button type="button" className={btn} onClick={() => onVote("up")}
              aria-pressed={vote === "up"}
              style={{ color: vote === "up" ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
        <Icons.ThumbsUp className="h-[13px] w-[13px]" /> Helpful
      </button>
      <button type="button" className={btn} onClick={() => onVote("down")}
              aria-pressed={vote === "down"}
              style={{ color: vote === "down" ? "var(--ux-pink-ink)" : "var(--ux-muted)" }}>
        <Icons.ThumbsDown className="h-[13px] w-[13px]" /> Not helpful
      </button>
    </div>
  );
}

/* ── the thing she is not allowed to do on her own ──────────────────────── */

export function DraftCard({
  sentence, onApprove, onReject, onChange, busy,
}: {
  sentence: string; onApprove: () => void; onReject: () => void;
  onChange: () => void; busy: boolean;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--ux-line-strong)" }}>
      <p className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.12em]"
         style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
        <Icons.PenLine className="h-[13px] w-[13px]" />
        Draft — not sent
      </p>
      <p className="px-3.5 pt-3.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
        {sentence}
      </p>
      {/*
        Both buttons are the same size on purpose. A "no" rendered smaller and
        greyer than the "yes" is a dark pattern, and this is the screen where
        the app asks permission to act with her money and her name.
      */}
      <div className="flex flex-wrap gap-2 p-3.5">
        <button type="button" onClick={onApprove} disabled={busy}
                className="ux-press flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] px-4 text-xsm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
          <Icons.Check className="h-4 w-4" /> Send it
        </button>
        <button type="button" onClick={onChange} disabled={busy}
                className="ux-press flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] px-4 text-xsm font-bold disabled:opacity-50"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
          <Icons.PenLine className="h-4 w-4" /> Change something
        </button>
        <button type="button" onClick={onReject} disabled={busy}
                className="ux-press flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] px-4 text-xsm font-bold disabled:opacity-50"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
          <Icons.X className="h-4 w-4" /> Discard
        </button>
      </div>
    </div>
  );
}


/* ── where an answer came from ───────────────────────────────────────────
   Built from the `tool` events the stream already emits, so a claim about
   her money can be traced to the thing that was actually read. Nothing here
   is decorative: no tool ran, no chips. */

const TOOL_LOOK: Record<string, { label: string; icon: string }> = {
  earnings: { label: "Your earnings", icon: "Wallet" },
  bookings: { label: "Your bookings", icon: "CalendarDays" },
  programmes: { label: "Your courses", icon: "GraduationCap" },
  programs: { label: "Your courses", icon: "GraduationCap" },
  circles: { label: "Your circles", icon: "UsersRound" },
  opportunities: { label: "Open work", icon: "Search" },
  certificates: { label: "Your certificates", icon: "Award" },
  profile: { label: "Your profile", icon: "UserRound" },
};

/** "get_earnings_summary" -> { label: "Your earnings", icon: "Wallet" }. */
function look(name: string) {
  const key = Object.keys(TOOL_LOOK).find((k) => name.toLowerCase().includes(k));
  if (key) return TOOL_LOOK[key];
  const words = name.replace(/[_-]+/g, " ").replace(/^(get|list|fetch|read)\s+/i, "").trim();
  return { label: words.charAt(0).toUpperCase() + words.slice(1), icon: "FileText" };
}

export function Cites({ tools }: { tools: string[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tools.map((name) => {
        const l = look(name);
        return (
          <span key={name}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] lg:text-2xs font-semibold"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)",
                         color: "var(--ux-muted)" }}>
            <Ico name={l.icon} className="h-[12px] w-[12px]" />
            {l.label}
          </span>
        );
      })}
    </div>
  );
}

export function Typing() {
  return (
    <span className="ux-blip flex items-center gap-[4px] py-1" aria-label="Sakhi is typing">
      {[0, 1, 2].map((i) => (
        <i key={i} className="block h-[7px] w-[7px] rounded-full" style={{ background: "var(--ux-brand)" }} />
      ))}
    </span>
  );
}

export function StopPill({ onStop }: { onStop: () => void }) {
  return (
    <div className="flex justify-center">
      <button type="button" onClick={onStop}
              className="ux-press flex min-h-[38px] items-center gap-2 rounded-full px-4 text-xs font-bold"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                       color: "var(--ux-ink-2)" }}>
        <Icons.Square className="h-[12px] w-[12px]" fill="currentColor" />
        Stop
      </button>
    </div>
  );
}


/**
 * Welcome · In conversation · Voice.
 *
 * The three segments the design asks for, and each one goes somewhere real:
 * **Welcome** clears to the blank screen, **In conversation** returns to the
 * thread she is in — or reopens her most recent one when she is starting cold —
 * and **Voice** hands over to the microphone.
 *
 * "In conversation" is disabled when there is no conversation to be in, rather
 * than opening an empty thread. A segment that cannot lead anywhere says so by
 * being unpressable.
 */
export function ModeSwitch({
  value, onPick, canTalk, canVoice,
}: {
  value: "welcome" | "talk" | "voice";
  onPick: (v: "welcome" | "talk" | "voice") => void;
  canTalk: boolean; canVoice: boolean;
}) {
  const items = [
    { v: "welcome" as const, label: "Welcome", icon: "Sparkles", on: true },
    { v: "talk" as const, label: "In conversation", icon: "MessageCircle", on: canTalk },
    { v: "voice" as const, label: "Voice", icon: "AudioLines", on: canVoice },
  ];
  return (
    <div role="group" aria-label="Ask Sakhi view"
         className="mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1"
         style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)",
                  scrollbarWidth: "none" }}>
      {items.map((it) => {
        const active = value === it.v;
        return (
          <button
            key={it.v}
            type="button"
            disabled={!it.on}
            aria-pressed={active}
            onClick={() => onPick(it.v)}
            className="ux-press flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={active
              ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
              : { color: "var(--ux-muted)" }}
          >
            <Ico name={it.icon} className="h-[14px] w-[14px]" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}


/* ── how an answer is set ────────────────────────────────────────────────
   The model replies in plain lines, and `whitespace-pre-wrap` rendered them
   as one tight wall — "What is coming up:" sat flush against three bookings
   that are obviously a list. Nothing here invents structure: a line ending in
   a colon opens a list, short lines under it are its items, and the first long
   line closes it again. That is the shape the sentences already had. */

const BOLD = /\*\*(.+?)\*\*/g;

/** `**text**` → bold. The model uses it occasionally; showing the asterisks is worse. */
function inline(text: string, key: string): React.ReactNode {
  const parts = text.split(BOLD);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <b key={`${key}-${i}`} style={{ color: "var(--ux-ink)", fontWeight: 700 }}>{part}</b>
      : <span key={`${key}-${i}`}>{part}</span>,
  );
}

type Block = { kind: "p" | "lead"; text: string } | { kind: "list"; items: string[] };

function parse(raw: string): Block[] {
  const out: Block[] = [];
  let list: string[] | null = null;

  for (const line of raw.split("\n").map((l) => l.trim())) {
    if (!line) { list = null; continue; }

    const bullet = /^([-*•]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const item = line.slice(bullet[0].length);
      if (list) list.push(item);
      else { list = [item]; out.push({ kind: "list", items: list }); }
      continue;
    }

    if (line.endsWith(":")) {
      list = [];
      out.push({ kind: "lead", text: line });
      out.push({ kind: "list", items: list });
      continue;
    }

    // A short line under a colon is one of its items; a long one is prose,
    // and closes the list.
    if (list && line.length <= 70) { list.push(line); continue; }

    list = null;
    out.push({ kind: "p", text: line });
  }
  return out.filter((b) => b.kind !== "list" || b.items.length > 0);
}

export function Answer({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="flex flex-col gap-2.5 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
      {blocks.map((b, i) =>
        b.kind === "list" ? (
          <ul key={i} className="flex flex-col gap-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: "var(--ux-brand)" }} />
                <span>{inline(it, `${i}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} style={b.kind === "lead" ? { color: "var(--ux-ink)", fontWeight: 600 } : undefined}>
            {inline(b.text, String(i))}
          </p>
        ),
      )}
    </div>
  );
}

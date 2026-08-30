"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Icons from "lucide-react";

import { Btn } from "./index";
import { messageFrom } from "@/lib/use-action";

/** What she wrote, handed to whoever knows where it goes. */
export interface NoteContents {
  text: string;
  /** 0 when the box did not ask for stars. */
  rating: number;
  /** "" when the box offered no choices. */
  choice: string;
}

/**
 * "Leave a note", "Reply", "Say hello" — the buttons that need words back.
 *
 * These cannot be answered by a confirmation the way "Remind me" can: she has
 * something to say and there was nowhere to say it. Three screens needed the
 * same box, so it lives here once.
 *
 * **The Send button used to be `onClick={() => setDone(true)}`.** Ten of these
 * across eight screens rendered a compose box, a star rating and the promise
 * "Only {to} sees this", and then nothing left the browser. A woman replying to
 * a buyer's review, asking a mentor for a session, or reporting a man who
 * frightened her read a green tick and was on her own. `send` is where the
 * words actually go, and the tick is now shown only after the server has taken
 * them.
 *
 * A call site with no `send` cannot claim anything: the button dims and the box
 * says plainly that there is nowhere for this to go, rather than inventing a
 * confirmation. That is the failure mode this component is supposed to have.
 *
 * Rendered into <body>, not where it is written. The topbar carries a
 * backdrop-filter, and an ancestor with one becomes the containing block for
 * `position: fixed` descendants — a scrim written inside the page would dim the
 * strip behind the topbar and leave the page at full brightness.
 */
export function NoteBtn({
  label, title, to, placeholder, stars = false, sent, sentBody, sentLink,
  send, choices, choiceDefault = "", choiceLabel = "What is this about?",
  variant = "soft", size = "sm", icon = "MessageCircle", full,
}: {
  /** What the button says. */
  label: string;
  /** The heading on the box. */
  title: string;
  /** Who it goes to, named — "Neha Verma", "the seller". */
  to: string;
  placeholder: string;
  /** Ask for a rating as well as words. Required before she can send. */
  stars?: boolean;
  /** The confirmation, in her words. Defaults to naming the recipient. */
  sent?: string;
  /** What is true once it has gone. Defaults to the reply arriving in Messages. */
  sentBody?: string;
  /** Where to go next. `null` for nowhere — pass it when there is no thread to open. */
  sentLink?: { href: string; label: string } | null;
  /**
   * Where the words go. Resolves when the server has them; throws to say why
   * not, and the reason is shown in the box she is still looking at.
   */
  send?: (note: NoteContents) => Promise<unknown>;
  /** One of these must be picked before sending — a report needs a category. */
  choices?: readonly string[];
  /**
   * Which one is picked to begin with — always the least committal option.
   *
   * A woman reporting somebody must not meet a Send button that will not press
   * and have to work out why; and she must not have a category chosen FOR her
   * that says something she did not. So the default is the "something else" of
   * whatever list it is given, with the rest in front of her to be more precise.
   */
  choiceDefault?: string;
  choiceLabel?: string;
  variant?: "primary" | "soft" | "outline" | "ghost" | "on-brand";
  size?: "sm" | "md" | "lg";
  icon?: string;
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [choice, setChoice] = useState(choiceDefault);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // A reply that arrives after she has closed the box must not write into a
  // component that is gone.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    // The page behind must not scroll under an open box.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    setOpen(false); setDone(false); setText(""); setRating(0); setChoice(choiceDefault); setProblem("");
  };

  /**
   * Everything the endpoint behind this box requires.
   *
   * Words always: every one of these posts to something with a required text
   * field. A star where the box asked for one, because storing a rating she
   * never gave is inventing her opinion. A category where the box offered
   * them, because the server will refuse without one — which is why the box
   * starts with the least committal one already picked.
   */
  const ready = !!text.trim() && (!stars || rating > 0) && (!choices || !!choice);

  async function fire() {
    if (!send || !ready || sending) return;
    setSending(true);
    setProblem("");
    try {
      await send({ text: text.trim(), rating, choice });
      if (alive.current) setDone(true);
    } catch (e) {
      // Said where she pressed, in the box still in front of her — and the
      // words are still in it, so pressing again costs her nothing.
      if (alive.current) {
        setProblem(messageFrom(e, "That did not go through. Nothing has been sent — try again in a moment."));
      }
    } finally {
      if (alive.current) setSending(false);
    }
  }

  const link = sentLink === undefined ? { href: "/app/messages", label: "Go to Messages" } : sentLink;

  return (
    <>
      <Btn variant={done ? "outline" : variant} size={size} icon={done ? "Check" : icon} full={full}
           onClick={() => setOpen(true)}>
        {done ? "Sent" : label}
      </Btn>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="ux fixed inset-0 z-[120] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
          style={{ background: "var(--ux-scrim)", backdropFilter: "blur(6px)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div role="dialog" aria-modal="true" aria-label={title}
               className="ux-sheet ux-slide-up w-full max-w-[520px] rounded-[20px] p-[20px]">
            {done ? (
              <div className="py-3 text-center">
                <span className="mx-auto grid h-[56px] w-[56px] place-items-center rounded-full"
                      style={{ background: "var(--ux-tint-green)" }}>
                  <Icons.Check className="h-[26px] w-[26px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.4} />
                </span>
                <p className="mt-3.5 text-[16px] font-bold" style={{ color: "var(--ux-ink)" }}>
                  {sent ?? `Sent to ${to}`}
                </p>
                <p className="mx-auto mt-1.5 max-w-[36ch] text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  {sentBody ?? "You will see the reply in Messages. Nothing else about you is shared."}
                </p>
                <div className="mt-4 flex justify-center gap-2.5">
                  {link && <Btn href={link.href} variant="primary" size="sm" iconEnd="ArrowRight">{link.label}</Btn>}
                  <Btn variant="ghost" size="sm" onClick={close}>Close</Btn>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3.5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[16.5px] font-bold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
                    <p className="mt-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>Goes to {to}.</p>
                  </div>
                  <button onClick={() => setOpen(false)} aria-label="Close"
                          className="ux-press ux-sq grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border"
                          style={{ borderColor: "var(--ux-line)" }}>
                    <Icons.X className="h-[16px] w-[16px]" style={{ color: "var(--ux-muted)" }} strokeWidth={2} />
                  </button>
                </div>

                {choices && (
                  <div className="mb-3.5">
                    <p className="mb-2 text-[12.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{choiceLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {choices.map((c) => {
                        const on = choice === c;
                        return (
                          <button key={c} onClick={() => setChoice(c)} aria-pressed={on}
                                  className="ux-press ux-sq rounded-[10px] border px-3 py-2 text-[12px] font-medium"
                                  style={{
                                    borderColor: on ? "var(--ux-brand)" : "var(--ux-line-strong)",
                                    background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                                    color: on ? "var(--ux-brand)" : "var(--ux-ink-2)",
                                  }}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stars && (
                  <div className="mb-3.5">
                    <p className="mb-2 text-[12.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>How did it go?</p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRating(n)} aria-label={`${n} out of 5`}
                                className="ux-press grid h-[38px] w-[38px] place-items-center rounded-[10px]"
                                style={{ background: n <= rating ? "var(--ux-tint-amber)" : "var(--ux-surface-2)" }}>
                          <Icons.Star className="h-[19px] w-[19px]"
                                      style={{ color: n <= rating ? "var(--ux-amber-ink)" : "var(--ux-faint)" }}
                                      fill={n <= rating ? "currentColor" : "none"} strokeWidth={1.8} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  ref={box}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  rows={4}
                  aria-label={title}
                  className="ux-sq w-full rounded-[13px] border p-3.5 text-[13.5px] leading-relaxed outline-none"
                  style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
                />

                {/* The refusal belongs here, above the button she pressed, with
                    her words still in the box behind it. */}
                {problem && (
                  <p role="alert" className="ux-slide-up mt-3 rounded-[11px] p-3 text-[12.5px] leading-relaxed"
                     style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
                    {problem}
                  </p>
                )}

                <div className="mt-3.5 flex items-center justify-between gap-3">
                  {/* Say what happens to it before she presses send, not after. */}
                  <p className="text-[11.5px] leading-snug" style={{ color: send ? "var(--ux-faint)" : "var(--ux-orange-ink)" }}>
                    {send
                      ? `Only ${to} sees this.`
                      : `This box is not connected yet — nothing written here would reach ${to}.`}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => setOpen(false)}>Not now</Btn>
                    <Btn variant="primary" size="sm" iconEnd={sending ? undefined : "Send"}
                         icon={sending ? "Loader" : undefined}
                         disabled={!send || !ready || sending}
                         onClick={() => void fire()}>
                      {sending ? "Sending…" : "Send it"}
                    </Btn>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

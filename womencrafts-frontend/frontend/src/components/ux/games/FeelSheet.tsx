"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import { apiMoodCheckIn, MOODS, type Mood, type SupportCard } from "@/lib/engines-api";
import { MoodFace } from "@/components/ux/health/mind/parts";

/**
 * "How do you feel now?" — after a calm game, one tap.
 *
 * It goes to the same mood check-in as Health → Today, so a few minutes of
 * breathing counts the way any check-in does. If the app has something kind
 * to say back, it is shown here, gently. Nothing here blocks leaving.
 */
// Drawn faces (MoodFace), not emoji: emoji differ per phone. The mood is also
// handed to `onMood`, which adds it to the game session just saved.
const LOOK: Record<Mood, { label: string }> = {
  good: { label: "Calmer" },
  tired: { label: "Tired" },
  low: { label: "Low" },
  anxious: { label: "Still anxious" },
  angry: { label: "Upset" },
  unwell: { label: "Unwell" },
};

export function FeelSheet({ open, onClose, again, onMood }: {
  open: boolean;
  onClose: () => void;
  /** "Play another" restarts this game when given; otherwise goes to the games. */
  again?: () => void;
  onMood?: (m: Mood) => void;
}) {
  const [sent, setSent] = useState<Mood | null>(null);
  const [card, setCard] = useState<SupportCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const pick = async (m: Mood) => {
    if (busy) return;
    setBusy(true); setErr("");
    onMood?.(m);
    try {
      const r = await apiMoodCheckIn(m);
      setSent(m); setCard(r.card);
    } catch {
      setErr("That did not save — it is fine, you can still go on.");
      setSent(m);
    } finally { setBusy(false); }
  };

  const close = () => { setSent(null); setCard(null); setErr(""); onClose(); };

  return (
    <div role="dialog" aria-modal="true" aria-label="How do you feel now?"
         className="fixed inset-0 z-[80] grid place-items-end p-3 sm:place-items-center"
         style={{ background: "rgba(20,8,24,.45)" }} onClick={close}>
      <div className="ux-slide-up w-full max-w-[460px] rounded-[22px] p-5 shadow-2xl"
           style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>
            {sent ? "Thank you for taking this time" : "How do you feel now?"}
          </h2>
          <button type="button" onClick={close} aria-label="Close"
                  className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
                  style={{ border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
            <Icons.X className="h-4 w-4" />
          </button>
        </div>

        {!sent ? (
          <>
            <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>One tap. Only you see this.</p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {MOODS.map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => void pick(m)}
                        className="ux-press flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-[16px] text-xs font-semibold"
                        style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>
                  <MoodFace mood={m} size={34} />
                  {LOOK[m].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-xsm" style={{ color: "var(--ux-ink-2)" }}>
              You said: <b>{LOOK[sent].label}</b>.{" "}
              {sent === "good" ? "Keep this feeling with you for a while." : "Be gentle with yourself today."}
            </p>
            {err && <p className="mt-2 text-xs" style={{ color: "var(--ux-orange-ink)" }}>{err}</p>}
            {card && (
              <div className="mt-3 rounded-[14px] p-4" style={{ background: "var(--ux-brand-tint)" }}>
                <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{card.title}</p>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{card.body}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {again
            ? <Btn variant="primary" icon="RefreshCw" onClick={() => { close(); again(); }}>Play again</Btn>
            : <Btn variant="primary" icon="Sparkles" href="/app/health/games">Play another</Btn>}
          {again && <Btn variant="outline" href="/app/health/games">Other games</Btn>}
          <Btn variant="ghost" href="/app/health/games?tab=activity" iconEnd="ArrowRight">Your activity</Btn>
        </div>
      </div>
    </div>
  );
}

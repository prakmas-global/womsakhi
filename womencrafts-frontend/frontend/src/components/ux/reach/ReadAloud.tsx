"use client";

import { useCallback, useEffect, useState } from "react";

import { I, v } from "@/components/ux/kit";

/**
 * The speaker button that makes a screen usable without reading it.
 *
 * ── Why this exists as a component and not a settings toggle ────────────────
 * Adult female literacy in the rural sample behind this product was **36%**,
 * against 71% for men. The voice-listing screen fixed one page; the other 109
 * routes were still text, which quietly makes the app usable by her literate
 * daughter rather than by her. A preference buried in settings does not fix
 * that — a button on the page does.
 *
 * ── It reads what is on the screen, not a written-out script ────────────────
 * It pulls the visible text of the element it is given and speaks that, so it
 * cannot drift out of date when the copy changes, and there is no second
 * version of the page to maintain. Browser speech synthesis, so it costs
 * nothing and works offline once the voice is installed.
 *
 * ── Nothing ever reads out on its own ───────────────────────────────────────
 * Handsets are shared. A screen that starts talking about her earnings while
 * someone else is in the room is a safety problem, not a feature — the same
 * reasoning behind the family-facing view. So: press to start, press to stop,
 * and money amounts are skipped unless she has explicitly turned that on.
 */
export function ReadAloud({ targetId, label = "Read this to me", lang = "hi-IN", money = false }: {
  /** The element whose visible text is read. */
  targetId: string;
  label?: string;
  lang?: string;
  /** Read rupee amounts too. Off by default — someone may be listening. */
  money?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [able, setAble] = useState(false);

  useEffect(() => {
    setAble(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, []);

  const toggle = useCallback(() => {
    if (!able) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }

    const el = document.getElementById(targetId);
    let text = (el?.innerText || "").replace(/\s+/g, " ").trim();
    // Rupee figures are removed rather than mispronounced or overheard.
    if (!money) text = text.replace(/₹\s?[\d,]+/g, "");
    if (!text) return;

    const u = new SpeechSynthesisUtterance(text.slice(0, 4000));
    u.lang = lang;
    u.rate = 0.92;              // slower than default; this is not a podcast
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, [able, speaking, targetId, lang, money]);

  if (!able) return null;

  return (
    <button
      type="button" onClick={toggle}
      aria-label={speaking ? "Stop reading" : label}
      aria-pressed={speaking}
      className="ux-press ux-sq inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold"
      style={{
        background: v(speaking ? "--ux-fill" : "--ux-brand-tint"),
        color: v(speaking ? "--ux-on-brand" : "--ux-brand"),
      }}
    >
      <I name={speaking ? "Square" : "Volume2"} className="h-[15px] w-[15px]" sw={2.2} />
      {speaking ? "Stop" : label}
    </button>
  );
}

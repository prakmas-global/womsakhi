"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import * as Icons from "@/components/ux/icons";
import { toast } from "@/components/ux/mobile/Toast";
import { quoteForPath } from "./quotes";

export function QuoteCard({ compact = false }: { compact?: boolean }) {
  const path = usePathname() || "/app";
  const language = "en";
  const [selection, setSelection] = useState({ path, offset: 0 });
  const quote = quoteForPath(path, selection.path === path ? selection.offset : 0, language);
  const hi = quote.language === "hi";

  const share = async () => {
    const text = `“${quote.text}” — ${quote.by}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(hi ? "विचार कॉपी हो गया" : "Quote copied", { tone: "success" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast(hi ? "साझा नहीं हो पाया। विचार चुनकर कॉपी कर सकती हैं।" : "Could not share. You can select and copy the quote.", { tone: "error" });
    }
  };

  return (
    <section data-page-quote data-quote-topic={quote.topic} aria-label={hi ? "आपके लिए हौसले के शब्द" : "Words for your journey"} lang={quote.language}
             className="relative overflow-hidden rounded-[20px] border p-4 sm:p-5"
             style={{ background: "linear-gradient(120deg, var(--ux-tint-lilac), var(--ux-tint-pink))", borderColor: "var(--ux-line)" }}>
      <Icons.Quote aria-hidden className="pointer-events-none absolute end-4 top-4 h-12 w-12 opacity-10" style={{ color: "var(--ux-brand)" }} />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xs font-extrabold uppercase tracking-[0.08em]" style={{ color: "var(--ux-brand)" }}>{quote.label}</h2>

      </div>
      <figure className="relative mt-3">
        <blockquote aria-live="polite" aria-atomic="true" className={`max-w-[72ch] font-semibold leading-relaxed ${compact ? "text-[15px]" : "text-base sm:text-lg"}`}
                    style={{ color: "var(--ux-ink)" }}>“{quote.text}”</blockquote>
        <figcaption className="mt-2 text-xs font-bold" style={{ color: "var(--ux-brand)" }}>— {quote.by}</figcaption>
      </figure>
      <div className="relative mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelection((current) => ({ path, offset: current.path === path ? current.offset + 1 : 1 }))}
                className="ux-press inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold"
                style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)", borderColor: "var(--ux-line)" }}>
          <Icons.RefreshCw aria-hidden className="h-4 w-4" /> {hi ? "एक और विचार" : "Another thought"}
        </button>
        <button type="button" onClick={share} className="ux-press inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold"
                style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)", borderColor: "var(--ux-line)" }}>
          <Icons.Share2 aria-hidden className="h-4 w-4" /> {hi ? "साझा करें" : "Share"}
        </button>
      </div>
    </section>
  );
}

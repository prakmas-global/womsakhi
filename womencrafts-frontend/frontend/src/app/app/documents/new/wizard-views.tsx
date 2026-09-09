"use client";

import * as Icons from "@/components/ux/icons";
import { Card, I, v } from "@/components/ux/kit";

/* ------------------------------------------------------------------ */
/*  Rail: tips and preview                                             */
/* ------------------------------------------------------------------ */

export function Tips({ title, at, of, items }: {
  title: string; at: number; of: number; items: string[];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          <I name="Lightbulb" className="h-[17px] w-[17px]" style={{ color: v("--ux-amber-ink") }} />
          {title}
        </h2>
        <span className="text-2xs font-bold" style={{ color: v("--ux-faint") }}>{at} / {of}</span>
      </div>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2 text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>
            <Icons.CheckCircle2 className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** A line of encouragement that is about the work, never about her worth. */
export function Saying({ text }: { text: string }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] p-[18px]"
         style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/scene-woman-writing-notes.webp" alt="" aria-hidden loading="lazy" decoding="async"
           className="pointer-events-none absolute -bottom-2 -end-3 h-[92px] w-[92px] object-contain" />
      <p className="relative w-[64%] text-xsm font-bold leading-snug" style={{ color: v("--ux-brand") }}>
        {text}
      </p>
      <p className="relative mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>— WomSakhi</p>
    </div>
  );
}

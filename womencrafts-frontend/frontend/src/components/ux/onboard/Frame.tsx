"use client";

import * as Icons from "lucide-react";

import { Brand } from "../Brand";

/**
 * The frame the three pre-shell screens share.
 *
 * Verify, welcome and intake all run BEFORE she has access to the app, so the
 * member layout deliberately renders them without the sidebar or topbar — there
 * is nowhere for those to navigate to yet. What they do need is the brand, a
 * clear sense of how many steps are left, and no way to wander off mid-flow.
 */
export function OnboardFrame({
  step, total, title, sub, children, aside, footer,
}: {
  step: number;
  total: number;
  title: string;
  sub?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      <header className="flex items-center justify-between px-8 pb-2 pt-6">
        <Brand size="sm" href={null} />
        <p className="text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
          Step {step} of {total}
        </p>
      </header>

      {/* One bar rather than dots. Five dashes with "Step 4 of 6" beside them is
          two different counts of the same thing, and people believe the dashes. */}
      <div className="px-8">
        <div className="ux-sq h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(step / total) * 100}%`,
              background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))",
              transition: "width var(--ux-t-slow) var(--ux-ease-out)",
            }}
          />
        </div>
      </div>

      <main id="content" className="mx-auto grid w-full max-w-[1080px] gap-[28px] px-8 py-[38px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{title}</h1>
          {sub && (
            <p className="mt-2.5 max-w-[54ch] text-[14.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {sub}
            </p>
          )}
          <div className="mt-[26px]">{children}</div>
          {footer && <div className="mt-[26px]">{footer}</div>}
        </div>

        {aside && <div className="min-w-0">{aside}</div>}
      </main>
    </div>
  );
}

/** A reassurance panel — the same shape on all three screens. */
export function OnboardAside({
  art, title, body, points,
}: { art: string; title: string; body: string; points: string[] }) {
  return (
    <div className="ux-clay ux-sq relative overflow-hidden p-[22px]"
         style={{ background: "linear-gradient(150deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" className="ux-float pointer-events-none absolute -bottom-4 -end-5 h-[128px] w-[128px] object-contain" />
      <h2 className="relative w-[68%] text-[16px] font-semibold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
      <p className="relative mt-2.5 w-[68%] text-[13px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{body}</p>
      <ul className="relative mt-4 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

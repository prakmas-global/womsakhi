"use client";

import * as Icons from "@/components/ux/icons";

import { Brand } from "../Brand";
import { useT } from "@/i18n";

/**
 * The frame the three pre-shell screens share.
 *
 * Verify, welcome and intake all run BEFORE she has access to the app, so the
 * member layout deliberately renders them without the sidebar or topbar — there
 * is nowhere for those to navigate to yet. What they do need is the brand, a
 * clear sense of how many steps are left, and no way to wander off mid-flow.
 */
export function OnboardFrame({
  step, total, title, sub, children, aside, footer, onBack, backTo,
}: {
  step: number;
  total: number;
  title: string;
  sub?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * The way back a step.
   *
   * Optional, because the first step of a flow has nowhere to go: a control
   * that is always drawn and sometimes does nothing is worse than no control.
   * It moves her within the flow rather than through browser history — she may
   * have arrived here from an email link with no history in the tab at all.
   */
  onBack?: () => void;
  /** The step she goes back TO, named. See the note at the button. */
  backTo?: string;
}) {
  const tr = useT();
  return (
    <div className="min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      {/* 16px from the screen edge on a phone, as everywhere else; the
          desktop's 32 was a third of a phone's margin budget on each side. */}
      <header className="flex items-center gap-2 px-4 pb-2 pt-6 lg:px-8">
        {onBack && (
          /*
            The destination is in the accessible name, not only in the arrow.
            A lone chevron asks her to remember what was behind it, and on this
            flow the step behind is the one holding her email — the thing she
            is most likely to be coming back to check.

            44px on both axes even when only the chevron shows, which is what
            the min-width is for: the glyph is 20px, and its padding alone
            would leave the target at 32.
          */
          <button
            type="button"
            onClick={onBack}
            aria-label={backTo ? `Back to ${backTo}` : "Go back a step"}
            className="ux-press ux-sq -ms-2 inline-flex h-[44px] min-w-[44px] shrink-0 items-center gap-1 rounded-[12px] px-2"
            style={{ color: "var(--ux-ink-2)" }}
          >
            <Icons.ChevronLeft className="h-[20px] w-[20px] shrink-0 rtl:rotate-180" strokeWidth={2.25} aria-hidden="true" />
            {backTo && (
              <span className="truncate text-xsm font-semibold max-sm:hidden">{backTo}</span>
            )}
          </button>
        )}
        {/* No tagline: at `sm` it renders at 7.5px, which is well under this
            project's 12px floor and simply cannot be read. `Shell` already
            drops it at this size for the same reason — this was the only
            place left still drawing it. */}
        <Brand size="sm" href={null} tagline={false} />
        <p className="ms-auto shrink-0 text-xsm" style={{ color: "var(--ux-muted)" }}>
          {tr("onboard.stepOf", { step, total })}
        </p>
      </header>

      {/* One bar rather than dots. Five dashes with "Step 4 of 6" beside them is
          two different counts of the same thing, and people believe the dashes. */}
      <div className="px-4 lg:px-8">
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

      <main id="content" className="mx-auto grid w-full max-w-[1080px] gap-[32px] px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-[40px]">
        <div className="min-w-0">
          {/* The large title on a phone — the one 34px line on the screen. */}
          <h1 className="ux-screen-title text-2xlm font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{title}</h1>
          {sub && (
            <p className="mt-2.5 max-w-[54ch] text-sm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {sub}
            </p>
          )}
          <div className="mt-[24px]">{children}</div>
          {footer && <div className="mt-[24px]">{footer}</div>}
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
    <div className="ux-clay ux-sq relative overflow-hidden p-[24px] max-lg:rounded-[16px] max-lg:p-4"
         style={{ background: "linear-gradient(150deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={art} alt="" className="ux-float pointer-events-none absolute -bottom-4 -end-5 h-[128px] w-[128px] object-contain" />
      <h2 className="relative w-[68%] text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
      <p className="relative mt-2.5 w-[68%] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{body}</p>
      {/* The art is anchored bottom-end, and this list is what reaches the
          bottom of the card — so it needs the same 68% column the heading
          and body use. Without it the last lines ran under the image and
          lost their final words ("later in Settin…", "or buyer…"). */}
      <ul className="relative mt-4 w-[68%] space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

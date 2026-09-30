"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

/**
 * The pieces Settings → My answers and Settings → My data share.
 *
 * Both pages are about the same thing — what she told us and what we do with
 * it — so they open the same way: one illustration from the onboarding set and
 * one plain sentence, then grouped settings in the app's own `Group` shape.
 * Buttons here are 44px on every screen; the settings `Btn` sizes are shorter
 * on a laptop, and these pages are used by a thumb as often as by a mouse.
 */

export function Intro({ image, children }: { image: string; children: ReactNode }) {
  return (
    <div className="ux-card flex items-center gap-4 overflow-hidden p-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden width={480} height={320} decoding="async"
           className="h-[104px] w-[132px] shrink-0 object-cover sm:h-[118px] sm:w-[176px]" />
      <p className="min-w-0 flex-1 py-3 pe-4 text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
        {children}
      </p>
    </div>
  );
}

const base = "ux-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold lg:text-xsm disabled:cursor-not-allowed disabled:opacity-60";

export function PrimaryButton({ children, onClick, disabled, busy, icon }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; icon?: keyof typeof Icons;
}) {
  const Ico = icon ? (Icons[icon] as React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>) : null;
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined}
            className={`${base} ux-btn-g`}
            style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
      {busy ? <Icons.Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            : Ico ? <Ico className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function QuietButton({ children, onClick, href, disabled }: {
  children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean;
}) {
  const style = { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" };
  if (href) return <Link href={href} className={`${base} ux-hov font-semibold`} style={style}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ux-hov font-semibold`} style={style}>
      {children}
    </button>
  );
}

export function DangerButton({ children, onClick, busy, solid }: {
  children: ReactNode; onClick: () => void; busy?: boolean; solid?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
            className={base}
            style={solid
              ? { background: "var(--ux-danger-solid)", color: "var(--ux-on-danger)" }
              : { background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
      {busy ? <Icons.Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            : <Icons.Trash2 className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}

/** A confirm step drawn in the page — never `window.confirm`. */
export function Confirm({ title, children, actions, id }: {
  title: string; children: ReactNode; actions: ReactNode; id: string;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-t`} tabIndex={-1} id={id}
         className="ux-sq rounded-[14px] p-4 outline-none"
         style={{ background: "var(--ux-danger-tint)", border: "1px solid color-mix(in srgb, var(--ux-danger-ink) 22%, transparent)" }}>
      <p id={`${id}-t`} className="flex items-start gap-2 text-[15px] font-bold lg:text-sm" style={{ color: "var(--ux-ink)" }}>
        <Icons.AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ux-danger-ink)" }} aria-hidden />
        {title}
      </p>
      <div className="mt-1.5 text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>{children}</div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>
    </div>
  );
}

/** The page could not load. Says so, and offers the one thing that helps. */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="ux-card p-5 text-center" role="alert">
      <Icons.CloudOff className="mx-auto h-6 w-6" style={{ color: "var(--ux-muted)" }} aria-hidden />
      <p className="mt-2 text-[15px] font-semibold lg:text-sm" style={{ color: "var(--ux-ink)" }}>
        We could not load {what} just now.
      </p>
      <p className="mt-1 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
        Nothing has changed — this is the app failing to fetch it.
      </p>
      <div className="mt-3"><QuietButton onClick={onRetry}>Try again</QuietButton></div>
    </div>
  );
}

export function LoadingRows({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className="ux-card space-y-3 p-4" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ux-shimmer h-[44px] rounded-[10px]" style={{ background: "var(--ux-surface-2)" }} />
      ))}
    </div>
  );
}

/** "en" → "English". Languages she can pick today, plus the two coming. */
export const LANGUAGE_NAMES: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi" };

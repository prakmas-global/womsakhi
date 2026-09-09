"use client";

import * as Icons from "@/components/ux/icons";
import { Card, I, IconTile, v } from "@/components/ux/kit";

/* ------------------------------------------------------------------ */
/*  The four steps                                                     */
/* ------------------------------------------------------------------ */

export const STEPS = [
  { id: 1, label: "What it is" },
  { id: 2, label: "Price and delivery" },
  { id: 3, label: "Photos" },
  { id: 4, label: "Check and publish" },
] as const;

/**
 * Where she is in the four steps.
 *
 * A completed step is a button, not a label: she can go back and change an
 * answer without losing the ones after it. A step she has not reached yet is
 * not clickable, because arriving at "Photos" with no title is a dead end she
 * would have to reverse out of.
 */
export function Steps({ at, done, onGo }: {
  at: number; done: number; onGo: (n: number) => void;
}) {
  return (
    <ol className="ux-noscroll mb-5 flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const isDone = s.id < done || (s.id < at);
        const here = s.id === at;
        const reachable = s.id <= done;
        return (
          <li key={s.id} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGo(s.id)}
              aria-current={here ? "step" : undefined}
              className="ux-press ux-sq flex items-center gap-2 rounded-full py-1 pe-3 ps-1 disabled:cursor-default"
            >
              <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full text-xs font-bold"
                    style={{
                      background: v(here ? "--ux-fill" : isDone ? "--ux-tint-green" : "--ux-surface-2"),
                      color: v(here ? "--ux-on-brand" : isDone ? "--ux-green-ink" : "--ux-muted"),
                    }}>
                {isDone ? <Icons.Check className="h-[14px] w-[14px]" /> : s.id}
              </span>
              <span className="whitespace-nowrap text-xs font-bold"
                    style={{ color: v(here ? "--ux-ink" : "--ux-muted") }}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-[1.5px] w-[24px] rounded-full"
                    style={{ background: v("--ux-line") }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  A big pickable card                                                */
/* ------------------------------------------------------------------ */

export function Choice({ icon, title, sub, on, onClick }: {
  icon: string; title: string; sub: string; on: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
            className="ux-press ux-sq flex flex-1 items-start gap-3 rounded-[14px] border p-3.5 text-start"
            style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"),
                     background: v(on ? "--ux-brand-tint" : "--ux-surface") }}>
      <IconTile icon={icon} tint={on ? "--ux-brand-tint-2" : "--ux-surface-2"}
                ink={on ? "--ux-brand" : "--ux-muted"} size={38} radius={11} />
      <span className="min-w-0">
        <span className="block text-xsm font-bold" style={{ color: v("--ux-ink") }}>{title}</span>
        <span className="mt-0.5 block text-xs leading-snug" style={{ color: v("--ux-muted") }}>{sub}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Form furniture                                                     */
/* ------------------------------------------------------------------ */

export function Label({ children, need, hint }: {
  children: React.ReactNode; need?: boolean; hint?: string;
}) {
  return (
    <span className="mb-1.5 flex items-baseline gap-1.5">
      <span className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{children}</span>
      {need && <span aria-hidden style={{ color: v("--ux-danger-ink") }}>*</span>}
      {hint && <span className="text-2xs" style={{ color: v("--ux-muted") }}>{hint}</span>}
    </span>
  );
}

/** A counted textarea. The count is a budget, not a warning. */
export function Area({ value, onChange, placeholder, max, rows = 3, label }: {
  value: string; onChange: (s: string) => void; placeholder: string;
  max: number; rows?: number; label: string;
}) {
  return (
    <>
      <textarea
        value={value}
        rows={rows}
        aria-label={label}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ux-sq w-full rounded-[12px] border px-3.5 py-3 text-xsm leading-relaxed outline-none"
        style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }}
      />
      <span className="mt-1 block text-end text-2xs" style={{ color: v("--ux-faint") }}>
        {value.length}/{max}
      </span>
    </>
  );
}

export function Text({ value, onChange, placeholder, label, prefix, type = "text", max }: {
  value: string; onChange: (s: string) => void; placeholder?: string; label: string;
  prefix?: string; type?: string; max?: number;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] border px-3.5"
          style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
      {prefix && <span className="shrink-0 text-xsm" style={{ color: v("--ux-muted") }}>{prefix}</span>}
      <input
        value={value}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        maxLength={max}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[46px] w-full bg-transparent text-xsm outline-none"
        style={{ color: v("--ux-ink") }}
      />
    </span>
  );
}

export function Select({ value, onChange, options, label, placeholder }: {
  value: string; onChange: (s: string) => void; options: string[]; label: string; placeholder?: string;
}) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}
            className="ux-sq min-h-[46px] w-full rounded-[12px] border px-3 text-xsm outline-none"
            style={{ borderColor: v("--ux-line"), background: v("--ux-surface"),
                     color: v(value ? "--ux-ink" : "--ux-muted") }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** A switch that says what it does, not just on or off. */
export function Toggle({ on, onChange, label, sub }: {
  on: boolean; onChange: (b: boolean) => void; label: string; sub?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
            className="ux-sq flex w-full items-start gap-3 text-start">
      <span className="mt-[2px] flex h-[24px] w-[42px] shrink-0 items-center rounded-full p-[3px] transition-colors"
            style={{ background: v(on ? "--ux-fill" : "--ux-line-strong") }}>
        <span className="h-[18px] w-[18px] rounded-full transition-transform"
              style={{ background: v("--ux-surface"),
                       transform: on ? "translateX(18px)" : "translateX(0)" }} />
      </span>
      <span className="min-w-0">
        <span className="block text-xsm font-bold" style={{ color: v("--ux-ink") }}>{label}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug" style={{ color: v("--ux-muted") }}>{sub}</span>}
      </span>
    </button>
  );
}

export function Check({ on, onChange, label }: {
  on: boolean; onChange: (b: boolean) => void; label: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)}
            className="ux-sq flex w-full items-center gap-2.5 py-1.5 text-start">
      <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] border-2"
            style={{ borderColor: v(on ? "--ux-fill" : "--ux-line-strong"),
                     background: v(on ? "--ux-fill" : "--ux-surface") }}>
        {on && <Icons.Check className="h-[13px] w-[13px]" style={{ color: v("--ux-on-brand") }} />}
      </span>
      <span className="text-xsm" style={{ color: v("--ux-ink-2") }}>{label}</span>
    </button>
  );
}

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

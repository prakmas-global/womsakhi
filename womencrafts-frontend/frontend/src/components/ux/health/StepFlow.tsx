"use client";

import { useEffect, useState } from "react";

import { Btn, Sheet } from "@/components/ux/kit";
import { artOf } from "./art";
import { HUE, I, type Hue } from "./kit";

/**
 * Health & Wellness forms, after the approved design: no long form sits open
 * on a page. A small launcher card ("Log a workout · 4 quick steps") opens a
 * sheet that asks one thing at a time — mostly pictures to tap, which move on
 * by themselves — with "Step i of n", Back and Next, and a last step that
 * shows what will be saved. Typing is only ever the fallback.
 */

export interface FlowStep {
  id: string;
  /** The question, in her words. */
  title: string;
  hint?: string;
  body: React.ReactNode;
  /** Next stays off until this is true. */
  valid?: boolean;
  /** Shows "Skip" instead of a disabled Next while nothing is chosen. */
  optional?: boolean;
}

export function StepSheet({ open, onClose, icon, title, hue, steps, step, setStep, onSubmit, submitLabel = "Save", busy }: {
  open: boolean;
  onClose: () => void;
  icon: string;
  title: string;
  hue: Hue;
  steps: FlowStep[];
  step: number;
  setStep: (n: number) => void;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const h = HUE[hue];
  const s = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const ok = s.valid !== false;
  // Enter moves on, as a keyboard user expects of a form.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "BUTTON") return;
      if (!ok) return;
      e.preventDefault();
      if (last) onSubmit(); else setStep(step + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ok, last, step, setStep, onSubmit]);

  return (
    <Sheet open={open} onClose={onClose} icon={icon} title={title} width={520}
           description={`Step ${step + 1} of ${steps.length}`}
           footer={
             <div className="flex gap-2">
               {step > 0 && <Btn variant="outline" icon="ChevronLeft" onClick={() => setStep(step - 1)}>Back</Btn>}
               {last
                 ? <Btn full icon="Check" loading={busy} disabled={!ok} onClick={onSubmit}>{submitLabel}</Btn>
                 : <Btn full iconEnd="ArrowRight" disabled={!ok && !s.optional} onClick={() => setStep(step + 1)}>
                     {!ok && s.optional ? "Skip" : "Next"}
                   </Btn>}
             </div>
           }>
      <div className="flex flex-col gap-5" data-step-flow={title}>
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((x, i) => (
            <span key={x.id} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                  style={{ background: i <= step ? h.ink : "var(--ux-surface-2)" }} />
          ))}
        </div>
        <div key={s.id} className="ux-swap flex flex-col gap-4">
          <div>
            <h3 className="text-[20px] font-extrabold leading-tight" style={{ color: "var(--ux-ink)" }}>{s.title}</h3>
            {s.hint && <p className="mt-1 text-sm" style={{ color: "var(--ux-muted)" }}>{s.hint}</p>}
          </div>
          {s.body}
        </div>
      </div>
    </Sheet>
  );
}

/** Picture tiles: tap one (or several). `onPicked` lets a single choice move the flow on. */
export function PicChoice({ options, value, onChange, hue, label, multi = false, onPicked, columns = 3 }: {
  options: readonly (string | { value: string; label: string; art?: string; sub?: string })[];
  value: string | string[];
  onChange: (v: string) => void;
  hue: Hue;
  label: string;
  multi?: boolean;
  onPicked?: () => void;
  columns?: number;
}) {
  const h = HUE[hue];
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o, art: o, sub: "" } : { art: o.label, sub: "", ...o }));
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role="group" aria-label={label} className="grid gap-2.5"
         style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columns >= 4 ? 96 : 120}px, 1fr))` }}>
      {opts.map((o) => {
        const sel = on(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={sel}
                  onClick={() => { onChange(o.value); if (!multi && onPicked) window.setTimeout(onPicked, 180); }}
                  className="ux-press relative flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] px-2 py-3 text-center text-[13px] font-bold transition-[transform,border-color,background] duration-200 hover:-translate-y-0.5"
                  style={sel ? { borderColor: h.ink, background: h.tint, color: "var(--ux-ink)", boxShadow: `0 10px 22px -14px ${h.ink}` }
                             : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artOf(o.art ?? o.label)} alt="" className="h-11 w-11 drop-shadow-sm" />
            <span className="leading-tight">{o.label}</span>
            {o.sub && <span className="text-[11.5px] font-semibold leading-tight" style={{ color: "var(--ux-muted)" }}>{o.sub}</span>}
            {sel && (
              <span className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full" style={{ background: h.ink, color: "var(--ux-surface)" }}>
                <I name="Check" className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Big round number with − and + and quick presets: minutes, glasses, kilos. */
export function Dial({ value, onChange, unit, min = 0, max = 999, step = 1, presets = [], hue, label }: {
  value: number; onChange: (v: number) => void; unit: string; min?: number; max?: number; step?: number;
  presets?: number[]; hue: Hue; label: string;
}) {
  const h = HUE[hue];
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  // What she is typing, kept as text so "58." on the way to "58.5" survives; − and + snap to the step.
  const [draft, setDraft] = useState<string | null>(null);
  const typed = (raw: string) => {
    const clean = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 7);
    setDraft(clean);
    const n = Number(clean);
    if (clean && !Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    else if (!clean) onChange(min);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Less ${label}`} onClick={() => { setDraft(null); set(value - step); }}
                className="ux-press grid h-12 w-12 place-items-center rounded-full border-[1.5px] text-xl font-extrabold" style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}>−</button>
        <div className="grid h-[132px] w-[132px] place-items-center rounded-full" style={{ background: `radial-gradient(circle at 50% 35%, var(--ux-surface), ${h.tint})`, boxShadow: `inset 0 0 0 6px ${h.tint}, 0 14px 30px -18px ${h.ink}` }}>
          <span className="text-center leading-none">
            <input aria-label={label} inputMode="decimal" value={draft ?? (value ? String(value) : "")} placeholder="0"
                   onChange={(e) => typed(e.target.value)} onBlur={() => setDraft(null)}
                   className="w-[96px] bg-transparent text-center text-[38px] font-extrabold tabular-nums outline-none" style={{ color: h.ink }} />
            <span className="block text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{unit}</span>
          </span>
        </div>
        <button type="button" aria-label={`More ${label}`} onClick={() => { setDraft(null); set(value + step); }}
                className="ux-press grid h-12 w-12 place-items-center rounded-full border-[1.5px] text-xl font-extrabold" style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}>+</button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {presets.map((p) => (
            <button key={p} type="button" aria-pressed={value === p} onClick={() => { setDraft(null); set(p); }}
                    className="ux-press rounded-full border px-3 py-1 text-xs font-bold tabular-nums"
                    style={value === p ? { borderColor: h.ink, background: h.tint, color: "var(--ux-ink)" } : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              {p} {unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What will be saved, as a short list of label · value rows — the last step of a flow. */
export function Review({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-[16px] p-4 text-sm" style={{ background: "var(--ux-surface-2)" }}>
      {rows.filter(([, v]) => v !== "" && v != null).map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: "var(--ux-muted)" }}>{k}</dt>
          <dd className="font-bold" style={{ color: "var(--ux-ink)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The card that stands in for a form on the page: what it is, how short, and Start. */
export function FormLauncher({ art, title, sub, steps, hue, onStart, cta = "Start", id }: {
  art: string; title: string; sub?: string; steps: number; hue: Hue; onStart: () => void; cta?: string; id?: string;
}) {
  const h = HUE[hue];
  return (
    <section id={id} className="ux-card flex items-center gap-3.5 p-4" style={{ background: `linear-gradient(120deg, ${h.tint}, var(--ux-surface) 70%)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artOf(art)} alt="" className="h-12 w-12 shrink-0 drop-shadow" />
      <div className="min-w-0 flex-1">
        <b className="block text-[15px]" style={{ color: "var(--ux-ink)" }}>{title}</b>
        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub ?? `${steps} quick steps · tap pictures, type only if you want`}</span>
      </div>
      <Btn size="sm" icon="Play" onClick={onStart}>{cta}</Btn>
    </section>
  );
}

/** Step index state for a sheet, reset each time it opens. */
export function useFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  return { open, step, setStep, start: () => { setStep(0); setOpen(true); }, close: () => setOpen(false) };
}

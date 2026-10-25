"use client";

import { I, HUE, type Hue } from "@/components/ux/health/kit";

/**
 * Small controls shared by Nutrition and Sleep: a stepper that moves in a
 * chosen step (the kit's moves by 1), a time picker that is mostly presets,
 * and the edit / delete row every history list uses.
 */

export function StepNum({ value, onChange, step = 1, min = 0, max = 99999, label, unit }: {
  value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; label: string; unit?: string;
}) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, Math.round(n * 10) / 10)));
  const btn = "ux-press grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px] border disabled:opacity-40";
  const style = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} style={style} aria-label={`Less — ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
        <I name="Minus" className="h-4 w-4" />
      </button>
      <output aria-live="polite" aria-label={label}
              className="min-w-[88px] rounded-[12px] px-2 py-2 text-center text-base font-extrabold tabular-nums"
              style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
        {value}{unit && <small className="ms-1 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{unit}</small>}
      </output>
      <button type="button" className={btn} style={style} aria-label={`More — ${label}`} disabled={value >= max} onClick={() => set(value + step)}>
        <I name="Plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

const fmt12 = (t: string) => {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}`;
};
export { fmt12 };

/** Time as a row of taps, with the exact clock for anything else. */
export function TimePick({ value, onChange, presets, label, hue = "violet" }: {
  value: string; onChange: (t: string) => void; presets: string[]; label: string; hue?: Hue;
}) {
  const h = HUE[hue];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const on = p === value;
        return (
          <button key={p} type="button" aria-pressed={on} onClick={() => onChange(p)}
                  className="ux-press min-h-[40px] rounded-full border-[1.5px] px-3 text-[13.5px] font-bold tabular-nums"
                  style={on ? { borderColor: h.ink, background: h.tint, color: "var(--ux-ink)" }
                            : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
            {fmt12(p)}
          </button>
        );
      })}
      <input type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={`${label}, exact time`}
             className="min-h-[40px] rounded-full border-[1.5px] px-3 text-[13.5px] font-bold"
             style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
    </div>
  );
}

/** One line of a history list, with its date, a summary and edit / delete. */
export function HistoryRow({ when, title, meta, onEdit, onDelete, editing }: {
  when?: string; title: React.ReactNode; meta?: React.ReactNode; onEdit?: () => void; onDelete: () => void; editing?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-t py-3 first:border-t-0" data-history-row
        style={{ borderColor: "var(--ux-line)", background: editing ? "var(--ux-brand-tint)" : undefined }}>
      {when && <span className="w-[64px] shrink-0 text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{when}</span>}
      <span className="min-w-0 flex-1">
        <b className="block text-sm font-bold [overflow-wrap:anywhere]" style={{ color: "var(--ux-ink)" }}>{title}</b>
        {meta && <span className="block text-xs [overflow-wrap:anywhere]" style={{ color: "var(--ux-muted)" }}>{meta}</span>}
      </span>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label="Edit" className="ux-press grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
                style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <I name="Pencil" className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={onDelete} aria-label="Delete" className="ux-press grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
              style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
        <I name="Trash2" className="h-4 w-4" />
      </button>
    </li>
  );
}

/** A labelled block inside a form. */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[13.5px] font-bold" style={{ color: "var(--ux-ink)" }}>{label}</span>
      {children}
      {hint && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{hint}</span>}
    </div>
  );
}

/**
 * A one-line message inside a step of a step flow: the sleep duration, a
 * check that failed, a "you already logged this" warning. Errors are
 * announced, so a screen reader hears why Next is off.
 */
export function FlowNote({ tone = "info", hue = "violet", icon, children, ...rest }: {
  tone?: "info" | "warn" | "error"; hue?: Hue; icon?: string; children: React.ReactNode; [data: `data-${string}`]: string | boolean | undefined;
}) {
  const h = HUE[hue];
  const style = tone === "error" ? { background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }
    : tone === "warn" ? { background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }
    : { background: h.tint, color: h.ink };
  return (
    <p {...rest} role={tone === "error" ? "alert" : undefined} aria-live={tone === "error" ? undefined : "polite"}
       className="flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-sm font-bold" style={style}>
      <I name={icon ?? (tone === "error" ? "AlertCircle" : tone === "warn" ? "Info" : "Check")} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** The chosen time, large, above the time taps — so the step reads at a glance. */
export function TimeFace({ value, hue = "violet", caption }: { value: string; hue?: Hue; caption?: string }) {
  const h = HUE[hue];
  return (
    <div className="flex flex-col items-center gap-1 rounded-[18px] px-4 py-4"
         style={{ background: `linear-gradient(160deg, ${h.tint}, var(--ux-surface))` }} aria-hidden>
      <span className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: h.ink }}>{value ? fmt12(value) : "–"}</span>
      {caption && <span className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{caption}</span>}
    </div>
  );
}

/** A horizontal bar row — "Restful ▇▇▇▇ 4". */
export function HBar({ label, value, max, hue }: { label: string; value: number; max: number; hue: Hue }) {
  const h = HUE[hue];
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-center gap-2.5 text-[13px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>
      <span>{label}</span>
      <span className="h-[10px] overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
        <span className="block h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: h.ink }} />
      </span>
      <span className="text-end tabular-nums" style={{ color: "var(--ux-muted)" }}>{value}</span>
    </div>
  );
}

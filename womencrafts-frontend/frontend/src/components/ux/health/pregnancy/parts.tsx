"use client";

import { HUE, I, useEntries } from "@/components/ux/health/kit";
import type { Entry, HealthKind, Pregnancy } from "@/lib/health-api";
import { pregInfo, weeksOn, fmtWeeks } from "@/components/ux/health/pregnancy-data";
import { fmtDay } from "@/lib/health-api";

/**
 * Shared parts of the Pregnancy section's care tabs (Details, Check-ups,
 * Tests & scans, Risks, Medicines, Birth & after, History).
 *
 * Everything in them is what she records from her own care — her ANC card,
 * her reports, what her doctor told her. Nothing here diagnoses or advises a
 * treatment; where a screen could be read as advice it says to ask her doctor.
 */

/** The kinds the Pregnancy page loads once and hands to every tab. */
export const PREG_KINDS = [
  "pregsym", "kick", "contraction", "reminder", "measure",
  "anc", "pregtest", "pregrisk", "delivery", "postnatal", "pregepisode",
  "medication", "allergy", "history", "document",
] as const satisfies readonly HealthKind[];
export type PregKind = (typeof PREG_KINDS)[number];
export type PregStore = ReturnType<typeof useEntries<PregKind>>;

/** This pregnancy's entries of one kind, newest first (by date, then when saved). */
export function mine<K extends "anc" | "pregtest" | "pregrisk" | "delivery" | "postnatal">(store: PregStore, kind: K, preg: Pregnancy): Entry<K>[] {
  const id = preg.id ?? "";
  return (store.rows.filter((r) => r.kind === kind && ((r.data as { preg?: string }).preg ?? "") === id) as unknown as Entry<K>[])
    .sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at));
}

/** "Week 24 + 3" on a given day, for this pregnancy. */
export function weeksAt(preg: Pregnancy, day: string): string {
  const info = pregInfo(preg);
  return info && day ? fmtWeeks(weeksOn(info.lmp, day)) : "—";
}

export const long = { day: "numeric", month: "long", year: "numeric" } as const;
export const short = { day: "numeric", month: "short", year: "numeric" } as const;
export const fmtShort = (d?: string) => (d ? fmtDay(d, short) : "");

export const inputCls = "min-h-[44px] w-full rounded-[12px] border-[1.5px] px-3 text-[15px]";
export const inputStyle: React.CSSProperties = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };

/** A labelled text box. `problem` shows under it and marks it invalid. */
export function Field({ label, value, onChange, placeholder = "", max = 80, inputMode, problem, type = "text", min, maxDate, area }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number;
  inputMode?: "decimal" | "numeric" | "text"; problem?: string; type?: "text" | "date" | "time"; min?: string; maxDate?: string; area?: boolean;
}) {
  const style = { ...inputStyle, borderColor: problem ? "var(--ux-danger-ink)" : inputStyle.borderColor };
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink-2)" }}>
      {label}
      {area ? (
        <textarea value={value} maxLength={max} rows={3} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                  className={`${inputCls} py-2.5 font-normal`} style={style} aria-invalid={!!problem || undefined} />
      ) : (
        <input value={value} maxLength={type === "text" ? max : undefined} type={type} min={min} max={maxDate} inputMode={inputMode}
               onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
               className={`${inputCls} font-normal`} style={style} aria-invalid={!!problem || undefined} />
      )}
      {problem && <span role="alert" className="text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{problem}</span>}
    </label>
  );
}

/** Two or three fields side by side on a wide screen. */
export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/** A small coloured label: a status, a level, a flag. */
export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "green" | "amber" | "danger" | "lilac" | "blue" }) {
  const t = {
    muted: { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" },
    green: { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" },
    amber: { background: HUE.amber.tint, color: HUE.amber.ink },
    danger: { background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" },
    lilac: { background: HUE.lilac.tint, color: HUE.lilac.ink },
    blue: { background: HUE.blue.tint, color: HUE.blue.ink },
  }[tone];
  return <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold" style={t}>{children}</span>;
}

/** A row in a record list: an icon, what it is, when, and actions at the end. */
export function RecordRow({ icon, title, sub, tags, actions, children, hue = "lilac" }: {
  icon: string; title: React.ReactNode; sub?: React.ReactNode; tags?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; hue?: keyof typeof HUE;
}) {
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[hue].tint, color: HUE[hue].ink }}>
          <I name={icon} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{title}</b>
            {tags}
          </div>
          {sub && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children && <div className="ms-12 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{children}</div>}
    </li>
  );
}

/** Edit and delete, as icons. */
export function RowActions({ onEdit, onDelete, label }: { onEdit?: () => void; onDelete: () => void; label: string }) {
  return (
    <>
      {onEdit && (
        <button type="button" aria-label={`Edit ${label}`} onClick={onEdit}
                className="ux-press grid h-9 w-9 place-items-center rounded-[10px]" style={{ color: "var(--ux-muted)" }}>
          <I name="Pencil" className="h-4 w-4" />
        </button>
      )}
      <button type="button" aria-label={`Delete ${label}`} onClick={onDelete}
              className="ux-press grid h-9 w-9 place-items-center rounded-[10px]" style={{ color: "var(--ux-muted)" }}>
        <I name="Trash2" className="h-4 w-4" />
      </button>
    </>
  );
}

/** "Label: value" pairs, skipping blanks. */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== "" && v != null && v !== false);
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: "var(--ux-muted)" }}>{k}</dt>
          <dd style={{ color: "var(--ux-ink)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The line every care tab ends with. */
export function AskDoctor({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[12px] p-3 text-[13px]" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
      <I name="Info" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children ?? "This is your own record of your care. It does not diagnose anything — your doctor or ANM decides what is needed."}</span>
    </p>
  );
}

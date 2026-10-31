"use client";

import { useEffect, useRef, useState } from "react";

import { Text } from "@/components/ux/kit/form";
import { escapeHtml, letterhead, printDocument } from "@/components/ux/kit/download";
import { toast } from "@/components/ux/mobile/Toast";
import { Chips, HUE, I, type Hue } from "@/components/ux/health/kit";
import { PicChoice, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import {
  ALLERGY_PRESETS, DOC_TYPES, DOSE_PRESETS, HISTORY_CATS, HISTORY_PRESETS, MEAS, MED_PRESETS, SCHEDULES, SEVERITIES,
  measOf, primary, readingProblem, secondary, unitOf,
} from "@/components/ux/health/records-data";
import { apiErrorMessage } from "@/lib/api";
import {
  addDays, apiUploadHealthFile, fmtDay, today, type Entry, type HealthSettings, type KindData,
} from "@/lib/health-api";
import { validateDocument } from "@/lib/uploads-api";

/* ── small pieces ────────────────────────────────────────────────────── */

/** Blur what is on screen when she has "Hide details" on — someone may be looking. */
export function Private({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={on ? "select-none blur-[6px]" : undefined} aria-hidden={on || undefined}>{children}</span>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>{children}</p>;
}

function DayPick({ value, onChange, future = false }: { value: string; onChange: (d: string) => void; future?: boolean }) {
  const t = today();
  const opts = future
    ? [{ value: t, label: "Today" }, { value: addDays(t, 1), label: "Tomorrow" }]
    : [{ value: t, label: "Today" }, { value: addDays(t, -1), label: "Yesterday" }, { value: addDays(t, -7), label: "A week ago" }];
  return (
    <div className="flex flex-col gap-3">
      <Chips label="Day" hue="blue" value={value} options={opts} onChange={onChange} />
      <input type="date" value={value} max={future ? undefined : t} aria-label="Pick a day" onChange={(e) => e.target.value && onChange(e.target.value)}
             className="min-h-[44px] w-fit rounded-[12px] border-[1.5px] px-3 text-sm font-bold"
             style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
    </div>
  );
}

export function Row({ icon, hue = "blue", title, meta, actions, children }: {
  icon: string; hue?: Hue; title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: HUE[hue].tint, color: HUE[hue].ink }}>
          <I name={icon} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] [overflow-wrap:anywhere]" style={{ color: "var(--ux-ink)" }}>{title}</b>
          {meta && <p className="mt-0.5 text-xs [overflow-wrap:anywhere]" style={{ color: "var(--ux-muted)" }}>{meta}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap justify-end gap-1">{actions}</div>}
      </div>
      {children}
    </li>
  );
}

/* ── a line chart over time (two lines for blood pressure) ───────────── */

export function TrendChart({ rows, type }: { rows: Entry<"measure">[]; type: string }) {
  // Drawn at the width it is given, 1:1 (as BarChart is): a fixed 300px drawing
  // stretched across a wide card blew the labels and the line up to triple size.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const pts = rows.filter((r) => r.data.type === type).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const bp = !!measOf(type)?.bp;
  const drawn = pts.length >= 2;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawn]);
  if (pts.length < 2) {
    return <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Add another {type.toLowerCase()} reading to see a trend.</p>;
  }
  const a = pts.map((p) => primary(p.data.value));
  const b = bp ? pts.map((p) => secondary(p.data.value)) : [];
  const all = [...a, ...b];
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const min = lo - pad, max = hi + pad;
  const W = Math.max(width || 300, pts.length * 56), H = 190, top = 18, bottom = 28, left = 26, right = 26;
  const x = (i: number) => left + (i * (W - left - right)) / (pts.length - 1);
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - min) / (max - min));
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div ref={box} className="ux-scroll-x min-w-0" data-trend={type}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img"
           aria-label={`${type} over time: ${pts.map((p) => `${fmtDay(p.date)} ${p.data.value}`).join(", ")}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={left} x2={W - right} y1={top + (H - top - bottom) * f} y2={top + (H - top - bottom) * f} stroke="var(--ux-line)" />
        ))}
        <path d={line(a)} fill="none" stroke={HUE.blue.ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {bp && <path d={line(b)} fill="none" stroke={HUE.pink.ink} strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(a[i])} r="4" fill="var(--ux-surface)" stroke={HUE.blue.ink} strokeWidth="2.5" />
            <text x={x(i)} y={y(a[i]) - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ux-ink)">{p.data.value}</text>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ux-muted)">{fmtDay(p.date)}</text>
          </g>
        ))}
      </svg>
      {bp && (
        <p className="mt-1 flex gap-4 text-xs" style={{ color: "var(--ux-muted)" }}>
          <span className="flex items-center gap-1.5"><i className="block h-[3px] w-4 rounded" style={{ background: HUE.blue.ink }} />Upper (systolic)</span>
          <span className="flex items-center gap-1.5"><i className="block h-[3px] w-4 rounded" style={{ background: HUE.pink.ink }} />Lower (diastolic)</span>
        </p>
      )}
    </div>
  );
}

/** Up, down or level against the reading before — words as well as an arrow. */
export function Trend({ now, before }: { now: string; before?: string }) {
  if (!before) return null;
  const d = primary(now) - primary(before);
  const name = Math.abs(d) < 0.05 ? "Minus" : d > 0 ? "TrendingUp" : "TrendingDown";
  const word = Math.abs(d) < 0.05 ? "same as before" : d > 0 ? "up from last" : "down from last";
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ux-muted)" }}>
      <I name={name} className="h-3.5 w-3.5" /> {word}
    </span>
  );
}

/* ── sheets: each a short step flow, one question at a time ─────────────── */

type Save<K extends "measure" | "allergy" | "history" | "document" | "medication"> =
  (data: KindData[K], date: string) => Promise<unknown>;

/** "Today", "Yesterday", or the date, for a Review row. */
function dayWord(d: string) {
  const t = today();
  return d === t ? "Today" : d === addDays(t, -1) ? "Yesterday" : d === addDays(t, 1) ? "Tomorrow" : fmtDay(d, { day: "numeric", month: "short", year: "numeric" });
}

/** Her words for what is wrong, said on the step where it happened. */
function StepError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[12px] px-3 py-2 text-sm font-bold" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
      {children}
    </p>
  );
}

/** How much − and + move a reading, and where they start from when it is empty. */
const READ_STEP: Record<string, { step: number; start: number }> = {
  Weight: { step: 0.5, start: 55 }, "Blood sugar": { step: 1, start: 100 }, Haemoglobin: { step: 0.1, start: 12 },
  Pulse: { step: 1, start: 75 }, "Temperature (°C)": { step: 0.1, start: 36.8 }, "Temperature (°F)": { step: 0.1, start: 98.4 },
  Height: { step: 1, start: 155 },
};

/** A reading as a big round number she can type into, with − and +. Kept as text so 58.5 types as she expects. */
function ReadingDial({ value, onChange, unit, label, hue, invalid, step, start, decimal = true, size = "lg" }: {
  value: string; onChange: (s: string) => void; unit: string; label: string; hue: Hue; invalid?: boolean;
  step?: number; start?: number; decimal?: boolean; size?: "lg" | "sm";
}) {
  const h = HUE[hue];
  const bump = (dir: number) => {
    if (!step) return;
    const n = value ? Number(value) : (start ?? 0) - dir * step;
    const dec = step < 1 ? 1 : 0;
    onChange(String(Number(Math.max(0, n + dir * step).toFixed(dec))));
  };
  const ring = invalid ? "var(--ux-danger-ink)" : h.tint;
  const big = size === "lg";
  const btn = "ux-press grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] text-xl font-extrabold";
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      {step ? <button type="button" aria-label={`Less ${label}`} onClick={() => bump(-1)} className={btn} style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}>−</button> : null}
      <div className={`grid place-items-center rounded-full ${big ? "h-[136px] w-[136px]" : "h-[112px] w-[112px]"}`}
           style={{ background: `radial-gradient(circle at 50% 35%, var(--ux-surface), ${h.tint})`, boxShadow: `inset 0 0 0 6px ${ring}, 0 14px 30px -18px ${h.ink}` }}>
        <span className="text-center leading-none">
          <input aria-label={label} aria-invalid={invalid || undefined} inputMode={decimal ? "decimal" : "numeric"} value={value} placeholder="0" maxLength={7}
                 onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""))}
                 className={`${big ? "w-[104px] text-[36px]" : "w-[84px] text-[30px]"} bg-transparent text-center font-extrabold tabular-nums outline-none`}
                 style={{ color: h.ink }} />
          <span className="block text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{unit}</span>
        </span>
      </div>
      {step ? <button type="button" aria-label={`More ${label}`} onClick={() => bump(1)} className={btn} style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}>+</button> : null}
    </div>
  );
}

export function ReadingSheet({ onClose, onSave, initialType }: { onClose: () => void; onSave: Save<"measure">; initialType?: string }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState(initialType || "Weight");
  const [value, setValue] = useState("");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const m = measOf(type);
  const bp = !!m?.bp;
  const v = bp ? (sys && dia ? `${sys}/${dia}` : "") : value;
  const problem = v ? readingProblem(type, v) : "";
  const unit = unitOf(type);
  const save = async () => {
    if (!v || problem) return;
    setBusy(true);
    try { await onSave({ type, value: v }, date); } finally { setBusy(false); }
  };
  const flow: FlowStep[] = [
    { id: "type", title: "What did you measure?", hint: "For your own tracking. Ask your doctor what your numbers mean for you.",
      body: <PicChoice label="Reading type" hue="blue" columns={4} value={type} onPicked={() => setStep(1)}
                       onChange={(t) => { setType(t); setValue(""); }}
                       options={MEAS.map((x) => ({ value: x.type, label: x.type, sub: x.unit }))} /> },
    { id: "value", title: bp ? "What did the machine show?" : `Your ${type.toLowerCase()}`, hint: bp ? "The upper number, then the lower one." : `In ${unit}. Type it, or use − and +.`,
      valid: !!v && !problem,
      body: <>
        {bp ? (
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <ReadingDial label="Upper number" value={sys} onChange={setSys} unit="upper" hue="blue" decimal={false} size="sm" invalid={!!problem} />
            <span className="text-3xl font-extrabold" aria-hidden style={{ color: "var(--ux-muted)" }}>/</span>
            <ReadingDial label="Lower number" value={dia} onChange={setDia} unit="lower" hue="blue" decimal={false} size="sm" invalid={!!problem} />
          </div>
        ) : (
          <ReadingDial label={`${type} reading`} value={value} onChange={setValue} unit={unit} hue="blue" invalid={!!problem}
                       step={READ_STEP[type]?.step} start={READ_STEP[type]?.start} decimal />
        )}
        {problem && <StepError>{problem}</StepError>}
        <p className="rounded-[12px] px-3 py-2 text-xs" style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>{m?.range}</p>
      </> },
    { id: "when", title: "When did you take it?", body: <DayPick value={date} onChange={setDate} /> },
    { id: "check", title: "Check, then save", valid: !!v && !problem,
      body: <Review rows={[["Reading", type], ["Value", v ? `${v} ${unit}` : ""], ["Day", dayWord(date)]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Activity" title="Add a reading" hue="blue" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save reading" />;
}

const SEVERITY_SUB: Record<string, string> = { Mild: "A little discomfort", Moderate: "Bothers me for a while", Severe: "Needs urgent care" };
const REACTIONS = ["Rash", "Sneezing", "Swelling", "Breathing trouble", "Stomach upset"];

export function AllergySheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"allergy"> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<KindData["allergy"]["severity"]>("Mild");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onSave({ name: name.trim(), reaction: reaction.trim(), severity }, ""); } finally { setBusy(false); }
  };
  const flow: FlowStep[] = [
    { id: "what", title: "What are you allergic to?", hint: "Tap one, or write it.", valid: !!name.trim(),
      body: <>
        <Chips label="Common allergies" hue="pink" value={name} onChange={setName} options={ALLERGY_PRESETS} />
        <Text label="Allergic to" value={name} max={80} placeholder="Or write it" onChange={setName} />
      </> },
    { id: "how", title: "How bad does it get?",
      body: <PicChoice label="Severity" hue="pink" value={severity} onPicked={() => setStep(2)}
                       onChange={(s) => setSeverity(s as KindData["allergy"]["severity"])}
                       options={SEVERITIES.map((s) => ({ value: s, label: s, sub: SEVERITY_SUB[s] }))} /> },
    { id: "react", title: "What happens to you?", hint: "Optional.", optional: true, valid: !!reaction,
      body: <Chips label="Reactions" hue="pink" value={reaction} onChange={setReaction} options={REACTIONS} /> },
    { id: "check", title: "Check, then save", hint: "Tell every new doctor about this.", valid: !!name.trim(),
      body: <Review rows={[["Allergic to", name.trim()], ["How bad", severity], ["What happens", reaction]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="ShieldAlert" title="Add an allergy" hue="pink" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save allergy" />;
}

const HISTORY_Q: Record<string, string> = {
  "Previous condition": "Which condition?", Surgery: "Which surgery?", Vaccination: "Which vaccine?",
  "Family history": "Who in your family, and what?", Other: "What is it?",
};

export function HistorySheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"history"> }) {
  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<KindData["history"]["cat"]>("Previous condition");
  const [condition, setCondition] = useState("");
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);
  const [year] = useState(() => new Date().getFullYear());
  const save = async () => {
    if (!condition.trim()) return;
    setBusy(true);
    try { await onSave({ cat, condition: condition.trim(), since }, ""); } finally { setBusy(false); }
  };
  const flow: FlowStep[] = [
    { id: "kind", title: "What would you like to add?",
      body: <PicChoice label="Category" hue="blue" value={cat} onPicked={() => setStep(1)}
                       onChange={(c) => { setCat(c as KindData["history"]["cat"]); setCondition(""); }} options={HISTORY_CATS} /> },
    { id: "what", title: HISTORY_Q[cat] ?? "Details", hint: HISTORY_PRESETS[cat].length ? "Tap one, or write it." : "Write it in your words.", valid: !!condition.trim(),
      body: <>
        {HISTORY_PRESETS[cat].length > 0 && <Chips label="Common" hue="blue" value={condition} onChange={setCondition} options={HISTORY_PRESETS[cat]} />}
        <Text label="Details" value={condition} max={100} placeholder="Or write it" onChange={setCondition} />
      </> },
    { id: "year", title: "Which year?", hint: "Optional. Roughly is fine.", optional: true, valid: !!since,
      body: <Chips label="Year" hue="blue" value={since} onChange={(y) => setSince(since === y ? "" : y)}
                   options={[year, year - 1, year - 2, year - 5, year - 10].map(String)} /> },
    { id: "check", title: "Check, then save", valid: !!condition.trim(),
      body: <Review rows={[["Kind", cat], ["Details", condition.trim()], ["Year", since]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="ClipboardList" title="Add to your medical history" hue="blue" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save" />;
}

export function DocumentSheet({ onClose, onSave, initialType = "Lab report", title: heading = "Add a report or paper" }: {
  onClose: () => void; onSave: Save<"document">; initialType?: string; title?: string;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<string>(initialType);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(today());
  const [shareable, setShareable] = useState(true);
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    const bad = validateDocument(f);
    if (bad) { toast(bad, { tone: "error" }); return; }
    setUploading(true);
    try {
      const up = await apiUploadHealthFile(f);
      setFile({ id: up.id, name: up.name });
      if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 100));
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); } finally { setUploading(false); }
  };
  const save = async () => {
    if (!title.trim() || uploading) return;
    setBusy(true);
    try { await onSave({ title: title.trim(), type, provider: provider.trim(), shareable, file_id: file?.id ?? "", file_name: file?.name ?? "" }, date); }
    finally { setBusy(false); }
  };
  const flow: FlowStep[] = [
    { id: "file", title: "Add a photo or PDF", hint: "Optional · up to 10 MB. Kept privately — only you can open it.",
      optional: !uploading, valid: !!file && !uploading,
      body: <>
        <button type="button" onClick={() => input.current?.click()} disabled={uploading} aria-busy={uploading || undefined}
                className="ux-press flex min-h-[112px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed px-4 py-4 text-center"
                style={{ borderColor: file ? HUE.blue.ink : "var(--ux-line-strong)", background: file ? HUE.blue.tint : "var(--ux-surface-2)" }}>
          <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--ux-surface)", color: HUE.blue.ink }}>
            <I name={file ? "FileCheck" : "Upload"} className="h-6 w-6" />
          </span>
          <b className="block max-w-full truncate text-sm" style={{ color: "var(--ux-ink)" }}>{uploading ? "Uploading…" : file ? file.name : "Choose a photo or PDF"}</b>
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{file ? "Tap to choose a different one" : "Or skip, and add just the details"}</span>
        </button>
        <input ref={input} type="file" accept="image/*,application/pdf" capture={undefined} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </> },
    { id: "type", title: "What kind of paper is it?",
      body: <PicChoice label="Document type" hue="blue" value={type} onChange={setType} onPicked={() => setStep(2)} options={DOC_TYPES} /> },
    { id: "title", title: "What is it called?", hint: "As written on it, or in your words.", valid: !!title.trim(),
      body: <Text label="Title" value={title} max={100} placeholder="Thyroid test" onChange={setTitle} /> },
    { id: "date", title: "What date is on it?", body: <DayPick value={date} onChange={setDate} /> },
    { id: "who", title: "Doctor, clinic or lab", hint: "Optional.", optional: true, valid: !!provider.trim(),
      body: <Text label="Doctor, clinic or lab" value={provider} max={80} placeholder="City Diagnostics" onChange={setProvider} /> },
    { id: "check", title: "Check, then save", valid: !!title.trim() && !uploading,
      body: <>
        <Review rows={[["File", file?.name ?? "No file"], ["Type", type], ["Title", title.trim()], ["Date", dayWord(date)], ["From", provider.trim()]]} />
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 text-sm font-semibold"
               style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
          <input type="checkbox" checked={shareable} onChange={(e) => setShareable(e.target.checked)} className="mt-0.5 h-[18px] w-[18px]" style={{ accentColor: "var(--ux-brand)" }} />
          I may want to show this in a consultation
        </label>
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="FileText" title={heading} hue="blue" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save" />;
}

/** When she takes it, as pictures. */
const SCHEDULE_ART: Record<string, string> = {
  "Empty stomach, morning": "Water", "After breakfast": "Breakfast", "After lunch": "Lunch", "After dinner": "Dinner", "Before bed": "Night",
};

export function MedicineSheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"medication"> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("1 tablet");
  const [schedule, setSchedule] = useState("After breakfast");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onSave({ name: name.trim(), dose, schedule, reason: reason.trim(), status: "Taking now", taken: [] }, ""); } finally { setBusy(false); }
  };
  const flow: FlowStep[] = [
    { id: "name", title: "Which medicine?", hint: "As your doctor prescribed. The app never changes a dose.", valid: !!name.trim(),
      body: <>
        <Chips label="Common medicines" hue="green" value={name} onChange={setName} options={MED_PRESETS} />
        <Text label="Medicine name" value={name} max={80} placeholder="Or write the name on the strip" onChange={setName} />
      </> },
    { id: "dose", title: "How much each time?",
      body: <Chips label="Dose" hue="green" value={dose} onChange={setDose} options={DOSE_PRESETS} /> },
    { id: "when", title: "When do you take it?",
      body: <PicChoice label="When" hue="green" value={schedule} onChange={setSchedule} onPicked={() => setStep(3)}
                       options={SCHEDULES.map((s) => ({ value: s, label: s, art: SCHEDULE_ART[s] ?? "Medicine" }))} /> },
    { id: "for", title: "What is it for?", hint: "Optional.", optional: true, valid: !!reason.trim(),
      body: <Text label="What it is for" value={reason} max={80} placeholder="Thyroid" onChange={setReason} /> },
    { id: "check", title: "Check, then save", valid: !!name.trim(),
      body: <Review rows={[["Medicine", name.trim()], ["Dose", dose], ["When", schedule], ["For", reason.trim()]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Pill" title="Add a medicine" hue="green" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save medicine" />;
}

/* ── the summary she can print or save as PDF ──────────────────────────── */

export function printSummary({ name, settings, readings, allergies, meds, history, docs }: {
  name: string; settings: HealthSettings; readings: Entry<"measure">[]; allergies: Entry<"allergy">[];
  meds: Entry<"medication">[]; history: Entry<"history">[]; docs: Entry<"document">[];
}): string {
  const e = escapeHtml;
  const latest = new Map<string, Entry<"measure">>();
  [...readings].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => latest.set(r.data.type, r));
  const li = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${x}</li>`).join("")}</ul>` : "<p>None recorded.</p>");
  const html = `${letterhead(`Health summary — ${name || "Me"}`, `Printed ${fmtDay(today(), { day: "numeric", month: "long", year: "numeric" })}. Shared by her, for her doctor.`)}
<h2>About me</h2>${li([
    settings.bloodGroup ? `Blood group: <b>${e(settings.bloodGroup)}</b>` : "",
    settings.heightCm ? `Height: <b>${settings.heightCm} cm</b>` : "",
    settings.emergencyContact ? `Emergency contact: ${e(settings.emergencyContact)}` : "",
  ].filter(Boolean))}
<h2>Allergies</h2>${li(allergies.map((a) => `<b>${e(a.data.name)}</b> — ${e(a.data.severity)}${a.data.reaction ? ` (${e(a.data.reaction)})` : ""}`))}
<h2>Medicines I take now</h2>${li(meds.filter((m) => m.data.status !== "Stopped").map((m) => `<b>${e(m.data.name)}</b>${m.data.dose ? `, ${e(m.data.dose)}` : ""}${m.data.schedule ? ` — ${e(m.data.schedule)}` : ""}`))}
<h2>Latest readings</h2>${li([...latest.values()].map((r) => `${e(r.data.type)}: <b>${e(r.data.value)} ${e(unitOf(r.data.type))}</b> (${fmtDay(r.date, { day: "numeric", month: "short", year: "numeric" })})`))}
<h2>Medical history</h2>${li(history.map((h) => `${e(h.data.cat)}: <b>${e(h.data.condition)}</b>${h.data.since ? ` (${e(h.data.since)})` : ""}`))}
<h2>Reports I can show</h2>${li(docs.filter((d) => d.data.shareable).map((d) => `${e(d.data.title)} — ${e(d.data.type)}${d.date ? `, ${fmtDay(d.date, { day: "numeric", month: "short", year: "numeric" })}` : ""}`))}
<p style="margin-top:18px;font-size:12px;color:#5f5873">Readings are her own. They are not a diagnosis.</p>`;
  return printDocument("Health summary", html);
}

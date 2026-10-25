"use client";

import { useRef, useState } from "react";

import { Btn, Sheet } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { escapeHtml, letterhead, printDocument } from "@/components/ux/kit/download";
import { toast } from "@/components/ux/mobile/Toast";
import { Chips, HUE, I, type Hue } from "@/components/ux/health/kit";
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
    <div className="flex flex-wrap items-center gap-2">
      <Chips label="Day" hue="blue" value={value} options={opts} onChange={onChange} />
      <input type="date" value={value} max={future ? undefined : t} aria-label="Pick a day" onChange={(e) => e.target.value && onChange(e.target.value)}
             className="min-h-[40px] rounded-[12px] border px-3 text-sm"
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
  const pts = rows.filter((r) => r.data.type === type).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const bp = !!measOf(type)?.bp;
  if (pts.length < 2) {
    return <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Add another {type.toLowerCase()} reading to see a trend.</p>;
  }
  const a = pts.map((p) => primary(p.data.value));
  const b = bp ? pts.map((p) => secondary(p.data.value)) : [];
  const all = [...a, ...b];
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const min = lo - pad, max = hi + pad;
  const W = Math.max(300, pts.length * 56), H = 190, top = 18, bottom = 28, left = 26, right = 26;
  const x = (i: number) => left + (i * (W - left - right)) / (pts.length - 1);
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - min) / (max - min));
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto" data-trend={type}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[300px]" role="img"
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

/* ── sheets ──────────────────────────────────────────────────────────── */

type Save<K extends "measure" | "allergy" | "history" | "document" | "medication"> =
  (data: KindData[K], date: string) => Promise<unknown>;

export function ReadingSheet({ onClose, onSave, initialType }: { onClose: () => void; onSave: Save<"measure">; initialType?: string }) {
  const [type, setType] = useState(initialType || "Weight");
  const [value, setValue] = useState("");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const bp = !!measOf(type)?.bp;
  const v = bp ? (sys && dia ? `${sys}/${dia}` : "") : value;
  const problem = v ? readingProblem(type, v) : "";
  const save = async () => { setBusy(true); try { await onSave({ type, value: v }, date); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} icon="Activity" title="Add a reading" description="For your own tracking. Ask your doctor what your numbers mean for you."
           footer={<Btn full icon="Check" disabled={!v || !!problem} loading={busy} onClick={save}>Save reading</Btn>}>
      <div className="flex flex-col gap-5" data-reading-sheet>
        <div><Label>What did you measure?</Label>
          <Chips label="Reading type" hue="blue" value={type} onChange={(t) => { setType(t); setValue(""); }} options={MEAS.map((m) => m.type)} />
        </div>
        <div><Label>Reading ({unitOf(type)})</Label>
          {bp ? (
            <div className="flex items-center gap-2">
              <NumIn label="Upper number" value={sys} onChange={setSys} placeholder="120" />
              <span className="text-xl font-bold" style={{ color: "var(--ux-muted)" }}>/</span>
              <NumIn label="Lower number" value={dia} onChange={setDia} placeholder="80" />
            </div>
          ) : <NumIn label={`${type} reading`} value={value} onChange={setValue} placeholder={type === "Weight" ? "58.5" : ""} decimal />}
          {problem && <p className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{problem}</p>}
          <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>{measOf(type)?.range}</p>
        </div>
        <div><Label>When</Label><DayPick value={date} onChange={setDate} /></div>
      </div>
    </Sheet>
  );
}

function NumIn({ label, value, onChange, placeholder, decimal }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; decimal?: boolean }) {
  return (
    <input value={value} inputMode={decimal ? "decimal" : "numeric"} aria-label={label} placeholder={placeholder} maxLength={7}
           onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""))}
           className="min-h-[50px] w-full max-w-[160px] rounded-[12px] border px-4 text-lg font-bold tabular-nums"
           style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
  );
}

export function AllergySheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"allergy"> }) {
  const [name, setName] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<KindData["allergy"]["severity"]>("Mild");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} icon="ShieldAlert" title="Add an allergy"
           footer={<Btn full icon="Check" disabled={!name.trim()} loading={busy} onClick={async () => { setBusy(true); try { await onSave({ name: name.trim(), reaction: reaction.trim(), severity }, ""); } finally { setBusy(false); } }}>Save allergy</Btn>}>
      <div className="flex flex-col gap-5">
        <div><Label>Allergic to</Label>
          <Chips label="Common allergies" hue="pink" value={name} onChange={setName} options={ALLERGY_PRESETS} />
          <div className="mt-2"><Text label="Allergic to" value={name} max={80} placeholder="Or write it" onChange={setName} /></div>
        </div>
        <div><Label>How bad is it?</Label><Chips label="Severity" hue="pink" value={severity} onChange={setSeverity} options={SEVERITIES} /></div>
        <div><Label>What happens (optional)</Label>
          <Chips label="Reactions" hue="pink" value={reaction} onChange={setReaction} options={["Rash", "Sneezing", "Swelling", "Breathing trouble", "Stomach upset"]} />
        </div>
      </div>
    </Sheet>
  );
}

export function HistorySheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"history"> }) {
  const [cat, setCat] = useState<KindData["history"]["cat"]>("Previous condition");
  const [condition, setCondition] = useState("");
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();
  return (
    <Sheet open onClose={onClose} icon="ClipboardList" title="Add to your medical history"
           footer={<Btn full icon="Check" disabled={!condition.trim()} loading={busy} onClick={async () => { setBusy(true); try { await onSave({ cat, condition: condition.trim(), since }, ""); } finally { setBusy(false); } }}>Save</Btn>}>
      <div className="flex flex-col gap-5">
        <div><Label>What kind</Label><Chips label="Category" hue="blue" value={cat} onChange={(c) => { setCat(c); setCondition(""); }} options={HISTORY_CATS} /></div>
        <div><Label>Details</Label>
          {HISTORY_PRESETS[cat].length > 0 && <Chips label="Common" hue="blue" value={condition} onChange={setCondition} options={HISTORY_PRESETS[cat]} />}
          <div className="mt-2"><Text label="Details" value={condition} max={100} placeholder="Or write it" onChange={setCondition} /></div>
        </div>
        <div><Label>Year (optional)</Label>
          <Chips label="Year" hue="blue" value={since} onChange={(y) => setSince(since === y ? "" : y)}
                 options={[year, year - 1, year - 2, year - 5, year - 10].map(String)} />
        </div>
      </div>
    </Sheet>
  );
}

export function DocumentSheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"document"> }) {
  const [type, setType] = useState<string>("Lab report");
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
  return (
    <Sheet open onClose={onClose} icon="FileText" title="Add a report or paper" description="Kept privately. Only you can open it."
           footer={<Btn full icon="Check" disabled={!title.trim() || uploading} loading={busy}
                        onClick={async () => { setBusy(true); try { await onSave({ title: title.trim(), type, provider: provider.trim(), shareable, file_id: file?.id ?? "", file_name: file?.name ?? "" }, date); } finally { setBusy(false); } }}>Save</Btn>}>
      <div className="flex flex-col gap-5" data-document-sheet>
        <div>
          <button type="button" onClick={() => input.current?.click()} disabled={uploading}
                  className="ux-press flex min-h-[64px] w-full items-center gap-3 rounded-[14px] border-[1.5px] border-dashed px-4 text-start"
                  style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface-2)" }}>
            <I name={file ? "FileCheck" : "Upload"} className="h-6 w-6" style={{ color: HUE.blue.ink }} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{uploading ? "Uploading…" : file ? file.name : "Add a photo or PDF"}</b>
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{file ? "Tap to choose a different one" : "Optional · up to 10 MB"}</span>
            </span>
          </button>
          <input ref={input} type="file" accept="image/*,application/pdf" capture={undefined} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div><Label>Type</Label><Chips label="Document type" hue="blue" value={type} onChange={setType} options={DOC_TYPES} /></div>
        <div><Label>Title</Label><Text label="Title" value={title} max={100} placeholder="Thyroid test" onChange={setTitle} /></div>
        <div><Label>Date on it</Label><DayPick value={date} onChange={setDate} /></div>
        <div><Label>Doctor, clinic or lab (optional)</Label><Text label="Doctor, clinic or lab" value={provider} max={80} placeholder="City Diagnostics" onChange={setProvider} /></div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
          <input type="checkbox" checked={shareable} onChange={(e) => setShareable(e.target.checked)} className="mt-0.5 h-[18px] w-[18px]" style={{ accentColor: "var(--ux-brand)" }} />
          I may want to show this in a consultation
        </label>
      </div>
    </Sheet>
  );
}

export function MedicineSheet({ onClose, onSave }: { onClose: () => void; onSave: Save<"medication"> }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("1 tablet");
  const [schedule, setSchedule] = useState("After breakfast");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} icon="Pill" title="Add a medicine" description="As your doctor prescribed. The app never changes a dose."
           footer={<Btn full icon="Check" disabled={!name.trim()} loading={busy} onClick={async () => { setBusy(true); try { await onSave({ name: name.trim(), dose, schedule, reason: reason.trim(), status: "Taking now", taken: [] }, ""); } finally { setBusy(false); } }}>Save medicine</Btn>}>
      <div className="flex flex-col gap-5">
        <div><Label>Medicine</Label>
          <Chips label="Common medicines" hue="green" value={name} onChange={setName} options={MED_PRESETS} />
          <div className="mt-2"><Text label="Medicine name" value={name} max={80} placeholder="Or write the name on the strip" onChange={setName} /></div>
        </div>
        <div><Label>Dose</Label><Chips label="Dose" hue="green" value={dose} onChange={setDose} options={DOSE_PRESETS} /></div>
        <div><Label>When you take it</Label><Chips label="When" hue="green" value={schedule} onChange={setSchedule} options={SCHEDULES} /></div>
        <div><Label>What it is for (optional)</Label><Text label="What it is for" value={reason} max={80} placeholder="Thyroid" onChange={setReason} /></div>
      </div>
    </Sheet>
  );
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

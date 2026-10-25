"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import {
  Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel, useEntries,
} from "@/components/ux/health/kit";
import { Checklist, ConsultCard, useChecks } from "@/components/ux/health/checklist";
import {
  ANC_VISITS, APPT_TITLES, BABY, BAG, CARE_CHECKS, DANGER_SIGNS, MILESTONES, PREG_QUESTIONS, PREG_SYMPTOMS, SEVERITY,
  TRIMESTER_TIPS, babyFor, nextPmsma, pregInfo, type PregInfo,
} from "@/components/ux/health/pregnancy-data";
import { addDays, daysBetween, fmtDay, today, type Entry, type Pregnancy } from "@/lib/health-api";

/**
 * Pregnancy — week by week, with support at every step.
 *
 * Her dates live in her health settings (`settings.pregnancy`: the first day
 * of her last period, or the due date her doctor gave). Symptoms, kick counts,
 * contraction timings and antenatal appointments are entries in the Health
 * store (`pregsym`, `kick`, `contraction`, `reminder` with category
 * "Pregnancy visit"), so appointments also show in Appointments & Reminders.
 *
 * Weeks and the due date are estimates and say so; danger signs are shown on
 * every tab that could be read as advice, with 108 to call.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "baby", label: "Baby Growth" },
  { id: "symptoms", label: "Symptoms" },
  { id: "care", label: "Care Plan" },
  { id: "tools", label: "Tools" },
  { id: "consultation", label: "Consultation" },
];

const TRI = ["", "First", "Second", "Third"];
const VISIT = "Pregnancy visit";

export default function PregnancyPage() {
  const ck = useChecks();
  const { settings, ready, save } = ck;
  const info = pregInfo(settings.pregnancy);
  const entries = useEntries(["pregsym", "kick", "contraction", "reminder"]);
  const [editing, setEditing] = useState(false);

  const sub = info
    ? `Week ${info.week}${info.day ? ` + ${info.day} day${info.day > 1 ? "s" : ""}` : ""} · ${TRI[info.trimester]} trimester · ${info.overdue ? "due date has passed" : `${info.daysLeft} days to go`}`
    : "Your journey, week by week, with support at every step.";

  return (
    <HealthFrame active="/app/health/pregnancy" hue="lilac" icon="Baby" eyebrow="Pregnancy" title="Pregnancy" sub={sub}
                 art="/ux/art/scene-mother-baby-laptop.webp" tabs={info ? TABS : []}
                 actions={info ? (
                   <>
                     <Btn icon="Plus" href="/app/health/pregnancy?tab=care#appointment">Add appointment</Btn>
                     <Btn variant="outline" icon="Footprints" href="/app/health/pregnancy?tab=tools">Kick counter</Btn>
                   </>
                 ) : null}>
      {(tab) => !ready ? <Loading /> : !info || editing ? (
        <SetupPanel current={settings.pregnancy} editing={editing}
                    onSave={async (p) => { const ok = await save({ pregnancy: p }, "Pregnancy tracking is on"); if (ok) setEditing(false); }}
                    onCancel={editing ? () => setEditing(false) : undefined} />
      ) : (
        <>
          {tab === "overview" && (
            <Overview info={info} preg={settings.pregnancy!} reminders={entries.rows.filter(isVisit)}
                      onEdit={() => setEditing(true)} onEnd={() => save({ pregnancy: null }, "Pregnancy tracking has ended")} />
          )}
          {tab === "baby" && <BabyGrowth info={info} />}
          {tab === "symptoms" && <Symptoms entries={entries} />}
          {tab === "care" && <CarePlan info={info} ck={ck} entries={entries} hospital={settings.pregnancy?.hospital ?? ""} />}
          {tab === "tools" && <Tools info={info} ck={ck} entries={entries} />}
          {tab === "consultation" && <Consultation ck={ck} preg={settings.pregnancy!} save={save} />}
        </>
      )}
    </HealthFrame>
  );
}

type Entries = ReturnType<typeof useEntries<"pregsym" | "kick" | "contraction" | "reminder">>;
type Checks = ReturnType<typeof useChecks>;

const isVisit = (e: Entry) => e.kind === "reminder" && (e.data as { category?: string }).category === VISIT;

function Loading() {
  return <div className="h-[300px] animate-pulse rounded-[20px]" style={{ background: "var(--ux-surface-2)" }} />;
}

/* ── setup ─────────────────────────────────────────────────────────────── */

const inputCls = "min-h-[46px] w-full rounded-[12px] border-[1.5px] px-3 text-[15px]";
const inputStyle: React.CSSProperties = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };

function SetupPanel({ current, editing, onSave, onCancel }: {
  current: Pregnancy | null; editing: boolean; onSave: (p: Pregnancy) => Promise<void>; onCancel?: () => void;
}) {
  const [basis, setBasis] = useState<"lmp" | "due">(current?.basis ?? "lmp");
  const [date, setDate] = useState(current?.date ?? "");
  const [busy, setBusy] = useState(false);
  const t = today();
  const min = basis === "lmp" ? addDays(t, -300) : t;
  const max = basis === "lmp" ? t : addDays(t, 300);
  const presets = basis === "lmp"
    ? [[6, "About 6 weeks ago"], [10, "About 10 weeks ago"], [16, "About 16 weeks ago"], [24, "About 24 weeks ago"]] as const
    : [[8, "In 2 months"], [16, "In 4 months"], [24, "In 6 months"]] as const;
  const preview = date && date >= min && date <= max ? pregInfo({ basis, date }) : null;
  return (
    <Cols
      main={
        <Panel title={editing ? "Change your dates" : "Start pregnancy tracking"}
               sub="Add the first day of your last period, or the due date your doctor gave you. You can change it any time.">
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>I know my</p>
            <Chips label="What do you know" hue="lilac" value={basis}
                   options={[{ value: "lmp", label: "First day of my last period" }, { value: "due", label: "Due date from my doctor" }]}
                   onChange={(v) => { setBasis(v as "lmp" | "due"); setDate(""); }} />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>{basis === "lmp" ? "When did your last period start?" : "Your due date"}</p>
            <div className="mb-2.5 flex flex-wrap gap-2">
              {presets.map(([w, label]) => {
                const d = basis === "lmp" ? addDays(t, -w * 7) : addDays(t, w * 7);
                return (
                  <button key={label} type="button" aria-pressed={date === d} onClick={() => setDate(d)}
                          className="ux-press min-h-[38px] rounded-full border-[1.5px] px-3 text-[13px] font-bold"
                          style={date === d ? { borderColor: HUE.lilac.ink, background: HUE.lilac.tint, color: "var(--ux-ink)" }
                                            : { borderColor: "var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{label}</button>
                );
              })}
            </div>
            <input type="date" aria-label="Date" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)}
                   className={`${inputCls} max-w-[260px]`} style={inputStyle} />
          </div>
          {preview && (
            <p className="rounded-[12px] p-3 text-sm" style={{ background: HUE.lilac.tint, color: "var(--ux-ink)" }} data-preg-preview>
              That makes you about <b>week {preview.week}</b> — estimated due date <b>{fmtDay(preview.due, { day: "numeric", month: "long", year: "numeric" })}</b>.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn icon="Check" disabled={!preview} loading={busy}
                 onClick={async () => { setBusy(true); await onSave({ ...(current ?? {}), basis, date }); setBusy(false); }}>
              {editing ? "Save dates" : "Start tracking"}
            </Btn>
            {onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}
          </div>
        </Panel>
      }
      side={
        <>
          <Panel hue="lilac" tint>
            <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>What you get</h2>
            <ul className="flex flex-col gap-2 text-sm" style={{ color: "var(--ux-ink-2)" }}>
              {["Your week and baby's growth", "A check-up plan and reminders", "Kick counter and contraction timer", "A hospital bag checklist"].map((x) => (
                <li key={x} className="flex items-start gap-2"><I name="Check" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HUE.lilac.ink }} />{x}</li>
              ))}
            </ul>
          </Panel>
          <Disclaimer>Weeks and the due date are <b>estimates</b> from the date you enter. Confirm them with your doctor or ANM.</Disclaimer>
        </>
      }
    />
  );
}

/* ── overview ─────────────────────────────────────────────────────────── */

function Timeline({ info }: { info: PregInfo }) {
  const pct = Math.min(100, (info.ga / 280) * 100);
  return (
    <div className="relative mx-1 mt-2 h-[64px]" aria-label={`Pregnancy timeline, week ${info.week} of 40`} data-preg-timeline>
      <div className="absolute inset-x-0 top-[12px] h-[10px] overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
        <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${HUE.lilac.ink}, var(--ux-brand))` }} />
      </div>
      {MILESTONES.map(([w, l]) => (
        <span key={w} className="absolute top-[6px] flex flex-col items-center gap-1 text-[11px] font-bold"
              style={{ left: `${(w / 40) * 100}%`, transform: w === 40 ? "translateX(-100%)" : "translateX(-50%)", color: "var(--ux-muted)", alignItems: w === 40 ? "flex-end" : "center" }}>
          <span className="block h-[22px] w-[3px] rounded-full" style={{ background: "var(--ux-line-strong)" }} />
          {/* "Full term" sits three weeks from the due date: its tick stays, its
              label would collide. On a phone only the trimester marks are named. */}
          {w !== 37 && <span className={`whitespace-nowrap ${w === 20 || w === 40 ? "max-sm:hidden" : ""}`}>{l}</span>}
        </span>
      ))}
      <span className="absolute top-[4px] h-[26px] w-[26px] -translate-x-1/2 rounded-full"
            style={{ left: `${pct}%`, background: "var(--ux-surface)", border: `4px solid ${HUE.lilac.ink}`, boxShadow: "var(--ux-shadow-sm)" }} title="You are here" />
    </div>
  );
}

function DangerCard() {
  return (
    <section className="ux-card flex flex-col gap-3 p-4 sm:p-5" style={{ background: "var(--ux-danger-tint)" }} data-danger-signs>
      <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: "var(--ux-danger-ink)" }}>
        <I name="AlertTriangle" /> Get help straight away
      </h2>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2" style={{ color: "var(--ux-ink)" }}>
        {DANGER_SIGNS.map((d) => <li key={d} className="flex items-start gap-2"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ux-danger-ink)" }} />{d}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <a href="tel:108" className="ux-press inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-4 text-sm font-bold"
           style={{ background: "var(--ux-danger-solid)", color: "var(--ux-on-danger)" }}><I name="Phone" className="h-4 w-4" /> Call 108 — ambulance</a>
        <a href="tel:102" className="ux-press inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border-[1.5px] px-4 text-sm font-bold"
           style={{ borderColor: "var(--ux-danger-ink)", color: "var(--ux-danger-ink)" }}>102 — free pregnancy transport</a>
      </div>
    </section>
  );
}

function nextVisit(rows: Entry[]) {
  const t = today();
  return rows.filter((r) => isVisit(r) && r.date >= t && !((r.data as { done?: string[] }).done ?? []).includes(r.date))
    .sort((a, b) => (a.date + ((a.data as { time?: string }).time ?? "")).localeCompare(b.date + ((b.data as { time?: string }).time ?? "")))[0];
}

function Overview({ info, preg, reminders, onEdit, onEnd }: {
  info: PregInfo; preg: Pregnancy; reminders: Entry[]; onEdit: () => void; onEnd: () => void;
}) {
  const b = babyFor(info.week);
  const up = nextVisit(reminders);
  const [ending, setEnding] = useState(false);
  return (
    <Cols
      main={
        <>
          <Panel>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-2xs font-extrabold uppercase tracking-[0.12em]" style={{ color: HUE.lilac.ink }}>Estimated progress</p>
                <p className="text-[48px] font-extrabold leading-none tabular-nums" style={{ color: HUE.lilac.ink }} data-preg-week>
                  Week {info.week}{info.day ? <span className="text-[22px]"> + {info.day}d</span> : null}
                </p>
                <p className="mt-1.5 text-sm" style={{ color: "var(--ux-muted)" }}>
                  {TRI[info.trimester]} trimester · {info.overdue ? "Due date has passed" : `${info.daysLeft} days to go`}
                </p>
              </div>
            </div>
            <MetricGrid>
              <Metric hue="lilac" icon="CalendarHeart" label="Estimated due date" value={fmtDay(info.due, { day: "numeric", month: "short", year: "numeric" })} />
              <Metric hue="pink" icon="Baby" label="Baby's size" value={b[1].replace(/^an? /, "").replace(/^./, (c) => c.toUpperCase())} sub="Approximate comparison" />
              <Metric hue="amber" icon="Hourglass" label="Weeks to go" value={Math.max(0, 40 - info.week)} />
            </MetricGrid>
            <Timeline info={info} />
            <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>{b[2]}</p>
            {info.overdue && <Disclaimer><b>Your estimated due date has passed.</b> Please see your doctor, and update your dates or end tracking below.</Disclaimer>}
            <Disclaimer><b>Weeks and due date are estimates</b> based on the date you entered. Confirm your due date and care plan with your doctor or ANM.</Disclaimer>
          </Panel>
          <Panel title={`This trimester`} sub={`${TRI[info.trimester]} trimester tips`}>
            <ul className="flex flex-col gap-2">
              {TRIMESTER_TIPS[info.trimester].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ux-ink)" }}>
                  <I name="Sparkles" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HUE.lilac.ink }} />{t}
                </li>
              ))}
            </ul>
          </Panel>
          <DangerCard />
        </>
      }
      side={
        <>
          <Panel title="Next appointment">
            {up ? (
              <>
                <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
                  <b>{(up.data as { title: string }).title}</b><br />
                  <span style={{ color: "var(--ux-muted)" }}>
                    {fmtDay(up.date, { weekday: "short", day: "numeric", month: "short" })}{(up.data as { time?: string }).time ? ` at ${(up.data as { time?: string }).time}` : ""}
                    {(up.data as { where?: string }).where ? ` · ${(up.data as { where?: string }).where}` : ""}
                  </span>
                </p>
                <Btn size="sm" variant="outline" href="/app/health/pregnancy?tab=care">All appointments</Btn>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No upcoming appointments.</p>
                <Btn size="sm" icon="Plus" href="/app/health/pregnancy?tab=care#appointment">Add one</Btn>
              </>
            )}
          </Panel>
          <Panel title="Tools">
            <div className="grid grid-cols-2 gap-2.5">
              {([["Footprints", "Kick counter", "/app/health/pregnancy?tab=tools"], ["Timer", "Contraction timer", "/app/health/pregnancy?tab=tools"],
                 ["ListChecks", "Checklist", "/app/health/pregnancy?tab=care"], ["Briefcase", "Hospital bag", "/app/health/pregnancy?tab=tools#bag"],
                 ["Scale", "Weight tracker", "/app/health/records?tab=records"], ["Stethoscope", "Gynaecologist", "/app/health/doctors?speciality=Gynaecologist"]] as const).map(([ic, l, href]) => (
                <Link key={l} href={href} className="ux-card ux-press ux-hov flex min-h-[86px] flex-col items-center justify-center gap-2 p-2 text-center text-[13px] font-bold"
                      style={{ color: "var(--ux-ink)" }}>
                  <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: HUE.lilac.tint, color: HUE.lilac.ink }}><I name={ic} className="h-[18px] w-[18px]" /></span>
                  {l}
                </Link>
              ))}
            </div>
          </Panel>
          <Panel title="Your details">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt style={{ color: "var(--ux-muted)" }}>{preg.basis === "lmp" ? "Last period" : "Due date given"}</dt>
              <dd style={{ color: "var(--ux-ink)" }}><b>{fmtDay(preg.date, { day: "numeric", month: "short", year: "numeric" })}</b></dd>
              {preg.hospital && (<><dt style={{ color: "var(--ux-muted)" }}>Hospital</dt><dd style={{ color: "var(--ux-ink)" }}>{preg.hospital}</dd></>)}
              {preg.doctor && (<><dt style={{ color: "var(--ux-muted)" }}>Doctor</dt><dd style={{ color: "var(--ux-ink)" }}>{preg.doctor}</dd></>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" variant="outline" icon="Pencil" onClick={onEdit}>Change dates</Btn>
              {!ending && <Btn size="sm" variant="ghost" onClick={() => setEnding(true)}>End pregnancy tracking</Btn>}
            </div>
            {ending && (
              <div className="rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }} data-end-confirm>
                <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
                  End pregnancy tracking? Whatever the reason, we are here for you. Your symptom notes and appointments stay in your records.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Btn size="sm" onClick={onEnd}>Yes, end tracking</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEnding(false)}>Keep tracking</Btn>
                </div>
                <Link href="/app/health/mind" className="mt-2 inline-block text-xs font-bold" style={{ color: "var(--ux-brand)" }}>Talk to someone · Mental Wellness →</Link>
              </div>
            )}
          </Panel>
        </>
      }
    />
  );
}

/* ── baby growth ──────────────────────────────────────────────────────── */

function BabyGrowth({ info }: { info: PregInfo }) {
  const cur = babyFor(info.week);
  return (
    <Panel title="Baby's journey, week by week" sub="General information with approximate size comparisons. Every pregnancy is different.">
      <ol className="flex flex-col gap-1.5" data-baby-weeks>
        {BABY.map((b) => {
          const on = b[0] === cur[0];
          return (
            <li key={b[0]} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-[14px] p-3"
                style={on ? { background: HUE.lilac.tint, outline: `1.5px solid ${HUE.lilac.ink}` } : undefined} aria-current={on ? "step" : undefined}>
              <span className="text-[22px] font-extrabold tabular-nums" style={{ color: HUE.lilac.ink }}>
                {b[0]}<small className="ms-0.5 text-[11px] font-bold" style={{ color: "var(--ux-muted)" }}>wk</small>
              </span>
              <span>
                <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>About the size of {b[1]}</b>
                <span className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{b[2]}</span>
                {on && <span className="mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold" style={{ background: "var(--ux-surface)", color: HUE.lilac.ink }}>You are around here</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ── symptoms ─────────────────────────────────────────────────────────── */

function Symptoms({ entries }: { entries: Entries }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string>("Mild");
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = entries.rows.filter((r) => r.kind === "pregsym") as Entry<"pregsym">[];
  const log = async () => {
    setBusy(true);
    const ok = await entries.add("pregsym", { symptoms: picked, severity, note: note.trim() }, when === "today" ? today() : addDays(today(), -1), "Saved to your symptom journal");
    setBusy(false);
    if (ok) { setPicked([]); setNote(""); setSeverity("Mild"); }
  };
  return (
    <Cols
      main={
        <>
          <DangerCard />
          <Panel title="Symptom journal" sub="What you felt, by day">
            {rows.length ? (
              <ul className="flex flex-col" data-pregsym-list>
                {rows.slice(0, 30).map((r, i) => (
                  <li key={r.id} className={`grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 py-3 ${i ? "border-t" : ""}`} style={{ borderColor: "var(--ux-line)" }}>
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.date, { day: "numeric", month: "short" })}</span>
                    <span className="min-w-0">
                      <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{r.data.symptoms.join(", ")}</b>
                      <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{[r.data.severity, r.data.note].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" aria-label="Delete this entry" onClick={() => entries.remove(r.id)}
                            className="ux-press grid h-9 w-9 place-items-center rounded-[10px]" style={{ color: "var(--ux-muted)" }}>
                      <I name="Trash2" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Empty icon="NotebookPen" title="Nothing logged yet" body="Tap how you feel on the right. It helps you remember what to tell your doctor." />}
          </Panel>
        </>
      }
      side={
        <Panel title="How are you feeling?" sub="Tap all that apply">
          <Chips label="Symptoms" hue="lilac" options={PREG_SYMPTOMS} value={picked}
                 onChange={(v) => setPicked((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>How strong?</p>
            <Chips label="Severity" hue="lilac" options={SEVERITY} value={severity} onChange={setSeverity} />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>When?</p>
            <Chips label="When" hue="lilac" options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }]} value={when} onChange={(v) => setWhen(v as "today" | "yesterday")} />
          </div>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="A note (optional)" aria-label="Note"
                 className={inputCls} style={inputStyle} />
          <Btn icon="Check" disabled={!picked.length} loading={busy} onClick={log}>Save</Btn>
          {picked.includes("Cramps") && severity === "Strong" && (
            <Disclaimer>Strong cramps in pregnancy can need care. If they don&rsquo;t ease, or come with bleeding, call your doctor or 108.</Disclaimer>
          )}
        </Panel>
      }
    />
  );
}

/* ── care plan ────────────────────────────────────────────────────────── */

function CarePlan({ info, ck, entries, hospital }: { info: PregInfo; ck: Checks; entries: Entries; hospital: string }) {
  const visits = entries.rows.filter(isVisit) as Entry<"reminder">[];
  const t = today();
  const upcoming = visits.filter((v) => v.date >= t && !(v.data.done ?? []).includes(v.date)).sort((a, b) => a.date.localeCompare(b.date));
  const past = visits.filter((v) => !upcoming.includes(v)).sort((a, b) => b.date.localeCompare(a.date));
  useEffect(() => {
    if (window.location.hash === "#appointment") document.getElementById("appointment")?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <Cols
      main={
        <>
          <Panel title="Your antenatal check-ups" sub="At least four check-ups — tick each one you have had">
            <ol className="flex flex-col gap-2.5" data-anc>
              {ANC_VISITS.map((v) => {
                const now = info.week >= v.from && info.week <= v.to;
                const done = (ck.checks.anc ?? []).includes(v.id);
                return (
                  <li key={v.id} className="rounded-[14px] border p-3.5" style={{ borderColor: now ? HUE.lilac.ink : "var(--ux-line)", background: now ? HUE.lilac.tint : undefined }}>
                    <div className="flex items-start gap-3">
                      <button type="button" role="checkbox" aria-checked={done} aria-label={`${v.title} done`} onClick={() => ck.toggle("anc", v.id)}
                              className="ux-press mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2"
                              style={done ? { background: "var(--ux-green-ink)", borderColor: "var(--ux-green-ink)", color: "var(--ux-surface)" } : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
                        {done && <I name="Check" className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{v.title}</b>
                          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>{v.when}</span>
                          {now && <span className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: "var(--ux-surface)", color: HUE.lilac.ink }}>Now</span>}
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                          {v.items.map((x) => <li key={x}>· {x}</li>)}
                        </ul>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
              Free check-up on the 9th of every month at government health centres (PMSMA). Your doctor may advise more visits.
            </p>
          </Panel>
          <Panel title="Pregnancy checklist" sub="By trimester">
            {([1, 2, 3] as const).map((tr) => (
              <div key={tr}>
                <p className="mb-1 flex items-center gap-2 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>
                  {TRI[tr]} trimester {tr === info.trimester && <span className="rounded-full px-2 py-0.5 normal-case tracking-normal" style={{ background: HUE.lilac.tint, color: HUE.lilac.ink }}>Now</span>}
                </p>
                <Checklist label={`preg-care-${tr}`} hue="lilac" items={CARE_CHECKS[tr]} done={ck.checks["preg-care"] ?? []} onToggle={(id) => ck.toggle("preg-care", id)} />
              </div>
            ))}
          </Panel>
        </>
      }
      side={
        <>
          <AppointmentForm entries={entries} hospital={hospital} />
          <Panel title="Appointments">
            {upcoming.length + past.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your check-ups will show here, and in Appointments &amp; Reminders.</p>
            ) : (
              <ul className="flex flex-col" data-appts>
                {[...upcoming, ...past.slice(0, 6)].map((v, i) => {
                  const done = (v.data.done ?? []).includes(v.date);
                  const soon = !done && v.date >= t;
                  return (
                    <li key={v.id} className={`flex items-center gap-3 py-2.5 ${i ? "border-t" : ""}`} style={{ borderColor: "var(--ux-line)" }}>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm" style={{ color: done ? "var(--ux-muted)" : "var(--ux-ink)" }}>{v.data.title}</b>
                        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                          {fmtDay(v.date, { weekday: "short", day: "numeric", month: "short" })}{v.data.time ? ` · ${v.data.time}` : ""}
                          {soon && daysBetween(v.date, t) <= 1 ? (daysBetween(v.date, t) === 0 ? " · Today" : " · Tomorrow") : ""}
                          {done ? " · Done" : !soon ? " · Missed?" : ""}
                        </span>
                      </span>
                      {!done && (
                        <button type="button" onClick={() => entries.edit(v.id, { data: { done: [...(v.data.done ?? []), v.date] } }, "Marked as done")}
                                className="ux-press min-h-[34px] rounded-[10px] px-2.5 text-xs font-bold" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Done</button>
                      )}
                      <button type="button" aria-label="Delete appointment" onClick={() => entries.remove(v.id, "Appointment removed")}
                              className="ux-press grid h-9 w-9 place-items-center rounded-[10px]" style={{ color: "var(--ux-muted)" }}>
                        <I name="Trash2" className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      }
    />
  );
}

function AppointmentForm({ entries, hospital }: { entries: Entries; hospital: string }) {
  const t = today();
  const dayOpts = useMemo(() => [
    { value: addDays(t, 1), label: "Tomorrow" },
    { value: addDays(t, 7), label: "Next week" },
    { value: nextPmsma(), label: `PMSMA day (${fmtDay(nextPmsma())})` },
    { value: "pick", label: "Pick a day" },
  ], [t]);
  const [title, setTitle] = useState(APPT_TITLES[0]);
  const [day, setDay] = useState(dayOpts[0].value);
  const [picked, setPicked] = useState(addDays(t, 3));
  const [time, setTime] = useState("10:00");
  const [where, setWhere] = useState(hospital);
  const [busy, setBusy] = useState(false);
  const date = day === "pick" ? picked : day;
  const add = async () => {
    setBusy(true);
    await entries.add("reminder", { title, category: VISIT, time, repeat: "Once", where: where.trim() }, date, "Appointment added — we'll remind you");
    setBusy(false);
  };
  return (
    <Panel id="appointment" title="Add an appointment" sub="We'll remind you the day before">
      <Chips label="What" hue="lilac" options={APPT_TITLES} value={title} onChange={setTitle} />
      <div>
        <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>When?</p>
        <Chips label="Day" hue="lilac" options={dayOpts} value={day} onChange={setDay} />
        {day === "pick" && (
          <input type="date" aria-label="Appointment date" value={picked} min={t} onChange={(e) => setPicked(e.target.value)}
                 className={`${inputCls} mt-2.5`} style={inputStyle} />
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Time</p>
        <Chips label="Time" hue="lilac" options={["09:00", "10:00", "11:30", "14:00", "16:00"]} value={time} onChange={setTime} />
      </div>
      <input value={where} maxLength={80} onChange={(e) => setWhere(e.target.value)} placeholder="Hospital or health centre (optional)"
             aria-label="Where" className={inputCls} style={inputStyle} />
      <Btn icon="Plus" loading={busy} disabled={!date} onClick={add}>Add appointment</Btn>
    </Panel>
  );
}

/* ── tools ─────────────────────────────────────────────────────────────── */

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The time now, refreshed every second while `on` — read in render, set outside it. */
function useTicker(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [on]);
  return now;
}

function KickCounter({ info, entries }: { info: PregInfo; entries: Entries }) {
  const [run, setRun] = useState<{ start: number; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useTicker(!!run);
  const secs = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0;
  const recent = entries.rows.filter((r) => r.kind === "kick").slice(0, 5) as Entry<"kick">[];
  const finish = async () => {
    if (!run) return;
    setBusy(true);
    const took = Math.round((Date.now() - run.start) / 1000);
    await entries.add("kick", { count: run.count, seconds: took }, today(), `Saved: ${run.count} kick${run.count === 1 ? "" : "s"} in ${clock(took)}`);
    setBusy(false);
    setRun(null);
  };
  return (
    <Panel title="Kick counter" sub={info.week < 28 ? "Many doctors suggest counting from about 28 weeks. Ask yours what's right for you." : "Count baby's movements at the same time each day."}>
      {run ? (
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => setRun({ ...run, count: run.count + 1 })} aria-label="Count a kick" data-kick-tap
                  className="ux-press grid h-[160px] w-[160px] place-items-center rounded-full text-center font-extrabold"
                  style={{ background: `radial-gradient(circle at 35% 30%, ${HUE.lilac.tint}, ${HUE.lilac.ink})`, color: "var(--ux-on-brand)", boxShadow: "var(--ux-shadow-card)" }}>
            <span><b className="block text-[44px] leading-none tabular-nums" data-kick-count>{run.count}</b><span className="text-sm">Tap for each kick</span></span>
          </button>
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Time: <b className="tabular-nums" style={{ color: "var(--ux-ink)" }}>{clock(secs)}</b></p>
          {run.count >= 10 && <p className="text-sm font-bold" style={{ color: "var(--ux-green-ink)" }}>10 movements — well done. You can save now.</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Btn icon="Check" loading={busy} onClick={finish}>Finish and save</Btn>
            <Btn variant="ghost" onClick={() => setRun(null)}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <Btn icon="Play" onClick={() => setRun({ start: Date.now(), count: 0 })}>Start counting</Btn>
      )}
      <Disclaimer>If you feel <b>fewer movements than usual</b>, or fewer than 10 in 2 hours, don&rsquo;t wait — call your doctor or go to hospital.</Disclaimer>
      {recent.length > 0 && (
        <ul className="flex flex-col" data-kick-list>
          {recent.map((r, i) => (
            <li key={r.id} className={`flex items-center justify-between py-2 text-sm ${i ? "border-t" : ""}`} style={{ borderColor: "var(--ux-line)" }}>
              <span style={{ color: "var(--ux-ink)" }}><b>{r.data.count} kick{r.data.count === 1 ? "" : "s"}</b> in {clock(r.data.seconds)}</span>
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ContractionTimer({ entries }: { entries: Entries }) {
  const [list, setList] = useState<{ start: number; end?: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const open = list.length > 0 && !list[list.length - 1].end;
  const now = useTicker(list.length > 0);
  const done = list.filter((c) => c.end);
  const lengths = done.map((c) => Math.round((c.end! - c.start) / 1000));
  const gaps = list.slice(1).map((c, i) => Math.round((c.start - list[i].start) / 1000));
  const last3 = (a: number[]) => (a.length ? Math.round(a.slice(-3).reduce((x, y) => x + y, 0) / Math.min(3, a.length)) : 0);
  const tap = () => {
    const now = Date.now();
    setList((l) => (open ? l.map((c, i) => (i === l.length - 1 ? { ...c, end: now } : c)) : [...l, { start: now }]));
  };
  const save = async () => {
    setBusy(true);
    await entries.add("contraction", { lengths, gaps }, today(), "Contraction timings saved");
    setBusy(false);
    setList([]);
  };
  const alert = gaps.length >= 3 && last3(gaps) <= 5 * 60 && last3(lengths) >= 60;
  return (
    <Panel title="Contraction timer" sub="Tap when a contraction starts, and again when it ends.">
      <button type="button" onClick={tap} data-contraction-tap
              className="ux-press min-h-[56px] rounded-[14px] text-base font-extrabold"
              style={{ background: open ? "var(--ux-danger-solid)" : HUE.lilac.ink, color: open ? "var(--ux-on-danger)" : "var(--ux-on-brand)" }}>
        {open ? `Contraction ended · ${clock(Math.max(0, Math.round((now - list[list.length - 1].start) / 1000)))}` : "Contraction started"}
      </button>
      {done.length > 0 && (
        <MetricGrid>
          <Metric hue="lilac" icon="Timer" label="Average length (last 3)" value={clock(last3(lengths))} />
          <Metric hue="amber" icon="Repeat" label="How often (last 3)" value={gaps.length ? `every ${clock(last3(gaps))}` : "—"} />
          <Metric hue="pink" icon="Hash" label="Contractions" value={done.length} />
        </MetricGrid>
      )}
      {alert && <Disclaimer><b>Contractions about 5 minutes apart, lasting a minute</b> — this may be labour. Call your hospital or 102/108 and go in.</Disclaimer>}
      {done.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" icon="Check" loading={busy} disabled={open} onClick={save}>Save timings</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setList([])}>Clear</Btn>
        </div>
      )}
    </Panel>
  );
}

function Tools({ info, ck, entries }: { info: PregInfo; ck: Checks; entries: Entries }) {
  const bag = BAG.map((text, i) => ({ id: `bag-${i}`, text }));
  useEffect(() => {
    if (window.location.hash === "#bag") document.getElementById("bag")?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <Cols
      main={
        <>
          <KickCounter info={info} entries={entries} />
          <ContractionTimer entries={entries} />
        </>
      }
      side={
        <Panel id="bag" title="Hospital bag" sub={info.week >= 34 ? "Time to pack — aim to be ready by week 36" : "Pack by week 36"}>
          <Checklist label="bag" hue="lilac" items={bag} done={ck.checks.bag ?? []} onToggle={(id) => ck.toggle("bag", id)} />
        </Panel>
      }
    />
  );
}

/* ── consultation ─────────────────────────────────────────────────────── */

function Consultation({ ck, preg, save }: { ck: Checks; preg: Pregnancy; save: Checks["save"] }) {
  const [doctor, setDoctor] = useState(preg.doctor ?? "");
  const [hospital, setHospital] = useState(preg.hospital ?? "");
  const dirty = doctor !== (preg.doctor ?? "") || hospital !== (preg.hospital ?? "");
  return (
    <Cols
      main={
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ConsultCard icon="Stethoscope" hue="green" title="OB-GYN consultation" body="Book with a gynaecologist — online or in person."
                         href="/app/health/doctors?speciality=Gynaecologist" cta="Find a gynaecologist" />
            <ConsultCard icon="Users" hue="orange" title="Talk to a mother who's been there" body="Mentors share what helped them — not medical advice."
                         href="/app/health/mentors?topic=Pregnancy" cta="Find a mentor" />
          </div>
          <Panel title="Questions for your next check-up" sub="Tick the ones you want to ask">
            <Checklist label="preg-questions" hue="green" items={PREG_QUESTIONS} done={ck.checks["preg-questions"] ?? []} onToggle={(id) => ck.toggle("preg-questions", id)} />
          </Panel>
        </>
      }
      side={
        <>
          <Panel title="Your doctor and hospital" sub="Shown on your appointments">
            <input value={doctor} maxLength={80} onChange={(e) => setDoctor(e.target.value)} placeholder="Doctor or ANM name" aria-label="Doctor" className={inputCls} style={inputStyle} />
            <input value={hospital} maxLength={80} onChange={(e) => setHospital(e.target.value)} placeholder="Hospital or health centre" aria-label="Hospital" className={inputCls} style={inputStyle} />
            <Btn size="sm" icon="Check" disabled={!dirty} onClick={() => save({ pregnancy: { ...preg, doctor: doctor.trim(), hospital: hospital.trim() } }, "Saved")}>Save</Btn>
          </Panel>
          <Panel hue="amber" tint title="Free care you can claim">
            <ul className="flex flex-col gap-2 text-sm" style={{ color: "var(--ux-ink)" }}>
              <li><b>PMSMA</b> — a free check-up by a doctor on the 9th of every month at government health centres.</li>
              <li><b>Free delivery</b> at government hospitals, with free transport on 102 (JSSK).</li>
              <li><b>Cash support</b> for mothers under PMMVY and JSY, if you qualify.</li>
            </ul>
            <Btn size="sm" variant="outline" icon="Landmark" href="/app/haq">Check what you are owed</Btn>
          </Panel>
        </>
      }
    />
  );
}

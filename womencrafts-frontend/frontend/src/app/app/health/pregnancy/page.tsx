"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Btn } from "@/components/ux/kit";
import {
  Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel, useEntries,
} from "@/components/ux/health/kit";
import { artOf, illSrc } from "@/components/ux/health/art";
import { fmtTime } from "@/components/ux/health/QuickForms";
import { FormLauncher, PicChoice, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { Checklist, ConsultCard, useChecks } from "@/components/ux/health/checklist";
import {
  ANC_VISITS, APPT_TITLES, BAG, CARE_CHECKS, DANGER_SIGNS, PREG_QUESTIONS, PREG_SYMPTOMS, SEVERITY,
  TRIMESTER_TIPS, nextPmsma, pregInfo, type PregInfo,
} from "@/components/ux/health/pregnancy-data";
import { addDays, apiDeleteEntry, daysBetween, fmtDay, today, type Entry, type Pregnancy } from "@/lib/health-api";
import { WatchListen } from "@/components/ux/health/WatchListen";
import { toast } from "@/components/ux/mobile/Toast";
import { TrendChart } from "@/app/app/health/records/record-parts";
import { readingProblem } from "@/components/ux/health/records-data";
import { PREG_KINDS, type PregStore } from "@/components/ux/health/pregnancy/parts";
import { DetailsTab } from "@/components/ux/health/pregnancy/DetailsTab";
import { CheckupsTab, missedVisits, overdueVisit } from "@/components/ux/health/pregnancy/CheckupsTab";
import { TestsTab, testsToReview } from "@/components/ux/health/pregnancy/TestsTab";
import { RiskTab, reviewsDue, riskLevel } from "@/components/ux/health/pregnancy/RiskTab";
import { MedicinesTab } from "@/components/ux/health/pregnancy/MedicinesTab";
import { BirthTab } from "@/components/ux/health/pregnancy/BirthTab";
import { HistoryTab } from "@/components/ux/health/pregnancy/HistoryTab";
import { JourneyPanel, WhatsNext } from "@/components/ux/health/pregnancy/Journey";
import { BabyGrowth } from "@/components/ux/health/pregnancy/BabyGrowth";

/**
 * Pregnancy — week by week, with support at every step.
 *
 * Her dates live in her health settings (`settings.pregnancy`: the first day
 * of her last period, or the due date her doctor gave). Symptoms, kick counts,
 * contraction timings and antenatal appointments are entries in the Health
 * store (`pregsym`, `kick`, `contraction`, `reminder` with category
 * "Prenatal checkup", the Reminders type), so appointments also show in Appointments & Reminders.
 *
 * Weeks and the due date are estimates and say so; danger signs are shown on
 * every tab that could be read as advice, with 108 to call.
 *
 * Her own pregnancy record lives in components/ux/health/pregnancy/: the
 * pregnancy's details and dating (My details), antenatal visits (Check-ups),
 * tests and scans, what her doctor is watching (Risks), medicines and
 * vaccinations, the birth and after-birth care, and a timeline (History). All
 * of it is what she records from her own care; nothing is diagnosed. Each
 * record carries the pregnancy's id (`preg`), so a closed pregnancy keeps its
 * own history.
 */

/*
 * The tabs of the approved Health & Wellness design. Her pregnancy record sits
 * inside them: Care Plan holds her checklist, details, tests and scans, what
 * her doctor is watching, medicines, the birth and the timeline (as sections,
 * `?part=`); Consultation holds her appointments and the check-ups she had.
 */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "baby", label: "Baby Growth" },
  { id: "symptoms", label: "Symptoms" },
  { id: "care", label: "Care Plan" },
  { id: "tools", label: "Tools" },
  { id: "consultation", label: "Consultation" },
  { id: "watch", label: "Watch & listen" },
];

const PARTS = [
  { id: "checklist", label: "Checklist", icon: "ListChecks" },
  { id: "details", label: "My details", icon: "ClipboardList" },
  { id: "tests", label: "Tests & scans", icon: "FlaskConical" },
  { id: "risks", label: "Risks", icon: "ShieldAlert" },
  { id: "medicines", label: "Medicines", icon: "Pill" },
  { id: "birth", label: "Birth & after", icon: "HeartPulse" },
  { id: "history", label: "History", icon: "History" },
] as const;
type Part = (typeof PARTS)[number]["id"];
/** Where each part of her record lives: the tab and, in Care Plan, the section. */
const PREG_LINK = {
  checkups: "/app/health/pregnancy?tab=consultation",
  ...Object.fromEntries(PARTS.map((p) => [p.id, `/app/health/pregnancy?tab=care&part=${p.id}`])),
} as Record<"checkups" | Part, string>;

const TRI = ["", "First", "Second", "Third"];
const VISIT = "Prenatal checkup";
/** What appointments were saved as before they took the Reminders type's name. */
const OLD_VISIT = "Pregnancy visit";

export default function PregnancyPage() {
  const ck = useChecks();
  const { settings, ready, save } = ck;
  const info = pregInfo(settings.pregnancy);
  const entries = useEntries([...PREG_KINDS]);
  // The setup, appointment and symptom sheets: mounted only while open.
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState(false);
  // Ending tracking is one tap, so it can be put back for seven seconds. The
  // pregnancy is kept in History either way, with everything recorded for it.
  const endTracking = async () => {
    const before = settings.pregnancy;
    if (!before) return;
    const kept = await entries.add("pregepisode", { pregnancy: before, outcome: "Tracking ended", closed_on: today() }, today());
    if (!(await save({ pregnancy: null }))) return;
    toast("Pregnancy tracking has ended", {
      tone: "success", duration: 7000,
      action: { label: "Undo", onPress: () => {
        void save({ pregnancy: before }, "Pregnancy tracking is back on");
        if (kept) void apiDeleteEntry(kept.id).then(entries.reload).catch(() => undefined);
      } },
    });
  };

  const sub = info
    ? `Week ${info.week}${info.day ? ` + ${info.day} day${info.day > 1 ? "s" : ""}` : ""} · ${TRI[info.trimester]} trimester · ${info.overdue ? "due date has passed" : `${info.daysLeft} days to go`}`
    : "Your journey, week by week, with support at every step.";
  const setupFlow = editing && (
    <SetupFlow current={settings.pregnancy} editing={!!info} onClose={() => setEditing(false)}
               onSave={async (p) => !!(await save({ pregnancy: p }, "Pregnancy tracking is on"))} />
  );

  return (
    <HealthFrame active="/app/health/pregnancy" hue="lilac" icon="Baby" eyebrow="Pregnancy" title="Pregnancy" sub={sub}
                 art={illSrc("hero-pregnancy")} tabs={TABS}
                 actions={info ? (
                   <>
                     <Btn icon="Plus" onClick={() => setLogging(true)}>Log symptoms</Btn>
                     <Btn variant="outline" icon="Footprints" href="/app/health/pregnancy?tab=tools">Count kicks</Btn>
                     <Btn variant="on-brand" icon="CalendarPlus" onClick={() => setAdding(true)}>Add appointment</Btn>
                   </>
                 ) : <Btn icon="Baby" onClick={() => setEditing(true)}>Start tracking</Btn>}>
      {(tab) => !ready ? <Loading /> : !info ? (
        // Before she starts tracking, every tab is still there: Overview is the
        // start screen, Medicines and Watch & listen work as they are, and the
        // rest say what they will hold and offer to start.
        <>
          {setupFlow}
          {tab === "overview" ? <SetupPanel onStart={() => setEditing(true)} />
            : tab === "medicines" ? <MedicinesTab store={entries} />
            : tab === "watch" ? <WatchListen section="pregnancy" hue="lilac" sub="Prenatal yoga, care tips and what to expect, week by week." />
            : <StartFirst tab={tab} onStart={() => setEditing(true)} />}
        </>
      ) : (
        <>
          {setupFlow}
          {adding && <AppointmentFlow entries={entries} hospital={settings.pregnancy?.hospital ?? ""} onClose={() => setAdding(false)} />}
          {logging && <SymptomFlow entries={entries} onClose={() => setLogging(false)} />}
          {tab === "overview" && (
            <Overview info={info} preg={settings.pregnancy!} store={entries} reminders={entries.rows.filter(isVisit)} onAdd={() => setAdding(true)}
                      onLog={() => setLogging(true)} onEdit={() => setEditing(true)} onEnd={endTracking} />
          )}
          {tab === "baby" && <BabyGrowth info={info} />}
          {tab === "symptoms" && <Symptoms entries={entries} onLog={() => setLogging(true)} />}
          {tab === "care" && (
            <CarePlanTab render={(part) => (
              part === "details" ? <DetailsTab preg={settings.pregnancy!} settings={settings} save={save} />
              : part === "tests" ? <TestsTab preg={settings.pregnancy!} store={entries} />
              : part === "risks" ? <RiskTab preg={settings.pregnancy!} store={entries} />
              : part === "medicines" ? <MedicinesTab store={entries} />
              : part === "birth" ? <BirthTab preg={settings.pregnancy!} store={entries} settings={settings} save={save}
                                             onClosed={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
              : part === "history" ? <HistoryTab preg={settings.pregnancy!} store={entries} settings={settings} />
              : <CarePlan info={info} ck={ck} entries={entries} onAdd={() => setAdding(true)} />
            )} />
          )}
          {tab === "tools" && <Tools info={info} ck={ck} entries={entries} />}
          {tab === "consultation" && (
            <>
              <CheckupsTab preg={settings.pregnancy!} store={entries} onAdd={() => setAdding(true)} />
              <Consultation ck={ck} preg={settings.pregnancy!} save={save} entries={entries} onAdd={() => setAdding(true)} />
            </>
          )}
          {tab === "watch" && <WatchListen section="pregnancy" hue="lilac" sub="Prenatal yoga, care tips and what to expect, week by week." />}
        </>
      )}
    </HealthFrame>
  );
}

type Entries = PregStore;
type Checks = ReturnType<typeof useChecks>;

const isVisit = (e: Entry) => e.kind === "reminder" && [VISIT, OLD_VISIT].includes((e.data as { category?: string }).category ?? "");

function Loading() {
  return <div className="h-[300px] animate-pulse rounded-[20px]" style={{ background: "var(--ux-surface-2)" }} />;
}

/* ── setup ─────────────────────────────────────────────────────────────── */

const inputCls = "min-h-[46px] w-full rounded-[12px] border-[1.5px] px-3 text-[15px]";
const inputStyle: React.CSSProperties = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };

const PICK_DELAY = 180;
const long = { day: "numeric", month: "long", year: "numeric" } as const;

/** A labelled text field for a step: the words above, the box below. */
function Field({ label, value, onChange, placeholder, max = 80 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; max?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink-2)" }}>
      {label}
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
             className={inputCls} style={inputStyle} />
    </label>
  );
}

/** Before tracking starts: what it gives her, and one card that opens the setup sheet. */
/**
 * Care Plan's sections, as a row of pills under the tab bar. The section is in
 * the address (`?part=`), so a link can open one and Back returns to it.
 */
function CarePlanTab({ render }: { render: (part: Part) => React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const want = params.get("part") ?? "";
  const part: Part = PARTS.some((p) => p.id === want) ? (want as Part) : "checklist";
  const go = (id: Part) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", "care");
    if (id === "checklist") q.delete("part"); else q.set("part", id);
    router.replace(`${path}?${q}`, { scroll: false });
  };
  return (
    <>
      <div role="tablist" aria-label="Care Plan sections" className="ux-scroll-x -mx-1 flex gap-2 px-1 pb-1" data-care-parts>
        {PARTS.map((p) => {
          const on = p.id === part;
          return (
            <button key={p.id} type="button" role="tab" aria-selected={on} onClick={() => go(p.id)}
                    className="ux-press inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold"
                    style={on ? { borderColor: HUE.lilac.ink, background: HUE.lilac.tint, color: HUE.lilac.ink }
                              : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              <I name={p.icon} className="h-4 w-4" />{p.label}
            </button>
          );
        })}
      </div>
      <div key={part} className="ux-swap flex flex-col gap-5">{render(part)}</div>
    </>
  );
}

/** What each tab holds, for the tabs that need a pregnancy before they can show anything. */
const TAB_INTRO: Record<string, { icon: string; title: string; body: string }> = {
  consultation: { icon: "Stethoscope", title: "Appointments and check-ups", body: "Book and keep your antenatal appointments, record what was measured at each check-up, and find a gynaecologist or a mentor." },
  details: { icon: "ClipboardList", title: "Your pregnancy details", body: "How your pregnancy was confirmed, your due date and any change a scan or your doctor makes, gravida and para, blood group, your doctor and your history." },
  care: { icon: "ListChecks", title: "Your care plan", body: "Your check-up schedule and checklist, your pregnancy details, tests and scans, what your doctor is watching, your medicines, the birth and your timeline." },
  tests: { icon: "FlaskConical", title: "Tests and scans", body: "Every test and scan from ordered to reviewed, with your results, the range on your report, the report itself and what your doctor said." },
  risks: { icon: "ShieldAlert", title: "What your doctor is watching", body: "Anything your doctor says needs extra care, the level they gave, referrals, the plan and when it is reviewed next." },
  baby: { icon: "Baby", title: "Baby's growth, week by week", body: "How big your baby is this week and what is developing, with the milestones ahead." },
  symptoms: { icon: "Activity", title: "Your symptoms", body: "Tap how you feel each day and see your last 30 days, to tell your doctor." },
  tools: { icon: "Footprints", title: "Kick counter and more", body: "A kick counter, a contraction timer, your weight through pregnancy and a hospital bag checklist." },
  birth: { icon: "HeartPulse", title: "The birth and after", body: "Labour and the birth, each baby, the checks for you and your baby afterwards, and a summary to print." },
  history: { icon: "History", title: "Your pregnancy timeline", body: "Everything in your pregnancy on one timeline, your papers, and earlier pregnancies you closed." },
};

function StartFirst({ tab, onStart }: { tab: string; onStart: () => void }) {
  const t = TAB_INTRO[tab] ?? TAB_INTRO.details;
  return (
    <Panel>
      <div className="flex flex-col items-start gap-3 py-2" data-start-first={tab}>
        <span className="grid h-12 w-12 place-items-center rounded-[14px]" style={{ background: HUE.lilac.tint, color: HUE.lilac.ink }}>
          <I name={t.icon} className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{t.title}</h2>
        <p className="max-w-[60ch] text-sm" style={{ color: "var(--ux-muted)" }}>{t.body}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--ux-ink-2)" }}>Start tracking your pregnancy to use this — it takes one date.</p>
        <Btn icon="Baby" onClick={onStart}>Start tracking</Btn>
      </div>
    </Panel>
  );
}

function SetupPanel({ onStart }: { onStart: () => void }) {
  return (
    <Cols
      main={
        <>
          <FormLauncher art="Pregnancy" title="Start your pregnancy journey" hue="lilac" steps={4} cta="Start"
                        sub="One date, and your doctor if you like · 4 quick steps" onStart={onStart} />
          <Panel title="How it works">
            <ol className="flex flex-col gap-3">
              {([["Calendar", "Tell us one date", "The first day of your last period, or the due date your doctor gave you."],
                 ["Pregnancy", "See your week", "Your week, trimester and estimated due date, with baby's growth."],
                 ["Prenatal checkup", "Get a care plan", "Check-ups, reminders, a kick counter and a hospital bag list."]] as const).map(([art, title, body], i) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums"
                        style={{ background: HUE.lilac.tint, color: HUE.lilac.ink }} aria-hidden>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{title}</b>
                    <span className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{body}</span>
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artOf(art)} alt="" className="h-9 w-9 shrink-0" />
                </li>
              ))}
            </ol>
          </Panel>
        </>
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

const BASIS = [
  { value: "lmp", label: "First day of my last period", sub: "The usual way to count" },
  { value: "due", label: "Due date from my doctor", sub: "From a scan or check-up" },
] as const;

/** "I know my…" → the date → doctor and hospital (optional) → check. Also changes the dates later. */
function SetupFlow({ current, editing, onSave, onClose }: {
  current: Pregnancy | null; editing: boolean; onSave: (p: Pregnancy) => Promise<boolean>; onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [basis, setBasis] = useState<"lmp" | "due">(current?.basis ?? "lmp");
  const [date, setDate] = useState(current?.date ?? "");
  const [doctor, setDoctor] = useState(current?.doctor ?? "");
  const [hospital, setHospital] = useState(current?.hospital ?? "");
  const [busy, setBusy] = useState(false);
  const t = today();
  const min = basis === "lmp" ? addDays(t, -300) : t;
  const max = basis === "lmp" ? t : addDays(t, 300);
  const presets = basis === "lmp"
    ? [[6, "About 6 weeks ago"], [10, "About 10 weeks ago"], [16, "About 16 weeks ago"], [24, "About 24 weeks ago"]] as const
    : [[8, "In 2 months"], [16, "In 4 months"], [24, "In 6 months"]] as const;
  const preview = date && date >= min && date <= max ? pregInfo({ basis, date }) : null;
  const problem = date && !preview
    ? basis === "lmp" ? "Pick a date from the last 300 days, not in the future." : "Pick a date from today up to 300 days ahead."
    : "";
  const save = async () => {
    if (!preview) return;
    setBusy(true);
    const p: Pregnancy = { ...(current ?? {}), basis, date };
    // Doctor and hospital are kept as they were unless she typed something here.
    if (doctor.trim() || current?.doctor != null) p.doctor = doctor.trim();
    if (hospital.trim() || current?.hospital != null) p.hospital = hospital.trim();
    const ok = await onSave(p);
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "basis", title: "I know my…", hint: "Either one works. You can change it any time.",
      body: <PicChoice label="What do you know" hue="lilac" options={BASIS} value={basis}
                       onChange={(v) => { if (v !== basis) { setBasis(v as "lmp" | "due"); setDate(""); } }}
                       onPicked={() => setStep(1)} /> },
    { id: "date", title: basis === "lmp" ? "When did your last period start?" : "What is your due date?",
      hint: "Tap a rough guess, or pick the exact date.", valid: !!preview,
      body: <>
        <Chips label={basis === "lmp" ? "When your last period started" : "Your due date"} hue="lilac" value={date} onChange={setDate}
               options={presets.map(([w, label]) => ({ value: basis === "lmp" ? addDays(t, -w * 7) : addDays(t, w * 7), label }))} />
        <label className="flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink-2)" }}>
          Or pick the exact date
          <input type="date" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)} aria-invalid={!!problem || undefined}
                 className={`${inputCls} max-w-[260px]`} style={{ ...inputStyle, borderColor: problem ? "var(--ux-danger-ink)" : inputStyle.borderColor }} />
        </label>
        {problem && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{problem}</p>}
        {preview && (
          <p className="rounded-[12px] p-3 text-sm" style={{ background: HUE.lilac.tint, color: "var(--ux-ink)" }} data-preg-preview>
            That makes you about <b>week {preview.week}</b> — estimated due date <b>{fmtDay(preview.due, long)}</b>.
          </p>
        )}
      </> },
    { id: "care", title: "Your doctor and hospital", hint: "Optional. They are shown on your appointments.",
      valid: !!(doctor.trim() || hospital.trim()), optional: true,
      body: <>
        <Field label="Doctor or ANM" value={doctor} onChange={setDoctor} placeholder="Doctor or ANM name" />
        <Field label="Hospital or health centre" value={hospital} onChange={setHospital} placeholder="Hospital or health centre" />
      </> },
    { id: "check", title: "Check, then save", valid: !!preview,
      body: <>
        <Review rows={[
          ["I know my", basis === "lmp" ? "First day of my last period" : "Due date from my doctor"],
          [basis === "lmp" ? "Last period" : "Due date given", date ? fmtDay(date, long) : ""],
          ["Your week", preview ? `About week ${preview.week}` : ""],
          ["Due date", preview ? `${fmtDay(preview.due, long)} (estimate)` : ""],
          ["Doctor", doctor.trim()],
          ["Hospital", hospital.trim()],
        ]} />
        <Disclaimer>Weeks and the due date are <b>estimates</b> from the date you enter. Confirm them with your doctor or ANM.</Disclaimer>
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Baby" title={editing ? "Change your dates" : "Start your pregnancy journey"} hue="lilac"
                    steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy}
                    submitLabel={editing ? "Save dates" : "Start tracking"} />;
}

/* ── overview ─────────────────────────────────────────────────────────── */

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

/**
 * What needs her attention across her pregnancy record, most urgent first:
 * a check-up that is overdue or was missed, results to show her doctor,
 * reviews her doctor asked for, and after the birth, the checks to come.
 * Each item goes straight to the tab that deals with it.
 */
function Attention({ preg, store }: { preg: Pregnancy; store: PregStore }) {
  const overdue = overdueVisit(store, preg);
  const missed = missedVisits(store);
  const tests = testsToReview(store, preg);
  const reviews = reviewsDue(store, preg);
  const level = riskLevel(store, preg);
  const items: { icon: string; text: React.ReactNode; href: string; cta: string; tone: "amber" | "danger" | "lilac" }[] = [];
  if (overdue) items.push({ icon: "AlarmClock", tone: "amber", href: PREG_LINK.checkups, cta: "Consultation",
                            text: <>Your next check-up was due <b>{fmtDay(overdue.due, { day: "numeric", month: "short" })}</b> — book it.</> });
  if (missed.length) items.push({ icon: "CalendarX", tone: "amber", href: PREG_LINK.checkups, cta: "Consultation",
                                  text: <><b>{missed.length}</b> appointment{missed.length === 1 ? "" : "s"} not marked as done.</> });
  if (tests.length) items.push({ icon: "FlaskConical", tone: "danger", href: PREG_LINK.tests, cta: "Tests & scans",
                                 text: <><b>{tests.map((t) => t.data.name).slice(0, 2).join(", ")}</b>{tests.length > 2 ? ` and ${tests.length - 2} more` : ""} — show your doctor.</> });
  if (reviews.length) items.push({ icon: "ShieldAlert", tone: "amber", href: PREG_LINK.risks, cta: "Risks",
                                   text: <>Review due: <b>{reviews.map((r) => r.data.factor).join(", ")}</b>.</> });
  if (level === "High") items.push({ icon: "ShieldAlert", tone: "danger", href: PREG_LINK.risks, cta: "Risks",
                                     text: <>Your doctor said part of your pregnancy needs <b>extra care</b>. Keep every check-up.</> });
  if (preg.status === "Delivered") items.push({ icon: "HeartPulse", tone: "lilac", href: PREG_LINK.birth, cta: "Birth & after",
                                                text: <>Your baby is here. Record your checks after the birth.</> });
  if (!items.length) return null;
  return (
    <section className="ux-card flex flex-col gap-2.5 p-4 sm:p-5" data-preg-attention>
      <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Needs your attention</h2>
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 rounded-[12px] p-2.5"
              style={{ background: it.tone === "danger" ? "var(--ux-danger-tint)" : HUE[it.tone].tint }}>
            <I name={it.icon} className="h-5 w-5 shrink-0" style={{ color: it.tone === "danger" ? "var(--ux-danger-ink)" : HUE[it.tone].ink }} />
            <span className="min-w-0 flex-1 text-sm" style={{ color: "var(--ux-ink)" }}>{it.text}</span>
            <Btn size="sm" variant="outline" iconEnd="ArrowRight" href={it.href}>{it.cta}</Btn>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Her pregnancy record in numbers, each one a way into its tab. */
function CareAtAGlance({ preg, store }: { preg: Pregnancy; store: PregStore }) {
  const own = (k: "anc" | "pregtest" | "pregrisk") => store.rows.filter((r) => r.kind === k && ((r.data as { preg?: string }).preg ?? "") === (preg.id ?? ""));
  const visits = own("anc").filter((v) => (v.data as { status?: string }).status !== "Missed").length;
  const tests = own("pregtest");
  const waiting = tests.filter((t) => ["Ordered", "Sample given", "Processing"].includes((t.data as { status: string }).status)).length;
  const watching = own("pregrisk").filter((r) => (r.data as { status: string }).status !== "Resolved").length;
  const meds = store.rows.filter((r) => r.kind === "medication" && ((r.data as { status?: string }).status ?? "Taking now") === "Taking now").length;
  return (
    <MetricGrid>
      <Metric hue="lilac" icon="Stethoscope" label="Check-ups" value={visits} href={PREG_LINK.checkups} />
      <Metric hue="blue" icon="FlaskConical" label="Tests waiting" value={waiting} sub={`${tests.length} in all`} href={PREG_LINK.tests} />
      <Metric hue="amber" icon="ShieldAlert" label="Being watched" value={watching} href={PREG_LINK.risks} />
      <Metric hue="green" icon="Pill" label="Medicines" value={meds} href={PREG_LINK.medicines} />
    </MetricGrid>
  );
}

function Overview({ info, preg, store, reminders, onAdd, onLog, onEdit, onEnd }: {
  info: PregInfo; preg: Pregnancy; store: PregStore; reminders: Entry[]; onAdd: () => void; onLog: () => void; onEdit: () => void; onEnd: () => void;
}) {
  const up = nextVisit(reminders);
  const [ending, setEnding] = useState(false);
  return (
    <Cols
      main={
        <>
          <Attention preg={preg} store={store} />
          <JourneyPanel info={info} />
          <CareAtAGlance preg={preg} store={store} />
          <WhatsNext info={info} />
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
                <Btn size="sm" icon="Plus" onClick={onAdd}>Add one</Btn>
              </>
            )}
          </Panel>
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5">
              {/* The two that log something open their steps here; the rest go where the thing lives. */}
              {([["Activity", "Log symptoms", onLog], ["Footprints", "Count kicks", "/app/health/pregnancy?tab=tools"],
                 ["Scale", "Log weight", "/app/health/pregnancy?tab=tools#weight"], ["CalendarPlus", "Add appointment", onAdd],
                 ["Briefcase", "Hospital bag", "/app/health/pregnancy?tab=tools#bag"], ["Stethoscope", "Talk to an OB-GYN", "/app/health/doctors?speciality=Gynaecologist"]] as const).map(([ic, l, to]) => {
                const cls = "ux-card ux-press ux-hov flex h-[92px] flex-col items-center justify-center gap-2 p-2 text-center text-[13px] font-bold leading-tight";
                const inner = (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.lilac.tint, color: HUE.lilac.ink }}><I name={ic} className="h-[18px] w-[18px]" /></span>
                    {l}
                  </>
                );
                return typeof to === "string"
                  ? <Link key={l} href={to} className={cls} style={{ color: "var(--ux-ink)" }}>{inner}</Link>
                  : <button key={l} type="button" onClick={to} className={cls} style={{ color: "var(--ux-ink)" }}>{inner}</button>;
              })}
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

/* ── symptoms ─────────────────────────────────────────────────────────── */

const SEVERITY_ART: Record<string, { art: string; sub: string }> = {
  Mild: { art: "Mild", sub: "I notice it" }, Moderate: { art: "Moderate", sub: "Hard to ignore" }, Strong: { art: "Severe", sub: "Stops me in my day" },
};

function CrampsWarning() {
  return <Disclaimer>Strong cramps in pregnancy can need care. If they don&rsquo;t ease, or come with bleeding, call your doctor or 108.</Disclaimer>;
}

/** Symptoms (several) → how strong → a note → check, with the day. */
function SymptomFlow({ entries, onClose }: { entries: Entries; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string>("Mild");
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const warn = picked.includes("Cramps") && severity === "Strong";
  const log = async () => {
    setBusy(true);
    const ok = await entries.add("pregsym", { symptoms: picked, severity, note: note.trim() }, when === "today" ? today() : addDays(today(), -1), "Saved to your symptom journal");
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "What are you feeling?", hint: "Tap all that apply.", valid: picked.length > 0,
      body: <PicChoice label="Symptoms" hue="lilac" multi columns={4} options={PREG_SYMPTOMS} value={picked}
                       onChange={(v) => setPicked((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} /> },
    { id: "how", title: "How strong is it?",
      body: <>
        {/* Moves on by itself, except when the choice needs a warning she should read first. */}
        <PicChoice label="Severity" hue="lilac" value={severity}
                   onChange={(v) => { setSeverity(v); if (!(v === "Strong" && picked.includes("Cramps"))) window.setTimeout(() => setStep(2), PICK_DELAY); }}
                   options={SEVERITY.map((v) => ({ value: v, label: v, ...SEVERITY_ART[v] }))} />
        {warn && <CrampsWarning />}
      </> },
    { id: "note", title: "Anything to add?", hint: "Optional. A few words for your doctor.", valid: !!note.trim(), optional: true,
      body: <Field label="A note" value={note} onChange={setNote} max={200} placeholder="A note (optional)" /> },
    { id: "check", title: "Check, then save", valid: picked.length > 0,
      body: <>
        <Chips label="When" hue="lilac" options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }]} value={when} onChange={(v) => setWhen(v as "today" | "yesterday")} />
        <Review rows={[["Symptoms", picked.join(", ")], ["How strong", severity], ["Note", note.trim()], ["Day", when === "today" ? "Today" : "Yesterday"]]} />
        {warn && <CrampsWarning />}
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Activity" title="Log how you feel" hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={log} busy={busy} submitLabel="Save" />;
}

/**
 * Today's symptoms, one tap each: the first tap starts today's entry (mild),
 * more taps add to it or take away, and "Add details" opens the full steps.
 */
function TodaySymptoms({ entries, rows, onLog }: { entries: Entries; rows: Entry<"pregsym">[]; onLog: () => void }) {
  const t = today();
  const mine = rows.find((r) => r.date === t);
  const on = mine?.data.symptoms ?? [];
  const [busy, setBusy] = useState("");
  const tap = async (s: string) => {
    if (busy) return;
    setBusy(s);
    if (!mine) await entries.add("pregsym", { symptoms: [s], severity: "Mild", note: "" }, t, `${s} saved for today`);
    else {
      const next = on.includes(s) ? on.filter((x) => x !== s) : [...on, s];
      if (next.length) await entries.edit(mine.id, { data: { symptoms: next } });
      else await entries.remove(mine.id, "Today's entry removed");
    }
    setBusy("");
  };
  return (
    <Panel title="Today" sub={on.length ? `${on.length} logged · tap again to take one off` : "How are you feeling? Tap what applies."}
           action={<Btn size="sm" variant="outline" icon="SlidersHorizontal" onClick={onLog}>Add details</Btn>}>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }} role="group" aria-label="Today's symptoms" data-today-symptoms>
        {PREG_SYMPTOMS.map((s) => {
          const sel = on.includes(s);
          return (
            <button key={s} type="button" aria-pressed={sel} disabled={!!busy} onClick={() => tap(s)}
                    className="ux-press flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] px-1.5 text-center text-[12.5px] font-bold leading-tight transition-colors"
                    style={sel ? { borderColor: HUE.lilac.ink, background: HUE.lilac.tint, color: "var(--ux-ink)" }
                               : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artOf(s)} alt="" className="h-8 w-8 object-contain" />
              {s}
            </button>
          );
        })}
      </div>
      {mine && (mine.data.severity || mine.data.note) && (
        <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{[mine.data.severity, mine.data.note].filter(Boolean).join(" · ")}</p>
      )}
    </Panel>
  );
}

/** How often each symptom came up in the last 30 days. */
function Last30({ rows }: { rows: Entry<"pregsym">[] }) {
  const from = addDays(today(), -29);
  const recent = rows.filter((r) => r.date >= from);
  const days = new Set(recent.map((r) => r.date)).size;
  const count = new Map<string, number>();
  for (const r of recent) for (const s of new Set(r.data.symptoms)) count.set(s, (count.get(s) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...top.map(([, n]) => n));
  return (
    <Panel title="Last 30 days" sub={days ? `Logged on ${days} ${days === 1 ? "day" : "days"}` : "Nothing logged in the last 30 days"}>
      {top.length ? (
        <ul className="flex flex-col gap-2.5" data-pregsym-30>
          {top.map(([s, n]) => (
            <li key={s} className="grid grid-cols-[28px_minmax(0,110px)_minmax(0,1fr)_auto] items-center gap-2.5 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artOf(s)} alt="" className="h-7 w-7 object-contain" />
              <span className="truncate font-bold" style={{ color: "var(--ux-ink)" }}>{s}</span>
              <span className="block h-2.5 overflow-hidden rounded-full" style={{ background: HUE.lilac.tint }}>
                <i className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: HUE.lilac.ink }} />
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{n} {n === 1 ? "day" : "days"}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Tap a symptom above when you feel it. Patterns show up here.</p>}
    </Panel>
  );
}

function Symptoms({ entries, onLog }: { entries: Entries; onLog: () => void }) {
  const rows = entries.rows.filter((r) => r.kind === "pregsym") as Entry<"pregsym">[];
  return (
    <Cols
      main={
        <>
          <TodaySymptoms entries={entries} rows={rows} onLog={onLog} />
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
            ) : <Empty icon="NotebookPen" title="Nothing logged yet" body="Log how you feel. It helps you remember what to tell your doctor."
                       action={<Btn size="sm" icon="Plus" onClick={onLog}>Log symptoms</Btn>} />}
          </Panel>
          <DangerCard />
        </>
      }
      side={
        <>
          <Last30 rows={rows} />
          <FormLauncher art="Pregnancy care" title="Log with details" sub="Symptoms, how strong, a note · 4 quick steps" steps={4} hue="lilac"
                        onStart={onLog} cta="Log" />
        </>
      }
    />
  );
}

/* ── care plan ────────────────────────────────────────────────────────── */

/** Her prenatal appointments: upcoming first, then the last few, each with Done and Delete. */
function AppointmentList({ entries, onAdd }: { entries: Entries; onAdd?: () => void }) {
  const visits = entries.rows.filter(isVisit) as Entry<"reminder">[];
  const t = today();
  const upcoming = visits.filter((v) => v.date >= t && !(v.data.done ?? []).includes(v.date)).sort((a, b) => a.date.localeCompare(b.date));
  const past = visits.filter((v) => !upcoming.includes(v)).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel title="Appointments" sub={upcoming.length ? `${upcoming.length} coming up` : undefined}
           action={onAdd ? <Btn size="sm" variant="outline" icon="Plus" onClick={onAdd}>Add</Btn> : undefined}>
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
                    {fmtDay(v.date, { weekday: "short", day: "numeric", month: "short" })}{v.data.time ? ` · ${fmtTime(v.data.time)}` : ""}
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
  );
}

function CarePlan({ info, ck, entries, onAdd }: { info: PregInfo; ck: Checks; entries: Entries; onAdd: () => void }) {
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
          <FormLauncher id="appointment" art="Prenatal checkup" title="Add a prenatal appointment" steps={5} hue="lilac"
                        sub="We'll remind you the day before · 5 quick steps" onStart={onAdd} cta="Add" />
          <AppointmentList entries={entries} />
        </>
      }
    />
  );
}

/** Pictures for the appointment types (art.ts names); the saved title stays the type's own words. */
const APPT_ART: Record<string, { art: string; sub?: string }> = {
  "Antenatal check-up": { art: "Prenatal checkup" }, "Ultrasound scan": { art: "Ultrasound" }, "Blood test": { art: "Blood test" },
  "Td injection": { art: "Vaccination" }, "PMSMA check-up": { art: "Doctor appointment", sub: "Free, on the 9th" },
};
const APPT_TIMES = ["09:00", "10:00", "11:30", "14:00", "16:00"];

/** Type → day → time → where (optional) → check. Saved as a "Prenatal checkup" reminder. */
function AppointmentFlow({ entries, hospital, onClose }: { entries: Entries; hospital: string; onClose: () => void }) {
  const t = today();
  const pmsma = nextPmsma();
  const dayOpts = [
    { value: addDays(t, 1), label: "Tomorrow" },
    { value: addDays(t, 7), label: "Next week" },
    { value: pmsma, label: `PMSMA day (${fmtDay(pmsma)})` },
    { value: "pick", label: "Pick a day" },
  ];
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(dayOpts[0].value);
  const [picked, setPicked] = useState(addDays(t, 3));
  const [time, setTime] = useState("10:00");
  const [where, setWhere] = useState(hospital);
  const [busy, setBusy] = useState(false);
  const date = day === "pick" ? picked : day;
  const add = async () => {
    setBusy(true);
    const ok = await entries.add("reminder", { title, category: VISIT, time, repeat: "Once", where: where.trim() }, date, "Appointment added — we'll remind you");
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "What is the appointment for?", valid: !!title,
      body: <PicChoice label="Appointment type" hue="lilac" value={title} onChange={setTitle} onPicked={() => setStep(1)}
                       options={APPT_TITLES.map((v) => ({ value: v, label: v, ...APPT_ART[v] }))} /> },
    { id: "day", title: "Which day?", hint: "PMSMA day is a free check-up at government health centres.", valid: !!date,
      body: <>
        <Chips label="Day" hue="lilac" options={dayOpts} value={day} onChange={setDay} />
        {day === "pick" && (
          <label className="ux-swap flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink-2)" }}>
            Appointment date
            <input type="date" value={picked} min={t} onChange={(e) => setPicked(e.target.value)}
                   className={`${inputCls} max-w-[260px]`} style={inputStyle} />
          </label>
        )}
        {date && (
          <p className="rounded-[12px] p-3 text-sm font-bold" style={{ background: HUE.lilac.tint, color: "var(--ux-ink)" }}>
            {fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        )}
      </> },
    { id: "time", title: "What time?", valid: !!time,
      body: <>
        <Chips label="Time" hue="lilac" options={APPT_TIMES.map((x) => ({ value: x, label: fmtTime(x) }))} value={time} onChange={setTime} />
        <label className="flex flex-col gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink-2)" }}>
          Or set the exact time
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)}
                 className={`${inputCls} max-w-[200px]`} style={inputStyle} />
        </label>
      </> },
    { id: "where", title: "Where is it?", hint: "Optional. The hospital or health centre.", valid: !!where.trim(), optional: true,
      body: <>
        {hospital && where.trim() !== hospital && (
          <Chips label="Your hospital" hue="lilac" options={[hospital]} value={where} onChange={setWhere} />
        )}
        <Field label="Hospital or health centre" value={where} onChange={setWhere} placeholder="Hospital or health centre (optional)" />
      </> },
    { id: "check", title: "Check, then save", valid: !!title && !!date,
      body: <Review rows={[
        ["What", title],
        ["Day", date ? fmtDay(date, { weekday: "short", day: "numeric", month: "short" }) : ""],
        ["Time", fmtTime(time)],
        ["Where", where.trim()],
        ["Reminder", "The day before"],
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="CalendarPlus" title="Add a prenatal appointment" hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={add} busy={busy} submitLabel="Add appointment" />;
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
    const id = window.location.hash.slice(1);
    if (id === "bag" || id === "weight") document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <Cols
      main={
        <>
          <KickCounter info={info} entries={entries} />
          <WeightTracker entries={entries} />
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

/** Weight through the pregnancy — the same "Weight" readings Health Records keeps. */
function WeightTracker({ entries }: { entries: Entries }) {
  const rows = entries.rows.filter((r): r is Entry<"measure"> => r.kind === "measure" && (r.data as { type?: string }).type === "Weight");
  const [value, setValue] = useState("");
  const problem = value ? readingProblem("Weight", value) : "";
  const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const save = async () => {
    const ok = await entries.add("measure", { type: "Weight", value: value.trim() }, today(), "Weight saved");
    if (ok) setValue("");
  };
  return (
    <Panel id="weight" title="Weight tracker" sub="Weigh at the same time of day, about once a week.">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 basis-[160px] flex-col gap-1 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>
          Today&apos;s weight (kg)
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))}
                 placeholder="58.5" aria-invalid={!!problem || undefined}
                 className="min-h-[44px] rounded-[12px] border px-3 text-base font-semibold tabular-nums"
                 style={{ borderColor: problem ? "var(--ux-danger-ink)" : "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        </label>
        <Btn icon="Plus" disabled={!value || !!problem} onClick={save}>Save</Btn>
      </div>
      {problem && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{problem}</p>}
      <TrendChart rows={rows} type="Weight" />
      {recent.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-sm">
              <span className="w-[92px] shrink-0 text-xs tabular-nums" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.date, { day: "numeric", month: "short" })}</span>
              <b className="flex-1 tabular-nums" style={{ color: "var(--ux-ink)" }}>{r.data.value} kg</b>
              <Btn size="sm" variant="ghost" icon="Trash2" onClick={() => entries.remove(r.id, "Weight deleted")}>Delete</Btn>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Healthy gain depends on your weight before pregnancy. Ask your doctor what is right for you.</p>
    </Panel>
  );
}

/* ── consultation ─────────────────────────────────────────────────────── */

function Consultation({ ck, preg, save, entries, onAdd }: { ck: Checks; preg: Pregnancy; save: Checks["save"]; entries: Entries; onAdd: () => void }) {
  const [doctor, setDoctor] = useState(preg.doctor ?? "");
  const [hospital, setHospital] = useState(preg.hospital ?? "");
  const dirty = doctor !== (preg.doctor ?? "") || hospital !== (preg.hospital ?? "");
  return (
    <Cols
      main={
        <>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }} data-consult-cards>
            <ConsultCard icon="Stethoscope" hue="green" title="OB-GYN consultation" body="Book with a gynaecologist — online or in person."
                         href="/app/health/doctors?speciality=Gynaecologist" cta="Find a gynaecologist" />
            <ConsultCard icon="Baby" hue="lilac" title="Child health doctor" body="Meet a paediatrician before baby arrives, or ask about newborn care."
                         href="/app/health/doctors?speciality=Paediatrician" cta="Find a paediatrician" />
            <ConsultCard icon="Users" hue="orange" title="Talk to a mother who's been there" body="Mentors share what helped them — not medical advice."
                         href="/app/health/mentors?topic=Pregnancy" cta="Find a mentor" />
          </div>
          <AppointmentList entries={entries} onAdd={onAdd} />
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

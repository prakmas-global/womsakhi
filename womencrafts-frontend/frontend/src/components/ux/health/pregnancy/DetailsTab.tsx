"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Chips, Cols, Panel } from "@/components/ux/health/kit";
import { Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { CONFIRM_METHODS, DELIVERY_MODES, PAST_OUTCOMES, PLURALITY, pregInfo } from "@/components/ux/health/pregnancy-data";
import { addDays, fmtDay, today, type HealthSettings, type Pregnancy } from "@/lib/health-api";
import { AskDoctor, Facts, Field, RecordRow, Row, RowActions, Tag, fmtShort, long } from "./parts";

type Save = (patch: Partial<HealthSettings>, msg?: string) => Promise<HealthSettings | null>;

const TRI = ["", "First", "Second", "Third"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** A short reference for this pregnancy, from its id: shown so she can quote it. */
export const pregRef = (p: Pregnancy) => (p.id ? `PRG-${p.id.slice(1, 7).toUpperCase()}` : "");

/**
 * Pregnancy → My details: the pregnancy's profile (how it was confirmed, the
 * type, gravida and para, blood group, her doctor), the due date with every
 * correction a scan or her doctor made, her previous pregnancies, and her
 * history and notes.
 */
export function DetailsTab({ preg, settings, save }: { preg: Pregnancy; settings: HealthSettings; save: Save }) {
  const info = pregInfo(preg)!;
  const fromLmp = pregInfo({ basis: preg.basis, date: preg.date })!;
  const [sheet, setSheet] = useState<"" | "details" | "dating" | "past" | "notes">("");
  const close = () => setSheet("");
  const put = (patch: Partial<Pregnancy>, msg: string) => save({ pregnancy: { ...preg, ...patch } }, msg);

  return (
    <>
      {sheet === "details" && <DetailsSheet preg={preg} blood={settings.bloodGroup} save={save} onClose={close} />}
      {sheet === "dating" && <DatingSheet preg={preg} save={save} onClose={close} />}
      {sheet === "past" && <PastSheet preg={preg} save={save} onClose={close} />}
      {sheet === "notes" && <NotesSheet preg={preg} save={save} onClose={close} />}
      <Cols
        main={
          <>
            <Panel title="Your pregnancy" sub={pregRef(preg) ? `Record ${pregRef(preg)}` : undefined}
                   action={<Btn size="sm" variant="outline" icon="Pencil" onClick={() => setSheet("details")}>Edit details</Btn>}>
              <Facts rows={[
                ["Confirmed", preg.confirmedOn ? `${fmtShort(preg.confirmedOn)}${preg.confirmMethod ? ` · ${preg.confirmMethod}` : ""}` : preg.confirmMethod ?? ""],
                [preg.basis === "lmp" ? "Last period" : "Due date given", fmtShort(preg.date)],
                ["Due date", <><b>{fmtDay(info.due, long)}</b>{preg.edd ? " · confirmed" : " · estimate"}</>],
                ["Today", `Week ${info.week} + ${info.day} day${info.day === 1 ? "" : "s"} · ${TRI[info.trimester]} trimester`],
                ["Type", preg.plurality ?? "Single"],
                ["Gravida / para", preg.gravida ? `G${preg.gravida} P${preg.para ?? 0}` : ""],
                ["Blood group", settings.bloodGroup],
                ["Doctor or ANM", preg.doctor],
                ["Hospital", preg.hospital],
                ["Status", preg.status === "Delivered" ? "Delivered — after-birth care" : "Ongoing"],
              ]} />
              {!preg.gravida && !preg.confirmedOn && (
                <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
                  Add how your pregnancy was confirmed and your history, so it is all in one place for your check-ups.
                </p>
              )}
            </Panel>

            <Panel title="Due date and dating" sub="Every change is kept, newest first"
                   action={<Btn size="sm" icon="CalendarCheck" onClick={() => setSheet("dating")}>Add a confirmed due date</Btn>}>
              <ul className="flex flex-col" data-dating>
                {[...(preg.dating ?? [])].reverse().map((d, i) => (
                  <RecordRow key={`${d.on}-${i}`} icon={d.method === "Dating scan" ? "ScanLine" : "Stethoscope"}
                             title={`Due ${fmtDay(d.edd, long)}`} sub={`${d.method} · noted ${fmtShort(d.on)}${d.note ? ` · ${d.note}` : ""}`}
                             tags={i === 0 && preg.edd === d.edd ? <Tag tone="green">In use</Tag> : <Tag>Earlier</Tag>} />
                ))}
                <RecordRow icon="Calendar" title={`Due ${fmtDay(fromLmp.due, long)}`}
                           sub={preg.basis === "lmp" ? `Worked out from your last period (${fmtShort(preg.date)}) — 40 weeks` : "The due date you entered"}
                           tags={!preg.edd ? <Tag tone="green">In use</Tag> : <Tag>Earlier estimate</Tag>} />
              </ul>
              {preg.edd && (
                <div>
                  <Btn size="sm" variant="ghost" icon="Undo2" onClick={() => put({ edd: "" }, "Using the date from your last period")}>
                    Use the date from my last period instead
                  </Btn>
                </div>
              )}
              <AskDoctor>A dating scan or your doctor may move your due date. Add it here and your weeks will follow it.</AskDoctor>
            </Panel>

            <Panel title="Previous pregnancies" sub={preg.previous?.length ? `${preg.previous.length} recorded` : "None recorded"}
                   action={<Btn size="sm" variant="outline" icon="Plus" onClick={() => setSheet("past")}>Add</Btn>}>
              {preg.previous?.length ? (
                <ul className="flex flex-col" data-previous>
                  {preg.previous.map((p, i) => (
                    <RecordRow key={i} icon="History" title={`${p.year || "Year not given"} · ${p.outcome}`}
                               sub={[p.mode, p.note].filter(Boolean).join(" · ")}
                               actions={<RowActions label="this pregnancy" onDelete={() => put({ previous: preg.previous!.filter((_, k) => k !== i) }, "Removed")} />} />
                  ))}
                </ul>
              ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>If this is not your first pregnancy, adding the others helps your doctor plan your care.</p>}
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="History and notes" action={<Btn size="sm" variant="outline" icon="Pencil" onClick={() => setSheet("notes")}>Edit</Btn>}>
              <div>
                <p className="mb-1 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>Medical and pregnancy history</p>
                <p className="whitespace-pre-line text-sm" style={{ color: preg.history ? "var(--ux-ink)" : "var(--ux-muted)" }}>
                  {preg.history || "Conditions, operations or problems in past pregnancies your doctor should know about."}
                </p>
              </div>
              <div>
                <p className="mb-1 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>Notes</p>
                <p className="whitespace-pre-line text-sm" style={{ color: preg.notes ? "var(--ux-ink)" : "var(--ux-muted)" }}>{preg.notes || "Anything else to remember."}</p>
              </div>
            </Panel>
            <Panel hue="lilac" tint title="What these mean">
              <ul className="flex flex-col gap-2 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                <li><b>Gravida</b> — how many times you have been pregnant, this time included.</li>
                <li><b>Para</b> — how many times you have given birth after 20 weeks, before this pregnancy.</li>
                <li><b>Due date</b> — 40 weeks from the first day of your last period, unless a scan or your doctor confirmed another.</li>
              </ul>
            </Panel>
          </>
        }
      />
    </>
  );
}

/* ── sheets ───────────────────────────────────────────────────────────── */

const count = (v: string) => (v === "" ? 0 : Math.max(0, Math.min(20, Math.round(Number(v) || 0))));

/** Confirmation → type and counts → blood group and care team → check. */
function DetailsSheet({ preg, blood, save, onClose }: { preg: Pregnancy; blood: string; save: Save; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [confirmedOn, setConfirmedOn] = useState(preg.confirmedOn ?? "");
  const [method, setMethod] = useState<string>(preg.confirmMethod ?? "");
  const [plurality, setPlurality] = useState<string>(preg.plurality ?? "Single");
  const [gravida, setGravida] = useState(preg.gravida ? String(preg.gravida) : "");
  const [para, setPara] = useState(preg.para ? String(preg.para) : "");
  const [group, setGroup] = useState(blood);
  const [doctor, setDoctor] = useState(preg.doctor ?? "");
  const [hospital, setHospital] = useState(preg.hospital ?? "");
  const [busy, setBusy] = useState(false);
  const t = today();
  const dateBad = confirmedOn && (confirmedOn > t || confirmedOn < addDays(t, -320)) ? "Pick a date in the last 10 months, not in the future." : "";
  const g = count(gravida), p = count(para);
  const countBad = gravida && p >= g ? "Para is births before this pregnancy, so it is less than gravida." : "";
  const submit = async () => {
    setBusy(true);
    const a = await save({
      pregnancy: { ...preg, confirmedOn, confirmMethod: method as Pregnancy["confirmMethod"], plurality: plurality as Pregnancy["plurality"],
                   gravida: g, para: p, doctor: doctor.trim(), hospital: hospital.trim() },
      ...(group !== blood ? { bloodGroup: group } : {}),
    }, "Details saved");
    setBusy(false);
    if (a) onClose();
  };
  const steps: FlowStep[] = [
    { id: "confirm", title: "How was it confirmed?", hint: "Optional, but helpful at your first check-up.", valid: !dateBad,
      body: <>
        <Chips label="Confirmed by" hue="lilac" options={CONFIRM_METHODS} value={method} onChange={setMethod} />
        <Field label="Confirmed on" type="date" value={confirmedOn} onChange={setConfirmedOn} maxDate={t} problem={dateBad} />
      </> },
    { id: "type", title: "This pregnancy", valid: !countBad,
      body: <>
        <Chips label="Type" hue="lilac" options={PLURALITY} value={plurality} onChange={setPlurality} />
        <Row>
          <Field label="Gravida (times pregnant, this one too)" inputMode="numeric" value={gravida} onChange={(v) => setGravida(v.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 2" />
          <Field label="Para (births before this one)" inputMode="numeric" value={para} onChange={(v) => setPara(v.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 1" problem={countBad} />
        </Row>
      </> },
    { id: "care", title: "Blood group and your care team",
      body: <>
        <Chips label="Blood group" hue="lilac" options={[...BLOOD]} value={group} onChange={setGroup} />
        <Field label="Doctor or ANM" value={doctor} onChange={setDoctor} placeholder="Doctor or ANM name" />
        <Field label="Hospital or health centre" value={hospital} onChange={setHospital} placeholder="Where you go for check-ups" />
      </> },
    { id: "check", title: "Check, then save", valid: !dateBad && !countBad,
      body: <Review rows={[
        ["Confirmed", [confirmedOn && fmtShort(confirmedOn), method].filter(Boolean).join(" · ")],
        ["Type", plurality], ["Gravida / para", gravida ? `G${g} P${p}` : ""], ["Blood group", group],
        ["Doctor", doctor.trim()], ["Hospital", hospital.trim()],
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Baby" title="Your pregnancy details" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={submit} busy={busy} />;
}

/** A due date confirmed by a scan or her doctor: kept in the list and used from now on. */
function DatingSheet({ preg, save, onClose }: { preg: Pregnancy; save: Save; onClose: () => void }) {
  const t = today();
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<"Dating scan" | "Doctor">("Dating scan");
  const [on, setOn] = useState(t);
  const [edd, setEdd] = useState(preg.edd || pregInfo(preg)!.due);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const eddBad = edd && (edd < addDays(t, -42) || edd > addDays(t, 300)) ? "Pick a due date within the next 10 months." : "";
  const onBad = on > t ? "The day it was confirmed cannot be in the future." : "";
  const after = edd && !eddBad ? pregInfo({ basis: "due", date: edd }) : null;
  const submit = async () => {
    setBusy(true);
    const a = await save({ pregnancy: { ...preg, edd, dating: [...(preg.dating ?? []), { on, edd, method, note: note.trim() }].slice(-20) } },
                         "Due date updated — your weeks follow it now");
    setBusy(false);
    if (a) onClose();
  };
  const steps: FlowStep[] = [
    { id: "who", title: "Who confirmed it?", valid: !onBad,
      body: <>
        <Chips label="Confirmed by" hue="lilac" options={["Dating scan", "Doctor"]} value={method} onChange={(v) => setMethod(v as "Dating scan" | "Doctor")} />
        <Field label="On" type="date" value={on} onChange={setOn} maxDate={t} problem={onBad} />
      </> },
    { id: "edd", title: "The confirmed due date", hint: "Exactly as written on your scan report or card.", valid: !!edd && !eddBad,
      body: <>
        <Field label="Due date" type="date" value={edd} onChange={setEdd} problem={eddBad} />
        {after && <p className="rounded-[12px] p-3 text-sm" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
          That makes you <b>week {after.week} + {after.day}</b> today.</p>}
        <Field label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. 12-week scan" />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="CalendarCheck" title="Add a confirmed due date" hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={submit} busy={busy} submitLabel="Use this due date" />;
}

function PastSheet({ preg, save, onClose }: { preg: Pregnancy; save: Save; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [year, setYear] = useState("");
  const [outcome, setOutcome] = useState<string>("Live birth");
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const yearBad = year && !/^(19|20)\d{2}$/.test(year) ? "Write the year as four digits, e.g. 2021." : "";
  const submit = async () => {
    setBusy(true);
    const a = await save({ pregnancy: { ...preg, previous: [...(preg.previous ?? []), {
      year, outcome: outcome as NonNullable<Pregnancy["previous"]>[number]["outcome"],
      mode: (outcome === "Live birth" || outcome === "Stillbirth" ? mode : "") as "" | "Vaginal" | "Assisted vaginal" | "Caesarean", note: note.trim() }] } },
                         "Previous pregnancy added");
    setBusy(false);
    if (a) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "A previous pregnancy", valid: !yearBad,
      body: <>
        <Field label="Year" inputMode="numeric" value={year} onChange={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 2021" problem={yearBad} />
        <Chips label="How it ended" hue="lilac" options={PAST_OUTCOMES} value={outcome} onChange={setOutcome} />
        {(outcome === "Live birth" || outcome === "Stillbirth") && <Chips label="Birth" hue="lilac" options={DELIVERY_MODES} value={mode} onChange={setMode} />}
        <Field label="Note (optional)" value={note} onChange={setNote} placeholder="Anything your doctor should know" />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="History" title="Add a previous pregnancy" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={submit} busy={busy} submitLabel="Add" />;
}

function NotesSheet({ preg, save, onClose }: { preg: Pregnancy; save: Save; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState(preg.history ?? "");
  const [notes, setNotes] = useState(preg.notes ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const a = await save({ pregnancy: { ...preg, history: history.trim(), notes: notes.trim() } }, "Saved");
    setBusy(false);
    if (a) onClose();
  };
  const steps: FlowStep[] = [
    { id: "notes", title: "History and notes",
      body: <>
        <Field area label="Medical and pregnancy history" value={history} onChange={setHistory} max={500}
               placeholder="Thyroid, diabetes, an operation, problems in a past pregnancy…" />
        <Field area label="Notes" value={notes} onChange={setNotes} max={500} placeholder="Anything else to remember" />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="NotebookPen" title="History and notes" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={submit} busy={busy} />;
}

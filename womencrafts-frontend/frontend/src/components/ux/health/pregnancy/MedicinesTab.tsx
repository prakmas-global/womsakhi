"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Chips, Panel } from "@/components/ux/health/kit";
import { Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { fmtTime } from "@/components/ux/health/QuickForms";
import { today, type Entry, type KindData } from "@/lib/health-api";
import { AskDoctor, Field, RecordRow, Row, RowActions, Tag, fmtShort, type PregStore } from "./parts";

/**
 * Pregnancy → Medicines: what she takes, supplements, allergies and
 * vaccinations. These are the same lists as Health Records (one list, never
 * two), with pregnancy's common ones one tap away and a daily reminder for
 * anything she takes. Only her doctor prescribes or stops a medicine.
 */

const SUPPLEMENTS = ["Folic acid", "Iron + folic acid (IFA)", "Calcium", "Vitamin D", "Albendazole (deworming)"];
const VACCINES = ["Td — 1st dose", "Td — 2nd dose", "Td — booster", "Flu vaccine", "Other vaccine"];
const SCHEDULES = ["Once a day", "Twice a day", "Three times a day", "Once a week", "As advised"];

export function MedicinesTab({ store }: { store: PregStore }) {
  const [sheet, setSheet] = useState<"" | "med" | "allergy" | "vaccine">("");
  const [preset, setPreset] = useState("");
  const meds = store.rows.filter((r) => r.kind === "medication") as Entry<"medication">[];
  const now = meds.filter((m) => (m.data.status ?? "Taking now") === "Taking now");
  const stopped = meds.filter((m) => m.data.status === "Stopped");
  const allergies = store.rows.filter((r) => r.kind === "allergy") as Entry<"allergy">[];
  const vaccines = (store.rows.filter((r) => r.kind === "history") as Entry<"history">[]).filter((h) => h.data.cat === "Vaccination");
  const reminders = store.rows.filter((r) => r.kind === "reminder" && (r.data as { category?: string }).category === "Medicine") as Entry<"reminder">[];
  const t = today();
  const hasReminder = (name: string) => reminders.some((r) => r.data.title.toLowerCase().includes(name.toLowerCase()) && !r.data.cancelled);
  const open = (s: typeof sheet, p = "") => { setPreset(p); setSheet(s); };

  return (
    <>
      {sheet === "med" && <MedFlow store={store} preset={preset} onClose={() => setSheet("")} />}
      {sheet === "allergy" && <AllergyFlow store={store} onClose={() => setSheet("")} />}
      {sheet === "vaccine" && <VaccineFlow store={store} preset={preset} onClose={() => setSheet("")} />}
      <div className="grid items-start gap-[var(--dashboard-gap,20px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Taking now" sub={now.length ? `${now.length} medicines and supplements` : undefined}
                 action={<Btn size="sm" icon="Plus" onClick={() => open("med")}>Add a medicine</Btn>}>
            {now.length ? (
              <ul className="flex flex-col" data-meds>
                {now.map((m) => {
                  const taken = (m.data.taken ?? []).includes(t);
                  return (
                    <RecordRow key={m.id} icon="Pill" title={m.data.name}
                               tags={<>{taken && <Tag tone="green">Taken today</Tag>}{hasReminder(m.data.name) && <Tag>Reminder on</Tag>}</>}
                               sub={[m.data.dose, m.data.schedule, m.data.reason].filter(Boolean).join(" · ")}
                               actions={<RowActions label={m.data.name} onDelete={() => store.remove(m.id, "Medicine removed")} />}>
                      <div className="flex flex-wrap gap-2">
                        <Btn size="sm" variant={taken ? "outline" : "soft"} icon={taken ? "Undo2" : "Check"}
                             onClick={() => store.edit(m.id, { data: { taken: taken ? (m.data.taken ?? []).filter((d) => d !== t) : [...(m.data.taken ?? []), t].slice(-120) } })}>
                          {taken ? "Not taken" : "Taken today"}
                        </Btn>
                        {!hasReminder(m.data.name) && (
                          <Btn size="sm" variant="outline" icon="AlarmClock"
                               onClick={() => store.add("reminder", { title: `Take ${m.data.name}`, category: "Medicine", time: "21:00", repeat: "Every day" }, t, `Daily reminder at ${fmtTime("21:00")} — change it in Reminders`)}>
                            Remind me daily
                          </Btn>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => store.edit(m.id, { data: { status: "Stopped" } }, `${m.data.name} moved to stopped`)}>My doctor stopped it</Btn>
                      </div>
                    </RecordRow>
                  );
                })}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Add the tablets and supplements your doctor gave you.</p>}
            <div>
              <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Common in pregnancy — tap to add</p>
              <div className="flex flex-wrap gap-2">
                {SUPPLEMENTS.filter((s) => !now.some((m) => m.data.name === s)).map((s) => (
                  <Btn key={s} size="sm" variant="outline" icon="Plus" onClick={() => open("med", s)}>{s}</Btn>
                ))}
              </div>
            </div>
          </Panel>
          {stopped.length > 0 && (
            <Panel title="Medicine history" sub="Stopped">
              <ul className="flex flex-col">
                {stopped.map((m) => (
                  <RecordRow key={m.id} icon="PillBottle" hue="blue" title={m.data.name} tags={<Tag>Stopped</Tag>}
                             sub={[m.data.dose, m.data.schedule, m.data.reason].filter(Boolean).join(" · ")}
                             actions={<RowActions label={m.data.name} onDelete={() => store.remove(m.id, "Removed")} />} />
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Allergies" action={<Btn size="sm" variant="outline" icon="Plus" onClick={() => open("allergy")}>Add</Btn>}>
            {allergies.length ? (
              <ul className="flex flex-col">
                {allergies.map((a) => (
                  <RecordRow key={a.id} icon="AlertCircle" hue="pink" title={a.data.name}
                             tags={<Tag tone={a.data.severity === "Severe" ? "danger" : a.data.severity === "Moderate" ? "amber" : "muted"}>{a.data.severity}</Tag>}
                             sub={a.data.reaction} actions={<RowActions label={a.data.name} onDelete={() => store.remove(a.id, "Removed")} />} />
                ))}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No allergies recorded. Tell your doctor about any medicine or food you react to.</p>}
          </Panel>
          <Panel title="Vaccinations" action={<Btn size="sm" variant="outline" icon="Plus" onClick={() => open("vaccine")}>Add</Btn>}>
            {vaccines.length ? (
              <ul className="flex flex-col">
                {vaccines.map((v) => (
                  <RecordRow key={v.id} icon="Syringe" hue="green" title={v.data.condition}
                             sub={[v.data.since && /^\d{4}-\d{2}-\d{2}$/.test(v.data.since) ? fmtShort(v.data.since) : v.data.since, v.data.note].filter(Boolean).join(" · ")}
                             actions={<RowActions label={v.data.condition} onDelete={() => store.remove(v.id, "Removed")} />} />
                ))}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Td injections are usually given in pregnancy. Record each dose here.</p>}
          </Panel>
          <AskDoctor>Never start or stop a medicine in pregnancy without asking your doctor. These lists are also in Health Records.</AskDoctor>
        </div>
      </div>
    </>
  );
}

function MedFlow({ store, preset, onClose }: { store: PregStore; preset: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(preset);
  const [dose, setDose] = useState("");
  const [schedule, setSchedule] = useState("Once a day");
  const [reason, setReason] = useState(preset ? "Pregnancy supplement" : "");
  const [time, setTime] = useState("21:00");
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const data: KindData["medication"] = { name: name.trim(), dose: dose.trim(), schedule, reason: reason.trim(), status: "Taking now" };
    const ok = await store.add("medication", data, "", `${name.trim()} added`);
    if (ok && remind) await store.add("reminder", { title: `Take ${name.trim()}`, category: "Medicine", time, repeat: schedule === "Once a week" ? "Every week" : "Every day" }, today());
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "Which medicine?", valid: !!name.trim(),
      body: <>
        <Field label="Name" value={name} onChange={setName} max={80} placeholder="As written on the strip" />
        <Row>
          <Field label="Dose (optional)" value={dose} onChange={setDose} max={60} placeholder="e.g. 1 tablet" />
          <Field label="For (optional)" value={reason} onChange={setReason} placeholder="e.g. Anaemia" />
        </Row>
        <Chips label="How often" hue="lilac" options={SCHEDULES} value={schedule} onChange={setSchedule} />
      </> },
    { id: "remind", title: "A reminder?", valid: true,
      body: <>
        <label className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-5 w-5" /> Remind me {schedule === "Once a week" ? "every week" : "every day"}
        </label>
        {remind && <Field label="At" type="time" value={time} onChange={(v) => v && setTime(v)} />}
        <Review rows={[["Medicine", name.trim()], ["Dose", dose.trim()], ["How often", schedule], ["For", reason.trim()], ["Reminder", remind ? fmtTime(time) : "No"]]} />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Pill" title="Add a medicine" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} submitLabel="Add" />;
}

function AllergyFlow({ store, onClose }: { store: PregStore; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<"Mild" | "Moderate" | "Severe">("Mild");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await store.add("allergy", { name: name.trim(), reaction: reaction.trim(), severity }, "", "Allergy added");
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "An allergy", valid: !!name.trim(),
      body: <>
        <Field label="Allergic to" value={name} onChange={setName} placeholder="A medicine, food or something else" />
        <Field label="What happens (optional)" value={reaction} onChange={setReaction} max={120} placeholder="e.g. Rash, swelling" />
        <Chips label="How bad" hue="lilac" options={["Mild", "Moderate", "Severe"]} value={severity} onChange={(v) => setSeverity(v as typeof severity)} />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="AlertCircle" title="Add an allergy" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} submitLabel="Add" />;
}

function VaccineFlow({ store, preset, onClose }: { store: PregStore; preset: string; onClose: () => void }) {
  const t = today();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(preset);
  const [date, setDate] = useState(t);
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await store.add("history", { cat: "Vaccination", condition: name.trim(), since: date, note: note.trim() }, "", "Vaccination added");
    if (ok && next) await store.add("reminder", { title: `Next dose: ${name.trim()}`, category: "Vaccination", time: "10:00", repeat: "Once" }, next, "We'll remind you about the next dose");
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "Which vaccine?", valid: !!name.trim() && !!date,
      body: <>
        <Chips label="Common in pregnancy" hue="lilac" options={VACCINES} value={name} onChange={setName} />
        <Field label="Or its name" value={name} onChange={setName} max={100} />
        <Field label="Given on" type="date" value={date} onChange={setDate} maxDate={t} />
        <Field label="Note (optional)" value={note} onChange={setNote} max={200} placeholder="e.g. Given at the PHC" />
        <Field label="Next dose due (optional — we'll remind you)" type="date" value={next} onChange={setNext} min={t} />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Syringe" title="Add a vaccination" hue="lilac" steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} submitLabel="Add" />;
}

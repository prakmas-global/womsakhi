"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Chips, Empty, HUE, I, Panel } from "@/components/ux/health/kit";
import { FormLauncher, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { ANC_SYMPTOMS } from "@/components/ux/health/pregnancy-data";
import { addDays, daysBetween, fmtDay, today, type Entry, type KindData, type Pregnancy } from "@/lib/health-api";
import { AskDoctor, Field, RecordRow, Row, RowActions, Tag, fmtShort, mine, weeksAt, type PregStore } from "./parts";

const VISIT_CATS = ["Prenatal checkup", "Pregnancy visit"];
const isVisitReminder = (e: Entry) => e.kind === "reminder" && VISIT_CATS.includes((e.data as { category?: string }).category ?? "");

/** Appointments whose day has passed without being marked done. */
export function missedVisits(store: PregStore): Entry<"reminder">[] {
  const t = today();
  return (store.rows.filter(isVisitReminder) as Entry<"reminder">[])
    .filter((r) => r.date < t && !r.data.cancelled && !(r.data.done ?? []).includes(r.date))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The next check-up her last visit asked for, when that day has passed and nothing is booked since. */
export function overdueVisit(store: PregStore, preg: Pregnancy): { due: string; days: number } | null {
  const t = today();
  const last = mine(store, "anc", preg).find((v) => v.data.status !== "Missed");
  const due = last?.data.next_date;
  if (!due || due >= t) return null;
  const booked = (store.rows.filter(isVisitReminder) as Entry<"reminder">[]).some((r) => r.date >= due && !r.data.cancelled);
  const seen = mine(store, "anc", preg).some((v) => v.date >= due && v.data.status !== "Missed");
  return booked || seen ? null : { due, days: daysBetween(t, due) };
}

/**
 * Pregnancy → Check-ups: the antenatal visits she has had, what was measured
 * at each, what was planned, and which check-up is next. A visit can also
 * file her weight and blood pressure under Health Records, so the trends
 * there include the clinic's readings.
 */
export function CheckupsTab({ preg, store, onAdd }: { preg: Pregnancy; store: PregStore; onAdd: () => void }) {
  const [editing, setEditing] = useState<Entry<"anc"> | null | "new">(null);
  const [fromAppt, setFromAppt] = useState<Entry<"reminder"> | null>(null);
  const visits = mine(store, "anc", preg);
  const missed = missedVisits(store);
  const overdue = overdueVisit(store, preg);
  const done = visits.filter((v) => v.data.status !== "Missed");
  const record = (appt?: Entry<"reminder">) => { setFromAppt(appt ?? null); setEditing("new"); };

  return (
    <>
      {editing && (
        <AncFlow preg={preg} store={store} visit={editing === "new" ? null : editing} appt={fromAppt}
                 onClose={() => { setEditing(null); setFromAppt(null); }} />
      )}
      {(overdue || missed.length > 0) && (
        <section className="ux-card flex flex-col gap-3 p-4 sm:p-5" style={{ background: HUE.amber.tint }} data-anc-attention>
          <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: HUE.amber.ink }}>
            <I name="AlarmClock" /> Needs your attention
          </h2>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: "var(--ux-ink)" }}>
            {overdue && (
              <li className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">Your next check-up was due on <b>{fmtShort(overdue.due)}</b> — {overdue.days} {overdue.days === 1 ? "day" : "days"} ago.</span>
                <Btn size="sm" icon="CalendarPlus" onClick={onAdd}>Book it</Btn>
              </li>
            )}
            {missed.slice(0, 3).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1"><b>{m.data.title}</b> on {fmtShort(m.date)} is not marked as done.</span>
                <Btn size="sm" variant="outline" icon="ClipboardCheck" onClick={() => record(m)}>I went — record it</Btn>
                <Btn size="sm" variant="ghost" onClick={() => {
                  void store.edit(m.id, { data: { done: [...(m.data.done ?? []), m.date] } });
                  void store.add("anc", { preg: preg.id ?? "", status: "Missed", where: m.data.where ?? "", notes: m.data.title }, m.date, "Marked as missed");
                }}>I missed it</Btn>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-[var(--dashboard-gap,20px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Your check-ups" sub={done.length ? `${done.length} recorded · ${weeksAt(preg, today())} today` : "Nothing recorded yet"}
               action={<Btn size="sm" icon="Plus" onClick={() => record()}>Record a check-up</Btn>}>
          {visits.length ? (
            <ul className="flex flex-col" data-anc-visits>
              {visits.map((v) => {
                const d = v.data;
                const missedOne = d.status === "Missed";
                return (
                  <RecordRow key={v.id} icon={missedOne ? "CalendarX" : "Stethoscope"} hue={missedOne ? "amber" : "lilac"}
                             title={fmtDay(v.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                             tags={<>{missedOne ? <Tag tone="amber">Missed</Tag> : <Tag tone="lilac">{weeksAt(preg, v.date)}</Tag>}</>}
                             sub={[d.where, d.doctor].filter(Boolean).join(" · ")}
                             actions={<RowActions label="this check-up" onEdit={missedOne ? undefined : () => setEditing(v)} onDelete={() => store.remove(v.id, "Check-up deleted")} />}>
                    {!missedOne && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {d.bp && <Tag tone="blue">BP {d.bp}</Tag>}
                          {d.weight && <Tag tone="blue">{d.weight} kg</Tag>}
                          {d.fhr && <Tag tone="lilac">Baby&apos;s heart {d.fhr}/min</Tag>}
                          {d.fundal && <Tag tone="lilac">Bump {d.fundal} cm</Tag>}
                          {d.movements && <Tag tone={d.movements === "Less than usual" ? "danger" : "muted"}>Movements: {d.movements.toLowerCase()}</Tag>}
                        </div>
                        {(d.symptoms?.length ?? 0) > 0 && <p><span style={{ color: "var(--ux-muted)" }}>Symptoms:</span> {d.symptoms!.join(", ")}</p>}
                        {d.exam && <p><span style={{ color: "var(--ux-muted)" }}>Examination:</span> {d.exam}</p>}
                        {d.plan && <p><span style={{ color: "var(--ux-muted)" }}>Plan:</span> {d.plan}</p>}
                        {d.notes && <p><span style={{ color: "var(--ux-muted)" }}>Notes:</span> {d.notes}</p>}
                        {d.next_date && <p><span style={{ color: "var(--ux-muted)" }}>Next visit:</span> <b>{fmtShort(d.next_date)}</b></p>}
                      </div>
                    )}
                  </RecordRow>
                );
              })}
            </ul>
          ) : (
            <Empty icon="ClipboardList" title="No check-ups recorded"
                   body="After each antenatal check-up, record what was measured and what your doctor planned. Copy it from your ANC card."
                   action={<Btn size="sm" icon="Plus" onClick={() => record()}>Record a check-up</Btn>} />
          )}
          <AskDoctor />
        </Panel>
        <div className="flex min-w-0 flex-col gap-5">
          <FormLauncher art="Prenatal checkup" title="Record a check-up" hue="lilac" steps={5} cta="Record"
                        sub="Readings, how you have been, the plan · 5 quick steps" onStart={() => record()} />
          <BpWeight visits={done} />
        </div>
      </div>
    </>
  );
}

/** Blood pressure and weight across her visits, side by side, newest first. */
function BpWeight({ visits }: { visits: Entry<"anc">[] }) {
  const rows = visits.filter((v) => v.data.bp || v.data.weight).slice(0, 8);
  if (!rows.length) return null;
  return (
    <Panel title="Readings at your visits">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ color: "var(--ux-muted)" }}>
            <th className="pb-1.5 text-start font-bold">Date</th><th className="pb-1.5 text-start font-bold">BP</th><th className="pb-1.5 text-end font-bold">Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t" style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink)" }}>
              <td className="py-1.5">{fmtDay(v.date, { day: "numeric", month: "short" })}</td>
              <td className="py-1.5 tabular-nums">{v.data.bp || "—"}</td>
              <td className="py-1.5 text-end tabular-nums">{v.data.weight ? `${v.data.weight} kg` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ── record a check-up ─────────────────────────────────────────────────── */

const num = (v: string, max = 5) => v.replace(/[^0-9.]/g, "").slice(0, max);

/** When and where → readings → how you have been → plan and next visit → check. */
function AncFlow({ preg, store, visit, appt, onClose }: {
  preg: Pregnancy; store: PregStore; visit: Entry<"anc"> | null; appt: Entry<"reminder"> | null; onClose: () => void;
}) {
  const t = today();
  const d0: Partial<KindData["anc"]> = visit?.data ?? {};
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(visit?.date ?? appt?.date ?? t);
  const [where, setWhere] = useState(d0.where ?? appt?.data.where ?? preg.hospital ?? "");
  const [doctor, setDoctor] = useState(d0.doctor ?? preg.doctor ?? "");
  const [bp, setBp] = useState(d0.bp ?? "");
  const [weight, setWeight] = useState(d0.weight ?? "");
  const [fhr, setFhr] = useState(d0.fhr ?? "");
  const [fundal, setFundal] = useState(d0.fundal ?? "");
  const [movements, setMovements] = useState<string>(d0.movements ?? "");
  const [symptoms, setSymptoms] = useState<string[]>(d0.symptoms ?? []);
  const [exam, setExam] = useState(d0.exam ?? "");
  const [plan, setPlan] = useState(d0.plan ?? "");
  const [notes, setNotes] = useState(d0.notes ?? "");
  const [next, setNext] = useState(d0.next_date ?? "");
  const [remind, setRemind] = useState(!visit);
  const [toRecords, setToRecords] = useState(!visit);
  const [busy, setBusy] = useState(false);

  const dateBad = date > t ? "A check-up you are recording cannot be in the future." : "";
  const bpBad = bp && !/^\d{2,3}\/\d{2,3}$/.test(bp) ? "Write it as two numbers, like 120/80." : "";
  const wBad = weight && (Number(weight) < 25 || Number(weight) > 250) ? "Check the weight — in kg." : "";
  const fhrBad = fhr && (Number(fhr) < 50 || Number(fhr) > 250) ? "Check the number — beats a minute, as told." : "";
  const fundalBad = fundal && (Number(fundal) < 5 || Number(fundal) > 50) ? "Check the number — in cm." : "";
  const nextBad = next && next <= date ? "The next visit comes after this one." : "";
  const readingsOk = !bpBad && !wBad && !fhrBad && !fundalBad;

  const save = async () => {
    setBusy(true);
    const data: KindData["anc"] = {
      preg: preg.id ?? "", status: "Done", where: where.trim(), doctor: doctor.trim(), bp, weight, fhr, fundal,
      movements: movements as KindData["anc"]["movements"], symptoms: symptoms.filter((s) => s !== "None"), exam: exam.trim(),
      plan: plan.trim(), notes: notes.trim(), next_date: next,
    };
    const ok = visit ? await store.edit(visit.id, { date, data }, "Check-up updated") : await store.add("anc", data, date, "Check-up recorded");
    if (ok && !visit) {
      if (appt) await store.edit(appt.id, { data: { done: [...(appt.data.done ?? []), appt.date] } });
      if (toRecords && weight) await store.add("measure", { type: "Weight", value: weight, note: "At my check-up" }, date);
      if (toRecords && bp) await store.add("measure", { type: "Blood pressure", value: bp, note: "At my check-up" }, date);
      if (remind && next) await store.add("reminder", { title: "Antenatal check-up", category: "Prenatal checkup", time: "10:00", repeat: "Once", where: where.trim() }, next, "Next check-up added to your reminders");
    }
    setBusy(false);
    if (ok) onClose();
  };

  const steps: FlowStep[] = [
    { id: "when", title: "When and where?", valid: !dateBad && !!date,
      body: <>
        <Chips label="Day" hue="lilac" value={date === t ? "today" : date === addDays(t, -1) ? "yesterday" : ""} onChange={(v) => setDate(v === "today" ? t : addDays(t, -1))}
               options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }]} />
        <Field label="Or the date" type="date" value={date} onChange={setDate} maxDate={t} problem={dateBad} />
        {date && !dateBad && <p className="text-sm" style={{ color: "var(--ux-muted)" }}>You were <b style={{ color: "var(--ux-ink)" }}>{weeksAt(preg, date)}</b> that day.</p>}
        <Row>
          <Field label="Hospital or health centre" value={where} onChange={setWhere} placeholder="Where it was" />
          <Field label="Doctor or ANM" value={doctor} onChange={setDoctor} placeholder="Who saw you" />
        </Row>
      </> },
    { id: "readings", title: "What was measured?", hint: "Copy from your ANC card. Leave blank anything not measured.", valid: readingsOk, optional: true,
      body: <>
        <Row>
          <Field label="Blood pressure" inputMode="text" value={bp} onChange={(v) => setBp(v.replace(/[^0-9/]/g, "").slice(0, 7))} placeholder="120/80" problem={bpBad} />
          <Field label="Weight (kg)" inputMode="decimal" value={weight} onChange={(v) => setWeight(num(v))} placeholder="62.5" problem={wBad} />
        </Row>
        <Row>
          <Field label="Baby's heart rate (beats a minute)" inputMode="numeric" value={fhr} onChange={(v) => setFhr(v.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 140" problem={fhrBad} />
          <Field label="Bump measurement (cm)" inputMode="numeric" value={fundal} onChange={(v) => setFundal(v.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 26" problem={fundalBad} />
        </Row>
        <Chips label="Baby's movements" hue="lilac" options={["Normal", "Less than usual", "Not felt yet"]} value={movements} onChange={(v) => setMovements(movements === v ? "" : v)} />
        {movements === "Less than usual" && (
          <p role="alert" className="rounded-[12px] p-3 text-sm font-semibold" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
            If your baby is moving less than usual, don&apos;t wait for your next visit — call your doctor or go to hospital.
          </p>
        )}
      </> },
    { id: "how", title: "How have you been?", optional: true, valid: symptoms.length > 0 || !!exam.trim(),
      body: <>
        <Chips label="Symptoms you mentioned" hue="lilac" options={ANC_SYMPTOMS} value={symptoms}
               onChange={(v) => setSymptoms((c) => (v === "None" ? ["None"] : c.includes(v) ? c.filter((x) => x !== v) : [...c.filter((x) => x !== "None"), v]))} />
        <Field area label="What was examined, and what they found (optional)" value={exam} onChange={setExam} max={200}
               placeholder="As your doctor told you" />
      </> },
    { id: "plan", title: "The plan, and your next visit", valid: !nextBad,
      body: <>
        <Field area label="Plan or advice given (optional)" value={plan} onChange={setPlan} max={200} placeholder="e.g. Iron tablets daily, sugar test next month" />
        <Field area label="Your notes (optional)" value={notes} onChange={setNotes} max={200} placeholder="Questions to ask next time" />
        <Field label="Next visit" type="date" value={next} onChange={setNext} min={addDays(date, 1)} problem={nextBad} />
        {!visit && next && (
          <label className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-5 w-5" style={{ accentColor: HUE.lilac.ink }} />
            Remind me about the next visit
          </label>
        )}
        {!visit && (bp || weight) && (
          <label className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
            <input type="checkbox" checked={toRecords} onChange={(e) => setToRecords(e.target.checked)} className="h-5 w-5" style={{ accentColor: HUE.lilac.ink }} />
            Also add the weight and BP to my Health Records
          </label>
        )}
      </> },
    { id: "check", title: "Check, then save", valid: !dateBad && readingsOk && !nextBad,
      body: <Review rows={[
        ["Day", `${fmtShort(date)} · ${weeksAt(preg, date)}`], ["Where", [where.trim(), doctor.trim()].filter(Boolean).join(" · ")],
        ["Blood pressure", bp], ["Weight", weight ? `${weight} kg` : ""], ["Baby's heart rate", fhr ? `${fhr} a minute` : ""],
        ["Bump", fundal ? `${fundal} cm` : ""], ["Movements", movements], ["Symptoms", symptoms.join(", ")],
        ["Examination", exam.trim()], ["Plan", plan.trim()], ["Next visit", next ? fmtShort(next) : ""],
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Stethoscope" title={visit ? "Edit check-up" : "Record a check-up"} hue="lilac"
                    steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} submitLabel={visit ? "Save changes" : "Save check-up"} />;
}

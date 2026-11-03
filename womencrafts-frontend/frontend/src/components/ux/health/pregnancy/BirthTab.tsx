"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { escapeHtml, letterhead, printDocument } from "@/components/ux/kit/download";
import { toast } from "@/components/ux/mobile/Toast";
import { Chips, Empty, HUE, Panel } from "@/components/ux/health/kit";
import { FormLauncher, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { DELIVERY_MODES, POSTNATAL_CHECKS, pregInfo, weeksOn } from "@/components/ux/health/pregnancy-data";
import { addDays, fmtDay, today, type Baby, type Entry, type HealthSettings, type KindData, type Pregnancy } from "@/lib/health-api";
import { pregRef } from "./DetailsTab";
import { AskDoctor, Facts, Field, RecordRow, Row, RowActions, Tag, fmtShort, long, mine, weeksAt, type PregStore } from "./parts";

type Save = (patch: Partial<HealthSettings>, msg?: string) => Promise<HealthSettings | null>;
type D = Entry<"delivery">;
type P = Entry<"postnatal">;

const babyLabel = (b: Baby, i: number) => b.name || `Baby ${String.fromCharCode(65 + i)}`;

/**
 * Pregnancy → Birth & after: labour and the birth, each baby, the checks
 * after the birth for her and for each baby, the discharge summary she can
 * print, and closing this pregnancy's record when she is ready.
 */
export function BirthTab({ preg, store, settings, save, onClosed }: {
  preg: Pregnancy; store: PregStore; settings: HealthSettings; save: Save; onClosed: (outcome: string) => void;
}) {
  const [sheet, setSheet] = useState<"" | "delivery" | "postnatal" | "close">("");
  const [editingP, setEditingP] = useState<P | null>(null);
  const delivery = mine(store, "delivery", preg)[0] as D | undefined;
  const checks = mine(store, "postnatal", preg);
  const babies = delivery?.data.babies ?? [];
  const momChecks = checks.filter((c) => c.data.who === "Mother");
  const nextCheck = checks.map((c) => c.data.next_date).filter((d): d is string => !!d && d >= today()).sort()[0];

  return (
    <>
      {sheet === "delivery" && <DeliveryFlow preg={preg} store={store} save={save} delivery={delivery ?? null} onClose={() => setSheet("")} />}
      {(sheet === "postnatal" || editingP) && (
        <PostnatalFlow preg={preg} store={store} babies={babies} check={editingP} onClose={() => { setSheet(""); setEditingP(null); }} />
      )}
      {sheet === "close" && <CloseFlow preg={preg} store={store} delivery={delivery} momChecks={momChecks.length} save={save} onClose={() => setSheet("")} onClosed={onClosed} />}

      <div className="grid items-start gap-[var(--dashboard-gap,20px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {delivery ? (
            <Panel title="The birth" sub={`${fmtDay(delivery.date, long)} · ${weeksAt(preg, delivery.date)}`}
                   action={<Btn size="sm" variant="outline" icon="Pencil" onClick={() => setSheet("delivery")}>Edit</Btn>}>
              <Facts rows={[
                ["Admitted", delivery.data.admitted_on ? `${fmtShort(delivery.data.admitted_on)}${delivery.data.admitted_time ? ` at ${delivery.data.admitted_time}` : ""}` : ""],
                ["Weeks at admission", delivery.data.weeks_at_admission ? `${delivery.data.weeks_at_admission} weeks` : ""],
                ["Where", delivery.data.place],
                ["Birth", delivery.data.mode],
                ["Labour", delivery.data.labour_notes],
                ["Help given", delivery.data.interventions],
                ["Complications", delivery.data.complications],
                ["Outcome", delivery.data.outcome],
              ]} />
              <div className="grid gap-3 sm:grid-cols-2" data-babies>
                {babies.map((b, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-[14px] p-3.5" style={{ background: HUE.lilac.tint }}>
                    <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{babyLabel(b, i)}</b>
                    <span className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                      {[b.sex && b.sex !== "Not said" ? b.sex : "", b.weight_g ? `${(b.weight_g / 1000).toFixed(2)} kg` : "", b.time ? `born ${b.time}` : ""].filter(Boolean).join(" · ") || "Details not added"}
                    </span>
                    {b.condition && <span className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{b.condition}</span>}
                  </div>
                ))}
              </div>
            </Panel>
          ) : (
            <Panel title="The birth">
              <Empty icon="Baby" title="Not recorded yet"
                     body={preg.plurality && preg.plurality !== "Single" ? `When your babies arrive, record the birth and each baby here.` : "When your baby arrives, record the birth here — it starts your after-birth care."}
                     action={<Btn size="sm" icon="Plus" onClick={() => setSheet("delivery")}>Record the birth</Btn>} />
            </Panel>
          )}

          <Panel title="After the birth" sub={checks.length ? `${checks.length} ${checks.length === 1 ? "check" : "checks"} recorded` : "Checks for you and your baby"}
                 action={<Btn size="sm" icon="Plus" onClick={() => setSheet("postnatal")}>Add a check</Btn>}>
            {checks.length ? (
              <ul className="flex flex-col" data-postnatal>
                {checks.map((c) => (
                  <RecordRow key={c.id} icon={c.data.who === "Mother" ? "HeartPulse" : "Baby"} hue={c.data.who === "Mother" ? "pink" : "lilac"}
                             title={`${c.data.check} · ${c.data.who === "Mother" ? "You" : c.data.baby || "Baby"}`}
                             tags={c.data.complications ? <Tag tone="amber">Needs care</Tag> : undefined}
                             sub={fmtDay(c.date, { weekday: "short", day: "numeric", month: "short" })}
                             actions={<RowActions label={c.data.check} onEdit={() => setEditingP(c)} onDelete={() => store.remove(c.id, "Removed")} />}>
                    <div className="flex flex-col gap-1">
                      {c.data.findings && <p><span style={{ color: "var(--ux-muted)" }}>Found:</span> {c.data.findings}</p>}
                      {c.data.complications && <p><span style={{ color: "var(--ux-muted)" }}>Complications:</span> {c.data.complications}</p>}
                      {c.data.feeding && <p><span style={{ color: "var(--ux-muted)" }}>Feeding:</span> {c.data.feeding}</p>}
                      {c.data.counselling && <p><span style={{ color: "var(--ux-muted)" }}>Advice:</span> {c.data.counselling}</p>}
                      {c.data.next_date && <p><span style={{ color: "var(--ux-muted)" }}>Next:</span> <b>{fmtShort(c.data.next_date)}</b></p>}
                    </div>
                  </RecordRow>
                ))}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your check-ups and your baby&apos;s — feeding, stitches, mood, weight and vaccinations — all go here.</p>}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {!delivery && <FormLauncher art="Pregnancy" title="Record the birth" hue="lilac" steps={5} cta="Record" sub="Admission, labour, the birth, each baby" onStart={() => setSheet("delivery")} />}
          {nextCheck && (
            <Panel title="Next check">
              <p className="text-sm" style={{ color: "var(--ux-ink)" }}><b>{fmtDay(nextCheck, long)}</b></p>
            </Panel>
          )}
          <Panel title="Summary for you and your doctor">
            <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>Your pregnancy, the birth, each baby and the checks after — on one page to print or save as PDF.</p>
            <Btn variant="outline" icon="Printer" onClick={() => { const err = printSummary(preg, settings, store); if (err) toast(err, { tone: "error" }); }}>
              Print the summary
            </Btn>
          </Panel>
          <Panel title="Close this pregnancy record">
            <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
              When your after-birth care is done, close it. Everything stays in History, and you can start a new pregnancy any time.
            </p>
            <Btn variant="outline" icon="Archive" onClick={() => setSheet("close")}>Close the record</Btn>
          </Panel>
          <AskDoctor>If you have heavy bleeding, fever, severe pain or feel very low after the birth, call your doctor or 108 straight away.</AskDoctor>
        </div>
      </div>
    </>
  );
}

/* ── the birth ─────────────────────────────────────────────────────────── */

function DeliveryFlow({ preg, store, save, delivery, onClose }: { preg: Pregnancy; store: PregStore; save: Save; delivery: D | null; onClose: () => void }) {
  const t = today();
  const info = pregInfo(preg)!;
  const d0: Partial<KindData["delivery"]> = delivery?.data ?? {};
  const nBabies = preg.plurality === "Twins" ? 2 : preg.plurality === "Triplets or more" ? 3 : 1;
  const [step, setStep] = useState(0);
  const [admittedOn, setAdmittedOn] = useState(d0.admitted_on ?? "");
  const [admittedTime, setAdmittedTime] = useState(d0.admitted_time ?? "");
  const [place, setPlace] = useState(d0.place ?? preg.hospital ?? "");
  const [labour, setLabour] = useState(d0.labour_notes ?? "");
  const [interventions, setInterventions] = useState(d0.interventions ?? "");
  const [date, setDate] = useState(delivery?.date ?? t);
  const [mode, setMode] = useState<KindData["delivery"]["mode"]>(d0.mode ?? "Vaginal");
  const [complications, setComplications] = useState(d0.complications ?? "");
  const [outcome, setOutcome] = useState(d0.outcome ?? "");
  const [babies, setBabies] = useState<Baby[]>(d0.babies?.length ? d0.babies : Array.from({ length: nBabies }, () => ({ name: "", sex: "", weight_g: 0, time: "", condition: "" })));
  const [busy, setBusy] = useState(false);

  const admitBad = admittedOn && (admittedOn > t || admittedOn > date) ? "Admission comes on or before the birth, not in the future." : "";
  const dateBad = date > t ? "The birth day cannot be in the future." : date < addDays(info.lmp, 140) ? "That is before 20 weeks — check the date." : "";
  const weightBad = babies.some((b) => b.weight_g && (b.weight_g < 300 || b.weight_g > 7000)) ? "Check the weights — in grams, e.g. 2900." : "";
  const atAdmission = admittedOn ? weeksOn(info.lmp, admittedOn)?.w ?? 0 : 0;
  const setBaby = (i: number, patch: Partial<Baby>) => setBabies((bs) => bs.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  const submit = async () => {
    setBusy(true);
    const data: KindData["delivery"] = {
      preg: preg.id ?? "", admitted_on: admittedOn, admitted_time: admittedTime, weeks_at_admission: atAdmission, labour_notes: labour.trim(),
      interventions: interventions.trim(), mode, place: place.trim(), complications: complications.trim(), outcome: outcome.trim(),
      babies: babies.map((b) => ({ ...b, name: (b.name ?? "").trim(), condition: (b.condition ?? "").trim(), weight_g: Number(b.weight_g) || 0 })),
    };
    const ok = delivery ? await store.edit(delivery.id, { date, data }, "Birth details saved")
                        : await store.add("delivery", data, date, "Congratulations — the birth is recorded");
    if (ok && preg.status !== "Delivered") await save({ pregnancy: { ...preg, status: "Delivered" } });
    setBusy(false);
    if (ok) onClose();
  };

  const steps: FlowStep[] = [
    { id: "admit", title: "Going in", hint: "Optional — when you were admitted for labour.", optional: true, valid: !!admittedOn && !admitBad,
      body: <>
        <Row>
          <Field label="Admitted on" type="date" value={admittedOn} onChange={setAdmittedOn} maxDate={t} problem={admitBad} />
          <Field label="At" type="time" value={admittedTime} onChange={setAdmittedTime} />
        </Row>
        {atAdmission > 0 && <p className="text-sm" style={{ color: "var(--ux-muted)" }}>You were <b style={{ color: "var(--ux-ink)" }}>{atAdmission} weeks</b> then.</p>}
        <Field label="Hospital" value={place} onChange={setPlace} placeholder="Where the birth was" />
      </> },
    { id: "labour", title: "Labour", hint: "Optional — what happened and any help given, as you were told.", optional: true, valid: !!(labour.trim() || interventions.trim()),
      body: <>
        <Field area label="How labour went" value={labour} onChange={setLabour} max={200} placeholder="e.g. Started on its own, about 10 hours" />
        <Field area label="Help given" value={interventions} onChange={setInterventions} max={200} placeholder="e.g. Drip to speed labour, epidural" />
      </> },
    { id: "birth", title: "The birth", valid: !dateBad,
      body: <>
        <Field label="Birth date" type="date" value={date} onChange={setDate} maxDate={t} problem={dateBad} />
        <Chips label="How your baby was born" hue="lilac" options={DELIVERY_MODES} value={mode} onChange={(v) => setMode(v)} />
        <Field area label="Complications for you (optional)" value={complications} onChange={setComplications} max={200} placeholder="As your doctor told you" />
        <Field label="Outcome (optional)" value={outcome} onChange={setOutcome} placeholder="e.g. Mother and baby well" />
      </> },
    { id: "babies", title: babies.length > 1 ? "Your babies" : "Your baby", valid: !weightBad,
      body: <>
        {babies.map((b, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[14px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
            <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{babyLabel(b, i)}</b>
            <Row>
              <Field label="Name (optional)" value={b.name ?? ""} onChange={(v) => setBaby(i, { name: v.slice(0, 40) })} placeholder={babyLabel({}, i)} />
              <Field label="Time of birth" type="time" value={b.time ?? ""} onChange={(v) => setBaby(i, { time: v })} />
            </Row>
            <Chips label="Baby" hue="lilac" options={["Girl", "Boy", "Not said"]} value={b.sex ?? ""} onChange={(v) => setBaby(i, { sex: v as Baby["sex"] })} />
            <Row>
              <Field label="Birth weight (grams)" inputMode="numeric" value={b.weight_g ? String(b.weight_g) : ""}
                     onChange={(v) => setBaby(i, { weight_g: Number(v.replace(/\D/g, "").slice(0, 4)) || 0 })} placeholder="e.g. 2900" />
              <Field label="Condition at birth (optional)" value={b.condition ?? ""} onChange={(v) => setBaby(i, { condition: v.slice(0, 80) })} placeholder="e.g. Cried at once, well" />
            </Row>
          </div>
        ))}
        {weightBad && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{weightBad}</p>}
        <div className="flex gap-2">
          {babies.length < 6 && <Btn size="sm" variant="outline" icon="Plus" onClick={() => setBabies((bs) => [...bs, { name: "", sex: "", weight_g: 0 }])}>Add another baby</Btn>}
          {babies.length > 1 && <Btn size="sm" variant="ghost" onClick={() => setBabies((bs) => bs.slice(0, -1))}>Remove the last</Btn>}
        </div>
      </> },
    { id: "check", title: "Check, then save", valid: !dateBad && !admitBad && !weightBad,
      body: <Review rows={[
        ["Admitted", admittedOn ? `${fmtShort(admittedOn)}${admittedTime ? ` at ${admittedTime}` : ""}` : ""], ["Hospital", place.trim()],
        ["Birth", `${fmtShort(date)} · ${mode}`], ["Complications", complications.trim()], ["Outcome", outcome.trim()],
        ...babies.map((b, i) => [babyLabel(b, i), [b.sex, b.weight_g ? `${b.weight_g} g` : "", b.time].filter(Boolean).join(" · ")] as [string, string]),
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Baby" title={delivery ? "Edit the birth" : "Record the birth"} hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={submit} busy={busy} submitLabel="Save" />;
}

/* ── checks after the birth ────────────────────────────────────────────── */

function PostnatalFlow({ preg, store, babies, check, onClose }: { preg: Pregnancy; store: PregStore; babies: Baby[]; check: P | null; onClose: () => void }) {
  const t = today();
  const d0: Partial<KindData["postnatal"]> = check?.data ?? {};
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<"Mother" | "Baby">(d0.who ?? "Mother");
  const [baby, setBaby] = useState(d0.baby ?? (babies[0] ? babyLabel(babies[0], 0) : ""));
  const [name, setName] = useState(d0.check ?? "");
  const [date, setDate] = useState(check?.date ?? t);
  const [findings, setFindings] = useState(d0.findings ?? "");
  const [complications, setComplications] = useState(d0.complications ?? "");
  const [feeding, setFeeding] = useState<string>(d0.feeding ?? "");
  const [counselling, setCounselling] = useState(d0.counselling ?? "");
  const [next, setNext] = useState(d0.next_date ?? "");
  const [remind, setRemind] = useState(!check);
  const [busy, setBusy] = useState(false);
  const nextBad = next && next <= date ? "The next check comes after this one." : "";
  const submit = async () => {
    setBusy(true);
    const data: KindData["postnatal"] = {
      preg: preg.id ?? "", who, baby: who === "Baby" ? baby : "", check: name.trim(), findings: findings.trim(), complications: complications.trim(),
      feeding: feeding as KindData["postnatal"]["feeding"], counselling: counselling.trim(), next_date: next,
    };
    const ok = check ? await store.edit(check.id, { date, data }, "Saved") : await store.add("postnatal", data, date, "Check recorded");
    if (ok && !check && remind && next) {
      await store.add("reminder", { title: `${who === "Mother" ? "My" : `${baby || "Baby"}'s`} next check`, category: who === "Mother" ? "Health check" : "Doctor appointment", time: "10:00", repeat: "Once" }, next);
    }
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "who", title: "Whose check?", valid: !!name.trim() && date <= t,
      body: <>
        <Chips label="For" hue="lilac" options={[{ value: "Mother", label: "Me" }, { value: "Baby", label: "My baby" }]} value={who} onChange={(v) => setWho(v as "Mother" | "Baby")} />
        {who === "Baby" && babies.length > 1 && <Chips label="Which baby" hue="lilac" options={babies.map((b, i) => babyLabel(b, i))} value={baby} onChange={setBaby} />}
        <Chips label="Check" hue="lilac" options={[...POSTNATAL_CHECKS[who]]} value={name} onChange={setName} />
        <Field label="Or describe it" value={name} onChange={setName} max={60} />
        <Field label="On" type="date" value={date} onChange={setDate} maxDate={t} />
      </> },
    { id: "found", title: "What was found?", hint: "Optional — as you were told.", optional: true, valid: !!(findings.trim() || complications.trim() || feeding),
      body: <>
        <Field area label="Findings" value={findings} onChange={setFindings} max={200} placeholder={who === "Mother" ? "e.g. Healing well, BP normal" : "e.g. Weight 3.1 kg, jaundice settling"} />
        <Field area label="Any complications" value={complications} onChange={setComplications} max={200} placeholder="Leave blank if none" />
        <Chips label="Feeding" hue="lilac" options={["Breastfeeding", "Formula", "Both", "Not yet"]} value={feeding} onChange={(v) => setFeeding(feeding === v ? "" : v)} />
      </> },
    { id: "next", title: "Advice and next check", valid: !nextBad,
      body: <>
        <Field area label="Advice or counselling given (optional)" value={counselling} onChange={setCounselling} max={200} placeholder="e.g. Feeding position, family planning" />
        <Field label="Next check (optional)" type="date" value={next} onChange={setNext} min={addDays(date, 1)} problem={nextBad} />
        {!check && next && (
          <label className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-5 w-5" /> Remind me
          </label>
        )}
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="HeartPulse" title={check ? "Edit check" : "A check after the birth"} hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={submit} busy={busy} submitLabel="Save" />;
}

/* ── closing the record ────────────────────────────────────────────────── */

function CloseFlow({ preg, store, delivery, momChecks, save, onClose, onClosed }: {
  preg: Pregnancy; store: PregStore; delivery: D | undefined; momChecks: number; save: Save; onClose: () => void; onClosed: (outcome: string) => void;
}) {
  const [step, setStep] = useState(0);
  const babies = delivery?.data.babies.length ?? 0;
  const [outcome, setOutcome] = useState(delivery ? `Birth · ${babies} ${babies === 1 ? "baby" : "babies"} · ${delivery.data.mode}` : "");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const kept = await store.add("pregepisode", { pregnancy: preg, outcome: outcome.trim(), closed_on: today() }, today());
    if (kept) {
      const s = await save({ pregnancy: null }, "Pregnancy record closed — it is kept in History");
      if (s) onClosed(outcome.trim());
    }
    setBusy(false);
    if (kept) onClose();
  };
  const items: [string, boolean][] = [["The birth is recorded", !!delivery], ["A check after the birth for you", momChecks > 0]];
  const steps: FlowStep[] = [
    { id: "close", title: "Close this pregnancy record", valid: !!outcome.trim(),
      body: <>
        <ul className="flex flex-col gap-1.5 text-sm">
          {items.map(([l, ok]) => (
            <li key={l} className="flex items-center gap-2" style={{ color: ok ? "var(--ux-ink)" : "var(--ux-muted)" }}>
              <Tag tone={ok ? "green" : "amber"}>{ok ? "Done" : "Not yet"}</Tag> {l}
            </li>
          ))}
        </ul>
        {items.some(([, ok]) => !ok) && <p className="text-sm" style={{ color: "var(--ux-muted)" }}>You can still close it — add anything missing first if you can.</p>}
        <Field label="How it ended" value={outcome} onChange={setOutcome} placeholder="e.g. Birth · 1 baby · Vaginal" />
        <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>Your check-ups, tests, the birth and the checks after stay in <b>History</b>. Record {pregRef(preg)}.</p>
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Archive" title="Close the record" hue="lilac" steps={steps} step={step} setStep={setStep}
                    onSubmit={submit} busy={busy} submitLabel="Close the record" />;
}

/* ── the printable summary ─────────────────────────────────────────────── */

/** Pregnancy, check-ups, tests, the birth, each baby and the checks after — one page. Returns an error message or "". */
export function printSummary(preg: Pregnancy, settings: HealthSettings, store: PregStore): string {
  const e = escapeHtml;
  const info = pregInfo(preg)!;
  const row = (k: string, v?: string) => (v ? `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>` : "");
  const table = (rows: string) => (rows ? `<table>${rows}</table>` : "<p>None recorded.</p>");
  const visits = mine(store, "anc", preg).filter((v) => v.data.status !== "Missed");
  const tests = mine(store, "pregtest", preg);
  const risks = mine(store, "pregrisk", preg);
  const delivery = mine(store, "delivery", preg)[0];
  const checks = mine(store, "postnatal", preg);
  const meds = (store.rows.filter((r) => r.kind === "medication") as Entry<"medication">[]).filter((m) => (m.data.status ?? "Taking now") === "Taking now");
  const html = `${letterhead(`Pregnancy summary${settings.name ? ` — ${settings.name}` : ""}`, `${pregRef(preg)} · printed ${fmtDay(today(), long)}. Recorded by her, from her own care.`)}
<h2>Pregnancy</h2>${table(
    row("Last period", fmtDay(info.lmp, long)) + row("Due date", `${fmtDay(info.due, long)}${preg.edd ? " (confirmed)" : " (estimate)"}`) +
    row("Type", preg.plurality) + row("Gravida / para", preg.gravida ? `G${preg.gravida} P${preg.para ?? 0}` : "") +
    row("Blood group", settings.bloodGroup) + row("Doctor", preg.doctor) + row("Hospital", preg.hospital) + row("History", preg.history))}
<h2>Check-ups</h2>${table(visits.map((v) => row(`${fmtDay(v.date, { day: "numeric", month: "short", year: "numeric" })} · ${weeksAt(preg, v.date)}`,
    [v.data.bp && `BP ${v.data.bp}`, v.data.weight && `${v.data.weight} kg`, v.data.fhr && `FHR ${v.data.fhr}`, v.data.fundal && `Fundal ${v.data.fundal} cm`, v.data.plan].filter(Boolean).join(" · "))).join(""))}
<h2>Tests and scans</h2>${table(tests.map((t) => row(`${t.data.name} (${fmtDay(t.date, { day: "numeric", month: "short" })})`,
    [t.data.status, t.data.result && `${t.data.result}${t.data.unit ? ` ${t.data.unit}` : ""}`, t.data.doctor_note].filter(Boolean).join(" · "))).join(""))}
<h2>Watched by her doctor</h2>${table(risks.map((r) => row(r.data.factor, [r.data.level !== "Not told" ? r.data.level : "", r.data.status, r.data.plan].filter(Boolean).join(" · "))).join(""))}
<h2>Medicines</h2>${table(meds.map((m) => row(m.data.name, [m.data.dose, m.data.schedule].filter(Boolean).join(" · "))).join(""))}
<h2>The birth</h2>${delivery ? table(row("Date", fmtDay(delivery.date, long)) + row("Weeks at admission", delivery.data.weeks_at_admission ? String(delivery.data.weeks_at_admission) : "") +
    row("Birth", delivery.data.mode) + row("Hospital", delivery.data.place) + row("Complications", delivery.data.complications) + row("Outcome", delivery.data.outcome) +
    delivery.data.babies.map((b, i) => row(babyLabel(b, i), [b.sex, b.weight_g ? `${b.weight_g} g` : "", b.time, b.condition].filter(Boolean).join(" · "))).join("")) : "<p>Not recorded yet.</p>"}
<h2>After the birth</h2>${table(checks.map((c) => row(`${c.data.check} — ${c.data.who === "Mother" ? "mother" : c.data.baby || "baby"} (${fmtDay(c.date, { day: "numeric", month: "short" })})`,
    [c.data.findings, c.data.complications, c.data.feeding, c.data.next_date && `next ${fmtDay(c.data.next_date, { day: "numeric", month: "short" })}`].filter(Boolean).join(" · "))).join(""))}
<p class="sub">This is her own record of her care. It is not a medical document and makes no diagnosis.</p>`;
  return printDocument("Pregnancy summary", html);
}

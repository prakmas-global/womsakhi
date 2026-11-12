"use client";

import { useRef, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { Chips, Empty, HUE, I, Metric, MetricGrid, Panel } from "@/components/ux/health/kit";
import { Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { TEST_PRESETS, TEST_STEPS, outsideRange } from "@/components/ux/health/pregnancy-data";
import { apiErrorMessage } from "@/lib/api";
import { apiOpenHealthFile, apiUploadHealthFile, fmtDay, today, type Entry, type KindData, type Pregnancy, type PregTestStatus } from "@/lib/health-api";
import { validateDocument } from "@/lib/uploads-api";
import { AskDoctor, Field, RecordRow, Row, RowActions, Tag, fmtShort, mine, weeksAt, type PregStore } from "./parts";

type T = Entry<"pregtest">;
const WAITING: PregTestStatus[] = ["Ordered", "Sample given", "Processing"];

/** Tests that need something from her: results back but not yet reviewed with her doctor, or a result outside its range. */
export function testsToReview(store: PregStore, preg: Pregnancy): T[] {
  return mine(store, "pregtest", preg).filter((x) => x.data.status === "Result ready" || (x.data.status !== "Reviewed" && flagOf(x)));
}
const flagOf = (x: T) => outsideRange(x.data.result, x.data.ref_low, x.data.ref_high);

/**
 * Pregnancy → Tests & scans: every test and scan from ordered to reviewed.
 * A result is shown as outside its range only when it falls outside the range
 * printed on her own report — the app keeps no ranges of its own and never
 * says what a result means. Her doctor's words go with it.
 */
export function TestsTab({ preg, store }: { preg: Pregnancy; store: PregStore }) {
  const [editing, setEditing] = useState<T | null | "new">(null);
  const all = mine(store, "pregtest", preg);
  const waiting = all.filter((x) => WAITING.includes(x.data.status));
  const results = all.filter((x) => !WAITING.includes(x.data.status));
  const review = testsToReview(store, preg);
  const flagged = all.filter((x) => flagOf(x));
  const next = (x: T) => {
    const i = TEST_STEPS.indexOf(x.data.status);
    if (i < 0 || i >= TEST_STEPS.length - 1) return;
    const to = TEST_STEPS[i + 1];
    if (to === "Result ready" && !x.data.result && !x.data.file_id) { setEditing(x); return; }  // ask for the result first
    void store.edit(x.id, { data: { status: to } }, `Marked “${to.toLowerCase()}”`);
  };

  const row = (x: T) => {
    const d = x.data, flag = flagOf(x);
    const i = TEST_STEPS.indexOf(d.status);
    return (
      <RecordRow key={x.id} icon={d.group === "Scan" ? "ScanLine" : d.group === "Urine test" ? "TestTube" : "Droplet"}
                 title={d.name}
                 tags={<>
                   <Tag tone={d.status === "Reviewed" ? "green" : d.status === "Result ready" ? "amber" : "muted"}>{d.status}</Tag>
                   {flag && <Tag tone="danger">{flag === "low" ? "Below" : "Above"} the range on your report</Tag>}
                 </>}
                 sub={`${d.group} · ${fmtShort(x.date)} · ${weeksAt(preg, x.date)}`}
                 actions={<RowActions label={d.name} onEdit={() => setEditing(x)} onDelete={() => store.remove(x.id, "Test deleted")} />}>
        <div className="flex flex-col gap-1.5">
          {d.result && (
            <p><span style={{ color: "var(--ux-muted)" }}>Result:</span> <b>{d.result}{d.unit ? ` ${d.unit}` : ""}</b>
              {(d.ref_low || d.ref_high) && <span style={{ color: "var(--ux-muted)" }}> · range on report {d.ref_low || "…"}–{d.ref_high || "…"}{d.unit ? ` ${d.unit}` : ""}</span>}
            </p>
          )}
          {d.doctor_note && <p><span style={{ color: "var(--ux-muted)" }}>Doctor said:</span> {d.doctor_note}</p>}
          {d.follow_up && <p><span style={{ color: "var(--ux-muted)" }}>Follow-up:</span> {d.follow_up}</p>}
          <div className="flex flex-wrap gap-2">
            {d.file_id && (
              <Btn size="sm" variant="outline" icon="FileText" onClick={() => void apiOpenHealthFile(d.file_id!).catch((e) => toast(apiErrorMessage(e), { tone: "error" }))}>
                {d.file_name ? d.file_name.slice(0, 28) : "Open report"}
              </Btn>
            )}
            {i >= 0 && i < TEST_STEPS.length - 1 && (
              <Btn size="sm" variant="soft" icon="ArrowRight" onClick={() => next(x)}>Mark “{TEST_STEPS[i + 1].toLowerCase()}”</Btn>
            )}
          </div>
        </div>
      </RecordRow>
    );
  };

  return (
    <>
      {editing && <TestFlow preg={preg} store={store} test={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <MetricGrid>
        <Metric hue="lilac" icon="FlaskConical" label="Tests and scans" value={all.length} />
        <Metric hue="amber" icon="Hourglass" label="Waiting for results" value={waiting.length} />
        <Metric hue="pink" icon="ClipboardCheck" label="To review with your doctor" value={review.length} />
        <Metric hue="green" icon="CheckCircle2" label="Reviewed" value={all.filter((x) => x.data.status === "Reviewed").length} />
      </MetricGrid>
      {flagged.some((x) => x.data.status !== "Reviewed") && (
        <section className="ux-card flex items-start gap-3 p-4" style={{ background: "var(--ux-danger-tint)" }} data-test-flags>
          <I name="AlertTriangle" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--ux-danger-ink)" }} />
          <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
            <b>{flagged.filter((x) => x.data.status !== "Reviewed").map((x) => x.data.name).join(", ")}</b>{" "}
            {flagged.filter((x) => x.data.status !== "Reviewed").length === 1 ? "is" : "are"} outside the range printed on your report.
            That is not a diagnosis — show it to your doctor, then mark it reviewed.
          </p>
        </section>
      )}
      <div className="grid items-start gap-[var(--dashboard-gap,20px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Waiting for results" sub={waiting.length ? `${waiting.length} in progress` : undefined}
                 action={<Btn size="sm" icon="Plus" onClick={() => setEditing("new")}>Add a test or scan</Btn>}>
            {waiting.length ? <ul className="flex flex-col" data-tests-waiting>{waiting.map(row)}</ul>
              : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>When your doctor orders a test or scan, add it here and move it along as it happens.</p>}
          </Panel>
          <Panel title="Results" sub={results.length ? `${results.length} with results` : undefined}>
            {results.length ? <ul className="flex flex-col" data-tests-results>{results.map(row)}</ul>
              : <Empty icon="FileSearch" title="No results yet" body="Add a result with the range printed on your report, and attach a photo or PDF of it."
                       action={<Btn size="sm" icon="Plus" onClick={() => setEditing("new")}>Add a result</Btn>} />}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel hue="lilac" tint title="How it works">
            <ol className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
              {TEST_STEPS.map((s, i) => <li key={s}><b>{i + 1}. {s}</b></li>)}
            </ol>
            <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>Move each test along with one tap. Mark it <b>reviewed</b> once your doctor has seen the result.</p>
          </Panel>
          <AskDoctor>Results are compared only with the range printed on your own report. Your doctor tells you what a result means for you.</AskDoctor>
        </div>
      </div>
    </>
  );
}

/* ── add or edit a test ─────────────────────────────────────────────────── */

const num = (v: string) => v.replace(/[^0-9.]/g, "").slice(0, 7);
const GROUPS = ["Blood test", "Urine test", "Sugar test", "Scan", "Other"] as const;

/** Which test → where it is → the result (optional) → what the doctor said (optional) → check. */
function TestFlow({ preg, store, test, onClose }: { preg: Pregnancy; store: PregStore; test: T | null; onClose: () => void }) {
  const t = today();
  const d0: Partial<KindData["pregtest"]> = test?.data ?? {};
  const [step, setStep] = useState(test ? 1 : 0);
  const [name, setName] = useState(d0.name ?? "");
  const [group, setGroup] = useState<KindData["pregtest"]["group"]>(d0.group ?? "Blood test");
  const [date, setDate] = useState(test?.date ?? t);
  const [status, setStatus] = useState<PregTestStatus>(d0.status ?? "Ordered");
  const [result, setResult] = useState(d0.result ?? "");
  const [unit, setUnit] = useState(d0.unit ?? "");
  const [low, setLow] = useState(d0.ref_low ?? "");
  const [high, setHigh] = useState(d0.ref_high ?? "");
  const [note, setNote] = useState(d0.doctor_note ?? "");
  const [follow, setFollow] = useState(d0.follow_up ?? "");
  const [file, setFile] = useState<{ id: string; name: string } | null>(d0.file_id ? { id: d0.file_id, name: d0.file_name ?? "" } : null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const rangeBad = low && high && Number(low) > Number(high) ? "The lower end comes first." : "";
  const flag = outsideRange(result, low, high);
  const hasResult = !!result.trim() || !!file;
  const pick = async (f?: File) => {
    if (!f) return;
    const bad = validateDocument(f);
    if (bad) { toast(bad, { tone: "error" }); return; }
    setUploading(true);
    try { const up = await apiUploadHealthFile(f); setFile({ id: up.id, name: up.name }); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); } finally { setUploading(false); }
  };
  const save = async () => {
    setBusy(true);
    // A result entered on an "ordered" test means the result is in.
    const st: PregTestStatus = hasResult && WAITING.includes(status) ? "Result ready" : status;
    const data: KindData["pregtest"] = {
      preg: preg.id ?? "", name: name.trim(), group, status: st, result: result.trim(), unit: unit.trim(), ref_low: low, ref_high: high,
      doctor_note: note.trim(), follow_up: follow.trim(), file_id: file?.id ?? "", file_name: file?.name ?? "",
    };
    const ok = test ? await store.edit(test.id, { date, data }, "Saved") : await store.add("pregtest", data, date, `${name.trim()} added`);
    setBusy(false);
    if (ok) onClose();
  };

  const steps: FlowStep[] = [
    { id: "which", title: "Which test or scan?", valid: !!name.trim(),
      body: <>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Common tests">
          {TEST_PRESETS.map((p) => (
            <button key={p.name} type="button" aria-pressed={name === p.name}
                    onClick={() => { setName(p.name); setGroup(p.group); if (p.unit && !unit) setUnit(p.unit); }}
                    className="ux-press min-h-[38px] rounded-full border-[1.5px] px-3 text-[13px] font-bold"
                    style={name === p.name ? { borderColor: HUE.lilac.ink, background: HUE.lilac.tint, color: "var(--ux-ink)" }
                                           : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              {p.name}
            </button>
          ))}
        </div>
        <Field label="Or type its name" value={name} onChange={setName} max={60} placeholder="As written on the slip" />
        <Chips label="Kind" hue="lilac" options={GROUPS} value={group} onChange={(v) => setGroup(v)} />
      </> },
    { id: "where", title: "Where is it now?", valid: !!date,
      body: <>
        <Chips label="Status" hue="lilac" options={TEST_STEPS} value={status} onChange={(v) => setStatus(v)} />
        <Field label={status === "Ordered" ? "Ordered on" : "Date"} type="date" value={date} onChange={setDate} />
      </> },
    { id: "result", title: "The result", hint: "Optional. Copy the result and the range printed next to it on your report.", optional: true,
      valid: hasResult && !rangeBad && !uploading,
      body: <>
        <Row>
          <Field label="Result" value={result} onChange={(v) => setResult(v.slice(0, 60))} placeholder="e.g. 11.2, or Normal" />
          <Field label="Unit" value={unit} onChange={(v) => setUnit(v.slice(0, 20))} placeholder="e.g. g/dL" />
        </Row>
        <Row>
          <Field label="Range on report — from" inputMode="decimal" value={low} onChange={(v) => setLow(num(v))} placeholder="e.g. 11" />
          <Field label="to" inputMode="decimal" value={high} onChange={(v) => setHigh(num(v))} placeholder="e.g. 15" problem={rangeBad} />
        </Row>
        {flag && (
          <p className="rounded-[12px] p-3 text-sm font-semibold" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
            This is {flag === "low" ? "below" : "above"} the range on your report. Show it to your doctor — only they can say what it means for you.
          </p>
        )}
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        <div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" variant="outline" icon="Paperclip" loading={uploading} onClick={() => input.current?.click()}>
            {file ? "Change the report" : "Attach the report (photo or PDF)"}
          </Btn>
          {file && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{file.name}</span>}
        </div>
      </> },
    { id: "doctor", title: "What did your doctor say?", hint: "Optional. In their words, and what happens next.", optional: true,
      valid: !!note.trim() || !!follow.trim(),
      body: <>
        <Field area label="Doctor's assessment" value={note} onChange={setNote} max={200} placeholder="e.g. Iron is a little low" />
        <Field area label="Follow-up" value={follow} onChange={setFollow} max={200} placeholder="e.g. Repeat in 4 weeks" />
        {(note.trim() || follow.trim()) && status !== "Reviewed" && (
          <Btn size="sm" variant="soft" icon="Check" onClick={() => setStatus("Reviewed")}>Mark as reviewed by my doctor</Btn>
        )}
      </> },
    { id: "check", title: "Check, then save", valid: !!name.trim() && !rangeBad && !uploading,
      body: <Review rows={[
        ["Test", `${name.trim()} · ${group}`], ["Date", `${fmtDay(date, { day: "numeric", month: "short", year: "numeric" })} · ${weeksAt(preg, date)}`],
        ["Status", hasResult && WAITING.includes(status) ? "Result ready" : status],
        ["Result", result ? `${result}${unit ? ` ${unit}` : ""}` : ""], ["Range on report", low || high ? `${low || "…"}–${high || "…"}` : ""],
        ["Report", file?.name ?? ""], ["Doctor said", note.trim()], ["Follow-up", follow.trim()],
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="FlaskConical" title={test ? "Edit test or scan" : "Add a test or scan"} hue="lilac"
                    steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} submitLabel={test ? "Save changes" : "Save"} />;
}

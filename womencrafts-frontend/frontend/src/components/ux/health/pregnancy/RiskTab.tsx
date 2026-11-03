"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Chips, Empty, HUE, I, Panel } from "@/components/ux/health/kit";
import { Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { RISK_PRESETS } from "@/components/ux/health/pregnancy-data";
import { today, type Entry, type KindData, type Pregnancy } from "@/lib/health-api";
import { AskDoctor, Field, RecordRow, RowActions, Tag, fmtShort, mine, type PregStore } from "./parts";

type R = Entry<"pregrisk">;
const LEVEL_TONE = { "Not told": "muted", Low: "green", Moderate: "amber", High: "danger" } as const;

/** Open items whose review day has come. */
export function reviewsDue(store: PregStore, preg: Pregnancy): R[] {
  const t = today();
  return mine(store, "pregrisk", preg).filter((r) => r.data.status !== "Resolved" && r.data.review_date && r.data.review_date <= t);
}

/** The level her doctor gave, the highest of her open items ("" when none is open). */
export function riskLevel(store: PregStore, preg: Pregnancy): "" | "Not told" | "Low" | "Moderate" | "High" {
  const open = mine(store, "pregrisk", preg).filter((r) => r.data.status !== "Resolved").map((r) => r.data.level);
  return (["High", "Moderate", "Low", "Not told"] as const).find((l) => open.includes(l)) ?? "";
}

/**
 * Pregnancy → Risks: what her doctor is keeping an eye on, the level THEY
 * gave, where she was referred, the extra care planned, and when it is next
 * reviewed. The app never decides a risk or a level — she records her
 * doctor's words.
 */
export function RiskTab({ preg, store }: { preg: Pregnancy; store: PregStore }) {
  const [editing, setEditing] = useState<R | null | "new">(null);
  const all = mine(store, "pregrisk", preg);
  const open = all.filter((r) => r.data.status !== "Resolved");
  const resolved = all.filter((r) => r.data.status === "Resolved");
  const due = reviewsDue(store, preg);
  const level = riskLevel(store, preg);

  const row = (r: R) => {
    const d = r.data;
    const late = d.status !== "Resolved" && d.review_date && d.review_date <= today();
    return (
      <RecordRow key={r.id} icon="ShieldAlert" hue={d.level === "High" ? "pink" : "amber"} title={d.factor}
                 tags={<>
                   <Tag tone={LEVEL_TONE[d.level]}>{d.level === "Not told" ? "Level not given" : `${d.level} — as your doctor said`}</Tag>
                   <Tag tone={d.status === "Resolved" ? "green" : "muted"}>{d.status}</Tag>
                   {late && <Tag tone="amber">Review due</Tag>}
                 </>}
                 sub={`Noted ${fmtShort(r.date)}${d.review_date ? ` · review ${fmtShort(d.review_date)}` : ""}`}
                 actions={<RowActions label={d.factor} onEdit={() => setEditing(r)} onDelete={() => store.remove(r.id, "Removed")} />}>
        <div className="flex flex-col gap-1.5">
          {d.detail && <p>{d.detail}</p>}
          {d.referral && <p><span style={{ color: "var(--ux-muted)" }}>Referred to:</span> {d.referral}</p>}
          {d.plan && <p><span style={{ color: "var(--ux-muted)" }}>Extra care:</span> {d.plan}</p>}
          {d.status !== "Resolved" && (
            <div className="flex flex-wrap gap-2">
              {d.status === "Being watched" && <Btn size="sm" variant="soft" onClick={() => store.edit(r.id, { data: { status: "Under review" } }, "Marked under review")}>Mark under review</Btn>}
              <Btn size="sm" variant="outline" icon="Check" onClick={() => store.edit(r.id, { data: { status: "Resolved" } }, "Marked resolved")}>My doctor says it is resolved</Btn>
            </div>
          )}
        </div>
      </RecordRow>
    );
  };

  return (
    <>
      {editing && <RiskFlow preg={preg} store={store} risk={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <div className="grid items-start gap-[var(--dashboard-gap,20px)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {due.length > 0 && (
            <section className="ux-card flex items-start gap-3 p-4" style={{ background: HUE.amber.tint }} data-risk-due>
              <I name="CalendarClock" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: HUE.amber.ink }} />
              <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
                Review due for <b>{due.map((r) => r.data.factor).join(", ")}</b>. Ask your doctor at your next check-up, or book one.
              </p>
            </section>
          )}
          <Panel title="What your doctor is watching" sub={open.length ? `${open.length} open` : "Nothing recorded"}
                 action={<Btn size="sm" icon="Plus" onClick={() => setEditing("new")}>Add</Btn>}>
            {open.length ? <ul className="flex flex-col" data-risks>{open.map(row)}</ul> : (
              <Empty icon="ShieldCheck" title="Nothing recorded"
                     body="If your doctor says your pregnancy needs extra care — high blood pressure, sugar, anaemia, twins — record it here with what they plan."
                     action={<Btn size="sm" icon="Plus" onClick={() => setEditing("new")}>Add</Btn>} />
            )}
          </Panel>
          {resolved.length > 0 && <Panel title="Resolved"><ul className="flex flex-col">{resolved.map(row)}</ul></Panel>}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Your doctor's assessment">
            {level ? (
              <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
                Highest level your doctor gave for an open item: <Tag tone={LEVEL_TONE[level]}>{level === "Not told" ? "Not given" : level}</Tag>
              </p>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No open items.</p>}
            <AskDoctor>Only your doctor can say whether your pregnancy is high-risk. This list keeps what they told you in one place.</AskDoctor>
          </Panel>
          <Btn variant="outline" icon="Stethoscope" href="/app/health/doctors?speciality=Gynaecologist">Talk to a gynaecologist</Btn>
        </div>
      </div>
    </>
  );
}

const LEVELS = ["Not told", "Low", "Moderate", "High"] as const;
const STATUSES = ["Being watched", "Under review", "Resolved"] as const;

/** What → level and status → referral and plan → check. */
function RiskFlow({ preg, store, risk, onClose }: { preg: Pregnancy; store: PregStore; risk: R | null; onClose: () => void }) {
  const t = today();
  const d0: Partial<KindData["pregrisk"]> = risk?.data ?? {};
  const [step, setStep] = useState(0);
  const [factor, setFactor] = useState(d0.factor ?? "");
  const [detail, setDetail] = useState(d0.detail ?? "");
  const [level, setLevel] = useState<KindData["pregrisk"]["level"]>(d0.level ?? "Not told");
  const [status, setStatus] = useState<KindData["pregrisk"]["status"]>(d0.status ?? "Being watched");
  const [referral, setReferral] = useState(d0.referral ?? "");
  const [plan, setPlan] = useState(d0.plan ?? "");
  const [review, setReview] = useState(d0.review_date ?? "");
  const [date, setDate] = useState(risk?.date ?? t);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const data: KindData["pregrisk"] = { preg: preg.id ?? "", factor: factor.trim(), detail: detail.trim(), level, status, referral: referral.trim(), plan: plan.trim(), review_date: review };
    const ok = risk ? await store.edit(risk.id, { date, data }, "Saved") : await store.add("pregrisk", data, date, "Added");
    setBusy(false);
    if (ok) onClose();
  };
  const steps: FlowStep[] = [
    { id: "what", title: "What is your doctor watching?", valid: !!factor.trim(),
      body: <>
        <Chips label="Common ones" hue="lilac" options={RISK_PRESETS} value={factor} onChange={setFactor} />
        <Field label="Or in your doctor's words" value={factor} onChange={setFactor} max={60} />
        <Field area label="Details (optional)" value={detail} onChange={setDetail} max={200} placeholder="What they told you" />
        <Field label="Noted on" type="date" value={date} onChange={setDate} maxDate={t} />
      </> },
    { id: "level", title: "Level and status", hint: "Pick the level your doctor gave. If they did not say, leave “Not told”.",
      body: <>
        <Chips label="Level" hue="lilac" options={LEVELS} value={level} onChange={(v) => setLevel(v)} />
        <Chips label="Status" hue="lilac" options={STATUSES} value={status} onChange={(v) => setStatus(v)} />
      </> },
    { id: "plan", title: "Referral and extra care", optional: true, valid: !!(referral.trim() || plan.trim() || review),
      body: <>
        <Field label="Referred to (optional)" value={referral} onChange={setReferral} placeholder="e.g. Physician, dietitian, higher centre" />
        <Field area label="Extra monitoring or care plan (optional)" value={plan} onChange={setPlan} max={200} placeholder="e.g. BP check every week" />
        <Field label="Next review (optional)" type="date" value={review} onChange={setReview} min={t} />
      </> },
    { id: "check", title: "Check, then save", valid: !!factor.trim(),
      body: <Review rows={[["What", factor.trim()], ["Details", detail.trim()], ["Level", level], ["Status", status],
                           ["Referred to", referral.trim()], ["Extra care", plan.trim()], ["Next review", review ? fmtShort(review) : ""]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="ShieldAlert" title={risk ? "Edit" : "Something your doctor is watching"} hue="lilac"
                    steps={steps} step={step} setStep={setStep} onSubmit={save} busy={busy} />;
}

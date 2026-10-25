"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { downloadCsv } from "@/components/ux/kit/download";
import { toast } from "@/components/ux/mobile/Toast";
import {
  Chips, Cols, Disclaimer, Empty, HUE, HealthFrame, I, Metric, MetricGrid, Panel, useEntries, useHealthSettings,
} from "@/components/ux/health/kit";
import { ConsultCard } from "@/components/ux/health/checklist";
import { ReminderSheet } from "@/components/ux/health/ReminderSheet";
import { useAppointments } from "@/components/ux/health/appointments";
import {
  BLOOD_GROUPS, MEAS, SCHEDULE_TIME, fmtTime, measOf, occDay, statusOf, timeOn, unitOf,
} from "@/components/ux/health/records-data";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  addDays, apiDeleteHealthFile, apiOpenHealthFile, fmtDay, nowHHMM, today, type Entry, type KindData,
} from "@/lib/health-api";
import { apiChecklist, apiSaveChecklist, type Checklist } from "@/lib/my-records-api";
import {
  AllergySheet, DocumentSheet, HistorySheet, Label, MedicineSheet, Private, ReadingSheet, Row, Trend, TrendChart, printSummary,
} from "./record-parts";

/**
 * Health Records — her readings, allergies, history, papers and medicines, in
 * one private place, and a summary she can print for a doctor.
 *
 * Everything is `health_entries` (routes/health_hub.py); papers are kept in the
 * private store (routes/health_files.py) and open only for her. Nothing here
 * is visible to anyone else. "Hide details on screen" blurs values for when
 * someone is looking over her shoulder.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "records", label: "Records" },
  { id: "reports", label: "Reports" },
  { id: "medicines", label: "Medicines" },
  { id: "consultation", label: "Consultation" },
];

type Sheet = null | "reading" | "allergy" | "history" | "document" | "medicine" | { reminder: Partial<KindData["reminder"]> };
const KINDS = ["measure", "allergy", "history", "document", "medication"] as const;

export default function RecordsPage() {
  const all = useEntries([...KINDS]);
  const reminders = useEntries("reminder");
  const { settings, save } = useHealthSettings();
  const { user } = useAuth();
  const [sheet, setSheet] = useState<Sheet>(null);

  const by = useMemo(() => ({
    readings: all.rows.filter((r) => r.kind === "measure") as Entry<"measure">[],
    allergies: all.rows.filter((r) => r.kind === "allergy") as Entry<"allergy">[],
    history: all.rows.filter((r) => r.kind === "history") as Entry<"history">[],
    docs: all.rows.filter((r) => r.kind === "document") as Entry<"document">[],
    meds: all.rows.filter((r) => r.kind === "medication") as Entry<"medication">[],
  }), [all.rows]);

  const hide = settings.privateMode;
  const close = () => setSheet(null);
  const add = <K extends (typeof KINDS)[number]>(kind: K, msg: string) => async (data: KindData[K], date: string) => {
    if (await all.add(kind, data, date, msg)) close();
  };
  const share = () => {
    const err = printSummary({ name: user?.full_name || "", settings, readings: by.readings, allergies: by.allergies, meds: by.meds, history: by.history, docs: by.docs });
    if (err) toast(err, { tone: "error" });
  };
  const csv = () => {
    const err = downloadCsv("my-health-readings.csv", [["Date", "Reading", "Value", "Unit"],
      ...[...by.readings].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.date, r.data.type, r.data.value, unitOf(r.data.type)])]);
    if (err) toast(err, { tone: "error" });
  };

  return (
    <HealthFrame active="/app/health/records" hue="blue" icon="FileHeart" eyebrow="Health Records" title="Health Records"
                 sub="Keep your health information safe and in one place. Only you can see it."
                 art="/ux/art/scene-woman-reading-document.webp" tabs={TABS}
                 actions={<>
                   <Btn icon="Plus" onClick={() => setSheet("reading")}>Add reading</Btn>
                   <Btn variant="outline" icon="FileText" onClick={() => setSheet("document")}>Add report</Btn>
                   <Btn variant="ghost" icon={hide ? "Eye" : "EyeOff"} onClick={() => save({ privateMode: !hide }, hide ? "Details shown" : "Details hidden on screen")}>
                     {hide ? "Show details" : "Hide details"}
                   </Btn>
                 </>}>
      {(tab) => (
        <>
          {all.error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{all.error}</p>}
          {tab === "overview" && <Overview by={by} hide={hide} reminders={reminders.rows} settings={settings} save={save} onSheet={setSheet} onShare={share} loading={all.loading} />}
          {tab === "records" && <RecordsTab by={by} hide={hide} remove={all.remove} onSheet={setSheet} />}
          {tab === "reports" && <Reports readings={by.readings} hide={hide} remove={all.remove} onAdd={() => setSheet("reading")} onCsv={csv} />}
          {tab === "medicines" && <Medicines meds={by.meds} hide={hide} edit={all.edit} remove={all.remove} onAdd={() => setSheet("medicine")}
                                             onRemind={(m) => setSheet({ reminder: { title: `Take ${m.data.name}`, category: "Medicine", repeat: "Every day", time: SCHEDULE_TIME[m.data.schedule || ""] || "09:00" } })} />}
          {tab === "consultation" && <Consultation docs={by.docs} hide={hide} onShare={share} />}

          {sheet === "reading" && <ReadingSheet onClose={close} onSave={add("measure", "Reading saved")} />}
          {sheet === "allergy" && <AllergySheet onClose={close} onSave={add("allergy", "Allergy saved")} />}
          {sheet === "history" && <HistorySheet onClose={close} onSave={add("history", "Saved to your history")} />}
          {sheet === "document" && <DocumentSheet onClose={close} onSave={add("document", "Report saved")} />}
          {sheet === "medicine" && <MedicineSheet onClose={close} onSave={add("medication", "Medicine added")} />}
          {sheet && typeof sheet === "object" && (
            <ReminderSheet open onClose={close} initial={{ data: sheet.reminder, date: today() }}
                           onSave={async (data, date) => { if (await reminders.add("reminder", data, date, "Reminder added")) close(); }} />
          )}
        </>
      )}
    </HealthFrame>
  );
}

type By = {
  readings: Entry<"measure">[]; allergies: Entry<"allergy">[]; history: Entry<"history">[];
  docs: Entry<"document">[]; meds: Entry<"medication">[];
};

/** Latest reading of each type, with the one before it for the trend. */
function latestByType(readings: Entry<"measure">[]) {
  const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const out = new Map<string, { now: Entry<"measure">; before?: Entry<"measure"> }>();
  for (const r of sorted) {
    const have = out.get(r.data.type);
    if (!have) out.set(r.data.type, { now: r });
    else if (!have.before) have.before = r;
  }
  return [...out.values()];
}

function Overview({ by, hide, reminders, settings, save, onSheet, onShare, loading }: {
  by: By; hide: boolean; reminders: Entry<"reminder">[];
  settings: ReturnType<typeof useHealthSettings>["settings"]; save: ReturnType<typeof useHealthSettings>["save"];
  onSheet: (s: Sheet) => void; onShare: () => void; loading: boolean;
}) {
  const latest = latestByType(by.readings);
  const taking = by.meds.filter((m) => m.data.status !== "Stopped");
  const t = today(), now = nowHHMM();
  const next = reminders.filter((r) => !r.data.cancelled && statusOf(r, t, now) !== "done")
    .sort((a, b) => `${occDay(a, t)}${timeOn(a, occDay(a, t))}`.localeCompare(`${occDay(b, t)}${timeOn(b, occDay(b, t))}`)).slice(0, 3);
  const takenToday = taking.filter((m) => (m.data.taken || []).includes(t)).length;

  return (
    <Cols
      main={
        <>
          <HealthCard settings={settings} save={save} hide={hide} />
          <MetricGrid>
            <Metric hue="blue" icon="Activity" label="Readings" value={by.readings.length} sub={latest.length ? `${latest.length} kinds` : "None yet"} />
            <Metric hue="green" icon="Pill" label="Medicines now" value={taking.length} sub={taking.length ? `${takenToday} of ${taking.length} taken today` : "None added"} />
            <Metric hue="pink" icon="ShieldAlert" label="Allergies" value={by.allergies.length} />
            <Metric hue="lilac" icon="FileText" label="Reports" value={by.docs.length} />
          </MetricGrid>
          <Panel title="Latest readings" action={<Btn size="sm" variant="soft" href="/app/health/records?tab=reports">All readings</Btn>}>
            {loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p> : latest.length ? (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }} data-latest>
                {latest.map(({ now: r, before }) => (
                  <div key={r.data.type} className="flex flex-col gap-1 rounded-[14px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
                    <span className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{r.data.type}</span>
                    <span className="text-[22px] font-extrabold tabular-nums leading-tight" style={{ color: "var(--ux-ink)" }}>
                      <Private on={hide}>{r.data.value}</Private> <small className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{unitOf(r.data.type)}</small>
                    </span>
                    <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.date)}</span>
                    {!hide && <Trend now={r.data.value} before={before?.data.value} />}
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="Activity" title="No readings yet" body="Add weight, blood pressure, blood sugar or haemoglobin — from a check-up, a pharmacy machine or at home."
                     action={<Btn size="sm" icon="Plus" onClick={() => onSheet("reading")}>Add a reading</Btn>} />
            )}
          </Panel>
          <Panel title="Health timeline" sub="Your readings, reports, medicines and history, newest first.">
            <Timeline by={by} hide={hide} />
          </Panel>
        </>
      }
      side={
        <>
          <Panel title="Medicines taking now" action={<Btn size="sm" variant="soft" href="/app/health/records?tab=medicines">Manage</Btn>}>
            {taking.length ? (
              <ul>{taking.map((m) => (
                <Row key={m.id} icon="Pill" hue="green" title={<Private on={hide}>{m.data.name}</Private>}
                     meta={<Private on={hide}>{[m.data.dose, m.data.schedule].filter(Boolean).join(" · ")}</Private>} />
              ))}</ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>None added.</p>}
          </Panel>
          <Panel title="Allergies" action={<Btn size="sm" variant="soft" href="/app/health/records?tab=records">Manage</Btn>}>
            {by.allergies.length ? (
              <div className="flex flex-wrap gap-2">
                {by.allergies.map((a) => (
                  <span key={a.id} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: HUE.pink.tint, color: "var(--ux-ink)" }}>
                    <Private on={hide}>{a.data.name} · {a.data.severity}</Private>
                  </span>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>None added.</p>}
          </Panel>
          <Panel title="Coming up" action={<Btn size="sm" variant="soft" href="/app/health/reminders">All</Btn>}>
            {next.length ? (
              <ul>{next.map((r) => {
                const d = occDay(r, t);
                return <Row key={r.id} icon="CalendarClock" hue="amber" title={r.data.title}
                            meta={`${d === t ? "Today" : fmtDay(d, { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(timeOn(r, d))}`} />;
              })}</ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No reminders. <Link className="font-bold underline" href="/app/health/reminders">Add one</Link></p>}
          </Panel>
          <Panel title="Share with a doctor" hue="blue" tint>
            <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>A one-page summary — allergies, medicines, latest readings, history. You choose when to print or save it.</p>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" icon="Printer" onClick={onShare}>Print or save as PDF</Btn>
              <Btn size="sm" variant="outline" href="/app/health/doctors">Book a doctor</Btn>
            </div>
          </Panel>
        </>
      }
    />
  );
}

function HealthCard({ settings, save, hide }: {
  settings: ReturnType<typeof useHealthSettings>["settings"]; save: ReturnType<typeof useHealthSettings>["save"]; hide: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [group, setGroup] = useState(settings.bloodGroup);
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : "");
  const [contact, setContact] = useState(settings.emergencyContact);
  // Settings arrive after the first paint, so the form is filled when she opens it.
  const toggle = () => {
    if (!editing) { setGroup(settings.bloodGroup); setHeight(settings.heightCm ? String(settings.heightCm) : ""); setContact(settings.emergencyContact); }
    setEditing((e) => !e);
  };
  const facts = [
    { icon: "Droplet", label: "Blood group", value: settings.bloodGroup || "Not added" },
    { icon: "Ruler", label: "Height", value: settings.heightCm ? `${settings.heightCm} cm` : "Not added" },
    { icon: "Phone", label: "Emergency contact", value: settings.emergencyContact || "Not added" },
  ];
  return (
    <Panel title="My health card" hue="blue" tint
           action={<Btn size="sm" variant={editing ? "ghost" : "soft"} icon={editing ? "X" : "Pencil"} onClick={toggle}>{editing ? "Close" : "Edit"}</Btn>}>
      {editing ? (
        <div className="flex flex-col gap-4" data-health-card-form>
          <div><Label>Blood group</Label><Chips label="Blood group" hue="blue" value={group} onChange={setGroup} options={BLOOD_GROUPS} /></div>
          <div><Label>Height (cm)</Label>
            <input value={height} inputMode="numeric" maxLength={3} aria-label="Height in centimetres" onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
                   className="min-h-[46px] w-[140px] rounded-[12px] border px-4 text-base font-bold tabular-nums"
                   style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </div>
          <div><Label>Emergency contact</Label><Text label="Emergency contact" value={contact} max={80} placeholder="Sister — 98xxxxxx10" onChange={setContact} /></div>
          <div>
            <Btn icon="Check" onClick={async () => {
              const h = Number(height) || 0;
              if (h && (h < 50 || h > 250)) { toast("Height should be between 50 and 250 cm.", { tone: "error" }); return; }
              if (await save({ bloodGroup: group, heightCm: h, emergencyContact: contact.trim() }, "Health card saved")) setEditing(false);
            }}>Save</Btn>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3" data-health-card>
          {facts.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-[14px] p-3" style={{ background: "var(--ux-surface)" }}>
              <I name={f.icon} className="h-5 w-5 shrink-0" style={{ color: HUE.blue.ink }} />
              <span className="min-w-0">
                <span className="block text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{f.label}</span>
                <b className="block truncate text-sm" style={{ color: f.value === "Not added" ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                  <Private on={hide && f.value !== "Not added"}>{f.value}</Private>
                </b>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Timeline({ by, hide }: { by: By; hide: boolean }) {
  const [more, setMore] = useState(false);
  const rows: { id: string; day: string; icon: string; title: string; meta: string; href: string }[] = [
    ...by.readings.map((r) => ({ id: r.id, day: r.date, icon: "Activity", title: `${r.data.type}: ${r.data.value} ${unitOf(r.data.type)}`, meta: "Reading", href: "?tab=reports" })),
    ...by.docs.map((d) => ({ id: d.id, day: d.date, icon: "FileText", title: d.data.title, meta: d.data.type, href: "?tab=records" })),
    ...by.meds.map((m) => ({ id: m.id, day: m.created_at.slice(0, 10), icon: "Pill", title: m.data.name, meta: `Medicine · ${m.data.status || "Taking now"}`, href: "?tab=medicines" })),
    ...by.history.map((h) => ({ id: h.id, day: h.created_at.slice(0, 10), icon: "ClipboardList", title: h.data.condition, meta: h.data.cat, href: "?tab=records" })),
    ...by.allergies.map((a) => ({ id: a.id, day: a.created_at.slice(0, 10), icon: "ShieldAlert", title: a.data.name, meta: `Allergy · ${a.data.severity}`, href: "?tab=records" })),
  ].sort((a, b) => b.day.localeCompare(a.day));
  if (!rows.length) return <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your readings, reports, medicines and history appear here in date order.</p>;
  const shown = more ? rows : rows.slice(0, 8);
  return (
    <>
      <ul data-timeline>
        {shown.map((r) => (
          <li key={r.id} className="grid grid-cols-[78px_minmax(0,1fr)_auto] items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
            <span className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.day, { day: "numeric", month: "short", year: "2-digit" })}</span>
            <span className="min-w-0">
              <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}><Private on={hide}>{r.title}</Private></b>
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{r.meta}</span>
            </span>
            <Link href={`/app/health/records${r.href}`} className="ux-press rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>Open</Link>
          </li>
        ))}
      </ul>
      {rows.length > 8 && <button type="button" className="self-start text-sm font-bold" style={{ color: "var(--ux-brand)" }} onClick={() => setMore((m) => !m)}>{more ? "Show less" : `Show all ${rows.length}`}</button>}
    </>
  );
}

function RecordsTab({ by, hide, remove, onSheet }: { by: By; hide: boolean; remove: (id: string, msg?: string) => Promise<void>; onSheet: (s: Sheet) => void }) {
  const [sub, setSub] = useState<"Allergies" | "Medical history" | "Documents">("Allergies");
  const [opening, setOpening] = useState("");
  const open = async (d: Entry<"document">) => {
    setOpening(d.id);
    try { await apiOpenHealthFile(d.data.file_id || ""); } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); } finally { setOpening(""); }
  };
  const delDoc = async (d: Entry<"document">) => {
    await remove(d.id, "Report deleted");
    if (d.data.file_id) apiDeleteHealthFile(d.data.file_id).catch(() => undefined);
  };
  return (
    <>
      <Chips label="Record type" hue="blue" value={sub} onChange={setSub} options={["Allergies", "Medical history", "Documents"] as const} />
      {sub === "Allergies" && (
        <Panel title="Allergies" sub="Tell every new doctor about these." action={<Btn size="sm" icon="Plus" onClick={() => onSheet("allergy")}>Add</Btn>}>
          {by.allergies.length ? (
            <ul data-list="allergies">{by.allergies.map((a) => (
              <Row key={a.id} icon="ShieldAlert" hue="pink" title={<Private on={hide}>{a.data.name}</Private>}
                   meta={[a.data.severity, a.data.reaction].filter(Boolean).join(" · ")}
                   actions={<Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${a.data.name}`} onClick={() => remove(a.id, "Allergy deleted")}>Delete</Btn>} />
            ))}</ul>
          ) : <Empty icon="ShieldAlert" title="No allergies added" body="Medicines, foods, dust — anything a doctor should know before prescribing." />}
        </Panel>
      )}
      {sub === "Medical history" && (
        <Panel title="Medical history" sub="Past conditions, surgeries, vaccinations and family history." action={<Btn size="sm" icon="Plus" onClick={() => onSheet("history")}>Add</Btn>}>
          {by.history.length ? (
            <ul data-list="history">{by.history.map((h) => (
              <Row key={h.id} icon="ClipboardList" title={<Private on={hide}>{h.data.condition}</Private>}
                   meta={[h.data.cat, h.data.since ? `Year ${h.data.since}` : ""].filter(Boolean).join(" · ")}
                   actions={<Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${h.data.condition}`} onClick={() => remove(h.id, "Deleted")}>Delete</Btn>} />
            ))}</ul>
          ) : <Empty icon="ClipboardList" title="Nothing here yet" body="A thyroid diagnosis, a C-section, your mother's diabetes — the things doctors always ask." />}
        </Panel>
      )}
      {sub === "Documents" && (
        <Panel title="Reports and papers" sub="Lab reports, prescriptions, scans. Kept privately — only you can open them."
               action={<Btn size="sm" icon="Plus" onClick={() => onSheet("document")}>Add</Btn>}>
          {by.docs.length ? (
            <ul data-list="documents">{by.docs.map((d) => (
              <Row key={d.id} icon={d.data.type === "Prescription" ? "Pill" : "FileText"} hue="lilac" title={<Private on={hide}>{d.data.title}</Private>}
                   meta={[d.data.type, fmtDay(d.date, { day: "numeric", month: "short", year: "numeric" }), d.data.provider, d.data.shareable ? "Can share" : ""].filter(Boolean).join(" · ")}
                   actions={<>
                     {d.data.file_id && <Btn size="sm" variant="soft" icon="Eye" loading={opening === d.id} onClick={() => open(d)}>Open</Btn>}
                     <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${d.data.title}`} onClick={() => delDoc(d)}>Delete</Btn>
                   </>} />
            ))}</ul>
          ) : <Empty icon="FileText" title="No reports yet" body="Take a photo of a report or prescription, or add the PDF from the lab." />}
        </Panel>
      )}
    </>
  );
}

function Reports({ readings, hide, remove, onAdd, onCsv }: {
  readings: Entry<"measure">[]; hide: boolean; remove: (id: string, msg?: string) => Promise<void>; onAdd: () => void; onCsv: () => void;
}) {
  const types = MEAS.map((m) => m.type).filter((t) => readings.some((r) => r.data.type === t));
  const [type, setType] = useState(types[0] || "");
  const active = types.includes(type) ? type : types[0] || "";
  const list = readings.filter((r) => !active || r.data.type === active).sort((a, b) => b.date.localeCompare(a.date));
  if (!readings.length) {
    return (
      <Panel>
        <Empty icon="Activity" title="No readings yet" body="Weight, blood pressure, sugar, haemoglobin — add them as you get them, and see how they move over time."
               action={<Btn size="sm" icon="Plus" onClick={onAdd}>Add a reading</Btn>} />
      </Panel>
    );
  }
  return (
    <Cols
      main={
        <>
          <Panel title="Trends" action={<Btn size="sm" icon="Plus" onClick={onAdd}>Add reading</Btn>}>
            <Chips label="Reading type" hue="blue" value={active} onChange={setType} options={types} />
            <div className={hide ? "select-none blur-[6px]" : undefined}><TrendChart rows={readings} type={active} /></div>
            <Disclaimer>{measOf(active)?.range} These readings are for your own tracking — ask your doctor what your numbers mean for you.</Disclaimer>
          </Panel>
          <Panel title={`${active} readings`} sub={`${list.length} in all`}>
            <ul data-list="readings">{list.map((r) => (
              <Row key={r.id} icon="Activity" title={<><Private on={hide}>{r.data.value}</Private> {unitOf(r.data.type)}</>}
                   meta={fmtDay(r.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                   actions={<Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete reading of ${r.data.value}`} onClick={() => remove(r.id, "Reading deleted")}>Delete</Btn>} />
            ))}</ul>
          </Panel>
        </>
      }
      side={
        <Panel title="Take it with you">
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Every reading as a spreadsheet, for a doctor or for yourself.</p>
          <Btn size="sm" variant="outline" icon="Download" onClick={onCsv}>Download readings</Btn>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
            Low haemoglobin? A free test and iron tablets are available at government centres. <Link className="font-bold underline" href="/app/health/strength">Staying strong</Link>
          </p>
        </Panel>
      }
    />
  );
}

function Medicines({ meds, hide, edit, remove, onAdd, onRemind }: {
  meds: Entry<"medication">[]; hide: boolean;
  edit: (id: string, patch: { data?: Partial<KindData["medication"]> }, msg?: string) => Promise<unknown>;
  remove: (id: string, msg?: string) => Promise<void>; onAdd: () => void; onRemind: (m: Entry<"medication">) => void;
}) {
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, -i));
  const taking = meds.filter((m) => m.data.status !== "Stopped");
  const stopped = meds.filter((m) => m.data.status === "Stopped");
  const adherence = (m: Entry<"medication">) => Math.round((week.filter((d) => (m.data.taken || []).includes(d)).length / 7) * 100);
  const tick = (m: Entry<"medication">) => {
    const set = new Set(m.data.taken || []);
    const had = set.has(t);
    if (had) set.delete(t); else set.add(t);
    edit(m.id, { data: { taken: [...set].sort().slice(-120) } }, had ? "Unticked" : `${m.data.name} — taken today`);
  };
  return (
    <Cols
      main={
        <Panel title="Taking now" sub="Tick when you have taken today's dose." action={<Btn size="sm" icon="Plus" onClick={onAdd}>Add</Btn>}>
          {taking.length ? (
            <ul data-list="medicines">{taking.map((m) => {
              const done = (m.data.taken || []).includes(t);
              return (
                <Row key={m.id} icon="Pill" hue="green" title={<Private on={hide}>{m.data.name}</Private>}
                     meta={<Private on={hide}>{[m.data.dose, m.data.schedule, m.data.reason].filter(Boolean).join(" · ")}</Private>}>
                  <div className="flex flex-wrap items-center gap-2 ps-[52px]">
                    <Btn size="sm" variant={done ? "outline" : "primary"} icon={done ? "Undo2" : "Check"} onClick={() => tick(m)}>{done ? "Taken today" : "Mark taken"}</Btn>
                    <Btn size="sm" variant="soft" icon="Bell" onClick={() => onRemind(m)}>Remind me</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => edit(m.id, { data: { status: "Stopped" } }, "Marked as stopped")}>Mark stopped</Btn>
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{adherence(m)}% of the last 7 days</span>
                  </div>
                </Row>
              );
            })}</ul>
          ) : <Empty icon="Pill" title="No medicines added" body="Add what you take, and tick it each day. A reminder can nudge you at the right time." action={<Btn size="sm" icon="Plus" onClick={onAdd}>Add a medicine</Btn>} />}
        </Panel>
      }
      side={
        <>
          <Disclaimer>The app keeps your medicine list organised. It never prescribes or changes doses — follow your doctor.</Disclaimer>
          {stopped.length > 0 && (
            <Panel title="Stopped">
              <ul>{stopped.map((m) => (
                <Row key={m.id} icon="Pill" hue="green" title={<Private on={hide}>{m.data.name}</Private>} meta={m.data.dose}
                     actions={<>
                       <Btn size="sm" variant="soft" onClick={() => edit(m.id, { data: { status: "Taking now" } }, "Back on your list")}>Taking again</Btn>
                       <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${m.data.name}`} onClick={() => remove(m.id, "Medicine deleted")}>Delete</Btn>
                     </>} />
              ))}</ul>
            </Panel>
          )}
        </>
      }
    />
  );
}

const ASK_PRESETS = ["When it started, and how often", "What makes it better or worse", "The medicines I take", "Questions about my report", "Side effects I noticed", "Is it safe in pregnancy?"];

function Consultation({ docs, hide, onShare }: { docs: Entry<"document">[]; hide: boolean; onShare: () => void }) {
  const [list, setList] = useState<Checklist | null>(null);
  const [draft, setDraft] = useState("");
  const appts = useAppointments();
  useEffect(() => {
    const ctl = new AbortController();
    apiChecklist("doctor", ctl.signal).then(setList).catch(() => setList({ key: "doctor", items: [], done: [], updated_at: "" }));
    return () => ctl.abort();
  }, []);
  const write = useCallback(async (items: string[], done: string[]) => {
    try { setList(await apiSaveChecklist("doctor", { items, done })); } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  }, []);
  const items = list?.items ?? [];
  const done = list?.done ?? [];
  const addItem = (text: string) => {
    const t = text.trim();
    if (!t || items.includes(t)) return;
    if (items.length >= 12) { toast("That is a full list — tick or remove one first.", { tone: "error" }); return; }
    write([...items, t], done); setDraft("");
  };
  const shareable = docs.filter((d) => d.data.shareable);
  const upcoming = appts.items.filter((a) => a.kind === "doctor" && (a.status === "requested" || a.status === "confirmed"));
  return (
    <Cols
      main={
        <>
          <Panel title="What to tell the doctor" sub="Write it before you go — it is easy to forget in the room.">
            {items.length ? (
              <ul data-list="ask">{items.map((it) => {
                const on = done.includes(it);
                return (
                  <li key={it} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                    <button type="button" role="checkbox" aria-checked={on} aria-label={it} onClick={() => write(items, on ? done.filter((x) => x !== it) : [...done, it])}
                            className="ux-press grid h-7 w-7 shrink-0 place-items-center rounded-full border-2"
                            style={{ borderColor: on ? "var(--ux-green-ink)" : "var(--ux-line-strong)", background: on ? "var(--ux-green-ink)" : "transparent", color: "var(--ux-surface)" }}>
                      {on && <I name="Check" className="h-4 w-4" />}
                    </button>
                    <span className="min-w-0 flex-1 text-sm font-semibold" style={{ color: on ? "var(--ux-muted)" : "var(--ux-ink)", textDecoration: on ? "line-through" : undefined }}>{it}</span>
                    <Btn size="sm" variant="ghost" icon="X" ariaLabel={`Remove ${it}`} onClick={() => write(items.filter((x) => x !== it), done.filter((x) => x !== it))}>{""}</Btn>
                  </li>
                );
              })}</ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing yet. Tap a suggestion or write your own.</p>}
            <div className="flex flex-wrap gap-2">
              {ASK_PRESETS.filter((p) => !items.includes(p)).map((p) => (
                <button key={p} type="button" onClick={() => addItem(p)} className="ux-press min-h-[38px] rounded-full border-[1.5px] px-3 text-[13px] font-bold"
                        style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink-2)", background: "var(--ux-surface)" }}>+ {p}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Text label="Something else to ask" value={draft} max={120} placeholder="Something else to ask" onChange={setDraft} />
              <Btn icon="Plus" disabled={!draft.trim()} onClick={() => addItem(draft)}>Add</Btn>
            </div>
          </Panel>
          <Panel title="Papers you may show" sub="Marked “I may want to show this” when you saved them.">
            {shareable.length ? (
              <ul>{shareable.map((d) => <Row key={d.id} icon="FileText" hue="lilac" title={<Private on={hide}>{d.data.title}</Private>} meta={[d.data.type, fmtDay(d.date)].join(" · ")} />)}</ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>None marked yet.</p>}
            <div><Btn size="sm" icon="Printer" onClick={onShare}>Print my health summary</Btn></div>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Nothing is sent to anyone. You decide what to print and who sees it.</p>
          </Panel>
        </>
      }
      side={
        <>
          {upcoming.length > 0 && (
            <Panel title="Your consultations">
              <ul>{upcoming.map((a) => <Row key={a.id} icon="Stethoscope" hue="green" title={a.title} meta={[a.day ? fmtDay(a.day) : a.when, a.time ? fmtTime(a.time) : "", a.sub].filter(Boolean).join(" · ")} />)}</ul>
            </Panel>
          )}
          <ConsultCard icon="Stethoscope" hue="green" title="Talk to a doctor" body="Book a consultation, online or at a clinic." href="/app/health/doctors" cta="Find a doctor" />
          <ConsultCard icon="Users" hue="orange" title="Talk to a mentor" body="A woman who has been through it, for the questions that are not medical." href="/app/health/mentors" cta="Find a mentor" />
        </>
      }
    />
  );
}

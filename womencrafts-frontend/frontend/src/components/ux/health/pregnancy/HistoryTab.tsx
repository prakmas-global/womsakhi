"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { Chips, Cols, Empty, HUE, I, Panel } from "@/components/ux/health/kit";
import { pregInfo } from "@/components/ux/health/pregnancy-data";
import { apiErrorMessage } from "@/lib/api";
import { apiOpenHealthFile, fmtDay, today, type Entry, type HealthSettings, type Pregnancy } from "@/lib/health-api";
import { printSummary } from "./BirthTab";
import { pregRef } from "./DetailsTab";
import { AskDoctor, Tag, fmtShort, long, mine, weeksAt, type PregStore } from "./parts";

type Ev = { date: string; icon: string; hue: keyof typeof HUE; title: string; sub?: string; kind: "care" | "tests" | "birth" | "dates" };

const FILTERS = [
  { value: "all", label: "Everything" }, { value: "care", label: "Check-ups" }, { value: "tests", label: "Tests & risks" },
  { value: "dates", label: "Dates" }, { value: "birth", label: "Birth & after" },
] as const;

/** Every dated event of this pregnancy, newest first. */
function timeline(preg: Pregnancy, store: PregStore): Ev[] {
  const info = pregInfo(preg)!;
  const ev: Ev[] = [{ date: info.lmp, icon: "CalendarHeart", hue: "lilac", title: "Pregnancy began (first day of last period)", kind: "dates" }];
  if (preg.confirmedOn) ev.push({ date: preg.confirmedOn, icon: "BadgeCheck", hue: "lilac", title: "Pregnancy confirmed", sub: preg.confirmMethod, kind: "dates" });
  for (const d of preg.dating ?? []) ev.push({ date: d.on, icon: "CalendarCheck", hue: "lilac", title: `Due date set to ${fmtShort(d.edd)}`, sub: `${d.method}${d.note ? ` · ${d.note}` : ""}`, kind: "dates" });
  for (const v of mine(store, "anc", preg)) {
    ev.push(v.data.status === "Missed"
      ? { date: v.date, icon: "CalendarX", hue: "amber", title: "Check-up missed", sub: v.data.where, kind: "care" }
      : { date: v.date, icon: "Stethoscope", hue: "lilac", title: "Antenatal check-up", kind: "care",
          sub: [v.data.where, v.data.bp && `BP ${v.data.bp}`, v.data.weight && `${v.data.weight} kg`, v.data.fhr && `heart ${v.data.fhr}/min`].filter(Boolean).join(" · ") });
  }
  for (const t of mine(store, "pregtest", preg)) ev.push({ date: t.date, icon: t.data.group === "Scan" ? "ScanLine" : "FlaskConical", hue: "blue", kind: "tests",
                                                            title: `${t.data.name} — ${t.data.status.toLowerCase()}`, sub: t.data.result ? `${t.data.result}${t.data.unit ? ` ${t.data.unit}` : ""}` : undefined });
  for (const r of mine(store, "pregrisk", preg)) ev.push({ date: r.date, icon: "ShieldAlert", hue: "amber", kind: "tests", title: `Doctor is watching: ${r.data.factor}`,
                                                            sub: [r.data.level !== "Not told" ? r.data.level : "", r.data.status].filter(Boolean).join(" · ") });
  for (const d of mine(store, "delivery", preg)) ev.push({ date: d.date, icon: "Baby", hue: "pink", kind: "birth", title: `Birth — ${d.data.mode.toLowerCase()}`,
                                                            sub: `${d.data.babies.length} ${d.data.babies.length === 1 ? "baby" : "babies"}${d.data.place ? ` · ${d.data.place}` : ""}` });
  for (const c of mine(store, "postnatal", preg)) ev.push({ date: c.date, icon: "HeartPulse", hue: "pink", kind: "birth", title: `${c.data.check} — ${c.data.who === "Mother" ? "you" : c.data.baby || "baby"}`, sub: c.data.findings });
  const t = today();
  return ev.filter((x) => x.date && x.date <= t).sort((a, b) => b.date.localeCompare(a.date));
}

const DOC_TYPES = ["Scan report", "Lab report", "Discharge summary", "Prescription"];

/**
 * Pregnancy → History: one timeline of everything in this pregnancy, the
 * papers she kept for it, her earlier pregnancies she closed, and the
 * summary to print.
 */
export function HistoryTab({ preg, store, settings }: { preg: Pregnancy; store: PregStore; settings: HealthSettings }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const events = timeline(preg, store).filter((e) => filter === "all" || e.kind === filter);
  const docs = (store.rows.filter((r) => r.kind === "document") as Entry<"document">[])
    .filter((d) => DOC_TYPES.includes(d.data.type) && d.date >= pregInfo(preg)!.lmp).sort((a, b) => b.date.localeCompare(a.date));
  const past = (store.rows.filter((r) => r.kind === "pregepisode") as Entry<"pregepisode">[]).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Cols
      main={
        <Panel title="Timeline" sub={`${pregRef(preg)} · everything in this pregnancy, newest first`}
               action={<Btn size="sm" variant="outline" icon="Printer" onClick={() => { const err = printSummary(preg, settings, store); if (err) toast(err, { tone: "error" }); }}>Print summary</Btn>}>
          <Chips label="Show" hue="lilac" options={FILTERS} value={filter} onChange={(v) => setFilter(v as typeof filter)} />
          {events.length ? (
            <ol className="relative flex flex-col gap-0 ps-6" data-timeline>
              <span aria-hidden className="absolute bottom-2 start-[11px] top-2 w-[2px] rounded-full" style={{ background: "var(--ux-line)" }} />
              {events.map((e, i) => (
                <li key={i} className="relative flex items-start gap-3 py-2.5">
                  <span className="absolute -start-6 top-3 grid h-6 w-6 place-items-center rounded-full" style={{ background: HUE[e.hue].tint, color: HUE[e.hue].ink }}>
                    <I name={e.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="w-[92px] shrink-0 text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>
                    {fmtDay(e.date, { day: "numeric", month: "short", year: "2-digit" })}<br /><span className="font-semibold">{weeksAt(preg, e.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{e.title}</b>
                    {e.sub && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{e.sub}</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing here yet.</p>}
        </Panel>
      }
      side={
        <>
          <Panel title="Pregnancy papers" sub="Scan and lab reports, discharge summaries"
                 action={<Btn size="sm" variant="outline" icon="Plus" href="/app/health/records?tab=records">Add</Btn>}>
            {docs.length ? (
              <ul className="flex flex-col gap-2.5">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.blue.tint, color: HUE.blue.ink }}><I name="FileText" className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{d.data.title}</b>
                      <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{d.data.type} · {fmtShort(d.date)}</span>
                    </span>
                    {d.data.file_id && (
                      <Btn size="sm" variant="outline" onClick={() => void apiOpenHealthFile(d.data.file_id!).catch((err) => toast(apiErrorMessage(err), { tone: "error" }))}>Open</Btn>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Papers you keep in Health Records from this pregnancy show here. Test reports you attach are in Tests &amp; scans.</p>}
          </Panel>
          <Panel title="Earlier pregnancies" sub="Records you closed">
            {past.length ? (
              <ul className="flex flex-col gap-2.5">
                {past.map((p) => {
                  const i = pregInfo(p.data.pregnancy);
                  return (
                    <li key={p.id} className="flex flex-col gap-0.5 rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{pregRef(p.data.pregnancy) || "Pregnancy"}</b>
                        <Tag>Closed {fmtShort(p.data.closed_on)}</Tag>
                      </span>
                      <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                        {i ? `Due ${fmtDay(i.due, long)} · ` : ""}{p.data.outcome}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty icon="Archive" title="None yet" body="When you close a pregnancy record it is kept here." />}
          </Panel>
          <AskDoctor />
        </>
      }
    />
  );
}

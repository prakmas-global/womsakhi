"use client";

import { useEffect, useMemo, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Chips, Cols, Empty, HealthFrame, I, Panel, useEntries, useHealthSettings } from "@/components/ux/health/kit";
import { ReminderSheet } from "@/components/ux/health/ReminderSheet";
import { FormLauncher } from "@/components/ux/health/StepFlow";
import { useAppointments, type Appointment } from "@/components/ux/health/appointments";
import {
  LEADS, QUICK_REMINDERS, REM_CATS, fmtTime, isDoneOn, occDay, occursOn, statusOf, timeOn,
} from "@/components/ux/health/records-data";
import { fmtDay, nowHHMM, today as todayYmd, type Entry, type KindData } from "@/lib/health-api";
import { ApptRow, MonthGrid, ReminderRow, fmtIN } from "./reminder-parts";
import { illSrc } from "@/components/ux/health/art";

/**
 * Appointments & Reminders — her own reminders beside the sessions she booked.
 *
 * Reminders are `health_entries` (kind "reminder"); the server turns each into
 * a Reminder Engine rule, so it reaches her bell on time with her quiet hours
 * respected (app/engines/health_reminders.py). Doctor consultations and mentor
 * sessions are read from their own modules and shown in the same timeline.
 */

type Rem = Entry<"reminder">;
type SheetState = { entry?: Rem; date?: string; data?: Partial<KindData["reminder"]> } | null;

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "calendar", label: "Calendar" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
  { id: "settings", label: "Settings" },
];

/** The clock, a minute at a time — "due now" moves without a reload. */
function useNow() {
  const [now, setNow] = useState({ day: todayYmd(), time: nowHHMM() });
  useEffect(() => {
    const t = window.setInterval(() => setNow({ day: todayYmd(), time: nowHHMM() }), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export default function RemindersPage() {
  const rem = useEntries("reminder");
  const { settings, save } = useHealthSettings();
  const appts = useAppointments();
  const now = useNow();
  const [sheet, setSheet] = useState<SheetState>(null);

  const saveRem = async (data: KindData["reminder"], date: string, id?: string) => {
    const ok = id ? await rem.edit(id, { data, date }, "Reminder saved") : await rem.add("reminder", data, date, "Reminder added");
    if (ok) setSheet(null);
  };
  const actions = {
    onDone: (r: Rem, day: string, done: boolean) => {
      const list = new Set(r.data.done || []);
      if (done) list.add(day); else list.delete(day);
      rem.edit(r.id, { data: { done: [...list].sort().slice(-200), snooze: "" } }, done ? "Marked done" : "Marked not done");
    },
    onSnooze: (r: Rem, _day: string, to: string) => rem.edit(r.id, { data: { snooze: to } }, `Snoozed to ${to.slice(11)}`),
    onEdit: (r: Rem) => setSheet({ entry: r }),
    onCancel: (r: Rem) => rem.edit(r.id, { data: { cancelled: !r.data.cancelled } }, r.data.cancelled ? "Reminder restored" : "Reminder cancelled"),
    onDelete: (r: Rem) => rem.remove(r.id, "Reminder deleted"),
  };

  return (
    <HealthFrame active="/app/health/reminders" hue="magenta" icon="CalendarClock" eyebrow="Appointments & Reminders"
                 title="Appointments & Reminders" sub="Stay on track with check-ups, medicines and daily habits."
                 art={illSrc("hero-reminders")} tabs={TABS}
                 actions={<>
                   <Btn icon="Plus" onClick={() => setSheet({})}>Add reminder</Btn>
                   <Btn variant="outline" icon="Stethoscope" href="/app/health/doctors">Book a consultation</Btn>
                 </>}>
      {(tab) => (
        <>
          <DueNow rows={rem.rows} now={now} lead={settings.reminderLead} {...actions} />
          {tab === "upcoming" && <Upcoming rows={rem.rows} appts={appts.items} loading={rem.loading} now={now} actions={actions}
                                           onAdd={(data) => setSheet(data ? { data } : {})} />}
          {tab === "calendar" && <CalendarTab rows={rem.rows} appts={appts.items} now={now} actions={actions}
                                              onAdd={(date) => setSheet({ date })} />}
          {tab === "completed" && <Completed rows={rem.rows} appts={appts.items} now={now} actions={actions} />}
          {tab === "all" && <AllTab rows={rem.rows} now={now} actions={actions} onAdd={() => setSheet({})} />}
          {tab === "settings" && <SettingsTab lead={settings.reminderLead} onLead={(v) => save({ reminderLead: v }, "Saved")} />}
          {sheet && <ReminderSheet key={sheet.entry?.id || sheet.date || "new"} open onClose={() => setSheet(null)} initial={sheet} onSave={saveRem} />}
        </>
      )}
    </HealthFrame>
  );
}

type Actions = {
  onDone: (r: Rem, day: string, done: boolean) => void;
  onSnooze: (r: Rem, day: string, to: string) => void;
  onEdit: (r: Rem) => void;
  onCancel: (r: Rem) => void;
  onDelete: (r: Rem) => void;
};
type Now = { day: string; time: string };

/** What is due in the next `lead` minutes (or overdue today) — the in-app alert. */
function DueNow({ rows, now, lead, onDone, onSnooze }: { rows: Rem[]; now: Now; lead: number } & Pick<Actions, "onDone" | "onSnooze">) {
  const [h, m] = now.time.split(":").map(Number);
  const until = h * 60 + m + Math.max(lead, 5);
  const due = rows.filter((r) => {
    if (r.data.cancelled || !occursOn(r, now.day) || isDoneOn(r, now.day)) return false;
    const t = timeOn(r, now.day);
    const mins = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    return mins <= until && mins >= h * 60 + m - 120;
  });
  if (!due.length) return null;
  return (
    <section role="status" className="flex flex-col gap-2 rounded-[16px] border-[1.5px] p-4" data-due-now
             style={{ borderColor: "var(--ux-amber-ink)", background: "var(--ux-tint-amber)" }}>
      <p className="flex items-center gap-2 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-amber-ink)" }}>
        <I name="AlarmClock" className="h-4 w-4" /> Due now
      </p>
      {due.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{r.data.title} · {fmtTime(timeOn(r, now.day))}</b>
          <span className="flex gap-2">
            <Btn size="sm" icon="Check" onClick={() => onDone(r, now.day, true)}>Done</Btn>
            <Btn size="sm" variant="outline" onClick={() => {
              const t = Math.min(23 * 60 + 59, h * 60 + m + 10);
              onSnooze(r, now.day, `${now.day}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
            }}>In 10 min</Btn>
          </span>
        </div>
      ))}
    </section>
  );
}

function Upcoming({ rows, appts, loading, now, actions, onAdd }: {
  rows: Rem[]; appts: Appointment[]; loading: boolean; now: Now; actions: Actions;
  onAdd: (data?: Partial<KindData["reminder"]>) => void;
}) {
  const [filter, setFilter] = useState("All");
  const used = [
    ...REM_CATS.filter((c) => rows.some((r) => !r.data.cancelled && r.data.category === c)),
    ...(appts.some((a) => a.status === "requested" || a.status === "confirmed") ? ["Consultations"] : []),
  ];
  const live = rows.filter((r) => !r.data.cancelled && (filter === "All" || r.data.category === filter) && filter !== "Consultations");
  const sorted = [...live].sort((a, b) => `${occDay(a, now.day)}T${timeOn(a, occDay(a, now.day))}`.localeCompare(`${occDay(b, now.day)}T${timeOn(b, occDay(b, now.day))}`));
  const groups: [string, Rem[]][] = [
    ["Overdue", sorted.filter((r) => statusOf(r, now.day, now.time) === "overdue")],
    ["Due today", sorted.filter((r) => statusOf(r, now.day, now.time) === "today")],
    ["Upcoming", sorted.filter((r) => statusOf(r, now.day, now.time) === "upcoming")],
  ];
  const booked = (filter === "All" || filter === "Consultations")
    ? appts.filter((a) => a.status === "requested" || a.status === "confirmed")
        .sort((a, b) => (a.day || "9999").localeCompare(b.day || "9999"))
    : [];
  const anything = groups.some((g) => g[1].length) || booked.length;

  return (
    <Cols
      main={
        <Panel title="Your reminders" sub="Overdue first, then today, then what is coming.">
          {/* Only the types she uses — eleven chips on a phone is a wall. */}
          {used.length > 1 && <Chips label="Filter by type" hue="magenta" value={filter} onChange={setFilter} options={["All", ...used]} />}
          {loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading your reminders…</p> : !anything ? (
            <Empty icon="Bell" title={filter === "All" ? "No reminders yet" : "Nothing in this type"}
                   body="Add one for a check-up, a medicine or a daily habit. It reaches your bell when it is due."
                   action={<Btn size="sm" icon="Plus" onClick={() => onAdd()}>Add a reminder</Btn>} />
          ) : (
            <div className="flex flex-col gap-4">
              {groups.filter((g) => g[1].length).map(([label, list]) => (
                <div key={label} data-group={label}>
                  <p className="text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: label === "Overdue" ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
                    {label} · {list.length}
                  </p>
                  {/* Done, later and change here; cancel and delete live in All. */}
                  <ul>{list.map((r) => <ReminderRow key={r.id} r={r} today={now.day} now={now.time} onDone={actions.onDone} onSnooze={actions.onSnooze} onEdit={actions.onEdit} />)}</ul>
                </div>
              ))}
              {booked.length > 0 && (
                <div data-group="Consultations">
                  <p className="text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>
                    Consultations and mentor sessions · {booked.length}
                  </p>
                  <ul>{booked.map((a) => <ApptRow key={a.id} a={a} today={now.day} />)}</ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      }
      side={
        <>
          <FormLauncher art="Reminder" title="Add a reminder" sub="A check-up, a medicine or a habit · a few quick taps" steps={6} hue="magenta"
                        cta="Add" onStart={() => onAdd()} />
          <Panel title="Add in one tap" sub="Change the time later if you like.">
            <div className="flex flex-col gap-2">
              {QUICK_REMINDERS.map((q) => (
                <button key={q.label} type="button" onClick={() => onAdd(q.data)}
                        className="ux-press flex min-h-[48px] items-center gap-3 rounded-[12px] border px-3 text-start text-sm font-bold"
                        style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
                  <I name="Plus" className="h-4 w-4" style={{ color: "var(--ux-amber-ink)" }} /> {q.label}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Need a doctor?" hue="green" tint>
            <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>Book a consultation and it appears here with your reminders.</p>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" href="/app/health/doctors">Find a doctor</Btn>
              <Btn size="sm" variant="outline" href="/app/health/mentors">Talk to a mentor</Btn>
            </div>
          </Panel>
        </>
      }
    />
  );
}

function CalendarTab({ rows, appts, now, actions, onAdd }: { rows: Rem[]; appts: Appointment[]; now: Now; actions: Actions; onAdd: (date: string) => void }) {
  const [month, setMonth] = useState(now.day.slice(0, 7));
  const [sel, setSel] = useState(now.day);
  const live = rows.filter((r) => !r.data.cancelled);
  const apptOn = (d: string) => appts.filter((a) => a.day === d && a.status !== "cancelled");
  const countOn = (d: string) => live.filter((r) => occursOn(r, d)).length + apptOn(d).length;
  const dayRows = live.filter((r) => occursOn(r, sel)).sort((a, b) => timeOn(a, sel).localeCompare(timeOn(b, sel)));
  return (
    <Cols
      main={<Panel title="Calendar"><MonthGrid month={month} setMonth={setMonth} selected={sel} onSelect={setSel} countOn={countOn} today={now.day} /></Panel>}
      side={
        <Panel title={fmtIN(sel, { weekday: "long", day: "numeric", month: "long" })}
               action={sel >= now.day ? <Btn size="sm" variant="soft" icon="Plus" onClick={() => onAdd(sel)}>Add</Btn> : undefined}>
          {dayRows.length || apptOn(sel).length ? (
            <ul data-day-list>
              {dayRows.map((r) => (
                // On another day the row describes that day, not the next occurrence.
                <DayItem key={r.id} r={r} day={sel} now={now} onDone={actions.onDone} onEdit={actions.onEdit} />
              ))}
              {apptOn(sel).map((a) => <ApptRow key={a.id} a={a} today={now.day} />)}
            </ul>
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing on this day.</p>}
        </Panel>
      }
    />
  );
}

function DayItem({ r, day, now, onDone, onEdit }: { r: Rem; day: string; now: Now } & Pick<Actions, "onDone" | "onEdit">) {
  const done = isDoneOn(r, day);
  return (
    <li className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
        <I name="Bell" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm" style={{ color: "var(--ux-ink)", textDecoration: done ? "line-through" : undefined }}>{r.data.title}</b>
        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{[fmtTime(timeOn(r, day)), r.data.category, r.data.repeat !== "Once" ? r.data.repeat : ""].filter(Boolean).join(" · ")}</span>
      </span>
      {day <= now.day
        ? <Btn size="sm" variant={done ? "outline" : "soft"} onClick={() => onDone(r, day, !done)}>{done ? "Undo" : "Done"}</Btn>
        : <Btn size="sm" variant="ghost" icon="Pencil" ariaLabel={`Change ${r.data.title}`} onClick={() => onEdit(r)}>Change</Btn>}
    </li>
  );
}

function Completed({ rows, appts, now, actions }: { rows: Rem[]; appts: Appointment[]; now: Now; actions: Actions }) {
  // One line per occurrence she ticked, newest first.
  const done = useMemo(() => rows.flatMap((r) => (r.data.done || []).map((d) => ({ r, d })))
    .sort((a, b) => b.d.localeCompare(a.d)).slice(0, 120), [rows]);
  const past = appts.filter((a) => a.status === "completed");
  if (!done.length && !past.length) {
    return <Panel><Empty icon="CircleCheck" title="Nothing completed yet" body="Reminders you mark as done, and sessions you finish, appear here." /></Panel>;
  }
  return (
    <Panel title="Completed" sub={`${done.length} reminder${done.length === 1 ? "" : "s"} done${past.length ? `, ${past.length} session${past.length === 1 ? "" : "s"}` : ""}`}>
      <ul data-completed>
        {done.map(({ r, d }) => (
          <li key={`${r.id}-${d}`} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
              <I name="Check" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{r.data.title}</b>
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{[fmtDay(d, { weekday: "short", day: "numeric", month: "short" }), r.data.category].join(" · ")}</span>
            </span>
            <Btn size="sm" variant="ghost" onClick={() => actions.onDone(r, d, false)}>Undo</Btn>
          </li>
        ))}
        {past.map((a) => <ApptRow key={a.id} a={a} today={now.day} />)}
      </ul>
    </Panel>
  );
}

function AllTab({ rows, now, actions, onAdd }: { rows: Rem[]; now: Now; actions: Actions; onAdd: () => void }) {
  const [filter, setFilter] = useState("All");
  const shown = rows.filter((r) => filter === "All" || (filter === "Cancelled" ? r.data.cancelled : r.data.category === filter && !r.data.cancelled));
  return (
    <Panel title="All reminders" sub={`${rows.length} in all`} action={<Btn size="sm" variant="soft" icon="Plus" onClick={onAdd}>Add</Btn>}>
      <Chips label="Filter" hue="magenta" value={filter} onChange={setFilter}
             options={["All", ...REM_CATS.filter((c) => rows.some((r) => r.data.category === c)), ...(rows.some((r) => r.data.cancelled) ? ["Cancelled"] : [])]} />
      {shown.length ? (
        <ul>{shown.map((r) => <ReminderRow key={r.id} r={r} today={now.day} now={now.time} {...actions} />)}</ul>
      ) : <Empty icon="Bell" title="Nothing here" body="Reminders you add appear in this list." />}
    </Panel>
  );
}

function SettingsTab({ lead, onLead }: { lead: number; onLead: (v: number) => void }) {
  return (
    <Cols
      main={
        <Panel title="When to remind you" sub="Applies to every reminder you set here.">
          <Chips label="Alert timing" hue="magenta" value={String(lead)} onChange={(v) => onLead(Number(v))}
                 options={LEADS.map((l) => ({ value: String(l.value), label: l.label }))} />
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
            Reminders arrive in your bell. The message only says a reminder is due — never what it is about — so it is safe on a shared phone.
          </p>
        </Panel>
      }
      side={
        <Panel title="Quiet times and alerts">
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing reaches you during your quiet hours; it waits until they end.</p>
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" icon="Moon" href="/app/settings/quiet-hours">Quiet hours</Btn>
            <Btn size="sm" variant="outline" icon="Bell" href="/app/settings/notifications">What we tell you</Btn>
          </div>
        </Panel>
      }
    />
  );
}


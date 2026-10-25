"use client";

import { useState } from "react";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import { I } from "@/components/ux/health/kit";
import type { Appointment } from "@/components/ux/health/appointments";
import {
  REM_ICON, STATUS_LABEL, fmtTime, isDoneOn, occDay, repeatText, statusOf, timeOn, type RemStatus,
} from "@/components/ux/health/records-data";
import { addDays, fmtDay, type Entry } from "@/lib/health-api";

type Rem = Entry<"reminder">;

/** A fixed locale for anything drawn before the data arrives: the server and
 *  the browser must format a date the same way or React refuses to hydrate. */
export const fmtIN = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", opts);

const STATUS_STYLE: Record<RemStatus | "requested" | "confirmed" | "completed", { bg: string; fg: string }> = {
  overdue: { bg: "var(--ux-danger-tint)", fg: "var(--ux-danger-ink)" },
  today: { bg: "var(--ux-brand-tint)", fg: "var(--ux-brand)" },
  upcoming: { bg: "var(--ux-surface-2)", fg: "var(--ux-muted)" },
  done: { bg: "var(--ux-tint-green)", fg: "var(--ux-green-ink)" },
  cancelled: { bg: "var(--ux-surface-2)", fg: "var(--ux-muted)" },
  requested: { bg: "var(--ux-tint-blue)", fg: "var(--ux-blue-ink)" },
  confirmed: { bg: "var(--ux-tint-green)", fg: "var(--ux-green-ink)" },
  completed: { bg: "var(--ux-tint-green)", fg: "var(--ux-green-ink)" },
};

export function StatusPill({ status, label }: { status: keyof typeof STATUS_STYLE; label?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex shrink-0 items-center rounded-[6px] px-2 py-0.5 text-2xs font-extrabold"
          style={{ background: s.bg, color: s.fg }} data-status={status}>
      {label ?? (STATUS_LABEL as Record<string, string>)[status] ?? status}
    </span>
  );
}

/** One reminder, with the three things she does to it: done, later, change. */
export function ReminderRow({ r, today, now, onDone, onSnooze, onEdit, onCancel, onDelete, showDate = true }: {
  r: Rem; today: string; now: string;
  onDone: (r: Rem, day: string, done: boolean) => void;
  onSnooze: (r: Rem, day: string, to: string) => void;
  onEdit: (r: Rem) => void;
  onCancel?: (r: Rem) => void;
  onDelete?: (r: Rem) => void;
  showDate?: boolean;
}) {
  const [later, setLater] = useState(false);
  const day = occDay(r, today);
  const status = statusOf(r, today, now);
  const done = isDoneOn(r, day);
  const t = timeOn(r, day);
  const plus = (mins: number) => {
    const [h, m] = now.split(":").map(Number);
    const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
    return `${today}T${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }} data-reminder={r.id}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
          <I name={REM_ICON[r.data.category] || "Bell"} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="min-w-0 text-[15px] [overflow-wrap:anywhere]" style={{ color: "var(--ux-ink)", textDecoration: r.data.cancelled ? "line-through" : undefined }}>{r.data.title}</b>
            <StatusPill status={status} />
          </p>
          <p className="mt-0.5 text-xs [overflow-wrap:anywhere]" style={{ color: "var(--ux-muted)" }}>
            {[showDate ? (day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : fmtDay(day, { weekday: "short", day: "numeric", month: "short" })) : "",
              fmtTime(t), r.data.category, repeatText(r), r.data.where,
              (r.data.snooze || "").slice(0, 10) === day && !done ? "Snoozed" : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {!r.data.cancelled && (
        <div className="flex flex-wrap items-center gap-2 ps-[52px]">
          <Btn size="sm" variant={done ? "outline" : "primary"} icon={done ? "Undo2" : "Check"} onClick={() => onDone(r, day, !done)}>
            {done ? "Undo" : "Done"}
          </Btn>
          {!done && day === today && (
            later ? (
              <span className="flex flex-wrap gap-1.5" role="group" aria-label="Snooze for">
                {[["10 min", 10], ["1 hour", 60], ["3 hours", 180]].map(([l, m]) => (
                  <Btn key={l as string} size="sm" variant="soft" onClick={() => { onSnooze(r, day, plus(m as number)); setLater(false); }}>{l as string}</Btn>
                ))}
              </span>
            ) : <Btn size="sm" variant="outline" icon="AlarmClock" onClick={() => setLater(true)}>Later</Btn>
          )}
          <Btn size="sm" variant="ghost" icon="Pencil" onClick={() => onEdit(r)} ariaLabel={`Change ${r.data.title}`}>Change</Btn>
          {onCancel && <Btn size="sm" variant="ghost" icon="X" onClick={() => onCancel(r)} ariaLabel={`Cancel ${r.data.title}`}>Cancel</Btn>}
          {onDelete && <Btn size="sm" variant="ghost" icon="Trash2" onClick={() => onDelete(r)} ariaLabel={`Delete ${r.data.title}`}>Delete</Btn>}
        </div>
      )}
      {r.data.cancelled && onDelete && (
        <div className="flex gap-2 ps-[52px]">
          <Btn size="sm" variant="outline" icon="Undo2" onClick={() => onCancel?.(r)}>Restore</Btn>
          <Btn size="sm" variant="ghost" icon="Trash2" onClick={() => onDelete(r)}>Delete</Btn>
        </div>
      )}
    </li>
  );
}

export function ApptRow({ a, today }: { a: Appointment; today: string }) {
  return (
    <li className="flex items-start gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }} data-appt={a.kind}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
            style={{ background: a.kind === "doctor" ? "var(--ux-tint-green)" : "var(--ux-tint-orange)",
                     color: a.kind === "doctor" ? "var(--ux-green-ink)" : "var(--ux-orange-ink)" }}>
        <I name={a.kind === "doctor" ? "Stethoscope" : "Users"} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{a.title}</b>
          <StatusPill status={a.status} label={a.status === "requested" ? "Requested" : a.status === "confirmed" ? "Confirmed" : a.status === "completed" ? "Completed" : "Cancelled"} />
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
          {[a.day ? (a.day === today ? "Today" : fmtDay(a.day, { weekday: "short", day: "numeric", month: "short" })) : "", a.time ? fmtTime(a.time) : "", !a.day ? a.when : "", a.sub]
            .filter(Boolean).join(" · ")}
        </p>
      </div>
      <Link href={a.href} className="ux-press shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>Open</Link>
    </li>
  );
}

/** A month of days; each carries a count of what falls on it. */
export function MonthGrid({ month, setMonth, selected, onSelect, countOn, today }: {
  month: string; setMonth: (m: string) => void; selected: string; onSelect: (d: string) => void;
  countOn: (d: string) => number; today: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3" data-month-grid>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="ux-press grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface-2)" }}>
          <I name="ChevronLeft" className="h-5 w-5" />
        </button>
        <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="ux-press grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface-2)" }}>
          <I name="ChevronRight" className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-2xs font-extrabold" style={{ color: "var(--ux-muted)" }}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const n = countOn(d);
          const sel = d === selected;
          return (
            <button key={d} type="button" onClick={() => onSelect(d)} aria-pressed={sel}
                    aria-label={`${fmtIN(d, { day: "numeric", month: "long" })}${n ? `, ${n} item${n > 1 ? "s" : ""}` : ""}`}
                    className="ux-press flex aspect-square min-h-[40px] flex-col items-center justify-center gap-0.5 rounded-[11px] text-[13px] font-bold tabular-nums"
                    style={{
                      background: sel ? "var(--ux-brand)" : "var(--ux-surface-2)",
                      color: sel ? "var(--ux-ink-on-brand)" : "var(--ux-ink)",
                      boxShadow: d === today && !sel ? "inset 0 0 0 2px var(--ux-ink)" : undefined,
                    }}>
              {Number(d.slice(8))}
              {n > 0 && (
                <span className="flex gap-0.5">
                  {Array.from({ length: Math.min(3, n) }).map((_, k) => (
                    <i key={k} className="block h-[5px] w-[5px] rounded-full" style={{ background: sel ? "var(--ux-ink-on-brand)" : "var(--ux-amber-ink)" }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

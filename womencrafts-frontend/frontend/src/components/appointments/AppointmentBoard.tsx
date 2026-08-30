"use client";

import { Avatar, Card } from "@/design-system";
import type { Appt, ApptStatus } from "@/types/appointment";
// Column meta: render order + dot color + subtle tinted header background.
const COLUMNS: { status: ApptStatus; dot: string; header: string }[] = [
  { status: "Upcoming", dot: "var(--color-violet-500)", header: "bg-violet-tint/70 dark:bg-violet-500/15" },
  { status: "Completed", dot: "var(--status-ok-solid)", header: "bg-status-ok-bg/70" },
  { status: "Cancelled", dot: "var(--status-danger-solid)", header: "bg-status-danger-bg/70" },
  { status: "Rescheduled", dot: "var(--color-brand-300)", header: "bg-brand-tint/70" },
];

export default function AppointmentBoard({
  appointments,
  onOpen,
}: {
  appointments: Appt[];
  onOpen: (a: Appt) => void;
}) {
  return (
    <Card padded={false}>
      <div className="flex gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => {
          const items = appointments.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className="flex min-w-[240px] flex-1 flex-col">
              {/* column header */}
              <div
                className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2.5 ${col.header}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: col.dot }}
                />
                <span className="text-sm font-bold text-ink">{col.status}</span>
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-2xs font-semibold text-ink-muted dark:bg-white/10">
                  {items.length}
                </span>
              </div>

              {/* column body */}
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-ink-subtle">
                    No appointments
                  </p>
                ) : (
                  items.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => onOpen(a)}
                      className={
                        "rounded-lg border-l-[3px] p-2.5 transition hover:-translate-y-0.5 cursor-pointer " +
                        a.bg
                      }
                      style={{ borderLeftColor: a.color }}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <Avatar name={a.name} size="xs" />
                        <span className="truncate text-xs font-semibold text-ink">
                          {a.name}
                        </span>
                      </div>
                      <p className="truncate text-2xs text-ink-subtle">{a.service}</p>
                      <p className="text-2xs text-ink-subtle">{a.time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

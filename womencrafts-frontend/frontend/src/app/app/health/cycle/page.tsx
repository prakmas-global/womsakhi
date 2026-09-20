"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Sheet } from "@/components/ux/kit/sheet";
import { CycleDashboard } from "@/components/ux/cycle/Dashboard";
import { Glance, Patterns, Phases } from "@/components/ux/cycle/Insights";
import { CycleHeader, ErrorLine, Legend, MonthCalendar, Panel } from "@/components/ux/cycle/parts";
import { dayNum, dow, monthShort, shiftMonth, shortDate, useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog } from "@/lib/cycle-api";

/**
 * The tracker's home.
 *
 * On a phone it is "My Cycle" from the reference — the month, what it means,
 * and a note. On a laptop it is the whole dashboard (`Dashboard.tsx`). Both
 * read one `useCycle`, so there is one request, and both are rendered by
 * breakpoint rather than by measuring the window, so the first frame is
 * already the right one.
 *
 * Tapping a day corrects it. Trackers are only as good as their edits: a
 * period she forgot to log last Tuesday should take two taps to fix, not a
 * support ticket.
 */
function MyCycle() {
  const router = useRouter();
  const params = useSearchParams();
  const [month, setMonth] = useState<string | undefined>(params.get("month") ?? undefined);
  const cycle = useCycle(month);
  const { state, data, act, busy, error, reload } = cycle;
  const [tab, setTab] = useState<"calendar" | "insights">("calendar");
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);

  const shownMonth = month ?? state?.calendar.month;
  const cells = state && state.calendar.month === shownMonth ? state.calendar.days : [];
  const st = state?.status;
  const editingCell = state?.calendar.days.find((c) => c.date === editing);

  const mark = async (period: boolean | null) => {
    if (!editing) return;
    const d = editing;
    setEditing(null);
    await act(() => apiCycleLog(d, { period }));
  };

  return (
    <HomeShell immersive bare>
      {/* ── Laptop: the dashboard ── */}
      <div className="hidden lg:block">
        {state ? <CycleDashboard cycle={{ ...cycle, state }} />
          : error ? <ErrorLine text={error} onRetry={reload} />
          : <div className="h-[600px] animate-pulse rounded-[24px]" style={{ background: "var(--ux-surface-2)" }} />}
      </div>

      {/* ── Phone: My Cycle ── */}
      <div className="lg:hidden">
        <CycleHeader title="My Cycle" action={{ label: "Log", href: "/app/health/cycle/log" }} />

        <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-full p-1"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          {(["calendar", "insights"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className="ux-tap-exempt h-[40px] rounded-full text-[15px] capitalize"
                    style={tab === k ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                                     : { color: "var(--ux-ink-2)" }}>
              {k}
            </button>
          ))}
        </div>

        {!state ? (
          error ? <ErrorLine text={error} onRetry={reload} />
            : <div className="mt-4 h-[420px] animate-pulse rounded-[20px]" style={{ background: "var(--ux-surface-2)" }} />
        ) : tab === "calendar" ? (
          <div className="mt-4 space-y-3">
            <Panel>
              <MonthCalendar month={shownMonth!} cells={cells} today={state.today}
                             onPrev={() => setMonth(shiftMonth(shownMonth!, -1))}
                             onNext={() => setMonth(shiftMonth(shownMonth!, 1))}
                             onPick={setEditing} />
              <Legend className="mt-4 justify-center" />
            </Panel>

            <Panel>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Cycle Insights</h2>
                  <p className="mt-1 text-[15px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                    {st?.on_period ? <>You are on <b style={{ color: "var(--ux-ink)" }}>day {st.period_day}</b> of your period.</>
                      : st?.next_start && st.days_until != null && st.days_until >= 0
                        ? <>Your next period is likely in<br /><b className="text-[20px]" style={{ color: "var(--ux-ink)" }}>{st.days_until} days ({shortDate(st.next_start)})</b></>
                        : st?.days_until != null ? <>Your period is <b style={{ color: "var(--ux-ink)" }}>{-st.days_until} days</b> later than expected.</>
                        : "Log your period to see predictions."}
                  </p>
                </div>
                <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full" style={{ background: "var(--cy-predicted)" }}>
                  <Icons.CalendarDays className="h-6 w-6" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
                </span>
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-2 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Add a note</h2>
              {state.log?.note && <p className="mb-2 text-[13px]" style={{ color: "var(--ux-muted)" }}>Today: {state.log.note}</p>}
              <form className="flex items-center gap-2 rounded-[14px] px-3.5 py-1"
                    style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
                    onSubmit={(e) => { e.preventDefault(); if (note.trim()) act(() => apiCycleLog(state.today, { note: note.trim() })).then((r) => r && setNote("")); }}>
                <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="How are you feeling today?"
                       aria-label="Add a note" className="h-[44px] min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: "var(--ux-ink)" }} />
                <button type="submit" disabled={busy || !note.trim()} aria-label="Save note"
                        className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-40" style={{ color: "var(--cy-period-ink)" }}>
                  <Icons.Send className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </form>
            </Panel>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Glance s={state} />
            <Phases s={state} />
            <Patterns s={state} />
          </div>
        )}
        <ErrorLine text={state ? error : null} />
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)}
             title={editing ? `${dow(editing)} ${dayNum(editing)} ${monthShort(editing)}` : ""} icon="CalendarDays"
             description="Were you on your period this day?">
        <div className="space-y-2.5">
          <button type="button" onClick={() => mark(true)} disabled={busy}
                  className="ux-press h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                  style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
            Yes, I was
          </button>
          <button type="button" onClick={() => mark(false)} disabled={busy}
                  className="ux-press h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
            No
          </button>
          {editingCell?.period != null && (
            <button type="button" onClick={() => mark(null)} disabled={busy}
                    className="ux-press h-11 w-full text-[15px]" style={{ color: "var(--ux-muted)" }}>
              Clear this day
            </button>
          )}
        </div>
      </Sheet>
    </HomeShell>
  );
}

export default function Page() {
  return <Suspense><MyCycle /></Suspense>;
}

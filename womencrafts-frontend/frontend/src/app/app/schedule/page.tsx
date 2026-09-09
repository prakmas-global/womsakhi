"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useDiary } from "@/components/ux/diary";
import * as Icons from "@/components/ux/icons";
import {Back, Btn, Card, EmptyState, I, IconTile, SourceNote, v } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useT } from "@/i18n";

import {
  CATEGORIES, ComingUp, MonthGrid, TodayPanel,
  buildMonth, catFor, categoryOf, type CategoryId,
} from "./calendar-views";

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Her calendar — a month she can look at, not a list she has to read.
 *
 * ── Why a month grid rather than the list this used to be ───────────────────
 * The old screen was "Upcoming / Past" as a flat list. That answers "what is
 * next", which she already knows, and cannot answer the question she actually
 * has on a Sunday evening: *which days next week are already spoken for.*
 * Shape is the answer to that, and only a grid has a shape.
 *
 * ── Everything here is real ─────────────────────────────────────────────────
 * The entries are her bookings, the events she registered for and her accepted
 * mentor sessions, merged by `useDiary`. Nothing on this screen is invented,
 * and "Add activity" opens the three places she can genuinely create one —
 * there is no endpoint for a free-form event, so offering a form that wrote
 * nowhere would be the dishonest option.
 */
export default function Schedule() {
  const tr = useT();
  const { data: diary, source } = useDiary();

  const today = useMemo(() => new Date(), []);
  const todayIso = iso(today);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState(todayIso);
  const [view, setView] = useState<"calendar" | "agenda">("calendar");
  const [off, setOff] = useState<CategoryId[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Close the add menu on an outside click or Escape — a menu that can only be
  // closed by choosing something traps her in a decision she may not want.
  useEffect(() => {
    if (!addOpen) return;
    const away = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setAddOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [addOpen]);

  const shown = useMemo(
    () => diary.entries.filter((e) => !off.includes(categoryOf(e))),
    [diary.entries, off],
  );

  const cells = useMemo(
    () => buildMonth(cursor.getFullYear(), cursor.getMonth(), shown, todayIso),
    [cursor, shown, todayIso],
  );

  const dayEntries = useMemo(
    () => shown.filter((e) => e.on === picked).sort((a, b) => a.time.localeCompare(b.time)),
    [shown, picked],
  );

  const upcoming = useMemo(
    () => shown.filter((e) => e.on > todayIso).sort((a, b) => a.on.localeCompare(b.on)).slice(0, 3),
    [shown, todayIso],
  );

  const agenda = useMemo(
    () => shown.filter((e) => !e.past).sort((a, b) => a.on.localeCompare(b.on)),
    [shown],
  );

  const step = useCallback((by: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + by, 1));
  }, []);

  const goToday = useCallback(() => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setPicked(todayIso);
  }, [today, todayIso]);

  const toggle = useCallback((id: CategoryId) => {
    setOff((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }, []);

  const pickedDate = useMemo(() => {
    const [y, m, d] = picked.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [picked]);

  const pickedLabel = `${DAYS[pickedDate.getDay()].slice(0, 3)}, ${pickedDate.getDate()} ${MONTHS[pickedDate.getMonth()].slice(0, 3)} ${pickedDate.getFullYear()}`;

  return (
    <HomeShell
      active="/app/schedule"
      rail={
        <div className="space-y-[16px]">
          <TodayPanel
            label={pickedLabel}
            count={dayEntries.length}
            entries={dayEntries}
            onToday={goToday}
            isToday={picked === todayIso}
            onFullDay={() => setView("agenda")}
          />

          <ComingUp entries={upcoming} />

          {/* Planning, offered rather than nagged. */}
          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/scene-woman-planning-board.webp" alt=""
                 className="ux-float pointer-events-none absolute -bottom-2 -end-3 h-[108px] w-[108px] object-contain" />
            <h3 className="relative flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              <Icons.CalendarDays className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
              {tr("schedule.planYourWeek")}
            </h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("schedule.twoHoursBookedInAdvanceIs")}
            </p>
            <div className="relative mt-3">
              <Btn href="/app/goals" size="sm" iconEnd="ArrowRight">{tr("schedule.createYourPlan")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <Back to="/app" label={tr("schedule.backToHome")} className="mb-4" />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile icon="CalendarDays" tint="--ux-tint-violet" ink="--ux-violet-ink" size={56} radius={15} />
          <div>
            <h1 className="text-4xlm font-extrabold leading-[1.05] tracking-[-0.03em]" style={{ color: v("--ux-ink") }}>{tr("schedule.myCalendar")}</h1>
            <p className="mt-1.5 text-sm" style={{ color: v("--ux-muted") }}>{tr("schedule.everythingYouHavePlannedBookedAnd")}</p>
            <SourceNote source={source} what={tr("schedule.yourDiary")} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Calendar / Agenda */}
          <div className="flex rounded-[13px] border p-1"
               style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
            {(["calendar", "agenda"] as const).map((mode) => {
              const on = view === mode;
              return (
                <button key={mode} type="button" onClick={() => setView(mode)} aria-pressed={on}
                        className="ux-press ux-sq flex min-h-[40px] items-center gap-2 rounded-[10px] px-3.5 text-xsm font-bold capitalize transition-colors"
                        style={{ background: on ? v("--ux-fill") : "transparent",
                                 color: on ? v("--ux-on-brand") : v("--ux-ink-2") }}>
                  <I name={mode === "calendar" ? "CalendarDays" : "List"} className="h-[15px] w-[15px]" />
                  {mode}
                </button>
              );
            })}
          </div>

          {/* Add activity — the three places she can genuinely make one. */}
          <div className="relative" ref={addRef}>
            <button type="button" onClick={() => setAddOpen((o) => !o)}
                    aria-expanded={addOpen} aria-haspopup="menu"
                    className="ux-press ux-sq flex min-h-[48px] items-center gap-2 rounded-[14px] px-4 text-sm font-bold"
                    style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
              <Icons.Plus className="h-[18px] w-[18px]" />{tr("schedule.addActivity")}<Icons.ChevronDown className="h-[14px] w-[14px]" />
            </button>
            {addOpen && (
              <div role="menu"
                   className="ux-pop absolute end-0 top-[calc(100%+6px)] z-[var(--ux-z-dropdown)] w-[228px] rounded-[12px] border p-1.5"
                   style={{ background: v("--ux-surface"), borderColor: v("--ux-line"),
                            boxShadow: "var(--ux-shadow-pop)" }}>
                {[
                  { label: "Book a mentor session", icon: "UserRound", href: "/app/mentors" },
                  { label: "Join an event", icon: "Store", href: "/app/events" },
                  { label: "Start a course", icon: "GraduationCap", href: "/app/programs" },
                ].map((a) => (
                  <Link key={a.href} href={a.href} role="menuitem" onClick={() => setAddOpen(false)}
                        className="ux-hov ux-sq flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-xsm"
                        style={{ color: v("--ux-ink") }}>
                    <I name={a.icon} className="h-[16px] w-[16px]" style={{ color: v("--ux-muted") }} />
                    {a.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── The calendar panel: its own controls, then the month ─────── */}
      <Card pad={20}>
      <div className="mb-4 flex items-center justify-between gap-x-2">
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label={tr("schedule.previousMonth")}
                  className="ux-press ux-sq grid h-[34px] w-[34px] place-items-center rounded-[10px] border"
                  style={{ borderColor: v("--ux-line"), color: v("--ux-ink-2") }}>
            <Icons.ChevronLeft className="h-[17px] w-[17px]" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={tr("schedule.nextMonth")}
                  className="ux-press ux-sq grid h-[34px] w-[34px] place-items-center rounded-[10px] border"
                  style={{ borderColor: v("--ux-line"), color: v("--ux-ink-2") }}>
            <Icons.ChevronRight className="h-[17px] w-[17px]" />
          </button>
          <button type="button" onClick={goToday}
                  className="ux-sq ms-1 flex items-center gap-1 text-base font-bold"
                  style={{ color: v("--ux-ink") }}>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            <Icons.ChevronDown className="h-[16px] w-[16px]" style={{ color: v("--ux-muted") }} />
          </button>
          <button type="button" onClick={goToday}
                  className="ux-press ux-sq ms-1 min-h-[34px] rounded-[10px] border px-3.5 text-xsm font-bold"
                  style={{ borderColor: v("--ux-line"), color: v("--ux-ink-2") }}>
            Today
          </button>
        </div>

        {/* Category filters. Pressed = shown, so the default reads as "all on". */}
        <div className="ux-noscroll flex min-w-0 items-center gap-[3px] overflow-x-auto">
          {CATEGORIES.map((c) => {
            const on = !off.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on}
                      className="ux-press ux-sq flex min-h-[30px] shrink-0 items-center gap-[3px] rounded-full ps-[3px] pe-2 text-xs font-semibold transition-opacity"
                      style={{ background: v(c.tint), color: v(c.ink), opacity: on ? 1 : 0.4 }}>
                <span className="grid h-[20px] w-[20px] place-items-center rounded-[6px]"
                      style={{ background: v("--ux-surface"), color: v(c.ink) }}>
                  <I name={c.icon} className="h-[11px] w-[11px]" />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── The month, or the list ───────────────────────────────────── */}
      {view === "calendar" ? (
        <MonthGrid cells={cells} onPick={setPicked} />
      ) : null}
      </Card>

      {view === "agenda" ? (agenda.length ? (
        <div className="space-y-2">
          {agenda.map((e) => {
            const cat = catFor(categoryOf(e));
            return (
              <Link key={e.id} href={e.href}
                    className="ux-card ux-hov ux-sq flex items-center gap-3.5 p-3.5">
                <span className="grid h-[52px] w-[48px] shrink-0 place-items-center rounded-[11px]"
                      style={{ background: v("--ux-brand-tint") }}>
                  <span className="text-lg font-extrabold leading-none" style={{ color: v("--ux-brand") }}>{e.d}</span>
                  <span className="mt-0.5 text-3xs font-bold uppercase" style={{ color: v("--ux-brand") }}>{e.m}</span>
                </span>
                <IconTile icon={cat.icon} tint={cat.tint} ink={cat.ink} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{e.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: v("--ux-muted") }}>
                    <span className="inline-flex items-center gap-1"><Icons.Clock className="h-[13px] w-[13px]" />{e.time}</span>
                    <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-[13px] w-[13px]" />{e.where}</span>
                    <span className="inline-flex items-center gap-1"><Icons.Tag className="h-[13px] w-[13px]" />{e.kind}</span>
                  </span>
                </span>
                <Icons.ChevronRight className="h-[17px] w-[17px] shrink-0" style={{ color: v("--ux-faint") }} />
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon="CalendarX" title={tr("schedule.nothingBookedYet")}
            body="Sessions and events you join will be listed here, with the time and where to go."
            action={<Btn href="/app/events" variant="soft" iconEnd="ArrowRight">{tr("schedule.browseEvents")}</Btn>} />
        </Card>
      )) : null}
    </HomeShell>
  );
}

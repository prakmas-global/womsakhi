"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarClock,
  CalendarCheck,
  CalendarX2,
  CalendarPlus,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  SlidersHorizontal,
  Clock,
  ArrowDown,
} from "lucide-react";
import { Avatar, Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Textarea, type Tone, useToast } from "@/design-system";
import type { Appt, ApptStatus } from "@/types/appointment";
import DonutChart from "@/components/charts/DonutChart";
import RadialGauge from "@/components/charts/RadialGauge";
import AreaTrend from "@/components/charts/AreaTrend";
import AppointmentBoard from "@/components/appointments/AppointmentBoard";
import AppointmentList from "@/components/appointments/AppointmentList";
import {
  apiListAppointments,
  apiAppointmentStats,
  apiCreateAppointment,
  apiSetAppointmentStatus,
  type ApiAppointment,
  type AppointmentStats,
  type ApptStatusSlice,
  type ApptServiceSlice,
  type ApptReminder,
  type ApptTrendPoint,
} from "@/lib/appointments-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/* ---------------- shared data contract ---------------- */

const STATUS_TONE: Record<ApptStatus, Tone> = {
  Upcoming: "violet",
  Completed: "emerald",
  Cancelled: "rose",
  Rescheduled: "brand",
};

// Modal.iconTone accepts a narrower tone set than kit's Badge tone.
type ModalTone = "brand" | "violet" | "emerald" | "amber" | "sky" | "rose";
const STATUS_ICON_TONE: Record<ApptStatus, ModalTone> = {
  Upcoming: "violet",
  Completed: "emerald",
  Cancelled: "rose",
  Rescheduled: "brand",
};

/* category accent + bg presets (kept verbatim from original) */
const cCareer = { color: "var(--color-brand-300)", bg: "bg-brand-tint/70" };
const cSkill = { color: "var(--color-violet-500)", bg: "bg-violet-tint/70 dark:bg-violet-500/15" };
const cBiz = { color: "var(--status-ok-solid)", bg: "bg-status-ok-bg/70" };
const cWell = { color: "var(--status-warn-solid)", bg: "bg-status-warn-bg/60" };
const cFin = { color: "var(--status-info-solid)", bg: "bg-status-info-bg/60" };

const DAYS: { day: string; date: string }[] = [
  { day: "Mon", date: "May 20" },
  { day: "Tue", date: "May 21" },
  { day: "Wed", date: "May 22" },
  { day: "Thu", date: "May 23" },
  { day: "Fri", date: "May 24" },
];

/* map a backend appointment to the Appt UI shape (carry the mongo _id) */
function toAppt(a: ApiAppointment): Appt {
  return {
    _id: a.id,
    id: a.id,
    name: a.name,
    service: a.service,
    day: a.day,
    date: a.date,
    time: a.time,
    status: a.status as ApptStatus,
    color: a.color,
    bg: a.bg,
  };
}

const SERVICES = [
  "Career Counseling",
  "Skill Workshop",
  "Mentoring Session",
  "Business Consultation",
  "Financial Literacy",
  "Health & Wellness",
  "Handicraft Training",
  "Entrepreneurship",
  "Digital Skills",
  "Marketing Basics",
];

const ALL_STATUSES: ApptStatus[] = ["Upcoming", "Completed", "Cancelled", "Rescheduled"];

/* map a service to a category accent/bg preset for new items */
function presetFor(service: string) {
  if (/wellness|yoga|health/i.test(service)) return cWell;
  if (/business|entrepreneur/i.test(service)) return cBiz;
  if (/financial|finance/i.test(service)) return cFin;
  if (/skill|handicraft|digital|workshop/i.test(service)) return cSkill;
  return cCareer;
}

/* ---------------- static presentation data ---------------- */
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_CELLS: { day: number; muted?: boolean }[] = [
  { day: 29, muted: true }, { day: 30, muted: true }, { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 },
  { day: 6 }, { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 },
  { day: 13 }, { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 }, { day: 18 }, { day: 19 },
  { day: 20 }, { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 }, { day: 26 },
  { day: 27 }, { day: 28 }, { day: 29 }, { day: 30 }, { day: 31 }, { day: 1, muted: true }, { day: 2, muted: true },
];
const MONTH_LABELS = ["Apr 2024", "May 2024", "Jun 2024"];

type QuickKey = "All" | "Today" | "Tomorrow" | "This Week" | "This Month";
const QUICK_FILTERS: { icon: React.ElementType; label: QuickKey; count: string }[] = [
  { icon: ListFilter, label: "All", count: "1,532" },
  { icon: CalendarDays, label: "Today", count: "82" },
  { icon: CalendarDays, label: "Tomorrow", count: "96" },
  { icon: CalendarClock, label: "This Week", count: "820" },
  { icon: Calendar, label: "This Month", count: "1,245" },
];

const STATUS_STATS: ApptStatusSlice[] = [
  { name: "Upcoming", value: 820, color: "var(--color-violet-500)", pct: "53%" },
  { name: "Completed", value: 512, color: "var(--status-ok-solid)", pct: "33%" },
  { name: "Cancelled", value: 120, color: "var(--status-warn-solid)", pct: "8%" },
  { name: "Rescheduled", value: 80, color: "var(--color-brand-300)", pct: "6%" },
];

const TIME_GUTTER = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
];

const LEGEND = [
  { label: "Career", color: "var(--color-brand-300)" },
  { label: "Skills", color: "var(--color-violet-500)" },
  { label: "Business", color: "var(--status-ok-solid)" },
  { label: "Wellness", color: "var(--status-warn-solid)" },
  { label: "Finance", color: "var(--status-info-solid)" },
  { label: "Other", color: "var(--color-line-strong)" },
];

const REMINDERS: ApptReminder[] = [
  { name: "Aisha Khan", service: "Skill Workshop", time: "Today, 10:15 AM", badge: "In 45 min" },
  { name: "Sneha Joshi", service: "Business Consultation", time: "Today, 01:30 PM", badge: "In 3h 15m" },
  { name: "Pooja Verma", service: "Financial Literacy", time: "Today, 03:00 PM", badge: "In 4h 45m" },
];

const BY_SERVICE: ApptServiceSlice[] = [
  { name: "Career Counseling", value: 30, color: "var(--color-brand-600)" },
  { name: "Skill Workshop", value: 25, color: "var(--color-violet-500)" },
  { name: "Mentoring", value: 20, color: "var(--status-warn-solid)" },
  { name: "Business Consult.", value: 15, color: "var(--status-ok-solid)" },
  { name: "Financial Literacy", value: 10, color: "var(--status-info-solid)" },
];

const LEAD_TREND: ApptTrendPoint[] = [7, 9, 8, 11, 10, 13, 12, 14, 13, 16, 15, 18].map((value, i) => ({
  label: `${i}`,
  value,
}));

type ViewMode = "calendar" | "board" | "list";
type Granularity = "Day" | "Week" | "Month";

const DURATIONS = ["30 min", "1 hour", "1.5 hours", "2 hours"];

export default function AppointmentsPage() {
  const toast = useToast();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ViewMode>("calendar");
  const [statusFilter, setStatusFilter] = useState<ApptStatus | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickKey>("All");
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [menuStatusFilter, setMenuStatusFilter] = useState<ApptStatus | null>(null);

  // control labels
  const [rangeLabel, setRangeLabel] = useState("This Week");
  const [byServiceLabel, setByServiceLabel] = useState("This Month");
  const [leadLabel, setLeadLabel] = useState("This Month");

  // mini calendar
  const [monthIdx, setMonthIdx] = useState(1); // May 2024
  const [selectedDay, setSelectedDay] = useState<number | null>(20);

  // center calendar
  const [weekOffset, setWeekOffset] = useState(0);
  const [granularity, setGranularity] = useState<Granularity>("Week");
  const [centerDayIdx, setCenterDayIdx] = useState(0); // index into DAYS for Day view

  // modals
  const [detail, setDetail] = useState<Appt | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    service: SERVICES[0],
    date: "",
    time: "",
    duration: DURATIONS[1],
    status: "Upcoming" as ApptStatus,
    notes: "",
  });

  // Load appointments + analytics from the backend; client-side filtering stays as-is.
  const refresh = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        apiListAppointments({ page_size: 100 }),
        apiAppointmentStats(),
      ]);
      setAppts(list.items.map(toAppt));
      setStats(s);
    } catch {
      /* leave current data in place; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Analytics widgets read from the live stats payload, falling back to the
  // built-in figures while the request is in flight (identical values).
  const statValue = (key: string, fallback: string) =>
    stats?.stat_cards.find((c) => c.key === key)?.value ?? fallback;
  const quickCount = (label: string, fallback: string) =>
    stats?.quick_filters.find((f) => f.label === label)?.count ?? fallback;
  const statusStats = stats?.status_breakdown ?? STATUS_STATS;
  const statusTotal = stats?.status_total ?? "1,532";
  const byService = stats?.by_service ?? BY_SERVICE;
  const byServiceTotal = stats?.by_service_total ?? "1,245";
  const reminders = stats?.reminders ?? REMINDERS;
  const cancellation = stats?.cancellation;
  const leadTime = stats?.lead_time;
  const leadTrend = leadTime?.trend ?? LEAD_TREND;

  /* ---------- filtering helper (statusFilter + quick + menu filters) ---------- */
  const filtered = useMemo(() => {
    return appts.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (menuStatusFilter && a.status !== menuStatusFilter) return false;
      if (serviceFilter && a.service !== serviceFilter) return false;
      if (quickFilter === "Today" && a.date !== "May 20") return false;
      if (quickFilter === "Tomorrow" && a.date !== "May 21") return false;
      // This Week / This Month / All => keep all (data is within one week/month)
      return true;
    });
  }, [appts, statusFilter, menuStatusFilter, serviceFilter, quickFilter]);

  /* calendar columns grouped by day, from filtered list */
  const columns = useMemo(
    () =>
      DAYS.map((d) => ({
        ...d,
        appts: filtered.filter((a) => a.day === d.day),
      })),
    [filtered]
  );

  /* ---------- actions ---------- */
  const openDetail = (a: Appt) => setDetail(a);

  const openStatus = (s: ApptStatus | null) => {
    setStatusFilter(s);
    setView("list");
  };

  // Cancel / Reschedule / Mark Complete → PATCH the status, then refresh.
  const mutateStatus = async (mongoId: string, status: ApptStatus) => {
    setDetail(null);
    if (!mongoId) return; // transient rows (e.g. an unmatched reminder) aren't persisted
    try {
      await apiSetAppointmentStatus(mongoId, status);
      await refresh();
    } catch (err) {
      toast.error("Could not update the appointment", { description: memberError(err) });
    }
  };

  const submitNew = async () => {
    if (!form.name.trim()) return;
    // The server derives day/date labels, category, color and bg from these.
    try {
      await apiCreateAppointment({
        name: form.name.trim(),
        service: form.service,
        date: form.date,
        time: form.time,
        duration: form.duration,
        status: form.status,
        notes: form.notes,
      });
      await refresh();
      setNewOpen(false);
      setForm({
        name: "",
        service: SERVICES[0],
        date: "",
        time: "",
        duration: DURATIONS[1],
        status: "Upcoming",
        notes: "",
      });
    } catch (err) {
      toast.error("Could not create the appointment", { description: memberError(err) });
    }
  };

  /* open detail from a reminder row (match by name, else build temp) */
  const openReminder = (r: (typeof REMINDERS)[number]) => {
    const found = appts.find((a) => a.name === r.name);
    if (found) return setDetail(found);
    const preset = presetFor(r.service);
    setDetail({
      _id: "",
      id: `tmp-${r.name}`,
      name: r.name,
      service: r.service,
      day: "Mon",
      date: "May 20",
      time: r.time,
      status: "Upcoming",
      color: preset.color,
      bg: preset.bg,
    });
  };

  const viewBtn = (mode: ViewMode, label: string) => (
    <button
      onClick={() => setView(mode)}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
        view === mode
          ? "bg-brand-600 text-white"
          : "font-medium text-ink-subtle hover:text-ink-muted"
      }`}
    >
      {label}
    </button>
  );

  const weekLabel =
    weekOffset === 0
      ? "Monday, May 20, 2024"
      : weekOffset < 0
      ? `Monday, May ${20 + weekOffset * 7}, 2024`
      : `Monday, May ${20 + weekOffset * 7}, 2024`;

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Appointments</h1>
            <p className="mt-1 text-sm text-ink-subtle">Manage and track all appointments across the platform.</p>
          </div>
        </div>
        <Menu
          align="right"
          trigger={
            <span className="btn btn-sm btn-outline">
              <Calendar className="h-4 w-4 text-ink-subtle" /> {rangeLabel === "This Week" ? "May 20 - May 26, 2024" : rangeLabel}
              <ChevronRight className="h-4 w-4 text-ink-subtle" />
            </span>
          }
        >
          <MenuItem icon={CalendarDays} onClick={() => setRangeLabel("Today")}>Today</MenuItem>
          <MenuItem icon={CalendarClock} onClick={() => setRangeLabel("This Week")}>This Week</MenuItem>
          <MenuItem icon={Calendar} onClick={() => setRangeLabel("This Month")}>This Month</MenuItem>
        </Menu>
      </div>

      {/* stats — clickable */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <button onClick={() => openStatus(null)} className="w-full text-left transition hover:-translate-y-0.5">
          <StatCard label="Total Appointments" value={statValue("total", "1,532")} icon={CalendarDays} tone="brand" delta="12.5%" deltaNote="vs last week" />
        </button>
        <button onClick={() => openStatus("Upcoming")} className="w-full text-left transition hover:-translate-y-0.5">
          <StatCard label="Upcoming" value={statValue("upcoming", "820")} icon={CalendarClock} tone="violet" delta="8.3%" deltaNote="vs last week" />
        </button>
        <button onClick={() => openStatus("Completed")} className="w-full text-left transition hover:-translate-y-0.5">
          <StatCard label="Completed" value={statValue("completed", "512")} icon={CalendarCheck} tone="emerald" delta="15.7%" deltaNote="vs last week" />
        </button>
        <button onClick={() => openStatus("Cancelled")} className="w-full text-left transition hover:-translate-y-0.5">
          <StatCard label="Cancelled" value={statValue("cancelled", "120")} icon={CalendarX2} tone="amber" delta="5.2%" deltaDir="down" deltaNote="vs last week" />
        </button>
        <button onClick={() => openStatus("Rescheduled")} className="w-full text-left transition hover:-translate-y-0.5">
          <StatCard label="Rescheduled" value={statValue("rescheduled", "80")} icon={RefreshCw} tone="brand" delta="6.7%" deltaNote="vs last week" />
        </button>
      </div>

      {/* section header */}
      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Calendar &amp; Appointments</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-line-strong bg-surface p-0.5">
            {viewBtn("calendar", "Calendar View")}
            {viewBtn("board", "Board View")}
            {viewBtn("list", "List View")}
          </div>
          <Menu
            align="right"
            trigger={
              <span className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                {rangeLabel}
                <ChevronRight className="h-3.5 w-3.5 text-ink-subtle rotate-90" />
              </span>
            }
          >
            <MenuItem icon={CalendarDays} onClick={() => setRangeLabel("Today")}>Today</MenuItem>
            <MenuItem icon={CalendarClock} onClick={() => setRangeLabel("This Week")}>This Week</MenuItem>
            <MenuItem icon={Calendar} onClick={() => setRangeLabel("This Month")}>This Month</MenuItem>
          </Menu>
          <Menu
            align="right"
            width="min-w-[15rem]"
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5 text-ink-subtle" /> Filters
              </span>
            }
          >
            <p className="px-2 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-wide text-ink-subtle">Service</p>
            <MenuItem onClick={() => setServiceFilter(null)}>All Services</MenuItem>
            {SERVICES.map((s) => (
              <MenuItem key={s} onClick={() => setServiceFilter(s)}>{s}</MenuItem>
            ))}
            <p className="px-2 pb-1 pt-2 text-2xs font-bold uppercase tracking-wide text-ink-subtle">Status</p>
            <MenuItem onClick={() => setMenuStatusFilter(null)}>All Statuses</MenuItem>
            {ALL_STATUSES.map((s) => (
              <MenuItem key={s} onClick={() => setMenuStatusFilter(s)}>{s}</MenuItem>
            ))}
          </Menu>
          <button onClick={() => setNewOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New Appointment
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <ResizableColumns id="appointments" defaultSizes={[0.22, 0.55, 0.23]} className="gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* mini calendar */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">{MONTH_LABELS[monthIdx]}</h3>
              <div className="flex items-center gap-1">
                <button aria-label="Previous month"
                  onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-line-strong text-ink-subtle hover:bg-surface-hover"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button aria-label="Next month"
                  onClick={() => setMonthIdx((i) => Math.min(MONTH_LABELS.length - 1, i + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-line-strong text-ink-subtle hover:bg-surface-hover"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {DOW.map((d) => (
                <span key={d} className="py-1 text-2xs font-semibold text-ink-subtle">{d}</span>
              ))}
              {MONTH_CELLS.map((c, i) => {
                const active = !c.muted && selectedDay === c.day;
                return (
                  <button
                    key={i}
                    disabled={c.muted}
                    onClick={() => !c.muted && setSelectedDay(c.day)}
                    className={`flex h-7 items-center justify-center rounded-full text-xs ${
                      active
                        ? "bg-brand-600 font-semibold text-white"
                        : c.muted
                        ? "cursor-default text-ink-faint"
                        : "text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* quick filters */}
          <Card>
            <h3 className="mb-3 font-display text-sm font-bold text-ink">Quick Filters</h3>
            <div className="space-y-1">
              {QUICK_FILTERS.map((q) => {
                const active = quickFilter === q.label;
                return (
                  <button
                    key={q.label}
                    onClick={() => {
                      setQuickFilter(q.label);
                      setView("list");
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                      active ? "bg-brand-tint text-brand-ink" : "text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    <q.icon className={`h-4 w-4 ${active ? "text-brand-ink" : "text-ink-subtle"}`} />
                    <span className="flex-1 text-sm font-medium">{q.label === "All" ? "All Appointments" : q.label}</span>
                    <span className={`text-xs font-semibold ${active ? "text-brand-ink" : "text-ink-subtle"}`}>{quickCount(q.label, q.count)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
                  </button>
                );
              })}
            </div>
          </Card>

          {/* appointment status donut */}
          <Card>
            <h3 className="mb-3 font-display text-sm font-bold text-ink">Appointment Status</h3>
            <div className="flex items-center gap-4">
              <DonutChart data={statusStats} centerValue={statusTotal} centerLabel="Total" size={130} thickness={16} />
              <ul className="flex-1 space-y-2">
                {statusStats.map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-ink-muted">{s.name}</span>
                    <span className="font-semibold text-ink-subtle">{s.value.toLocaleString()} ({s.pct})</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* CENTER — calendar / board / list */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-24 text-sm text-ink-subtle">
              Loading appointments…
            </div>
          </Card>
        ) : view === "board" ? (
          <AppointmentBoard appointments={filtered} onOpen={openDetail} />
        ) : view === "list" ? (
          <Card>
            <AppointmentList appointments={filtered} onOpen={openDetail} />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-ink">
                  {granularity === "Day" ? `${DAYS[centerDayIdx].day}, ${DAYS[centerDayIdx].date}, 2024` : weekLabel}
                </span>
                <button aria-label={granularity === "Day" ? "Previous day" : "Previous week"}
                  onClick={() => {
                    if (granularity === "Day") setCenterDayIdx((i) => Math.max(0, i - 1));
                    else setWeekOffset((w) => w - 1);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-line-strong text-ink-subtle hover:bg-surface-hover"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button aria-label={granularity === "Day" ? "Next day" : "Next week"}
                  onClick={() => {
                    if (granularity === "Day") setCenterDayIdx((i) => Math.min(DAYS.length - 1, i + 1));
                    else setWeekOffset((w) => w + 1);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-line-strong text-ink-subtle hover:bg-surface-hover"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center rounded-lg border border-line-strong bg-surface p-0.5">
                {(["Day", "Week", "Month"] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`rounded-md px-3 py-1 text-xs ${
                      granularity === g
                        ? "bg-brand-600 font-semibold text-white"
                        : "font-medium text-ink-subtle hover:text-ink-muted"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {granularity === "Month" ? (
              /* simple month overview grid with per-day counts */
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DOW.map((d) => (
                    <span key={d} className="py-1 text-2xs font-semibold text-ink-subtle">{d}</span>
                  ))}
                  {MONTH_CELLS.map((c, i) => {
                    const dayMeta = DAYS.find((d) => d.date === `May ${c.day}`);
                    const count = dayMeta ? filtered.filter((a) => a.day === dayMeta.day).length : 0;
                    return (
                      <div
                        key={i}
                        className={`flex h-16 flex-col items-center justify-start rounded-lg border border-line p-1 text-xs ${
                          c.muted ? "text-ink-faint" : "text-ink-muted"
                        }`}
                      >
                        <span className="font-semibold">{c.day}</span>
                        {count > 0 && (
                          <span className="mt-1 rounded-full bg-brand-tint px-1.5 text-3xs font-semibold text-brand-ink">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className={`flex ${granularity === "Day" ? "min-w-[420px]" : "min-w-[720px]"}`}>
                  {/* time gutter */}
                  <div className="w-16 shrink-0 border-r border-line pt-[68px]">
                    {TIME_GUTTER.map((t) => (
                      <div key={t} className="flex h-24 items-start justify-end pr-2 pt-1 text-2xs font-medium text-ink-subtle">{t}</div>
                    ))}
                  </div>
                  {/* day columns */}
                  <div className={`grid flex-1 ${granularity === "Day" ? "grid-cols-1" : "grid-cols-5"}`}>
                    {(granularity === "Day" ? columns.filter((_, i) => i === centerDayIdx) : columns).map((col) => (
                      <div key={col.day} className="border-r border-line last:border-r-0">
                        <div className="border-b border-line px-2 py-3 text-center">
                          <p className="text-sm font-semibold text-ink">{col.day}, {col.date}</p>
                          <p className="text-2xs text-ink-subtle">{col.appts.length} Appointments</p>
                        </div>
                        <div className="space-y-2 p-2">
                          {col.appts.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => openDetail(a)}
                              className={`block w-full rounded-lg border-l-[3px] p-2 text-left transition hover:-translate-y-0.5 ${a.bg}`}
                              style={{ borderLeftColor: a.color }}
                            >
                              <div className="mb-1 flex items-center gap-1.5">
                                <Avatar name={a.name} size="xs" />
                                <span className="truncate text-2xs font-semibold text-ink">{a.name}</span>
                              </div>
                              <p className="truncate text-2xs text-ink-subtle">{a.service}</p>
                              <p className="text-3xs text-ink-subtle">{a.time}</p>
                            </button>
                          ))}
                          {col.appts.length === 0 && (
                            <p className="px-1 py-6 text-center text-2xs text-ink-subtle">No appointments</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 border-t border-line py-3">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} /> {l.label}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* RIGHT */}
        <div className="space-y-6">
          {/* upcoming reminders */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Upcoming Reminders</h3>
              <button onClick={() => setView("list")} className="text-xs font-semibold text-brand-ink transition hover:underline">View All</button>
            </div>
            <ul className="space-y-3">
              {reminders.map((r) => (
                <li key={r.name}>
                  <button onClick={() => openReminder(r)} className="flex w-full items-center gap-3 rounded-lg text-left transition hover:bg-surface-hover/60 dark:hover:bg-white/5">
                    <Avatar name={r.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                      <p className="truncate text-xs text-ink-subtle">{r.service}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-2xs text-ink-subtle">{r.time}</span>
                      <Badge tone="brand">{r.badge}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* appointments by service */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Appointments by Service</h3>
              <Menu
                align="right"
                trigger={
                  <span className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                    {byServiceLabel}
                    <ChevronRight className="h-3.5 w-3.5 text-ink-subtle rotate-90" />
                  </span>
                }
              >
                <MenuItem onClick={() => setByServiceLabel("Today")}>Today</MenuItem>
                <MenuItem onClick={() => setByServiceLabel("This Week")}>This Week</MenuItem>
                <MenuItem onClick={() => setByServiceLabel("This Month")}>This Month</MenuItem>
              </Menu>
            </div>
            <div className="flex items-center gap-4">
              <DonutChart data={byService} centerValue={byServiceTotal} centerLabel="Total" size={130} thickness={16} />
              <ul className="flex-1 space-y-2">
                {byService.map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-ink-muted">{s.name}</span>
                    <span className="font-semibold text-ink-subtle">{s.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* cancellation prediction AI */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Cancellation Prediction (AI)</h3>
              <button onClick={() => setView("list")} className="text-xs font-semibold text-brand-ink transition hover:underline">View All</button>
            </div>
            <div className="flex items-center gap-4">
              <RadialGauge value={cancellation?.value ?? 12} color={cancellation?.color ?? "var(--color-brand-600)"} size={90} thickness={10} centerValue={cancellation?.center_value ?? "12%"} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-ink">{cancellation?.title ?? "High Risk Appointments"}</p>
                <p className="mt-1 text-xs text-ink-subtle">{cancellation?.note ?? "15 appointments likely to be cancelled. Take action now."}</p>
              </div>
            </div>
            <button onClick={() => setView("list")} className="btn btn-secondary btn-block mt-3">
              View High Risk
            </button>
          </Card>

          {/* average booking lead time */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Average Booking Lead Time</h3>
              <Menu
                align="right"
                trigger={
                  <span className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                    {leadLabel}
                    <ChevronRight className="h-3.5 w-3.5 text-ink-subtle rotate-90" />
                  </span>
                }
              >
                <MenuItem onClick={() => setLeadLabel("Today")}>Today</MenuItem>
                <MenuItem onClick={() => setLeadLabel("This Week")}>This Week</MenuItem>
                <MenuItem onClick={() => setLeadLabel("This Month")}>This Month</MenuItem>
              </Menu>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-ink">{leadTime?.value ?? "2.4"} <span className="text-base font-semibold text-ink-subtle">{leadTime?.unit ?? "Days"}</span></p>
                <p className="flex items-center gap-1 text-xs">
                  <ArrowDown className="h-3.5 w-3.5 text-status-danger-ink" />
                  <span className="font-semibold text-status-danger-ink">{leadTime?.delta ?? "8.2%"}</span>
                  <span className="text-ink-subtle">{leadTime?.note ?? "vs last month"}</span>
                </p>
              </div>
            </div>
            <div className="mt-2">
              <AreaTrend data={leadTrend} color="var(--color-brand-600)" height={60} showAxis={false} />
            </div>
          </Card>
        </div>
      </ResizableColumns>

      {/* ---------- New Appointment modal ---------- */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        icon={CalendarPlus}
        iconTone="brand"
        title="New Appointment"
        description="Schedule a new appointment."
        footer={
          <>
            <button onClick={() => setNewOpen(false)} className="btn btn-outline">Cancel</button>
            <button onClick={submitNew} className="btn btn-primary">Create Appointment</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Client Name"
            required
            placeholder="e.g. Priya Sharma"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Service"
            options={SERVICES}
            value={form.service}
            onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Start Time"
            type="time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          />
          <Select
            label="Duration"
            options={DURATIONS}
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
          />
          <Select
            label="Status"
            options={ALL_STATUSES}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ApptStatus }))}
          />
          <Textarea
            label="Notes"
            className="col-span-2"
            placeholder="Add any notes for this appointment…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ---------- Appointment detail modal ---------- */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        icon={CalendarClock}
        iconTone={detail ? STATUS_ICON_TONE[detail.status] : "brand"}
        title={detail?.name ?? ""}
        description={detail?.service ?? ""}
        footer={
          detail && (
            <>
              <button onClick={() => mutateStatus(detail._id, "Cancelled")} className="btn btn-danger">Cancel Appointment</button>
              <button onClick={() => mutateStatus(detail._id, "Rescheduled")} className="btn btn-outline">Reschedule</button>
              <button onClick={() => mutateStatus(detail._id, "Completed")} className="btn btn-secondary">Mark Complete</button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={detail.name} size="lg" />
              <div>
                <p className="text-base font-bold text-ink">{detail.name}</p>
                <p className="text-sm text-ink-subtle">{detail.service}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">Date</p>
                <p className="mt-0.5 font-semibold text-ink-muted">{detail.day}, {detail.date}</p>
              </div>
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">Time</p>
                <p className="mt-0.5 font-semibold text-ink-muted">{detail.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-subtle">Status</span>
              <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

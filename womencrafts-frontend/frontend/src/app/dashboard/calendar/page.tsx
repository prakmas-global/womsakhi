"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  User, Calendar} from "lucide-react";
import { Card, Input, Modal, Select, Textarea, NoResults, useConfirm, useToast } from "@/design-system";
import {
  apiListCalendarEvents,
  apiUpcomingEvents,
  apiCreateCalendarEvent,
  apiUpdateCalendarEvent,
  apiDeleteCalendarEvent,
  type ApiCalendarEvent,
} from "@/lib/calendar-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

type Category = "Career" | "Skills" | "Business" | "Wellness" | "Finance";

type EventChip = {
  id: number;
  label: string;
  time?: string;
  attendee?: string;
  notes?: string;
  category: Category;
  color: string;
  bg: string;
  text: string;
};

const CATEGORY_PRESET: Record<Category, { color: string; bg: string; text: string }> = {
  Career: { color: "var(--color-brand-300)", bg: "bg-brand-tint", text: "text-brand-ink" },
  Skills: { color: "var(--color-violet-500)", bg: "bg-violet-tint", text: "text-violet-ink" },
  Business: { color: "var(--status-ok-solid)", bg: "bg-status-ok-bg", text: "text-status-ok-ink" },
  Wellness: { color: "var(--status-warn-solid)", bg: "bg-status-warn-bg", text: "text-status-warn-ink" },
  Finance: { color: "var(--status-info-solid)", bg: "bg-status-info-bg", text: "text-status-info-ink" },
};

const CATEGORY_OPTIONS: Category[] = ["Career", "Skills", "Business", "Wellness", "Finance"];

// The app "lives" in May 2024 (month index 4, 0-based). Today is May 20, 2024.
const CURRENT_YEAR = 2024;
const CURRENT_MONTH = 4; // May (0-based)
const TODAY_DAY = 20;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Key events by `${year}-${month}-${day}` so navigating months shows the right chips.
function keyFor(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

type UpcomingItem = { title: string; when: string; attendee: string; color: string; eventId: number };

// Map an API event onto the calendar chip shape, deriving colour/bg/text from its
// category exactly the way the mock data did (CATEGORY_PRESET).
function toChip(e: ApiCalendarEvent): EventChip {
  const category = (CATEGORY_OPTIONS.includes(e.category as Category) ? e.category : "Career") as Category;
  return {
    id: e.id,
    label: e.title,
    time: e.time || undefined,
    attendee: e.attendee || undefined,
    notes: e.notes || undefined,
    category,
    ...CATEGORY_PRESET[category],
  };
}

// Group API events into the `${year}-${month}-${day}` keyed record the grid reads.
function groupByDay(list: ApiCalendarEvent[]): Record<string, EventChip[]> {
  const map: Record<string, EventChip[]> = {};
  for (const e of list) {
    const [y, mo, d] = e.date.split("-").map((n) => parseInt(n, 10));
    if (!y || !mo || !d) continue;
    (map[keyFor(y, mo - 1, d)] ??= []).push(toChip(e));
  }
  return map;
}

// Build a sidebar "Upcoming Events" row from an API event.
function toUpcoming(e: ApiCalendarEvent): UpcomingItem {
  const [, mo, d] = e.date.split("-").map((n) => parseInt(n, 10));
  const monthShort = MONTH_NAMES[mo - 1]?.slice(0, 3) ?? "";
  const category = (CATEGORY_OPTIONS.includes(e.category as Category) ? e.category : "Career") as Category;
  return {
    title: e.title,
    when: e.time ? `${monthShort} ${d} · ${prettyTime(e.time)}` : `${monthShort} ${d}`,
    attendee: e.attendee,
    color: CATEGORY_PRESET[category].color,
    eventId: e.id,
  };
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND: { label: Category; color: string }[] = [
  { label: "Career", color: "var(--color-brand-300)" },
  { label: "Skills", color: "var(--color-violet-500)" },
  { label: "Business", color: "var(--status-ok-solid)" },
  { label: "Wellness", color: "var(--status-warn-solid)" },
  { label: "Finance", color: "var(--status-info-solid)" },
];

type View = "Day" | "Week" | "Month";

// Build the calendar grid generically from year + month.
function buildCells(year: number, month: number): (number | null)[] {
  const leading = new Date(year, month, 1).getDay(); // 0..6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// zero-padded date string for <input type="date">
function toISODate(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// convert 24h/loose "13:30" -> "1:30 PM" for display; falls back to raw.
function prettyTime(t?: string) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

type FormState = {
  title: string;
  category: Category;
  date: string;
  time: string;
  attendee: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  category: "Career",
  date: "",
  time: "",
  attendee: "",
  notes: "",
};

export default function CalendarPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [events, setEvents] = useState<Record<string, EventChip[]>>({});
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [view, setView] = useState<View>("Month");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);

  // New/Edit event modal
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Event detail modal
  const [detail, setDetail] = useState<{ event: EventChip; dateKey: string } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Load every event (grid) + the upcoming-events sidebar from the backend.
  const refresh = useCallback(async () => {
    try {
      const [list, up] = await Promise.all([
        apiListCalendarEvents({ page_size: 100 }),
        apiUpcomingEvents({ limit: 4 }),
      ]);
      setEvents(groupByDay(list.items));
      setUpcoming(up.map(toUpcoming));
    } catch {
      /* leave current events; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cells = useMemo(() => buildCells(year, month), [year, month]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  // Chips for a given day in the currently-visible month, with category filter applied.
  const chipsForDay = (day: number): EventChip[] => {
    const all = events[keyFor(year, month, day)] ?? [];
    return categoryFilter ? all.filter((c) => c.category === categoryFilter) : all;
  };

  const isToday = (day: number) =>
    year === CURRENT_YEAR && month === CURRENT_MONTH && day === TODAY_DAY;

  const goToday = () => {
    setYear(CURRENT_YEAR);
    setMonth(CURRENT_MONTH);
    setSelectedDay(null);
    setView("Month");
  };

  const stepMonth = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  const openNewEvent = (day?: number | null) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      date: day != null ? toISODate(year, month, day) : selectedDay != null ? toISODate(year, month, selectedDay) : "",
    });
    setFormOpen(true);
  };

  const openEdit = (event: EventChip, dateKey: string) => {
    const [ey, em, ed] = dateKey.split("-").map((n) => parseInt(n, 10));
    setEditingId(event.id);
    setForm({
      title: event.label,
      category: event.category,
      date: toISODate(ey, em, ed),
      time: event.time ?? "",
      attendee: event.attendee ?? "",
      notes: event.notes ?? "",
    });
    setDetail(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.title.trim() || !form.date) return;
    const payload = {
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      time: form.time,
      attendee: form.attendee.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (editingId != null) {
        await apiUpdateCalendarEvent(editingId, payload);
      } else {
        await apiCreateCalendarEvent(payload);
      }
      await refresh();
      setFormOpen(false);
      setEditingId(null);
    } catch (err) {
      toast.error("Could not save the event", { description: memberError(err) });
    }
  };

  const deleteEvent = async (id: number) => {
    if (!(await confirm({
      title: "Delete this event?",
      description: "Anyone booked onto it will no longer see it.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    try {
      await apiDeleteCalendarEvent(id);
      await refresh();
      toast.success("Event deleted");
    } catch (err) {
      toast.error("Could not delete the event", { description: memberError(err) });
    }
    setDetail(null);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setView("Day");
  };

  const openDetailById = (id: number) => {
    for (const k of Object.keys(events)) {
      const found = events[k].find((c) => c.id === id);
      if (found) {
        setDetail({ event: found, dateKey: k });
        return;
      }
    }
  };

  // ----- Week view helpers: week that contains the selected (or today's / 1st) day -----
  const weekDays = useMemo(() => {
    const anchor = selectedDay ?? (year === CURRENT_YEAR && month === CURRENT_MONTH ? TODAY_DAY : 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekday = new Date(year, month, anchor).getDay();
    const start = anchor - weekday;
    return Array.from({ length: 7 }, (_, i) => {
      const d = start + i;
      return d >= 1 && d <= daysInMonth ? d : null;
    });
  }, [selectedDay, year, month]);

  const dayAgenda = useMemo(() => {
    const d = selectedDay ?? (year === CURRENT_YEAR && month === CURRENT_MONTH ? TODAY_DAY : 1);
    return { day: d, chips: chipsForDay(d) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, year, month, events, categoryFilter]);

  const chipClass = (c: EventChip) =>
    `flex items-center gap-1 rounded-md ${c.bg} px-1.5 py-0.5 text-3xs font-medium ${c.text}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Calendar</h1>
            <p className="mt-1 text-sm text-ink-subtle">View and manage your schedule at a glance.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-sm btn-outline" onClick={goToday}>
            Today
          </button>
          <div className="flex items-center gap-1">
            <button className="btn btn-sm btn-outline h-9 w-9" onClick={() => stepMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn btn-sm btn-outline h-9 w-9" onClick={() => stepMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-line-strong bg-surface p-0.5">
            {(["Day", "Week", "Month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  v === view ? "bg-brand-600 text-white" : "text-ink-subtle hover:bg-surface-hover"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => openNewEvent()}>
            <Plus className="h-4 w-4" /> New Event
          </button>
        </div>
      </div>

      <ResizableColumns id="calendar" defaultSize={0.75} className="gap-6">
        {/* Month grid */}
        <Card>
          <div className="mb-4 flex items-center justify-center gap-4">
            <button className="btn btn-sm btn-outline h-8 w-8" onClick={() => stepMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">{monthLabel}</h2>
            <button className="btn btn-sm btn-outline h-8 w-8" onClick={() => stepMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading && (
            <div className="flex min-h-80 items-center justify-center text-sm text-ink-subtle">
              Loading events…
            </div>
          )}

          {!loading && view === "Month" && (
            <div className="grid grid-cols-7 gap-1.5" ref={gridRef}>
              {DAY_HEADERS.map((d) => (
                <div key={d} className="pb-2 text-center text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {d}
                </div>
              ))}
              {cells.map((day, i) => {
                const chips = day ? chipsForDay(day) : undefined;
                const today = day ? isToday(day) : false;
                const selected = day != null && day === selectedDay;
                return (
                  <div
                    key={i}
                    onClick={day ? () => handleDayClick(day) : undefined}
                    className={`min-h-20 rounded-lg border p-1.5 ${
                      day ? "cursor-pointer border-line bg-surface hover:border-brand-200" : "border-transparent bg-surface-inset/40"
                    } ${today ? "ring-2 ring-brand-500 ring-offset-0" : ""} ${
                      selected && !today ? "ring-2 ring-brand-300 ring-offset-0 bg-brand-tint/40" : ""
                    }`}
                  >
                    {day && (
                      <>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                            today ? "bg-brand-600 text-white" : "text-ink-muted"
                          }`}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {chips?.map((c) => (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetail({ event: c, dateKey: keyFor(year, month, day) });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDetail({ event: c, dateKey: keyFor(year, month, day) });
                                }
                              }}
                              className={`${chipClass(c)} cursor-pointer transition hover:brightness-95`}
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                              <span className="truncate">{c.label}</span>
                              {c.time && <span className="ml-auto shrink-0 opacity-70">{c.time}</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && view === "Week" && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day, i) => {
                const chips = day ? chipsForDay(day) : undefined;
                const today = day ? isToday(day) : false;
                const selected = day != null && day === selectedDay;
                return (
                  <div key={i} className="flex flex-col">
                    <div className="pb-2 text-center text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {DAY_HEADERS[i]}
                    </div>
                    <div
                      onClick={day ? () => handleDayClick(day) : undefined}
                      className={`min-h-64 rounded-lg border p-1.5 ${
                        day ? "cursor-pointer border-line bg-surface hover:border-brand-200" : "border-transparent bg-surface-inset/40"
                      } ${today ? "ring-2 ring-brand-500 ring-offset-0" : ""} ${
                        selected && !today ? "ring-2 ring-brand-300 ring-offset-0 bg-brand-tint/40" : ""
                      }`}
                    >
                      {day && (
                        <>
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                              today ? "bg-brand-600 text-white" : "text-ink-muted"
                            }`}
                          >
                            {day}
                          </span>
                          <div className="mt-1 space-y-1">
                            {chips?.map((c) => (
                              <div
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetail({ event: c, dateKey: keyFor(year, month, day) });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDetail({ event: c, dateKey: keyFor(year, month, day) });
                                  }
                                }}
                                className={`${chipClass(c)} cursor-pointer transition hover:brightness-95`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                                <span className="truncate">{c.label}</span>
                                {c.time && <span className="ml-auto shrink-0 opacity-70">{c.time}</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && view === "Day" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-ink">
                  {MONTH_NAMES[month]} {dayAgenda.day}, {year}
                </h3>
                <button className="btn btn-sm btn-outline" onClick={() => openNewEvent(dayAgenda.day)}>
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
              {dayAgenda.chips.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line-strong bg-surface-inset/40 p-8 text-center text-sm text-ink-subtle">
                  No events scheduled for this day.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {dayAgenda.chips.map((c) => (
                    <li
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetail({ event: c, dateKey: keyFor(year, month, dayAgenda.day) })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetail({ event: c, dateKey: keyFor(year, month, dayAgenda.day) });
                        }
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-line border-l-4 bg-surface p-3 transition hover:border-brand-200"
                      style={{ borderLeftColor: c.color }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{c.label}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {c.time ? prettyTime(c.time) : "All day"}
                          {c.attendee ? ` · ${c.attendee}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-md ${c.bg} px-2 py-0.5 text-3xs font-semibold ${c.text}`}
                      >
                        {c.category}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Legend</h2>
            <ul className="space-y-2.5">
              {LEGEND.map((l) => {
                const active = categoryFilter === l.label;
                return (
                  <li key={l.label}>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter((cur) => (cur === l.label ? null : l.label))}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        active
                          ? "bg-brand-tint font-semibold text-brand-ink ring-1 ring-brand-200"
                          : "text-ink-muted hover:bg-surface-hover"
                      } ${categoryFilter && !active ? "opacity-45" : ""}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            {categoryFilter && (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="mt-3 text-xs font-semibold text-brand-ink hover:underline"
              >
                Clear filter
              </button>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Upcoming Events</h2>
              <button
                type="button"
                className="text-xs font-semibold text-brand-ink transition hover:underline"
                onClick={() => {
                  setView("Month");
                  gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                View All
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-ink-subtle">Loading…</p>
            ) : upcoming.length === 0 ? (
              <NoResults icon={Calendar} thing="upcoming events" compact
                description="Scheduled events will appear here." />
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((e) => (
                  <li
                    key={e.eventId}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetailById(e.eventId)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        openDetailById(e.eventId);
                      }
                    }}
                    className="cursor-pointer rounded-lg border border-line border-l-4 bg-surface p-3 transition hover:border-brand-200"
                    style={{ borderLeftColor: e.color }}
                  >
                    <p className="text-sm font-semibold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">{e.when}</p>
                    <p className="mt-1 text-xs font-medium text-ink-subtle">{e.attendee}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </ResizableColumns>

      {/* New / Edit event modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId != null ? "Edit Event" : "New Event"}
        description={editingId != null ? "Update the details of this event." : "Schedule a new event on your calendar."}
        icon={CalendarPlus}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitForm}>
              {editingId != null ? "Save Changes" : "Add Event"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Event Title"
            required
            className="col-span-2"
            placeholder="e.g. Career Counseling"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
          />
          <Input
            label="Attendee"
            placeholder="e.g. Priya Sharma"
            value={form.attendee}
            onChange={(e) => setForm((f) => ({ ...f, attendee: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Time"
            type="time"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          />
          <Textarea
            label="Notes"
            className="col-span-2"
            placeholder="Optional notes about the event…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Event detail modal */}
      <Modal
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail?.event.label ?? "Event"}
        icon={CalendarDays}
        iconTone="brand"
        footer={
          detail && (
            <>
              <button className="btn btn-outline text-status-danger-ink" onClick={() => deleteEvent(detail.event.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button className="btn btn-primary" onClick={() => openEdit(detail.event, detail.dateKey)}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md ${detail.event.bg} px-2.5 py-1 text-xs font-semibold ${detail.event.text}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: detail.event.color }} />
                {detail.event.category}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-ink-muted">
              <CalendarDays className="h-4 w-4 text-ink-subtle" />
              {(() => {
                const [dy, dm, dd] = detail.dateKey.split("-").map((n) => parseInt(n, 10));
                return `${MONTH_NAMES[dm]} ${dd}, ${dy}`;
              })()}
            </div>
            {detail.event.time && (
              <div className="flex items-center gap-2.5 text-sm text-ink-muted">
                <Clock className="h-4 w-4 text-ink-subtle" />
                {prettyTime(detail.event.time)}
              </div>
            )}
            {detail.event.attendee && (
              <div className="flex items-center gap-2.5 text-sm text-ink-muted">
                <User className="h-4 w-4 text-ink-subtle" />
                {detail.event.attendee}
              </div>
            )}
            {detail.event.notes && (
              <p className="rounded-lg bg-surface-inset p-3 text-sm text-ink-muted">{detail.event.notes}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

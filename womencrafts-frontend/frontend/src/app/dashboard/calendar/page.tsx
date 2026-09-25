"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, User, ExternalLink,
  RotateCcw, Loader2,
} from "lucide-react";

import { Badge, Card, Input, Modal, Select, Textarea, useConfirm, useToast } from "@/design-system";
import {
  apiCalendarAgenda, apiCalendarUpcoming, apiCreateCalendarEvent, apiUpdateCalendarEvent, apiDeleteCalendarEvent,
  type AgendaItem, type AgendaSource,
} from "@/lib/calendar-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Calendar — everything that has a date, on one grid.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * The grid shows the month you are actually in, and on it the platform's real
 * dated things: members' bookings, published events, programme starts and
 * ends, and the staff's own entries. The first three are read-only here and
 * link to the screen that owns them; staff entries are created, edited and
 * deleted here, and every change is recorded.
 *
 * The old calendar lived in May 2024 — its "today" was a constant — and
 * showed five seeded appointments with invented attendees while 139 real
 * bookings sat in the database unseen.
 */

type Category = "Career" | "Skills" | "Business" | "Wellness" | "Finance";
const CATEGORY_OPTIONS: Category[] = ["Career", "Skills", "Business", "Wellness", "Finance"];

const SOURCES: { key: AgendaSource; label: string; color: string; href: string }[] = [
  { key: "booking", label: "Bookings", color: "#e6117e", href: "/dashboard/appointments" },
  { key: "event", label: "Events", color: "#8b5cf6", href: "/dashboard/events" },
  { key: "programme", label: "Programmes", color: "#22c55e", href: "/dashboard/programs" },
  { key: "staff", label: "Staff entries", color: "#3b82f6", href: "" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function buildCells(year: number, month: number): (number | null)[] {
  const leading = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: leading }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function prettyTime(t?: string) {
  if (!t) return "";
  if (/[ap]m/i.test(t)) return t;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}
function prettyDate(d: string) {
  const [y, mo, day] = d.split("-").map((n) => parseInt(n, 10));
  if (!y || !mo || !day) return d;
  return `${MONTH_NAMES[mo - 1]?.slice(0, 3)} ${day}, ${y}`;
}
const STATUS_TONE: Record<string, "emerald" | "amber" | "rose" | "sky" | "slate"> = {
  upcoming: "sky", confirmed: "sky", completed: "emerald", cancelled: "rose", no_show: "rose", published: "emerald", draft: "amber",
};

type FormState = { title: string; category: Category; date: string; time: string; attendee: string; notes: string };
const EMPTY_FORM: FormState = { title: "", category: "Career", date: "", time: "", attendee: "", notes: "" };

export default function CalendarPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const now = useMemo(() => new Date(), []);
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [counts, setCounts] = useState<Partial<Record<AgendaSource, number>>>({});
  const [upcoming, setUpcoming] = useState<AgendaItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [enabled, setEnabled] = useState<Set<AgendaSource>>(new Set(["booking", "event", "programme", "staff"]));
  const [selectedDay, setSelectedDay] = useState<string>(todayIso);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<AgendaItem | null>(null);

  const monthStart = iso(year, month, 1);
  const monthEnd = iso(year, month, new Date(year, month + 1, 0).getDate());

  useEffect(() => {
    let live = true;
    setLoading(true);
    apiCalendarAgenda(monthStart, monthEnd)
      .then((a) => { if (!live) return; setItems(a.items); setCounts(a.counts); setLoadError(""); })
      .catch((err) => { if (live) setLoadError(memberError(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [monthStart, monthEnd, reloadKey]);

  useEffect(() => {
    let live = true;
    apiCalendarUpcoming(30, 8).then((a) => { if (live) setUpcoming(a.items); }).catch(() => { if (live) setUpcoming([]); });
    return () => { live = false; };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const visible = useMemo(() => items.filter((i) => enabled.has(i.source)), [items, enabled]);
  const byDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const i of visible) (map[i.date] ??= []).push(i);
    return map;
  }, [visible]);
  const dayItems = byDay[selectedDay] ?? [];

  const cells = buildCells(year, month);
  const goPrev = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const goNext = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDay(todayIso); };
  const toggleSource = (s: AgendaSource) => setEnabled((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  // ---- staff entries ----
  const staffId = (i: AgendaItem) => (i.source === "staff" ? parseInt(i.key.split(":")[1], 10) : null);
  const openAdd = (date?: string) => { setEditingId(null); setForm({ ...EMPTY_FORM, date: date ?? selectedDay }); setFormOpen(true); };
  const openEdit = (i: AgendaItem) => {
    const id = staffId(i);
    if (id === null) return;
    setEditingId(id);
    setForm({ title: i.title, category: (CATEGORY_OPTIONS.includes(i.category as Category) ? i.category : "Career") as Category, date: i.date, time: i.time, attendee: i.subtitle, notes: "" });
    setDetail(null);
    setFormOpen(true);
  };
  const submit = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      if (editingId !== null) { await apiUpdateCalendarEvent(editingId, { ...form, title: form.title.trim() }); toast.success(`“${form.title.trim()}” updated`); }
      else { await apiCreateCalendarEvent({ ...form, title: form.title.trim() }); toast.success(`“${form.title.trim()}” added`, { description: prettyDate(form.date) }); }
      setFormOpen(false);
      setSelectedDay(form.date);
      const [y, mo] = form.date.split("-").map((n) => parseInt(n, 10));
      if (y && mo) { setYear(y); setMonth(mo - 1); }
      reload();
    } catch (err) {
      toast.error("Could not save the entry", { description: memberError(err) });
    } finally {
      setSaving(false);
    }
  };
  const remove = async (i: AgendaItem) => {
    const id = staffId(i);
    if (id === null) return;
    const ok = await confirm({ title: `Delete “${i.title}”?`, description: "Only this staff entry goes; nothing else on the calendar changes.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await apiDeleteCalendarEvent(id);
      setDetail(null);
      toast.success("Entry deleted");
      reload();
    } catch (err) {
      toast.error("Could not delete it", { description: memberError(err) });
    }
  };

  const total = visible.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><CalendarDays className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Calendar</h1>
            <p className="mt-1 text-sm text-ink-subtle">Bookings, events, programme dates and your own entries, on one grid.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd()}><CalendarPlus className="h-4 w-4" /> New entry</button>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load the calendar: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={reload}><RotateCcw className="h-3.5 w-3.5" /> Try again</button>
        </div>
      )}

      <ResizableColumns id="calendar" defaultSize={0.72} className="gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button aria-label="Previous month" className="btn btn-sm btn-outline" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></button>
              <h2 className="min-w-[11rem] text-center font-display text-lg font-semibold text-ink">{MONTH_NAMES[month]} {year}</h2>
              <button aria-label="Next month" className="btn btn-sm btn-outline" onClick={goNext}><ChevronRight className="h-4 w-4" /></button>
              <button className="btn btn-sm btn-ghost" onClick={goToday}>Today</button>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-subtle" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSource(s.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${enabled.has(s.key) ? "border-line-strong bg-surface text-ink" : "border-line text-ink-subtle opacity-60"}`}
                  aria-pressed={enabled.has(s.key)}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
                  <span className="tabular-nums text-ink-subtle">{counts[s.key] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {DAY_HEADERS.map((d) => <div key={d} className="bg-surface-2 px-2 py-2 text-center text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{d}</div>)}
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} className="min-h-[92px] bg-surface-2/60" />;
              const key = iso(year, month, day);
              const list = byDay[key] ?? [];
              const isToday = key === todayIso;
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  onDoubleClick={() => openAdd(key)}
                  className={`flex min-h-[92px] flex-col items-stretch gap-1 bg-surface p-1.5 text-left transition hover:bg-surface-hover ${isSelected ? "ring-2 ring-inset ring-brand-400" : ""}`}
                >
                  <span className={`self-end rounded-full px-1.5 text-xs font-semibold ${isToday ? "bg-brand-600 text-white" : "text-ink-subtle"}`}>{day}</span>
                  {list.slice(0, 3).map((i) => (
                    <span key={i.key} className="truncate rounded-md px-1.5 py-0.5 text-2xs font-medium text-ink" style={{ background: `${i.color}22`, borderLeft: `3px solid ${i.color}` }} title={`${i.title}${i.time ? ` · ${prettyTime(i.time)}` : ""}`}>
                      {i.time ? <span className="text-ink-subtle">{prettyTime(i.time).replace(/\s?[AP]M/i, "")} </span> : null}{i.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="px-1 text-2xs text-ink-subtle">+{list.length - 3} more</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            {loading ? "Loading…" : total === 0 ? "Nothing on the calendar this month for the sources selected." : `${total} item${total === 1 ? "" : "s"} this month. Tap a day to see it; double-tap to add an entry.`}
          </p>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">{selectedDay === todayIso ? "Today" : prettyDate(selectedDay)}</h2>
                <p className="text-xs text-ink-subtle">{dayItems.length === 0 ? "Nothing scheduled" : `${dayItems.length} item${dayItems.length === 1 ? "" : "s"}`}</p>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => openAdd(selectedDay)}><Plus className="h-3.5 w-3.5" /> Entry</button>
            </div>
            {dayItems.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">No bookings, events, programme dates or entries on this day.</p>
            ) : (
              <ul className="space-y-2">
                {dayItems.map((i) => (
                  <li key={i.key}>
                    <button type="button" onClick={() => setDetail(i)} className="flex w-full items-start gap-2.5 rounded-xl border border-line p-2.5 text-left hover:bg-surface-hover">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{i.title}</span>
                        <span className="block text-xs text-ink-subtle">{[prettyTime(i.time), i.subtitle].filter(Boolean).join(" · ") || i.category}</span>
                      </span>
                      {i.status && <Badge tone={STATUS_TONE[i.status.toLowerCase()] ?? "slate"}>{i.status.replace("_", " ")}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-base font-semibold text-ink">Coming up</h2>
            <p className="mb-3 text-xs text-ink-subtle">The next 30 days, across everything.</p>
            {upcoming === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : upcoming.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nothing in the next 30 days.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((i) => (
                  <li key={i.key}>
                    <button type="button" onClick={() => { setDetail(i); }} className="flex w-full items-start gap-2.5 text-left">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: i.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-muted">{i.title}</span>
                        <span className="block text-xs text-ink-subtle">{prettyDate(i.date)}{i.time ? ` · ${prettyTime(i.time)}` : ""}{i.subtitle ? ` · ${i.subtitle}` : ""}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">Legend</h2>
            <ul className="space-y-1.5 text-xs">
              {SOURCES.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
                  {s.href ? <Link href={s.href} className="text-brand-ink hover:underline">Manage</Link> : <span className="text-ink-subtle">Edited here</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      {/* Detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ""}
        description={detail ? `${prettyDate(detail.date)}${detail.time ? ` · ${prettyTime(detail.time)}` : ""}` : undefined}
        icon={detail?.source === "staff" ? CalendarDays : ExternalLink}
        iconTone="brand"
        size="sm"
        footer={
          detail && (detail.source === "staff" ? (
            <>
              <button className="btn btn-outline text-status-danger-ink" onClick={() => void remove(detail)}><Trash2 className="h-4 w-4" /> Delete</button>
              <button className="btn btn-primary" onClick={() => openEdit(detail)}><Pencil className="h-4 w-4" /> Edit</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              <Link href={detail.href} className="btn btn-primary"><ExternalLink className="h-4 w-4" /> Open in {SOURCES.find((s) => s.key === detail.source)?.label ?? "its screen"}</Link>
            </>
          ))
        }
      >
        {detail && (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-ink-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: detail.color }} /> {SOURCES.find((s) => s.key === detail.source)?.label}{detail.source === "staff" ? ` · ${detail.category}` : ""}</p>
            {detail.time && <p className="flex items-center gap-2 text-ink-muted"><Clock className="h-4 w-4 text-ink-subtle" /> {prettyTime(detail.time)}</p>}
            {detail.subtitle && <p className="flex items-center gap-2 text-ink-muted"><User className="h-4 w-4 text-ink-subtle" /> {detail.subtitle}</p>}
            {detail.status && <p className="text-xs text-ink-subtle">Status: {detail.status.replace("_", " ")}</p>}
            {detail.source !== "staff" && <p className="text-xs text-ink-subtle">This is read-only here. Change it on its own screen.</p>}
          </div>
        )}
      </Modal>

      {/* Add / edit staff entry */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId !== null ? "Edit entry" : "New entry"}
        description="A note on the staff calendar. Members do not see it."
        icon={CalendarPlus}
        iconTone="brand"
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !form.title.trim() || !form.date} onClick={() => void submit()}>{saving ? "Saving…" : editingId !== null ? "Save changes" : "Add entry"}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" required className="col-span-2" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Partner visit" />
          <Select label="Category" options={CATEGORY_OPTIONS} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))} />
          <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Time" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          <Input label="With" value={form.attendee} onChange={(e) => setForm((f) => ({ ...f, attendee: e.target.value }))} placeholder="Who it is with (optional)" />
          <Textarea label="Notes" className="col-span-2" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Anything the team should know (optional)" />
        </div>
      </Modal>
    </div>
  );
}

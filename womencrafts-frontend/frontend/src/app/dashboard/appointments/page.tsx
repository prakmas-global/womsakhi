"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, CalendarX2, Check,
  Clock, History, MoreHorizontal, Phone, RefreshCw, Search, ShieldCheck, StickyNote, Trash2, UserX,
} from "lucide-react";
import {
  Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner, StatCard, Tabs, Textarea,
  type Tone, useConfirm, useToast,
} from "@/design-system";
import {
  apiAddAppointmentNote, apiAdminAppointmentStats, apiAdminAppointments, apiCancelAppointment,
  apiCompleteAppointment, apiConfirmAppointment, apiCreateStaffAppointment, apiDeleteAppointment,
  apiNoShowAppointment, apiRescheduleAppointment,
  type AdminAppointment, type AdminAppointmentList, type AdminAppointmentStats, type AdminApptStatus,
  type ApptScope, type ApptSource, type StaffAppointmentInput,
} from "@/lib/appointments-api";
import { memberError } from "@/lib/member-api";
import { AdminLoading } from "@/components/admin/AdminPage";

/**
 * Every session on the platform, and what to do about each one.
 *
 * ── Two sources, one list ───────────────────────────────────────────────────
 * Members book sessions themselves in the member app; staff enter the rest by
 * hand (a walk-in, a phone call). Both show here as one list. A member's row
 * says so, and the one thing an admin cannot do to it is delete it — her
 * booking is her record, so it is cancelled with a reason she will read.
 *
 * ── What used to be here ────────────────────────────────────────────────────
 * A calendar of one fixed week in May 2024, eighteen made-up names, a
 * "Cancellation Prediction (AI)" gauge that was arithmetic on a fixture, and
 * stat cards with deltas nobody had measured. Every figure on this screen now
 * comes from the API, and every empty state says what is actually empty.
 */

const IST = "Asia/Kolkata";
const PAGE_SIZE = 25;

const STATUS_TONE: Record<AdminApptStatus, Tone> = {
  booked: "amber",
  confirmed: "violet",
  completed: "emerald",
  cancelled: "rose",
  no_show: "slate",
};

const STATUS_OPTIONS: { value: AdminApptStatus | ""; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "booked", label: "Awaiting confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const SOURCE_OPTIONS: { value: ApptSource | ""; label: string }[] = [
  { value: "", label: "Booked by anyone" },
  { value: "member", label: "Members' own bookings" },
  { value: "staff", label: "Entered by staff" },
];

const DURATIONS = ["30 min", "45 min", "60 min", "90 min", "120 min"];
const MODES: ("In person" | "Online")[] = ["In person", "Online"];

const EMPTY_COUNTS: Record<ApptScope, number> = { today: 0, upcoming: 0, past: 0, all: 0 };

const BLANK_FORM: StaffAppointmentInput = {
  name: "", phone: "", service: "", date: "", time: "", duration: "60 min", mode: "In person", with_whom: "", note: "",
};

/* ── formatting ──────────────────────────────────────────────────────────── */

function fmtDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtClock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
}

function fmtStamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "in 2h 15m", "in 3 days", "2 days ago" — relative to now, floored to what matters. */
function relative(iso: string | null, now: number): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  let text: string;
  if (mins < 1) text = "now";
  else if (mins < 60) text = `${mins} min`;
  else if (mins < 24 * 60) text = `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ""}`.trim();
  else text = `${Math.round(mins / (24 * 60))} day${Math.round(mins / (24 * 60)) === 1 ? "" : "s"}`;
  if (text === "now") return text;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/** "02:30 PM" → "14:30", for an <input type="time">. */
function toInputTime(label: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(label.trim());
  if (!m) return "";
  let h = Number(m[1]);
  const mer = (m[3] ?? "").toUpperCase();
  if (mer === "PM" && h < 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function When({ a, now }: { a: AdminAppointment; now: number }) {
  if (a.undated) {
    return (
      <div>
        <p className="text-sm font-semibold text-ink-muted">{a.date || "No date"}{a.time ? `, ${a.time}` : ""}</p>
        <p className="text-2xs text-amber-700">No year on record — open it to set a real date</p>
      </div>
    );
  }
  return (
    <div>
      <p className="whitespace-nowrap text-sm font-semibold text-ink">{fmtDay(a.starts_at)}</p>
      <p className="whitespace-nowrap text-xs text-ink-subtle">
        {fmtClock(a.starts_at)}{a.duration ? ` · ${a.duration}` : ""}
        <span className="ml-1.5 text-ink-faint">{relative(a.starts_at, now)}</span>
      </p>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

function AppointmentsInner() {
  const toast = useToast();
  const confirm = useConfirm();
  // The dashboard's tiles link here as ?status=completed|scheduled|cancelled.
  const linked = useSearchParams().get("status");

  const [stats, setStats] = useState<AdminAppointmentStats | null>(null);
  const [list, setList] = useState<AdminAppointmentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Bumped after every write; both loaders re-run on it. */
  const [reloadKey, setReloadKey] = useState(0);

  const [scope, setScope] = useState<ApptScope>(() =>
    linked === "completed" || linked === "cancelled" ? "all" : "upcoming");
  const [statusFilter, setStatusFilter] = useState<AdminApptStatus | "">(() =>
    linked === "completed" ? "completed" : linked === "cancelled" ? "cancelled" : "");
  const [serviceFilter, setServiceFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ApptSource | "">("");
  const [undatedOnly, setUndatedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AdminAppointment | null>(null);
  const [moving, setMoving] = useState<AdminAppointment | null>(null);
  const [moveForm, setMoveForm] = useState({ date: "", time: "" });
  const [cancelling, setCancelling] = useState<AdminAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StaffAppointmentInput>(BLANK_FORM);
  const [busy, setBusy] = useState(false);

  // Search waits for typing to pause; relative times tick once a minute.
  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await apiAdminAppointmentStats();
        if (alive) setStats(s);
      } catch (e) {
        if (alive) toast.error("Could not load the figures", { description: memberError(e) });
      }
    })();
    return () => { alive = false; };
  }, [reloadKey, toast]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await apiAdminAppointments({
          scope,
          status: statusFilter || undefined,
          service: serviceFilter || undefined,
          source: sourceFilter || undefined,
          undated: undatedOnly || undefined,
          q: q || undefined,
          page,
          page_size: PAGE_SIZE,
        });
        if (!alive) return;
        setList(data);
        setFailed(false);
      } catch (e) {
        if (!alive) return;
        setFailed(true);
        toast.error("Could not load appointments", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, statusFilter, serviceFilter, sourceFilter, undatedOnly, q, page, reloadKey, toast]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // A filter change starts again from page 1; the page is reset where the
  // filter changes rather than in an effect that reacts to it.
  const changeScope = (v: ApptScope) => { setScope(v); setPage(1); };
  const changeStatus = (v: AdminApptStatus | "") => { setStatusFilter(v); setPage(1); };
  const changeService = (v: string) => { setServiceFilter(v); setPage(1); };
  const changeSource = (v: ApptSource | "") => { setSourceFilter(v); setPage(1); };
  const clearFilters = () => {
    setStatusFilter(""); setServiceFilter(""); setSourceFilter(""); setUndatedOnly(false); setQuery(""); setPage(1);
  };

  /** After a write: keep the open dialog in step with the row that came back. */
  const applied = useCallback((updated: AdminAppointment | null) => {
    if (updated) setDetail((d) => (d && d.ref === updated.ref ? updated : d));
    refresh();
  }, [refresh]);

  const filtersOn = !!(statusFilter || serviceFilter || sourceFilter || undatedOnly || q);
  const counts = list?.counts ?? EMPTY_COUNTS;
  const items = useMemo(() => list?.items ?? [], [list]);

  const serviceOptions = useMemo(
    () => [{ value: "", label: "All services" }, ...(stats?.services ?? []).map((s) => ({ value: s, label: s }))],
    [stats],
  );

  /* ── actions ─────────────────────────────────────────────────────────── */

  const doConfirm = useCallback(async (a: AdminAppointment) => {
    try {
      const r = await apiConfirmAppointment(a.ref);
      toast.success(`${a.name}'s ${a.service} is confirmed`);
      applied(r);
    } catch (e) {
      toast.error("Could not confirm it", { description: memberError(e) });
    }
  }, [applied, toast]);

  const doComplete = useCallback(async (a: AdminAppointment) => {
    const ok = await confirm({
      title: `Mark ${a.name}'s ${a.service} as completed?`,
      description: "It moves to Past and counts as a session she attended.",
      confirmLabel: "Mark completed",
    });
    if (!ok) return;
    try {
      const r = await apiCompleteAppointment(a.ref);
      toast.success("Marked completed");
      applied(r);
    } catch (e) {
      toast.error("Could not mark it completed", { description: memberError(e) });
    }
  }, [applied, confirm, toast]);

  const doNoShow = useCallback(async (a: AdminAppointment) => {
    const ok = await confirm({
      title: `Record that ${a.name} did not attend?`,
      description: a.source === "member"
        ? "It is recorded as a cancellation with the reason \"Did not attend\", and she will see that reason on her bookings."
        : "It is recorded as a cancellation with the reason \"Did not attend\".",
      confirmLabel: "Record no-show",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await apiNoShowAppointment(a.ref);
      toast.success("Recorded as a no-show");
      applied(r);
    } catch (e) {
      toast.error("Could not record that", { description: memberError(e) });
    }
  }, [applied, confirm, toast]);

  const doDelete = useCallback(async (a: AdminAppointment) => {
    const ok = await confirm({
      title: `Delete this entry for ${a.name}?`,
      description: "It was entered by staff, so nobody else is relying on it. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteAppointment(a.ref);
      toast.success("Entry deleted");
      setDetail((d) => (d && d.ref === a.ref ? null : d));
      refresh();
    } catch (e) {
      toast.error("Could not delete it", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  const openMove = useCallback((a: AdminAppointment) => {
    setMoveForm({ date: a.undated ? "" : a.date, time: toInputTime(a.time) });
    setMoving(a);
  }, []);

  const submitMove = useCallback(async () => {
    if (!moving) return;
    if (!moveForm.date || !moveForm.time) {
      toast.error("Pick both a date and a time");
      return;
    }
    setBusy(true);
    try {
      const r = await apiRescheduleAppointment(moving.ref, moveForm);
      toast.success(`Moved to ${fmtDay(r.starts_at)}, ${fmtClock(r.starts_at)}`);
      setMoving(null);
      applied(r);
    } catch (e) {
      toast.error("Could not move it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [applied, moveForm, moving, toast]);

  const openCancel = useCallback((a: AdminAppointment) => {
    setCancelReason("");
    setCancelling(a);
  }, []);

  const submitCancel = useCallback(async () => {
    if (!cancelling) return;
    if (cancelReason.trim().length < 3) {
      toast.error("Say why", { description: cancelling.source === "member" ? "She will read this reason." : "It goes on the record." });
      return;
    }
    setBusy(true);
    try {
      const r = await apiCancelAppointment(cancelling.ref, cancelReason.trim());
      toast.success("Appointment cancelled");
      setCancelling(null);
      applied(r);
    } catch (e) {
      toast.error("Could not cancel it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [applied, cancelReason, cancelling, toast]);

  const submitNote = useCallback(async () => {
    if (!detail || !noteText.trim()) return;
    setBusy(true);
    try {
      const r = await apiAddAppointmentNote(detail.ref, noteText.trim());
      setNoteText("");
      setDetail(r);
      toast.success("Note added");
    } catch (e) {
      toast.error("Could not add the note", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [detail, noteText, toast]);

  const openCreate = useCallback(() => {
    setForm({ ...BLANK_FORM, service: stats?.services[0] ?? "" });
    setCreating(true);
  }, [stats]);

  const submitCreate = useCallback(async () => {
    if (!form.name.trim() || !form.service.trim() || !form.date || !form.time) {
      toast.error("Name, service, date and time are all needed");
      return;
    }
    setBusy(true);
    try {
      const r = await apiCreateStaffAppointment({ ...form, name: form.name.trim(), service: form.service.trim() });
      toast.success(`${r.name} is in for ${fmtDay(r.starts_at)}, ${fmtClock(r.starts_at)}`);
      setCreating(false);
      refresh();
    } catch (e) {
      toast.error("Could not add it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [form, refresh, toast]);

  /* ── row menu ────────────────────────────────────────────────────────── */

  const rowActions = (a: AdminAppointment) => {
    const open = a.status === "booked" || a.status === "confirmed";
    return (
      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
        <MenuItem icon={CalendarClock} onClick={() => { setNoteText(""); setDetail(a); }}>Open</MenuItem>
        {a.status === "booked" && <MenuItem icon={ShieldCheck} onClick={() => void doConfirm(a)}>Confirm</MenuItem>}
        {open && <MenuItem icon={RefreshCw} onClick={() => openMove(a)}>Reschedule</MenuItem>}
        {open && <MenuItem icon={CalendarCheck} onClick={() => void doComplete(a)}>Mark completed</MenuItem>}
        {open && <MenuItem icon={UserX} onClick={() => void doNoShow(a)}>Record no-show</MenuItem>}
        {open && <MenuItem icon={CalendarX2} danger onClick={() => openCancel(a)}>Cancel…</MenuItem>}
        {a.source === "staff" && <MenuItem icon={Trash2} danger onClick={() => void doDelete(a)}>Delete entry</MenuItem>}
      </Menu>
    );
  };

  const emptyTitle = filtersOn
    ? "Nothing matches"
    : scope === "today" ? "Nothing on today"
    : scope === "upcoming" ? "No upcoming appointments"
    : scope === "past" ? "No past appointments yet"
    : "No appointments yet";
  const emptyNote = filtersOn
    ? "Try a different search, or clear the filters."
    : scope === "upcoming" || scope === "all"
    ? "Members' bookings appear here the moment they book. Staff can enter one by hand with the button above."
    : scope === "today" ? "Nothing is scheduled for today in Indian time."
    : "Completed, cancelled and past sessions will collect here.";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Appointments</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every session members booked, and the ones staff entered by hand. Times are Indian time.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <CalendarPlus className="h-4 w-4" /> New appointment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Today" value={String(stats?.today ?? 0)} icon={CalendarDays} tone="brand"
                  deltaNote={stats ? (stats.today === 0 ? "Nothing scheduled" : stats.today_unconfirmed > 0 ? `${stats.today_unconfirmed} still to confirm` : "All confirmed") : "…"} />
        <StatCard label="Upcoming" value={String(stats?.upcoming ?? 0)} icon={CalendarClock} tone="violet"
                  deltaNote="From now on, still on" />
        <StatCard label="Awaiting confirmation" value={String(stats?.needs_confirmation ?? 0)} icon={ShieldCheck}
                  tone={(stats?.needs_confirmation ?? 0) > 0 ? "amber" : "emerald"}
                  deltaNote={(stats?.needs_confirmation ?? 0) > 0 ? "Booked, nobody has confirmed" : "Everything ahead is confirmed"} />
        <StatCard label="Completed" value={String(stats?.completed_30d ?? 0)} icon={CalendarCheck} tone="emerald"
                  deltaNote="Last 30 days" />
        <StatCard label="Cancelled or missed" value={String(stats?.missed_30d ?? 0)} icon={CalendarX2} tone="rose"
                  deltaNote={stats ? `${stats.no_show_30d} no-show${stats.no_show_30d === 1 ? "" : "s"} · last 30 days` : "Last 30 days"} />
      </div>

      {stats && stats.undated > 0 && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              {stats.undated} {stats.undated === 1 ? "entry has" : "entries have"} no real date
            </p>
            <p className="mt-0.5 text-amber-800">
              They were seeded before this screen used real dates, so they carry a day like &ldquo;May 20&rdquo; with no year.
              Open one to give it a date, or delete it.
            </p>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => { setScope("all"); setUndatedOnly(true); setStatusFilter(""); setServiceFilter(""); setSourceFilter(""); setPage(1); }}
          >
            Show them
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <Tabs
            value={scope}
            onChange={(v) => changeScope(v as ApptScope)}
            tabs={[
              { value: "today", label: "Today", count: counts.today },
              { value: "upcoming", label: "Upcoming", count: counts.upcoming },
              { value: "past", label: "Past", count: counts.past },
              { value: "all", label: "All", count: counts.all },
            ]}
          />

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                placeholder="Search by name, service or phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Select className="w-52" options={serviceOptions} value={serviceFilter}
                    onChange={(e) => changeService(e.target.value)} />
            <Select className="w-48" options={STATUS_OPTIONS} value={statusFilter}
                    onChange={(e) => changeStatus(e.target.value as AdminApptStatus | "")} />
            <Select className="w-52" options={SOURCE_OPTIONS} value={sourceFilter}
                    onChange={(e) => changeSource(e.target.value as ApptSource | "")} />
            {filtersOn && (
              <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : failed && items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-ink">Could not reach the appointments API</p>
              <button className="btn btn-sm btn-outline mt-3" onClick={refresh}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                <CalendarDays className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{emptyTitle}</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{emptyNote}</p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th className="px-3 py-2.5">Who</th>
                    <th className="px-3 py-2.5">Service</th>
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr
                      key={a.ref}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                      onClick={() => { setNoteText(""); setDetail(a); }}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-ink">
                            {(a.name || "?").charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{a.name || "Unnamed"}</p>
                            <p className="truncate text-xs text-ink-subtle">
                              {a.source === "member" ? "Her own booking" : `Entered by ${a.created_by_name || "staff"}`}
                              {a.contact ? ` · ${a.contact}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-ink-muted">{a.service || "—"}</p>
                        {(a.mode || a.with_whom) && (
                          <p className="text-2xs text-ink-subtle">{[a.mode, a.with_whom].filter(Boolean).join(" · ")}</p>
                        )}
                      </td>
                      <td className="px-3 py-3"><When a={a} now={now} /></td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS_TONE[a.status]}>{a.status_label}</Badge>
                        {a.rescheduled_count > 0 && (
                          <p className="mt-1 text-2xs text-ink-subtle">Moved {a.rescheduled_count}×</p>
                        )}
                        {(a.status === "cancelled") && a.cancelled_reason && (
                          <p className="mt-1 max-w-[16rem] truncate text-2xs text-ink-subtle" title={a.cancelled_reason}>{a.cancelled_reason}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {rowActions(a)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {list && list.pages > 1 && (
            <Pagination
              className="mt-4"
              page={list.page}
              pageCount={list.pages}
              onPageChange={setPage}
              showing={`Showing ${(list.page - 1) * list.page_size + 1}–${Math.min(list.page * list.page_size, list.total)} of ${list.total}`}
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-sm font-bold text-ink">All time</h2>
            <p className="text-xs text-ink-subtle">{stats ? `${stats.total} sessions on record` : "…"}</p>
            {stats && (
              <ul className="mt-3 space-y-1.5">
                {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                  <li key={s.value} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <Badge tone={STATUS_TONE[s.value as AdminApptStatus]}>{s.label}</Badge>
                    </span>
                    <span className="font-semibold text-ink-subtle">{stats.by_status[s.value as AdminApptStatus] ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
            {stats && (
              <p className="mt-3 border-t border-line pt-3 text-2xs text-ink-subtle">
                {stats.by_source.member} booked by members · {stats.by_source.staff} entered by staff
              </p>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-sm font-bold text-ink">By service</h2>
            {!stats ? (
              <p className="mt-2 text-xs text-ink-subtle">…</p>
            ) : stats.by_service.length === 0 ? (
              <p className="mt-2 text-xs text-ink-subtle">No sessions yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stats.by_service.map((s) => {
                  const top = stats.by_service[0]?.value || 1;
                  return (
                    <li key={s.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-ink-muted">{s.name}</span>
                        <span className="ml-2 font-semibold text-ink-subtle">{s.value}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.max(4, Math.round((s.value / top) * 100))}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ── detail ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="lg"
        icon={CalendarClock}
        iconTone={detail ? STATUS_TONE[detail.status] : "brand"}
        title={detail?.name ?? ""}
        description={detail?.service ?? ""}
        footer={detail && (
          <>
            {(detail.status === "booked" || detail.status === "confirmed") && (
              <>
                <button className="btn btn-danger" onClick={() => openCancel(detail)}>Cancel…</button>
                <button className="btn btn-outline" onClick={() => void doNoShow(detail)}>No-show</button>
                <button className="btn btn-outline" onClick={() => openMove(detail)}>Reschedule</button>
                {detail.status === "booked"
                  ? <button className="btn btn-primary" onClick={() => void doConfirm(detail)}><Check className="h-4 w-4" /> Confirm</button>
                  : <button className="btn btn-primary" onClick={() => void doComplete(detail)}><Check className="h-4 w-4" /> Mark completed</button>}
              </>
            )}
            {detail.source === "staff" && (detail.status === "completed" || detail.status === "cancelled" || detail.status === "no_show") && (
              <button className="btn btn-danger" onClick={() => void doDelete(detail)}><Trash2 className="h-4 w-4" /> Delete entry</button>
            )}
          </>
        )}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[detail.status]}>{detail.status_label}</Badge>
              <Badge tone={detail.source === "member" ? "sky" : "slate"}>
                {detail.source === "member" ? "Her own booking" : "Entered by staff"}
              </Badge>
              {detail.rescheduled_count > 0 && <Badge tone="amber">Moved {detail.rescheduled_count}×</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">When</p>
                {detail.undated ? (
                  <>
                    <p className="mt-0.5 font-semibold text-ink-muted">{detail.date}{detail.time ? `, ${detail.time}` : ""}</p>
                    <p className="text-2xs text-amber-700">No year on record</p>
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 font-semibold text-ink-muted">{fmtDay(detail.starts_at)}</p>
                    <p className="text-xs text-ink-subtle">{fmtClock(detail.starts_at)}{detail.duration ? ` · ${detail.duration}` : ""} · {relative(detail.starts_at, now)}</p>
                  </>
                )}
              </div>
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">How</p>
                <p className="mt-0.5 font-semibold text-ink-muted">{detail.mode || "Not set"}</p>
                {detail.with_whom && <p className="text-xs text-ink-subtle">With {detail.with_whom}</p>}
              </div>
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">Contact</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink-muted">
                  {detail.contact ? <><Phone className="h-3.5 w-3.5 text-ink-subtle" /> {detail.contact}</> : "None on record"}
                </p>
              </div>
              <div className="wc-inset rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-ink-subtle">Record</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {detail.created_at ? `Booked ${fmtStamp(detail.created_at)}` : "Booking time unknown"}
                  {detail.confirmed_at && <><br />Confirmed {fmtStamp(detail.confirmed_at)}</>}
                  {detail.completed_at && <><br />Completed {fmtStamp(detail.completed_at)}</>}
                  {detail.cancelled_at && <><br />{detail.no_show ? "Marked no-show" : "Cancelled"} {fmtStamp(detail.cancelled_at)}</>}
                </p>
              </div>
            </div>

            {(detail.status === "cancelled" || detail.status === "no_show") && detail.cancelled_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-rose-900">Reason {detail.source === "member" ? "she sees" : "on record"}</p>
                <p className="mt-0.5 text-rose-900">{detail.cancelled_reason}</p>
              </div>
            )}

            {detail.note && (
              <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
                <p className="text-xs font-semibold text-ink-subtle">{detail.source === "member" ? "Her note when booking" : "Note when entered"}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-ink-muted">{detail.note}</p>
              </div>
            )}

            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle">
                <StickyNote className="h-3.5 w-3.5" /> Internal notes
                <span className="font-normal">· staff only, she never sees these</span>
              </p>
              {detail.internal_notes.length === 0 ? (
                <p className="mt-1.5 text-xs text-ink-subtle">No notes yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.internal_notes.map((n, i) => (
                    <li key={`${n.at}-${i}`} className="rounded-lg border border-line px-3 py-2 text-sm">
                      <p className="whitespace-pre-wrap text-ink-muted">{n.text}</p>
                      <p className="mt-1 text-2xs text-ink-subtle">{n.by_name || "Staff"} · {fmtStamp(n.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-start gap-2">
                <Textarea className="flex-1" rows={2} placeholder="Add a note for colleagues…"
                          value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button className="btn btn-outline" disabled={busy || !noteText.trim()} onClick={() => void submitNote()}>
                  Add note
                </button>
              </div>
            </div>

            {detail.history.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle">
                  <History className="h-3.5 w-3.5" /> History
                </p>
                <ul className="mt-1.5 space-y-1">
                  {[...detail.history].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`} className="flex flex-wrap gap-x-2 text-xs text-ink-muted">
                      <span className="font-semibold capitalize">{h.action.replace("_", "-")}</span>
                      {h.detail && <span className="text-ink-subtle">{h.detail}</span>}
                      <span className="text-ink-faint">{h.by_name ? `${h.by_name} · ` : ""}{fmtStamp(h.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── reschedule ───────────────────────────────────────────────────── */}
      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        size="sm"
        icon={RefreshCw}
        iconTone="brand"
        title="Reschedule"
        description={moving ? `${moving.name} · ${moving.service}` : ""}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMoving(null)}>Keep as is</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitMove()}>{busy ? "Moving…" : "Move it"}</button>
          </>
        }
      >
        {moving && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">
              Currently {moving.undated ? `${moving.date}${moving.time ? `, ${moving.time}` : ""} (no year)` : `${fmtDay(moving.starts_at)}, ${fmtClock(moving.starts_at)}`}.
              {moving.source === "member" && " She will see the new time on her bookings."}
            </p>
            <Input label="New date" type="date" required value={moveForm.date}
                   onChange={(e) => setMoveForm((f) => ({ ...f, date: e.target.value }))} />
            <Input label="New time" type="time" required value={moveForm.time}
                   onChange={(e) => setMoveForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
        )}
      </Modal>

      {/* ── cancel ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        size="sm"
        icon={CalendarX2}
        iconTone="rose"
        title="Cancel this appointment?"
        description={cancelling ? `${cancelling.name} · ${cancelling.service}` : ""}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCancelling(null)}>Keep it</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => void submitCancel()}>{busy ? "Cancelling…" : "Cancel appointment"}</button>
          </>
        }
      >
        {cancelling && (
          <div className="space-y-3">
            <Textarea
              label="Reason"
              required
              rows={3}
              placeholder={cancelling.source === "member" ? "e.g. The counsellor is unwell; we will call to rebook." : "e.g. Client called to cancel."}
              hint={cancelling.source === "member" ? "She reads this on her bookings screen — write it to her." : "Kept on the record."}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        )}
      </Modal>

      {/* ── new (staff-entered) ──────────────────────────────────────────── */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="lg"
        icon={CalendarPlus}
        iconTone="brand"
        title="New appointment"
        description="For a session booked over the phone or in person. Members book their own from the app."
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitCreate()}>{busy ? "Adding…" : "Add appointment"}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Her name" required placeholder="Asha Verma" value={form.name}
                 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Phone (optional)" value={form.phone ?? ""}
                 onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          {stats && stats.services.length > 0 ? (
            <Select label="Service" required options={stats.services} value={form.service}
                    onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} />
          ) : (
            <Input label="Service" required placeholder="e.g. Career counselling" value={form.service}
                   onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} />
          )}
          <Input label="With whom (optional)" placeholder="Counsellor or mentor" value={form.with_whom ?? ""}
                 onChange={(e) => setForm((f) => ({ ...f, with_whom: e.target.value }))} />
          <Input label="Date" type="date" required value={form.date}
                 onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Start time" type="time" required value={form.time}
                 onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          <Select label="Duration" options={DURATIONS} value={form.duration ?? "60 min"}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
          <Select label="Mode" options={MODES} value={form.mode ?? "In person"}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as "Online" | "In person" }))} />
          <Textarea label="Note (optional)" className="col-span-2" rows={2}
                    placeholder="Anything the person taking the session should know" value={form.note ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-subtle">
          <Clock className="h-3 w-3" /> Times are Indian time.
        </p>
      </Modal>
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AppointmentsInner />
    </Suspense>
  );
}

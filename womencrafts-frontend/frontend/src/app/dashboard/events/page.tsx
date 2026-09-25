"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CalendarX2, Check, Download, FileText, Loader2, MapPin, MoreHorizontal,
  Pencil, Plus, Search, SlidersHorizontal, Ticket, Users, Video, X,
} from "lucide-react";
import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea,
  useConfirm, useToast,
} from "@/design-system";
import {
  apiGrowthAttendees, apiGrowthAttendeesCsv, apiGrowthCancelEvent, apiGrowthCreateEvent,
  apiGrowthEvents, apiGrowthSetAttendee, apiGrowthSummary, apiGrowthUpdateEvent, saveGrowthBlob,
  type EventAttendee, type EventInput, type EventRow, type GrowthSummary,
} from "@/lib/growth-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Events — workshops, talks and melas.
 *
 * "Registered" here is a count of registration rows, not the document's
 * counter: the seed fills that counter to 55% of the seats with no rows
 * behind it, and a staff screen must not repeat a number nobody signed up to.
 *
 * Cancelling asks for a reason because every registered member is sent it.
 */

const EMPTY: EventInput = {
  title: "", desc: "", category: "Workshop", date: "", time: "", duration: "",
  mode: "Online", venue: "", host: "", seats: 0, fee: 0, language: "", status: "published",
};

const STATUS_TONE: Record<string, "emerald" | "amber" | "rose" | "slate"> = {
  published: "emerald", draft: "amber", cancelled: "rose",
};
const STATUS_LABEL: Record<string, string> = {
  "": "All events", published: "Published", draft: "Drafts", cancelled: "Cancelled",
};

export default function AdminEventsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [summary, setSummary] = useState<GrowthSummary["events"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  const [cancelling, setCancelling] = useState<EventRow | null>(null);
  const [reason, setReason] = useState("");

  const [attendeesFor, setAttendeesFor] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiGrowthEvents({ q, status: statusFilter }),
        apiGrowthSummary(),
      ]);
      setEvents(list);
      setSummary(sum.events);
    } catch (e) {
      toast.error("Could not load events", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [refresh, q]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit = (e: EventRow) => {
    setEditing(e);
    setForm({
      title: e.title, desc: e.desc, category: e.category, date: e.date, time: e.time,
      duration: e.duration, mode: e.mode, venue: e.venue, host: e.host, seats: e.seats,
      fee: e.fee, language: e.language, status: e.status,
    });
    setFormOpen(true);
  };
  const set = (k: keyof EventInput) => (v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async () => {
    if (!form.title.trim()) { toast.error("Give the event a title"); return; }
    setBusy(true);
    try {
      if (editing) {
        await apiGrowthUpdateEvent(editing.id, form);
        toast.success("Event updated");
      } else {
        await apiGrowthCreateEvent(form);
        toast.success(form.status === "published" ? "Event published" : "Event saved as a draft",
          { description: form.status === "published" ? "Every member can see it now." : undefined });
      }
      setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the event", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, refresh, toast]);

  const cancelEvent = useCallback(async () => {
    if (!cancelling) return;
    if (!reason.trim()) { toast.error("Say why — everyone registered is told this"); return; }
    setBusy(true);
    try {
      const row = await apiGrowthCancelEvent(cancelling.id, reason.trim());
      toast.success(`${row.title} is cancelled`, {
        description: cancelling.registered_count > 0
          ? `${cancelling.registered_count} registered ${cancelling.registered_count === 1 ? "member has" : "members have"} been told.`
          : "Nobody had registered.",
      });
      setCancelling(null);
      await refresh();
    } catch (e) {
      toast.error("Could not cancel the event", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [cancelling, reason, refresh, toast]);

  const showAttendees = useCallback(async (e: EventRow) => {
    setAttendeesFor(e);
    setAttendees(null);
    try {
      setAttendees(await apiGrowthAttendees(e.id));
    } catch (err) {
      toast.error("Could not load the attendee list", { description: memberError(err) });
      setAttendees([]);
    }
  }, [toast]);

  const exportAttendees = useCallback(async (e: EventRow) => {
    try {
      const blob = await apiGrowthAttendeesCsv(e.id);
      const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
      saveGrowthBlob(blob, `womsakhi-${slug}-attendees-${today}.csv`);
      toast.success("Attendee list downloaded");
    } catch (err) {
      toast.error("Could not export the list", { description: memberError(err) });
    }
  }, [today, toast]);

  const setAttendee = useCallback(async (a: EventAttendee, status: "registered" | "attended" | "cancelled") => {
    if (!attendeesFor) return;
    if (status === "cancelled") {
      const ok = await confirm({
        title: `Take ${a.name} off the list?`,
        description: "Her seat is freed and she is told. She can register again from the app.",
        confirmLabel: "Remove her",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const row = await apiGrowthSetAttendee(attendeesFor.id, a.id, status);
      setAttendees((list) => (list ?? []).map((x) => (x.id === row.id ? row : x)));
      toast.success(status === "attended" ? `${a.name} marked as attended` : status === "cancelled" ? `${a.name} removed` : `${a.name} is back on the list`);
      await refresh();
    } catch (err) {
      toast.error("Could not update that registration", { description: memberError(err) });
    }
  }, [attendeesFor, confirm, refresh, toast]);

  const filtered = q || statusFilter;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Ticket className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Events</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Workshops, talks and melas. Publishing one makes it visible to every member immediately.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New event
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Coming up" value={summary ? String(summary.upcoming) : "—"} icon={CalendarDays} tone="brand"
                  deltaNote="Published, today or later" />
        <StatCard label="Registrations" value={summary ? String(summary.registrations) : "—"} icon={Users} tone="violet"
                  deltaNote="Seats held across all events" />
        <StatCard label="Drafts" value={summary ? String(summary.draft) : "—"} icon={FileText} tone="amber"
                  deltaNote="Not yet visible to members" />
        <StatCard label="Cancelled" value={summary ? String(summary.cancelled) : "—"} icon={CalendarX2} tone="slate"
                  deltaNote="Kept, so calendars stay honest" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by title or host…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" />{STATUS_LABEL[statusFilter]}</span>}>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <MenuItem key={v || "all"} onClick={() => setStatusFilter(v)}>{label}</MenuItem>
            ))}
          </Menu>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={filtered ? "No events match that" : "No events yet"}
            description={filtered ? "Try a different search, or clear the filter." : "Create one and it appears on every member's Events screen."}
            action={!filtered && <button onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> New event</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Registered</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                          <span className="text-3xs font-bold uppercase leading-none">{e.date_label.split(",")[1]?.trim().split(" ")[1] ?? ""}</span>
                          <span className="font-display text-base font-bold leading-tight">{e.date.slice(-2)}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                          <p className="truncate text-xs text-ink-subtle">
                            {e.category}{e.host ? ` · with ${e.host}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      <p>{e.date_label}{e.time ? ` · ${e.time}` : ""}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle">
                        {e.mode === "Online" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                        {e.mode}{e.venue ? ` · ${e.venue}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => void showAttendees(e)} className="text-sm font-semibold text-brand-ink hover:underline">
                        {e.registered_count}{e.seats > 0 ? ` / ${e.seats}` : ""}
                      </button>
                      {e.attended_count > 0 && <p className="text-2xs text-ink-subtle">{e.attended_count} attended</p>}
                      {e.seats > 0 && e.status === "published" && e.seats_left === 0 && <p className="text-2xs font-semibold text-status-warn-ink">Full</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span title={e.status === "cancelled" && e.cancel_reason ? e.cancel_reason : undefined}>
                        <Badge tone={STATUS_TONE[e.status] ?? "slate"}>{e.status}</Badge>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={Users} onClick={() => void showAttendees(e)}>See who&apos;s coming</MenuItem>
                        <MenuItem icon={Download} onClick={() => void exportAttendees(e)}>Download attendee list</MenuItem>
                        <MenuItem icon={Pencil} onClick={() => openEdit(e)}>Edit</MenuItem>
                        {e.status !== "cancelled" && (
                          <MenuItem icon={X} danger onClick={() => { setCancelling(e); setReason(""); }}>Cancel event</MenuItem>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── create / edit ─────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit event" : "New event"}
        description="Everything here is visible to members once the status is Published."
        icon={Ticket}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !form.title.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Create event"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="Price your work without apologising" />
          <Textarea label="What is it about?" value={form.desc} onChange={(e) => set("desc")(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Category" value={form.category} onChange={(e) => set("category")(e.target.value)}
                    options={["Workshop", "Talk", "Mela", "Meet-up", "Training"]} />
            <Select label="Mode" value={form.mode} onChange={(e) => set("mode")(e.target.value)} options={["Online", "In person"]} />
            <Input label="Date" type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            <Input label="Time" value={form.time} onChange={(e) => set("time")(e.target.value)} placeholder="6:00 PM" />
            <Input label="How long" value={form.duration} onChange={(e) => set("duration")(e.target.value)} placeholder="90 min" />
            <Input label="Who's leading it" value={form.host} onChange={(e) => set("host")(e.target.value)} />
            <Input label="Seats (0 = unlimited)" type="number" value={String(form.seats)} onChange={(e) => set("seats")(Math.max(0, Number(e.target.value) || 0))} />
            <Input label="Language" value={form.language} onChange={(e) => set("language")(e.target.value)} placeholder="Hindi & English" />
          </div>
          {form.mode !== "Online" && (
            <Input label="Venue" value={form.venue} onChange={(e) => set("venue")(e.target.value)} placeholder="Community Hall, Sector 12" />
          )}
          <Select label="Status" value={form.status} onChange={(e) => set("status")(e.target.value)}
                  options={[{ value: "published", label: "Published — members can see it" }, { value: "draft", label: "Draft — hidden" }]} />
        </div>
      </Modal>

      {/* ── cancel with a reason ──────────────────────────────────────── */}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this event?"
        description={cancelling?.title}
        icon={CalendarX2}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCancelling(null)}>Keep it</button>
            <button className="btn btn-danger" onClick={() => void cancelEvent()} disabled={busy || !reason.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Cancel and tell everyone
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            {cancelling && cancelling.registered_count > 0
              ? `${cancelling.registered_count} ${cancelling.registered_count === 1 ? "member has" : "members have"} a seat. Each of them gets this reason as a notification.`
              : "Nobody has registered, but the event stays on record as cancelled."}
          </p>
          <Textarea label="Why is it cancelled?" value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="The trainer is unwell. We'll announce a new date within the week." />
        </div>
      </Modal>

      {/* ── attendees ─────────────────────────────────────────────────── */}
      <Modal
        open={!!attendeesFor}
        onClose={() => setAttendeesFor(null)}
        title="Who's coming"
        description={attendeesFor?.title}
        icon={Users}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAttendeesFor(null)}>Close</button>
            {attendeesFor && (attendees?.length ?? 0) > 0 && (
              <button className="btn btn-primary" onClick={() => void exportAttendees(attendeesFor)}>
                <Download className="h-4 w-4" /> Download CSV
              </button>
            )}
          </>
        }
      >
        {attendees === null ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : attendees.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-subtle">Nobody has registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-ink-subtle">
                  <th className="pb-2 pe-3 font-semibold">Name</th>
                  <th className="pb-2 pe-3 font-semibold">Contact</th>
                  <th className="pb-2 pe-3 font-semibold">Registered</th>
                  <th className="pb-2 pe-3 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendees.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pe-3">
                      <p className="font-medium text-ink">{a.name}</p>
                      {a.member_code && <p className="text-2xs text-ink-subtle">{a.member_code}</p>}
                    </td>
                    <td className="py-2.5 pe-3 text-ink-subtle">
                      <span className="block">{a.email}</span>
                      {a.phone && <span className="block text-xs">{a.phone}</span>}
                    </td>
                    <td className="py-2.5 pe-3 text-ink-subtle">{a.registered_on}</td>
                    <td className="py-2.5 pe-3">
                      <Badge tone={a.status === "attended" ? "violet" : a.status === "registered" ? "emerald" : "slate"}>{a.status}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        {a.status !== "attended" && a.status !== "cancelled" && (
                          <MenuItem icon={Check} onClick={() => void setAttendee(a, "attended")}>Mark attended</MenuItem>
                        )}
                        {a.status === "attended" && (
                          <MenuItem onClick={() => void setAttendee(a, "registered")}>Undo attended</MenuItem>
                        )}
                        {a.status === "cancelled"
                          ? <MenuItem onClick={() => void setAttendee(a, "registered")}>Put her back on the list</MenuItem>
                          : <MenuItem icon={X} danger onClick={() => void setAttendee(a, "cancelled")}>Remove from list</MenuItem>}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

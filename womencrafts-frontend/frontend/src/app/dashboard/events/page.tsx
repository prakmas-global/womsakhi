"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Ticket,
  Users,
  Video,
  X,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Modal,
  SearchInput,
  Select,
  Tabs,
  Textarea,
} from "@/design-system";
import {
  apiAdminEvents,
  apiCancelEventAdmin,
  apiCreateEvent,
  apiEventAttendees,
  apiUpdateEvent,
  type AdminEvent,
  type EventAttendee,
  type EventInput,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

const EMPTY: EventInput = {
  title: "",
  desc: "",
  category: "Workshop",
  date: "",
  time: "",
  duration: "",
  mode: "Online",
  venue: "",
  host: "",
  seats: 0,
  fee: 0,
  language: "",
  status: "published",
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY);

  const [attendeesFor, setAttendeesFor] = useState<AdminEvent | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);

  const load = useCallback(async () => {
    try {
      setEvents(await apiAdminEvents({ q, status: tab === "all" ? "" : tab }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [q, tab]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const stats = useMemo(() => {
    const published = events.filter((e) => e.status === "published");
    return [
      { label: "Events", value: events.length },
      { label: "Published", value: published.length, tone: "text-status-ok-ink" },
      {
        label: "Registrations",
        value: events.reduce((n, e) => n + e.registered_count, 0),
        tone: "text-brand-ink",
      },
      {
        label: "Nearly full",
        value: published.filter((e) => e.seats > 0 && e.seats_left <= 5).length,
        tone: "text-status-warn-ink",
      },
    ];
  }, [events]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(e: AdminEvent) {
    setEditing(e.id);
    setForm({
      title: e.title, desc: e.desc, category: e.category, date: e.date, time: e.time,
      duration: e.duration, mode: e.mode, venue: e.venue, host: e.host, seats: e.seats,
      fee: e.fee, language: e.language, status: e.status,
    });
    setFormOpen(true);
  }

  async function save() {
    setWorking(true);
    setError("");
    try {
      if (editing) await apiUpdateEvent(editing, form);
      else await apiCreateEvent(form);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  async function cancel(id: string) {
    setWorking(true);
    try {
      await apiCancelEventAdmin(id);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  async function showAttendees(e: AdminEvent) {
    setAttendeesFor(e);
    setAttendees([]);
    try {
      setAttendees(await apiEventAttendees(e.id));
    } catch (err) {
      setError(memberError(err));
    }
  }

  const set = (k: keyof EventInput) => (v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminPage
      title="Events"
      subtitle="Workshops, talks and melas. Publishing one makes it visible to every member immediately."
      error={error}
      stats={stats}
      action={
        <button onClick={openCreate} className="btn btn-primary">
          <Plus className="h-4 w-4" /> New event
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search events…" className="max-w-xs" />
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Drafts" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      {loading ? (
        <AdminLoading />
      ) : events.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No events yet"
          description="Create one and it appears on every member's Events screen."
          action={
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" /> New event
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-tint text-brand-ink">
                  <span className="text-3xs font-bold uppercase leading-none">
                    {e.date_label.split(",")[1]?.trim().split(" ")[1] ?? ""}
                  </span>
                  <span className="font-display text-lg font-bold leading-tight">
                    {e.date.slice(-2)}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">{e.category}</Badge>
                    <Badge
                      tone={
                        e.status === "published"
                          ? "emerald"
                          : e.status === "cancelled"
                            ? "rose"
                            : "amber"
                      }
                    >
                      {e.status}
                    </Badge>
                  </div>
                  <h2 className="mt-1.5 font-display font-bold leading-snug text-ink">{e.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {e.date_label} · {e.time}
                    </span>
                    <span className="flex items-center gap-1">
                      {e.mode === "Online" ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5" />
                      )}
                      {e.mode}
                    </span>
                    {e.host && <span>with {e.host}</span>}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 dark:border-white/10">
                    <button
                      onClick={() => showAttendees(e)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand-tint"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {e.registered_count} registered
                      {e.seats > 0 ? ` / ${e.seats}` : ""}
                    </button>
                    <button
                      onClick={() => openEdit(e)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-subtle transition hover:bg-surface-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {e.status !== "cancelled" && (
                      <button
                        onClick={() => cancel(e.id)}
                        disabled={working}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-status-danger-ink transition hover:bg-status-danger-bg"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit event" : "New event"}
        description="Everything here is visible to members once the status is Published."
        icon={Ticket}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={working || !form.title.trim()}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Create event"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="Price your work without apologising"
          />
          <Textarea
            label="What is it about?"
            value={form.desc}
            onChange={(e) => set("desc")(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => set("category")(e.target.value)}
              options={["Workshop", "Talk", "Mela", "Meet-up", "Training"]}
            />
            <Select
              label="Mode"
              value={form.mode}
              onChange={(e) => set("mode")(e.target.value)}
              options={["Online", "In person"]}
            />
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => set("date")(e.target.value)}
            />
            <Input
              label="Time"
              value={form.time}
              onChange={(e) => set("time")(e.target.value)}
              placeholder="6:00 PM"
            />
            <Input
              label="How long"
              value={form.duration}
              onChange={(e) => set("duration")(e.target.value)}
              placeholder="90 min"
            />
            <Input
              label="Who's leading it"
              value={form.host}
              onChange={(e) => set("host")(e.target.value)}
            />
            <Input
              label="Seats (0 = unlimited)"
              type="number"
              value={String(form.seats)}
              onChange={(e) => set("seats")(Number(e.target.value) || 0)}
            />
            <Input
              label="Language"
              value={form.language}
              onChange={(e) => set("language")(e.target.value)}
              placeholder="Hindi & English"
            />
          </div>
          {form.mode !== "Online" && (
            <Input
              label="Venue"
              value={form.venue}
              onChange={(e) => set("venue")(e.target.value)}
              placeholder="Community Hall, Sector 12"
            />
          )}
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set("status")(e.target.value)}
            options={["published", "draft", "cancelled"]}
          />
        </div>
      </Modal>

      {/* attendees */}
      <Modal
        open={!!attendeesFor}
        onClose={() => setAttendeesFor(null)}
        title="Who's coming"
        description={attendeesFor?.title}
        icon={Users}
        size="lg"
        footer={
          <button className="btn btn-outline" onClick={() => setAttendeesFor(null)}>
            Close
          </button>
        }
      >
        {attendees.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-subtle">Nobody has registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle dark:border-white/10">
                  <th scope="col" className="pb-2 pe-3 font-semibold">Name</th>
                  <th scope="col" className="pb-2 pe-3 font-semibold">Contact</th>
                  <th scope="col" className="pb-2 pe-3 font-semibold">Registered</th>
                  <th scope="col" className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-white/5">
                {attendees.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pe-3 font-medium text-ink">{a.name}</td>
                    <td className="py-2.5 pe-3 text-ink-subtle">
                      <span className="block">{a.email}</span>
                      {a.phone && <span className="block text-xs">{a.phone}</span>}
                    </td>
                    <td className="py-2.5 pe-3 text-ink-subtle">{a.registered_on}</td>
                    <td className="py-2.5">
                      <Badge tone={a.status === "registered" ? "emerald" : "slate"}>
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}

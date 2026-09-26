"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check, HeartHandshake, Inbox, Loader2, MapPin, MoreHorizontal, NotebookPen, Pencil, Plus,
  Search, SlidersHorizontal, UserMinus, UserPlus, Users,
} from "lucide-react";
import {
  Avatar, Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea,
  useConfirm, useToast,
} from "@/design-system";
import {
  apiGrowthCreateMentor, apiGrowthLogSession, apiGrowthMentorSessions, apiGrowthMentors,
  apiGrowthReactivateMentor, apiGrowthRequests, apiGrowthRetireMentor, apiGrowthSummary,
  apiGrowthUpdateMentor,
  type GrowthSummary, type MentorInput, type MentorRequestRow, type MentorRow, type MentorSessionRow,
} from "@/lib/growth-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Mentors — women who have agreed to guide members.
 *
 * The three numbers on each row are counted from rows: requests waiting on
 * her, requests she has accepted (her mentees), and sessions staff have
 * logged. The document's `rating` and `sessions_done` are seeded at random
 * and are deliberately not shown here.
 */

const EMPTY: MentorInput = {
  name: "", headline: "", bio: "", photo: "", expertise: [], languages: [],
  experience_years: 0, location: "", availability: "", status: "active",
};

const STATUS_LABEL: Record<string, string> = { "": "All mentors", active: "Active", retired: "Retired" };

const asList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

export default function AdminMentorsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [summary, setSummary] = useState<GrowthSummary["mentors"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MentorRow | null>(null);
  const [form, setForm] = useState<MentorInput>(EMPTY);
  // Kept as text while typing — splitting on every keystroke makes commas impossible to type.
  const [expertiseText, setExpertiseText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [busy, setBusy] = useState(false);

  const [sessionsFor, setSessionsFor] = useState<MentorRow | null>(null);
  const [sessions, setSessions] = useState<MentorSessionRow[] | null>(null);
  const [mentees, setMentees] = useState<MentorRequestRow[] | null>(null);
  const [sessionForm, setSessionForm] = useState({ request_id: "", held_on: "", note: "" });

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiGrowthMentors({ q, status: statusFilter }),
        apiGrowthSummary(),
      ]);
      setMentors(list);
      setSummary(sum.mentors);
    } catch (e) {
      toast.error("Could not load mentors", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [refresh, q]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setExpertiseText(""); setLanguagesText(""); setFormOpen(true);
  };
  const openEdit = (m: MentorRow) => {
    setEditing(m);
    setForm({
      name: m.name, headline: m.headline, bio: m.bio, photo: m.photo, expertise: m.expertise,
      languages: m.languages, experience_years: m.experience_years, location: m.location,
      availability: m.availability, status: m.status,
    });
    setExpertiseText(m.expertise.join(", "));
    setLanguagesText(m.languages.join(", "));
    setFormOpen(true);
  };
  const set = (k: keyof MentorInput) => (v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async () => {
    if (!form.name.trim()) { toast.error("The mentor needs a name"); return; }
    setBusy(true);
    const body: MentorInput = { ...form, expertise: asList(expertiseText), languages: asList(languagesText) };
    try {
      if (editing) {
        await apiGrowthUpdateMentor(editing.id, body);
        toast.success(`${body.name} updated`);
      } else {
        await apiGrowthCreateMentor(body);
        toast.success(`${body.name} added`, { description: body.status === "active" ? "She is in the member directory now." : undefined });
      }
      setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the mentor", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, expertiseText, form, languagesText, refresh, toast]);

  const retire = useCallback(async (m: MentorRow) => {
    const ok = await confirm({
      title: `Retire ${m.name}?`,
      description: m.open_requests > 0
        ? `She disappears from the member directory. ${m.open_requests} ${m.open_requests === 1 ? "request is" : "requests are"} still waiting on her — decide those or hand them to someone else.`
        : "She disappears from the member directory. Her record, requests and sessions are kept, and you can bring her back.",
      confirmLabel: "Retire",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiGrowthRetireMentor(m.id);
      toast.success(`${m.name} is retired`);
      await refresh();
    } catch (e) {
      toast.error("Could not retire her", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  const reactivate = useCallback(async (m: MentorRow) => {
    try {
      await apiGrowthReactivateMentor(m.id);
      toast.success(`${m.name} is back in the directory`);
      await refresh();
    } catch (e) {
      toast.error("Could not reactivate her", { description: memberError(e) });
    }
  }, [refresh, toast]);

  const openSessions = useCallback(async (m: MentorRow) => {
    setSessionsFor(m);
    setSessions(null);
    setMentees(null);
    setSessionForm({ request_id: "", held_on: new Date().toISOString().slice(0, 10), note: "" });
    try {
      const [past, accepted] = await Promise.all([
        apiGrowthMentorSessions(m.id),
        apiGrowthRequests({ mentor_id: m.id, status: "accepted" }),
      ]);
      setSessions(past);
      setMentees(accepted);
      if (accepted[0]) setSessionForm((f) => ({ ...f, request_id: accepted[0].id }));
    } catch (e) {
      toast.error("Could not load her sessions", { description: memberError(e) });
      setSessions([]);
      setMentees([]);
    }
  }, [toast]);

  const logSession = useCallback(async () => {
    if (!sessionsFor || !sessionForm.request_id) return;
    setBusy(true);
    try {
      const row = await apiGrowthLogSession(sessionsFor.id, sessionForm);
      setSessions((list) => [row, ...(list ?? [])]);
      setSessionForm((f) => ({ ...f, note: "" }));
      toast.success("Session logged", { description: `${sessionsFor.name} with ${row.member_name} on ${row.held_on}` });
      await refresh();
    } catch (e) {
      toast.error("Could not log the session", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [refresh, sessionForm, sessionsFor, toast]);

  const filtered = q || statusFilter;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Mentors</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Women who have agreed to guide members. Most are volunteers who never sign in — this is their whole record.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/mentors/requests" className="btn btn-outline">
            <Inbox className="h-4 w-4" /> Requests
            {summary && summary.pending_requests > 0 && (
              <span className="ml-1 rounded-full bg-status-warn-bg px-1.5 text-2xs font-bold text-status-warn-ink">{summary.pending_requests}</span>
            )}
          </Link>
          <button className="btn btn-primary" onClick={openCreate}>
            <UserPlus className="h-4 w-4" /> Add mentor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active mentors" value={summary ? String(summary.active) : "—"} icon={HeartHandshake} tone="brand"
                  deltaNote={summary && summary.retired > 0 ? `${summary.retired} retired` : "In the member directory"} />
        <StatCard label="Waiting requests" value={summary ? String(summary.pending_requests) : "—"} icon={Inbox}
                  tone={summary && summary.pending_requests > 0 ? "amber" : "slate"} deltaNote="Need a decision" />
        <StatCard label="Mentees" value={summary ? String(summary.mentees) : "—"} icon={Users} tone="violet"
                  deltaNote="Accepted requests" />
        <StatCard label="Sessions logged" value={summary ? String(summary.sessions) : "—"} icon={NotebookPen} tone="emerald"
                  deltaNote="Recorded by staff after they happen" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by name, headline or expertise…"
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
        ) : mentors.length === 0 ? (
          <EmptyState
            icon={HeartHandshake}
            title={filtered ? "No mentors match that" : "No mentors yet"}
            description={filtered ? "Try a different search, or clear the filter." : "Add the first one and she appears in the member directory straight away."}
            action={!filtered && <button onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> Add mentor</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Mentor</th>
                  <th className="px-3 py-2.5">Helps with</th>
                  <th className="px-3 py-2.5">Requests</th>
                  <th className="px-3 py-2.5">Sessions</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {mentors.map((m) => (
                  <tr key={m.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${m.status !== "active" ? "opacity-70" : ""}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} src={m.photo} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                          <p className="truncate text-xs text-ink-subtle">{m.headline || "No headline yet"}</p>
                          {m.location && (
                            <p className="mt-0.5 flex items-center gap-1 text-2xs text-ink-subtle"><MapPin className="h-3 w-3" />{m.location}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {m.expertise.length === 0 && <span className="text-xs text-ink-subtle">—</span>}
                        {m.expertise.slice(0, 3).map((e) => (
                          <span key={e} className="rounded-full bg-brand-tint px-2 py-0.5 text-2xs font-medium text-brand-ink">{e}</span>
                        ))}
                        {m.expertise.length > 3 && <span className="text-2xs text-ink-subtle">+{m.expertise.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/mentors/requests?mentor=${m.id}`} className="text-sm text-ink-muted hover:underline">
                        {m.open_requests > 0
                          ? <span className="font-semibold text-status-warn-ink">{m.open_requests} waiting</span>
                          : <span>None waiting</span>}
                      </Link>
                      <p className="text-2xs text-ink-subtle">{m.mentees} {m.mentees === 1 ? "mentee" : "mentees"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => void openSessions(m)} className="text-sm font-semibold text-brand-ink hover:underline">{m.sessions}</button>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={m.status === "active" ? "emerald" : "slate"}>{m.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={Inbox} href={`/dashboard/mentors/requests?mentor=${m.id}`}>See her requests</MenuItem>
                        <MenuItem icon={NotebookPen} onClick={() => void openSessions(m)}>Sessions · log one</MenuItem>
                        <MenuItem icon={Pencil} onClick={() => openEdit(m)}>Edit</MenuItem>
                        {m.status === "active"
                          ? <MenuItem icon={UserMinus} danger onClick={() => void retire(m)}>Retire</MenuItem>
                          : <MenuItem icon={UserPlus} onClick={() => void reactivate(m)}>Bring her back</MenuItem>}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── add / edit ────────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit mentor" : "Add a mentor"}
        description="The headline is what she has done, not a job title — that's what members actually read."
        icon={HeartHandshake}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Add mentor"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          <Input label="Headline" value={form.headline} onChange={(e) => set("headline")(e.target.value)}
                 placeholder="Runs a 12-woman tailoring unit in Hyderabad" />
          <Textarea label="In her own words" value={form.bio} onChange={(e) => set("bio")(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Expertise (comma separated)" value={expertiseText} onChange={(e) => setExpertiseText(e.target.value)}
                   placeholder="Tailoring, Pricing, Small business" />
            <Input label="Languages (comma separated)" value={languagesText} onChange={(e) => setLanguagesText(e.target.value)}
                   placeholder="Telugu, Hindi, English" />
            <Input label="Years of experience" type="number" value={String(form.experience_years)}
                   onChange={(e) => set("experience_years")(Math.max(0, Number(e.target.value) || 0))} />
            <Input label="Based in" value={form.location} onChange={(e) => set("location")(e.target.value)} />
            <Input label="Usually free" value={form.availability} onChange={(e) => set("availability")(e.target.value)} placeholder="Weekday evenings" />
            <Select label="Status" value={form.status} onChange={(e) => set("status")(e.target.value)}
                    options={[{ value: "active", label: "Active — in the directory" }, { value: "retired", label: "Retired — hidden" }]} />
          </div>
        </div>
      </Modal>

      {/* ── sessions ──────────────────────────────────────────────────── */}
      <Modal
        open={!!sessionsFor}
        onClose={() => setSessionsFor(null)}
        title="Sessions"
        description={sessionsFor?.name}
        icon={NotebookPen}
        size="lg"
        footer={<button className="btn btn-outline" onClick={() => setSessionsFor(null)}>Close</button>}
      >
        {sessions === null || mentees === null ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">Log a session that happened</p>
              {mentees.length === 0 ? (
                <p className="mt-1 text-xs text-ink-subtle">
                  She has no accepted mentees yet. Accept a request from the{" "}
                  <Link href={`/dashboard/mentors/requests?mentor=${sessionsFor?.id ?? ""}`} className="font-semibold text-brand-ink hover:underline">requests queue</Link>{" "}
                  first — a session is always with someone.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="With"
                      value={sessionForm.request_id}
                      onChange={(e) => setSessionForm((f) => ({ ...f, request_id: e.target.value }))}
                      options={mentees.map((r) => ({ value: r.id, label: `${r.member_name} — asked ${r.when}` }))}
                    />
                    <Input label="Held on" type="date" value={sessionForm.held_on}
                           onChange={(e) => setSessionForm((f) => ({ ...f, held_on: e.target.value }))} />
                  </div>
                  <Textarea label="What was covered (optional)" value={sessionForm.note} rows={2}
                            onChange={(e) => setSessionForm((f) => ({ ...f, note: e.target.value }))} />
                  <div className="flex justify-end">
                    <button className="btn btn-primary btn-sm" onClick={() => void logSession()} disabled={busy || !sessionForm.request_id}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Log it
                    </button>
                  </div>
                </div>
              )}
            </div>

            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-subtle">No sessions logged yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-ink-subtle">
                    <th className="pb-2 pe-3 font-semibold">Held on</th>
                    <th className="pb-2 pe-3 font-semibold">With</th>
                    <th className="pb-2 pe-3 font-semibold">Note</th>
                    <th className="pb-2 font-semibold">Logged by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pe-3 text-ink-muted">{s.held_on}</td>
                      <td className="py-2.5 pe-3 font-medium text-ink">{s.member_name}</td>
                      <td className="py-2.5 pe-3 text-ink-subtle">{s.note || "—"}</td>
                      <td className="py-2.5 text-xs text-ink-subtle">{s.logged_by}<br />{s.logged_on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

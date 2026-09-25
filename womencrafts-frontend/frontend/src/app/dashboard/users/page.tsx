"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  UserCheck,
  UserPlus,
  BadgeCheck,
  Clock,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Plus,
  MoreHorizontal,
  Phone,
  Mail,
  X,
  ShieldCheck,
  ShieldAlert,
  User,
  MapPin,
  Pencil,
  MessageSquare,
  KeyRound,
  Activity,
  Ban,
  Trash2,
  Eye,
  Inbox,
  Download,
  Check,
  RotateCcw,
  CalendarDays,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  Avatar, Badge, Card, EmptyState, ImageUpload, Input, Menu, MenuItem, Modal, Pagination, Select,
  Spinner, StatCard, Textarea, useToast, useConfirm, type Tone,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import AreaTrend from "@/components/charts/AreaTrend";
import RouteLoading from "@/components/common/RouteLoading";
import { apiCreateMember, apiUpdateMember, apiResetMemberPassword, type ApiMember } from "@/lib/api";
import {
  apiApproveMember,
  apiBulkMemberStatus,
  apiDeleteMemberWithReason,
  apiExportMembers,
  apiListMembersLive,
  apiMemberGrowth,
  apiMemberProfile,
  apiMemberStatsLive,
  apiRejectMember,
  apiRestoreMember,
  apiSuspendMember,
  saveBlob,
  shortDate,
  shortDateTime,
  type GrowthPoint,
  type MemberProfile,
  type MemberStats,
} from "@/lib/members-admin-api";
import { memberError } from "@/lib/member-api";
import MemberThemeControl from "@/components/admin/MemberThemeControl";

/**
 * Members — everyone in the directory, and everything an admin does to one.
 *
 * ── What changed ────────────────────────────────────────────────────────────
 * This screen fetched the first 100 members and filtered them in the browser,
 * drew a growth chart from six numbers typed into the file, showed a fixed
 * "12.5%" on every stat card, and told you every member was "Verified on —"
 * with "High engagement". The profile tabs said "No programs yet" whether or
 * not she was enrolled in any.
 *
 * Now: search, filters and paging run on the server; growth and the deltas
 * are counted from `created_at`; the profile shows her directory row, the
 * state of her login, and what she has actually done (bookings, enrolments,
 * posts, orders — counted, not scored). Approve, reject, suspend, restore and
 * delete each take a reason that goes into the audit log, and "suspend" really
 * does stop her signing in.
 */

type Role = "Member" | "Instructor" | "Supervisor" | "Admin";
type Status = "Active" | "Inactive" | "Pending" | "Rejected";
type Segment = "Entrepreneur" | "Student" | "Artisan" | "Job Seeker" | "Support Seeker";

const ROLE_TONE: Record<string, Tone> = { Member: "brand", Instructor: "violet", Supervisor: "emerald", Admin: "sky" };
const STATUS_TONE: Record<string, Tone> = { Active: "emerald", Inactive: "slate", Pending: "amber", Rejected: "rose" };
/** "Inactive" in the database means she cannot sign in; say so. */
const STATUS_LABEL: Record<string, string> = { Active: "Active", Inactive: "Suspended", Pending: "Pending", Rejected: "Rejected" };
const VERIFY_TONE: Record<string, Tone> = {
  active: "emerald", in_review: "amber", pending_documents: "amber", pending_email: "slate", rejected: "rose", suspended: "slate",
};

const ROLE_COLORS: Record<string, string> = {
  Member: "var(--color-brand-600)",
  Instructor: "var(--color-violet-500)",
  Supervisor: "var(--status-ok-solid)",
  Admin: "var(--status-info-solid)",
};
const STATUS_COLORS: Record<string, string> = {
  Active: "var(--status-ok-solid)",
  Pending: "var(--status-warn-solid)",
  Inactive: "var(--color-violet-300)",
  Rejected: "var(--status-danger-solid)",
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All roles" }, { value: "Member", label: "Member" },
  { value: "Instructor", label: "Instructor" }, { value: "Supervisor", label: "Supervisor" }, { value: "Admin", label: "Admin" },
];
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Pending", label: "Pending" },
  { value: "Inactive", label: "Suspended" }, { value: "Rejected", label: "Rejected" },
];
const NONE = "__none__";
const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All segments" }, { value: "Entrepreneur", label: "Entrepreneur" }, { value: "Student", label: "Student" },
  { value: "Artisan", label: "Artisan" }, { value: "Job Seeker", label: "Job Seeker" }, { value: "Support Seeker", label: "Support Seeker" },
  { value: NONE, label: "No segment set" },
];
const labelOf = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? opts[0].label;

const PAGE_SIZE = 10;
const TABS = ["Overview", "Activity", "Programmes", "Appointments"] as const;
type Tab = (typeof TABS)[number];

type MemberForm = {
  name: string; email: string; phone: string; role: Role; status: Status; location: string;
  segment: Segment | ""; gender: string; dob: string; referral: string; avatar: string;
};
const EMPTY_FORM: MemberForm = {
  name: "", email: "", phone: "", role: "Member", status: "Active", location: "",
  segment: "Entrepreneur", gender: "Female", dob: "", referral: "", avatar: "",
};

/** One dialog for every action that needs a reason. */
type ReasonKind = "approve" | "reject" | "suspend" | "restore" | "delete" | "bulk-suspend" | "bulk-restore";
type ReasonAsk = { kind: ReasonKind; member?: ApiMember; ids?: string[] };
const REASON_COPY: Record<ReasonKind, { title: (n: string) => string; body: string; confirm: string; required: boolean; danger: boolean }> = {
  approve: { title: (n) => `Approve ${n}?`, body: "Her account becomes usable, any ID documents waiting on review are marked approved by you, and she is emailed.", confirm: "Approve", required: false, danger: false },
  reject: { title: (n) => `Reject ${n}?`, body: "She is told the reason by email, and it is kept on her record. Write it for her, not for the log.", confirm: "Reject", required: true, danger: true },
  suspend: { title: (n) => `Suspend ${n}?`, body: "She is signed out everywhere now and refused at sign-in until restored. Her profile and everything she has done are kept.", confirm: "Suspend", required: true, danger: true },
  restore: { title: (n) => `Restore ${n}?`, body: "She can sign in again straight away. She is told her account is open.", confirm: "Restore", required: false, danger: false },
  delete: { title: (n) => `Delete ${n}?`, body: "Her profile, login, documents, bookings and enrolments are removed for good. Money records survive with the link cleared. This cannot be undone.", confirm: "Delete member", required: false, danger: true },
  "bulk-suspend": { title: (n) => `Suspend ${n}?`, body: "Each of them is signed out now and refused at sign-in until restored. One reason is recorded against each.", confirm: "Suspend all", required: true, danger: true },
  "bulk-restore": { title: (n) => `Restore ${n}?`, body: "Each of them can sign in again straight away.", confirm: "Restore all", required: false, danger: false },
};

function Dropdown({ label }: { label: string }) {
  return (
    <span className="btn btn-sm btn-outline">
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
    </span>
  );
}

function Legend({ items }: { items: { name: string; value: string; color: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-ink-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap font-semibold text-ink-muted">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-ink-subtle">{k}</p>
      <p className="font-medium text-ink-muted">{v || "—"}</p>
    </div>
  );
}

export default function MembersPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<RouteLoading shape="table" title={true} />}>
      <MembersScreen />
    </Suspense>
  );
}

function MembersScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const params = useSearchParams();

  // ── list ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ApiMember[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState(params.get("role") ?? "");
  const [statusFilter, setStatusFilter] = useState(params.get("status") ?? "");
  const [segmentFilter, setSegmentFilter] = useState(params.get("segment") ?? "");
  const [selected, setSelected] = useState<string[]>([]);

  // ── figures ───────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);

  // ── one member ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string>("");
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  // ── dialogs ───────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [ask, setAsk] = useState<ReasonAsk | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Typing pauses for a moment before the server is asked; a new question
  // starts on page 1.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    try {
      const res = await apiListMembersLive({
        q: q || undefined, role: roleFilter || undefined, status: statusFilter || undefined,
        segment: segmentFilter || undefined, page, page_size: PAGE_SIZE, sort: "-created_at",
      });
      setRows(res.items);
      setTotal(res.total);
      setPages(Math.max(1, res.pages));
      setSelected((cur) => cur.filter((id) => res.items.some((m) => m.id === id)));
    } catch (e) {
      toast.error("Could not load members", { description: memberError(e) });
    } finally {
      setListLoading(false);
    }
  }, [q, roleFilter, statusFilter, segmentFilter, page, toast]);

  const loadFigures = useCallback(async () => {
    const [s, g] = await Promise.all([
      apiMemberStatsLive().catch(() => null),
      apiMemberGrowth(12).catch(() => null),
    ]);
    if (s) setStats(s);
    if (g) setGrowth(g.points);
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    if (!id) { setProfile(null); return; }
    setProfileLoading(true);
    try {
      setProfile(await apiMemberProfile(id));
    } catch (e) {
      setProfile(null);
      toast.error("Could not open that profile", { description: memberError(e) });
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);

  // Each fetch is started from inside an async IIFE, as staff/page.tsx does:
  // the effect body itself sets no state.
  useEffect(() => { void (async () => { await loadList(); })(); }, [loadList]);
  useEffect(() => { void (async () => { await loadFigures(); })(); }, [loadFigures]);
  useEffect(() => { void (async () => { await loadProfile(selectedId); })(); }, [selectedId, loadProfile]);

  /** After any write: the list, the figures, and the open profile. */
  const refreshAll = useCallback(async () => {
    await Promise.all([loadList(), loadFigures(), selectedId ? loadProfile(selectedId) : Promise.resolve()]);
  }, [loadList, loadFigures, loadProfile, selectedId]);

  // A changed filter is a new question, so it starts on page 1.
  const pickRole = (v: string) => { setRoleFilter(v); setPage(1); };
  const pickStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const pickSegment = (v: string) => { setSegmentFilter(v); setPage(1); };

  const anyFilter = q !== "" || roleFilter !== "" || statusFilter !== "" || segmentFilter !== "";
  const clearFilters = () => { setSearch(""); setQ(""); setRoleFilter(""); setStatusFilter(""); setSegmentFilter(""); setPage(1); };

  // ── figures for the cards and charts ──────────────────────────────────────
  const totalMembers = stats?.total ?? 0;
  const pct = (v: number) => (totalMembers ? Math.round((v / totalMembers) * 100) : 0);
  const roleSplit = useMemo(
    () => Object.entries(stats?.by_role ?? {}).filter(([, v]) => v > 0).map(([name, value]) => ({
      name, value, color: ROLE_COLORS[name] ?? "var(--color-violet-300)",
    })),
    [stats],
  );
  const statusSplit = useMemo(
    () => (["Active", "Pending", "Inactive", "Rejected"] as const)
      .map((s) => ({ name: STATUS_LABEL[s], value: stats?.by_status?.[s] ?? 0, color: STATUS_COLORS[s] }))
      .filter((d) => d.value > 0),
    [stats],
  );
  const newThis = stats?.new_this_month ?? 0;
  const newLast = stats?.new_last_month ?? 0;
  const monthDelta = newLast > 0 ? Math.round(((newThis - newLast) / newLast) * 100) : null;
  const joinedInWindow = growth.reduce((sum, p) => sum + p.new, 0);
  const growthHasData = growth.some((p) => p.value > 0);

  // ── selection ─────────────────────────────────────────────────────────────
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const toggleAll = () => setSelected(allOnPage ? [] : rows.map((r) => r.id));
  const toggleOne = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // ── actions ───────────────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(m: ApiMember) {
    setEditingId(m.id);
    setForm({
      name: m.full_name, email: m.email, phone: m.phone, role: (m.role as Role) || "Member",
      status: (m.status as Status) || "Active", location: m.location, segment: (m.segment as Segment) || "",
      gender: m.gender || "Female", dob: m.dob, referral: m.referral, avatar: m.avatar,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are both needed");
      return;
    }
    setBusy(true);
    try {
      const body = {
        full_name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role,
        location: form.location.trim(), segment: form.segment || undefined, gender: form.gender,
        dob: form.dob.trim(), referral: form.referral.trim(), avatar: form.avatar,
      };
      if (editingId) {
        const saved = await apiUpdateMember(editingId, body);
        toast.success(`${saved.full_name} saved`);
      } else {
        const created = await apiCreateMember({ ...body, status: form.status });
        toast.success(`${created.full_name} added to the directory`, {
          description: "No login was created — she signs up herself, and her account links to this row.",
        });
        setSelectedId(created.id);
        setActiveTab("Overview");
      }
      setFormOpen(false);
      await refreshAll();
    } catch (err) {
      toast.error(editingId ? "Could not save the member" : "Could not add the member", { description: memberError(err) });
    } finally {
      setBusy(false);
    }
  }

  function askFor(kind: ReasonKind, member?: ApiMember, ids?: string[]) {
    setReason("");
    setAsk({ kind, member, ids });
  }

  async function runAsk() {
    if (!ask) return;
    const copy = REASON_COPY[ask.kind];
    const why = reason.trim();
    if (copy.required && !why) {
      toast.error("A reason is needed", { description: "It is recorded, and where it is hers to know, she is told." });
      return;
    }
    setBusy(true);
    try {
      const m = ask.member;
      const name = m?.full_name ?? "";
      switch (ask.kind) {
        case "approve": if (m) { await apiApproveMember(m.id, why); toast.success(`${name} approved`); } break;
        case "reject": if (m) { await apiRejectMember(m.id, why); toast.success(`${name} rejected`, { description: "She has been told why." }); } break;
        case "suspend": if (m) { await apiSuspendMember(m.id, why); toast.success(`${name} suspended`, { description: "She cannot sign in until restored." }); } break;
        case "restore": if (m) { await apiRestoreMember(m.id, why); toast.success(`${name} can sign in again`); } break;
        case "delete":
          if (m) {
            const res = await apiDeleteMemberWithReason(m.id, why);
            toast.success(`${name} deleted`, { description: res.message });
            if (selectedId === m.id) setSelectedId("");
          }
          break;
        case "bulk-suspend":
        case "bulk-restore": {
          const res = await apiBulkMemberStatus(ask.ids ?? [], ask.kind === "bulk-suspend" ? "Inactive" : "Active", why);
          toast.success(res.message);
          setSelected([]);
          break;
        }
      }
      setAsk(null);
      await refreshAll();
    } catch (err) {
      toast.error("That did not go through", { description: memberError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function resetPasswordFor(m: ApiMember) {
    const ok = await confirm({
      title: `Send ${m.full_name} a reset link?`,
      description: "A single-use link, valid 24 hours, goes to her email. Nobody here sees or sets her password.",
      confirmLabel: "Send the link",
    });
    if (!ok) return;
    try {
      const res = await apiResetMemberPassword(m.id);
      if (res.delivered) toast.success("Reset link sent", { description: res.message });
      else toast.error("Link issued but not delivered", { description: res.message });
      if (selectedId === m.id) void loadProfile(m.id);
    } catch (err) {
      toast.error("Could not start a reset", { description: memberError(err) });
    }
  }

  async function exportCsv(ids?: string[]) {
    setExporting(true);
    try {
      const blob = await apiExportMembers(ids
        ? { ids: ids.join(",") }
        : { q: q || undefined, role: roleFilter || undefined, status: statusFilter || undefined, segment: segmentFilter || undefined });
      saveBlob(blob, `members-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(ids ? `Exported ${ids.length} selected member${ids.length === 1 ? "" : "s"}` : `Exported ${total.toLocaleString()} member${total === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Could not export", { description: memberError(err) });
    } finally {
      setExporting(false);
    }
  }

  async function handleAvatarChange(id: string, url: string | null) {
    try {
      await apiUpdateMember(id, { avatar: url ?? "" });
      await refreshAll();
    } catch (err) {
      toast.error("Could not update the photo", { description: memberError(err) });
    }
  }

  /** The row actions, shared by the table menu and the profile's quick actions. */
  function actionsFor(m: ApiMember) {
    return {
      canApprove: m.status === "Pending" || m.status === "Rejected",
      canReject: m.status === "Pending",
      canSuspend: m.status === "Active",
      canRestore: m.status === "Inactive",
    };
  }

  const member = profile?.member ?? rows.find((r) => r.id === selectedId) ?? null;
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Members</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Everyone in the directory — find her, see where her account stands, and act on it.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-sm btn-outline" disabled={exporting || total === 0} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : anyFilter ? `Export ${total.toLocaleString()} filtered` : "Export CSV"}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add member
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Members" value={totalMembers.toLocaleString()} icon={Users} tone="brand"
                  deltaNote={stats ? `${newThis} joined this month` : "Counting…"} />
        <StatCard label="Active" value={(stats?.active ?? 0).toLocaleString()} icon={UserCheck} tone="violet"
                  deltaNote={stats ? `${pct(stats.active)}% of members · ${stats.inactive} suspended` : "Counting…"} />
        <StatCard label="New this month" value={newThis.toLocaleString()} icon={UserPlus} tone="emerald"
                  delta={monthDelta === null ? undefined : `${Math.abs(monthDelta)}%`}
                  deltaDir={monthDelta !== null && monthDelta < 0 ? "down" : "up"}
                  deltaNote={monthDelta === null ? (stats ? "none joined last month" : "Counting…") : `vs ${newLast} last month`} />
        <StatCard label="Verified accounts" value={(stats?.verified ?? 0).toLocaleString()} icon={BadgeCheck} tone="sky"
                  deltaNote="Completed ID verification" />
        <StatCard label="Pending review" value={(stats?.pending ?? 0).toLocaleString()} icon={Clock}
                  tone={(stats?.pending ?? 0) > 0 ? "amber" : "slate"}
                  deltaNote={(stats?.pending ?? 0) > 0 ? "Waiting for a decision" : "Nobody waiting"} />
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Directory growth</h2>
            <span className="text-xs text-ink-subtle">Last 12 weeks</span>
          </div>
          <p className="font-display text-2xl font-bold text-ink">
            {totalMembers.toLocaleString()}{" "}
            {joinedInWindow > 0 && (
              <span className="align-middle text-xs font-semibold text-status-ok-ink">+{joinedInWindow} in 12 weeks</span>
            )}
          </p>
          {growthHasData ? (
            <AreaTrend data={growth.map((p) => ({ label: p.label, value: p.value }))} color="var(--color-brand-600)" height={170} id="growth" chartLabel="Directory size by week" />
          ) : (
            <p className="py-12 text-center text-sm text-ink-subtle">{stats ? "No members yet." : "Loading…"}</p>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <Link href="/dashboard/users/roles" className="font-display text-base font-semibold text-ink hover:text-brand-ink">
              Members by role
            </Link>
            <Link href="/dashboard/users/roles" className="text-xs font-semibold text-brand-ink hover:text-brand-ink">
              Roles
            </Link>
          </div>
          {roleSplit.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-subtle">{stats ? "No members yet." : "Loading…"}</p>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <DonutChart data={roleSplit} centerValue={totalMembers.toLocaleString()} centerLabel="Members" size={156} />
              </div>
              <div className="mt-4">
                <Legend items={roleSplit.map((r) => ({ name: r.name, value: `${r.value.toLocaleString()} (${pct(r.value)}%)`, color: r.color }))} />
              </div>
            </>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-ink">Members by status</h2>
          {statusSplit.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-subtle">{stats ? "No members yet." : "Loading…"}</p>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <DonutChart data={statusSplit} centerValue={totalMembers.toLocaleString()} centerLabel="Members" size={156} />
              </div>
              <div className="mt-4">
                <Legend items={statusSplit.map((v) => ({ name: v.name, value: `${v.value.toLocaleString()} (${pct(v.value)}%)`, color: v.color }))} />
              </div>
            </>
          )}
        </Card>
      </div>

      {/* table + detail panel */}
      <div className="mt-6 flex flex-col gap-6 xl:flex-row">
        <Card className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone or code…"
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu align="left" trigger={<Dropdown label={labelOf(ROLE_OPTIONS, roleFilter)} />}>
              {ROLE_OPTIONS.map((o) => <MenuItem key={o.value} onClick={() => pickRole(o.value)}>{o.label}</MenuItem>)}
            </Menu>
            <Menu align="left" trigger={<Dropdown label={labelOf(STATUS_OPTIONS, statusFilter)} />}>
              {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} onClick={() => pickStatus(o.value)}>{o.label}</MenuItem>)}
            </Menu>
            <Menu align="left" trigger={<Dropdown label={labelOf(SEGMENT_OPTIONS, segmentFilter)} />}>
              {SEGMENT_OPTIONS.map((o) => <MenuItem key={o.value} onClick={() => pickSegment(o.value)}>{o.label}</MenuItem>)}
            </Menu>
            <Menu align="right" trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> Quick</span>}>
              <MenuItem onClick={() => pickStatus("Pending")}>Waiting for review</MenuItem>
              <MenuItem onClick={() => pickStatus("Inactive")}>Suspended only</MenuItem>
              <MenuItem onClick={() => pickSegment(NONE)}>No segment set</MenuItem>
              <MenuItem onClick={clearFilters}>Clear all filters</MenuItem>
            </Menu>
          </div>

          {selected.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-tint/60 px-3 py-2 text-sm">
              <span className="font-semibold text-brand-ink">{selected.length} selected on this page</span>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-sm btn-outline" onClick={() => askFor("bulk-suspend", undefined, selected)}>
                  <Ban className="h-3.5 w-3.5" /> Suspend
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => askFor("bulk-restore", undefined, selected)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
                <button className="btn btn-sm btn-outline" disabled={exporting} onClick={() => void exportCsv(selected)}>
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setSelected([])}>Clear</button>
              </div>
            </div>
          )}

          {listLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={anyFilter ? "No member matches that" : "No members yet"}
              description={anyFilter ? "Try a different search, or clear the filters." : "When a woman signs up, or you add one, she appears here."}
              action={anyFilter
                ? <button className="btn btn-sm btn-outline" onClick={clearFilters}>Clear filters</button>
                : <button className="btn btn-sm btn-primary" onClick={openAdd}><Plus className="h-4 w-4" /> Add member</button>}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className="px-2 py-3">
                        <input type="checkbox" aria-label="Select everyone on this page" checked={allOnPage} onChange={toggleAll} className="rounded border-line-strong accent-brand-600" />
                      </th>
                      <th scope="col" className="px-2 py-3">Member</th>
                      <th scope="col" className="px-2 py-3">Role</th>
                      <th scope="col" className="whitespace-nowrap px-2 py-3">Contact</th>
                      <th scope="col" className="px-2 py-3">Segment</th>
                      <th scope="col" className="px-2 py-3">Status</th>
                      <th scope="col" className="whitespace-nowrap px-2 py-3">Joined</th>
                      <th scope="col" className="px-2 py-3 text-right">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => {
                      const a = actionsFor(r);
                      return (
                        <tr
                          key={r.id}
                          onClick={() => { setSelectedId(r.id); setActiveTab("Overview"); }}
                          className={`cursor-pointer text-sm hover:bg-surface-hover/60 ${r.id === selectedId ? "bg-brand-tint/60 dark:bg-brand-500/10" : ""}`}
                        >
                          <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${r.full_name}`} checked={selected.includes(r.id)} onChange={() => toggleOne(r.id)} className="rounded border-line-strong accent-brand-600" />
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={r.full_name} src={r.avatar} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{r.full_name}</p>
                                <p className="text-2xs text-ink-subtle">{r.code || r.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3"><Badge tone={ROLE_TONE[r.role] ?? "slate"}>{r.role}</Badge></td>
                          <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">
                            <p className="text-xs">{r.email}</p>
                            <p className="text-2xs">{r.phone || "—"}</p>
                          </td>
                          <td className="px-2 py-3 text-xs text-ink-subtle">{r.segment || "—"}</td>
                          <td className="px-2 py-3"><Badge tone={STATUS_TONE[r.status] ?? "slate"}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                          <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{r.joined || "—"}</td>
                          <td className="px-2 py-3 text-right">
                            <div onClick={(e) => e.stopPropagation()}>
                              <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                                <MenuItem icon={Eye} onClick={() => { setSelectedId(r.id); setActiveTab("Overview"); }}>View profile</MenuItem>
                                <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Edit details</MenuItem>
                                {a.canApprove && <MenuItem icon={Check} onClick={() => askFor("approve", r)}>Approve</MenuItem>}
                                {a.canReject && <MenuItem icon={X} onClick={() => askFor("reject", r)}>Reject…</MenuItem>}
                                {a.canSuspend && <MenuItem icon={Ban} onClick={() => askFor("suspend", r)}>Suspend…</MenuItem>}
                                {a.canRestore && <MenuItem icon={RotateCcw} onClick={() => askFor("restore", r)}>Restore</MenuItem>}
                                <MenuItem icon={KeyRound} onClick={() => void resetPasswordFor(r)}>Send reset link</MenuItem>
                                <MenuItem icon={MessageSquare} href="/dashboard/messages">Send message</MenuItem>
                                <MenuItem icon={Trash2} danger onClick={() => askFor("delete", r)}>Delete…</MenuItem>
                              </Menu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={pages}
                onPageChange={(p) => setPage(Math.min(Math.max(1, p), pages))}
                showing={`Showing ${showingFrom} to ${showingTo} of ${total.toLocaleString()} member${total === 1 ? "" : "s"}`}
              />
            </>
          )}
        </Card>

        {/* detail panel */}
        {selectedId && member && (
          <div className="w-full min-w-0 shrink-0 xl:w-[360px]">
            <Card className="overflow-hidden p-0">
              <div className="relative rounded-t-2xl bg-linear-to-br from-brand-50 to-violet-50 p-5">
                <button aria-label="Close profile" onClick={() => setSelectedId("")} className="absolute right-4 top-4 text-ink-subtle hover:text-ink-muted"><X className="h-4 w-4" /></button>
                <div className="flex items-center gap-3">
                  <ImageUpload
                    variant="avatar"
                    kind="avatar"
                    size="md"
                    compact
                    name={member.full_name}
                    value={member.avatar || null}
                    onChange={(url) => void handleAvatarChange(member.id, url)}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-lg font-bold text-ink">{member.full_name}</p>
                      <Badge tone={STATUS_TONE[member.status] ?? "slate"}>{STATUS_LABEL[member.status] ?? member.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-subtle">{member.role} · {member.code || member.id}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-ink-subtle">
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {member.phone || "—"}</p>
                  <p className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5 shrink-0" /> {member.email}</p>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto border-b border-line px-4 text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 font-medium ${
                      activeTab === t ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"
                    }`}
                  >
                    {t}
                    {t === "Activity" && profile && profile.history.length > 0 && <span className="ml-1 text-ink-faint">{profile.history.length}</span>}
                    {t === "Programmes" && profile && profile.activity.enrolments > 0 && <span className="ml-1 text-ink-faint">{profile.activity.enrolments}</span>}
                    {t === "Appointments" && profile && profile.activity.bookings > 0 && <span className="ml-1 text-ink-faint">{profile.activity.bookings}</span>}
                  </button>
                ))}
              </div>

              {profileLoading && !profile ? (
                <div className="flex items-center justify-center py-16"><Spinner /></div>
              ) : activeTab === "Overview" ? (
                <div className="space-y-5 p-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-ink">Directory</h3>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(member)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <Field k="Full name" v={member.full_name} />
                      <Field k="Location" v={member.location} />
                      <Field k="Date of birth" v={member.dob} />
                      <Field k="Joined" v={member.joined} />
                      <Field k="Gender" v={member.gender} />
                      <Field k="Referral code" v={member.referral} />
                      <Field k="Segment" v={member.segment} />
                      <Field k="Verified on" v={member.verified_on} />
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Account</h3>
                    {profile?.account ? (
                      <div className="space-y-2 rounded-xl border border-line p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Verification</span>
                          <Badge tone={VERIFY_TONE[profile.account.verification_status] ?? "slate"}>{profile.account.verification_label}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Can sign in</span>
                          <span className={`font-medium ${profile.account.is_active ? "text-status-ok-ink" : "text-status-danger-ink"}`}>
                            {profile.account.is_active ? "Yes" : "No — suspended"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Last signed in</span>
                          <span className="font-medium text-ink-muted">{profile.account.last_login_at ? shortDateTime(profile.account.last_login_at) : "Never"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Email confirmed</span>
                          <span className="font-medium text-ink-muted">{profile.account.email_verified_at ? shortDate(profile.account.email_verified_at) : "Not yet"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Verified</span>
                          <span className="font-medium text-ink-muted">{profile.account.verified_at ? shortDate(profile.account.verified_at) : "Not yet"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-subtle">Language · onboarding</span>
                          <span className="font-medium text-ink-muted">{profile.account.locale.toUpperCase()} · {profile.account.onboarding_complete ? "done" : "not finished"}</span>
                        </div>
                        {profile.account.rejection_reason && (
                          <p className="rounded-lg bg-status-danger-bg px-2 py-1.5 text-status-danger-ink">
                            Rejected: {profile.account.rejection_reason}
                          </p>
                        )}
                        {profile.account.verification_status === "in_review" && (
                          <Link href="/dashboard/users/verification" className="flex items-center gap-1 font-semibold text-brand-ink">
                            Open her documents in the review queue <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    ) : profile ? (
                      <div className="flex items-start gap-2 rounded-xl border border-dashed border-line-strong p-3 text-xs text-ink-subtle">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>No login behind this profile. She was added by staff and has not signed up herself, so there is nothing to suspend or reset.</span>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-subtle">Loading…</p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">What she has done</h3>
                    {profile ? (
                      profile.activity.total === 0 ? (
                        <p className="rounded-xl border border-dashed border-line-strong p-3 text-xs text-ink-subtle">
                          Nothing recorded yet — no bookings, enrolments, posts or orders.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {([
                            ["Bookings", profile.activity.bookings], ["Enrolled", profile.activity.enrolments],
                            ["Posts", profile.activity.posts + profile.activity.replies], ["Circles", profile.activity.circles],
                            ["Events", profile.activity.events], ["Applied", profile.activity.applications],
                            ["Orders", profile.activity.orders], ["Total", profile.activity.total],
                          ] as [string, number][]).map(([k, v]) => (
                            <div key={k} className="rounded-lg bg-surface-inset/70 px-1 py-2">
                              <p className="font-display text-base font-bold text-ink">{v}</p>
                              <p className="text-2xs text-ink-subtle">{k}</p>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-ink-subtle">Counting…</p>
                    )}
                  </div>

                  {profile?.account && (
                    <div className="border-t border-line pt-4 dark:border-white/10">
                      <MemberThemeControl memberId={member.id} memberName={member.full_name} />
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Actions</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {actionsFor(member).canApprove && (
                        <button onClick={() => askFor("approve", member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-status-ok-ink hover:bg-surface-hover">
                          <Check className="h-4 w-4" /> Approve
                        </button>
                      )}
                      {actionsFor(member).canReject && (
                        <button onClick={() => askFor("reject", member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-status-danger-ink hover:bg-surface-hover">
                          <X className="h-4 w-4" /> Reject
                        </button>
                      )}
                      {actionsFor(member).canSuspend && (
                        <button onClick={() => askFor("suspend", member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover">
                          <Ban className="h-4 w-4" /> Suspend
                        </button>
                      )}
                      {actionsFor(member).canRestore && (
                        <button onClick={() => askFor("restore", member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-status-ok-ink hover:bg-surface-hover">
                          <RotateCcw className="h-4 w-4" /> Restore
                        </button>
                      )}
                      {profile?.account && (
                        <button onClick={() => void resetPasswordFor(member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover">
                          <KeyRound className="h-4 w-4" /> Reset link
                        </button>
                      )}
                      <Link href="/dashboard/messages" className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover">
                        <MessageSquare className="h-4 w-4" /> Message
                      </Link>
                      <button onClick={() => askFor("delete", member)} className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-status-danger-ink hover:bg-surface-hover">
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeTab === "Activity" ? (
                <div className="p-5">
                  {!profile || profile.history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-10 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"><Activity className="h-5 w-5" /></span>
                      <p className="text-sm font-medium text-ink-muted">No staff action recorded</p>
                      <p className="text-xs text-ink-subtle">Nothing has been done to {member.full_name}&apos;s account from this dashboard yet.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {profile.history.map((h) => (
                        <li key={h.id} className="rounded-xl border border-line p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-ink">{h.action}</span>
                            <span className="shrink-0 text-ink-subtle">{shortDateTime(h.when)}</span>
                          </div>
                          {h.detail && <p className="mt-1 text-ink-muted">{h.detail}</p>}
                          <p className="mt-1 text-ink-subtle">by {h.by || "—"}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/dashboard/settings/activity" className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-ink">
                    Full activity log <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : activeTab === "Programmes" ? (
                <div className="p-5">
                  {!profile || profile.enrolments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-10 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"><BookOpen className="h-5 w-5" /></span>
                      <p className="text-sm font-medium text-ink-muted">Not enrolled in any programme</p>
                      <p className="text-xs text-ink-subtle">{member.full_name} has no enrolments on record.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {profile.enrolments.map((e) => (
                        <li key={e.id} className="rounded-xl border border-line p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-ink">{e.program_name || "Programme"}</span>
                            <Badge tone={e.status === "completed" ? "emerald" : e.status === "active" ? "brand" : "slate"}>{e.status || "—"}</Badge>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, e.progress))}%` }} />
                          </div>
                          <p className="mt-1 text-ink-subtle">{e.progress}% · started {shortDate(e.started)}</p>
                        </li>
                      ))}
                      {profile.activity.enrolments > profile.enrolments.length && (
                        <li className="text-center text-2xs text-ink-subtle">Showing the latest {profile.enrolments.length} of {profile.activity.enrolments}</li>
                      )}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="p-5">
                  {!profile || profile.bookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-10 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"><Inbox className="h-5 w-5" /></span>
                      <p className="text-sm font-medium text-ink-muted">No appointments</p>
                      <p className="text-xs text-ink-subtle">{member.full_name} has not booked anything.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {profile.bookings.map((b) => (
                        <li key={b.id} className="rounded-xl border border-line p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-ink">{b.service_name || "Appointment"}</span>
                            <Badge tone={b.status === "completed" ? "emerald" : b.status === "cancelled" ? "rose" : "brand"}>{b.status || "—"}</Badge>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-ink-subtle">
                            <CalendarDays className="h-3 w-3" /> {b.date || "—"}{b.time ? ` · ${b.time}` : ""}{b.mode ? ` · ${b.mode}` : ""}
                          </p>
                        </li>
                      ))}
                      {profile.activity.bookings > profile.bookings.length && (
                        <li className="text-center text-2xs text-ink-subtle">Showing the latest {profile.bookings.length} of {profile.activity.bookings}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* add / edit member */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit member" : "Add a member"}
        description={editingId ? "Changes her directory row, and her name, phone and photo on her own profile." : "A directory row only — she creates her own login when she signs up, and it links to this."}
        icon={editingId ? Pencil : UserPlus}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitForm()}>
              {editingId ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {busy ? "Saving…" : editingId ? "Save changes" : "Add member"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <ImageUpload
            className="col-span-2"
            variant="avatar"
            kind="avatar"
            name={form.name || "New member"}
            label="Profile photo"
            hint="Optional — JPG, PNG or WEBP up to 5 MB."
            value={form.avatar || null}
            onChange={(url) => setForm((f) => ({ ...f, avatar: url ?? "" }))}
          />
          <Input label="Full name" icon={User} required className="col-span-2" value={form.name}
                 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Her full name" />
          <Input label="Email" icon={Mail} type="email" required className="col-span-2" value={form.email}
                 onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
          <Input label="Phone" icon={Phone} type="tel" value={form.phone}
                 onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 00000 00000" />
          <Select label="Role" icon={ShieldCheck} value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  options={["Member", "Instructor", "Supervisor", "Admin"]} />
          {!editingId && (
            <Select label="Starting status" value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                    options={[{ value: "Active", label: "Active" }, { value: "Pending", label: "Pending review" }]} />
          )}
          <Input label="Location" icon={MapPin} value={form.location}
                 onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="City, State" />
          <Select label="Segment" value={form.segment}
                  onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value as Segment | "" }))}
                  options={[{ value: "", label: "Not set" }, "Entrepreneur", "Student", "Artisan", "Job Seeker", "Support Seeker"]} />
          <Select label="Gender" value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  options={["Female", "Male", "Other"]} />
          <Input label="Date of birth" value={form.dob}
                 onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} placeholder="e.g. 12 Mar 1990" />
          <Input label="Referral code" value={form.referral}
                 onChange={(e) => setForm((f) => ({ ...f, referral: e.target.value }))} placeholder="Optional" />
        </div>
      </Modal>

      {/* reason dialog */}
      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask ? REASON_COPY[ask.kind].title(ask.member?.full_name ?? `${ask.ids?.length ?? 0} member${(ask.ids?.length ?? 0) === 1 ? "" : "s"}`) : ""}
        icon={ask?.kind === "delete" ? Trash2 : ask?.kind.includes("suspend") ? Ban : ask?.kind === "reject" ? X : ask?.kind === "approve" ? Check : RotateCcw}
        iconTone={ask && REASON_COPY[ask.kind].danger ? "rose" : "brand"}
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAsk(null)}>Cancel</button>
            <button className={`btn ${ask && REASON_COPY[ask.kind].danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={() => void runAsk()}>
              {busy ? "Working…" : ask ? REASON_COPY[ask.kind].confirm : ""}
            </button>
          </>
        }
      >
        {ask && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">{REASON_COPY[ask.kind].body}</p>
            <Textarea
              label={REASON_COPY[ask.kind].required ? "Reason" : "Reason (optional)"}
              required={REASON_COPY[ask.kind].required}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={ask.kind === "reject" ? "What she needs to fix or send" : ask.kind.includes("suspend") ? "What happened" : "Kept in the audit log"}
              hint="Recorded with your name and the time."
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  BadgeCheck,
  UserX,
  Calendar,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Plus,
  MoreHorizontal,
  Phone,
  Mail,
  X,
  ShieldCheck,
  User,
  MapPin,
  Pencil,
  MessageSquare,
  KeyRound,
  Activity,
  Ban,
  Trash2,
  ChevronRight,
  Eye,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { Avatar, Card, ImageUpload, Input, Menu, MenuItem, Modal, Select, StatCard, Switch, useToast, useConfirm } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import AreaTrend from "@/components/charts/AreaTrend";
import {
  apiListMembers,
  apiMemberStats,
  apiCreateMember,
  apiUpdateMember,
  apiDeleteMember,
  apiResetMemberPassword,
  apiSetMemberStatus,
  type ApiMember,
  type MemberStats,
} from "@/lib/api";
import { memberError } from "@/lib/member-api";
import MemberThemeControl from "@/components/admin/MemberThemeControl";

const GROWTH = [
  { label: "Apr 20", value: 3000 },
  { label: "Apr 27", value: 4200 },
  { label: "May 4", value: 5600 },
  { label: "May 11", value: 7500 },
  { label: "May 18", value: 9800 },
  { label: "May 25", value: 12845 },
];

// Fixed brand colours per role / verification bucket (charts are a frontend concern).
const ROLE_COLORS: Record<string, string> = {
  Member: "var(--color-brand-600)",
  Instructor: "var(--color-violet-500)",
  Supervisor: "var(--status-ok-solid)",
  Admin: "var(--status-info-solid)",
};

type Role = "Member" | "Instructor" | "Supervisor" | "Admin";
type Status = "Active" | "Inactive" | "Pending" | "Rejected";
type Segment = "Entrepreneur" | "Student" | "Artisan" | "Job Seeker" | "Support Seeker";
type UserRow = {
  _id: string; // mongo id — used for update/delete/status calls
  name: string;
  role: Role;
  email: string;
  phone: string;
  status: Status;
  joined: string;
  createdAt: string;
  id: string; // display code, e.g. WC-12564
  location: string;
  dob: string;
  gender: string;
  referral: string;
  engagement: number;
  segment: Segment;
  verifiedOn: string;
  avatar: string;
};

function toRow(m: ApiMember): UserRow {
  return {
    _id: m.id,
    name: m.full_name,
    role: (m.role as Role) || "Member",
    email: m.email,
    phone: m.phone || "—",
    status: (m.status as Status) || "Active",
    joined: m.joined || "—",
    createdAt: m.created_at || "",
    id: m.code || m.id,
    location: m.location || "—",
    dob: m.dob || "—",
    gender: m.gender || "—",
    referral: m.referral || "—",
    engagement: m.engagement ?? 0,
    segment: (m.segment as Segment) || "Entrepreneur",
    verifiedOn: m.verified_on || "—",
    avatar: m.avatar || "",
  };
}

const ROLE_TONE: Record<Role, string> = {
  Member: "bg-brand-tint text-brand-ink",
  Instructor: "bg-violet-tint text-violet-ink",
  Supervisor: "bg-status-ok-bg text-status-ok-ink",
  Admin: "bg-status-info-bg text-status-info-ink",
};
const STATUS_TONE: Record<Status, string> = {
  Active: "bg-status-ok-bg text-status-ok-ink",
  Inactive: "bg-status-danger-bg text-status-danger-ink",
  Pending: "bg-status-warn-bg text-status-warn-ink",
  Rejected: "bg-status-danger-bg text-status-danger-ink",
};

const ROLE_OPTIONS: (Role | "All Roles")[] = ["All Roles", "Member", "Instructor", "Supervisor"];
const STATUS_OPTIONS: (Status | "All Status")[] = ["All Status", "Active", "Inactive", "Pending", "Rejected"];
const SEGMENT_OPTIONS: (Segment | "All Segments")[] = ["All Segments", "Entrepreneur", "Student", "Artisan", "Job Seeker"];

const PAGE_SIZE = 6;

function Dropdown({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button className={`btn btn-sm btn-outline ${className}`}>
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
    </button>
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

export default function UserManagementPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTIONS)[number]>("All Roles");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("All Status");
  const [segmentFilter, setSegmentFilter] = useState<(typeof SEGMENT_OPTIONS)[number]>("All Segments");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [addOpen, setAddOpen] = useState(false);
  const [dateRange, setDateRange] = useState("This Month");
  // When set, the modal is editing this member rather than creating one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    role: Role;
    status: Status;
    location: string;
    segment: Segment;
    gender: string;
    avatar: string;
    welcomeEmail: boolean;
  }>({
    name: "",
    email: "",
    phone: "",
    role: "Member",
    status: "Active",
    location: "",
    segment: "Entrepreneur",
    gender: "Female",
    avatar: "",
    welcomeEmail: true,
  });

  // Load members + stats from the backend (client-side filtering/paging stays as-is).
  const refresh = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        apiListMembers({ page_size: 100, sort: "-created_at" }),
        apiMemberStats(),
      ]);
      const mapped = list.items.map(toRow);
      setRows(mapped);
      setStats(s);
      setSelectedId((cur) => (cur && mapped.some((r) => r.id === cur) ? cur : mapped[0]?.id ?? ""));
    } catch {
      /* leave current rows; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q);
      const matchesRole = roleFilter === "All Roles" || r.role === roleFilter;
      const matchesStatus = statusFilter === "All Status" || r.status === statusFilter;
      const matchesSegment = segmentFilter === "All Segments" || r.segment === segmentFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesSegment;
    });
  }, [rows, search, roleFilter, statusFilter, segmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, filtered.length);

  const selectedUser = rows.find((r) => r.id === selectedId) ?? filtered[0] ?? rows[0] ?? null;

  // Live figures for the stat cards + donuts, derived from the backend stats.
  const totalUsers = stats?.total ?? rows.length;
  const pct = (v: number) => (totalUsers ? Math.round((v / totalUsers) * 100) : 0);
  const roleSplit = useMemo(
    () =>
      Object.entries(stats?.by_role ?? {}).map(([name, value]) => ({
        name: `${name}s`,
        value,
        color: ROLE_COLORS[name] ?? "var(--color-violet-300)",
      })),
    [stats],
  );
  const roleLegend = roleSplit.map((r) => ({
    name: r.name,
    value: `${r.value.toLocaleString()} (${pct(r.value)}%)`,
    color: r.color,
  }));
  const verifiedCount = stats ? Math.max(0, stats.total - stats.pending - stats.rejected) : 0;
  const verifySplit = [
    { name: "Verified", value: verifiedCount, color: "var(--status-ok-solid)" },
    { name: "Pending", value: stats?.pending ?? 0, color: "var(--status-warn-solid)" },
    { name: "Rejected", value: stats?.rejected ?? 0, color: "var(--status-danger-solid)" },
  ];
  const verifyLegend = verifySplit.map((v) => ({
    name: v.name,
    value: `${v.value.toLocaleString()} (${pct(v.value)}%)`,
    color: v.color,
  }));
  const newThisMonth = useMemo(() => {
    const now = new Date();
    return rows.filter((r) => {
      const d = new Date(r.createdAt);
      return (
        !Number.isNaN(d.getTime()) &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [rows]);

  const resetPage = () => setPage(1);

  function selectRow(id: string) {
    setSelectedId(id);
    setPanelOpen(true);
    setActiveTab("Overview");
  }

  async function deleteRow(mongoId: string) {
    if (!(await confirm({
      title: "Delete this member?",
      description: "Her profile, bookings and enrolments are removed. This cannot be undone.",
      confirmLabel: "Delete member",
      danger: true,
    }))) return;
    try {
      await apiDeleteMember(mongoId);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the member", { description: memberError(err) });
    }
  }


  /** Emails a reset link to the selected member. */
  async function resetPasswordFor(id: string, name: string) {
    try {
      const res = await apiResetMemberPassword(id);
      toast.success(res.message || `A reset link is on its way to ${name}.`);
    } catch (err) {
      // This used to set the same `resetNote` as the success path, which was
      // rendered in a GREEN box — so a failed reset was reported to the admin
      // as though it had worked, in the colour reserved for success.
      toast.error(memberError(err));
    }
  }

  async function suspendSelected() {
    if (!selectedUser) return;
    const next = selectedUser.status === "Active" ? "Inactive" : "Active";
    try {
      await apiSetMemberStatus(selectedUser._id, next);
      await refresh();
    } catch (err) {
      toast.error("Could not suspend the member", { description: memberError(err) });
    }
  }

  /** Save a newly uploaded (or removed) profile photo straight to the member. */
  async function handleAvatarChange(mongoId: string, url: string | null) {
    try {
      await apiUpdateMember(mongoId, { avatar: url ?? "" });
      await refresh();
    } catch (err) {
      toast.error("Could not update the photo", { description: memberError(err) });
    }
  }

  /** Open the modal pre-filled, so "Edit" changes a member instead of adding one. */
  function startEdit(u: {
    id: string; name: string; email: string; phone?: string; role?: string;
    status?: string; location?: string; segment?: string; avatar?: string;
  }) {
    setEditingId(u.id);
    setForm({
      name: u.name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      role: (u.role as typeof form.role) ?? "Member",
      status: (u.status as typeof form.status) ?? "Active",
      location: u.location ?? "",
      segment: (u.segment as typeof form.segment) ?? "Entrepreneur",
      gender: "Female",
      avatar: u.avatar ?? "",
      welcomeEmail: false,
    });
    setAddOpen(true);
  }

  async function handleAddUser() {
    if (!form.name.trim() || !form.email.trim()) return;
    try {
      const created = await apiCreateMember({
        full_name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        status: form.status,
        location: form.location.trim(),
        segment: form.segment,
        gender: form.gender,
        avatar: form.avatar,
      });
      await refresh();
      setSelectedId(created.code || created.id);
      setPanelOpen(true);
      setActiveTab("Overview");
      setForm({
        name: "",
        email: "",
        phone: "",
        role: "Member",
        status: "Active",
        location: "",
        segment: "Entrepreneur",
        gender: "Female",
        avatar: "",
        welcomeEmail: true,
      });
      setAddOpen(false);
      setPage(1);
    } catch (err) {
      toast.error("Could not add the user", { description: memberError(err) });
    }
  }

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              User Management
            </h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Manage all platform users, view details and take action.
            </p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline">
          <Calendar className="h-4 w-4 text-ink-subtle" />
          May 20, 2024 - May 26, 2024
          <ChevronDown className="h-4 w-4 text-ink-subtle" />
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Users" value={totalUsers.toLocaleString()} icon={Users} tone="brand" delta="12.5%" />
        <StatCard label="Active Users" value={(stats?.active ?? 0).toLocaleString()} icon={UserCheck} tone="violet" delta="8.3%" />
        <StatCard label="New This Month" value={newThisMonth.toLocaleString()} icon={UserPlus} tone="emerald" delta="15.7%" />
        <StatCard label="Verified Users" value={verifiedCount.toLocaleString()} icon={BadgeCheck} tone="amber" delta="10.2%" />
        <StatCard label="Inactive Users" value={(stats?.inactive ?? 0).toLocaleString()} icon={UserX} tone="rose" delta="3.1%" deltaDir="down" />
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">User Growth</h2>
            <Menu
              align="right"
              trigger={<Dropdown label={dateRange} />}
            >
              {["This Month", "Last Month", "This Quarter", "This Year", "All Time"].map((r) => (
                <MenuItem key={r} onClick={() => setDateRange(r)}>
                  {r}
                </MenuItem>
              ))}
            </Menu>
          </div>
          <p className="font-display text-2xl font-bold text-ink">
            {totalUsers.toLocaleString()}{" "}
            <span className="align-middle text-xs font-semibold text-status-ok-ink">↑ 12.5%</span>
          </p>
          <AreaTrend data={GROWTH} color="var(--color-brand-600)" height={170} id="growth" chartLabel="Member growth" />
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <Link
              href="/dashboard/users/roles"
              className="font-display text-base font-semibold text-ink hover:text-brand-ink"
            >
              Users by Role
            </Link>
            <Link
              href="/dashboard/users/roles"
              className="text-xs font-semibold text-brand-ink hover:text-brand-ink"
            >
              View All
            </Link>
          </div>
          <div className="flex flex-col items-center">
            <DonutChart data={roleSplit} centerValue={totalUsers.toLocaleString()} centerLabel="Total Users" size={156} />
          </div>
          <div className="mt-4">
            <Legend items={roleLegend} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-ink">
            User Verification Status
          </h2>
          <div className="flex flex-col items-center">
            <DonutChart data={verifySplit} centerValue={totalUsers.toLocaleString()} centerLabel="Total Users" size={156} />
          </div>
          <div className="mt-4">
            <Legend items={verifyLegend} />
          </div>
        </Card>
      </div>

      {/* table + detail panel */}
      <div className="mt-6 flex flex-col gap-6 xl:flex-row">
        {/* table */}
        <Card className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search by name, email or phone..."
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              align="left"
              trigger={<Dropdown label={roleFilter} />}
            >
              {ROLE_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt}
                  onClick={() => {
                    setRoleFilter(opt);
                    resetPage();
                  }}
                >
                  {opt}
                </MenuItem>
              ))}
            </Menu>
            <Menu
              align="left"
              trigger={<Dropdown label={statusFilter} />}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt}
                  onClick={() => {
                    setStatusFilter(opt);
                    resetPage();
                  }}
                >
                  {opt}
                </MenuItem>
              ))}
            </Menu>
            <Menu
              align="left"
              trigger={<Dropdown label={segmentFilter} />}
            >
              {SEGMENT_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt}
                  onClick={() => {
                    setSegmentFilter(opt);
                    resetPage();
                  }}
                >
                  {opt}
                </MenuItem>
              ))}
            </Menu>
            <Menu
              align="right"
              trigger={
                <button className="btn btn-sm btn-outline">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                </button>
              }
            >
              <MenuItem onClick={() => setStatusFilter("Active")}>Only active</MenuItem>
              <MenuItem onClick={() => setStatusFilter("Inactive")}>Only inactive</MenuItem>
              <MenuItem onClick={() => setRoleFilter("Member")}>Members only</MenuItem>
              <MenuItem
                onClick={() => {
                  setSearch("");
                  setRoleFilter("All Roles");
                  setStatusFilter("All Status");
                  setSegmentFilter("All Segments");
                  setPage(1);
                }}
              >
                Clear all filters
              </MenuItem>
            </Menu>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-215 border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3"><input type="checkbox" aria-label="Select all users on this page" className="rounded border-line-strong accent-brand-600" /></th>
                  <th scope="col" className="px-2 py-3">User</th>
                  <th scope="col" className="px-2 py-3">Role</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Email</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Phone</th>
                  <th scope="col" className="px-2 py-3">Status</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Joined On</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((r) => (
                  <tr
                    key={r.email}
                    onClick={() => selectRow(r.id)}
                    className={`cursor-pointer text-sm hover:bg-surface-hover/60 ${
                      panelOpen && r.id === selectedId ? "bg-brand-tint/60 dark:bg-brand-500/10" : ""
                    }`}
                  >
                    <td className="px-2 py-3"><input type="checkbox" aria-label={`Select ${r.name}`} onClick={(e) => e.stopPropagation()} className="rounded border-line-strong accent-brand-600" /></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} src={r.avatar} size="sm" />
                        <span className="font-medium text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold ${ROLE_TONE[r.role]}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{r.email}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{r.phone}</td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold ${STATUS_TONE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{r.joined}</td>
                    <td className="px-2 py-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={
                            <span className="flex text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></span>
                          }
                        >
                          <MenuItem icon={Eye} onClick={() => selectRow(r.id)}>View details</MenuItem>
                          <MenuItem icon={MessageSquare} href="/dashboard/messages">Send message</MenuItem>
                          <MenuItem icon={KeyRound} onClick={() => resetPasswordFor(r._id, r.name)}>
                            Reset password
                          </MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => deleteRow(r._id)}>Delete user</MenuItem>
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={8} className="px-2 py-10 text-center text-ink-subtle">
                      Loading users…
                    </td>
                  </tr>
                )}
                {!loading && pageRows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={8} className="px-2 py-10 text-center text-ink-subtle">
                      No users match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-subtle">Showing {showingFrom} to {showingTo} of {filtered.length} users</p>
            {/* Page numbers wrap on a narrow card rather than running past its
                right edge — with many pages this row is wider than a phone. */}
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={
                    n === currentPage
                      ? "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white"
                      : "flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
                  }
                >{n}</button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >›</button>
            </div>
          </div>
        </Card>

        {/* detail panel */}
        {panelOpen && selectedUser && (
          <div className="w-full min-w-0 shrink-0 xl:w-[340px]">
            <Card className="overflow-hidden p-0">
              <div className="relative rounded-t-2xl bg-linear-to-br from-brand-50 to-violet-50 p-5">
                <button aria-label="Close details" onClick={() => setPanelOpen(false)} className="absolute right-4 top-4 text-ink-subtle hover:text-ink-muted"><X className="h-4 w-4" /></button>
                <div className="flex items-center gap-3">
                  <ImageUpload
                    variant="avatar"
                    kind="avatar"
                    size="md"
                    compact
                    name={selectedUser.name}
                    value={selectedUser.avatar || null}
                    onChange={(url) => void handleAvatarChange(selectedUser._id, url)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-lg font-bold text-ink">{selectedUser.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${STATUS_TONE[selectedUser.status]}`}>{selectedUser.status}</span>
                    </div>
                    <p className="text-xs text-ink-subtle">{selectedUser.role} · ID: {selectedUser.id}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-ink-subtle">
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {selectedUser.phone}</p>
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {selectedUser.email}</p>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto border-b border-line px-4 text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {["Overview", "Activity", "Programs", "Appointments", "Documents"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-2.5 font-medium ${
                      activeTab === t ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {activeTab === "Overview" ? (
                <div className="space-y-4 p-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-ink">User Information</h3>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => startEdit(selectedUser)}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {[
                        ["Full Name", selectedUser.name],
                        ["Location", selectedUser.location],
                        ["Date of Birth", selectedUser.dob],
                        ["Joined On", selectedUser.joined],
                        ["Gender", selectedUser.gender],
                        ["Referral Code", selectedUser.referral],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-ink-subtle">{k}</p>
                          <p className="font-medium text-ink-muted">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <PanelRow icon={ShieldCheck} tone="text-status-ok-ink bg-status-ok-bg" title="Verification Status" sub={`Verified on ${selectedUser.verifiedOn}`} />
                  <PanelRow icon={Users} tone="text-violet-ink bg-violet-tint" title="User Segment" sub={`${selectedUser.segment} · High engagement segment`} />

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Engagement Score</h3>
                    <div className="flex items-center gap-4">
                      <DonutChart
                        data={[
                          { name: "Score", value: selectedUser.engagement, color: "var(--color-brand-600)" },
                          { name: "Rest", value: 100 - selectedUser.engagement, color: "var(--color-surface-inset)" },
                        ]}
                        centerValue={String(selectedUser.engagement)}
                        centerLabel="/100"
                        size={92}
                        thickness={10}
                      />
                      <div>
                        <p className="text-sm font-semibold text-brand-ink">
                          {selectedUser.engagement >= 70 ? "High Engagement" : selectedUser.engagement >= 40 ? "Moderate Engagement" : "Low Engagement"}
                        </p>
                        <p className="text-xs text-ink-subtle">Active platform user with consistent platform interaction.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 dark:border-white/10">
                    <MemberThemeControl
                      memberId={selectedUser._id}
                      memberName={selectedUser.name}
                    />
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Quick Actions</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href="/dashboard/messages"
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send Message
                      </Link>
                      <button
                        onClick={() =>
                          selectedUser && resetPasswordFor(selectedUser._id, selectedUser.name)
                        }
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover"
                      >
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </button>
                      <Link
                        href="/dashboard/settings/activity"
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover"
                      >
                        <Activity className="h-4 w-4" />
                        View Activity
                      </Link>
                      <button
                        onClick={suspendSelected}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-ink-muted hover:bg-surface-hover"
                      >
                        <Ban className="h-4 w-4" />
                        Suspend User
                      </button>
                      <button
                        onClick={() => deleteRow(selectedUser._id)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-line py-3 text-2xs font-medium text-status-danger-ink hover:bg-surface-hover"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete User
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">
                      <Inbox className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-ink-muted">No {activeTab.toLowerCase()} yet</p>
                    <p className="text-xs text-ink-subtle">
                      {selectedUser.name} has no {activeTab.toLowerCase()} records to show.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>




      {/* add user modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New User"
        description="Create a new platform user account."
        icon={UserPlus}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddUser}>
              <UserPlus className="h-4 w-4" /> Add User
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <ImageUpload
            className="col-span-2"
            variant="avatar"
            kind="avatar"
            name={form.name || "New Member"}
            label="Profile photo"
            hint="Optional — drag one in, or browse. JPG, PNG or WEBP up to 5 MB."
            value={form.avatar || null}
            onChange={(url) => setForm((f) => ({ ...f, avatar: url ?? "" }))}
          />
          <Input
            label="Full Name"
            icon={User}
            required
            className="col-span-2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Enter full name"
          />
          <Input
            label="Email"
            icon={Mail}
            type="email"
            required
            className="col-span-2"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@example.com"
          />
          <Input
            label="Phone"
            icon={Phone}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91 00000 00000"
          />
          <Select
            label="Role"
            icon={ShieldCheck}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            options={["Member", "Instructor", "Supervisor", "Admin"]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
            options={["Active", "Inactive", "Pending"]}
          />
          <Input
            label="Location"
            icon={MapPin}
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="City, State"
          />
          <Select
            label="Segment"
            value={form.segment}
            onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value as Segment }))}
            options={["Entrepreneur", "Student", "Artisan", "Job Seeker", "Support Seeker"]}
          />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            options={["Female", "Male", "Other"]}
          />
          <div className="col-span-2">
            <Switch
              label="Send welcome email"
              description="Email the user account setup instructions."
              checked={form.welcomeEmail}
              onChange={(v) => setForm((f) => ({ ...f, welcomeEmail: v }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PanelRow({
  icon: Icon,
  tone,
  title,
  sub,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  sub: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-muted">{title}</p>
        <p className="truncate text-xs text-ink-subtle">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-faint" />
    </button>
  );
}

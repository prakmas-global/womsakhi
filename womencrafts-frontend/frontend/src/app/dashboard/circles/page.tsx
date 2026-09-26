"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  EyeOff,
  Loader2,
  Lock,
  MessageCircle,
  MicOff,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import {
  Avatar,
  Badge,
  Card,
  Input,
  Menu,
  MenuItem,
  Modal,
  SearchInput,
  Select,
  Spinner,
  StatCard,
  Switch,
  Textarea,
  useConfirm,
  useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import {
  apiAdminCircles,
  apiArchiveCircle,
  apiAssignModerator,
  apiCircleMembers,
  apiCommunityPermissions,
  apiCreateCircle,
  apiMuteMember,
  apiRemoveModerator,
  apiReopenCircle,
  apiUnmuteMember,
  apiUpdateCircle,
  apiWarnMember,
  shortDate,
  type AdminCircle,
  type CircleInput,
  type CircleMember,
  type CircleSummary,
  type CommunityAction,
} from "@/lib/community-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Circles — the rooms of the platform.
 *
 * ── The numbers are counted, not read ───────────────────────────────────────
 * `circles.member_count` is a stored counter that the seed fills with an
 * invented figure so a member's first visit does not look empty. This screen
 * never shows it. Every count here is what the membership and post
 * collections hold at the moment of the request, so a Super Admin who reads
 * "34 members" can open the roster and count 34.
 *
 * ── The roster shows her circle profile, nothing more ────────────────────────
 * Other members see her name and her avatar beside her posts. That is what
 * the roster shows too — not her email, not her phone. Anything more is the
 * Members module's business, with its own audit trail.
 */

const EMPTY_FORM: CircleInput = {
  name: "",
  topic: "",
  desc: "",
  guidelines: "",
  is_private: false,
  status: "active",
};

const EMPTY_SUMMARY: CircleSummary = {
  total: 0, active: 0, archived: 0, private: 0,
  members: 0, posts: 0, hidden_posts: 0, muted_members: 0,
};

const ROLE_TONE: Record<string, "violet" | "brand" | "slate"> = {
  host: "violet",
  moderator: "brand",
  member: "slate",
};

type MemberDialog =
  | { kind: "warn"; member: CircleMember }
  | { kind: "mute"; member: CircleMember }
  | null;

export default function AdminCirclesPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [summary, setSummary] = useState<CircleSummary>(EMPTY_SUMMARY);
  const [perms, setPerms] = useState<Set<CommunityAction>>(new Set());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "archived">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CircleInput>(EMPTY_FORM);

  const [roster, setRoster] = useState<AdminCircle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [dialog, setDialog] = useState<MemberDialog>(null);

  const can = useCallback((a: CommunityAction) => perms.has(a), [perms]);

  const load = useCallback(async () => {
    try {
      const page = await apiAdminCircles({ q, status: statusFilter });
      setCircles(page.circles);
      setSummary(page.summary);
    } catch (e) {
      toast.error("Could not load the circles", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  useEffect(() => {
    let alive = true;
    apiCommunityPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { /* buttons stay hidden; the server would refuse anyway */ });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  /* ── create / edit ─────────────────────────────────────────────────────── */

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(c: AdminCircle) {
    setEditing(c.id);
    setForm({
      name: c.name, topic: c.topic, desc: c.desc,
      guidelines: c.guidelines, is_private: c.is_private, status: c.status,
    });
    setFormOpen(true);
  }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      if (editing) {
        await apiUpdateCircle(editing, form);
        toast.success(`“${form.name}” updated`);
      } else {
        await apiCreateCircle(form);
        toast.success(`“${form.name}” created`, { description: "Members can find it in the app now." });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error("Could not save the circle", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, load, toast]);

  const archive = useCallback(async (c: AdminCircle) => {
    const ok = await confirm({
      title: `Archive “${c.name}”?`,
      description: `Its ${c.member_count} member${c.member_count === 1 ? "" : "s"} can no longer open it and nobody can post. Nothing is deleted — you can reopen it from this list.`,
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiArchiveCircle(c.id);
      toast.success(`“${c.name}” archived`);
      await load();
    } catch (e) {
      toast.error("Could not archive that circle", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const reopen = useCallback(async (c: AdminCircle) => {
    try {
      await apiReopenCircle(c.id);
      toast.success(`“${c.name}” is open again`);
      await load();
    } catch (e) {
      toast.error("Could not reopen that circle", { description: memberError(e) });
    }
  }, [load, toast]);

  /* ── roster and moderators ─────────────────────────────────────────────── */

  const loadRoster = useCallback(async (c: AdminCircle) => {
    setRosterLoading(true);
    try {
      setMembers(await apiCircleMembers(c.id));
    } catch (e) {
      toast.error("Could not load the roster", { description: memberError(e) });
    } finally {
      setRosterLoading(false);
    }
  }, [toast]);

  const openRoster = useCallback((c: AdminCircle) => {
    setRoster(c);
    setMembers([]);
    void loadRoster(c);
  }, [loadRoster]);

  const afterRosterChange = useCallback(async () => {
    if (roster) await loadRoster(roster);
    await load();
  }, [load, loadRoster, roster]);

  const makeModerator = useCallback(async (m: CircleMember) => {
    if (!roster) return;
    const ok = await confirm({
      title: `Make ${m.name} a moderator of “${roster.name}”?`,
      description: "She is told and marked as a moderator. She can post in host-only circles, while staff retain hide, remove and mute controls.",
      confirmLabel: "Make her a moderator",
    });
    if (!ok) return;
    try {
      const res = await apiAssignModerator(roster.id, m.user_id);
      toast.success(res.message);
      await afterRosterChange();
    } catch (e) {
      toast.error("Could not assign that moderator", { description: memberError(e) });
    }
  }, [afterRosterChange, confirm, roster, toast]);

  const stepDown = useCallback(async (m: CircleMember) => {
    if (!roster) return;
    try {
      const res = await apiRemoveModerator(roster.id, m.user_id);
      toast.success(res.message);
      await afterRosterChange();
    } catch (e) {
      toast.error("Could not remove that moderator", { description: memberError(e) });
    }
  }, [afterRosterChange, roster, toast]);

  const unmute = useCallback(async (m: CircleMember) => {
    if (!roster) return;
    try {
      const res = await apiUnmuteMember(roster.id, m.user_id);
      toast.success(res.message);
      await afterRosterChange();
    } catch (e) {
      toast.error("Could not lift that mute", { description: memberError(e) });
    }
  }, [afterRosterChange, roster, toast]);

  const confirmDialog = useCallback(async (reason: string, days: number) => {
    if (!roster || !dialog) return;
    setBusy(true);
    try {
      const res = dialog.kind === "warn"
        ? await apiWarnMember(roster.id, dialog.member.user_id, reason)
        : await apiMuteMember(roster.id, dialog.member.user_id, { reason, days });
      toast.success(res.message);
      setDialog(null);
      await afterRosterChange();
    } catch (e) {
      toast.error(dialog.kind === "warn" ? "Could not send that warning" : "Could not mute her", {
        description: memberError(e),
      });
    } finally {
      setBusy(false);
    }
  }, [afterRosterChange, dialog, roster, toast]);

  /* ── derived ───────────────────────────────────────────────────────────── */

  const filterLabel = statusFilter === "" ? "All circles" : statusFilter === "active" ? "Active" : "Archived";
  const set = (k: keyof CircleInput) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const canModerate = can("edit");

  const moderators = useMemo(() => members.filter((m) => m.role === "moderator"), [members]);

  return (
    <div className="wc-page-enter">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <UsersRound className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Circles</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              The rooms of the platform. Every number here is counted from what members have actually done.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/circles/moderation" className="btn btn-outline">
            <ShieldAlert className="h-4 w-4" /> Moderation
          </Link>
          {can("create") && (
            <button onClick={openCreate} className="btn btn-primary">
              <Plus className="h-4 w-4" /> New circle
            </button>
          )}
        </div>
      </div>

      {/* ── stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Circles" value={String(summary.total)} icon={UsersRound} tone="brand"
                  deltaNote={`${summary.active} open · ${summary.archived} archived`} />
        <StatCard label="Memberships" value={String(summary.members)} icon={Users} tone="violet"
                  deltaNote={summary.private > 0 ? `${summary.private} private circle${summary.private === 1 ? "" : "s"}` : "Counted from the rosters"} />
        <StatCard label="Posts members can see" value={String(summary.posts)} icon={MessageCircle} tone="emerald"
                  deltaNote={summary.hidden_posts > 0 ? `${summary.hidden_posts} hidden or removed` : "Nothing hidden"} />
        <StatCard label="Muted right now" value={String(summary.muted_members)} icon={MicOff}
                  tone={summary.muted_members > 0 ? "amber" : "slate"}
                  deltaNote={summary.muted_members > 0 ? "Members who can't post in a circle" : "Nobody is muted"} />
      </div>

      {/* ── list ────────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Every circle</h2>
            <p className="text-xs text-ink-subtle">
              Open first, busiest first. Archiving closes a room without deleting a word of it.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or topic…" className="max-w-xs flex-1" />
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" /> {filterLabel}
              </span>
            }
          >
            <MenuItem onClick={() => setStatusFilter("")}>All circles</MenuItem>
            <MenuItem onClick={() => setStatusFilter("active")}>Active</MenuItem>
            <MenuItem onClick={() => setStatusFilter("archived")}>Archived</MenuItem>
          </Menu>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : circles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <UsersRound className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {q || statusFilter ? "No circle matches that" : "No circles yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {q || statusFilter
                ? "Try a different search, or clear the filter."
                : "Create the first one. A circle with a clear subject and one good guideline runs itself."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Circle</th>
                  <th className="px-3 py-2.5">Members</th>
                  <th className="px-3 py-2.5">Posts</th>
                  <th className="px-3 py-2.5">Moderators</th>
                  <th className="px-3 py-2.5">Last post</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {circles.map((c) => (
                  <tr key={c.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${c.status !== "active" ? "opacity-70" : ""}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-brand-500 font-display text-sm font-bold text-white">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                            {c.is_private && (
                              <span title="Private — readable only from inside" className="text-ink-subtle">
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {c.is_savings && (
                              <span title={`Savings circle · round ${c.round}`} className="text-brand-ink">
                                <Wallet className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-ink-subtle">{c.topic || "No topic set"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => openRoster(c)} className="text-sm font-semibold text-brand-ink hover:underline">
                        {c.member_count}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/circles/moderation?circle=${c.id}`} className="text-sm font-semibold text-brand-ink hover:underline">
                        {c.post_count}
                      </Link>
                      {c.hidden_post_count > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-2xs text-ink-subtle" title="Hidden or removed">
                          <EyeOff className="h-3 w-3" /> {c.hidden_post_count}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {c.moderator_count > 0 ? (
                        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-ink" /> {c.moderator_count}</span>
                      ) : (
                        <span className="text-ink-subtle">None</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">
                      {c.last_post_at ? shortDate(c.last_post_at) : "Never"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={c.status === "active" ? "emerald" : "slate"}>
                        {c.status === "active" ? "Open" : "Archived"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem onClick={() => openRoster(c)}>Roster and moderators</MenuItem>
                        <MenuItem href={`/dashboard/circles/moderation?circle=${c.id}`}>Recent posts</MenuItem>
                        {can("edit") && <MenuItem onClick={() => openEdit(c)}>Edit</MenuItem>}
                        {c.status === "active"
                          ? can("delete") && <MenuItem danger onClick={() => void archive(c)}>Archive</MenuItem>
                          : can("edit") && <MenuItem onClick={() => void reopen(c)}>Reopen</MenuItem>}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── create / edit ───────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit circle" : "New circle"}
        icon={UsersRound}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Create circle"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" required value={form.name} onChange={(e) => set("name")(e.target.value)}
                 placeholder="Tailoring & Stitching Sisters" />
          <Input label="Topic" value={form.topic} onChange={(e) => set("topic")(e.target.value)} placeholder="Craft" />
          <Textarea label="What is this circle for?" value={form.desc} onChange={(e) => set("desc")(e.target.value)} />
          <Input label="One guideline" value={form.guidelines} onChange={(e) => set("guidelines")(e.target.value)}
                 placeholder="Share what you know. Nobody here is a beginner for asking." />
          <Switch
            label="Private circle"
            description="Readable only from inside. Nobody can join a private circle from outside yet — its members are whoever is already in it."
            checked={form.is_private}
            onChange={(v) => set("is_private")(v)}
          />
          {editing && (
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set("status")(e.target.value)}
              options={[{ value: "active", label: "Open" }, { value: "archived", label: "Archived" }]}
            />
          )}
        </div>
      </Modal>

      {/* ── roster ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!roster}
        onClose={() => setRoster(null)}
        title={roster ? `${roster.name} — roster` : ""}
        description={roster ? `${members.length} member${members.length === 1 ? "" : "s"} · ${moderators.length} moderator${moderators.length === 1 ? "" : "s"}. Shown as her circle shows her: name and picture only.` : ""}
        icon={Users}
        size="lg"
        footer={
          <button className="btn btn-outline" onClick={() => setRoster(null)}>Close</button>
        }
      >
        <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
          A moderator is marked here and told. Moderators can post in host-only circles; staff moderation
          controls remain in the moderation queue.
        </p>
        {rosterLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : members.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-semibold text-ink">Nobody has joined yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              Members join from the app. Once someone does, she appears here and can be made a moderator.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const muted = !!m.muted_until;
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                      <Badge tone={ROLE_TONE[m.role] ?? "slate"}>{m.role}</Badge>
                      {muted && <Badge tone="amber">Muted until {shortDate(m.muted_until)}</Badge>}
                      {m.warnings > 0 && <Badge tone="rose">{m.warnings} warning{m.warnings === 1 ? "" : "s"}</Badge>}
                    </div>
                    <p className="text-xs text-ink-subtle">Joined {shortDate(m.joined_at) || "—"}</p>
                  </div>
                  {canModerate && (
                    <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                      {m.role === "member" && <MenuItem onClick={() => void makeModerator(m)}>Make her a moderator</MenuItem>}
                      {m.role === "moderator" && <MenuItem onClick={() => void stepDown(m)}>Step her down to member</MenuItem>}
                      <MenuItem onClick={() => setDialog({ kind: "warn", member: m })}>Send a warning</MenuItem>
                      {muted
                        ? <MenuItem onClick={() => void unmute(m)}>Lift the mute</MenuItem>
                        : <MenuItem danger onClick={() => setDialog({ kind: "mute", member: m })}>Mute in this circle</MenuItem>}
                    </Menu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <ReasonModal
        open={dialog?.kind === "warn"}
        title={dialog ? `Warn ${dialog.member.name}` : ""}
        description={roster ? `She receives this as a message from the ${roster.name} moderators, and it is kept on her record here.` : undefined}
        label="What to tell her"
        confirmLabel="Send the warning"
        busy={busy}
        icon={ShieldAlert}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "mute"}
        title={dialog ? `Mute ${dialog.member.name}` : ""}
        description={roster ? `She can still read ${roster.name}, but cannot post or reply in it until the date you choose. She is told why.` : undefined}
        label="Why"
        confirmLabel="Mute her"
        danger
        withDays
        busy={busy}
        icon={MicOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

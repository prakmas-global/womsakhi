"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight, Circle, CircleCheck, Copy, Crown, Eye, Headset, KeyRound, Loader2, Lock,
  MoreHorizontal, Pencil, Plus, Presentation, Search, ShieldCheck, SlidersHorizontal,
  Trash2, User, UserCheck, UserCog, Users, UsersRound,
} from "lucide-react";
import {
  Badge, Card, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea,
  useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";
import {
  ACTION_LABEL,
  apiRoleCatalogue, apiRoleCreate, apiRoleDelete, apiRoleDuplicate, apiRoleHolders,
  apiRoleUpdate, apiRolesList,
  sameSet, toggleModule, togglePermission,
  type AdminRole, type PermissionCatalogue, type RoleHolders, type RoleSummary,
} from "@/lib/roles-admin-api";

/**
 * Roles: what each kind of staff account may open and do.
 *
 * ── One screen, two doors ───────────────────────────────────────────────────
 * The sidebar reaches this from Users → User Roles and from Settings → Roles &
 * Permissions. They used to be two hand-written pages that disagreed — one
 * had a fake "Access level" select that wrote 126/64/12 as the permission
 * count, the other had a module-access panel that could contradict the
 * permission panel beside it. Both pages now render this component and
 * nothing else, so they cannot drift.
 *
 * ── What is real here ───────────────────────────────────────────────────────
 * Every number is counted by the server on this request: how many accounts
 * hold a role, how many permissions it has, how many roles nobody holds. The
 * permission grid is the platform catalogue (`/roles/catalogue/all`); a
 * toggle here is the same `"<module>.<action>"` key the API guards check.
 *
 * Only a Super Admin can change anything. Everyone else with the Users module
 * sees the same screen read-only, and the write buttons are not rendered
 * rather than rendered-and-refused.
 */

// Role icons are stored by name on the backend; map them back to components.
const ICON_MAP: Record<string, React.ElementType> = {
  Crown, UserCog, Presentation, UserCheck, User, Headset, Pencil, Eye, ShieldCheck,
};
const iconFor = (name: string): React.ElementType => ICON_MAP[name] ?? ShieldCheck;

const STATE_LABEL: Record<string, string> = {
  invited: "invited", active: "active", suspended: "suspended",
};

type TypeFilter = "All" | "System" | "Custom";

/* ── the permission grid ─────────────────────────────────────────────────── */

function PermissionMatrix({
  catalogue, value, onChange, locked,
}: {
  catalogue: PermissionCatalogue;
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  locked: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const everyKey = useMemo(
    () => catalogue.modules.flatMap((m) => m.actions.map((a) => `${m.module}.${a}`)),
    [catalogue],
  );
  const allGranted = everyKey.length > 0 && everyKey.every((k) => value.has(k));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">
          Permissions <span className="font-normal text-ink-subtle">({value.size} / {catalogue.total})</span>
        </h3>
        {!locked && (
          <button
            type="button"
            className="text-xs font-semibold text-brand-ink hover:underline"
            onClick={() => onChange(new Set(allGranted ? [] : everyKey))}
          >
            {allGranted ? "Clear all" : "Grant all"}
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {catalogue.modules.map((m) => {
          const keys = m.actions.map((a) => `${m.module}.${a}`);
          const on = keys.filter((k) => value.has(k)).length;
          const expanded = open[m.module] ?? false;
          return (
            <li key={m.module}>
              <div className="flex items-center gap-2 rounded-lg px-1 py-2 text-sm hover:bg-surface-hover dark:hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [m.module]: !expanded }))}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${m.label}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-start"
                >
                  <ChevronRight className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${expanded ? "rotate-90" : ""}`} />
                  <span className="truncate text-ink-muted">{m.label}</span>
                </button>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-subtle">
                  {on === keys.length
                    ? <CircleCheck className="h-4 w-4 text-status-ok-ink" />
                    : <Circle className="h-4 w-4 text-ink-faint" />}
                  {on} / {keys.length}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on > 0}
                  aria-label={`Toggle every permission in ${m.label}`}
                  disabled={locked}
                  onClick={() => onChange(toggleModule(value, keys))}
                  className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${on > 0 ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"}`}
                >
                  <span className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${on > 0 ? "translate-x-4" : ""}`} />
                </button>
              </div>

              {expanded && (
                <ul className="mb-1 ms-6 space-y-0.5 border-s border-line ps-3 dark:border-white/10">
                  {m.actions.map((a) => {
                    const key = `${m.module}.${a}`;
                    const granted = value.has(key);
                    return (
                      <li key={key} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xsm">
                        <span className={granted ? "text-ink-muted" : "text-ink-subtle"}>{ACTION_LABEL[a] ?? a}</span>
                        <code className="truncate text-2xs text-ink-faint">{key}</code>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={granted}
                          aria-label={`${granted ? "Revoke" : "Grant"} ${ACTION_LABEL[a] ?? a} in ${m.label}`}
                          disabled={locked}
                          onClick={() => onChange(togglePermission(value, key))}
                          className={`ms-auto flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${granted ? "bg-status-ok-solid" : "bg-line-strong dark:bg-white/15"}`}
                        >
                          <span className={`h-3 w-3 rounded-full bg-surface shadow transition-transform ${granted ? "translate-x-4" : ""}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── the screen ──────────────────────────────────────────────────────────── */

export default function RolesManager() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  const [catalogue, setCatalogue] = useState<PermissionCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [selectedId, setSelectedId] = useState("");

  // The selected role's permissions as edited here, saved as one set.
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);

  const [holders, setHolders] = useState<RoleHolders | null>(null);
  const [holdersLoading, setHoldersLoading] = useState(false);

  // create / rename modal
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [form, setForm] = useState({ name: "", desc: "", startFrom: "" });
  const [formPerms, setFormPerms] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await apiRolesList();
      setRoles(list.items);
      setSummary(list.summary);
      setSelectedId((cur) =>
        cur && list.items.some((r) => r.id === cur) ? cur : list.items[0]?.id ?? "");
      setLoadError("");
    } catch (e) {
      setLoadError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // One wave: the role list and the catalogue are independent, so they go
  // together rather than as two mounts racing each other into state.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [list, cat] = await Promise.all([
        apiRolesList().then((d) => ({ ok: true as const, d })).catch((e) => ({ ok: false as const, e })),
        apiRoleCatalogue().catch(() => null),
      ]);
      if (!alive) return;
      if (list.ok) {
        setRoles(list.d.items);
        setSummary(list.d.summary);
        setSelectedId(list.d.items[0]?.id ?? "");
      } else {
        setLoadError(memberError(list.e));
      }
      setCatalogue(cat);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  // The draft follows the selection; the holder list too.
  useEffect(() => {
    setDraft(new Set(selected?.permissions ?? []));
  }, [selected]);

  useEffect(() => {
    if (!selected) { setHolders(null); return; }
    let alive = true;
    setHoldersLoading(true);
    apiRoleHolders(selected.id)
      .then((h) => { if (alive) setHolders(h); })
      .catch(() => { if (alive) setHolders(null); })
      .finally(() => { if (alive) setHoldersLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => {
      if (typeFilter !== "All" && r.type !== typeFilter) return false;
      if (!q) return true;
      return `${r.name} ${r.desc}`.toLowerCase().includes(q);
    });
  }, [roles, query, typeFilter]);

  const canEditSelected = isSuperAdmin && !!selected && !selected.protected;
  const permsDirty = !!selected && !sameSet(draft, new Set(selected.permissions));

  /* ── actions ─────────────────────────────────────────────────────────── */

  const savePermissions = useCallback(async () => {
    if (!selected || !permsDirty) return;
    setSavingPerms(true);
    try {
      const fresh = await apiRoleUpdate(selected.id, { permissions: [...draft] });
      toast.success(`${fresh.name} now holds ${fresh.perms} permissions`, {
        description: `Everyone with this role gets the change at their next request.`,
      });
      await refresh();
    } catch (e) {
      toast.error("Could not save the permissions", { description: memberError(e) });
    } finally {
      setSavingPerms(false);
    }
  }, [selected, permsDirty, draft, refresh, toast]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ name: "", desc: "", startFrom: "" });
    setFormPerms(new Set());
    setFormError("");
    setModal("create");
  }, []);

  const openEdit = useCallback((r: AdminRole) => {
    setEditing(r);
    setForm({ name: r.name, desc: r.desc, startFrom: "" });
    setFormError("");
    setModal("edit");
  }, []);

  const startFrom = useCallback((roleId: string) => {
    setForm((f) => ({ ...f, startFrom: roleId }));
    const src = roles.find((r) => r.id === roleId);
    setFormPerms(new Set(src?.permissions ?? []));
  }, [roles]);

  const submit = useCallback(async () => {
    const name = form.name.trim();
    if (!name) { setFormError("A role needs a name."); return; }
    setBusy(true);
    setFormError("");
    try {
      if (modal === "edit" && editing) {
        const body: { name?: string; desc?: string } = {};
        if (name !== editing.name) body.name = name;
        if (form.desc.trim() !== editing.desc) body.desc = form.desc.trim();
        if (Object.keys(body).length === 0) { setModal(null); return; }
        const fresh = await apiRoleUpdate(editing.id, body);
        toast.success(
          body.name ? `${editing.name} is now ${fresh.name}` : `${fresh.name} updated`,
          body.name && editing.users > 0
            ? { description: `${editing.users} account${editing.users === 1 ? "" : "s"} moved with it.` }
            : undefined,
        );
        await refresh();
        setSelectedId(fresh.id);
      } else {
        const fresh = await apiRoleCreate({ name, desc: form.desc.trim(), permissions: [...formPerms] });
        toast.success(`${fresh.name} created`, {
          description: `${fresh.perms} of ${catalogue?.total ?? fresh.perms} permissions. Give it to someone from the Staff screen.`,
        });
        await refresh();
        setSelectedId(fresh.id);
      }
      setModal(null);
    } catch (e) {
      setFormError(memberError(e));
    } finally {
      setBusy(false);
    }
  }, [form, modal, editing, formPerms, catalogue, refresh, toast]);

  const duplicate = useCallback(async (r: AdminRole) => {
    try {
      const fresh = await apiRoleDuplicate(r.id);
      toast.success(`${fresh.name} created`, {
        description: `Same ${fresh.perms} permissions as ${r.name}. Rename it from the row menu.`,
      });
      await refresh();
      setSelectedId(fresh.id);
    } catch (e) {
      toast.error("Could not duplicate the role", { description: memberError(e) });
    }
  }, [refresh, toast]);

  const remove = useCallback(async (r: AdminRole) => {
    if (r.protected) return;
    if (r.users > 0) {
      toast.error(`${r.users} account${r.users === 1 ? " holds" : "s hold"} the ${r.name} role`, {
        description: "Move them to another role on the Staff screen first, then delete it.",
      });
      return;
    }
    const ok = await confirm({
      title: `Delete the ${r.name} role?`,
      description: `Nobody holds it. Its ${r.perms} permissions are removed for good; the accounts and audit trail are untouched.`,
      confirmLabel: "Delete role",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRoleDelete(r.id);
      toast.success(`${r.name} deleted`);
      await refresh();
    } catch (e) {
      toast.error("Could not delete the role", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  /* ── render ──────────────────────────────────────────────────────────── */

  const SelectedIcon = selected ? iconFor(selected.icon) : ShieldCheck;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Roles</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              What each kind of staff account may open and do. A person's role is the starting point;
              anything granted or withheld for her alone lives on the Staff screen.
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New role
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Roles" value={summary ? String(summary.total) : "—"} icon={ShieldCheck} tone="brand"
                  deltaNote={summary ? `${summary.system} system · ${summary.custom} custom` : "Loading"} />
        <StatCard label="Staff assigned" value={summary ? String(summary.staff_assigned) : "—"} icon={UsersRound} tone="violet"
                  deltaNote="Accounts holding a staff role" />
        <StatCard label="Held by nobody" value={summary ? String(summary.unused) : "—"} icon={Users}
                  tone={summary && summary.unused > 0 ? "amber" : "emerald"}
                  deltaNote={summary && summary.unused > 0 ? "Roles that could be deleted" : "Every role is in use"} />
        <StatCard label="Permissions defined" value={summary ? String(summary.permissions_total) : "—"} icon={KeyRound} tone="sky"
                  deltaNote={catalogue ? `Across ${catalogue.modules.length} modules` : "The platform catalogue"} />
      </div>

      <ResizableColumns id="roles-manager" defaultSize={0.62} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Every role</h2>
              <p className="text-xs text-ink-subtle">
                {isSuperAdmin ? "Pick one to see and change what it allows." : "Pick one to see what it allows. Only a Super Admin can change roles."}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                placeholder="Search roles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              trigger={
                <span className="btn btn-sm btn-outline">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {typeFilter === "All" ? "All types" : typeFilter}
                </span>
              }
            >
              <MenuItem onClick={() => setTypeFilter("All")}>All types</MenuItem>
              <MenuItem onClick={() => setTypeFilter("System")}>System</MenuItem>
              <MenuItem onClick={() => setTypeFilter("Custom")}>Custom</MenuItem>
            </Menu>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : loadError ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-ink">
                <Lock className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">Could not load the roles</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{loadError}</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">
                {query || typeFilter !== "All" ? "No role matches that" : "No roles yet"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
                {query || typeFilter !== "All"
                  ? "Try a different search, or clear the filter."
                  : "Create one and choose exactly what it may open and do."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="px-3 py-2.5">Role</th>
                    <th scope="col" className="px-3 py-2.5">Held by</th>
                    <th scope="col" className="px-3 py-2.5">Type</th>
                    <th scope="col" className="px-3 py-2.5">Permissions</th>
                    <th scope="col" className="px-3 py-2.5 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const Icon = iconFor(r.icon);
                    const total = catalogue?.total ?? 0;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`cursor-pointer border-b border-line text-sm last:border-0 hover:bg-surface-2 ${r.id === selectedId ? "bg-brand-tint/40" : ""}`}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink">
                                {r.name}
                                {r.protected && <Lock className="ms-1.5 inline h-3 w-3 text-ink-subtle" aria-label="Protected" />}
                              </p>
                              <p className="truncate text-xs text-ink-subtle">{r.desc || "No description"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                          {r.users === 0
                            ? <span className="text-ink-subtle">Nobody</span>
                            : `${r.users} ${r.is_member_role ? (r.users === 1 ? "member" : "members") : (r.users === 1 ? "account" : "accounts")}`}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={r.type === "System" ? "violet" : "brand"}>{r.type}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                          {r.is_super_admin ? "Everything" : r.is_member_role ? "None in the dashboard" : total ? `${r.perms} / ${total}` : String(r.perms)}
                        </td>
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Menu trigger={<span className="btn btn-sm btn-ghost" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></span>}>
                            <MenuItem icon={Eye} onClick={() => setSelectedId(r.id)}>View</MenuItem>
                            {isSuperAdmin && !r.protected && (
                              <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Rename or describe</MenuItem>
                            )}
                            {isSuperAdmin && !r.is_member_role && (
                              <MenuItem icon={Copy} onClick={() => void duplicate(r)}>Duplicate</MenuItem>
                            )}
                            {isSuperAdmin && !r.protected && (
                              <MenuItem icon={Trash2} danger onClick={() => void remove(r)}>
                                {r.users > 0 ? `Delete (held by ${r.users})` : "Delete"}
                              </MenuItem>
                            )}
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-subtle">
                {shown.length === roles.length
                  ? `${roles.length} role${roles.length === 1 ? "" : "s"}`
                  : `${shown.length} of ${roles.length} roles`}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Role details</h2>
            {canEditSelected && selected && (
              <button className="btn btn-sm btn-secondary" onClick={() => openEdit(selected)}>
                <Pencil className="h-3 w-3" /> Rename
              </button>
            )}
          </div>

          {!selected ? (
            <p className="py-10 text-center text-sm text-ink-subtle">
              {loading ? "Loading…" : "Pick a role to see what it allows."}
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-tint text-violet-ink">
                  <SelectedIcon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-bold text-ink">{selected.name}</p>
                    <Badge tone={selected.type === "System" ? "violet" : "brand"}>{selected.type}</Badge>
                    {selected.protected && <Badge tone="slate">Protected</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-subtle">{selected.desc || "No description"}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {selected.created ? `Created ${selected.created}` : ""}
                  </p>
                </div>
              </div>

              {/* who holds it */}
              <div className="mt-4 rounded-xl bg-surface-2 p-3">
                <p className="text-xs font-semibold text-ink">
                  {holdersLoading && !holders
                    ? "Counting…"
                    : selected.users === 0
                      ? "Nobody holds this role"
                      : selected.is_member_role
                        ? `${selected.users} member${selected.users === 1 ? "" : "s"} — listed on People`
                        : `Held by ${selected.users} account${selected.users === 1 ? "" : "s"}`}
                </p>
                {holders && holders.staff.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {holders.staff.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-ink-muted">
                          {h.full_name || h.email}
                          {h.full_name && <span className="ms-1 text-ink-subtle">{h.email}</span>}
                        </span>
                        <span className="shrink-0 text-ink-subtle">{STATE_LABEL[h.state] ?? h.state}</span>
                      </li>
                    ))}
                    {holders.total > holders.shown && (
                      <li className="text-xs text-ink-subtle">and {holders.total - holders.shown} more</li>
                    )}
                  </ul>
                )}
              </div>

              {/* what it allows */}
              <div className="mt-5 border-t border-line pt-4">
                {selected.is_super_admin ? (
                  <p className="rounded-lg bg-violet-tint px-3 py-2 text-xs text-violet-ink">
                    Super Admin always holds every permission. It is the way back in when another role is
                    misconfigured, so it cannot be reduced, renamed or deleted.
                  </p>
                ) : selected.is_member_role ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                    Member is the public sign-up role. It opens nothing in this dashboard — members use the
                    member app — and it cannot be changed here.
                  </p>
                ) : catalogue ? (
                  <>
                    <PermissionMatrix
                      catalogue={catalogue}
                      value={draft}
                      onChange={setDraft}
                      locked={!canEditSelected}
                    />
                    {canEditSelected && (
                      <button
                        className="btn btn-primary btn-block mt-3"
                        onClick={() => void savePermissions()}
                        disabled={savingPerms || !permsDirty}
                      >
                        {savingPerms
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                          : permsDirty ? "Save permissions" : "No changes"}
                      </button>
                    )}
                    {!isSuperAdmin && (
                      <p className="mt-2 text-2xs text-ink-subtle">Only a Super Admin can change these.</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-ink-subtle">
                    The permission catalogue could not be loaded, so this role's {selected.perms} permissions
                    cannot be shown here.
                  </p>
                )}
              </div>

              {isSuperAdmin && !selected.is_member_role && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button className="btn btn-secondary" onClick={() => void duplicate(selected)}>
                    <Copy className="h-4 w-4" /> Duplicate
                  </button>
                  {!selected.protected && (
                    <button className="btn btn-danger" onClick={() => void remove(selected)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </ResizableColumns>

      {/* ── create / rename ────────────────────────────────────────────── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "edit" ? `Rename or describe ${editing?.name ?? ""}` : "New role"}
        description={modal === "edit"
          ? "Renaming moves every account that holds it. Permissions are changed from the details panel."
          : "Name it, then choose exactly what it may open and do."}
        icon={modal === "edit" ? Pencil : Plus}
        iconTone="brand"
        size={modal === "create" ? "lg" : "md"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "Saving…" : modal === "edit" ? "Save" : "Create role"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            required
            placeholder="e.g. Programme Coordinator"
            value={form.name}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); if (formError) setFormError(""); }}
          />
          <Textarea
            label="Description"
            rows={2}
            placeholder="Who this is for, in one line"
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
          />
          {modal === "create" && catalogue && (
            <>
              <Select
                label="Start from"
                value={form.startFrom}
                onChange={(e) => startFrom(e.target.value)}
                options={[
                  { value: "", label: "Nothing — choose each permission" },
                  ...roles
                    .filter((r) => !r.is_member_role)
                    .map((r) => ({ value: r.id, label: `${r.name} (${r.is_super_admin ? "everything" : `${r.perms} permissions`})` })),
                ]}
              />
              <div className="rounded-xl border border-line p-3">
                <PermissionMatrix catalogue={catalogue} value={formPerms} onChange={setFormPerms} locked={false} />
              </div>
            </>
          )}
          {modal === "edit" && editing && editing.users > 0 && form.name.trim() !== editing.name && (
            <p className="rounded-lg bg-status-warn-bg px-3 py-2 text-xs text-status-warn-ink">
              {editing.users} account{editing.users === 1 ? "" : "s"} hold this role and will move to the new name with it.
            </p>
          )}
          {formError && <p className="text-sm font-medium text-status-danger-ink">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users, UsersRound, Lock, Settings2, ChevronDown, Plus, SlidersHorizontal, MoreHorizontal, Crown, UserCog, Presentation, UserCheck, User, Headset, Pencil, Eye, Copy, Trash2, Search } from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Select, StatCard, Textarea, useToast } from "@/design-system";
import { apiListRoles, apiCreateRole, apiUpdateRole, apiDeleteRole, apiSetRoleModules, type ApiRole } from "@/lib/api";
import { apiListPermissionGroups, apiPermissionStats, type ApiPermissionGroup, type PermissionStats } from "@/lib/permissions-api";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import { apiRolePermissions, apiSaveRolePermissions, type PermissionGroup, type RolePermissions } from "@/lib/permissions-api";
import { MODULE_CATALOG } from "@/lib/modules";
import RolePermissionPanel from "@/components/admin/RolePermissionPanel";
import { ResizableColumns } from "@/layout-engine";
import { COPY } from "@/components/ux/copy";

type Role = {
  _id: string;
  iconName: string;
  icon: React.ElementType;
  name: string;
  desc: string;
  users: number;
  type: string;
  perms: number;
  status: string;
  modules: string[];
  created: string;
};

// Role icons are stored by name on the backend; map them back to components.
const ICON_MAP: Record<string, React.ElementType> = {
  Crown,
  UserCog,
  Presentation,
  UserCheck,
  User,
  Headset,
  Pencil,
  Eye,
  ShieldCheck,
};

function toRole(r: ApiRole): Role {
  return {
    _id: r.id,
    iconName: r.icon,
    icon: ICON_MAP[r.icon] ?? ShieldCheck,
    name: r.name,
    desc: r.desc,
    users: r.users,
    type: r.type,
    perms: r.perms,
    status: r.status,
    modules: r.modules ?? [],
    created: r.created,
  };
}

export default function RolesPermissionsPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permGroups, setPermGroups] = useState<ApiPermissionGroup[]>([]);
  const [permStats, setPermStats] = useState<PermissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All Types" | "System" | "Custom">("All Types");
  const [selectedId, setSelectedId] = useState<string>("");

  // The selected role's granular permissions, straight from the server.
  const [rolePerms, setRolePerms] = useState<RolePermissions | null>(null);
  // Local edits, keyed "module.action". Saved as one set.
  const [permDraft, setPermDraft] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [permError, setPermError] = useState("");

  const loadPermissions = useCallback(async (roleId: string) => {
    if (!roleId) return;
    try {
      const data = await apiRolePermissions(roleId);
      setRolePerms(data);
      setPermDraft(
        new Set(data.groups.flatMap((g) => g.actions.filter((a) => a.granted).map((a) => a.key))),
      );
      setPermError("");
    } catch {
      // Loading the permission matrix, not saving it. The earlier blanket
      // replace in this file hit both paths, so opening the screen announced
      // "Could not save permissions" about an action nobody had taken.
    }
  }, []);

  useEffect(() => {
    void loadPermissions(selectedId);
  }, [selectedId, loadPermissions]);

  /** Toggling an action keeps the implied "view" honest, exactly as the server does. */
  const toggleAction = (key: string) => {
    const [module, action] = key.split(".");
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Removing "view" removes everything else in that module — you cannot
        // edit what you cannot see.
        if (action === "view") {
          [...next].filter((k) => k.startsWith(`${module}.`)).forEach((k) => next.delete(k));
        }
      } else {
        next.add(key);
        next.add(`${module}.view`);
      }
      return next;
    });
  };

  const toggleWholeModule = (group: PermissionGroup) => {
    const keys = group.actions.map((a) => a.key);
    const allOn = keys.every((k) => permDraft.has(k));
    setPermDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  async function savePermissions() {
    if (!rolePerms) return;
    setSavingPerms(true);
    setPermError("");
    try {
      const saved = await apiSaveRolePermissions(rolePerms.role_id, [...permDraft]);
      setRolePerms(saved);
      setPermDraft(
        new Set(saved.groups.flatMap((g) => g.actions.filter((a) => a.granted).map((a) => a.key))),
      );
      toast.success("Permissions saved");
      await refresh();
    } catch (err) {
      toast.error("Could not save permissions", { description: memberError(err) });
    } finally {
      setSavingPerms(false);
    }
  }

  // RBAC — Super Admin edits which modules the selected role can open
  const { isSuperAdmin } = useAuth();
  const [moduleDraft, setModuleDraft] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);

  // create / edit modal
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", desc: "", type: "Custom", status: "Active" });
  const [formError, setFormError] = useState("");

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [roleData, groupData, statData] = await Promise.all([
        apiListRoles(),
        apiListPermissionGroups(),
        apiPermissionStats(),
      ]);
      const mapped = roleData.items.map(toRole);
      setRoles(mapped);
      setSelectedId((cur) => (cur && mapped.some((r) => r._id === cur) ? cur : mapped[0]?._id ?? ""));
      setPermGroups(groupData.groups);
      setPermStats(statData);
    } catch {
      /* keep current data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => {
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
      const matchesType = typeFilter === "All Types" || r.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [roles, query, typeFilter]);

  const selected = roles.find((r) => r._id === selectedId) ?? roles[0];

  // Sync the module-access draft whenever the selected role changes.
  useEffect(() => {
    setModuleDraft(selected?.modules ?? []);
  }, [selected?._id, selected?.modules]);

  const isSuperAdminRole = selected?.name === "Super Admin";
  const toggleModule = (key: string) => {
    if (key === "dashboard") return; // baseline, always granted
    setModuleDraft((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };
  async function saveModules() {
    if (!selected) return;
    setSavingModules(true);
    try {
      await apiSetRoleModules(selected._id, moduleDraft);
      await refresh();
    } catch (err) {
      toast.error("Could not save the modules", { description: memberError(err) });
    } finally {
      setSavingModules(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", desc: "", type: "Custom", status: "Active" });
    setFormError("");
    setCreateOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, desc: role.desc, type: role.type, status: role.status });
    setFormError("");
    setCreateOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) {
      setFormError("Role name is required.");
      return;
    }
    try {
      if (editing) {
        await apiUpdateRole(editing._id, {
          name: form.name.trim(),
          desc: form.desc.trim(),
          type: form.type,
          status: form.status,
        });
        await refresh();
      } else {
        const created = await apiCreateRole({
          name: form.name.trim(),
          desc: form.desc.trim() || "No description provided",
          users: 0,
          type: form.type,
          perms: 0,
          status: form.status,
          icon: "ShieldCheck",
        });
        await refresh();
        setSelectedId(created.id);
      }
    } catch {
      setFormError(COPY.genericFailure);
      return;
    }
    setCreateOpen(false);
  }

  async function duplicateRole(role: Role) {
    try {
      const created = await apiCreateRole({
        name: `${role.name} (Copy)`,
        desc: role.desc,
        users: 0,
        type: "Custom",
        perms: role.perms,
        status: role.status,
        icon: role.iconName,
      });
      await refresh();
      setSelectedId(created.id);
    } catch (err) {
      toast.error("Could not duplicate the role", { description: memberError(err) });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiDeleteRole(deleteTarget._id);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the role", { description: memberError(err) });
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Roles &amp; Permissions</h1>
            <p className="mt-1 text-sm text-ink-subtle">Create and manage user roles and permissions.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Roles" value={String(roles.length)} icon={Users} tone="brand" delta="2" deltaNote="new this month" />
        <StatCard label="Active Roles" value={String(roles.filter((r) => r.status === "Active").length)} icon={ShieldCheck} tone="violet" delta="12.5%" />
        <StatCard label="Users Assigned" value={String(roles.reduce((s, r) => s + r.users, 0))} icon={UsersRound} tone="amber" delta="18.5%" />
        <StatCard label="Permissions" value={permStats?.total_permissions ?? "126"} icon={Lock} tone="violet" deltaNote="Total Permissions" />
        <StatCard label="Custom Roles" value={String(roles.filter((r) => r.type === "Custom").length)} icon={Settings2} tone="brand" deltaNote="Created by admin" />
      </div>

      <ResizableColumns id="settings-roles" defaultSize={0.72} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Roles Management</h2>
              <p className="text-xs text-ink-subtle">View, edit and manage all user roles</p>
            </div>
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create New Role
            </button>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search roles..."
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> {typeFilter === "All Types" ? "Filters" : typeFilter}
                  <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem icon={SlidersHorizontal} onClick={() => setTypeFilter("All Types")}>All Types</MenuItem>
              <MenuItem icon={ShieldCheck} onClick={() => setTypeFilter("System")}>System</MenuItem>
              <MenuItem icon={Settings2} onClick={() => setTypeFilter("Custom")}>Custom</MenuItem>
            </Menu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Role Name</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Users</th>
                  <th scope="col" className="px-2 py-3">Role Type</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Permissions</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => setSelectedId(r._id)}
                    className={`cursor-pointer text-sm hover:bg-surface-hover/60 ${r._id === selectedId ? "bg-brand-tint/40" : ""}`}
                  >
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                          <r.icon className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{r.name}</p>
                          <p className="text-xs text-ink-subtle">{r.desc}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 align-middle font-medium text-ink-muted">{r.users}</td>
                    <td className="px-2 py-3 align-middle">
                      <Badge tone={r.type === "System" ? "violet" : "brand"}>{r.type}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 align-middle font-medium text-ink-muted">{r.perms}</td>
                    <td className="whitespace-nowrap px-2 py-3 align-middle">
                      <Badge tone={r.status === "Active" ? "emerald" : "rose"}>{r.status}</Badge>
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        trigger={
                          <button aria-label={`More actions for the ${r.name} role`} className="text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></button>
                        }
                      >
                        <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Edit</MenuItem>
                        <MenuItem icon={Copy} onClick={() => duplicateRole(r)}>Duplicate</MenuItem>
                        <MenuItem icon={Trash2} danger onClick={() => setDeleteTarget(r)}>Delete</MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
                {loading && roles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                      Loading roles…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                      No roles match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={1} pageCount={1} onPageChange={() => {}} showing={`Showing 1 to ${filtered.length} of ${filtered.length} roles`} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Role Details</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => selected && openEdit(selected)}>
              <Pencil className="h-3 w-3" /> Edit Role
            </button>
          </div>

          {selected && (
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-tint text-violet-ink">
                <selected.icon className="h-7 w-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg font-bold text-ink">{selected.name}</p>
                  <Badge tone={selected.status === "Active" ? "emerald" : "rose"}>{selected.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-subtle">{selected.desc}.</p>
                <p className="mt-1 text-xs text-ink-subtle">{selected.users} Users Assigned · {selected.type} Role</p>
                <p className="text-xs text-ink-subtle">Created on {selected.created}</p>
              </div>
            </div>
          )}

          {selected && (
            <RolePermissionPanel roleId={selected._id} canEdit={isSuperAdmin} onSaved={refresh} />
          )}

          {isSuperAdmin && selected && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Module Access</h3>
                <span className="text-2xs text-ink-subtle">Sections this role can open</span>
              </div>
              <div className="space-y-1">
                {MODULE_CATALOG.map((m) => {
                  const on = m.key === "dashboard" || moduleDraft.includes(m.key);
                  const locked = m.key === "dashboard" || isSuperAdminRole;
                  return (
                    <div key={m.key} className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm">
                      <span className="text-ink-muted">
                        {m.label}
                        {m.key === "dashboard" && (
                          <span className="ml-1.5 text-3xs text-ink-subtle">always</span>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`Toggle ${m.label}`}
                        disabled={locked}
                        onClick={() => toggleModule(m.key)}
                        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${
                          on ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                            on ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
              {isSuperAdminRole ? (
                <p className="mt-2 text-2xs text-ink-subtle">
                  Super Admin always has full access.
                </p>
              ) : (
                <button
                  className="btn btn-primary btn-block mt-3"
                  onClick={saveModules}
                  disabled={savingModules}
                >
                  {savingModules ? "Saving…" : "Save Module Access"}
                </button>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="btn btn-secondary" onClick={() => selected && duplicateRole(selected)}>
              <Copy className="h-4 w-4" /> Duplicate Role
            </button>
            <button className="btn btn-danger" onClick={() => selected && setDeleteTarget(selected)}>
              <Trash2 className="h-4 w-4" /> Delete Role
            </button>
          </div>
        </Card>
      </ResizableColumns>

      {/* Create / Edit Role modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? "Edit Role" : "Create New Role"}
        description={editing ? "Update the role details and type." : "Define a new user role for the platform."}
        icon={editing ? Pencil : Plus}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitForm}>
              {editing ? "Save Changes" : "Create Role"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Role Name"
            required
            placeholder="e.g. Marketing Manager"
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }));
              if (formError) setFormError("");
            }}
          />
          <Textarea
            label="Description"
            placeholder="Describe what this role can do…"
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Role Type"
              options={["System", "Custom"]}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            />
            <Select
              label="Status"
              options={["Active", "Inactive"]}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            />
          </div>
          {formError && <p className="text-sm font-medium text-status-danger-ink">{formError}</p>}
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Role"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        icon={Trash2}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" /> Delete Role
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          {deleteTarget?.users
            ? `${deleteTarget.users} user${deleteTarget.users > 1 ? "s are" : " is"} currently assigned to this role.`
            : "No users are currently assigned to this role."}
        </p>
      </Modal>
    </div>
  );
}

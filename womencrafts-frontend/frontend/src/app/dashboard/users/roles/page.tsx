"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, ShieldCheck, UsersRound, Lock, Settings2, Plus, SlidersHorizontal, MoreHorizontal, Crown, UserCog, Presentation, UserCheck, User, Headset, Pencil, Eye, Copy, Trash2, Search, Check } from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Select, StatCard, Textarea, useConfirm, useToast } from "@/design-system";
import { apiListRoles, apiCreateRole, apiUpdateRole, apiDeleteRole, type ApiRole } from "@/lib/api";
import RolePermissionPanel from "@/components/admin/RolePermissionPanel";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

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
    created: r.created,
  };
}

const PERMISSIONS = [
  ["Dashboard", "6 / 6"],
  ["User Management", "12 / 12"],
  ["Appointments", "10 / 10"],
  ["Programs", "9 / 9"],
  ["Content Management", "8 / 8"],
  ["Reports & Analytics", "15 / 15"],
  ["Messages", "6 / 6"],
  ["Settings", "12 / 12"],
  ["System", "9 / 9"],
  ["Others", "19 / 19"],
];

type AccessLevel = "Full Access" | "Limited" | "Read Only";

type FormState = {
  name: string;
  desc: string;
  type: string;
  status: string;
  access: AccessLevel;
};

const EMPTY_FORM: FormState = {
  name: "",
  desc: "",
  type: "Custom",
  status: "Active",
  access: "Limited",
};

const ACCESS_PERMS: Record<AccessLevel, number> = {
  "Full Access": 126,
  Limited: 64,
  "Read Only": 12,
};

const permsToAccess = (perms: number): AccessLevel => {
  if (perms >= 100) return "Full Access";
  if (perms <= 12) return "Read Only";
  return "Limited";
};

export default function UserRolesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "System" | "Custom">("All");
  const [selectedName, setSelectedName] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Only a Super Admin may change permissions; everyone else reads them.
  const { isSuperAdmin } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const list = await apiListRoles();
      const mapped = list.items.map(toRole);
      setRoles(mapped);
      setSelectedName((cur) => (cur && mapped.some((r) => r.name === cur) ? cur : mapped[0]?.name ?? ""));
    } catch {
      /* keep current roles */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => {
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
      const matchesType = typeFilter === "All" || r.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [roles, query, typeFilter]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.name === selectedName) ?? roles[0],
    [roles, selectedName]
  );

  // Live figures for the stat cards.
  const activeRoles = roles.filter((r) => r.status === "Active").length;
  const usersAssigned = roles.reduce((sum, r) => sum + r.users, 0);
  const customRoles = roles.filter((r) => r.type === "Custom").length;
  const maxPerms = roles.reduce((m, r) => Math.max(m, r.perms), 0);

  const handleDuplicate = async (role: Role) => {
    const copyName = `${role.name} Copy`;
    if (roles.some((r) => r.name === copyName)) return;
    try {
      await apiCreateRole({
        name: copyName,
        desc: role.desc,
        users: role.users,
        type: role.type,
        perms: role.perms,
        status: role.status,
        icon: role.iconName,
      });
      await refresh();
      setSelectedName(copyName);
    } catch (err) {
      toast.error("Could not duplicate the role", { description: memberError(err) });
    }
  };

  const handleDelete = async (name: string) => {
    if (!(await confirm({
      title: `Delete the ${name} role?`,
      description: "Anyone holding it loses its permissions immediately.",
      confirmLabel: "Delete role",
      danger: true,
    }))) return;
    const role = roles.find((r) => r.name === name);
    if (!role) return;
    try {
      await apiDeleteRole(role._id);
      await refresh();
      toast.success(`${name} role deleted`);
    } catch (err) {
      toast.error("Could not delete the role", { description: memberError(err) });
    }
  };

  const openCreate = () => {
    setEditingName(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingName(role.name);
    setForm({
      name: role.name,
      desc: role.desc,
      type: role.type,
      status: role.status,
      access: permsToAccess(role.perms),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim() || (editingName ?? "Untitled Role");
    const perms = ACCESS_PERMS[form.access];
    try {
      if (editingName) {
        const role = roles.find((r) => r.name === editingName);
        if (role) {
          await apiUpdateRole(role._id, {
            name,
            desc: form.desc,
            type: form.type,
            status: form.status,
            perms,
          });
        }
      } else {
        await apiCreateRole({
          name,
          desc: form.desc,
          type: form.type,
          status: form.status,
          perms,
          icon: "ShieldCheck",
        });
      }
      await refresh();
      setSelectedName(name);
    } catch {
      /* keep the modal open on error */
      return;
    }
    setModalOpen(false);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">User Roles</h1>
            <p className="mt-1 text-sm text-ink-subtle">Create and manage user roles and permissions.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Roles" value={String(roles.length)} icon={Users} tone="brand" delta="2" deltaNote="new this month" />
        <StatCard label="Active Roles" value={String(activeRoles)} icon={ShieldCheck} tone="violet" delta="12.5%" />
        <StatCard label="Users Assigned" value={usersAssigned.toLocaleString()} icon={UsersRound} tone="amber" delta="18.5%" />
        <StatCard label="Permissions" value={String(maxPerms)} icon={Lock} tone="violet" deltaNote="Total Permissions" />
        <StatCard label="Custom Roles" value={String(customRoles)} icon={Settings2} tone="brand" deltaNote="Created by admin" />
      </div>

      <ResizableColumns id="users-roles" defaultSize={0.72} className="mt-6 gap-6">
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
                placeholder="Search roles..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              trigger={
                <span className="btn btn-sm btn-outline">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                </span>
              }
            >
              <MenuItem onClick={() => setTypeFilter("All")}>All Types</MenuItem>
              <MenuItem onClick={() => setTypeFilter("System")}>System</MenuItem>
              <MenuItem onClick={() => setTypeFilter("Custom")}>Custom</MenuItem>
            </Menu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Role Name</th>
                  <th scope="col" className="px-2 py-3">Users</th>
                  <th scope="col" className="px-2 py-3">Role Type</th>
                  <th scope="col" className="px-2 py-3">Permissions</th>
                  <th scope="col" className="px-2 py-3">Status</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRoles.map((r) => (
                  <tr
                    key={r.name}
                    onClick={() => setSelectedName(r.name)}
                    className={`cursor-pointer text-sm hover:bg-surface-hover/60 ${
                      r.name === selectedName ? "bg-brand-tint/60" : ""
                    }`}
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
                    <td className="px-2 py-3 font-medium text-ink-muted">{r.users}</td>
                    <td className="px-2 py-3">
                      <Badge tone={r.type === "System" ? "violet" : "brand"}>{r.type}</Badge>
                    </td>
                    <td className="px-2 py-3 font-medium text-ink-muted">{r.perms}</td>
                    <td className="px-2 py-3">
                      <Badge tone={r.status === "Active" ? "emerald" : "rose"}>{r.status}</Badge>
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        trigger={
                          <span className="text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></span>
                        }
                      >
                        <MenuItem icon={Eye} onClick={() => setSelectedName(r.name)}>View details</MenuItem>
                        <MenuItem icon={Copy} onClick={() => handleDuplicate(r)}>Duplicate</MenuItem>
                        <MenuItem icon={Trash2} danger onClick={() => handleDelete(r.name)}>Delete</MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={1} pageCount={1} onPageChange={() => {}} showing={`Showing 1 to ${filteredRoles.length} of ${filteredRoles.length} roles`} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Role Details</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => selectedRole && openEdit(selectedRole)}>
              <Pencil className="h-3 w-3" /> Edit Role
            </button>
          </div>

          {selectedRole && (
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-tint text-violet-ink">
                <selectedRole.icon className="h-7 w-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg font-bold text-ink">{selectedRole.name}</p>
                  <Badge tone={selectedRole.status === "Active" ? "emerald" : "rose"}>{selectedRole.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-subtle">{selectedRole.desc}.</p>
                <p className="mt-1 text-xs text-ink-subtle">{selectedRole.users} Users Assigned · {selectedRole.type} Role</p>
                <p className="text-xs text-ink-subtle">Created on {selectedRole.created}</p>
              </div>
            </div>
          )}

          {selectedRole && (
            <RolePermissionPanel
              roleId={selectedRole._id}
              canEdit={isSuperAdmin}
              onSaved={refresh}
            />
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="btn btn-secondary btn-block" onClick={() => selectedRole && handleDuplicate(selectedRole)}>
              <Copy className="h-4 w-4" /> Duplicate Role
            </button>
            <button className="btn btn-danger btn-block" onClick={() => selectedRole && handleDelete(selectedRole.name)}>
              <Trash2 className="h-4 w-4" /> Delete Role
            </button>
          </div>
        </Card>
      </ResizableColumns>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingName ? "Edit Role" : "Create New Role"}
        description="Define a role and its access level."
        icon={ShieldCheck}
        iconTone="violet"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              {editingName ? (
                <>
                  <Check className="h-4 w-4" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create Role
                </>
              )}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            className="col-span-2"
            label="Role Name"
            icon={ShieldCheck}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Moderator"
          />
          <Textarea
            className="col-span-2"
            label="Description"
            required
            rows={3}
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
            placeholder="Short description of this role"
          />
          <Select
            label="Role Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            options={["System", "Custom"]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={["Active", "Inactive"]}
          />
          <Select
            className="col-span-2"
            label="Access Level"
            value={form.access}
            onChange={(e) => setForm((f) => ({ ...f, access: e.target.value as AccessLevel }))}
            options={["Full Access", "Limited", "Read Only"]}
          />
        </div>
      </Modal>
    </div>
  );
}

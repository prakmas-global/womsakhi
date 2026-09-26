/**
 * Roles — what each kind of staff account may open and do.
 *
 * Typed client for `app/routes/roles.py`. Roles are a name plus a flat list
 * of `"<module>.<action>"` permissions; module access is derived from that
 * list on the server, so this client never sends modules on their own.
 *
 * `users` on a role is counted from the accounts collection at request time.
 * The old stored field said "Supervisor: 36" while nobody held it, which is
 * why nothing here trusts a number the server did not just count.
 */

import { apiClient } from "./api";

export interface AdminRole {
  id: string;
  name: string;
  desc: string;
  /** Accounts holding this role right now — counted, not stored. */
  users: number;
  type: string;
  /** How many permissions it holds (`permissions.length`). */
  perms: number;
  status: string;
  icon: string;
  modules: string[];
  created: string;
  permissions: string[];
  /** Super Admin and Member: cannot be renamed, reshaped or deleted. */
  protected: boolean;
  is_super_admin: boolean;
  is_member_role: boolean;
}

export interface RoleSummary {
  total: number;
  system: number;
  custom: number;
  /** Accounts holding any staff role (members are not staff). */
  staff_assigned: number;
  /** Staff roles nobody holds. */
  unused: number;
  permissions_total: number;
}

export interface RolesList {
  items: AdminRole[];
  total: number;
  summary: RoleSummary;
}

export interface CatalogueModule {
  module: string;
  label: string;
  actions: string[];
}

export interface PermissionCatalogue {
  modules: CatalogueModule[];
  total: number;
}

export interface RoleHolder {
  id: string;
  full_name: string;
  email: string;
  state: "invited" | "active" | "suspended";
}

export interface RoleHolders {
  role_id: string;
  role_name: string;
  total: number;
  /** Staff are named; members are counted only. */
  staff: RoleHolder[];
  shown: number;
}

/** Static reference labels for the six action verbs the catalogue uses. */
export const ACTION_LABEL: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  export: "Export",
  approve: "Approve",
};

export const apiRolesList = (params: { q?: string; type?: string } = {}) =>
  apiClient.get<RolesList>("/roles", { params }).then((r) => r.data);

export const apiRoleCatalogue = () =>
  apiClient.get<PermissionCatalogue>("/roles/catalogue/all").then((r) => r.data);

export const apiRoleHolders = (id: string) =>
  apiClient.get<RoleHolders>(`/roles/${id}/holders`).then((r) => r.data);

export const apiRoleCreate = (body: {
  name: string; desc?: string; icon?: string; permissions: string[];
}) => apiClient.post<AdminRole>("/roles", body).then((r) => r.data);

export const apiRoleUpdate = (id: string, body: {
  name?: string; desc?: string; icon?: string; permissions?: string[];
}) => apiClient.patch<AdminRole>(`/roles/${id}`, body).then((r) => r.data);

/** Copies the role, permissions and all. Without a name the server picks "<name> copy". */
export const apiRoleDuplicate = (id: string, name?: string) =>
  apiClient.post<AdminRole>(`/roles/${id}/duplicate`, { name: name ?? null }).then((r) => r.data);

/** Refused (409) while anybody holds the role; the message says how many. */
export const apiRoleDelete = (id: string) =>
  apiClient.delete<{ message: string; name: string }>(`/roles/${id}`).then((r) => r.data);

/* ── the one rule the toggles share with the server ─────────────────────── */

/** Any action implies view; dropping view drops the whole module. */
export function togglePermission(prev: Set<string>, key: string): Set<string> {
  const [module, action] = key.split(".");
  const next = new Set(prev);
  if (next.has(key)) {
    next.delete(key);
    if (action === "view") {
      [...next].filter((k) => k.startsWith(`${module}.`)).forEach((k) => next.delete(k));
    }
  } else {
    next.add(key);
    next.add(`${module}.view`);
  }
  return next;
}

/** Whole module on or off. */
export function toggleModule(prev: Set<string>, keys: string[]): Set<string> {
  const allOn = keys.length > 0 && keys.every((k) => prev.has(k));
  const next = new Set(prev);
  keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
  return next;
}

export function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

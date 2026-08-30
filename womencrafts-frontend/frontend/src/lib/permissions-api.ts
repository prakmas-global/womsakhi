import { apiClient } from "@/lib/api";

// Typed client for the Settings → Roles & Permissions "permission groups"
// endpoints (backend: app/routes/settings_platform.py, /permissions half).
// Roles themselves live in "@/lib/api" (apiListRoles/apiCreateRole/…); this
// module only covers the read-only permission-group + stats endpoints.

/** One permission bucket, e.g. { name: "Dashboard", count: "6 / 6", total: 6 }. */
export interface ApiPermissionGroup {
  id: string; // mongo _id
  name: string;
  count: string; // display string shown verbatim, e.g. "6 / 6"
  total: number; // number of permissions in the group
  order: number; // keeps the on-screen ordering
}

export interface PermissionGroupsResponse {
  groups: ApiPermissionGroup[];
  total: number;
}

export interface PermissionStats {
  total_permissions: string; // platform total shown verbatim, e.g. "126"
  permission_groups: number;
  covered_permissions: number;
}

/** GET /permissions — the permission groups (matrix / Role Details list). */
export async function apiListPermissionGroups(): Promise<PermissionGroupsResponse> {
  const { data } = await apiClient.get<PermissionGroupsResponse>("/permissions");
  return data;
}

/** GET /permissions/stats — figures for the Roles & Permissions stat cards. */
export async function apiPermissionStats(): Promise<PermissionStats> {
  const { data } = await apiClient.get<PermissionStats>("/permissions/stats");
  return data;
}

/* ---- granular permissions (module × action) ---- */

export interface PermissionAction {
  key: string;
  action: string;
  label: string;
  granted: boolean;
}

export interface PermissionGroup {
  module: string;
  label: string;
  granted: number;
  total: number;
  actions: PermissionAction[];
}

export interface RolePermissions {
  role_id: string;
  role_name: string;
  is_super_admin: boolean;
  granted: number;
  total: number;
  groups: PermissionGroup[];
}

export async function apiRolePermissions(roleId: string) {
  const { data } = await apiClient.get<RolePermissions>(`/roles/${roleId}/permissions`);
  return data;
}

export async function apiSaveRolePermissions(roleId: string, permissions: string[]) {
  const { data } = await apiClient.put<RolePermissions>(`/roles/${roleId}/permissions`, {
    permissions,
  });
  return data;
}

export async function apiMyPermissions() {
  const { data } = await apiClient.get<{
    permissions: string[];
    granted: number;
    total: number;
  }>("/roles/me/permissions");
  return data;
}

/**
 * Staff accounts — who can get into the dashboard, and what each of them can do.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * There was no way to create a staff login at all. `/auth/signup` is the only
 * endpoint that writes a `users` row and it hardcodes `role="Member"`; the
 * People screen writes to the member *directory* and creates no login, so
 * anyone added there could not sign in. The single Super Admin was seeded by
 * hand, and there was no way to make a second one.
 *
 * Separate from `staff-api.ts`, which is about a staff member's own settings —
 * her profile, her notification preferences, the platform config. This file is
 * about WHO the staff are and what each may do.
 *
 * ── A password is never chosen for her ──────────────────────────────────────
 * Creating an account issues an invitation, not a password. The raw token
 * comes back exactly once, at creation, and is stored only as a digest — so
 * the screen must show it there and then, and say plainly that it will not be
 * shown again.
 */

import { apiClient } from "./api";

export type StaffState = "invited" | "active" | "suspended";

export interface StaffScope {
  mode: "all" | "assigned";
  regions: string[];
  categories: string[];
  organizations: string[];
  communities: string[];
  member_ids: string[];
}

export interface StaffAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string;
  avatar: string;
  state: StaffState;
  /** Resolved — her role's access plus or minus anything granted to her. */
  modules: string[];
  permissions: string[];
  /** The personal adjustments, kept apart so the UI can show what is hers. */
  extra_permissions: string[];
  denied_permissions: string[];
  scope: StaffScope;
  last_login_at: string;
  created_at: string;
}

export interface StaffList {
  staff: StaffAccount[];
  total: number;
  by_state: Record<StaffState, number>;
  /** So the screen can warn before an action that would strand everyone. */
  super_admins: number;
}

export interface AssignableRole {
  id: string;
  name: string;
  desc: string;
  modules: string[];
  permissions: number;
}

export const apiStaffList = (params: { q?: string; role?: string; state?: string } = {}) =>
  apiClient.get<StaffList>("/staff", { params }).then((r) => r.data);

export const apiAssignableRoles = () =>
  apiClient.get<{ roles: AssignableRole[] }>("/staff/roles").then((r) => r.data.roles);

/** The `invite_token` in this response is the only time it is ever readable. */
export const apiInviteStaff = (body: {
  full_name: string; email: string; role: string; phone?: string;
}) => apiClient.post<{ staff: StaffAccount; invite_token: string; expires_in_hours: number }>(
  "/staff", body,
).then((r) => r.data);

export const apiResendInvite = (id: string) =>
  apiClient.post<{ invite_token: string; expires_in_hours: number }>(
    `/staff/${id}/resend`,
  ).then((r) => r.data);

export const apiAcceptInvite = (body: { token: string; password: string }) =>
  apiClient.post<{ ok: boolean; email: string }>("/staff/accept", body).then((r) => r.data);

export const apiChangeStaffRole = (id: string, role: string) =>
  apiClient.patch<StaffAccount>(`/staff/${id}/role`, { role }).then((r) => r.data);

/** Grants and withholds on top of her role. Withholding wins. */
export const apiSetStaffAccess = (id: string, body: {
  extra_permissions: string[]; denied_permissions: string[];
}) => apiClient.put<StaffAccount>(`/staff/${id}/access`, body).then((r) => r.data);

export const apiSetStaffScope = (id: string, body: StaffScope) =>
  apiClient.put<StaffAccount>(`/staff/${id}/scope`, body).then((r) => r.data);

export interface ScopeOption { value: string; label: string; detail?: string }

export const apiStaffScopeOptions = (
  kind: "region" | "category" | "member", q = "", limit = 50,
) => apiClient.get<{ options: ScopeOption[] }>("/staff/scope-options", {
  params: { kind, q, limit },
}).then((r) => r.data.options);

export const apiSuspendStaff = (id: string) =>
  apiClient.post<StaffAccount>(`/staff/${id}/suspend`).then((r) => r.data);

export const apiRestoreStaff = (id: string) =>
  apiClient.post<StaffAccount>(`/staff/${id}/restore`).then((r) => r.data);

/* ── words the screens share, so they cannot describe a state differently ── */

export const STATE_LABEL: Record<StaffState, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
};

export const STATE_TONE: Record<StaffState, "amber" | "emerald" | "rose"> = {
  invited: "amber",
  active: "emerald",
  suspended: "rose",
};

/** What each state actually means, for the row that explains itself. */
export const STATE_NOTE: Record<StaffState, string> = {
  invited: "Has not set a password yet and cannot sign in.",
  active: "Can sign in and use everything her role allows.",
  suspended: "Signed out everywhere and refused at sign-in.",
};

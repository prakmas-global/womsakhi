import RolesManager from "@/components/admin/RolesManager";

/**
 * Settings → Roles & Permissions.
 *
 * The same screen as Users → User Roles, on purpose: one implementation, two
 * sidebar entries, no way for them to disagree.
 */
export default function RolesPermissionsPage() {
  return <RolesManager />;
}

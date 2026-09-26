import RolesManager from "@/components/admin/RolesManager";

/**
 * Users → User Roles.
 *
 * Settings → Roles & Permissions renders the very same component. The two
 * pages used to be separate hand-written screens that disagreed with each
 * other; now there is one implementation behind both doors.
 */
export default function UserRolesPage() {
  return <RolesManager />;
}

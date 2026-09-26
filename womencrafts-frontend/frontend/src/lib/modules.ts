/**
 * RBAC module catalog (must match the backend's ALL_MODULES) + helpers to map
 * a route to its module key. `dashboard` and `notifications` are baseline —
 * always accessible regardless of role.
 */

export type ModuleKey =
  | "dashboard"
  | "users"
  | "appointments"
  | "services"
  | "programs"
  | "calendar"
  | "messages"
  | "analytics"
  | "reports"
  | "content"
  | "feedback"
  | "ai"
  | "community"
  | "growth"
  | "safety"
  | "settings"
  | "market"
  | "money"
  | "learning"
  | "resources";

/** Grantable modules shown in the Super Admin access editor. */
export const MODULE_CATALOG: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Users" },
  { key: "appointments", label: "Appointments" },
  { key: "services", label: "Services & Types" },
  { key: "programs", label: "Programs" },
  { key: "calendar", label: "Calendar" },
  { key: "messages", label: "Messages" },
  { key: "analytics", label: "Analytics" },
  { key: "reports", label: "Reports" },
  { key: "content", label: "Content" },
  { key: "feedback", label: "Feedback" },
  { key: "ai", label: "AI Command Center" },
  { key: "community", label: "Community (circles & stories)" },
  { key: "growth", label: "Growth & Work (events, mentors, jobs)" },
  { key: "safety", label: "Safety & Support fund" },
  { key: "settings", label: "Settings" },
  { key: "market", label: "Market & Shops (listings, orders, group buys)" },
  { key: "money", label: "Money & Payouts (payments, withdrawals, ledger)" },
  { key: "learning", label: "Learning (assessments, certificates)" },
  { key: "resources", label: "Resources catalogue (schemes, health, rights)" },
];

/** Modules every role can always open. */
export const BASELINE_MODULES = ["dashboard", "notifications"];

const SEGMENT_TO_MODULE: Record<string, string> = {
  users: "users",
  appointments: "appointments",
  services: "services",
  programs: "programs",
  calendar: "calendar",
  messages: "messages",
  analytics: "analytics",
  reports: "reports",
  content: "content",
  feedback: "feedback",
  ai: "ai",
  // the staff side of the member modules
  circles: "community",
  stories: "community",
  opportunities: "growth",
  applications: "growth",
  events: "growth",
  mentors: "growth",
  safety: "safety",
  "support-fund": "safety",
  market: "market",
  money: "money",
  learning: "learning",
  resources: "resources",
  settings: "settings",
  notifications: "notifications",
  logout: "dashboard",
};

/** The module key that owns a given dashboard pathname. */
export function moduleForPath(pathname: string): string {
  if (pathname === "/dashboard") return "dashboard";
  const m = pathname.match(/^\/dashboard\/([^/]+)/);
  if (!m) return "dashboard";
  return SEGMENT_TO_MODULE[m[1]] ?? "dashboard";
}

/** Whether a module is reachable given the user's granted modules. */
export function isModuleAllowed(moduleKey: string, granted: string[] | undefined): boolean {
  if (BASELINE_MODULES.includes(moduleKey)) return true;
  return !!granted?.includes(moduleKey);
}

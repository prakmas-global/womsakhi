import type { ElementType } from "react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  UserPlus,
  UserCog,
  ShieldCheck,
  Layers,
  CalendarClock,
  CalendarPlus,
  Calendar,
  Briefcase,
  GraduationCap,
  MessageSquare,
  MessageSquarePlus,
  BarChart3,
  FileText,
  LayoutList,
  MessageSquareHeart,
  Bot,
  Sparkles,
  Bell,
  Settings,
  User,
  CreditCard,
  Plug,
  DatabaseBackup,
  ScrollText,
  MonitorSmartphone,
  Activity,
  Repeat,
  LifeBuoy,
  Headset,
  Tag,
} from "lucide-react";

/* ------------------------------------------------------------------
   Global search index — a curated, static, MODULE-WISE dataset that
   powers the ⌘K command palette. It combines three kinds of entries:
     • action  — quick "create / do" shortcuts
     • page    — every navigable route, grouped under its module
     • record  — representative sample records per module so results
                 feel real until the backend (Phase 8) is wired in.
   Matching + ranking + grouping live at the bottom of this file.
------------------------------------------------------------------- */

export type SearchGroup =
  | "Quick actions"
  | "Dashboard"
  | "Users"
  | "Appointments"
  | "Services"
  | "Programs"
  | "Calendar"
  | "Messages"
  | "Analytics"
  | "Reports"
  | "Content"
  | "Feedback"
  | "AI Command Center"
  | "Notifications"
  | "Settings";

export type SearchKind = "action" | "page" | "record";

/** A single searchable/navigable entry. */
export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  group: SearchGroup;
  kind: SearchKind;
  href: string;
  icon: ElementType;
  /** TONE_CHIP key (violet | sky | emerald | amber | rose | brand | blue | slate). */
  tone: string;
  /** Extra terms that should match this item but aren't shown. */
  keywords?: string[];
  /** Small right-aligned tag (status, role, etc.). */
  meta?: string;
  /** Non-navigation actions handled by the palette instead of routing. */
  run?: "toggle-theme";
};

/* ── Quick actions ─────────────────────────────────────────────── */
const ACTIONS: SearchItem[] = [
  { id: "act-new-user", title: "Add new user", subtitle: "Invite or create a member", group: "Quick actions", kind: "action", href: "/dashboard/users", icon: UserPlus, tone: "brand", keywords: ["create", "invite", "add", "member", "new"] },
  { id: "act-new-appointment", title: "Schedule an appointment", subtitle: "Book a new session", group: "Quick actions", kind: "action", href: "/dashboard/appointments", icon: CalendarPlus, tone: "violet", keywords: ["create", "book", "new", "session", "meeting"] },
  { id: "act-new-program", title: "Create a program", subtitle: "Launch a new program", group: "Quick actions", kind: "action", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", keywords: ["create", "new", "course", "training", "cohort"] },
  { id: "act-new-service", title: "Add a service", subtitle: "New service or type", group: "Quick actions", kind: "action", href: "/dashboard/services", icon: Briefcase, tone: "amber", keywords: ["create", "new", "offering", "type"] },
  { id: "act-new-message", title: "Compose a message", subtitle: "Start a new conversation", group: "Quick actions", kind: "action", href: "/dashboard/messages", icon: MessageSquarePlus, tone: "sky", keywords: ["write", "new", "chat", "reply", "conversation"] },
  { id: "act-toggle-theme", title: "Toggle dark mode", subtitle: "Switch appearance", group: "Quick actions", kind: "action", href: "", icon: Sparkles, tone: "violet", keywords: ["theme", "dark", "light", "appearance", "mode"], run: "toggle-theme" },
];

/* ── Pages (every route, grouped by module) ────────────────────── */
const PAGES: SearchItem[] = [
  { id: "pg-dashboard", title: "Dashboard", subtitle: "Overview & today's activity", group: "Dashboard", kind: "page", href: "/dashboard", icon: LayoutDashboard, tone: "brand", keywords: ["home", "overview", "stats", "summary"] },

  { id: "pg-users", title: "All Users", subtitle: "Manage members & staff", group: "Users", kind: "page", href: "/dashboard/users", icon: Users, tone: "emerald", keywords: ["people", "members", "accounts", "directory"] },
  { id: "pg-users-roles", title: "User Roles", subtitle: "Roles & access levels", group: "Users", kind: "page", href: "/dashboard/users/roles", icon: ShieldCheck, tone: "emerald", keywords: ["permissions", "access", "role"] },
  { id: "pg-users-segments", title: "User Segments", subtitle: "Audience segments", group: "Users", kind: "page", href: "/dashboard/users/segments", icon: Layers, tone: "emerald", keywords: ["groups", "cohorts", "audience", "segment"] },

  { id: "pg-appointments", title: "Appointments", subtitle: "Bookings & sessions", group: "Appointments", kind: "page", href: "/dashboard/appointments", icon: CalendarClock, tone: "violet", keywords: ["bookings", "sessions", "schedule", "meetings"] },
  { id: "pg-services", title: "Services & Types", subtitle: "Service catalogue", group: "Services", kind: "page", href: "/dashboard/services", icon: Briefcase, tone: "amber", keywords: ["offerings", "catalogue", "types"] },
  { id: "pg-programs", title: "Programs", subtitle: "Courses & cohorts", group: "Programs", kind: "page", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", keywords: ["courses", "training", "cohorts", "bootcamp"] },
  { id: "pg-calendar", title: "Calendar", subtitle: "Month & week view", group: "Calendar", kind: "page", href: "/dashboard/calendar", icon: Calendar, tone: "violet", keywords: ["schedule", "events", "agenda"] },
  { id: "pg-messages", title: "Messages", subtitle: "Inbox & conversations", group: "Messages", kind: "page", href: "/dashboard/messages", icon: MessageSquare, tone: "sky", keywords: ["inbox", "chat", "conversations", "dm"] },
  { id: "pg-analytics", title: "Analytics", subtitle: "Insights & trends", group: "Analytics", kind: "page", href: "/dashboard/analytics", icon: BarChart3, tone: "brand", keywords: ["insights", "metrics", "charts", "trends", "kpi"] },
  { id: "pg-reports", title: "Reports", subtitle: "Exports & summaries", group: "Reports", kind: "page", href: "/dashboard/reports", icon: FileText, tone: "sky", keywords: ["export", "pdf", "summary", "download"] },
  { id: "pg-content", title: "Content", subtitle: "Pages & media library", group: "Content", kind: "page", href: "/dashboard/content", icon: LayoutList, tone: "amber", keywords: ["cms", "media", "posts", "library", "pages"] },
  { id: "pg-feedback", title: "Feedback", subtitle: "Reviews & ratings", group: "Feedback", kind: "page", href: "/dashboard/feedback", icon: MessageSquareHeart, tone: "rose", keywords: ["reviews", "ratings", "surveys", "nps"] },
  { id: "pg-ai", title: "AI Command Center", subtitle: "AI insights & automations", group: "AI Command Center", kind: "page", href: "/dashboard/ai", icon: Bot, tone: "violet", keywords: ["ai", "assistant", "automation", "predictions", "copilot"] },
  { id: "pg-notifications", title: "Notifications", subtitle: "Alerts & activity", group: "Notifications", kind: "page", href: "/dashboard/notifications", icon: Bell, tone: "amber", keywords: ["alerts", "activity", "bell", "updates"] },

  { id: "pg-settings", title: "Settings", subtitle: "General settings", group: "Settings", kind: "page", href: "/dashboard/settings", icon: Settings, tone: "slate", keywords: ["general", "preferences", "configuration"] },
  { id: "pg-settings-profile", title: "Profile", subtitle: "Your profile & details", group: "Settings", kind: "page", href: "/dashboard/settings/profile", icon: User, tone: "slate", keywords: ["account", "me", "avatar", "personal"] },
  { id: "pg-settings-security", title: "Security", subtitle: "Password & 2FA", group: "Settings", kind: "page", href: "/dashboard/settings/security", icon: ShieldCheck, tone: "slate", keywords: ["password", "2fa", "privacy", "authentication"] },
  { id: "pg-settings-notifications", title: "Notification Settings", subtitle: "Email & push preferences", group: "Settings", kind: "page", href: "/dashboard/settings/notifications", icon: Bell, tone: "slate", keywords: ["email", "push", "alerts", "preferences"] },
  { id: "pg-settings-billing", title: "Billing & Subscription", subtitle: "Plan, usage & invoices", group: "Settings", kind: "page", href: "/dashboard/settings/billing", icon: CreditCard, tone: "slate", keywords: ["subscription", "invoices", "payment", "plan", "usage"] },
  { id: "pg-settings-roles", title: "Roles & Permissions", subtitle: "Access control", group: "Settings", kind: "page", href: "/dashboard/settings/roles", icon: UserCog, tone: "slate", keywords: ["permissions", "access", "admin"] },
  { id: "pg-settings-integrations", title: "Integrations", subtitle: "Connected apps", group: "Settings", kind: "page", href: "/dashboard/settings/integrations", icon: Plug, tone: "slate", keywords: ["apps", "api", "webhooks", "connect"] },
  { id: "pg-settings-backup", title: "Backup & Restore", subtitle: "Data backups", group: "Settings", kind: "page", href: "/dashboard/settings/backup", icon: DatabaseBackup, tone: "slate", keywords: ["restore", "export", "data", "snapshot"] },
  { id: "pg-settings-logs", title: "System Logs", subtitle: "Audit trail", group: "Settings", kind: "page", href: "/dashboard/settings/logs", icon: ScrollText, tone: "slate", keywords: ["audit", "activity", "events", "history"] },
  { id: "pg-settings-sessions", title: "Sessions", subtitle: "Active devices", group: "Settings", kind: "page", href: "/dashboard/settings/sessions", icon: MonitorSmartphone, tone: "slate", keywords: ["devices", "logins", "signout"] },
  { id: "pg-settings-activity", title: "My Activity", subtitle: "Your recent activity", group: "Settings", kind: "page", href: "/dashboard/settings/activity", icon: Activity, tone: "slate", keywords: ["history", "timeline", "log"] },
  { id: "pg-settings-switch-role", title: "Switch Role", subtitle: "Change your active role", group: "Settings", kind: "page", href: "/dashboard/settings/switch-role", icon: Repeat, tone: "slate", keywords: ["role", "impersonate", "view as"] },
  { id: "pg-settings-support", title: "Contact Support", subtitle: "Reach the support team", group: "Settings", kind: "page", href: "/dashboard/settings/support", icon: Headset, tone: "slate", keywords: ["help", "ticket", "contact", "support"] },
  { id: "pg-settings-help", title: "Help Center", subtitle: "Guides & FAQs", group: "Settings", kind: "page", href: "/dashboard/settings/help", icon: LifeBuoy, tone: "slate", keywords: ["docs", "faq", "guides", "how to"] },
];

/* ── Records (representative sample data, module-wise) ──────────── */
const RECORDS: SearchItem[] = [
  // Users
  { id: "rec-user-priya", title: "Priya Sharma", subtitle: "priya.sharma@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Member", keywords: ["user", "member"] },
  { id: "rec-user-aisha", title: "Aisha Khan", subtitle: "aisha.khan@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Member", keywords: ["user", "member"] },
  { id: "rec-user-neha", title: "Neha Verma", subtitle: "neha.verma@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Member", keywords: ["user", "member"] },
  { id: "rec-user-kavita", title: "Kavita Rao", subtitle: "kavita.rao@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Program Manager", keywords: ["user", "staff", "manager"] },
  { id: "rec-user-meera", title: "Meera Iyer", subtitle: "meera.iyer@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Content Manager", keywords: ["user", "staff", "manager"] },
  { id: "rec-user-ritu", title: "Ritu Singh", subtitle: "ritu.singh@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Member", keywords: ["user", "member"] },
  { id: "rec-user-fatima", title: "Fatima Sheikh", subtitle: "fatima.sheikh@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Member", keywords: ["user", "member"] },
  { id: "rec-user-anjali", title: "Anjali Desai", subtitle: "anjali.desai@womsakhi.com", group: "Users", kind: "record", href: "/dashboard/users", icon: UserRound, tone: "emerald", meta: "Admin", keywords: ["user", "staff", "admin"] },

  // Appointments
  { id: "rec-appt-career", title: "Career Counseling — Priya Sharma", subtitle: "Today, 10:00 AM", group: "Appointments", kind: "record", href: "/dashboard/appointments", icon: CalendarClock, tone: "violet", meta: "Upcoming", keywords: ["appointment", "session", "booking"] },
  { id: "rec-appt-workshop", title: "Skill Workshop — Aisha Khan", subtitle: "Today, 2:30 PM", group: "Appointments", kind: "record", href: "/dashboard/appointments", icon: CalendarClock, tone: "violet", meta: "Upcoming", keywords: ["appointment", "session", "booking"] },
  { id: "rec-appt-mehndi", title: "Bridal Mehndi — Fatima Sheikh", subtitle: "Tomorrow, 11:00 AM", group: "Appointments", kind: "record", href: "/dashboard/appointments", icon: CalendarClock, tone: "violet", meta: "Scheduled", keywords: ["appointment", "session", "booking"] },
  { id: "rec-appt-digital", title: "Digital Skills — Ritu Singh", subtitle: "May 22, 12:00 PM", group: "Appointments", kind: "record", href: "/dashboard/appointments", icon: CalendarClock, tone: "violet", meta: "Completed", keywords: ["appointment", "session", "booking"] },

  // Programs
  { id: "rec-prog-digital", title: "Digital Skills for Women", subtitle: "128 enrolled · Active", group: "Programs", kind: "record", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", meta: "Program", keywords: ["course", "training"] },
  { id: "rec-prog-entrepreneur", title: "Entrepreneurship Bootcamp", subtitle: "104 enrolled · Active", group: "Programs", kind: "record", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", meta: "Program", keywords: ["course", "training", "business"] },
  { id: "rec-prog-finance", title: "Financial Literacy 101", subtitle: "76 enrolled · Active", group: "Programs", kind: "record", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", meta: "Program", keywords: ["course", "money", "finance"] },
  { id: "rec-prog-leadership", title: "Leadership Accelerator", subtitle: "52 enrolled · Enrolling", group: "Programs", kind: "record", href: "/dashboard/programs", icon: GraduationCap, tone: "blue", meta: "Program", keywords: ["course", "management"] },

  // Services
  { id: "rec-svc-career", title: "Career Counseling", subtitle: "60 min · One-on-one", group: "Services", kind: "record", href: "/dashboard/services", icon: Tag, tone: "amber", meta: "Service", keywords: ["service", "counseling"] },
  { id: "rec-svc-workshop", title: "Skill Workshop", subtitle: "90 min · Group", group: "Services", kind: "record", href: "/dashboard/services", icon: Tag, tone: "amber", meta: "Service", keywords: ["service", "workshop"] },
  { id: "rec-svc-legal", title: "Legal Aid Consultation", subtitle: "45 min · One-on-one", group: "Services", kind: "record", href: "/dashboard/services", icon: Tag, tone: "amber", meta: "Service", keywords: ["service", "legal", "advice"] },
  { id: "rec-svc-wellness", title: "Wellness Session", subtitle: "60 min · Group", group: "Services", kind: "record", href: "/dashboard/services", icon: Tag, tone: "amber", meta: "Service", keywords: ["service", "health", "wellbeing"] },
  { id: "rec-svc-loan", title: "Micro-loan Advisory", subtitle: "30 min · One-on-one", group: "Services", kind: "record", href: "/dashboard/services", icon: Tag, tone: "amber", meta: "Service", keywords: ["service", "finance", "loan"] },
];

/** The complete, ordered search index. */
export const SEARCH_INDEX: SearchItem[] = [...ACTIONS, ...PAGES, ...RECORDS];

/** Quick-action entries (shown on the empty state). */
export const QUICK_ACTIONS: SearchItem[] = ACTIONS;

/** "Jump to" shortcuts for the empty state — the primary module landing pages. */
export const JUMP_TO: SearchItem[] = [
  "pg-dashboard",
  "pg-users",
  "pg-appointments",
  "pg-programs",
  "pg-services",
  "pg-analytics",
  "pg-messages",
  "pg-settings",
]
  .map((id) => PAGES.find((p) => p.id === id))
  .filter((p): p is SearchItem => Boolean(p));

const BY_ID = new Map(SEARCH_INDEX.map((it) => [it.id, it]));

/** Resolve an item by id (used to re-hydrate recent-search icons). */
export function getSearchItem(id: string): SearchItem | undefined {
  return BY_ID.get(id);
}

/* ------------------------------------------------------------------
   Matching + ranking
------------------------------------------------------------------- */

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Score a single field against a single token (0 = no match, higher = better). */
function scoreField(text: string, token: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t === token) return 100;
  if (t.startsWith(token)) return 82;
  const words = t.split(/[\s\-_/&,.]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(token))) return 66;
  if (t.includes(token)) return 50;
  if (token.length >= 2 && isSubsequence(token, t)) return 24;
  return 0;
}

/** Best weighted score for one token across all of an item's fields. */
function tokenScore(item: SearchItem, token: string): number {
  const title = scoreField(item.title, token);
  const subtitle = scoreField(item.subtitle ?? "", token) * 0.72;
  const group = scoreField(item.group, token) * 0.55;
  const meta = scoreField(item.meta ?? "", token) * 0.6;
  let keyword = 0;
  for (const k of item.keywords ?? []) {
    const s = scoreField(k, token) * 0.9;
    if (s > keyword) keyword = s;
  }
  return Math.max(title, subtitle, group, meta, keyword);
}

/**
 * Rank the index against a free-text query. Multi-word queries are AND-matched
 * (every token must hit some field). Returns items sorted by relevance.
 */
export function searchItems(query: string): SearchItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of SEARCH_INDEX) {
    let total = 0;
    let ok = true;
    for (const tok of tokens) {
      const s = tokenScore(item, tok);
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (!ok) continue;
    // Bonus when the whole query appears verbatim in the title.
    if (item.title.toLowerCase().includes(q)) total += 18;
    // Gentle nudge so pages/actions edge out records on equal scores.
    if (item.kind === "page") total += 2;
    if (item.kind === "action") total += 1;
    scored.push({ item, score: total / tokens.length });
  }

  scored.sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length);
  return scored.map((s) => s.item);
}

export type SearchSection = { group: SearchGroup; items: SearchItem[] };

/**
 * Group already-ranked results by module. Group order follows the best match
 * (first occurrence in the ranked list), so the most relevant module leads.
 */
export function groupResults(items: SearchItem[], perGroupCap = 6): SearchSection[] {
  const order: SearchGroup[] = [];
  const map = new Map<SearchGroup, SearchItem[]>();
  for (const it of items) {
    let bucket = map.get(it.group);
    if (!bucket) {
      bucket = [];
      map.set(it.group, bucket);
      order.push(it.group);
    }
    if (bucket.length < perGroupCap) bucket.push(it);
  }
  return order.map((group) => ({ group, items: map.get(group) ?? [] }));
}

/**
 * First contiguous match range [start, end) to highlight in `text` for `query`.
 * Falls back to the longest matching token; returns null for fuzzy-only matches.
 */
export function highlightRange(text: string, query: string): [number, number] | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const whole = t.indexOf(q);
  if (whole >= 0) return [whole, whole + q.length];
  const tokens = q.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const tok of tokens) {
    const i = t.indexOf(tok);
    if (i >= 0) return [i, i + tok.length];
  }
  return null;
}

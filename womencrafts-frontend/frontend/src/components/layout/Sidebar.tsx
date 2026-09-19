"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Briefcase,
  GraduationCap,
  Calendar,
  MessageSquare,
  BarChart3,
  FileText,
  LayoutList,
  MessageSquareHeart,
  Bot,
  Settings,
  ChevronDown,
  Eye,
  EyeOff,
  Headset,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  ShieldAlert,
} from "lucide-react";
import Logo, { LogoMark } from "@/components/brand/Logo";
import {
  LIMITS,
  ResizeHandle,
  SortableList,
  useCustomNav,
  useLayoutEngine,
  useSidebarVariable,
} from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import { apiOrgSettings } from "@/lib/org-api";
import { isModuleAllowed } from "@/lib/modules";
import { apiModuleCounts, type ModuleCounts } from "@/lib/admin-modules-api";

type NavChild = { label: string; href: string };
type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  module: string; // RBAC module key gating this item
  badge?: string;
  badgeTone?: "brand" | "muted";
  children?: NavChild[];
};

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    module: "users",
    children: [
      { label: "All Users", href: "/dashboard/users" },
      { label: "Verification", href: "/dashboard/users/verification" },
      { label: "User Roles", href: "/dashboard/users/roles" },
      { label: "User Segments", href: "/dashboard/users/segments" },
    ],
  },
  {
    label: "Appointments",
    href: "/dashboard/appointments",
    icon: CalendarClock,
    module: "appointments",
  },
  {
    label: "Services & Types",
    href: "/dashboard/services",
    icon: Briefcase,
    module: "services",
  },
  {
    label: "Programs",
    href: "/dashboard/programs",
    icon: GraduationCap,
    module: "programs",
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: Calendar,
    module: "calendar",
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    module: "messages",
    badge: "12",
    badgeTone: "muted",
    children: [
      { label: "Campaigns", href: "/dashboard/messages" },
      { label: "Member support", href: "/dashboard/messages/members" },
    ],
  },
  {
    label: "Community",
    href: "/dashboard/circles",
    icon: UsersRound,
    module: "community",
    children: [
      { label: "Circles", href: "/dashboard/circles" },
      { label: "Moderation", href: "/dashboard/circles/moderation" },
      { label: "Success stories", href: "/dashboard/stories" },
    ],
  },
  {
    label: "Growth & Work",
    href: "/dashboard/opportunities",
    icon: Briefcase,
    module: "growth",
    children: [
      { label: "Opportunities", href: "/dashboard/opportunities" },
      { label: "Applications", href: "/dashboard/applications" },
      { label: "Events", href: "/dashboard/events" },
      { label: "Mentors", href: "/dashboard/mentors" },
      { label: "Mentor requests", href: "/dashboard/mentors/requests" },
    ],
  },
  {
    label: "Safety & Support",
    href: "/dashboard/safety",
    icon: ShieldAlert,
    module: "safety",
    children: [
      { label: "Alerts", href: "/dashboard/safety" },
      { label: "Reports", href: "/dashboard/safety/reports" },
      { label: "Support fund", href: "/dashboard/support-fund" },
    ],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    module: "analytics",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
    module: "reports",
  },
  {
    label: "Content",
    href: "/dashboard/content",
    icon: LayoutList,
    module: "content",
  },
  {
    label: "Feedback",
    href: "/dashboard/feedback",
    icon: MessageSquareHeart,
    module: "feedback",
  },
  {
    label: "AI Command Center",
    href: "/dashboard/ai",
    icon: Bot,
    module: "ai",
    badge: "New",
    badgeTone: "brand",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    module: "settings",
    children: [
      { label: "General", href: "/dashboard/settings" },
      { label: "Profile", href: "/dashboard/settings/profile" },
      { label: "Appearance", href: "/dashboard/settings/appearance" },
      { label: "Security", href: "/dashboard/settings/security" },
      { label: "Notifications", href: "/dashboard/settings/notifications" },
      { label: "Billing & Subscription", href: "/dashboard/settings/billing" },
      { label: "Roles & Permissions", href: "/dashboard/settings/roles" },
      { label: "Organisation", href: "/dashboard/settings/organisation" },
      { label: "Integrations", href: "/dashboard/settings/integrations" },
      { label: "Backup & Restore", href: "/dashboard/settings/backup" },
      { label: "System Logs", href: "/dashboard/settings/logs" },
      { label: "Sessions", href: "/dashboard/settings/sessions" },
      { label: "My Activity", href: "/dashboard/settings/activity" },
      { label: "Switch Role", href: "/dashboard/settings/switch-role" },
      { label: "Contact Support", href: "/dashboard/settings/support" },
      { label: "Help Center", href: "/dashboard/settings/help" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href;
}

export default function Sidebar({
  navOpen = false,
  onNavClose,
}: {
  /** Whether the off-canvas drawer is showing. Only applies below `lg`. */
  navOpen?: boolean;
  onNavClose?: () => void;
} = {}) {
  const pathname = usePathname();
  const { user } = useAuth();
  // RBAC — only show modules this role can open.
  // RBAC decides what she MAY see; the layout engine decides how she wants it
  // arranged. Filtering first means a hidden-then-revoked module can't reappear
  // through a saved layout.
  const allowed = useMemo(
    () =>
      NAV.filter((item) => isModuleAllowed(item.module, user?.modules)).map(
        (i) => ({ ...i, id: i.href }),
      ),
    [user?.modules],
  );
  const {
    visible: nav,
    hidden: hiddenNav,
    reorder,
    toggle: toggleHidden,
    canHide,
  } = useCustomNav("staff", allowed);

  const {
    customising,
    sidebarWidth,
    setSidebarWidth,
    features,
    iconOnly,
    railWidth,
    railOverlaying,
    setRailHovered,
    toggleCollapsed,
    navFor,
  } = useLayoutEngine();
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  // An organisation on the `org.branding` tier replaces the marks in the rail.
  // Read once and failed silently: unbranded is the correct fallback, and a
  // dead request here must not stop the navigation from rendering.
  const [brand, setBrand] = useState<{ name: string; logo: string; wordmark: string } | null>(null);
  useEffect(() => {
    let live = true;
    apiOrgSettings()
      .then((o) => {
        if (live && (o.logo || o.wordmark || o.name)) {
          setBrand({ name: o.name, logo: o.logo, wordmark: o.wordmark });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // The page offset follows the RESERVED width, so an open-on-hover rail floats
  // over the content instead of shoving it sideways.
  useSidebarVariable("--wc-sidebar-width", liveWidth ?? railWidth);

  const groupOpenByPath = (item: NavItem) =>
    !!item.children?.some((c) => pathname === c.href) ||
    (item.label === "Settings" && pathname.startsWith("/dashboard/settings")) ||
    (item.label === "Users" && pathname.startsWith("/dashboard/users")) ||
    (item.label === "Community" &&
      (pathname.startsWith("/dashboard/circles") ||
        pathname.startsWith("/dashboard/stories"))) ||
    (item.label === "Growth & Work" &&
      [
        "/dashboard/opportunities",
        "/dashboard/applications",
        "/dashboard/events",
        "/dashboard/mentors",
      ].some((p) => pathname.startsWith(p))) ||
    (item.label === "Safety & Support" &&
      (pathname.startsWith("/dashboard/safety") ||
        pathname.startsWith("/dashboard/support-fund")));

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (label: string) =>
    setOpen((o) => ({ ...o, [label]: !(o[label] ?? false) }));

  // What is waiting for a human, shown on the group that owns it. Refreshed on
  // a timer so a dashboard left open overnight isn't quietly out of date.
  const [counts, setCounts] = useState<ModuleCounts | null>(null);
  const canSeeCounts = isModuleAllowed("safety", user?.modules);

  const loadCounts = useCallback(async () => {
    if (!canSeeCounts) return;
    try {
      setCounts(await apiModuleCounts());
    } catch {
      // A failed count must never break the navigation itself.
    }
  }, [canSeeCounts]);

  useEffect(() => {
    void loadCounts();
    const timer = setInterval(() => void loadCounts(), 120_000);
    return () => clearInterval(timer);
  }, [loadCounts]);

  /** Badge for a group: the number of things needing attention inside it. */
  function waiting(label: string): number {
    if (!counts) return 0;
    if (label === "Community") return counts.pending_stories;
    if (label === "Growth & Work")
      return counts.new_applications + counts.pending_mentor_requests;
    if (label === "Safety & Support")
      return counts.open_alerts + counts.open_reports + counts.pending_support;
    return 0;
  }

  return (
    <aside
      onPointerEnter={() => setRailHovered(true)}
      onPointerLeave={() => setRailHovered(false)}
      // Focus counts as hover. Without this, tabbing into a collapsed rail
      // moves through items whose labels are never shown — the rail would be
      // unusable by keyboard the moment it collapsed.
      onFocusCapture={() => setRailHovered(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setRailHovered(false);
      }}
      style={{ width: liveWidth ?? sidebarWidth }}
      // Above the top bar (z-30). When the rail opens on hover it extends past
      // the reserved 64px, and the top bar starts at 64 — at equal z-index the
      // bar paints over the rail and clips the logo.
      //
      // Below `lg` this is an off-canvas drawer instead of a column. The width
      // is forced with `!` because the inline style above carries the layout
      // engine's rail width, and a collapsed 64px rail is unusable as a drawer
      // — an important class is the one thing that outranks an inline style.
      className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-x-hidden wc-shell wc-rail
        max-lg:!w-[17rem] max-lg:!max-w-[85vw] max-lg:shadow-2xl
        max-lg:transition-transform max-lg:duration-200 max-lg:motion-reduce:transition-none
        ${navOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"} ${
        railOverlaying ? "wc-rail-floating" : ""
      }`}
      data-nav-open={navOpen ? "true" : "false"}
    >
      {/* logo */}
      {/* Collapsed, only the mark fits. Rendering the full lockup in a 64px
          rail clips the wordmark mid-letter, which looks like a broken image
          rather than a deliberate compact state. */}
      <div
        className={`flex h-20 shrink-0 items-center overflow-hidden border-b border-line ${
          iconOnly ? "justify-center px-0" : "px-5"
        }`}
      >
        {iconOnly ? (
          <Link href="/dashboard" aria-label="WomSakhi — dashboard">
            <LogoMark className="h-9" />
          </Link>
        ) : (
          <Logo
            markClassName="h-9"
            wordmarkClassName="h-11"
            taglineClassName="text-3xs tracking-[0.14em]"
            brand={brand ?? undefined}
          />
        )}
      </div>

      {/* Customise mode: the same items, but arrangeable rather than clickable.
          Keeping this a separate branch means that the rest of the time these
          are plain links with no drag targets competing for the click. */}
      {customising ? (
        <nav
          aria-label="Arrange navigation"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <SortableList
            items={nav}
            onReorder={reorder}
            className="space-y-0.5"
            renderItem={(item, handle) => {
              const Icon = item.icon;
              return (
                <div className="flex items-center gap-1 rounded-xl border border-dashed border-brand-300 px-1 py-1 dark:border-brand-500/40">
                  {handle}
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-ink-subtle"
                    strokeWidth={2}
                  />
                  <span className="flex-1 truncate text-sm font-medium text-ink">
                    {item.label}
                  </span>
                  <button
                    onClick={() => toggleHidden(item.id)}
                    disabled={!canHide(item.id)}
                    aria-label={`Hide ${item.label}`}
                    title={
                      canHide(item.id)
                        ? `Hide ${item.label}`
                        : "This one always stays"
                    }
                    className="rounded p-1 text-ink-subtle transition hover:text-ink-muted disabled:opacity-25"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              );
            }}
          />

          {hiddenNav.length > 0 && (
            <div className="mt-4 border-t border-line pt-3 dark:border-white/10">
              <p className="mb-2 px-1 text-2xs font-bold uppercase tracking-wider text-ink-subtle">
                Hidden
              </p>
              <ul className="space-y-0.5">
                {hiddenNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => toggleHidden(item.id)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink-subtle transition hover:bg-[color:var(--surface-hover)]"
                      >
                        <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                        <Icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={2}
                        />
                        <span className="flex-1 truncate text-left">
                          {item.label}
                        </span>
                        <span className="text-2xs font-semibold text-brand-ink">
                          Show
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>
      ) : (
        <>
          {/* nav */}
          <nav
            className={`flex-1 overflow-y-auto py-4 ${iconOnly ? "px-2" : "px-3"}`}
          >
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              const expanded = open[item.label] ?? groupOpenByPath(item);

              if (item.children) {
                return (
                  <div key={item.label} className="group relative mb-0.5">
                    <button
                      onClick={() => toggle(item.label)}
                      aria-label={iconOnly ? item.label : undefined}
                      className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition ${
                        iconOnly ? "justify-center gap-0 px-0" : "gap-3 px-3"
                      } ${
                        active
                          ? "bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                          : "text-ink-muted hover:bg-surface-hover"
                      }`}
                    >
                      <Icon
                        className="h-[18px] w-[18px] shrink-0"
                        strokeWidth={2}
                      />
                      <span
                        className="wc-rail-label flex-1 text-left"
                        data-hidden={iconOnly || undefined}
                      >
                        {item.label}
                      </span>
                      {!iconOnly && waiting(item.label) > 0 && (
                        <span
                          title={`${waiting(item.label)} waiting`}
                          className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
                            active
                              ? "bg-white/25 text-white"
                              : item.label === "Safety & Support"
                                ? "bg-status-danger-bg text-status-danger-ink"
                                : "bg-brand-100 text-brand-ink"
                          }`}
                        >
                          {waiting(item.label)}
                        </span>
                      )}
                      <ChevronDown
                        className={`wc-rail-label h-4 w-4 shrink-0 transition-transform ${
                          expanded ? "rotate-180" : ""
                        } ${active ? "text-white/80" : "text-ink-subtle"}`}
                        data-hidden={iconOnly || undefined}
                      />
                      {/* A count still has to be visible when the label is not —
                      otherwise collapsing the rail hides the fact that three
                      safety alerts are waiting. */}
                      {iconOnly && waiting(item.label) > 0 && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-status-danger-solid" />
                      )}
                    </button>
                    {expanded && !iconOnly && (
                      <div className="mt-0.5 space-y-0.5 pb-1 pl-11 pr-1">
                        {item.children.map((c) => {
                          const cActive = pathname === c.href;
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              className={`block rounded-lg px-3 py-2 text-xsm transition ${
                                cActive
                                  ? "bg-brand-tint font-semibold text-brand-ink"
                                  : "text-ink-subtle hover:bg-surface-hover hover:text-ink-muted"
                              }`}
                            >
                              {c.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.label} className="group relative">
                  <Link
                    href={item.href}
                    aria-label={iconOnly ? item.label : undefined}
                    className={`mb-0.5 flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
                      iconOnly ? "justify-center gap-0 px-0" : "gap-3 px-3"
                    } ${
                      active
                        ? "bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                        : "text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    <Icon
                      className="h-[18px] w-[18px] shrink-0"
                      strokeWidth={2}
                    />
                    <span
                      className="wc-rail-label flex-1"
                      data-hidden={iconOnly || undefined}
                    >
                      {item.label}
                    </span>
                    {!iconOnly && item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
                          active
                            ? "bg-white/25 text-white"
                            : item.badgeTone === "brand"
                              ? "bg-brand-100 text-brand-ink"
                              : "bg-surface-inset text-ink-subtle"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>
        </>
      )}

      {/* help card — pinned to the bottom of the sidebar.
          Collapsed, it becomes one icon with a flyout. Squeezing a headline, a
          sentence and a button into 64px wraps every word onto its own line and
          is the single ugliest thing a collapsed rail can do. */}
      {/* Keep-open toggle. Hover-to-open suits most people most of the time,
          but someone navigating heavily wants it to stay put. It lives down
          here rather than beside the logo, where it collided with the wordmark
          and read like a close button. */}
      {!iconOnly && (
        <button
          onClick={() => toggleCollapsed("staff")}
          aria-pressed={!navFor("staff").collapsed}
          className="mx-3 mt-auto mb-1 flex items-center gap-2.5 rounded-xl px-2 py-2 text-xsm font-medium text-ink-subtle transition hover:bg-surface-hover hover:text-ink-muted dark:hover:bg-white/10"
        >
          {navFor("staff").collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">
            {navFor("staff").collapsed ? "Keep menu open" : "Collapse to icons"}
          </span>
        </button>
      )}

      {iconOnly ? (
        <div className="group relative mt-auto flex justify-center px-2 pb-4">
          <Link
            href="/dashboard/settings/support"
            aria-label="Contact support"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-100 to-brand-100 text-violet-ink transition hover:from-violet-200 hover:to-brand-200"
          >
            <Headset className="h-4.5 w-4.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-auto px-3 pb-4">
          <div className="rounded-2xl bg-linear-to-br from-violet-50 to-brand-50 p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm">
                <Headset className="h-4.5 w-4.5 text-violet-ink" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Need Help?
                </p>
                <p className="text-2xs leading-tight text-ink-subtle">
                  Our support team is here to help you.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/support"
              className="mt-3 block rounded-lg bg-violet-600 py-2 text-center text-xsm font-semibold text-white transition hover:bg-violet-700"
            >
              Contact Support
            </Link>
          </div>
        </div>
      )}

      {/* Drag to resize. Keyboard too — arrows nudge, Home/End jump to the
          limits. A rail you can only resize by dragging is one a keyboard user
          can never resize at all. */}
      <ResizeHandle
        label="Sidebar width"
        value={liveWidth ?? sidebarWidth}
        min={LIMITS.sidebar.min}
        max={LIMITS.sidebar.max}
        disabled={!features["layout.resize"]}
        onChange={setLiveWidth}
        onCommit={(next) => {
          setLiveWidth(null);
          setSidebarWidth(next);
          // Dragging the rail to a width is an explicit statement about how
          // wide you want it — which implies you want it to STAY that wide.
          // Without this the rail snaps back to 64px the moment the pointer
          // leaves, and the drag looks like it was ignored.
          if (next > LIMITS.sidebar.min + 16 && navFor("staff").collapsed) {
            toggleCollapsed("staff");
          }
        }}
        // Seated fully INSIDE the rail rather than straddling its edge. The
        // rail clips its own overflow now, so a handle hanging halfway out
        // would have only its inner half grabbable — worse than one that is
        // slightly narrower but entirely there. 12px is a comfortable target.
        className="absolute inset-y-0 right-0 z-40 w-3"
      >
        <span
          className="block h-full w-px bg-transparent transition group-hover:bg-brand-500/40 group-focus-visible:bg-brand-500 group-data-[dragging]:bg-brand-500"
          aria-hidden
        />
      </ResizeHandle>
    </aside>
  );
}

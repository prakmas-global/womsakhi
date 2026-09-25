"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Menu, Bell, HelpCircle, Settings as SettingsIcon, ChevronDown, User, Cog, ShieldCheck, Moon, Repeat, Activity, CreditCard, LifeBuoy, Headset, LogOut, CheckCheck } from "lucide-react";
import { Avatar } from "@/design-system";
import CommandPalette from "@/components/search/CommandPalette";
import { CustomiseButton } from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { NOTIF_META, TONE_CHIP, type NotifType } from "@/lib/notifications";
import { apiListNotifications, apiMarkAllNotificationsRead, apiMarkNotificationRead, type ApiNotification } from "@/lib/notifications-api";

const MENU_GROUPS: {
  items: { label: string; href: string; icon: React.ElementType; badge?: string }[];
}[] = [
  {
    items: [
      { label: "My Profile", href: "/dashboard/settings/profile", icon: User },
      { label: "Account Settings", href: "/dashboard/settings", icon: Cog },
      { label: "Security", href: "/dashboard/settings/security", icon: ShieldCheck },
      { label: "Notifications", href: "/dashboard/settings/notifications", icon: Bell, badge: "5" },
    ],
  },
  {
    items: [
      { label: "Switch Role", href: "/dashboard/settings/switch-role", icon: Repeat },
      { label: "My Activity", href: "/dashboard/settings/activity", icon: Activity },
      { label: "Billing", href: "/dashboard/settings/billing", icon: CreditCard },
    ],
  },
  {
    items: [
      { label: "Help Center", href: "/dashboard/settings/help", icon: LifeBuoy },
      { label: "Contact Support", href: "/dashboard/settings/support", icon: Headset },
    ],
  },
];

export default function Topbar({ onMenu }: { onMenu?: () => void } = {}) {
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifs, setNotifs] = useState<ApiNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const bellUnread = notifs.filter((n) => n.unread).length;

  /**
   * The bell reads the same API as the notifications page.
   *
   * It used to render a hardcoded array, so the badge showed a count nobody
   * could clear and rows describing people who had never booked anything. A
   * fabricated notification is worse than none: it teaches staff that the bell
   * is decorative, and then the real alert is ignored too.
   */
  const loadNotifs = useCallback(async () => {
    try {
      const { items } = await apiListNotifications({ page_size: 8 });
      setNotifs(items);
    } catch {
      // Leave whatever is on screen. A failed poll must not blank the bell.
    }
  }, []);

  useEffect(() => {
    void loadNotifs();
    // Slow on purpose: this runs on every dashboard screen, and the bell is a
    // hint that something arrived, not a live feed.
    const timer = setInterval(() => void loadNotifs(), 60_000);
    return () => clearInterval(timer);
  }, [loadNotifs]);

  // Re-read when it is opened, so the list is current at the moment it is read.
  useEffect(() => {
    if (bellOpen) void loadNotifs();
  }, [bellOpen, loadNotifs]);

  async function markAllRead() {
    const previous = notifs;
    setNotifs((xs) => xs.map((n) => ({ ...n, unread: false })));  // optimistic
    try {
      await apiMarkAllNotificationsRead();
    } catch {
      setNotifs(previous);
    }
  }

  async function openNotification(id: string) {
    setBellOpen(false);
    setNotifs((xs) => xs.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    try {
      await apiMarkNotificationRead(id);
    } catch {
      void loadNotifs();
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) setOpen(false);
      if (bellRef.current && !bellRef.current.contains(t)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Global ⌘K / Ctrl+K opens (and toggles) the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const name = user?.full_name ?? "Admin User";

  return (
    <header className="fixed right-0 left-0 lg:left-[var(--wc-sidebar-width)] top-0 z-30 flex h-20 items-center gap-3 sm:gap-4 wc-shell-top px-4 sm:px-6 backdrop-blur">
      {/* Below `lg` the rail is off-canvas, so this is the only way to it. */}
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-subtle transition hover:bg-brand-tint hover:text-brand-ink lg:hidden dark:hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {/* global search trigger — opens the ⌘K command palette */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Open search (Command K)"
        className="group relative flex items-center wc-inset text-left text-sm text-ink-subtle outline-none transition hover:ring-2 hover:ring-brand-500/25
          max-sm:h-10 max-sm:w-10 max-sm:shrink-0 max-sm:justify-center max-sm:rounded-xl
          sm:w-full sm:max-w-md sm:rounded-xl sm:py-2.5 sm:pl-10 sm:pr-16"
      >
        <Search className="h-4 w-4 text-ink-subtle transition-colors group-hover:text-brand-ink sm:pointer-events-none sm:absolute sm:left-3.5 sm:top-1/2 sm:-translate-y-1/2" />
        <span className="hidden truncate sm:inline">Search anything...</span>
        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-2xs font-semibold text-ink-subtle shadow-sm sm:flex dark:border-white/10 dark:bg-white/10">
          ⌘K
        </span>
      </button>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className="ml-auto flex items-center gap-1.5">
        {/* bell */}
        <div className="relative" ref={bellRef}>
          <button
            aria-label={bellUnread ? `Notifications, ${bellUnread} unread` : "Notifications"}
            aria-expanded={bellOpen}
            aria-haspopup="dialog"
            onClick={() => setBellOpen((v) => !v)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
              bellOpen
                ? "bg-brand-tint text-brand-ink dark:bg-white/10"
                : "text-ink-subtle hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/10"
            }`}
          >
            <Bell className="h-5 w-5" />
            {bellUnread > 0 && (
              <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-3xs font-bold text-white ring-2 ring-white dark:ring-[var(--surface)]">
                {bellUnread}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-14 w-[22rem] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-[color:var(--wc-shadow-overlay)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">Notifications</p>
                  {bellUnread > 0 && (
                    <span className="rounded-full bg-brand-100 px-1.5 text-2xs font-bold text-brand-ink">
                      {bellUnread} new
                    </span>
                  )}
                </div>
                <button
                  onClick={markAllRead}
                  disabled={bellUnread === 0}
                  className="flex items-center gap-1 text-2xs font-semibold text-violet-ink hover:text-violet-ink disabled:cursor-not-allowed disabled:text-ink-faint"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              </div>

              <div className="max-h-[22rem] overflow-y-auto py-1">
                {notifs.slice(0, 5).map((n) => {
                  // The backend owns the type string; fall back rather than
                  // crash on one this build has no icon for.
                  const meta = NOTIF_META[n.type as NotifType] ?? NOTIF_META.system;
                  const Icon = meta.icon;
                  return (
                    <Link
                      key={n.id}
                      href="/dashboard/notifications"
                      onClick={() => void openNotification(n.id)}
                      className={`flex gap-3 px-4 py-2.5 transition hover:bg-surface-hover dark:hover:bg-white/5 ${
                        n.unread ? "bg-brand-500/6 dark:bg-brand-500/10" : ""
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[meta.tone]}`}
                      >
                        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xsm font-semibold text-ink">
                          {n.title}
                        </p>
                        <p className="truncate text-xs text-ink-subtle">{n.desc}</p>
                        <p className="mt-0.5 text-2xs text-ink-subtle">{n.time}</p>
                      </div>
                      {n.unread && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                      )}
                    </Link>
                  );
                })}
              </div>

              <Link
                href="/dashboard/notifications"
                onClick={() => setBellOpen(false)}
                className="block border-t border-line py-2.5 text-center text-xsm font-semibold text-violet-ink hover:bg-surface-hover hover:text-violet-ink"
              >
                View All Notifications
              </Link>
            </div>
          )}
        </div>
        {/* help */}
        <button
          aria-label="Help"
          className="hidden h-10 w-10 items-center justify-center rounded-xl sm:flex text-ink-subtle transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/10"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        {/* settings */}
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="hidden h-10 w-10 items-center justify-center rounded-xl sm:flex text-ink-subtle transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/10"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>

        {/* divider */}
        <span className="mx-1.5 hidden h-6 w-px bg-line sm:block dark:bg-white/10" />

        {/* profile */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-brand-tint/60 dark:hover:bg-white/5 ${
              open ? "bg-brand-tint/60 dark:bg-white/5" : ""
            }`}
          >
            <Avatar name={name} size="sm" ring />
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-ink">
                {name}
              </span>
              <span className="block text-2xs leading-tight text-ink-subtle">
                {user?.role ?? "Member"}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <div className="wc-page-enter absolute right-0 top-14 w-72 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_50px_-16px_rgba(80,40,120,0.4)] ring-1 ring-black/5 dark:border-white/10 dark:ring-white/10">
              <div className="flex items-center gap-3 border-b border-line bg-linear-to-br from-brand-50/70 to-violet-50/50 px-4 py-4 dark:from-white/5 dark:to-transparent">
                <Avatar name={name} size="md" ring />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{name}</p>
                  <p className="truncate text-2xs font-medium text-ink-subtle">{user?.role ?? "Member"}</p>
                  <p className="truncate text-2xs text-ink-subtle">
                    {user?.email ?? "admin@womsakhi.com"}
                  </p>
                </div>
              </div>

              <div className="px-1.5 py-1.5">
                {MENU_GROUPS[0].items.map((it) => (
                  <MenuLink key={it.label} {...it} onClick={() => setOpen(false)} />
                ))}
                {/* dark mode toggle */}
                <button
                  onClick={toggle}
                  className="group/mi flex w-full items-center justify-between gap-2.5 rounded-xl px-2 py-2 text-xsm font-semibold text-ink-muted transition hover:bg-brand-tint dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle transition group-hover/mi:bg-brand-100 group-hover/mi:text-brand-ink dark:bg-white/10">
                      <Moon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    Dark Mode
                  </span>
                  <span
                    className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      isDark ? "bg-brand-600" : "bg-line dark:bg-white/15"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                        isDark ? "translate-x-4" : ""
                      }`}
                    />
                  </span>
                </button>
              </div>

              <div className="border-t border-line px-1.5 py-1.5">
                {MENU_GROUPS[1].items.map((it) => (
                  <MenuLink key={it.label} {...it} onClick={() => setOpen(false)} />
                ))}
              </div>
              <div className="border-t border-line px-1.5 py-1.5">
                {MENU_GROUPS[2].items.map((it) => (
                  <MenuLink key={it.label} {...it} onClick={() => setOpen(false)} />
                ))}
              </div>
              {/* Customise mode lives in the account menu, which is not itself
                  customisable — so the way to rearrange the dashboard, and the
                  way to put it back, can never be hidden by rearranging it. */}
              <div className="border-t border-line px-1.5 py-1.5">
                <CustomiseButton className="group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-xsm font-semibold text-ink-muted transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/5" />
              </div>
              <div className="border-t border-line px-1.5 py-1.5">
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-xsm font-semibold text-status-danger-ink transition hover:bg-status-danger-bg dark:hover:bg-rose-500/10"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-status-danger-bg text-status-danger-ink transition group-hover/mi:bg-status-danger-bg">
                    <LogOut className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  label,
  href,
  icon: Icon,
  badge,
  onClick,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group/mi flex items-center gap-2.5 rounded-xl px-2 py-2 text-xsm font-semibold text-ink-muted transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/5"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle transition group-hover/mi:bg-brand-100 group-hover/mi:text-brand-ink dark:bg-white/10">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-3xs font-bold text-brand-ink">
          {badge}
        </span>
      )}
    </Link>
  );
}

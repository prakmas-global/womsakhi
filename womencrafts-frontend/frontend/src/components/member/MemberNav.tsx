"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Award,
  BadgeIndianRupee,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  CreditCard,
  GraduationCap,
  HeartHandshake,
  Home,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { SortableList, useCustomNav, useLayoutEngine } from "@/layout-engine";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";

/**
 * The member app's navigation.
 *
 * Organised by INTENT, not by database entity — a member thinks "I want to find
 * work" or "what have I booked?", never "show me the opportunities table".
 *
 * Three renderings of ONE structure, so nothing can drift out of step:
 *   · MemberSideNav — the grouped rail, tablet and up
 *   · MemberTabBar  — five thumb-reachable tabs on phones
 *   · MemberMenu    — the full menu behind "More", on phones
 */

type NavChild = { href: string; labelKey: MessageKey; icon: React.ElementType };
type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: React.ElementType;
  tone?: "danger";
  children?: NavChild[];
};

export const MEMBER_NAV: NavItem[] = [
  { href: "/app", labelKey: "nav.home", icon: Home },
  {
    href: "/app/explore",
    labelKey: "nav.discover",
    icon: Compass,
    children: [
      { href: "/app/explore", labelKey: "nav.explore", icon: LayoutGrid },
      { href: "/app/events", labelKey: "nav.events", icon: Ticket },
      { href: "/app/mentors", labelKey: "nav.mentors", icon: HeartHandshake },
      { href: "/app/stories", labelKey: "nav.stories", icon: Sparkles },
    ],
  },
  {
    href: "/app/programs",
    labelKey: "nav.learning",
    icon: GraduationCap,
    children: [
      { href: "/app/programs", labelKey: "nav.myPrograms", icon: GraduationCap },
      { href: "/app/certificates", labelKey: "nav.certificates", icon: Award },
      { href: "/app/library", labelKey: "nav.library", icon: BookOpen },
      { href: "/app/progress", labelKey: "nav.progress", icon: Trophy },
    ],
  },
  {
    href: "/app/bookings",
    labelKey: "nav.sessions",
    icon: CalendarCheck,
    children: [
      { href: "/app/bookings", labelKey: "nav.myBookings", icon: CalendarCheck },
      { href: "/app/schedule", labelKey: "nav.schedule", icon: CalendarDays },
    ],
  },
  { href: "/app/circles", labelKey: "nav.circles", icon: Users },
  {
    href: "/app/opportunities",
    labelKey: "nav.work",
    icon: Briefcase,
    children: [
      { href: "/app/opportunities", labelKey: "nav.opportunities", icon: Briefcase },
      { href: "/app/applications", labelKey: "nav.applications", icon: Send },
    ],
  },
  {
    href: "/app/payments",
    labelKey: "nav.money",
    icon: BadgeIndianRupee,
    children: [
      { href: "/app/payments", labelKey: "nav.payments", icon: CreditCard },
      { href: "/app/wallet", labelKey: "nav.wallet", icon: Wallet },
      { href: "/app/support-fund", labelKey: "nav.feeSupport", icon: LifeBuoy },
    ],
  },
  // Deliberately its own top-level item, never buried in settings. On a
  // women-only platform, safety is a destination and not a preference.
  { href: "/app/safety", labelKey: "nav.safety", icon: ShieldCheck, tone: "danger" },
  // Sakhi sits at the top level next to the inbox: for a member who would
  // rather ask than navigate, she IS the way in — burying her under settings
  // would hide the one entry point that needs no reading.
  { href: "/app/sakhi", labelKey: "nav.sakhi", icon: Bot },
  {
    href: "/app/messages",
    labelKey: "nav.inbox",
    icon: MessageCircle,
    children: [
      { href: "/app/messages", labelKey: "nav.messages", icon: MessageCircle },
      { href: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
];

/** The five phone tabs. Everything else lives behind "More". */
const TABS = [
  { href: "/app", labelKey: "nav.home" as MessageKey, icon: Home },
  { href: "/app/explore", labelKey: "nav.explore" as MessageKey, icon: Compass },
  { href: "/app/circles", labelKey: "nav.circles" as MessageKey, icon: Users },
  { href: "/app/opportunities", labelKey: "nav.workShort" as MessageKey, icon: Briefcase },
];

function isExact(pathname: string, href: string) {
  return pathname === href;
}

/** True when this section owns the current screen, including its detail pages. */
function ownsPath(item: NavItem, pathname: string): boolean {
  if (item.href === "/app") return pathname === "/app";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.children ?? []).some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );
}

/* ---------------------------------------------------------------- side rail */

export function MemberSideNav() {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { customising, iconOnly } = useLayoutEngine();

  // The nav definition above stays the source of truth for what the items ARE.
  // This only reorders and filters them, which is what lets a new section
  // appear for everyone — including members who arranged their nav last year.
  const items = useMemo(() => MEMBER_NAV.map((i) => ({ ...i, id: i.href })), []);
  const { visible, hidden, reorder, toggle: toggleHidden, canHide } = useCustomNav("member", items);

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !(o[key] ?? false) }));

  if (customising) {
    return (
      <nav aria-label="Main" className="hidden md:block">
        <SortableList
          items={visible}
          onReorder={reorder}
          className="space-y-0.5"
          renderItem={(item, handle) => {
            const Icon = item.icon;
            return (
              <div className="flex items-center gap-1 rounded-xl border border-dashed border-brand-300 bg-[color:var(--surface)] px-1 py-1 dark:border-brand-500/40">
                {handle}
                <Icon className="h-[18px] w-[18px] shrink-0 text-ink-subtle" strokeWidth={2} />
                <span className="flex-1 truncate text-sm font-medium text-ink">
                  {t(item.labelKey)}
                </span>
                <button
                  onClick={() => toggleHidden(item.id)}
                  disabled={!canHide(item.id)}
                  aria-label={`Hide ${t(item.labelKey)}`}
                  title={
                    canHide(item.id)
                      ? `Hide ${t(item.labelKey)}`
                      : "This one always stays — you may need it"
                  }
                  className="rounded p-1 text-ink-subtle transition hover:text-ink-muted disabled:opacity-25"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          }}
        />

        {hidden.length > 0 && (
          <div className="mt-4 border-t border-line pt-3 dark:border-white/10">
            <p className="mb-2 px-1 text-2xs font-bold uppercase tracking-wider text-ink-subtle">
              Hidden
            </p>
            <ul className="space-y-0.5">
              {hidden.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => toggleHidden(item.id)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink-subtle transition hover:bg-[color:var(--surface-hover)]"
                    >
                      <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                      <span className="flex-1 truncate text-left">{t(item.labelKey)}</span>
                      <span className="text-2xs font-semibold text-brand-ink">Show</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="space-y-0.5">
        {visible.map((item) => {
          const Icon = item.icon;
          const owns = ownsPath(item, pathname);
          // A section opens itself when you're inside it, and stays wherever you
          // last put it after that.
          const expanded = open[item.href] ?? owns;
          const active = isExact(pathname, item.href) && !item.children;

          if (!item.children) {
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={iconOnly ? t(item.labelKey) : undefined}
                  className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
                    iconOnly ? "justify-center gap-0 px-0" : "gap-3 px-3"
                  } ${
                    active
                      ? "bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                      : item.tone === "danger"
                        ? "text-status-danger-ink hover:bg-status-danger-bg"
                        : "text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="wc-rail-label" data-hidden={iconOnly || undefined}>
                    {t(item.labelKey)}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="group relative">
              <button
                onClick={() => toggle(item.href)}
                aria-expanded={expanded}
                aria-label={iconOnly ? t(item.labelKey) : undefined}
                className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition ${
                  iconOnly ? "justify-center gap-0 px-0" : "gap-3 px-3"
                } ${owns ? "text-brand-ink" : "text-ink-muted hover:bg-surface-hover"}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span
                  className="wc-rail-label flex-1 text-left"
                  data-hidden={iconOnly || undefined}
                >
                  {t(item.labelKey)}
                </span>
                <ChevronDown
                  className={`wc-rail-label h-4 w-4 shrink-0 text-ink-subtle transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                  data-hidden={iconOnly || undefined}
                />
              </button>


              {expanded && !iconOnly && (
                <ul className="mb-1 ms-[1.4rem] space-y-0.5 border-s border-line ps-3 dark:border-white/10">
                  {item.children.map((child) => {
                    const childActive =
                      pathname === child.href ||
                      // "/app/circles/abc" belongs to the circles child, but
                      // "/app/explore" must not claim "/app/explore/service/1"
                      // away from a more specific sibling.
                      (child.href !== item.href && pathname.startsWith(`${child.href}/`));
                    const ChildIcon = child.icon;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xsm transition ${
                            childActive
                              ? "bg-brand-tint font-semibold text-brand-ink"
                              : "text-ink-subtle hover:bg-surface-hover hover:text-ink-muted"
                          }`}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
                          {t(child.labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------ phone tab bar */

export function MemberTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const t = useT();

  const items = useMemo(() => MEMBER_NAV.map((i) => ({ ...i, id: i.href })), []);
  const { tabs } = useCustomNav("member", items);

  // Her four chosen tabs, or the app's defaults if she has never picked. Four,
  // not five: the fifth slot belongs to "More", which is the only route to
  // everything she didn't choose.
  const chosen = useMemo(
    () => (tabs.length ? tabs.slice(0, 4) : TABS.map((tb) => ({ ...tb, id: tb.href }))),
    [tabs],
  );

  // "More" lights up whenever the screen isn't one of the tabs, so she is
  // never on a screen with no tab selected.
  const onTab = chosen.some((tab) =>
    tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href),
  );

  return (
    <nav
      aria-label="Quick tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong/70 bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/10"
    >
      <ul className="flex items-stretch">
        {chosen.map(({ href, labelKey, icon: Icon }) => {
          const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-2xs font-semibold transition ${
                  active ? "text-brand-ink" : "text-ink-subtle"
                }`}
              >
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                    active ? "bg-brand-tint" : ""
                  }`}
                >
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.4 : 2} />
                </span>
                {t(labelKey)}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            onClick={onMore}
            aria-label={t("nav.menu")}
            className={`flex w-full flex-col items-center gap-1 py-2.5 text-2xs font-semibold transition ${
              !onTab ? "text-brand-ink" : "text-ink-subtle"
            }`}
          >
            <span
              className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                !onTab ? "bg-brand-tint" : ""
              }`}
            >
              <LayoutGrid className="h-[1.15rem] w-[1.15rem]" strokeWidth={!onTab ? 2.4 : 2} />
            </span>
            {t("nav.more")}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------- phone full menu */

export function MemberMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const t = useT();

  // Any navigation closes the sheet — including the back button, which would
  // otherwise leave it covering the screen she just went back to.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Stop the page behind the sheet from scrolling with it.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--color-ink)]/40 backdrop-blur-[2px]"
      />
      <div className="wc-sheet-enter absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[var(--surface)] px-5 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-bold text-ink">{t("nav.menu")}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="px-4 pb-6 pt-2">
          {MEMBER_NAV.filter((s) => s.href !== "/app").map((section) => {
            const items = section.children ?? [section];
            return (
              <section key={section.href} className="mb-5">
                <h3 className="mb-2 px-1 text-2xs font-bold uppercase tracking-wider text-ink-subtle">
                  {t(section.labelKey)}
                </h3>
                <ul className="grid grid-cols-2 gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    const danger = section.tone === "danger";
                    return (
                      <li key={`${section.href}-${item.href}`}>
                        <Link
                          href={item.href}
                          className={`flex h-full items-center gap-2.5 rounded-xl px-3 py-3 text-xsm font-medium transition ${
                            active
                              ? "bg-brand-tint text-brand-ink"
                              : danger
                                ? "bg-status-danger-bg text-status-danger-ink"
                                : "wc-inset text-ink-muted"
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                          <span className="min-w-0 leading-tight">{t(item.labelKey)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";

import { Brand } from "./Brand";
import { TransitionLink } from "./TransitionLink";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { MODES, itemForPath, modeForPath, type Mode } from "./nav";
import { SearchPalette, useSearchHotkey } from "./SearchPalette";

/**
 * The frame every signed-in screen sits in.
 *
 * Geometry measured off the supplied 1536x1024 boards rather than estimated:
 * sidebar 253, topbar 75, content column 900, gutter 25, right rail 320 — which
 * sums to exactly 1536. Those are held as fixed pixel values at the design
 * width and relax on smaller screens, because a layout that only works at one
 * viewport is a picture, not a page.
 */

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.75} />;
}

/**
 * The rail — the sections inside the mode she is in.
 *
 * It used to hold all eighteen destinations. Now it holds three or four, which
 * leaves room for a line of explanation under each one. That line is the point:
 * "Your business" and "Your applications" are not self-explanatory, and a rail
 * with space to say what something is beats a longer rail that cannot.
 */
export function ModeRail({
  mode,
  current,
  footer,
}: {
  mode: Mode | null;
  current: string | null;
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className="hidden h-full shrink-0 flex-col border-e lg:flex"
      style={{ width: 253, borderColor: "var(--ux-line)", background: "var(--ux-surface)",
               viewTransitionName: "ux-shell-nav" }}
    >
      {mode ? (
        <>
          <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.09em]"
             style={{ color: "var(--ux-faint)" }}>
            {mode.label}
          </p>
          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {mode.items.map((it) => {
              const on = it.href === current;
              return (
                <TransitionLink
                  key={it.href}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className="ux-nav ux-sq mb-1 flex items-start gap-3 rounded-[11px] px-3 py-2.5 transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{
                    background: on ? "var(--ux-brand-tint)" : "transparent",
                    color: on ? "var(--ux-brand)" : "var(--ux-ink)",
                  }}
                >
                  <Icon name={it.icon} className="ux-ico mt-[1px] h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]" style={{ fontWeight: on ? 600 : 500 }}>
                      {it.label}
                    </span>
                    {it.note && (
                      <span className="mt-0.5 block truncate text-[11px]"
                            style={{ color: on ? "var(--ux-brand)" : "var(--ux-muted)", opacity: on ? 0.8 : 1 }}>
                        {it.note}
                      </span>
                    )}
                  </span>
                  {it.badge && (
                    <span className="ux-pop shrink-0 rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
                          style={{ background: "var(--ux-brand-tint-2)", color: "var(--ux-brand)" }}>
                      {it.badge}
                    </span>
                  )}
                </TransitionLink>
              );
            })}
          </nav>
        </>
      ) : (
        /* Settings, Help and Safety are not modes, so nothing is highlighted —
           the rail offers a way back rather than pretending she is somewhere. */
        <nav className="flex-1 px-3 pt-5">
          <TransitionLink
            href="/app"
            className="ux-nav ux-sq mb-1 flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-[var(--ux-surface-2)]"
            style={{ color: "var(--ux-ink)" }}
          >
            <Icon name="ArrowLeft" className="ux-ico h-[18px] w-[18px] shrink-0" />
            Back to Home
          </TransitionLink>
        </nav>
      )}

      {footer && <div className="px-3 pb-4">{footer}</div>}
    </aside>
  );
}

/** One shape for every icon button up here, so they line up and hit the same size. */
function TopIconBtn({
  icon, label, href, onClick, badge, ink = "--ux-ink-2",
}: {
  icon: string; label: string; href?: string; onClick?: () => void; badge?: number; ink?: string;
}) {
  const inner = (
    <>
      <Icon name={icon} className="ux-ico h-[19px] w-[19px]" />
      {!!badge && (
        <span
          className="ux-ping absolute top-[3px] end-[3px] grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-semibold text-white"
          style={{ background: "var(--ux-brand-600)" }}
        >
          <span className="relative">{badge > 9 ? "9+" : badge}</span>
        </span>
      )}
    </>
  );
  const cls =
    "ux-press ux-hov ux-sq relative grid h-[42px] w-[42px] place-items-center rounded-[11px] transition-colors hover:bg-[var(--ux-surface-2)]";
  const style = { color: `var(${ink})` };
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls} style={style}>{inner}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls} style={style}>{inner}</button>
  );
}

/**
 * A mode tab.
 *
 * The underline is on the tab itself rather than a shared sliding indicator:
 * these are links, so a navigation can land here with a different one active
 * and there is no "previous" position to slide from.
 */
function ModeTab({ mode, on }: { mode: Mode; on: boolean }) {
  return (
    <TransitionLink
      href={mode.href}
      aria-current={on ? "page" : undefined}
      className="ux-hov ux-sq relative flex h-[75px] shrink-0 flex-col items-center justify-center gap-1 px-4 transition-colors"
      style={{ color: on ? "var(--ux-brand)" : "var(--ux-muted)" }}
    >
      <Icon name={mode.icon} className="ux-ico h-[19px] w-[19px]" />
      <span className="text-[11.5px]" style={{ fontWeight: on ? 600 : 500 }}>{mode.label}</span>
      <span
        aria-hidden
        className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full"
        style={{
          background: on ? "var(--ux-brand)" : "transparent",
          transition: "background var(--ux-t) var(--ux-ease)",
        }}
      />
    </TransitionLink>
  );
}

/** The topbar's height, in px. The content column slides under it by exactly this. */
const TOPBAR_H = 75;

export function Topbar({ user, mode }: { user: { name: string; avatar: string; unread?: number }; mode: Mode | null }) {
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();

  const openSearch = useCallback(() => setSearch(true), []);
  useSearchHotkey(openSearch);

  // Close the account menu on an outside click or Escape — a menu that only
  // closes by picking something in it traps her.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    /* ps/pe of 18 rather than 24: the content column below starts at 271 and the
       rail ends at 1518, and the topbar should share those edges.

       Absolute, not a flex row: laid over the scroller, the content passes
       beneath the glass and the blur has something to blur. In the column it
       would have taken its own band with nothing behind it. */
    <header
      className="ux-glass relative z-[60] flex shrink-0 items-center gap-4 ps-[18px] pe-[18px]"
      style={{ height: TOPBAR_H, borderRadius: 0, borderWidth: "0 0 1px 0", viewTransitionName: "ux-shell-top" }}
    >
      {/* Brand first, then the six modes. The rail no longer carries the
          wordmark: with a full-width bar above it, the brand belongs at the
          top-left corner of the whole app rather than above one column. */}
      <Brand size="sm" tagline={false} />

      <nav className="flex items-stretch" aria-label="Sections">
        {MODES.map((m) => <ModeTab key={m.id} mode={m} on={mode?.id === m.id} />)}
      </nav>

      <div className="ms-auto flex min-w-0 max-w-[300px] flex-1 justify-end">
        <div className="w-full">
        {/* A button, not an input: typing happens in the palette, which has the
            results, the keyboard handling and somewhere to put focus. */}
        <button
          type="button"
          onClick={openSearch}
          className="ux-hov ux-sq flex h-[42px] w-full items-center gap-2.5 rounded-[11px] border px-3.5 text-start transition-colors hover:border-[var(--ux-brand)]"
          style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface-2)" }}
        >
          <Icons.Search className="ux-ico h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Search…
          </span>
          <kbd
            className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
            style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}
          >
            ⌘ K
          </kbd>
        </button>
        </div>
      </div>

      <div className="relative flex items-center gap-1">
        <TopIconBtn icon="Sparkles" label="Ask Sakhi" href="/app/sakhi" ink="--ux-brand" />
        <TopIconBtn icon="MessageCircle" label="Messages" href="/app/messages" />
        <TopIconBtn icon="Bell" label="Notifications" href="/app/notifications" badge={user.unread} />

        <div ref={menuRef} className="relative ms-2">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="ux-press flex items-center gap-2.5 rounded-[10px] py-1 pe-2 ps-1 transition-colors hover:bg-[var(--ux-surface-2)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatar} alt="" className="h-[38px] w-[38px] rounded-full object-cover" />
            <span className="text-[13.5px] font-medium" style={{ color: "var(--ux-ink)" }}>
              Hi, {user.name}
            </span>
            <Icons.ChevronDown
              className="h-4 w-4 transition-transform"
              style={{ color: "var(--ux-muted)", transform: menu ? "rotate(180deg)" : "none" }}
            />
          </button>

          {menu && (
            <div
              role="menu"
              className="ux-sheet ux-slide-up absolute end-0 top-[calc(100%+8px)] w-[238px] overflow-hidden rounded-[16px] p-1.5"
            >
              {[
                { label: "My profile", icon: "User", href: "/app/profile" },
                { label: "My certificates", icon: "Award", href: "/app/certificates" },
                { label: "Wallet & earnings", icon: "Wallet", href: "/app/wallet" },
                { label: "Settings", icon: "Settings", href: "/app/settings" },
                { label: "Help & support", icon: "LifeBuoy", href: "/app/help" },
              ].map((it) => (
                <Link
                  key={it.label}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setMenu(false)}
                  className="ux-hov flex items-center gap-3 rounded-[9px] px-2.5 py-2 text-[13px] transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{ color: "var(--ux-ink)" }}
                >
                  <Icon name={it.icon} className="ux-ico h-[16px] w-[16px]" />
                  {it.label}
                </Link>
              ))}

              <div className="my-1.5 h-px" style={{ background: "var(--ux-line)" }} />

              <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                 style={{ color: "var(--ux-faint)" }}>
                Appearance
              </p>
              <div className="mb-1 flex gap-1 rounded-[10px] p-1" style={{ background: "var(--ux-surface-2)" }}>
                {([
                  ["light", "Sun", "Light"],
                  ["dark", "Moon", "Dark"],
                  ["system", "Monitor", "Auto"],
                ] as const).map(([t, ic, label]) => {
                  const on = theme === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      aria-pressed={on}
                      className="ux-hov ux-press flex flex-1 items-center justify-center gap-1.5 rounded-[7px] py-[6px] text-[11.5px] font-medium transition-colors"
                      style={{
                        background: on ? "var(--ux-surface)" : "transparent",
                        color: on ? "var(--ux-brand)" : "var(--ux-muted)",
                        boxShadow: on ? "var(--ux-shadow-card)" : "none",
                      }}
                    >
                      <Icon name={ic} className="ux-ico h-[14px] w-[14px]" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="my-1.5 h-px" style={{ background: "var(--ux-line)" }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenu(false); void signOut(); }}
                className="ux-hov flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-start text-[13px] transition-colors hover:bg-[var(--ux-surface-2)]"
                style={{ color: "var(--ux-pink-ink)" }}
              >
                <Icon name="LogOut" className="ux-ico h-[16px] w-[16px]" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <SearchPalette open={search} onClose={() => setSearch(false)} />
    </header>
  );
}

/**
 * The app shell.
 *
 * The page itself does not scroll — the content column does. That is what keeps
 * the nav and the topbar in place without `position: sticky` on either, and it
 * fixes the thing sticky could not: a pinned sidebar is only as tall as the
 * viewport, so on a 1450px page the canvas showed through below it.
 *
 * One consequence worth knowing: `document.documentElement.scrollHeight` is now
 * the viewport height. Anything measuring the page measures `#ux-scroll`.
 */
/**
 * The app shell.
 *
 * The mode and the current rail item are derived from the URL rather than
 * passed in. Every screen already knows its own route, so asking each of them
 * to also declare where it sits in the navigation is a second source of truth
 * that drifts — and a screen highlighting the wrong section is a screen that
 * lies about where you are.
 */
export function Shell({
  sidebarFooter,
  user,
  children,
  rail,
}: {
  /** Accepted and ignored — kept so callers need not all change at once. */
  nav?: unknown;
  active?: string;
  sidebarFooter?: React.ReactNode;
  user: { name: string; avatar: string; unread?: number };
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  const pathname = usePathname();
  const mode = modeForPath(pathname);
  const current = mode ? itemForPath(mode, pathname) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--ux-canvas)" }}>
      <Topbar user={user} mode={mode} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ModeRail mode={mode} current={current} footer={sidebarFooter} />

        {/*
          * The content column starts ABOVE this row, under the topbar.
          *
          * Everything else in the shell sits below the topbar, which meant the
          * glass on it had nothing to blur: `backdrop-filter` blurs what is
          * painted behind an element, and behind it was a flat canvas colour.
          * Pulling this one column up by the topbar's height puts real content
          * under the glass, while the rail stays where it was.
          *
          * The height gains the same 75px so the column still reaches the
          * bottom of the viewport, and the scroller's top padding keeps the
          * first card clear of the bar it now passes under.
          */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
             style={{ marginTop: -TOPBAR_H, height: `calc(100% + ${TOPBAR_H}px)` }}>
          <div id="ux-scroll" className="min-h-0 flex-1 overflow-y-auto">
            {/* pb-24: Sakhi floats over the bottom-right corner, so the last card
                in the rail would otherwise sit underneath her. */}
            <div className="flex min-w-0 gap-[25px] px-[18px] pb-24"
                 style={{ paddingTop: TOPBAR_H + 18 }}>
              <main id="content" className="min-w-0 flex-1" style={{ viewTransitionName: "ux-main" }}>
                {children}
              </main>
              {rail && (
                <div className="hidden w-[320px] shrink-0 xl:block" style={{ viewTransitionName: "ux-rail" }}>
                  {rail}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

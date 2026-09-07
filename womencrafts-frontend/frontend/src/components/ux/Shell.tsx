"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Brand } from "./Brand";
import { TransitionLink } from "./TransitionLink";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMe } from "./me";
import { MODES, itemForPath, modeForPath, type Mode } from "./nav";
import { Avatar } from "./kit";
import { useSearchHotkey } from "./useSearchHotkey";
import { MobileNav, ModeChips, SafetyPin } from "./MobileNav";

/**
 * The search panel is a ⌘K surface — most sessions never open it, and it drags
 * ~57 KB of markup, scope logic and result rendering behind it. Loading that
 * into the first bundle of every signed-in screen bought nothing, so it is
 * fetched the first time she actually asks for it.
 *
 * Two things this arrangement has to keep true, both of which have broken here
 * before:
 *
 *  1. The key that opens it is listened for by `useSearchHotkey`, imported
 *     above from its own always-loaded file. Move that listener into the lazy
 *     chunk and ⌘K stops working, because nothing would ever fetch the chunk.
 *
 *  2. It is mounted only while `search` is true. `next/dynamic` starts the
 *     download when the component first renders, not when a prop flips — so
 *     rendering it unconditionally with `open={false}` would pull the chunk on
 *     every page load and undo the whole point.
 *
 * `ssr: false` because the panel is a portal onto `<body>` that reads
 * `localStorage` and the live theme; there is nothing useful to prerender, and
 * skipping it keeps the payload off the server render too.
 */
const SearchPalette = dynamic(() => import("./SearchPalette"), {
  ssr: false,
  loading: () => null,
});

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
/**
 * The six shortcuts above the section rail.
 *
 * **The labels are looked up from the navigation, not typed here.** They used
 * to be their own list and it drifted twice over: this strip said "My Shop"
 * while the rail below said "Your shop", and "Buy from women" for the screen
 * the rail called "The market" — one page showing a woman two names for one
 * thing. Worse, "Savings Pot" and "My Circles" both pointed at `/app/circles`,
 * so two of six shortcuts went to the same screen.
 *
 * Only the href and the tint are decided here. Everything she reads comes from
 * `nav.ts`, which means a rename there reaches this strip with nothing to
 * remember — the same rule the Home grid already follows.
 */
const QUICK_HREFS: { href: string; icon: string; tint: string; ink: string }[] = [
  { href: "/app/circles",       icon: "UsersRound",     tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  { href: "/app/documents",     icon: "Store",          tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  { href: "/app/market",        icon: "ShoppingBasket", tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { href: "/app/wallet",        icon: "Wallet",         tint: "--ux-tint-lilac",  ink: "--ux-violet-ink" },
  { href: "/app/opportunities", icon: "Search",         tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  { href: "/app/sakhi",         icon: "Sparkles",       tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
];

const QUICK_LINKS = QUICK_HREFS.map((q) => {
  const item = MODES.flatMap((m) => [...m.items, ...(m.findable ?? [])]).find((i) => i.href === q.href);
  // Sakhi is reached from the top bar rather than a rail slot, so it has no
  // nav entry to read a label from.
  return { ...q, label: item?.label ?? "Ask Sakhi" };
});

const MODULE_TINT = ["--ux-tint-violet", "--ux-tint-green", "--ux-tint-amber", "--ux-tint-blue", "--ux-tint-pink"] as const;
const MODULE_INK  = ["--ux-violet-ink", "--ux-green-ink", "--ux-amber-ink", "--ux-blue-ink", "--ux-pink-ink"] as const;

/**
 * The side menu, built to the approved design.
 *
 * Four blocks, in the design's order: the brand, Dashboard on its own, a
 * Circle Quick Access list, and All Modules lettered A–E. Then her profile
 * card and the quote at the foot.
 *
 * ── Why the module rows expand ──────────────────────────────────────────────
 * The design draws each module as a single row with a chevron. Rendered
 * literally that would have been a navigation regression: this app has 71
 * screens, and the sub-pages under Earn, Learn and Community had no other way
 * in on a laptop once the topbar tabs were removed. So the chevron does what a
 * chevron promises — the module she is inside opens and lists its screens.
 * Closed, it is the design exactly; open, it still is, and nothing is
 * unreachable.
 */
/**
 * The side rail.
 *
 * LinkedIn and Facebook both run a top bar *and* a left rail, and they do not
 * repeat themselves: the bar is where you are in the product, the rail is you
 * and your shortcuts. So the sections live up top, and this column carries her
 * identity card, the six places she goes most, and the screens inside whatever
 * section is currently open. Nothing appears in both.
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
  const me = useMe();

  return (
    <aside
      className="hidden h-full shrink-0 flex-col overflow-y-auto border-e lg:flex"
      style={{ width: 253, borderColor: "var(--ux-line)", background: "var(--ux-surface)",
               viewTransitionName: "ux-shell-nav" }}
    >
      {/* Her card. A cover strip, the avatar breaking across it, then the one
          number worth acting on. */}
      <div className="p-3">
        <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--ux-line)" }}>
          <div className="h-[54px]" style={{ background: "linear-gradient(96deg, var(--ux-brand-900), var(--ux-fill) 60%, var(--ux-rib-3))" }} />
          <div className="px-3 pb-3">
            <div className="-mt-[24px] w-fit rounded-full" style={{ border: "3px solid var(--ux-surface)" }}>
              <Avatar src={me.avatar} name={me.first || "You"} size={52} />
            </div>
            <p className="mt-2 truncate text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>{me.first}</p>
            <p className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>Member</p>

            <TransitionLink href="/app/profile"
                            className="ux-row mt-3 block rounded-[12px] p-2"
                            style={{ background: "var(--ux-surface-2)" }}>
              <span className="flex items-baseline justify-between">
                <span className="text-[0.6875rem] font-semibold" style={{ color: "var(--ux-muted)" }}>Profile</span>
                <span className="text-[0.75rem] font-bold" style={{ color: "var(--ux-brand)" }}>{me.profilePct}%</span>
              </span>
              <span className="mt-1.5 block h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
                <span className="block h-full rounded-full"
                      style={{ width: `${me.profilePct}%`,
                               background: "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))",
                               transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
              </span>
            </TransitionLink>
          </div>
        </div>
      </div>

      <p className="px-5 pb-2 pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em]"
         style={{ color: "var(--ux-faint)" }}>
        Quick Access
      </p>
      <nav className="px-3">
        {QUICK_LINKS.map((q) => (
          <TransitionLink
            key={q.label}
            href={q.href}
            className="ux-row ux-sq mb-0.5 flex items-center gap-3 rounded-[12px] px-2.5 py-2 text-[0.875rem] font-medium"
            style={{ color: "var(--ux-ink)" }}
          >
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px]"
                  style={{ background: `var(${q.tint})`, color: `var(${q.ink})` }}>
              <Icon name={q.icon} className="ux-ico h-[14px] w-[14px]" />
            </span>
            {q.label}
          </TransitionLink>
        ))}
      </nav>

      {/* The screens inside the section the top bar has highlighted. This is
          the half of navigation a single row of tabs cannot hold. */}
      {mode && (
        <>
          <p className="px-5 pb-2 pt-5 text-[0.6875rem] font-bold uppercase tracking-[0.16em]"
             style={{ color: "var(--ux-faint)" }}>
            In {mode.label}
          </p>
          <nav className="px-3 pb-3">
            {mode.items.map((it) => {
              const on = it.href === current;
              return (
                <TransitionLink
                  key={it.href}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className="ux-row ux-sq mb-0.5 flex items-start gap-3 rounded-[12px] px-2.5 py-2"
                  style={{ background: on ? "var(--ux-brand-tint)" : "transparent",
                           color: on ? "var(--ux-brand)" : "var(--ux-ink)" }}
                >
                  <Icon name={it.icon} className="ux-ico mt-[1px] h-[16px] w-[16px] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem]" style={{ fontWeight: on ? 600 : 500 }}>
                      {it.label}
                    </span>
                    {it.note && (
                      <span className="mt-0.5 block truncate text-[0.6875rem]"
                            style={{ color: on ? "var(--ux-brand)" : "var(--ux-muted)", opacity: on ? 0.8 : 1 }}>
                        {it.note}
                      </span>
                    )}
                  </span>
                  {it.badge && (
                    <span className="shrink-0 rounded-full px-2 py-[2px] text-[0.6875rem] font-semibold"
                          style={{ background: "var(--ux-brand-tint-2)", color: "var(--ux-brand)" }}>
                      {it.badge}
                    </span>
                  )}
                </TransitionLink>
              );
            })}
          </nav>
        </>
      )}

      <div className="mt-auto px-3 pb-4">
        <div className="overflow-hidden rounded-[12px] p-3.5"
             style={{ background: "linear-gradient(150deg, var(--ux-brand-900), var(--ux-fill))" }}>
          <p className="text-[0.8125rem] font-extrabold leading-snug" style={{ color: "var(--ux-on-brand)" }}>
            You are stronger than you think.
          </p>
          <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--ux-on-brand-2)" }}>
            Keep growing, keep glowing.
          </p>
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
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
          className="ux-ping absolute top-[3px] end-[3px] grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[0.6875rem] font-semibold text-white"
          style={{ background: "var(--ux-brand-600)" }}
        >
          <span className="relative">{badge > 9 ? "9+" : badge}</span>
        </span>
      )}
    </>
  );
  const cls =
    "ux-press ux-hov ux-sq relative grid h-[42px] w-[42px] place-items-center rounded-[12px] transition-colors hover:bg-[var(--ux-surface-2)]";
  const style = { color: `var(${ink})` };
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls} style={style}>{inner}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls} style={style}>{inner}</button>
  );
}

/**
 * The light/dark switch from the design.
 *
 * The icon shows what pressing it *gives you*, not what you are currently in —
 * a sun while dark, a moon while light — because a control is named for its
 * outcome. Rendered only after mount: the server has no way to know which
 * theme this browser resolved, and drawing the wrong glyph for one frame is a
 * hydration mismatch on every page in the app.
 */
function ThemeToggle() {
  const { toggle } = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return (
    <TopIconBtn
      icon={dark ? "Sun" : "Moon"}
      label={dark ? "Switch to light" : "Switch to dark"}
      onClick={toggle}
    />
  );
}

/**
 * A mode tab.
 *
 * The underline is on the tab itself rather than a shared sliding indicator:
 * these are links, so a navigation can land here with a different one active
 * and there is no "previous" position to slide from.
 */
/**
 * A section in the top bar, and the screens under it.
 *
 * Moving navigation out of the rail cost the sub-pages their home: the rail
 * could list five modules *and* the screens inside the open one at the same
 * time, and a single row of tabs cannot. So each tab carries its own menu.
 * Without it, "Your applications", "Certificates" and twenty more would be
 * reachable only by whatever happened to link to them.
 *
 * It opens on hover on a mouse and on click everywhere, because hover alone is
 * unusable with a keyboard, a screen reader or a finger. The close is delayed
 * ~180ms so that travelling diagonally from the tab down to the menu does not
 * pass over a gap and dismiss it — the classic reason menus like this feel
 * broken.
 */
/**
 * A section in the top bar.
 *
 * Icon over label with an underline, the way LinkedIn and Facebook mark the
 * area you are in. It is a plain link, not a menu: the side rail beside it
 * lists the screens inside whichever section is open, so a dropdown here
 * would be the same list twice — and two ways to reach one place is how a
 * navigation stops being learnable.
 */
function ModeTab({ mode, on }: { mode: Mode; on: boolean }) {
  return (
    <TransitionLink
      href={mode.href}
      aria-current={on ? "page" : undefined}
      className="ux-hov ux-sq relative flex h-[62px] w-[82px] shrink-0 flex-col items-center justify-center gap-1 transition-colors"
      style={{ color: on ? "var(--ux-ink)" : "var(--ux-muted)" }}
    >
      <Icon name={mode.icon} className="ux-ico h-[20px] w-[20px]" />
      <span className="text-[0.75rem]" style={{ fontWeight: on ? 600 : 500 }}>{mode.label}</span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full"
            style={{ background: on ? "var(--ux-ink)" : "transparent",
                     transition: "background var(--ux-t) var(--ux-ease)" }} />
    </TransitionLink>
  );
}

/**
 * Read from CSS, not fixed in JS.
 *
 * The bar is two rows on a laptop and one on a phone, and the content column
 * slides under it by exactly its height. A single constant would have left an
 * 46px band of dead space above every phone screen.
 */
const TOPBAR_H_VAR = "var(--ux-topbar-h)";

export function Topbar({ user, mode, current }: { user: { name: string; avatar: string; unread?: number }; mode: Mode | null; current: string | null }) {
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
      className="ux-glass relative z-[60] flex shrink-0 flex-col"
      style={{ height: TOPBAR_H_VAR, borderRadius: 0, borderWidth: "0 0 1px 0", viewTransitionName: "ux-shell-top" }}
    >
      <div className="flex flex-1 items-center gap-3 ps-[18px] pe-[18px]">
      {/* Brand first, then the six modes. The rail no longer carries the
          wordmark: with a full-width bar above it, the brand belongs at the
          top-left corner of the whole app rather than above one column. */}
      <Brand size="sm" tagline={false} />

      {/* `lg:` only. Five tabs plus their chevrons need ~560px; below that the
          phone gets `MobileNav`, which carries the whole map. */}
      <nav className="ms-2 hidden items-center gap-0.5 lg:flex" aria-label="Sections">
        {MODES.map((m) => <ModeTab key={m.id} mode={m} on={mode?.id === m.id} />)}
      </nav>

      {/* The full search box needs ~300px. On a phone it is an icon, and the
          palette it opens is the same palette. */}
      <div className="ms-auto hidden min-w-0 max-w-[300px] flex-1 justify-end sm:flex">
        <div className="w-full">
        {/* A button, not an input: typing happens in the palette, which has the
            results, the keyboard handling and somewhere to put focus. */}
        <button
          type="button"
          onClick={openSearch}
          className="ux-hov ux-sq flex h-[42px] w-full items-center gap-2.5 rounded-[12px] border px-3.5 text-start transition-colors hover:border-[var(--ux-brand)]"
          style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface-2)" }}
        >
          <Icons.Search className="ux-ico h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            Search…
          </span>
          <kbd
            className="shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium"
            style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}
          >
            ⌘ K
          </kbd>
        </button>
        </div>
      </div>

      <div className="relative ms-auto flex items-center gap-1 sm:ms-0">
        {/* Phone only: the box above is hidden there, and search is the one
            thing a person looks for at the top of a screen. */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search"
          className="ux-press ux-sq grid h-[40px] w-[40px] place-items-center rounded-[12px] sm:hidden"
          style={{ color: "var(--ux-ink-2)" }}
        >
          <Icons.Search className="h-[19px] w-[19px]" strokeWidth={2} />
        </button>
        {/* Sakhi has a floating launcher of her own on every screen, so this
            duplicate goes on a phone where the row has no room for it. */}
        <span className="hidden sm:contents">
          <ThemeToggle />
          <TopIconBtn icon="Sparkles" label="Ask Sakhi" href="/app/sakhi" ink="--ux-brand" />
        </span>
        <TopIconBtn icon="MessageCircle" label="Messages" href="/app/messages" />
        <TopIconBtn icon="Bell" label="Notifications" href="/app/notifications" badge={user.unread} />

        <div ref={menuRef} className="relative ms-2">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="ux-press flex items-center gap-2.5 rounded-[12px] py-1 pe-2 ps-1 transition-colors hover:bg-[var(--ux-surface-2)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Avatar src={user.avatar} name={user.name || "You"} size={38} />
            {/* Cut to "Hi, Priy…" at 390px. The avatar identifies the menu
                perfectly well; the greeting is a nicety with room only on a
                laptop. */}
            <span className="hidden text-[0.875rem] font-medium lg:inline" style={{ color: "var(--ux-ink)" }}>
              Hi, {user.name}
            </span>
            <Icons.ChevronDown
              className="hidden h-4 w-4 transition-transform lg:block"
              style={{ color: "var(--ux-muted)", transform: menu ? "rotate(180deg)" : "none" }}
            />
          </button>

          {menu && (
            <div
              role="menu"
              className="ux-sheet ux-slide-up absolute end-0 top-[calc(100%+8px)] w-[238px] overflow-hidden rounded-[16px] p-1.5"
            >
              {[
                // Hers, not the app's. "My certificates" and "Wallet &
                // earnings" were here AND in the navigation under different
                // names — the same destination offered twice, called two
                // things, which is the confusion this menu should relieve.
                // What is left is the personal admin that has no place in a
                // daily navigation bar.
                { label: "Your profile", icon: "User", href: "/app/profile" },
                { label: "Your journey", icon: "Route", href: "/app/journey" },
                { label: "Notifications", icon: "Bell", href: "/app/notifications" },
                { label: "Saved", icon: "Bookmark", href: "/app/saved" },
                { label: "Settings", icon: "Settings", href: "/app/settings" },
                { label: "Questions", icon: "HelpCircle", href: "/app/help" },
                { label: "Refer a friend", icon: "Gift", href: "/app/refer" },
              ].map((it) => (
                <Link
                  key={it.label}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setMenu(false)}
                  className="ux-hov flex items-center gap-3 rounded-[8px] px-2.5 py-2 text-[0.8125rem] transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{ color: "var(--ux-ink)" }}
                >
                  <Icon name={it.icon} className="ux-ico h-[16px] w-[16px]" />
                  {it.label}
                </Link>
              ))}

              <div className="my-1.5 h-px" style={{ background: "var(--ux-line)" }} />

              <p className="px-2.5 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em]"
                 style={{ color: "var(--ux-faint)" }}>
                Appearance
              </p>
              <div className="mb-1 flex gap-1 rounded-[12px] p-1" style={{ background: "var(--ux-surface-2)" }}>
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
                      className="ux-hov ux-press flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[8px] text-[0.75rem] font-medium transition-colors"
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
                className="ux-hov flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-start text-[0.8125rem] transition-colors hover:bg-[var(--ux-surface-2)]"
                style={{ color: "var(--ux-pink-ink)" }}
              >
                <Icon name="LogOut" className="ux-ico h-[16px] w-[16px]" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {search && <SearchPalette open onClose={() => setSearch(false)} />}
      </div>
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
  wide,
}: {
  /** Accepted and ignored — kept so callers need not all change at once. */
  nav?: unknown;
  active?: string;
  sidebarFooter?: React.ReactNode;
  user: { name: string; avatar: string; unread?: number };
  children: React.ReactNode;
  rail?: React.ReactNode;
  /**
   * Drop the side rail and give the screen the whole width.
   *
   * For screens that are themselves made of columns — Messages is an inbox, a
   * conversation and a person — the rail is a fourth column competing with
   * three that carry content. Squeezed beside it the conversation fell to
   * ~600px and every bubble wrapped twice. Navigation is not lost: the top bar
   * still carries all five sections, and the section's own screens are one tap
   * away in its menu.
   */
  wide?: boolean;
}) {
  const pathname = usePathname();
  const mode = modeForPath(pathname);
  const current = mode ? itemForPath(mode, pathname) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--ux-canvas)" }}>
      <Topbar user={user} mode={mode} current={current} />

      {/* Below `lg`: a bottom bar of five and a sheet with everything else. */}
      <MobileNav />
      <SafetyPin />

      <div className="flex min-h-0 flex-1 overflow-hidden">

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
        {!wide && <ModeRail mode={mode} current={current} footer={sidebarFooter} />}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
             style={{ marginTop: `calc(${TOPBAR_H_VAR} * -1)`, height: `calc(100% + ${TOPBAR_H_VAR})` }}>
          <div id="ux-scroll" className="min-h-0 flex-1 overflow-y-auto">
            {/* pb-24: Sakhi floats over the bottom-right corner, so the last card
                in the rail would otherwise sit underneath her. */}
            {/* pb: the floating assistant on a laptop, and on a phone the
                bottom bar as well — 56px of bar plus the home indicator. */}
            {/*
              A `wide` screen keeps its own bottom clearance.

              The 96px below is kept clear so the floating assistant never sits
              on the last card of an ordinary, scrolling page. A full-height
              screen like Messages does not scroll, so that padding was simply
              96px of viewport it could never reach — the panels stopped short
              of the bottom of the window.
            */}
            <div className={`flex min-w-0 gap-[24px] px-[20px] ${
                   wide ? "pb-[20px]" : "pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-24"}`}
                 style={{ paddingTop: `calc(${TOPBAR_H_VAR} + 18px)` }}>
              <main id="content" className="min-w-0 flex-1" style={{ viewTransitionName: "ux-main" }}>
                {/* The rail carrying these is `hidden lg:flex`, so on a phone
                    every sub-page — Your journey, Your calendar, Saved — was
                    reachable only by whatever happened to link to it. */}
                <ModeChips />
                {children}
              </main>
              {rail && (
                <div className="hidden w-[320px] shrink-0 pb-24 xl:block" style={{ viewTransitionName: "ux-rail" }}>
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

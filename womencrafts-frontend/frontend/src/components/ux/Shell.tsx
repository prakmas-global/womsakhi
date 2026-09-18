"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Brand } from "./Brand";
import { TransitionLink } from "./TransitionLink";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useMe } from "./me";
import { useNavLabel } from "./use-nav-label";
import { SECTIONS, TABS, isTabRoot, trailFor, type NavNode, type Section } from "./nav-tree";
import { Avatar } from "./kit";
import { useSearchHotkey } from "./useSearchHotkey";
import { MobileNav, SafetyPin } from "./MobileNav";
import { PageTransition } from "./mobile/PageTransition";
import { MobileBack } from "./mobile/BackButton";

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

function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.75} style={style} />;
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
/**
 * One section of the rail, and its children.
 *
 * Split out and memoised because opening a section changes one boolean and
 * used to re-render all 109 nodes of the tree — 71ms of held main thread on
 * the click, which is three frames the fold never got, and the same cost
 * again on every route change when the rail re-syncs. Only the section
 * closing and the section opening take new props now.
 *
 * Every prop is a primitive or a stable identity for that reason. `trailKey`
 * is the path through the tree flattened to a string rather than the array
 * itself, which would be a new object each render and would defeat the memo
 * silently — the component would still be correct, just never skipped.
 */
const RailSection = memo(function RailSection({
  s, isOpen, onHub, trailKey, label, onOpen,
}: {
  s: Section;
  isOpen: boolean;
  onHub: boolean;
  trailKey: string;
  label: (n: Pick<NavNode, "label" | "k">) => string;
  onOpen: (id: string, href: string) => void;
}) {
  const kids = (s.children ?? []).filter((c) => !c.unlisted);
  const onPath = useMemo(() => new Set(trailKey.split("/")), [trailKey]);

  return (
    <div className="mb-0.5">
      <TransitionLink
        href={s.href}
        /**
         * Fold first, navigate on the next frame.
         *
         * Started inside this handler, the push held the main thread and the
         * fold's opening frames went to the router instead of to the panel.
         * One frame of delay on the navigation buys the animation its start,
         * and 16ms is not perceivable.
         *
         * That delay is also what lets the state change stay an ordinary
         * update. It was wrapped in `flushSync`, because while the push
         * happened in this same handler React batched it into the
         * navigation's transition and the section sat there open for another
         * 120ms — but the flush cost 71ms of its own, the same delay moved one
         * step earlier. With the push on the next frame there is no
         * transition to be batched into, and this paints on its own: 2ms.
         *
         * Modified clicks fall through to the <Link> untouched, so
         * open-in-new-tab still works.
         */
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(s.id, s.href);
        }}
        aria-current={onHub ? "page" : undefined}
        aria-expanded={kids.length ? isOpen : undefined}
        /* `ux-hov` so the section's icon leans into the hover the way the
           topbar's bell does — the app has one gesture for "this responds to
           you" and the rail was the only surface not speaking it. */
        className="ux-row ux-hov ux-sq relative flex items-center gap-3 rounded-[12px] py-2 pe-2 ps-2.5"
        style={{ background: onHub ? "var(--ux-brand-tint)" : "transparent",
                 color: isOpen ? "var(--ux-brand)" : "var(--ux-ink)" }}
      >
        {/* The bar that says "you are in here" — the one signal that survives
            at a glance, and the thing 95% of sites get wrong according to
            Baymard's 2025 benchmark. */}
        <span aria-hidden
              className="absolute inset-y-1.5 start-0 w-[3px] rounded-full"
              style={{ background: isOpen ? "var(--ux-brand)" : "transparent",
                       transition: "background var(--ux-t) var(--ux-ease)" }} />
        <Icon name={s.icon} className="ux-ico h-[16px] w-[16px] shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xsm"
              style={{ fontWeight: isOpen ? 700 : 500 }}>
          {label(s)}
        </span>
        {kids.length > 0 && (
          <Icon name="ChevronDown"
                className="ux-ico h-[14px] w-[14px] shrink-0"
                // Turned rather than swapped, so the eye follows one shape
                // instead of noticing two.
                style={{ opacity: isOpen ? 1 : 0.45,
                         transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                         transition: "transform 360ms cubic-bezier(0.42, 0, 0.58, 1), opacity var(--ux-t) var(--ux-ease)" }} />
        )}
      </TransitionLink>

      {kids.length > 0 && (
        <div className="ux-reveal" data-open={isOpen ? "true" : "false"}>
          <div>
            <div className="ux-branch mb-1 ms-[18px] mt-0.5">
              {kids.map((c) => {
                const on = onPath.has(c.id);
                return (
                  <TransitionLink
                    key={c.id}
                    href={c.href}
                    tabIndex={isOpen ? undefined : -1}
                    aria-current={on ? "page" : undefined}
                    data-on={on ? "true" : "false"}
                    className="ux-twig ux-row ux-sq relative mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5"
                    style={{ background: on ? "var(--ux-brand-tint)" : "transparent",
                             color: on ? "var(--ux-brand)" : "var(--ux-ink-2)" }}
                  >
                    <Icon name={c.icon} className="ux-ico h-[14px] w-[14px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-2xs"
                          style={{ fontWeight: on ? 700 : 500 }}>
                      {label(c)}
                    </span>
                  </TransitionLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function ModeRail({ path, footer }: { path: string; footer?: React.ReactNode }) {
  const me = useMe();
  const nav = useNavLabel();
  const trail = trailFor(path);
  const here = trail[0]?.id;
  const list = useRef<HTMLElement | null>(null);
  const router = useRouter();

  /**
   * Which section is open — held here, not read from the URL.
   *
   * It used to be `s.id === trailFor(path)[0]?.id`, so a section could not
   * begin closing until the route had committed. That is the wrong moment:
   * by then the new page's own render is landing in the same frame, and the
   * two panels swapped in one step with no motion at all — measured, 309px to
   * 0px between consecutive samples.
   *
   * Set on the click instead. The panel she just left starts folding away in
   * the same interaction as the press, while the navigation gets on with
   * itself underneath, and the two are no longer in each other's way.
   */
  const [open, setOpen] = useState<string | undefined>(here);
  useEffect(() => { setOpen(here); }, [here]);

  const trailKey = trail.map((t) => t.id).join("/");
  const openSection = useCallback((id: string, href: string) => {
    setOpen(id);
    requestAnimationFrame(() => router.push(href));
  }, [router]);

  /**
   * Keep the row she is on where she can see it.
   *
   * The rail opens one section and shuts the rest, so every cross-section
   * navigation changes the list's height — measured, between 431px and 584px
   * on the same screen. On a 720px-tall laptop that is enough to carry the row
   * she just picked below the fold, and the only clue would have been a rail
   * that appeared to have jumped.
   *
   * Two passes, because the panel grows over `--ux-t-slow` rather than
   * instantly: one now for the case where the layout is already settled, one
   * after the reveal has finished for the case where it is not. Both are
   * no-ops when the row is already comfortably inside the frame, which is the
   * common case — a correction that fires when nothing is wrong is itself a
   * thing that moves.
   */
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const settle = () => {
      const row = el.querySelector<HTMLElement>('[aria-current="page"]');
      if (!row) return;
      const r = row.getBoundingClientRect();
      const f = el.getBoundingClientRect();
      const pad = 12;
      const d = r.top < f.top + pad ? r.top - f.top - pad
              : r.bottom > f.bottom - pad ? r.bottom - f.bottom + pad
              : 0;
      if (!d) return;
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollBy({ top: d, behavior: still ? "auto" : "smooth" });
    };
    settle();
    const t = setTimeout(settle, 360);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <aside
      className="hidden h-full shrink-0 flex-col overflow-hidden border-e lg:flex"
      // No `view-transition-name`, deliberately. It had one, and that is
      // precisely what stopped the accordion from ever animating: a named
      // element is captured as a still image for the length of the
      // transition, so the one moment the panel had to fold away was the one
      // moment the rail was a photograph. The shell stays put by actually
      // staying mounted, which `checks/nav-persist.mjs` measures.
      //
      // `overflow-hidden`, not `auto`: the rail is a frame now, and the list
      // inside it is what scrolls. When the whole column scrolled, opening a
      // long section pushed her profile card up and the "Complete your
      // profile" panel clean off the bottom — measured 177px past the fold on
      // Help at 720px. Neither of those moves now, whatever the list does.
      //
      // 18px of padding, not a topbar's worth. The header above is a flex row
      // that takes its own band, so the rail already starts beneath it; the
      // extra `calc(topbar + 12px)` was a second clearance for a bar that was
      // no longer overlapping, and it left 56px of empty rail above her photo
      // while the first card in the page began at 80px. They start level now.
      style={{ width: 253, borderColor: "var(--ux-line)", background: "var(--ux-surface)",
               paddingTop: 18 }}
    >
      {/* Her, and how far through setting herself up she is. */}
      <TransitionLink href="/app/profile"
        className="ux-sq mx-3 mb-4 block shrink-0 overflow-hidden rounded-[16px]"
        style={{ border: "1px solid var(--ux-line)" }}>
        <span className="block h-[52px]"
              /*
                The fill pair, not the brand pair.

                This was `--ux-brand-700` to `--ux-brand`, and in dark mode
                those are TEXT colours: they have to be light and high-chroma
                to read on a dark ground. Used as a fill they made this slab a
                hot pink bar across the top of the rail, the loudest thing on a
                deliberately quiet screen. `--ux-fill` / `--ux-fill-2` are the
                tokens for a filled surface that carries white — Berry to
                Primary Light, the same in both themes.
              */
              style={{ background: "linear-gradient(120deg, var(--ux-fill), var(--ux-fill-2))" }} />
        <span className="block px-3.5 pb-3.5">
          <span className="-mt-6 block h-[46px] w-[46px] overflow-hidden rounded-full"
                style={{ border: "3px solid var(--ux-surface)", background: "var(--ux-brand-tint-2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {me.avatar && <img src={me.avatar} alt="" aria-hidden className="h-full w-full object-cover" />}
          </span>
          <b className="mt-2 block text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{me.name}</b>
          <span className="mt-0.5 block text-2xs" style={{ color: "var(--ux-muted)" }}>
            {me.verified ? "Verified member" : "Member"}
          </span>
        </span>
      </TransitionLink>

      {/*
        The whole map, two levels deep and never three.

        This used to be a "Quick Access" list of six shortcuts followed by the
        current section's items — and four of those shortcuts were also items,
        so the same link was drawn twice in the same 253px column. There is one
        list now: every section, with the one she is in opened.

        Two levels is a hard rule, not a preference. GitLab states it plainly
        for the same reason: past two, people mistake a menu's back for the
        phone's and leave the flow entirely.
      */}
      <nav ref={list} className="ux-rail-scroll min-h-0 flex-1 px-3 pb-3" aria-label="Sections">
        {SECTIONS.map((s) => (
          <RailSection
            key={s.id}
            s={s}
            isOpen={s.id === open}
            onHub={s.id === here && trail.length === 1}
            trailKey={trailKey}
            label={nav.label}
            onOpen={openSection}
          />
        ))}
      </nav>

      {/* The same 12px gutter the card and the list have. It had none, so it
          ran the full 253px and sat wider than everything above it. */}
      {footer && <div className="shrink-0 px-3 pb-3 pt-1">{footer}</div>}
    </aside>
  );
}


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
          className="ux-ping absolute top-[3px] end-[3px] grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-2xs font-semibold text-white"
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
const TOPBAR_H_VAR = "var(--ux-topbar-h)";

export function Topbar({ user }: { user: { name: string; avatar: string; unread?: number } }) {
  /* Whether the bar leads with the way back instead of the logo. `MobileBack`
     makes the same decision for itself — it has to, because it is the thing
     being drawn — and the two read the one predicate in `nav-tree` rather than
     each keeping a list of the five roots. */
  const here = usePathname() ?? "";
  const backControl = (here === "/app" || here.startsWith("/app/")) && !isTabRoot(here);
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
      style={{ height: TOPBAR_H_VAR, borderRadius: 0, borderWidth: "0 0 1px 0" }}
    >
      <div className="flex flex-1 items-center gap-3 ps-[18px] pe-[18px]">
      {/* Brand first, then the six modes. The rail no longer carries the
          wordmark: with a full-width bar above it, the brand belongs at the
          top-left corner of the whole app rather than above one column.

          On a PHONE, on any screen that is not one of the five tab roots, the
          back control takes this leading slot instead. That is the native
          arrangement — iOS and Material both give the leading position to the
          way out, and a logo on a sub-screen tells her nothing she does not
          already know — and it is also the only way the row fits: the mark is
          61px wide at 390, which is most of the room a back control needs.
          `contents` rather than `block` so that above lg the wrapper vanishes
          from the flex row and the bar is laid out exactly as before. */}
      <span className={backControl ? "hidden lg:contents" : "contents"}>
        <Brand size="sm" tagline={false} />
      </span>
      <MobileBack />

      {/*
        No section tabs here.

        They used to sit in this bar AND in the rail AND in the phone's bottom
        bar — three renderings of one list, with ten hrefs appearing in two of
        them at once. The bar now carries only things that are not places:
        search, help, and her account.
      */}

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
          <span className="min-w-0 flex-1 truncate text-xsm" style={{ color: "var(--ux-muted)" }}>
            Search…
          </span>
          <kbd
            className="shrink-0 rounded-md border px-1.5 py-0.5 text-2xs font-medium"
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
        {/* Help is not a tab because five is the ceiling for a bottom bar —
            but it is the one section a woman reaches for on her worst day, so
            it is in the bar on every screen instead of behind a menu. */}
        <TopIconBtn icon="LifeBuoy" label="Help" href="/app/helpdesk" />
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
            <span className="hidden text-sm font-medium lg:inline" style={{ color: "var(--ux-ink)" }}>
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
                  className="ux-hov flex items-center gap-3 rounded-[8px] px-2.5 py-2 text-xsm transition-colors hover:bg-[var(--ux-surface-2)]"
                  style={{ color: "var(--ux-ink)" }}
                >
                  <Icon name={it.icon} className="ux-ico h-[16px] w-[16px]" />
                  {it.label}
                </Link>
              ))}

              <div className="my-1.5 h-px" style={{ background: "var(--ux-line)" }} />

              <p className="px-2.5 pb-1.5 text-2xs font-semibold uppercase tracking-[0.07em]"
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
                      className="ux-hov ux-press flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[8px] text-xs font-medium transition-colors"
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
                className="ux-hov flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-start text-xsm transition-colors hover:bg-[var(--ux-surface-2)]"
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
  fit,
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
  /**
   * The screen is sized to the window and must not scroll.
   *
   * Only the bottom clearance changes, and only from `xl` up. The 96px below
   * exists so the floating assistant never covers the last card of a
   * scrolling page; on a screen built to end at the bottom of the window it
   * is 96px that can only be reached by scrolling a page that is not supposed
   * to scroll.
   *
   * Below `xl` it stays. A phone cannot hold a board designed for 1536px and
   * should not try — asked to, it squeezed the middle of the Learn board to
   * nothing and showed a hero sitting directly on top of a footer, with all
   * six destinations clipped out of existence. A screen that does not fit
   * scrolls, which is what scrolling is for.
   */
  fit?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--ux-canvas)" }}>
      <Topbar user={user} />

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
        {!wide && <ModeRail path={pathname} footer={sidebarFooter} />}

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
            {/* `h-full` under `fit`: without a definite height here, a board
                that asks for `h-full` resolves against an auto-height row and
                gets auto — it fits only by coincidence, at whatever window
                size it happened to be drawn for. The scroller itself keeps
                `overflow-y-auto` as the floor: on a window too short for any
                density the page scrolls rather than clipping. */}
            <div className={`flex min-w-0 gap-[24px] px-[20px] ${
                   wide ? "pb-[20px]"
                   : fit ? "pb-[calc(96px+env(safe-area-inset-bottom,0px))] xl:h-full xl:pb-[18px]"
                   : "pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-24"}`}
                 /* 18px on every screen, `fit` included.
                    It was 12 on a fit board, to buy back six pixels for a
                    design that had to end at the bottom of the window — and
                    `checks/rail-steady.mjs` caught what that cost: the rail's
                    photo starts at 18px, so those six pixels put the first
                    card in the page above the first thing in the rail on
                    exactly the screens where both are visible at once. Two
                    columns out of step is more visible than six pixels are
                    worth; the boards find them in their own padding. */
                 style={{ paddingTop: `calc(${TOPBAR_H_VAR} + 18px)` }}>
              {/* `.ux-swap` fades whatever the router puts inside — see the
                  rule in `ux/tokens.css` for why it is the child that carries
                  the animation and not this element. Emphatically NOT
                  `key={pathname}`: `pathname` changes before `children` does,
                  so keying on it rebuilt this subtree around the page she was
                  leaving and the destination then never rendered at all —
                  clicking Your shop → Your wallet left "Turn your skills into
                  income" under the wallet's URL, indefinitely. */}
              <main id="content" className="ux-swap min-w-0 flex-1">
                {/* The rail carrying these is `hidden lg:flex`, so on a phone
                    every sub-page — Your journey, Your calendar, Saved — was
                    reachable only by whatever happened to link to it. */}
                {/* On a phone the fade above becomes a directional slide —
                    forward from the right, back from the left. `PageTransition`
                    adds no wrapper element and no click handler: it decides
                    which way the NEXT arriving screen travels and writes that
                    to a custom property, so `.ux-swap`'s own animation still
                    rides on the element the router inserts. Nothing about it
                    sits between the tap and the navigation. */}
                <PageTransition>{children}</PageTransition>
              </main>
              {rail && (
                <div data-rail className="ux-swap hidden w-[320px] shrink-0 pb-24 xl:block">
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

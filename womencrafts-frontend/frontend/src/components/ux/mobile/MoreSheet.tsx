"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/i18n";
import { SECTIONS, type NavNode } from "../nav-tree";
import { useMe } from "../me";
import { useNavLabel } from "../use-nav-label";

/**
 * Everything the app can do, on a phone.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * A laptop shows the rail: every section, every screen inside it, always
 * there. A phone showed five tabs and nothing else. Compared across 126
 * screens at 1440 and at 390, the phone was missing 75 to 109 of the actions
 * the same screen offered on a laptop — Your calendar, My goals, Saved,
 * Chosen for you, Courses, Mentors, and the whole Help section.
 *
 * ── The shape, and the two it replaced ──────────────────────────────────────
 * **First** came a stack of bordered cards, one per section, each holding
 * another bordered list: boxes inside boxes, which is what makes a menu look
 * built rather than designed.
 *
 * **Then** an accordion — one section open, the other seven collapsed. It read
 * better, and it was still wrong for this app: a woman who wants Courses has
 * to know Courses lives under Learn, tap Learn, and read seven rows. Eight
 * sections hold forty-one screens between them, and a menu whose job is "show
 * me everything this app can do" cannot show one eighth of it at a time.
 *
 * **This one** is the department directory the large retail apps settled on.
 * Every section is a card; every screen inside it is visible at once, two to a
 * row, so the whole map is one scroll rather than eight taps. Each section
 * carries its own tint, which is what makes a long list scannable — you learn
 * that Work is orange and stop reading headings. A search field at the top
 * filters both levels at once for anyone who already knows the name.
 *
 * Every row is at least 44px, the sheet closes on Escape, on the backdrop and
 * on any link, and it never renders on a laptop.
 */

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name] ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
};

/** The six a thumb reaches for. Everything else is one card further down. */
const QUICK = [
  { label: "Search", icon: "Search", href: "/app/search" },
  { label: "Saved", icon: "Bookmark", href: "/app/saved" },
  { label: "Messages", icon: "MessageCircle", href: "/app/messages" },
  { label: "Notifications", icon: "Bell", href: "/app/notifications" },
  { label: "Help", icon: "LifeBuoy", href: "/app/helpdesk" },
  { label: "Settings", icon: "Settings", href: "/app/settings" },
];

/**
 * One colour per section, from the tint scale that already flips with the
 * theme. Not decoration: a tint is how a list of forty-one rows becomes
 * findable without reading — the eye learns the colour before the word.
 */
const TONE: Record<string, { tint: string; ink: string }> = {
  home:     { tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  learn:    { tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  work:     { tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  earn:     { tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  circle:   { tint: "--ux-tint-lilac",  ink: "--ux-violet-ink" },
  wellness: { tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  help:     { tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  account:  { tint: "--ux-tint-amber",  ink: "--ux-orange-ink" },
};
const toneOf = (id: string) => TONE[id] ?? { tint: "--ux-surface-2", ink: "--ux-ink-2" };

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useT();
  const path = usePathname() ?? "";
  const me = useMe();
  const { label, note } = useNavLabel();
  const { theme, setTheme } = useTheme();
  const { spec } = useI18n();
  const [q, setQ] = useState("");
  const here = useMemo(
    () => SECTIONS.find((s) => s.href === path || path.startsWith(s.href + "/"))?.id ?? "home",
    [path],
  );

  // Escape closes it, and the screen behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // A fresh sheet is a fresh search.
  useEffect(() => { if (open) setQ(""); }, [open]);

  /** Typed text narrows both levels: a section stays if it or a screen matches. */
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const kidsOf = (n: NavNode) => (n.children ?? []).filter((c) => !c.unlisted);
    if (!needle) return SECTIONS.map((s) => ({ s, kids: kidsOf(s) }));
    const hit = (n: NavNode) => `${label(n)} ${note(n) ?? ""}`.toLowerCase().includes(needle);
    return SECTIONS
      .map((s) => ({ s, kids: kidsOf(s).filter((c) => hit(c) || hit(s)) }))
      .filter(({ s, kids }) => hit(s) || kids.length > 0);
  }, [needle, label, note]);

  const found = shown.reduce((n, { kids }) => n + kids.length, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--ux-z-modal,60)] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label={tr("moreSheet.closeMenu")} onClick={onClose}
              className="ux-fade absolute inset-0 h-full w-full"
              style={{ background: "color-mix(in srgb, var(--ux-ink) 46%, transparent)", backdropFilter: "blur(3px)" }} />

      <div className="ux-sheet-up absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-[26px]"
           style={{ background: "var(--ux-canvas)", boxShadow: "0 -20px 44px -20px rgba(0,0,0,.4)" }}>

        {/* ── Her, and the way to find anything ── */}
        <div className="shrink-0 rounded-t-[26px]"
             style={{ background: "var(--ux-surface)", borderBottom: "1px solid var(--ux-line)" }}>
          <span className="mx-auto mb-1.5 mt-3 block h-[4px] w-[38px] rounded-full"
                style={{ background: "var(--ux-line-strong)" }} aria-hidden />

          <div className="flex items-center gap-3 px-5 pb-3.5 pt-1.5">
            <Link href="/app/profile" onClick={onClose} className="ux-press flex min-w-0 flex-1 items-center gap-3">
              <span className="h-[44px] w-[44px] shrink-0 overflow-hidden rounded-full" style={{ background: "var(--ux-brand-tint-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {me.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[16.5px] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>
                  {me.name || me.first}
                </b>
                <span className="mt-[3px] flex items-center gap-1 text-[12.5px] leading-tight" style={{ color: "var(--ux-muted)" }}>
                  {me.verified && <Icons.BadgeCheck className="h-[14px] w-[14px]" style={{ color: "var(--ux-green)" }} aria-hidden />}
                  {me.verified ? "Verified member" : "View your profile"}
                </span>
              </span>
            </Link>
            <button type="button" onClick={onClose} aria-label="Close"
                    className="ux-press grid h-11 w-11 shrink-0 place-items-center rounded-full"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              <Icons.X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* A pill, the way every phone draws a search field. */}
          <div className="px-5 pb-4">
            <label className="flex h-[48px] items-center gap-3 rounded-full ps-4 pe-2"
                   style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
              <Icons.Search className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-muted)" }} aria-hidden />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={tr("moreSheet.findAScreen")}
                aria-label={tr("moreSheet.findAScreen")}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                style={{ color: "var(--ux-ink)" }}
              />
              {q ? (
                <button type="button" onClick={() => setQ("")} aria-label="Clear"
                        className="ux-press grid h-8 w-8 shrink-0 place-items-center rounded-full"
                        style={{ background: "var(--ux-surface)", color: "var(--ux-muted)" }}>
                  <Icons.X className="h-[15px] w-[15px]" aria-hidden />
                </button>
              ) : <span className="w-2 shrink-0" aria-hidden />}
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-4"
             style={{ WebkitOverflowScrolling: "touch" }}>

          {/* ── Six by hand ── */}
          {!needle && (
            <div className="grid grid-cols-3 gap-3 px-5 pb-5">
              {QUICK.map((qk) => (
                <Link key={qk.href} href={qk.href} onClick={onClose}
                      className="ux-press flex h-[76px] flex-col items-center justify-center gap-2.5 rounded-[16px]"
                      style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", color: "var(--ux-brand)" }}>
                  <Icon name={qk.icon} className="h-[21px] w-[21px]" />
                  <span className="max-w-full truncate px-1 text-[12.5px] font-semibold leading-none" style={{ color: "var(--ux-ink)" }}>
                    {qk.label}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <p className="px-5 pb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
            {needle ? `${found} ${found === 1 ? "screen" : "screens"}` : "Everything in WomSakhi"}
          </p>

          {/* ── Every section, with everything inside it ── */}
          <div className="grid gap-3 px-5">
            {shown.map(({ s, kids }) => {
              const tone = toneOf(s.id);
              const current = here === s.id;
              return (
                <section key={s.id} className="overflow-hidden rounded-[18px]"
                         style={{ background: "var(--ux-surface)",
                                  border: current ? "1.5px solid var(--ux-brand)" : "1px solid var(--ux-line)" }}>
                  <Link href={s.href} onClick={onClose}
                        className="ux-press flex min-h-[66px] items-center gap-3.5 px-4 py-3">
                    <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[14px]"
                          style={{ background: `var(${tone.tint})`, color: `var(${tone.ink})` }}>
                      <Icon name={s.icon} className="h-[22px] w-[22px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[16px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
                        {label(s)}
                      </b>
                      {note(s) && (
                        <span className="mt-[3px] block truncate text-[12.5px] leading-tight" style={{ color: "var(--ux-muted)" }}>
                          {note(s)}
                        </span>
                      )}
                    </span>
                    <Icons.ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
                  </Link>

                  {kids.length > 0 && (
                    <ul className="grid grid-cols-2 gap-2 px-3 pb-3 pt-0.5">
                      {kids.map((c) => {
                        const on = path === c.href || path.startsWith(c.href + "/");
                        return (
                          <li key={c.id}>
                            <Link href={c.href} onClick={onClose}
                                  className="ux-press flex min-h-[46px] items-center gap-2.5 rounded-[12px] px-3"
                                  style={{ background: on ? `var(${tone.tint})` : "var(--ux-surface-2)" }}>
                              <Icon name={c.icon} className="h-[16px] w-[16px] shrink-0" />
                              <span className="min-w-0 flex-1 truncate text-[13px] leading-tight"
                                    style={{ color: on ? `var(${tone.ink})` : "var(--ux-ink-2)", fontWeight: on ? 700 : 550 }}>
                                {label(c)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {needle && found === 0 && (
            <p className="px-5 py-10 text-center text-[14px]" style={{ color: "var(--ux-muted)" }}>
              Nothing here matches &ldquo;{q}&rdquo;.
            </p>
          )}

          {/* ── Language ───────────────────────────────────────────────────
              The bar at the top of a phone has no room for a fifth icon, so
              the globe that sits beside the theme toggle on a laptop is this
              row instead. It shows her language in her own script and opens
              the full picker — a woman changing language needs to recognise
              where she is going, and eighteen names do not belong in a sheet
              that is already a directory of forty-one screens. */}
          <Link href="/app/settings/language" onClick={onClose}
                className="ux-press mx-5 mb-1 mt-4 flex items-center gap-3 rounded-[18px] px-4 py-3.5"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Icon name="Globe" className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Language</span>
            <span className="truncate text-[14px]" lang={spec.code} dir={spec.dir}
                  style={{ color: "var(--ux-muted)" }}>{spec.nativeName}</span>
            <Icons.ChevronRight className="h-[17px] w-[17px] shrink-0 rtl:rotate-180"
                                style={{ color: "var(--ux-faint)" }} aria-hidden="true" />
          </Link>

          {/* ── Appearance, because it is a setting and not a place ── */}
          <div className="mx-5 mb-1 mt-4 flex items-center gap-3 rounded-[18px] px-4 py-3.5"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Icon name={theme === "dark" ? "Moon" : "Sun"} className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Appearance</span>
            <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--ux-surface-2)" }}>
              {(["light", "dark"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTheme(t)} aria-pressed={theme === t}
                        className="ux-tap-exempt h-[34px] rounded-full px-3.5 text-[13px] font-semibold capitalize"
                        style={theme === t
                          ? { background: "var(--ux-surface)", color: "var(--ux-ink)", boxShadow: "var(--ux-shadow-sm)" }
                          : { color: "var(--ux-muted)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style href="ux-more-sheet" precedence="ux-mobile">{`
        .ux-sheet-up { animation: ux-sheet-up var(--ux-t-slow, 320ms) var(--ux-ease-out, cubic-bezier(.32,.72,0,1)); }
        @keyframes ux-sheet-up { from { transform: translateY(18px); opacity: .5 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .ux-sheet-up { animation: none } }
      `}</style>
    </div>
  );
}

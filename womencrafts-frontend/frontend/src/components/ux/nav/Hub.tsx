"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { v } from "@/components/ux/kit";
import { useNavLabel } from "@/components/ux/use-nav-label";
import { SECTIONS, type Section } from "@/components/ux/nav-tree";
import { PlaceBadge, PlaceTile } from "./Place";

/**
 * A section's landing page, which IS its navigation.
 *
 * ── Why a page and not a menu ───────────────────────────────────────────────
 * A section holds around seventeen screens. Above fifteen, Nielsen Norman stop
 * recommending a persistent sub-menu and start recommending a landing page
 * that carries the branch — because a seventeen-item list in the chrome is a
 * wall on a laptop and, on a phone, does not fit at all.
 *
 * So this is a page: full-width cards, real labels, a line under each saying
 * what it is for, and nothing hidden behind a tap. Before this the app had no
 * map on a phone whatsoever — no rail below `lg`, no drawer, and the "More
 * sheet holding the entire map" described in `MobileNav`'s own comment had
 * never been written. Sixty-four routes could only be reached if some page
 * happened to link to them.
 *
 * ── Two levels, never three ─────────────────────────────────────────────────
 * A card's own children are listed beneath it as plain links rather than
 * becoming a third level to drill through. GitLab's rule, and the reason is
 * that a nested menu is where people mistake its back button for the phone's
 * and leave the flow entirely.
 */
/**
 * The banner a section's hub opens on, where one exists.
 *
 * Earn's is cropped from `lm.png` — the woman and the plant, and deliberately
 * NOT the rest of it: that file carries a quote reading "Learning is not just
 * for today" and a "Small Steps Big Changes" script, both of which say Learn
 * things and would be wrong over Earn. The picture travels; the words do not.
 */
const HERO: Record<string, { src: string; w: number; h: number }> = {
  earn: { src: "/ux/art/hero-earn-banner.webp", w: 1300, h: 457 },
};

export function Hub({ id }: { id: string }) {
  const nav = useNavLabel();
  const section = SECTIONS.find((s) => s.id === id) as Section | undefined;
  if (!section) return null;

  const kids = (section.children ?? []).filter((c) => !c.unlisted);
  const art = HERO[id];

  return (
    <HomeShell active={section.href} bare loadFailed={section.label.toLowerCase()}>
      <div className="flex flex-col">
      {/*
        A section with art gets a band; one without keeps the plain header.

        The bare version — an icon, a heading and a line of grey type on a flat
        canvas — is what made these screens look unfinished beside Learn and
        Work, which have proper heroes. `HERO` is a lookup rather than a flag
        so a section only gets one when there is a real picture for it; the
        others are unchanged until there is.
      */}
      {art ? (
        <section data-banner className="ux-sq relative isolate mb-4 overflow-hidden rounded-[18px]"
                 style={{ border: `1px solid ${v("--ux-band-edge")}`,
                          background: v("--ux-band-learn") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.src} alt="" aria-hidden decoding="async" fetchPriority="high"
               width={art.w} height={art.h}
               className="pointer-events-none absolute inset-y-0 end-0 hidden h-full w-[42%] object-cover object-center lg:block"
               style={{ maskImage: "linear-gradient(to right, transparent 0%, #000 16%)",
                        WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 16%)" }} />
          <div className="relative flex items-start gap-3.5 p-5 sm:p-7 lg:max-w-[56%] lg:py-8">
            <PlaceBadge node={section} size={48} />
            <div className="min-w-0">
              <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
                  style={{ color: v("--ux-band-ink") }}>
                {nav.label(section)}
              </h1>
              {section.note && (
                <p className="mt-1.5 text-smd leading-relaxed" style={{ color: v("--ux-band-ink-2") }}>
                  {section.note}
                </p>
              )}
              <p className="mt-2 text-xs" style={{ color: v("--ux-band-ink-2") }}>
                {kids.length} places, nothing hidden.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <header className="mb-5 flex items-start gap-3.5">
          {/* The section's picture in its colour: the first thing that says
              where she is, before a word of the title is read. */}
          <PlaceBadge node={section} size={52} />
          <div className="min-w-0">
            <h1 className="ux-screen-title text-3xl font-extrabold leading-tight tracking-[-0.025em]"
                style={{ color: v("--ux-ink") }}>
              {nav.label(section)}
            </h1>
            {section.note && (
              <p className="mt-1 text-[15px] leading-snug lg:text-smd" style={{ color: v("--ux-ink-2") }}>{section.note}</p>
            )}
            <p className="mt-1.5 text-[13px] lg:text-xs" style={{ color: v("--ux-muted") }}>
              {kids.length} places, nothing hidden.
            </p>
          </div>
        </header>
      )}

        {/*
          ── Pictures first ──────────────────────────────────────────────────
          Every place is a picture tile with its name under it: a photo where
          one plainly shows the thing, its icon on the module's colour where
          none does (components/ux/nav/places.ts). A woman who cannot read the
          names finds her way by the pictures and the colour; one who can
          reads them as before.

          The section's own places come first as big tiles, two to a row on a
          phone. The screens under each follow as smaller tiles in a group of
          their own — still two levels, never a third to drill through.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {kids.map((c, i) => (
            <div key={c.id} className="ux-rise min-w-0" style={{ ["--i" as string]: Math.min(i, 12) }}>
              <PlaceTile node={c} />
            </div>
          ))}
        </div>

        {kids.filter((c) => (c.children ?? []).some((k) => !k.unlisted)).map((c) => (
          <section key={c.id} className="mt-7" aria-labelledby={`hub-${c.id}`}>
            <h2 id={`hub-${c.id}`} className="mb-3 flex items-center gap-2.5 text-base font-bold" style={{ color: v("--ux-ink") }}>
              <PlaceBadge node={c} size={30} />
              {nav.label(c)}
            </h2>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-6">
              {(c.children ?? []).filter((k) => !k.unlisted).map((k) => (
                <PlaceTile key={k.id} node={k} size="sm" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </HomeShell>
  );
}

/**
 * A section's places as pictures, for the top of its dashboard.
 *
 * The dashboards (Learn, Work, Earn, Community, Health, Help, You) are pages
 * of their own rather than `Hub`, so they never showed the section's map as
 * pictures — only the rail did, as words. This is that map: every place in
 * the section as a tile, in the section's colour, three to a row on a phone.
 */
export function SectionPictures({ id, title, className = "mb-6", exclude = [] }: {
  id: string; title?: string; className?: string;
  /** Hrefs the page already shows as pictures of its own (Health's bento), left out here. */
  exclude?: string[];
}) {
  const nav = useNavLabel();
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) return null;
  const kids = (section.children ?? []).filter((c) => !c.unlisted && !exclude.includes(c.href));
  if (!kids.length) return null;
  return (
    <section aria-labelledby={`places-${id}`} className={className}>
      <h2 id={`places-${id}`} className="mb-3 flex items-center gap-2.5 text-base font-bold" style={{ color: v("--ux-ink") }}>
        <PlaceBadge node={section} size={30} />
        {title ?? `Everything in ${nav.label(section)}`}
      </h2>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-6">
        {kids.map((c, i) => (
          <div key={c.id} className="ux-rise min-w-0" style={{ ["--i" as string]: Math.min(i, 12) }}>
            <PlaceTile node={c} size="sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

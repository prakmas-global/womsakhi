"use client";

import { SECTIONS } from "@/components/ux/nav-tree";
import { PlaceBadge, PlaceTile } from "@/components/ux/nav/Place";

/**
 * Every part of WomSakhi as one big picture each, on Home.
 *
 * The first screen a woman lands on, and the one she comes back to when she
 * is lost — so it carries the whole app as eight pictures in their module
 * colours (components/ux/nav/places.ts): Learn violet, Work orange, Earn
 * green, Community pink, Health teal, Help red. A woman who cannot read the
 * names goes by the picture and the colour, and meets the same colour again
 * on the tab, the rail and every screen inside.
 *
 * Eight, so the grid closes: 2 × 4 on a phone, 4 × 2 from a tablet up.
 */
export function ModulePictures({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="home-modules" className={className}>
      <h2 id="home-modules" className="mb-3 flex items-center gap-2.5 text-base font-bold" style={{ color: "var(--ux-ink)" }}>
        <PlaceBadge node={SECTIONS[0]} size={30} />
        Everything in WomSakhi
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTIONS.map((s, i) => (
          <div key={s.id} className="ux-rise min-w-0" style={{ ["--i" as string]: i }}>
            <PlaceTile node={s} />
          </div>
        ))}
      </div>
    </section>
  );
}

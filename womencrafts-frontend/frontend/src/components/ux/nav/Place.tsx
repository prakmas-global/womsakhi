"use client";

import { usePathname } from "next/navigation";

import { I } from "@/components/ux/kit";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { nodeFor, parentFor, type NavNode } from "@/components/ux/nav-tree";
import { useNavLabel } from "@/components/ux/use-nav-label";
import { bannerFor } from "./banners";
import { placeOf } from "./places";

/**
 * A place's picture, in the sizes the app needs (rules in ./places.ts).
 *
 *   PlaceArt    fills its box: the hub's big tiles
 *   PlaceBadge  a square of a given size: the rail, the More sheet, lists
 *   PlaceTile   the big tappable tile: picture, then the name under it
 *   PlaceMark   the badge for the screen she is on, beside its title
 *
 * A pictogram is the place's icon in white on the brand gradient, with two
 * soft circles behind it so it reads as a picture rather than a button. A
 * photo gets a thin brand band along its foot, so photos and pictograms read
 * as one family.
 */

type Node = Pick<NavNode, "id" | "icon">;

const fill = "var(--ux-pic-ground)";
const band = "linear-gradient(90deg, var(--ux-fill), var(--ux-rib-2))";

export function PlaceArt({ node, className = "" }: { node: Node; className?: string }) {
  const p = placeOf(node);
  if (p.photo) {
    return (
      <span className={`relative block overflow-hidden ${className}`} style={{ background: "var(--ux-surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.photo} alt="" loading="lazy" decoding="async"
             className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[5px]" style={{ background: band }} />
      </span>
    );
  }
  return (
    <span className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: fill }}>
      <span aria-hidden className="absolute -end-[18%] -top-[22%] aspect-square w-[70%] rounded-full bg-white/15" />
      <span aria-hidden className="absolute -bottom-[30%] -start-[16%] aspect-square w-[62%] rounded-full bg-black/10" />
      <I name={p.icon} sw={1.7} className="relative h-[46%] w-[46%] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform duration-300 group-hover:scale-110" />
    </span>
  );
}

export function PlaceBadge({ node, size = 40, radius }: { node: Node; size?: number; radius?: number }) {
  const p = placeOf(node);
  const r = radius ?? Math.round(size * 0.28);
  if (p.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.photo} alt="" aria-hidden loading="lazy" decoding="async" width={size} height={size}
           className="shrink-0 object-cover"
           style={{ width: size, height: size, borderRadius: r, boxShadow: "0 0 0 2px color-mix(in oklab, var(--ux-fill) 55%, transparent)" }} />
    );
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center"
          style={{ width: size, height: size, borderRadius: r, background: fill }}>
      <I name={p.icon} sw={2} className="text-white" style={{ width: size * 0.56, height: size * 0.56 }} />
    </span>
  );
}

/** The big tile: the picture is the button, the name sits under it. */
export function PlaceTile({ node, size = "md" }: { node: NavNode; size?: "md" | "sm" }) {
  const nav = useNavLabel();
  return (
    <TransitionLink href={node.href}
                    className="ux-press ux-sq group flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] text-center"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-card)" }}>
      <PlaceArt node={node} className={size === "md" ? "aspect-[4/3] w-full" : "aspect-square w-full"} />
      <span className="flex flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2.5">
        <span className={`line-clamp-2 font-bold leading-tight ${size === "md" ? "text-sm" : "text-xs"}`} style={{ color: "var(--ux-ink)" }}>
          {nav.label(node)}
        </span>
        {size === "md" && node.note && (
          <span className="line-clamp-2 hidden text-2xs leading-snug sm:block" style={{ color: "var(--ux-muted)" }}>{nav.note(node)}</span>
        )}
      </span>
      <span aria-hidden className="h-[3px] w-full" style={{ background: band }} />
    </TransitionLink>
  );
}

/**
 * Beside a screen's title: its picture — or, when the section banner above
 * already shows that picture, a way back instead.
 *
 * The banner and the title mark showed the same photo one above the other,
 * which says nothing twice. So where there is a banner, the title's slot
 * becomes the back arrow to the parent screen (on a laptop; a phone has Back
 * in its top bar already, so there the slot is empty). A page whose own hero
 * hides the banner (tokens.css) gets its picture back from the same rule.
 * Reads the route itself, so any page header can carry it with no arguments.
 */
export function PlaceMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  const path = usePathname() ?? "";
  const nav = useNavLabel();
  const node = nodeFor(path);
  if (!node) return null;
  if (!bannerFor(path)) {
    return <span className={`inline-flex shrink-0 ${className}`}><PlaceBadge node={node} size={size} /></span>;
  }
  const parent = parentFor(path);
  return (
    <span className={`ux-place-banner shrink-0 ${parent ? "max-lg:hidden" : "hidden"} ${className}`}>
      {parent && (
        <TransitionLink href={parent.href} aria-label={`Back to ${nav.label(parent)}`} title={`Back to ${nav.label(parent)}`}
                        className="ux-place-back ux-press grid shrink-0 place-items-center rounded-full"
                        style={{ width: size, height: size, background: "var(--ux-surface)",
                                 border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
          <I name="ArrowLeft" sw={2.2} className="h-5 w-5" />
        </TransitionLink>
      )}
      <span className="ux-place-pic hidden"><PlaceBadge node={node} size={size} /></span>
    </span>
  );
}

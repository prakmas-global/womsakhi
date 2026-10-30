"use client";

import { useMemo } from "react";

import * as Icons from "@/components/ux/icons";
import { topicArt } from "@/components/ux/media/art";
import { masterPicture, useMaster, type MasterItem, type MasterKey } from "@/lib/masters-api";

/**
 * Pictures for the category-like masters (course categories, mentor topics,
 * skill swap tags, event categories, circle topics, doctor specialities,
 * health video shelves) — the one place member screens get them from.
 *
 * A picture is the one staff set, else its group's, else the library picture
 * its name points to (`masterPicture`). `staff` says whether a person chose
 * it, which decides whether it beats an item's own words (see `pictureOr`).
 */

export interface MasterPicture { src: string; staff: boolean }

export function useMasterPictures(list: MasterKey, fallback: string[] = []) {
  const master = useMaster(list, fallback);
  const sig = master.items.map((i) => `${i.key}:${i.label}:${i.extra.image ?? ""}:${(i.children ?? []).map((c) => `${c.key}:${c.extra.image ?? ""}`).join(",")}`).join("|");
  const byLabel = useMemo(() => {
    const m = new Map<string, MasterPicture>();
    const put = (i: MasterItem, parent?: MasterItem) => m.set(i.label.toLowerCase(), {
      src: masterPicture(list, i, parent), staff: !!(i.extra.image || parent?.extra.image),
    });
    for (const p of master.items) {
      put(p);
      for (const c of p.children ?? []) put(c, p);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sig]);
  /** Any label — one the list does not know still gets the picture its words point to. */
  const of = (label: string): MasterPicture =>
    byLabel.get(label.toLowerCase()) ?? { src: masterPicture(list, { key: label, label, extra: {} }), staff: false };
  return { ...master, of, pic: (label: string) => of(label).src };
}

/**
 * An item's picture: its own photo; else a picture staff chose for its
 * category; else what its own words point to; else its category's picture —
 * never a generic stock one.
 */
export function pictureOr(own: string | null | undefined, words: (string | undefined | null)[], cat: MasterPicture): string {
  if (own && own.trim()) return own;
  if (cat.staff) return cat.src;
  return topicArt(words) || cat.src;
}

/** A filter chip with the category's picture in it. Same feel as the kit's `Chip`. */
export function PicChip({ src, selected, onClick, children }: {
  src: string; selected?: boolean; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
            className="ux-press ux-sq inline-flex items-center gap-2 rounded-[12px] border py-[5px] ps-[5px] pe-3.5 text-xsm font-medium transition-colors"
            style={{
              borderColor: selected ? "var(--ux-brand)" : "var(--ux-line-strong)",
              background: selected ? "var(--ux-brand-tint)" : "var(--ux-surface)",
              color: selected ? "var(--ux-brand)" : "var(--ux-ink)",
              boxShadow: selected
                ? "inset 0 1px 3px rgb(var(--ux-shadow-ink) / 0.16)"
                : "inset 0 1px 0 var(--ux-edge-hi), 0 1px 2px var(--ux-sh-1)",
            }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" className="h-[30px] w-[30px] shrink-0 rounded-[8px] object-cover" />
      {children}
      {selected && <Icons.Check className="ux-pop h-[13px] w-[13px]" strokeWidth={3} />}
    </button>
  );
}

export interface PicTile { value: string; label: string; src: string; sub?: string }

/**
 * A row of picture tiles to pick a category by — the look of the kind-of-work
 * tiles in My work profile. It scrolls sideways inside itself, so it never
 * widens the page on a phone.
 */
export function PicTiles({ tiles, value, onPick, label, size = "md", className = "" }: {
  tiles: PicTile[]; value: string | string[]; onPick: (value: string) => void; label: string;
  size?: "md" | "sm"; className?: string;
}) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  const box = size === "md" ? "h-[96px] w-[128px]" : "h-[76px] w-[104px]";
  return (
    <div role="group" aria-label={label}
         className={`-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin] ${className}`}>
      {tiles.map((t) => {
        const picked = on(t.value);
        return (
          <button key={t.value} type="button" aria-pressed={picked} onClick={() => onPick(t.value)}
                  className={`ux-press group relative flex ${box} shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[14px] text-start`}
                  style={{ boxShadow: picked ? "0 0 0 3px var(--ux-brand)" : "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.src} alt="" loading="lazy" decoding="async"
                 className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
            <span aria-hidden className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 25%, rgba(16,6,24,.85))" }} />
            {picked && (
              <span className="ux-pop absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: "var(--ux-brand)", color: "#fff" }}>
                <Icons.Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
            <span className="relative p-2.5">
              <span className="block text-xs font-bold leading-tight text-white">{t.label}</span>
              {t.sub && <span className="block text-2xs text-white/80">{t.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

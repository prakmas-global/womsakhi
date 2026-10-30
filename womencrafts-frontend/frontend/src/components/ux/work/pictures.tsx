"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { artFor } from "@/components/ux/media/art";
import { apiWorkTaxonomy, type WorkCategory, type WorkSkillOption } from "@/lib/work-api";
import { categoryArt, skillArt } from "./skill-art";

/**
 * Work pictures on members' screens: the kind-of-work tiles, skill chips with
 * a thumbnail, and the picture of a job that has no photo of its own.
 *
 * Every picture comes from `skill-art.ts` — the one staff set, else its
 * category's, else the library — so a kind of work looks the same in My work
 * profile, Find people, Post a job and Find work.
 */

/* One fetch of the categories and skills for every component that needs them. */
let taxonomy: Promise<WorkCategory[]> | null = null;

export function loadWorkTaxonomy(): Promise<WorkCategory[]> {
  if (!taxonomy) {
    taxonomy = apiWorkTaxonomy().then((d) => d ?? []).catch(() => { taxonomy = null; return []; });
  }
  return taxonomy;
}

/** The categories and skills, shared; `[]` until they arrive or if they can't. */
export function useWorkTaxonomy(): WorkCategory[] {
  const [cats, setCats] = useState<WorkCategory[]>([]);
  useEffect(() => {
    let alive = true;
    void loadWorkTaxonomy().then((c) => { if (alive) setCats(c); });
    return () => { alive = false; };
  }, []);
  return cats;
}

/**
 * A job's picture: its own cover; else the picture staff set on one of its
 * skills or its category; else the library picture its title and skills point
 * to (more specific than a category's when nobody has chosen one).
 */
export function jobPicture(
  job: { id: string; title: string; skills: string[]; categoryName?: string; category?: string; skillKeys?: string[]; cover?: string },
  cats: WorkCategory[],
): string {
  if (job.cover) return job.cover;
  const cat = cats.find((c) => c.key === job.category);
  for (const key of job.skillKeys ?? []) {
    const owner = cat?.skills.some((s) => s.key === key) ? cat : cats.find((c) => c.skills.some((s) => s.key === key));
    const skill = owner?.skills.find((s) => s.key === key);
    if (skill?.image) return skill.image;
  }
  if (cat?.image) return cat.image;
  return artFor([job.title, job.skills.join(" "), job.categoryName], "job", undefined, job.id);
}

/**
 * Kinds of work as pictures in one scrolling row — tap to choose, tap again to
 * clear. `count` puts a badge on a tile (how many of its skills she picked).
 */
export function CategoryTiles({ cats, value, onPick, count, label = "Kinds of work" }: {
  cats: WorkCategory[]; value: string; onPick: (key: string) => void;
  count?: (c: WorkCategory) => number; label?: string;
}) {
  return (
    <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" role="group" aria-label={label}>
      {cats.map((c) => {
        const on = c.key === value;
        const n = count?.(c) ?? 0;
        return (
          <button key={c.key} type="button" aria-pressed={on} onClick={() => onPick(on ? "" : c.key)}
                  className="ux-press group relative flex h-[112px] w-[140px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[14px] text-start"
                  style={{ boxShadow: on ? "0 0 0 3px var(--ux-brand)" : "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={categoryArt(c)} alt="" loading="lazy" decoding="async"
                 className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
            <span aria-hidden className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 25%, rgba(16,6,24,.85))" }} />
            {n > 0 && (
              <span className="absolute end-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-2xs font-extrabold"
                    style={{ background: "var(--ux-brand)", color: "#fff" }}>{n}</span>
            )}
            {on && !n && (
              <span className="ux-pop absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full"
                    style={{ background: "var(--ux-brand)", color: "#fff" }}>
                <Icons.Check className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="relative p-2.5 text-xs font-bold leading-tight text-white">{c.name}</span>
          </button>
        );
      })}
      {!cats.length && Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="ux-skeleton h-[112px] w-[140px] shrink-0 rounded-[14px]" />
      ))}
    </div>
  );
}

/** A small round picture of a category or skill, for chips and headings. */
export function WorkThumb({ src, size = 22 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" decoding="async" className="shrink-0 rounded-full object-cover"
         style={{ width: size, height: size }} />
  );
}

/**
 * A skill's picture for a chip — only when it says more than its category's
 * tile above it does (staff gave the skill its own, or its name points to a
 * different picture). Twenty copies of the tile's picture would be noise.
 */
export function chipPicture(skill: WorkSkillOption, cat: WorkCategory): string | undefined {
  const src = skillArt(skill, cat);
  return src === categoryArt(cat) ? undefined : src;
}

/** One skill as a tappable chip, with its picture when it has its own: + to add, ✓ when picked. */
export function SkillChip({ skill, cat, on, onClick, index = 0 }: {
  skill: WorkSkillOption; cat: WorkCategory; on: boolean; onClick: () => void; index?: number;
}) {
  const pic = chipPicture(skill, cat);
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
            className={`ux-press ux-pop inline-flex min-h-[38px] items-center gap-1.5 rounded-full border py-1 pe-3.5 text-xs font-semibold transition-colors ${pic ? "ps-1" : "ps-3"}`}
            style={{
              ["--i" as string]: Math.min(index, 10),
              borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
              background: on ? "var(--ux-brand)" : "var(--ux-surface)",
              color: on ? "var(--ux-on-brand, #fff)" : "var(--ux-ink)",
            }}>
      {pic && <WorkThumb src={pic} size={28} />}
      {on ? <Icons.Check className="h-3.5 w-3.5" /> : <Icons.Plus className="h-3.5 w-3.5" />}
      {skill.name}
      {skill.popular && !on && <Icons.Star className="h-3 w-3" style={{ color: "var(--ux-amber-ink)" }} aria-label="Popular" />}
    </button>
  );
}

/** A choice with its picture — a type of work, say: picture, title, one line under it. */
export function PictureChoice({ src, title, sub, on, onClick }: {
  src: string; title: string; sub?: string; on: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
            className="ux-press ux-sq relative flex flex-1 items-center gap-3 rounded-[14px] border p-2.5 text-start"
            style={{ borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                     background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" className="h-[52px] w-[52px] shrink-0 rounded-[11px] object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block text-xsm font-bold" style={{ color: on ? "var(--ux-brand)" : "var(--ux-ink)" }}>{title}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{sub}</span>}
      </span>
      {on && (
        <span className="ux-pop grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--ux-brand)", color: "var(--ux-on-brand, #fff)" }}>
          <Icons.Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

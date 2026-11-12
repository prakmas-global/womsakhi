"use client";

import { useEffect, useState } from "react";
import { apiClient } from "./api";
import { pictureFor, type ArtKind } from "@/components/ux/media/art";

/**
 * Masters — the pick-lists staff control (backend: app/core/masters.py,
 * routes/masters.py). Screens read the ACTIVE items of the lists they need;
 * the server checks submitted values against the same lists.
 *
 * Records store an item's `label`, so a screen sends `label`, not `key`.
 */

export type MasterKey =
  | "course_categories" | "mentor_topics" | "swap_skills" | "opportunity_types" | "event_categories"
  | "circle_topics" | "circle_tags" | "feed_report_reasons" | "safety_report_categories"
  | "doctor_specialities" | "health_video_categories" | "languages" | "feedback_types"
  | "support_ticket_categories" | "rental_categories";

export interface MasterItem {
  key: string;
  label: string;
  parent_key: string | null;
  active: boolean;
  order: number;
  /** Per-list extras: `icon`, `note`, `synonyms`, `image` (picture lists only) … */
  extra: { icon?: string; note?: string; synonyms?: string[]; image?: string; [k: string]: unknown };
  /** Two-level lists only. */
  children?: MasterItem[];
}

export const apiMasters = (lists: MasterKey[], signal?: AbortSignal) =>
  apiClient.get<Record<string, MasterItem[]>>("/masters", { signal, params: { lists: lists.join(",") } }).then((r) => r.data);

/* A small shared cache: a list asked for by three components is fetched once. */
const cache = new Map<string, Promise<MasterItem[]>>();

export function loadMaster(list: MasterKey): Promise<MasterItem[]> {
  let p = cache.get(list);
  if (!p) {
    p = apiMasters([list]).then((d) => d[list] ?? []).catch((e) => { cache.delete(list); throw e; });
    cache.set(list, p);
  }
  return p;
}

/** Forget cached lists (after staff edit one, or on sign-out). */
export function forgetMasters(list?: MasterKey) {
  if (list) cache.delete(list); else cache.clear();
}

/**
 * A list's active items. `fallback` (today's hard-coded values) shows until
 * the server answers, and stays if it can't — a screen never goes blank.
 */
export function useMaster(list: MasterKey, fallback: string[] = []) {
  const [items, setItems] = useState<MasterItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadMaster(list).then((x) => { if (alive) setItems(x); }).catch(() => { /* keep the fallback */ });
    return () => { alive = false; };
  }, [list]);
  const shown: MasterItem[] = items ?? fallback.map((label, i) => ({ key: label, label, parent_key: null, active: true, order: i, extra: {} }));
  return {
    items: shown,
    /** Every selectable label: children for two-level lists, else the items. */
    labels: shown.flatMap((i) => (i.children?.length ? i.children.map((c) => c.label) : [i.label])),
    loaded: items !== null,
  };
}

/** What each picture list's automatic picture falls back to when no keyword matches. */
const PICTURE_KIND: Partial<Record<MasterKey, ArtKind>> = {
  course_categories: "course", mentor_topics: "mentor", swap_skills: "swap", opportunity_types: "job",
  event_categories: "event", circle_topics: "circle", doctor_specialities: "health", health_video_categories: "health",
  rental_categories: "product",
};

/** The lists staff can give pictures to (backend: `"image"` in the list's extras). */
export const PICTURE_LISTS = Object.keys(PICTURE_KIND) as MasterKey[];

/**
 * An item's picture: the one staff set, else its parent's, else the library
 * picture its name (and synonyms) point to.
 */
export function masterPicture(list: MasterKey, item: Pick<MasterItem, "key" | "label" | "extra">,
                              parent?: Pick<MasterItem, "label" | "extra"> | null): string {
  return pictureFor({ key: `${list}:${item.key}`, image: item.extra.image },
                    [item.label, ...(item.extra.synonyms ?? []), parent?.label],
                    parent ? { image: parent.extra.image } : null, PICTURE_KIND[list] ?? "generic");
}

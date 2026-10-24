"use client";

import { useCallback } from "react";

import { apiCatalogPrograms, apiEvents, apiOpportunities } from "@/lib/growth-api";
import { apiCircles, apiMentors } from "@/lib/me-api";
import { apiMeProfile } from "@/lib/member-api";
import { apiMyWorkProfile } from "@/lib/work-api";
import { useResource, type Resource } from "@/lib/use-resource";
import type { Find } from "./data";

/**
 * "Near you", measured against HER city.
 *
 * Explore said "Near you in Jaipur" to every woman — a constant — and counted
 * anything not online as near. Discover's "Nearby" tab returned the mentor
 * list. Nothing in this database measures distance, so near means the one
 * thing that can be checked honestly: the place on the record names her town.
 */

/** "Kukatpally, Hyderabad, Telangana" → the parts, lower-cased. */
const parts = (place: string) =>
  place.toLowerCase().split(/[,/·|-]/).map((p) => p.trim()).filter((p) => p.length > 1);

/** Her town, as a short label: the first part of what she wrote. */
export const cityOf = (location: string) => (location.split(",")[0] ?? "").trim();

/** True when the record's place names her town (either way round). */
export function isNear(place: string | undefined | null, city: string): boolean {
  if (!place || !city) return false;
  const want = parts(city);
  const have = parts(place);
  if (/online|remote|virtual/i.test(place)) return false;
  return want.some((w) => have.some((h) => h === w || h.includes(w) || w.includes(h)));
}

/**
 * Her town: her member location (My details), else the city on My work
 * profile. "" when she has given neither — screens then ask her to set it.
 */
export function useMyCity(): Resource<string> {
  return useResource(
    useCallback(async (s: AbortSignal) => {
      const me = await apiMeProfile(s).catch(() => null);
      const own = cityOf(me?.location ?? "");
      if (own) return own;
      const work = await apiMyWorkProfile(s).catch(() => null);
      return cityOf(work?.city ?? "");
    }, []),
    "",
  );
}

/**
 * Explore's feed — work, events, mentors, courses and circles, each from the
 * module that owns it, with `near` computed from where each one actually is.
 */
export function useExploreFeed(city: string): Resource<Find[]> {
  return useResource(
    useCallback(async (s: AbortSignal) => {
      const [jobs, events, mentors, courses, circles] = await Promise.all([
        apiOpportunities(s).catch(() => []),
        apiEvents(s).catch(() => []),
        apiMentors(s).catch(() => []),
        apiCatalogPrograms(s).catch(() => []),
        apiCircles(s).catch(() => []),
      ]);
      const out: Find[] = [];
      for (const j of jobs.slice(0, 8)) {
        out.push({
          id: j.id, kind: "Work", title: j.title, sub: [j.org, j.location].filter(Boolean).join(" · "),
          meta: j.pay || j.location, icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue",
          href: `/app/opportunities/${j.id}`, isNew: /today|yesterday/i.test(j.posted),
          near: j.mode !== "Remote" && isNear(j.location, city),
        });
      }
      for (const e of events.slice(0, 6)) {
        out.push({
          id: e.id, kind: "Event", title: e.title, sub: e.host || e.venue,
          meta: e.date_label, art: e.cover || undefined, icon: "Ticket", tint: "--ux-tint-pink", ink: "--ux-pink",
          href: `/app/events/${e.id}`, near: !/online|virtual/i.test(e.mode) && isNear(e.venue, city),
        });
      }
      for (const m of mentors.slice(0, 6)) {
        out.push({
          id: m.id, kind: "Mentor", title: m.name, sub: m.headline, meta: m.location,
          art: m.photo || undefined, icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange",
          href: `/app/mentors/${m.id}`, near: isNear(m.location, city),
        });
      }
      for (const c of courses.slice(0, 6)) {
        out.push({
          id: c.id, kind: "Course", title: c.name, sub: c.category, meta: c.duration,
          icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet", href: `/app/programs/${c.id}`,
        });
      }
      for (const c of circles.filter((x) => !x.joined).slice(0, 6)) {
        out.push({
          id: c.id, kind: "Circle", title: c.name,
          sub: `${c.member_count} ${c.member_count === 1 ? "woman" : "women"}${c.topic ? ` · ${c.topic}` : ""}`,
          meta: c.is_savings ? "Saves money together" : `${c.post_count} posts`,
          icon: c.is_private ? "Lock" : "Users", tint: "--ux-tint-green", ink: "--ux-green",
          href: `/app/circles/${c.id}`,
        });
      }
      return out;
    }, [city]),
    [],
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ApiMentor } from "@/lib/me-api";
import { loadMaster, masterPicture, type MasterItem } from "@/lib/masters-api";

/**
 * Mentor topics — how Mentor Connect groups the mentors in our database.
 *
 * Mentors carry free-form `expertise` tags set by staff ("Women's Health",
 * "PCOS", "Savings"…), plus a headline and a focus line. A topic is a set of
 * words matched against all of those, case-blind, so a new mentor lands in the
 * right topic without anyone maintaining a second list. Other Health sections
 * link here with `?topic=<label>` (e.g. `?topic=Pregnancy`).
 */

/** `pic`: the topic group's picture (Masters → Mentor topics), or the one its name points to. */
export interface Topic { label: string; icon: string; words: string[]; pic: string }

/**
 * What shows until the "mentor_topics" master loads (Masters → Mentor topics).
 * Once it does, each topic GROUP becomes a topic here: its words are the
 * group's synonyms plus the names of the topics under it, lower-cased.
 */
const BUILT_IN: Topic[] = ([
  { label: "Women's health", icon: "HeartPulse", words: ["women's health", "womens health", "health", "gynec", "gynaec", "pcos", "period"] },
  { label: "Pregnancy", icon: "Baby", words: ["pregnan", "maternal", "gynec", "gynaec", "women's health", "new mother"] },
  { label: "Fertility", icon: "Flower2", words: ["fertil", "pcos", "period", "menstru", "gynec", "gynaec", "women's health"] },
  { label: "Nutrition", icon: "Apple", words: ["nutrition", "diet", "anaemia", "anemia"] },
  { label: "Mental wellness", icon: "Brain", words: ["mental", "counsel", "wellbeing", "well-being", "stress", "anxiety"] },
  { label: "Fitness", icon: "Dumbbell", words: ["fitness", "yoga", "exercise"] },
  { label: "Career", icon: "Briefcase", words: ["career", "interview", "workplace", "teaching", "leadership", "digital literacy"] },
  { label: "Money", icon: "Wallet", words: ["money", "finance", "saving", "loan", "credit", "bookkeeping", "pricing"] },
  { label: "Business", icon: "Store", words: ["business", "online selling", "marketing", "export", "operations", "whatsapp", "enterprise", "cooperative", "registration", "compliance"] },
  { label: "Crafts & skills", icon: "Scissors", words: ["handicraft", "tailoring", "beauty", "mehendi", "craft", "food"] },
  { label: "Rights & family", icon: "Scale", words: ["legal", "rights", "family", "parent"] },
] as Omit<Topic, "pic">[]).map((t) => ({ ...t, pic: masterPicture("mentor_topics", { key: t.label, label: t.label, extra: { synonyms: t.words } }) }));

export let TOPICS: Topic[] = BUILT_IN;

function fromMaster(items: MasterItem[]): Topic[] {
  return items.map((g) => ({
    label: g.label,
    icon: g.extra.icon || "Sparkles",
    words: Array.from(new Set([g.label.toLowerCase(), ...(g.extra.synonyms ?? []),
                               ...(g.children ?? []).map((c) => c.label.toLowerCase())])),
    pic: masterPicture("mentor_topics", g),
  }));
}

/** Load the master into `TOPICS` and re-render when it arrives. Call at the top of a screen. */
export function useMentorTopics(): Topic[] {
  const [list, setList] = useState<Topic[]>(TOPICS);
  useEffect(() => {
    let alive = true;
    loadMaster("mentor_topics").then((items) => {
      if (!alive || !items.length) return;
      TOPICS = fromMaster(items);
      setList(TOPICS);
    }).catch(() => { /* keep the built-in topics */ });
    return () => { alive = false; };
  }, []);
  return list;
}

const text = (m: ApiMentor) => [m.expertise.join(" "), m.headline, m.focus || ""].join(" ").toLowerCase();

/** Does this mentor help with this topic? */
export function inTopic(m: ApiMentor, topic: string): boolean {
  const t = TOPICS.find((x) => x.label.toLowerCase() === topic.toLowerCase());
  if (!t) return text(m).includes(topic.toLowerCase());
  const hay = text(m);
  return t.words.some((w) => hay.includes(w));
}

/** The topic label for a `?topic=` value, matched leniently ("mental wellness", "Pregnancy"). */
export function topicFrom(param: string | null): string {
  if (!param) return "";
  const p = param.toLowerCase();
  return TOPICS.find((t) => t.label.toLowerCase() === p || t.label.toLowerCase().startsWith(p) || p.startsWith(t.label.toLowerCase().split(" ")[0]))?.label ?? "";
}

export type BestTime = "Mornings" | "Afternoons" | "Evenings" | "Weekends";

export function fitsTime(m: ApiMentor, t: BestTime | ""): boolean {
  if (!t) return true;
  const a = (m.availability || "").toLowerCase();
  if (!a || a === "flexible") return true;
  if (t === "Weekends") return /weekend|saturday|sunday/.test(a);
  return a.includes(t.slice(0, -1).toLowerCase());
}

export interface MatchQuiz { topics: string[]; language: string; time: BestTime | ""; freeOnly: boolean }

/** Score our mentors for her answers; the reasons are shown beside each match. */
export function scoreMentors(all: ApiMentor[], q: MatchQuiz) {
  return all
    .filter((m) => !m.is_mine && (!q.freeOnly || !m.price_minor))
    .map((m) => {
      let s = 0;
      const why: string[] = [];
      const hits = q.topics.filter((t) => inTopic(m, t));
      if (hits.length) { s += hits.length * 3; why.push(`Helps with ${hits.join(", ").toLowerCase()}`); }
      if (q.language && m.languages.includes(q.language)) { s += 2; why.push(`Speaks ${q.language}`); }
      if (q.time && fitsTime(m, q.time) && m.availability) { s += 1; why.push(`Free ${m.availability.toLowerCase()}`); }
      if (m.rating >= 4.5 && m.rating_count > 0) { s += 1; why.push(`Rated ${m.rating.toFixed(1)} by women she helped`); }
      if (!m.price_minor) why.push("Free session");
      return { m, s, why };
    })
    .filter((x) => x.s > 0 && (!q.topics.length || x.why[0]?.startsWith("Helps")))
    .sort((a, b) => b.s - a.s || b.m.sessions_done - a.m.sessions_done);
}

/** The first topic this mentor helps with, for a picture when she has no photo. */
export function topicOf(m: ApiMentor): Topic | undefined {
  return TOPICS.find((t) => inTopic(m, t.label));
}

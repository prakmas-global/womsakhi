import { SKILLS } from "@/components/ux/profile/data";

/**
 * Why a job fits her — not just how much.
 *
 * ── The problem with the ring alone ─────────────────────────────────────────
 * A job row drew "92%" in a dial that looks measured. Nothing was measured:
 * the number came from mock data, and `toJob` hardcodes `match: 0` for live
 * listings because nothing ever compared a listing against her profile.
 *
 * A precise-looking number with no derivation is exactly what this product
 * refuses everywhere else — the market shows "no complaints, ever" instead of
 * stars, and the trust record shows counts instead of a score, for the same
 * reason. So the match is computed here from something checkable, and the
 * screen says what produced it.
 *
 * ── Why the missing skill is the useful half ────────────────────────────────
 * "92% match" tells her nothing she can act on. "You have 4 of 5 — you have not
 * done Analytics" tells her whether to apply anyway, and what to learn if she
 * does not. §55 asks for the number; the sentence is the part that helps.
 */

export interface Match {
  /** 0-100, or null when there is nothing to compare against. */
  pct: number | null;
  have: string[];
  missing: string[];
  /** One sentence, in her words. Empty when nothing was computed. */
  because: string;
}

/** Loose comparison — "Social media" should match "social media marketing". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const covers = (mine: string, needed: string) => {
  const a = norm(mine), b = norm(needed);
  return a === b || a.includes(b) || b.includes(a);
};

export function matchFor(needed: string[], mySkills: string[] = SKILLS.map((s) => s.name)): Match {
  if (!needed?.length) {
    return { pct: null, have: [], missing: [], because: "" };
  }

  const have = needed.filter((n) => mySkills.some((m) => covers(m, n)));
  const missing = needed.filter((n) => !have.includes(n));
  const pct = Math.round((have.length / needed.length) * 100);

  // Written the way a person would say it, and always leading with what she
  // HAS. Leading with the gap is how a woman who is qualified talks herself
  // out of applying.
  let because: string;
  if (missing.length === 0) {
    because = `You have all ${needed.length} skills they asked for.`;
  } else if (have.length === 0) {
    // "You cannot do this" is almost never what a zero overlap means. It far
    // more often means her profile is short — most women here have not listed
    // half of what they can do, because listing it feels like boasting. So the
    // sentence points at the profile, not at her.
    because = `Asks for ${needed.join(", ")}. If you can do any of these, add them to your profile — most women list far less than they can do.`;
  } else {
    because = `You have ${have.length} of the ${needed.length} skills they asked for. ` +
      `${missing.length === 1 ? "The one you are missing is" : "The ones you are missing are"} ${missing.join(" and ")}.`;
  }

  return { pct, have, missing, because };
}

/** For the ring's colour and label — a fit is not a grade. */
export function matchTone(pct: number | null) {
  if (pct === null) return { ink: "--ux-muted", label: "Not compared" };
  if (pct >= 80) return { ink: "--ux-green-ink", label: "Strong fit" };
  if (pct >= 50) return { ink: "--ux-amber-ink", label: "Worth a look" };
  // Not "A stretch" and never "Poor match": a low score here usually measures
  // how much she has written down, not what she can do.
  if (pct > 0) return { ink: "--ux-muted", label: "Some of it fits" };
  return { ink: "--ux-muted", label: "Different work" };
}

import type { Job } from "@/components/ux/work/data";

/**
 * Why a job fits her — not just how much.
 *
 * ── Where the match comes from now ──────────────────────────────────────────
 * The server works it out: her skills on My work profile against the skill
 * keys the job was posted with, both from the same work masters
 * (routes/work_talent.py `match_for`). This used to compare the listing's
 * typed skills against a FIXTURE list of skills (`components/ux/profile/data`),
 * so every member saw the same "92% match" against Blouse stitching and
 * Mehendi whatever she could actually do. It is now hers or it is nothing.
 *
 * ── Why the missing skill is the useful half ────────────────────────────────
 * "92% match" tells her nothing she can act on. "You have 2 of 3 — the one you
 * are missing is Embroidery" tells her whether to apply anyway, and what to
 * learn if she does not.
 */

export interface Match {
  /** 0-100, or null when there is nothing to compare against. */
  pct: number | null;
  have: string[];
  missing: string[];
  /** Of `have`, the skills she proved in a WomSakhi skill test. */
  verified: string[];
  /** One sentence, in her words. Empty when nothing was computed. */
  because: string;
}

const NONE: Match = { pct: null, have: [], missing: [], verified: [], because: "" };

export function matchFor(job: Pick<Job, "fit"> | null | undefined): Match {
  const fit = job?.fit;
  if (!fit?.of) return NONE;
  const { have, missing, verified, of } = fit;
  const pct = Math.round((have.length / of) * 100);

  // Always leading with what she HAS. Leading with the gap is how a woman who
  // is qualified talks herself out of applying.
  let because: string;
  if (missing.length === 0) {
    because = of === 1 ? "You have the skill they asked for." : `You have all ${of} skills they asked for.`;
  } else if (have.length === 0) {
    // Zero overlap far more often means her profile is short than that she
    // cannot do the work — so the sentence points at the profile, not at her.
    because = `Asks for ${missing.join(", ")}. If you can do any of these, add them to My work profile.`;
  } else {
    because = `You have ${have.length} of the ${of} skills they asked for. ` +
      `${missing.length === 1 ? "The one you are missing is" : "The ones you are missing are"} ${missing.join(" and ")}.`;
  }
  return { pct, have, missing, verified, because };
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

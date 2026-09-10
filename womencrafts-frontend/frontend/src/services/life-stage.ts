/**
 * Who she is right now — which is not the same as where she is on the journey.
 *
 * ── Why this is separate from `journey.ts` ──────────────────────────────────
 * The journey answers *how far along* she is: has she named a skill, finished
 * an order, been paid. Life stage answers *what kind of year she is having* —
 * and the same journey position means completely different things depending on
 * the answer. A woman at the "find work" stage who is a student wants something
 * that fits around classes; the same stage for a woman returning after eight
 * years away wants something that does not ask what she did in between.
 *
 * Keeping them separate is what stops the product from congratulating a woman
 * on being 40% through a journey when what she actually needs is the one thing
 * that suits a person in her situation.
 *
 * ── Why she chooses it, and can change it ──────────────────────────────────
 * Inferring life stage from behaviour would be both unreliable and unpleasant:
 * an app that decides you are "on a career break" because you stopped opening
 * it has made a judgement about your life from a usage metric. So she picks,
 * in her own words, and can change it the moment it stops being true — which
 * for most of these is a matter of months.
 *
 * ── Why "none of these" is a first-class answer ─────────────────────────────
 * Ten categories cannot hold every woman's situation, and a forced choice
 * produces a wrong answer rather than no answer. Unset is a valid state and
 * the product works without it.
 */

export const LIFE_STAGES = [
  {
    id: "student",
    label: "Still studying",
    detail: "School or college, and looking for something alongside it",
    /** What changes for her, stated plainly on the screen where it applies. */
    shapes: "Short work that fits around classes, and skills that are worth having later",
    icon: "GraduationCap",
    tint: "--ux-tint-blue",
    ink: "--ux-blue-ink",
  },
  {
    id: "starting",
    label: "Just starting out",
    detail: "First job, first customers, first anything",
    shapes: "The steps in order, and nothing that assumes you have done it before",
    icon: "Sunrise",
    tint: "--ux-tint-amber",
    ink: "--ux-amber-ink",
  },
  {
    id: "working",
    label: "Working already",
    detail: "In a job or running something, and want it to go better",
    shapes: "Pricing, bigger orders, and buyers who come back",
    icon: "Briefcase",
    tint: "--ux-tint-violet",
    ink: "--ux-violet",
  },
  {
    id: "break",
    label: "Not working just now",
    detail: "A child, an illness, a move, or simply a pause",
    shapes: "Nothing with a deadline, and nothing that asks why you stopped",
    icon: "PauseCircle",
    tint: "--ux-tint-green",
    ink: "--ux-green-ink",
  },
  {
    id: "restart",
    label: "Coming back to work",
    detail: "After time away, and starting again",
    shapes: "Work that counts what you can do now, not the years in between",
    icon: "RotateCcw",
    tint: "--ux-tint-pink",
    ink: "--ux-pink-ink",
  },
  {
    id: "own",
    label: "Running my own thing",
    detail: "A shop, a kitchen, a service — mine",
    shapes: "Customers, cash flow, and orders too big to take alone",
    icon: "Store",
    tint: "--ux-tint-orange",
    ink: "--ux-orange-ink",
  },
  {
    id: "teaching",
    label: "Teaching or mentoring",
    detail: "Passing on what I know",
    shapes: "Women to teach, and being paid properly for it",
    icon: "Users",
    tint: "--ux-tint-violet",
    ink: "--ux-violet",
  },
] as const;

export type LifeStageId = (typeof LIFE_STAGES)[number]["id"];

export const stageBy = (id: string | null) =>
  LIFE_STAGES.find((s) => s.id === id) ?? null;

/**
 * What each stage should see more of.
 *
 * Deliberately a weighting, not a filter. A woman on a break who wants to look
 * at big contracts must still be able to — the product's job is to put the
 * likely thing first, never to decide what she is allowed to want.
 */
const WEIGHTS: Record<LifeStageId, Record<string, number>> = {
  student:  { course: 3, skill: 2, opportunity: 1, event: 2, woman: 1, circle: 1 },
  starting: { skill: 3, course: 2, woman: 3, circle: 2, opportunity: 2, event: 1 },
  working:  { opportunity: 3, skill: 2, circle: 1, woman: 1, course: 1, event: 1 },
  break:    { circle: 3, woman: 2, course: 2, event: 1, skill: 1, opportunity: 0 },
  restart:  { woman: 3, course: 2, skill: 2, circle: 2, opportunity: 2, event: 1 },
  own:      { opportunity: 3, skill: 2, woman: 2, circle: 1, course: 1, event: 1 },
  teaching: { woman: 3, circle: 3, event: 2, course: 1, skill: 1, opportunity: 1 },
};

/** Higher sorts first. Everything still appears — nothing is filtered out. */
export function weightFor(stage: LifeStageId | null, kind: string): number {
  if (!stage) return 0;
  return WEIGHTS[stage]?.[kind] ?? 0;
}

/* ── where it is stored ───────────────────────────────────────────────────── */

const KEY = "life-stage";

export function readLifeStage(): LifeStageId | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)life-stage=([^;]+)/);
  const v = m?.[1];
  return LIFE_STAGES.some((s) => s.id === v) ? (v as LifeStageId) : null;
}

export function writeLifeStage(id: LifeStageId | null) {
  if (typeof document === "undefined") return;
  document.cookie = id
    ? `${KEY}=${id};path=/;max-age=31536000;samesite=lax`
    : `${KEY}=;path=/;max-age=0;samesite=lax`;
}

/**
 * The Skill → Income journey, and the one step that comes next.
 *
 * ── Why this is a service and not a component ───────────────────────────────
 * Home, My Journey, Learn, Work and Earn all need to answer the same question —
 * *what should she do next?* — and if each answers it separately they will
 * disagree within a week. One function decides; every surface renders what it
 * returns.
 *
 * This also sits where the repository layer will go: today `currentState()`
 * reads mock data, later it reads the API, and nothing above it changes.
 *
 * ── Why a stage machine and not a list of tips ──────────────────────────────
 * A tip is advice. A stage is a position — it tells her where she *is*, which
 * is what makes the next step feel earned rather than nagged. The seven stages
 * are the product's core claim: a skill becomes income by a route that can be
 * drawn.
 *
 *   SKILL → LEARN → PRACTICE → BUILD → OPPORTUNITY → EARN → GROW
 *
 * ── The rule that keeps it honest ───────────────────────────────────────────
 * Exactly ONE next step is ever shown. The moment it becomes a list of five
 * suggestions it is a dashboard again, and the woman who most needs direction
 * is the one who will read five options and close the app.
 */

export const STAGES = [
  { id: "skill",       label: "Your skill",   verb: "Name what you can do" },
  { id: "learn",       label: "Learn",        verb: "Get better at it" },
  { id: "practice",    label: "Practice",     verb: "Do it for real" },
  { id: "build",       label: "Show it",      verb: "Make proof you can" },
  { id: "opportunity", label: "Find work",    verb: "Put it in front of someone" },
  { id: "earn",        label: "Earn",         verb: "Get paid for it" },
  { id: "grow",        label: "Grow",         verb: "Do more of what works" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/**
 * What we know about her. Every field is something the app can actually
 * observe — not a survey answer, because a woman who is asked to self-assess
 * will under-rate herself, which is the exact bias this product exists to
 * correct.
 */
export interface JourneyState {
  skills: number;
  coursesDone: number;
  coursesInProgress: number;
  /** Work actually finished — the only evidence that a skill is real. */
  ordersDone: number;
  hasPortfolio: boolean;
  applications: number;
  /** Paise. Zero is a meaningful state, not a missing one. */
  earnedMinor: number;
  hasShop: boolean;
  productsListed: number;
  circles: number;
  hasMentor: boolean;
  monthsActive: number;
}

export interface NextStep {
  /** The stage this step belongs to — so the journey can show where she is. */
  stage: StageId;
  /** Second person, present tense, one action. Never a sentence with "should". */
  title: string;
  /** Why this, now. Grounded in something she did, never generic encouragement. */
  because: string;
  cta: string;
  href: string;
  icon: string;
  /** Roughly how long, so she can decide if she has time right now. */
  mins?: number;
}

/**
 * Where she is on the journey.
 *
 * Read top-down: the furthest stage she has real evidence for. Evidence is
 * always something she DID — money received, an order finished, a product
 * listed. Intentions do not move her forward, which is what stops the journey
 * from congratulating her for browsing.
 */
export function stageFor(s: JourneyState): StageId {
  if (s.earnedMinor > 0 && s.monthsActive >= 3) return "grow";
  if (s.earnedMinor > 0) return "earn";
  if (s.applications > 0 || s.productsListed > 0) return "opportunity";
  if (s.hasPortfolio || s.ordersDone > 0) return "build";
  if (s.coursesDone > 0 || s.coursesInProgress > 0) return "practice";
  if (s.skills > 0) return "learn";
  return "skill";
}

/**
 * The single next step.
 *
 * Ordered by what unblocks the most, not by what is easiest to build. The
 * first match wins, so the order of these clauses IS the product's opinion
 * about what matters — read it as a priority list, and change the order rather
 * than adding conditions when that opinion changes.
 */
export function nextStep(s: JourneyState): NextStep {
  if (s.skills === 0)
    return { stage: "skill", title: "Name one thing you can already do",
      because: "Everything here starts from a skill. Yours does not have to be a job title — stitching, cooking and mehendi all count.",
      cta: "Add your skill", href: "/app/skills", icon: "Sparkles", mins: 2 };

  if (s.hasShop && s.productsListed === 0)
    return { stage: "opportunity", title: "Put your first thing in your shop",
      because: "Your shop is open but empty, so nobody can buy from you yet. You can say it out loud instead of typing it.",
      cta: "Add it by speaking", href: "/app/shop/voice", icon: "Mic", mins: 3 };

  if (s.coursesInProgress > 0 && s.coursesDone === 0)
    return { stage: "learn", title: "Finish the course you started",
      because: "You are most of the way through. Finishing it is what turns it into something you can show someone.",
      cta: "Continue learning", href: "/app/programs", icon: "BookOpen", mins: 14 };

  if (s.coursesDone > 0 && !s.hasPortfolio)
    return { stage: "build", title: "Make proof of what you can do",
      because: `You have finished ${s.coursesDone} ${s.coursesDone === 1 ? "course" : "courses"}. A certificate says you learned it — work you can show says you can do it.`,
      cta: "Build your proof", href: "/app/profile", icon: "FileText", mins: 15 };

  if (s.hasPortfolio && s.applications === 0)
    return { stage: "opportunity", title: "Put yourself forward for one job",
      because: "You have the proof ready. The only thing between it and money is someone seeing it.",
      cta: "Find work that fits", href: "/app/opportunities", icon: "Briefcase", mins: 10 };

  if (s.ordersDone > 0 && s.earnedMinor === 0)
    return { stage: "earn", title: "Ask for the money you are owed",
      because: `You have finished ${s.ordersDone} orders and none of it has reached your bank. Send the person a link.`,
      cta: "Ask to be paid", href: "/app/collect", icon: "QrCode", mins: 2 };

  if (s.circles === 0)
    return { stage: "grow", title: "Join one circle near you",
      because: "Almost every woman here who found work found it through someone she knew, not through a listing.",
      cta: "See circles near you", href: "/app/circles", icon: "UsersRound", mins: 5 };

  if (!s.hasMentor)
    return { stage: "grow", title: "Talk to a woman who is further along",
      because: "She has done the thing you are trying to do, in the place you are trying to do it.",
      cta: "Find a mentor", href: "/app/mentors", icon: "Users", mins: 10 };

  return { stage: "grow", title: "Show someone else how you did it",
    because: "You have got somewhere real. Teaching one woman is the fastest way to make it count for more than you.",
    cta: "Help someone", href: "/app/together", icon: "Handshake", mins: 20 };
}

/** How far along, for a progress bar that means something. */
export function journeyPct(s: JourneyState): number {
  const i = STAGES.findIndex((x) => x.id === stageFor(s));
  return Math.round(((i + 1) / STAGES.length) * 100);
}

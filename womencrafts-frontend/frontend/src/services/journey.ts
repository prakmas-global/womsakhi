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
  /**
   * How many skills she has named.
   *
   * **`null` means nothing in this system records it.** There is no skills
   * field on a member: `expertise` belongs to a mentor and `skills` to an
   * opportunity listing, and neither one is hers. Every rule below that would
   * have read this skips itself rather than guessing, because "you have not
   * named a skill" is a thing we would be saying, not observing.
   */
  skills: number | null;
  coursesDone: number;
  coursesInProgress: number;
  /** Work actually finished — the only evidence that a skill is real. */
  ordersDone: number;
  /**
   * **`null` — no source.** This product has no portfolio yet: there is
   * nowhere to upload work samples and nothing that stores them. A `false`
   * here would be the app telling her she has not done something it never
   * offered her.
   */
  hasPortfolio: boolean | null;
  applications: number;
  /** Paise. Zero is a meaningful state, not a missing one. */
  earnedMinor: number;
  /**
   * **`null` — no source.** "Opening a shop" is not an event this system
   * records; every active member can list something, and `/shop/summary`
   * answers for a woman who has never sold anything. `true` was hardcoded
   * here for months, which is what made "Open your shop" tick itself.
   */
  hasShop: boolean | null;
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
export function stageFor(s: JourneyState): StageId | null {
  if (s.earnedMinor > 0 && s.monthsActive >= 3) return "grow";
  if (s.earnedMinor > 0) return "earn";
  if (s.applications > 0 || s.productsListed > 0) return "opportunity";
  if (s.hasPortfolio === true || s.ordersDone > 0) return "build";
  if (s.coursesDone > 0 || s.coursesInProgress > 0) return "practice";
  // The last two rungs rest entirely on a field nothing records. `null` is
  // "we cannot place her", and a screen must show her what it does know
  // instead of standing her at the start of a journey she may be halfway
  // along — being told you are at square one when you are not is the one
  // mistake this screen cannot recover from.
  if (s.skills === null) return null;
  return s.skills > 0 ? "learn" : "skill";
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
  // Every clause below reads `=== true` / `=== false` rather than truthiness,
  // because three of these fields can be `null` — "this system does not record
  // it" — and `!s.hasPortfolio` was reading that null as "she has no proof".
  // It fired "Make proof of what you can do" at a woman who has finished nine
  // courses, on the strength of a field nothing has ever written. An unknown
  // field now skips its clause, and the first clause that rests on something
  // observed wins instead.
  if (s.skills === 0)
    return { stage: "skill", title: "Name one thing you can already do",
      because: "Everything here starts from a skill. Yours does not have to be a job title — stitching, cooking and mehendi all count.",
      cta: "Add your skill", href: "/app/profile", icon: "Sparkles", mins: 2 };

  if (s.hasShop === true && s.productsListed === 0)
    return { stage: "opportunity", title: "Put your first thing in your shop",
      because: "Your shop is open but empty, so nobody can buy from you yet. You can say it out loud instead of typing it.",
      cta: "Add it by speaking", href: "/app/shop/voice", icon: "Mic", mins: 3 };

  if (s.coursesInProgress > 0 && s.coursesDone === 0)
    return { stage: "learn", title: "Finish the course you started",
      because: "You are most of the way through. Finishing it is what turns it into something you can show someone.",
      cta: "Continue learning", href: "/app/programs", icon: "BookOpen", mins: 14 };

  if (s.coursesDone > 0 && s.hasPortfolio === false)
    return { stage: "build", title: "Make proof of what you can do",
      because: `You have finished ${s.coursesDone} ${s.coursesDone === 1 ? "course" : "courses"}. A certificate says you learned it — work you can show says you can do it.`,
      cta: "Build your proof", href: "/app/profile", icon: "FileText", mins: 15 };

  if (s.hasPortfolio === true && s.applications === 0)
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
export function journeyPct(s: JourneyState): number | null {
  const stage = stageFor(s);
  // No stage, no percentage. `findIndex` returning -1 used to render 14%.
  if (stage === null) return null;
  const i = STAGES.findIndex((x) => x.id === stage);
  return Math.round(((i + 1) / STAGES.length) * 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   The seven steps, as she walks them
   ══════════════════════════════════════════════════════════════════════════

   `STAGES` above answers "where is she?" in one word, and Home and For You
   read it that way. This answers a different question — "what is left in the
   step she is standing in?" — and needs the step broken into the things she
   would actually tick off.

   Every check below is observed, never asked. A woman who is invited to rate
   herself rates herself low, and correcting that bias is half of why this
   product exists. */

/** What the steps can be computed from: her shop, her learning, and her profile. */
export interface JourneyFacts extends JourneyState {
  /**
   * How complete her profile is, as a percentage.
   *
   * `null` when we cannot get the real one. The number the app had here was
   * `/me/progress.completion_rate`, which is the furthest-along *course*
   * percentage under a name that reads like a profile — so a woman who had
   * finished a course was told her profile was 100% complete while four of
   * its five fields were empty. See `me.repository`.
   */
  profilePct: number | null;
  verified: boolean;
  hasAvatar: boolean;
  /**
   * The line she has written about her own work — `""` when she has not
   * written one. Her words, never a stand-in: this was a module constant
   * ("Dream • Learn • Achieve") printed as a quotation with her name under it.
   */
  bio: string;
}

export interface StepCheck {
  label: string;
  done: boolean;
  /** Not counted against her — the wireframe's "(optional)" line. */
  optional?: boolean;
}

/**
 * A check before we know whether it can be answered.
 *
 * `done: null` is not "not done" — it is "this system does not record it".
 * Drawing it as an empty box tells a woman she has not done something we have
 * no way of seeing, and an empty box on this screen is an instruction. So
 * `observed()` drops them, and a step shows fewer boxes rather than wrong ones.
 */
interface MaybeCheck {
  label: string;
  done: boolean | null;
  optional?: boolean;
}

const observed = (checks: MaybeCheck[]): StepCheck[] =>
  checks.filter((c): c is StepCheck => c.done !== null);

export type StepState = "done" | "doing" | "todo";

export interface JourneyStep {
  id: string;
  /** 1-7, because the screen says "Step 2 of 7" out loud. */
  n: number;
  label: string;
  /** One line, second person, about what this step gets her. */
  blurb: string;
  icon: string;
  tint: string;
  ink: string;
  cta: string;
  href: string;
  checks: StepCheck[];
}

export function journeySteps(f: JourneyFacts): JourneyStep[] {
  return [
    {
      id: "skills", n: 1, label: "Your skills",
      blurb: "Name what you can already do. It does not have to be a job title — stitching, cooking and mehendi all count.",
      icon: "Sparkles", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
      cta: "Add a skill", href: "/app/profile",
      // Both skill checks disappear until something stores a skill against a
      // woman. They used to read a fixture of five and tick themselves.
      checks: observed([
        { label: "Name one thing you can do", done: f.skills === null ? null : f.skills > 0 },
        { label: "Add a second skill", done: f.skills === null ? null : f.skills > 1, optional: true },
        { label: "Start a course in it", done: f.coursesDone + f.coursesInProgress > 0 },
      ]),
    },
    {
      id: "proof", n: 2, label: "Your proof",
      blurb: "Show what you can do. Add your work samples, certificates or photos. This helps people trust your skills and gives you more opportunities.",
      icon: "FolderOpen", tint: "--ux-tint-pink", ink: "--ux-pink-ink",
      cta: "Build your proof", href: "/app/profile",
      checks: observed([
        // Only the listing half is observable — there is no portfolio in this
        // product — and a thing she has listed, with its photograph, is a work
        // sample she has genuinely put up.
        { label: "Upload at least 1 work sample", done: f.hasPortfolio === true || f.productsListed > 0 },
        { label: "Add a course certificate", done: f.coursesDone > 0, optional: true },
        { label: "Write a short description about your work", done: f.bio.trim().length > 0 },
      ]),
    },
    {
      id: "profile", n: 3, label: "Your profile",
      blurb: "The page a buyer or an employer reads before they decide. A photograph and a verified badge do more than any sentence.",
      icon: "UserRound", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
      cta: "Finish your profile", href: "/app/profile",
      checks: observed([
        { label: "Add your photograph", done: f.hasAvatar },
        { label: "Get verified", done: f.verified },
        { label: "Complete every part of it",
          done: f.profilePct === null ? null : f.profilePct >= 100 },
      ]),
    },
    {
      id: "opportunity", n: 4, label: "Your first opportunity",
      blurb: "Put yourself in front of someone. A shop with something in it, or one job you have asked for.",
      icon: "Briefcase", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
      cta: "Find work that fits", href: "/app/opportunities",
      checks: observed([
        // "Open your shop" is gone rather than ticked. Nothing records opening
        // one — the field was a hardcoded `true`, so this box was green for
        // every woman in the app on her first morning.
        { label: "Open your shop", done: f.hasShop },
        { label: "List something to sell", done: f.productsListed > 0 },
        { label: "Ask for one job", done: f.applications > 0 },
      ]),
    },
    {
      id: "earning", n: 5, label: "Your first earning",
      blurb: "Finish the work, then ask for the money. Neither one counts on its own.",
      icon: "Wallet", tint: "--ux-tint-green", ink: "--ux-green-ink",
      cta: "Ask to be paid", href: "/app/collect",
      checks: observed([
        { label: "Finish one order", done: f.ordersDone > 0 },
        { label: "Get the money into your bank", done: f.earnedMinor > 0 },
      ]),
    },
    {
      id: "grow", n: 6, label: "Grow your work",
      blurb: "Almost every woman here who found more work found it through someone she knew, not through a listing.",
      icon: "TrendingUp", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
      cta: "See circles near you", href: "/app/circles",
      checks: observed([
        { label: "Join one circle", done: f.circles > 0 },
        { label: "Talk to a woman further along", done: f.hasMentor },
        { label: "Finish a course", done: f.coursesDone > 0 },
      ]),
    },
    {
      id: "future", n: 7, label: "Build your future",
      blurb: "Earning three months running is the point where this stops being a try and starts being work.",
      icon: "Rocket", tint: "--ux-tint-lilac", ink: "--ux-brand",
      cta: "Set a goal", href: "/app/goals",
      checks: observed([
        { label: "Three months on WomSakhi", done: f.monthsActive >= 3 },
        { label: "Earning, not just once", done: f.earnedMinor > 0 && f.monthsActive >= 3 },
        { label: "Be in more than one circle", done: f.circles > 1 },
      ]),
    },
  ];
}

/**
 * Done, doing, or not begun.
 *
 * An optional check cannot hold a step back — it can only push it from "not
 * begun" into "started", which is the honest reading of ticking one.
 */
export function stepState(s: JourneyStep): StepState {
  const needed = s.checks.filter((c) => !c.optional);
  const doneNeeded = needed.filter((c) => c.done).length;
  if (needed.length > 0 && doneNeeded === needed.length) return "done";
  if (s.checks.some((c) => c.done)) return "doing";
  return "todo";
}

/** How far through this one step, counting only what it requires. */
export function stepPct(s: JourneyStep): number {
  const needed = s.checks.filter((c) => !c.optional);
  if (needed.length === 0) return 0;
  return Math.round((needed.filter((c) => c.done).length / needed.length) * 100);
}

/** The step she is standing in: the first not finished, else the last. */
export function currentStep(steps: JourneyStep[]): JourneyStep {
  return steps.find((s) => stepState(s) !== "done") ?? steps[steps.length - 1];
}

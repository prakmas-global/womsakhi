/**
 * Where "what do we know about her" comes from.
 *
 * ── The seam ────────────────────────────────────────────────────────────────
 * Everything above this file — the journey engine, Home, My Journey — asks for
 * a `JourneyState` and does not know or care where it came from. Today it is
 * assembled from the mock modules. When the API is ready, only the body of
 * `getJourneyState` changes; no screen is touched.
 *
 * That is the whole reason this exists as a separate file rather than an
 * import inside a component: a mock imported directly into JSX becomes 40 call
 * sites to find and rewrite later.
 *
 * ── Deliberately assembled, not stored ──────────────────────────────────────
 * The state is DERIVED from things the app already records — orders finished,
 * money received, products listed. It is never a stored "stage" field, because
 * a stored stage goes stale the moment she does something and drifts from what
 * the rest of the app shows her.
 */
import { JOURNEY, SKILLS, CIRCLES, EARNINGS } from "@/components/ux/home/data";
import { REQUESTS, paidTotal } from "@/components/ux/reach/data";
import { PROOFS } from "@/components/ux/eight/data";
import type { JourneyState } from "./journey";

/** Simulates the latency a real call will have, so loading states are real. */
const LATENCY_MS = 0;

export async function getJourneyState(): Promise<JourneyState> {
  if (LATENCY_MS) await new Promise((r) => setTimeout(r, LATENCY_MS));
  return readJourneyState();
}

/** The synchronous read, for server components and for tests. */
export function readJourneyState(): JourneyState {
  const ordersDone = PROOFS.find((p) => p.id === "p2")?.count ?? 0;
  const monthsActive = PROOFS.find((p) => p.id === "p4")?.count ?? 0;

  return {
    skills: SKILLS.length,
    coursesDone: JOURNEY.done,
    coursesInProgress: JOURNEY.done < JOURNEY.total ? 1 : 0,
    ordersDone,
    hasPortfolio: false,
    applications: 0,
    earnedMinor: paidTotal(REQUESTS),
    hasShop: true,
    productsListed: 5,
    circles: CIRCLES.length,
    hasMentor: false,
    monthsActive,
  };
}

/** Everything the mock knows about her, for surfaces that need more than the journey. */
export function readMe() {
  return { earnings: EARNINGS, skills: SKILLS, circles: CIRCLES, course: JOURNEY };
}

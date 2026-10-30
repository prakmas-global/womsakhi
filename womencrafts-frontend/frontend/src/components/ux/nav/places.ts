import { SECTIONS, type NavNode } from "@/components/ux/nav-tree";

/**
 * The picture of every place in the app — so a woman who cannot read the
 * label can still find it, and still knows where she is.
 *
 * ── Two kinds of picture ────────────────────────────────────────────────────
 * A PHOTO where the app's library has one that plainly shows the thing:
 * a woman at a sewing machine for tailoring, a market stall for the market,
 * a woman with a suitcase for travel. A photo of the real activity is the
 * most recognisable picture there is.
 *
 * A PICTOGRAM everywhere else — settings, alerts, the wallet, rights, a QR
 * code — because a photo of an idea is a guess, and a wrong picture is worse
 * than none. The pictogram is the place's own icon, large and white, on the
 * brand gradient (`--ux-pic-ground` in tokens.css) — every module alike: the
 * picture tells places apart, the brand keeps them one product.
 *
 * A photo is chosen by the place's id rather than read from its words: these
 * are a few dozen deliberate choices, and a keyword match would pick the
 * tailoring photo for "Selling tools" because it contains "sell".
 */

const A = (name: string) => `/ux/art/${name}.webp`;

/** Places whose photo is unmistakable. Everything else is a pictogram. */
const PHOTO: Record<string, string> = {
  // Home
  stories: A("scene-women-celebrating"),
  journey: A("scene-woman-climbing-steps"),
  goals: A("circle-vision-board"),
  sakhi: A("sakhi-ask-me"),
  // Learn
  learn: A("onboarding-learn-v2"),
  programs: A("course-reading-open-book"),
  mentors: A("course-video-call-mentor"),
  certificates: A("course-holding-certificate"),
  library: A("course-teaching-another-woman"),
  // Work
  work: A("onboarding-work-v2"),
  contracts: A("scene-woman-packing-orders"),
  intake: A("scene-woman-writing-notes"),
  // Earn
  earn: A("onboarding-earn-v2"),
  services: A("earn-shop"),
  documents: A("scene-woman-shop-owner"),
  shop: A("course-photographing-handmade-product"),
  kitchen: A("work-dashboard-kitchen"),
  teach: A("course-presenting-to-group"),
  mentoring: A("scene-elder-woman-mentoring"),
  market: A("course-handmade-market-stall"),
  money: A("scene-woman-writing-notes"),
  khata: A("scene-woman-writing-notes"),
  rent: A("circle-sharing-help"),
  "rent-mine": A("scene-woman-packing-orders"),
  "khata-chits": A("course-counting-coins-calculator"),
  haq: A("scene-woman-reading-document"),
  // Community
  circle: A("onboarding-circle-v2"),
  "community-friends": A("circle-hands-together"),
  circles: A("circle-women-talking"),
  events: A("circle-rooftop-evening"),
  together: A("circle-sharing-help"),
  "together-learn": A("circle-study-group"),
  swap: A("empty-gift-box-ribbons"),
  // Health & Wellness
  wellness: A("onboarding-wellbeing-all-ages-v2"),
  mind: A("scene-woman-meditating"),
  "health-mentors": A("scene-two-women-support"),
  // Help
  help: A("onboarding-help-safety-v2"),
  family: A("scene-mother-baby-laptop"),
  school: A("scene-woman-teaching-children"),
  travel: A("scene-woman-with-trolley-bag"),
};

/** Every node's section, worked out once. */
const SECTION_OF = new Map<string, string>();
for (const s of SECTIONS) {
  const walk = (ns: NavNode[]) => ns.forEach((n) => { SECTION_OF.set(n.id, s.id); if (n.children) walk(n.children); });
  walk([s]);
}

export interface Place {
  /** The section it belongs to: home, learn, work, earn, circle, wellness, help, account. */
  section: string;
  /** A photo, when one plainly shows it; otherwise "" and the pictogram is drawn. */
  photo: string;
  /** The pictogram — the place's own icon. */
  icon: string;
}

export function placeOf(node: Pick<NavNode, "id" | "icon">): Place {
  const section = SECTION_OF.get(node.id) ?? "home";
  return { section, photo: PHOTO[node.id] ?? "", icon: node.icon };
}

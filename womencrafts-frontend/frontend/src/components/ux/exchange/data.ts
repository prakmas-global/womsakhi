/**
 * Skill Exchange — teaching each other, without money changing hands.
 *
 * The unit here is an OFFER or an ASK, deliberately symmetrical: the same woman
 * is usually both, and a screen that treats teaching and learning as separate
 * roles quietly tells her she is only one of them.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Swap = {
  id: string;
  side: "Offering" | "Looking for";
  skill: string;
  detail: string;
  who: string;
  avatar: string;
  place: string;
  online: boolean;
  level: "Beginner" | "Any level" | "Experienced";
  wants: string;
  tint: string;
  ink: string;
  icon: string;
  matches: number;
  mine?: boolean;
};

export const SWAPS: Swap[] = [
  { id: "x1", side: "Offering", skill: "Blouse fitting and finishing", detail: "The finishing that lets you charge double. Two afternoons.",
    who: "Sushila Devi", avatar: A("avatar-woman-elder-saree"), place: "Patna", online: false,
    level: "Any level", wants: "Help with using a smartphone for orders",
    tint: "--ux-tint-orange", ink: "--ux-orange", icon: "Scissors", matches: 4 },
  { id: "x2", side: "Looking for", skill: "Basic English conversation", detail: "Enough to talk to customers on a call without freezing.",
    who: "Razia Sultana", avatar: A("avatar-woman-hijab"), place: "Lucknow", online: true,
    level: "Beginner", wants: "I can teach mehendi and basic beauty work",
    tint: "--ux-tint-blue", ink: "--ux-blue", icon: "Languages", matches: 7 },
  { id: "x3", side: "Offering", skill: "Photographing your products", detail: "Phone only. Light, background, the three angles that sell.",
    who: "Lakshmi Iyer", avatar: A("avatar-woman-blue-saree"), place: "Chennai", online: true,
    level: "Any level", wants: "Someone to teach me bookkeeping",
    tint: "--ux-tint-violet", ink: "--ux-violet", icon: "Camera", matches: 11 },
  { id: "x4", side: "Offering", skill: "Keeping simple business books", detail: "One notebook, four columns. No software.",
    who: "Kavita Shah", avatar: A("avatar-woman-pink-glasses"), place: "Ahmedabad", online: true,
    level: "Beginner", wants: "Someone to teach me Instagram",
    tint: "--ux-tint-green", ink: "--ux-green", icon: "Table2", matches: 9 },
  { id: "x5", side: "Looking for", skill: "Cake decorating", detail: "I bake well but my finishing lets me down.",
    who: "Farah Khan", avatar: A("avatar-woman-teal-shirt"), place: "Jaipur", online: false,
    level: "Any level", wants: "I can teach tailoring basics in return",
    tint: "--ux-tint-pink", ink: "--ux-pink", icon: "CakeSlice", matches: 3 },
  { id: "x6", side: "Offering", skill: "Instagram for a small shop", detail: "Posting, captions and replying to enquiries. Four short sessions.",
    who: "Priya Sharma", avatar: A("avatar-woman-purple-kurta"), place: "Jaipur", online: true,
    level: "Beginner", wants: "Someone to teach me blouse finishing",
    tint: "--ux-tint-lilac", ink: "--ux-brand", icon: "Megaphone", matches: 6, mine: true },
];

/** Where an exchange has got to, once two women have agreed. */
export const MY_SWAPS = [
  { id: "ms1", swapId: "x1", with: "Sushila Devi", avatar: A("avatar-woman-elder-saree"),
    youTeach: "Instagram for a small shop", youLearn: "Blouse fitting and finishing",
    state: "Agreed" as const, next: "First session Sat 31 May, 4 PM" },
  { id: "ms2", swapId: "x4", with: "Kavita Shah", avatar: A("avatar-woman-pink-glasses"),
    youTeach: "Instagram for a small shop", youLearn: "Keeping simple business books",
    state: "She replied" as const, next: "She suggested three times — pick one" },
];

export const SKILL_TAGS = [
  "Tailoring", "English", "Photography", "Bookkeeping", "Baking", "Social media", "Mehendi", "Computer basics",
];

export const EXCHANGE_ART = { empty: A("empty-open-notebook-pen"), hero: A("scene-woman-teaching-children") };

/**
 * What fills a screen's empty space: words from women, and the rest of the app.
 *
 * Quotes are only ones whose wording and author are well established — a
 * misattributed line on a screen about trust undoes the trust. WomSakhi's own
 * lines are signed as WomSakhi.
 */

export type Quote = { text: string; by: string; who?: string };

export const QUOTES: Quote[] = [
  { text: "One child, one teacher, one book, one pen can change the world.", by: "Malala Yousafzai", who: "Nobel Peace Prize laureate" },
  { text: "We realise the importance of our voices only when we are silenced.", by: "Malala Yousafzai", who: "Nobel Peace Prize laureate" },
  { text: "The path from dreams to success does exist. May you have the vision to find it, the courage to get on to it, and the perseverance to follow it.", by: "Kalpana Chawla", who: "Astronaut" },
  { text: "You cannot shake hands with a clenched fist.", by: "Indira Gandhi", who: "Former Prime Minister of India" },
  { text: "Nothing in life is to be feared, it is only to be understood.", by: "Marie Curie", who: "Scientist, two Nobel Prizes" },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", by: "Louisa May Alcott", who: "Author, Little Women" },
  { text: "If you don't like the road you're walking, start paving another one.", by: "Dolly Parton", who: "Singer and songwriter" },
  { text: "The most common way people give up their power is by thinking they don't have any.", by: "Alice Walker", who: "Author" },
  { text: "A woman with a voice is, by definition, a strong woman.", by: "Melinda French Gates", who: "Philanthropist" },
  { text: "Small steps, taken every day, become a road no one can take from you.", by: "WomSakhi" },
  { text: "What your hands can make, your hands can sell. Begin with one.", by: "WomSakhi" },
  { text: "Asking for help is not weakness. It is how women have always lifted each other.", by: "WomSakhi" },
  { text: "Your skill is your savings. Every lesson you finish is money in the bank of you.", by: "WomSakhi" },
  { text: "Rest is not lost time. A calm mind earns, learns and decides better.", by: "WomSakhi" },
];

/** True things worth a second look — each with where to go next. */
export const FACTS: { text: string; href: string; cta: string }[] = [
  { text: "A home food business needs only the basic FSSAI registration — about ₹100 a year.", href: "/app/kitchen", cta: "See the steps" },
  { text: "Women who learn with a friend are more likely to keep using what they learned.", href: "/app/library", cta: "Find a learning partner" },
  { text: "Banks never ask for your OTP or UPI PIN. Anyone who does is trying to cheat you.", href: "/app/safe-money", cta: "Know the money traps" },
  { text: "Writing every sale in a book gives you proof of income a landlord or bank will accept.", href: "/app/books", cta: "Open my money book" },
  { text: "Many government schemes go unclaimed because women are not told they qualify.", href: "/app/haq", cta: "Check what you are owed" },
  { text: "Passing a skill test puts a Verified badge on your profile that hirers can trust.", href: "/app/assess", cta: "Prove a skill" },
];

export type Shortcut = { section: string; href: string; label: string; note: string; image: string };

const A = (n: string) => `/ux/art/${n}.webp`;

/** The rest of the app, as pictures. `section` is the nav section it belongs to. */
export const SHORTCUTS: Shortcut[] = [
  { section: "work", href: "/app/opportunities", label: "Find work", note: "Jobs that fit your skills", image: A("work-dashboard-tailoring") },
  { section: "work", href: "/app/work/profile", label: "My work profile", note: "Let the right work find you", image: A("work-dashboard-data") },
  { section: "learn", href: "/app/programs", label: "Courses", note: "Learn something new this week", image: A("course-reading-open-book") },
  { section: "learn", href: "/app/mentors", label: "Mentors", note: "Talk to a woman who has done it", image: A("course-video-call-mentor") },
  { section: "learn", href: "/app/assess", label: "Prove your skills", note: "Earn a Verified badge", image: A("course-holding-certificate") },
  { section: "earn", href: "/app/services", label: "My services", note: "Sell, teach or mentor", image: A("earn-shop") },
  { section: "earn", href: "/app/market", label: "The market", note: "Buy from women you know", image: A("course-handmade-market-stall") },
  { section: "earn", href: "/app/haq", label: "What you are owed", note: "Government money in your name", image: A("course-counting-coins-calculator") },
  { section: "circle", href: "/app/circles", label: "Circles", note: "Women who have your back", image: A("circle-hands-together") },
  { section: "circle", href: "/app/events", label: "Events", note: "Workshops and melas near you", image: A("course-presenting-to-group") },
  { section: "wellness", href: "/app/health/games", label: "Calm games", note: "A few quiet minutes", image: A("course-meditation") },
  { section: "wellness", href: "/app/health/cycle", label: "Cycle tracker", note: "One tap a day", image: A("learn-dashboard-mindfulness") },
  { section: "help", href: "/app/safety", label: "Get help now", note: "Your people, one tap away", image: A("onboarding-help-safety-v2") },
  { section: "home", href: "/app/sakhi", label: "Ask Sakhi", note: "Your helper, any question", image: A("circle-sharing-help") },
];

/** Same pick all day, a new one tomorrow — and different per screen. */
export function dailyIndex(len: number, salt = ""): number {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${salt}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, len);
}

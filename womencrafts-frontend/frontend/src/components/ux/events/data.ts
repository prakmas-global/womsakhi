/**
 * Events — melas, workshops and webinars.
 *
 * A mela is a place she goes to sell; a webinar is something she watches. They
 * are kept apart because the decision is different: one costs a day and a stall
 * fee, the other costs an hour.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type EventKind = "Mela" | "Workshop" | "Webinar" | "Meet";

export type Ev = {
  id: string;
  title: string;
  kind: EventKind;
  when: string;
  day: string;
  month: string;
  time: string;
  place: string;
  online: boolean;
  art: string;
  tint: string;
  ink: string;
  icon: string;
  blurb: string;
  fee_minor: number;
  spots: number;
  taken: number;
  going: boolean;
  /**
   * Carried by the API and previously dropped by the adapter.
   *
   * The event screens filled the space where these belong with generic
   * invented copy — "Arrive by 9:30", "Nearest bus: Route 12 and 34" — under
   * every venue in the country. Real values are better than good guesses, and
   * absent is better than either when the server does not know.
   */
  host?: string;
  language?: string;
  duration?: string;
};

export const EVENTS: Ev[] = [
  { id: "e1", title: "Craft Mela — Jaipur", kind: "Mela", when: "Sat 24 May", day: "24", month: "MAY",
    time: "10:00 AM – 4:00 PM", place: "Community Hall, Sector 12", online: false,
    art: A("course-handmade-market-stall"), tint: "--ux-tint-pink", ink: "--ux-pink", icon: "Store",
    blurb: "A day stall of your own. Bring what you make; we bring the customers.",
    fee_minor: 30000, spots: 40, taken: 28, going: true },
  { id: "e2", title: "Women in Tech Webinar", kind: "Webinar", when: "Wed 21 May", day: "21", month: "MAY",
    time: "7:00 PM – 8:30 PM", place: "Online", online: true,
    art: A("course-video-call-mentor"), tint: "--ux-tint-blue", ink: "--ux-blue", icon: "Video",
    blurb: "Four women who changed careers after thirty, and how they did it.",
    fee_minor: 0, spots: 500, taken: 340, going: true },
  { id: "e3", title: "Pricing your work properly", kind: "Workshop", when: "Thu 29 May", day: "29", month: "MAY",
    time: "4:00 PM – 6:00 PM", place: "WomSakhi Centre, Jaipur", online: false,
    art: A("course-counting-coins-calculator"), tint: "--ux-tint-green", ink: "--ux-green", icon: "Calculator",
    blurb: "Two hours on what to charge. Bring one thing you sell and its costs.",
    fee_minor: 0, spots: 25, taken: 25, going: false },
  { id: "e4", title: "Photograph what you make", kind: "Workshop", when: "Sat 7 June", day: "07", month: "JUN",
    time: "11:00 AM – 1:00 PM", place: "Online", online: true,
    art: A("course-photographing-handmade-product"), tint: "--ux-tint-violet", ink: "--ux-violet", icon: "Camera",
    blurb: "Your phone is enough. Learn light, background and the three angles that sell.",
    fee_minor: 10000, spots: 60, taken: 22, going: false },
  { id: "e5", title: "Sakhi Meet — Jaipur circle", kind: "Meet", when: "Sun 15 June", day: "15", month: "JUN",
    time: "5:00 PM – 7:00 PM", place: "Central Park, Jaipur", online: false,
    art: A("scene-women-group-circle"), tint: "--ux-tint-orange", ink: "--ux-orange", icon: "UsersRound",
    blurb: "Tea, and the women you have only met on a screen.",
    fee_minor: 0, spots: 80, taken: 47, going: false },
];

export const EVENT_KINDS: EventKind[] = ["Mela", "Workshop", "Webinar", "Meet"];

export const EVENT_ART = { empty: A("empty-open-notebook-pen"), hero: A("scene-women-celebrating") };

/**
 * Money, or the word "Free".
 *
 * The difference from the plain formatter is deliberate and worth keeping: an
 * event with no fee says **Free**, because "₹0" reads like a price somebody
 * forgot to fill in.
 */
export { formatMoneyOrFree as rupees } from "../kit/money";

/**
 * Sakhi Local — what is happening where she actually lives.
 *
 * Everything national is elsewhere in the app. This screen is deliberately
 * narrow: her city, her trade, the women within reach of a bus ride. A "local"
 * screen that shows the whole country is just the home page again.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Story = {
  id: string;
  name: string;
  trade: string;
  place: string;
  distance: string;
  avatar: string;
  cover: string;
  quote: string;
  body: string;
  earned: string;
  since: string;
  tint: string;
  likes: number;
};

export const STORIES: Story[] = [
  {
    id: "st1", name: "Sunita Devi", trade: "Tailoring", place: "Sector 12, Jaipur", distance: "1.2 km away",
    avatar: A("avatar-woman-elder-saree"), cover: A("course-sewing-machine"),
    quote: "I stopped charging by pity and started charging by the hour.",
    body: "For eleven years I took whatever people offered. A workshop here taught me to count my own hours. The same blouse now brings three times what it did, and I have not lost a single customer.",
    earned: "₹18,000 a month", since: "Joined March 2025", tint: "--ux-tint-orange", likes: 142,
  },
  {
    id: "st2", name: "Farah Khan", trade: "Home baking", place: "Malviya Nagar, Jaipur", distance: "3.4 km away",
    avatar: A("avatar-woman-teal-shirt"), cover: A("course-cooking-packing-orders"),
    quote: "The savings circle paid for my oven. Six women I had never met.",
    body: "I could not get a loan and would not ask my husband. Twelve of us put in ₹500 a month. When my turn came I had ₹6,000 in one go — enough for a proper oven. Now I bake forty cakes a month.",
    earned: "₹12,500 a month", since: "Joined July 2025", tint: "--ux-tint-pink", likes: 208,
  },
  {
    id: "st3", name: "Meera Joshi", trade: "Handloom", place: "Bagru, Jaipur", distance: "22 km away",
    avatar: A("avatar-woman-blue-saree"), cover: A("course-handmade-market-stall"),
    quote: "One mela did more than a year of hoping someone would walk past.",
    body: "Our village is off the road. I took a stall at the Diwali mela with two other women and we sold everything by three o'clock. Half of those buyers still order from me.",
    earned: "₹22,000 a month", since: "Joined January 2025", tint: "--ux-tint-violet", likes: 176,
  },
];

export const LOCAL_GROUPS = [
  { id: "g1", name: "Tailors of Sector 12", members: 28, place: "1.2 km", icon: "Scissors",
    tint: "--ux-tint-orange", ink: "--ux-orange", note: "2 shared orders open" },
  { id: "g2", name: "Jaipur Savings Circle", members: 12, place: "Your circle", icon: "PiggyBank",
    tint: "--ux-tint-green", ink: "--ux-green", note: "Next collection 1 June" },
  { id: "g3", name: "Home Bakers Collective", members: 64, place: "City-wide", icon: "CakeSlice",
    tint: "--ux-tint-pink", ink: "--ux-amber", note: "Busy before Diwali" },
];

export const LOCAL_ART = { empty: A("empty-magnifying-glass-blank-page"), hero: A("scene-women-group-circle") };
export const CITY = "Jaipur";

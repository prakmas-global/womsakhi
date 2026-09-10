/**
 * The Earn board's eight places, from `Womsakhi-user-ux/Earn-assets`.
 *
 * Every title, sub-line, chip and href here is the same string the navigation
 * rail carries in `nav-tree.ts` — the board and the rail are two views of one
 * list, and a woman who reads "Take the money first" on a card and then looks
 * for it in the rail has to find the same words. When a route is renamed, it
 * is renamed in `nav-tree.ts` and copied here, not invented again.
 *
 * ── Eight drawn, two designed ───────────────────────────────────────────────
 * The wireframe draws eight cards in two rows of four and stops, but its rail
 * lists ten places and its hero counts ten. `EARN_PLACES` is the eight, exactly
 * as drawn; `EARN_WIDE` is the two the drawing leaves out, given a shorter row
 * of their own so the eight above them keep the proportions they were drawn at.
 */

export type EarnChip = { label: string; href: string };

export type EarnPlace = {
  id: string;
  icon: string;
  title: string;
  sub: string;
  href: string;
  /** The children of this place, drawn as pills. Empty for the two that have none. */
  chips: EarnChip[];
  /**
   * The picture in the card's bottom-right corner, and its intrinsic size.
   *
   * `w`/`h` are the real dimensions of the file so the browser reserves the
   * right box before it loads — a wrong pair here is a layout shift on every
   * cold visit, and on a board sized to the window a shift is a scrollbar.
   */
  art: string;
  artW: number;
  artH: number;
  /** Pink tile rather than purple. Alternating, as drawn. */
  pink?: boolean;
};

export const EARN_PLACES: EarnPlace[] = [
  {
    id: "documents", icon: "Store", title: "Your shop", sub: "What you sell, and your orders",
    href: "/app/documents", pink: true, art: "earn-shop", artW: 440, artH: 293,
    chips: [
      { label: "Everything you sell", href: "/app/documents/listings" },
      { label: "Add something to sell", href: "/app/documents/new" },
      { label: "Your shop papers", href: "/app/documents/vault" },
    ],
  },
  {
    id: "shop", icon: "Sparkles", title: "Ways to sell", sub: "Pre-orders, regulars, big orders",
    href: "/app/shop", pink: true, art: "earn-ways", artW: 427, artH: 440,
    chips: [
      { label: "What should you charge", href: "/app/shop/pricing" },
      { label: "Take the money first", href: "/app/shop/preorders" },
      { label: "Regular customers", href: "/app/shop/subscriptions" },
      { label: "Who buys from you", href: "/app/shop/buyers" },
      { label: "Sell while you work", href: "/app/shop/live" },
      { label: "Sell to shops", href: "/app/shop/wholesale" },
      { label: "Say it instead of typing", href: "/app/shop/voice" },
      { label: "Sell your time", href: "/app/shop/slots" },
      { label: "When something goes wrong", href: "/app/shop/disputes" },
    ],
  },
  {
    id: "collect", icon: "QrCode", title: "Your link, and getting paid", sub: "Sell to people not on WomSakhi",
    href: "/app/collect", art: "earn-link", artW: 388, artH: 440, chips: [],
  },
  {
    id: "market", icon: "ShoppingBasket", title: "The market", sub: "Buy from women you know",
    href: "/app/market", art: "earn-market", artW: 440, artH: 429,
    chips: [{ label: "Buy together", href: "/app/group-buy" }],
  },
  {
    id: "kitchen", icon: "ChefHat", title: "Selling food from home", sub: "The licence is ₹100 a year",
    href: "/app/kitchen", pink: true, art: "earn-kitchen", artW: 440, artH: 293, chips: [],
  },
  {
    id: "books", icon: "BookOpen", title: "Who owes you money", sub: "And proof of what you earn",
    href: "/app/books", art: "earn-books", artW: 440, artH: 212,
    chips: [
      { label: "Proof you earn", href: "/app/books/proof" },
      { label: "Your busy months", href: "/app/books/season" },
    ],
  },
  {
    id: "money", icon: "PiggyBank", title: "Your money", sub: "Is there enough for what cannot wait",
    href: "/app/money", pink: true, art: "earn-money", artW: 440, artH: 409,
    chips: [
      { label: "What you paid", href: "/app/payments" },
      { label: "If something goes wrong", href: "/app/cover" },
    ],
  },
  {
    id: "wallet", icon: "Wallet", title: "Your wallet", sub: "Your balance, and taking it out",
    href: "/app/wallet", art: "earn-wallet", artW: 440, artH: 206,
    chips: [
      { label: "Your statement", href: "/app/wallet/statement" },
      { label: "Take money out", href: "/app/wallet/withdraw" },
    ],
  },
];

/**
 * The last two, drawn wide.
 *
 * The wireframe has eight cards and stops; these two are in its rail but not
 * on its board, and the hero counts ten. Rather than leave the count lying or
 * squeeze five columns into a four-column drawing, they take a row of their
 * own at half the height — icon, title and pills on one line, the picture
 * small on the end. The eight above them keep exactly the proportions they
 * were drawn at, which is the point.
 *
 * Their art is chosen rather than supplied: `icon-padlock` is from the same
 * 3D-illustration family as the eight, and a woman reading her own papers is
 * what "government money in your name" actually looks like.
 */
export const EARN_WIDE: EarnPlace[] = [
  {
    id: "vault", icon: "Lock", title: "Your locker", sub: "Money kept aside, and quiet",
    href: "/app/vault", art: "icon-padlock", artW: 320, artH: 297,
    chips: [
      { label: "Save without thinking", href: "/app/vault/rules" },
      { label: "What you put aside", href: "/app/vault/history" },
      { label: "Who can see it", href: "/app/vault/privacy" },
      { label: "Showing someone your phone", href: "/app/vault/showing" },
    ],
  },
  {
    id: "haq", icon: "Landmark", title: "What you are owed", sub: "Government money in your name",
    href: "/app/haq", pink: true, art: "scene-woman-reading-document", artW: 609, artH: 652,
    chips: [
      { label: "Your papers", href: "/app/haq/papers" },
      { label: "What you can recover", href: "/app/haq/recover" },
    ],
  },
];

/** Counted, not typed — the hero's "10 places" must never drift from the list. */
export const EARN_PLACE_COUNT = EARN_PLACES.length + EARN_WIDE.length;

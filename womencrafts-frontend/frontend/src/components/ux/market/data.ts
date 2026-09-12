/**
 * The market's look-up tables. No data — the market has real data now.
 *
 * ── What used to be here ────────────────────────────────────────────────────
 * Seven invented sellers and eight invented items, with a distance in
 * kilometres, an "open right now" flag, a complaint count and "6 women you know
 * bought this" — all constants. `/app/market` and every `/app/market/i1..i8`
 * rendered them and made no request at all, and the Buy button on top of them
 * set a boolean. The rows now come from `shop_listings` through
 * `GET /market/listings`; see `useMarket()` in `components/ux/live.ts`.
 *
 * What is left is presentation, which is the only thing a screen may still
 * decide for itself: which icon and which tint a category gets. That is a
 * choice about pixels, not a claim about a woman — and it is deterministic, so
 * the same listing looks the same on every load.
 */

export interface ListingLook {
  icon: string;
  tint: string;
  ink: string;
}

const BY_CATEGORY: Record<string, ListingLook> = {
  Clothing: { icon: "Shirt", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  Tailoring: { icon: "Scissors", tint: "--ux-tint-violet", ink: "--ux-violet" },
  Beauty: { icon: "Sparkles", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  Home: { icon: "Home", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  Food: { icon: "UtensilsCrossed", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
};

const PRODUCT: ListingLook = { icon: "Package", tint: "--ux-tint-blue", ink: "--ux-blue-ink" };
const SERVICE: ListingLook = { icon: "HandHeart", tint: "--ux-tint-violet", ink: "--ux-violet" };

/** A stable icon and tint for one listing. Falls back on its kind, never on random. */
export const lookOf = (l: { kind: string; category: string }): ListingLook =>
  BY_CATEGORY[l.category] ?? (l.kind === "service" ? SERVICE : PRODUCT);

/**
 * The seller's tie to this buyer, as a colour.
 *
 * Her circle gets the accent, because that tie is the entire reason this market
 * exists. The wording of the tie itself comes from the server (`tie_label`), so
 * two screens cannot describe the same relationship differently.
 */
export const tieTone = (tie: string): { bg: string; ink: string } =>
  tie === "circle"
    ? { bg: "--ux-tint-pink", ink: "--ux-pink-ink" }
    : tie === "bought-before"
      ? { bg: "--ux-tint-green", ink: "--ux-green-ink" }
      : { bg: "--ux-surface-2", ink: "--ux-muted" };

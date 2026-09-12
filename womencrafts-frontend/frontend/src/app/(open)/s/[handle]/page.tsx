import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/ux/kit";
import { apiBase } from "@/lib/api-base";

import { ShopView, type PublicShop } from "./shop-view";

/**
 * Her shop, on the open web.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 * Every public route in this app was contact, privacy, terms and about. A
 * customer could not see a shop without creating an account — while the
 * marketplace, the bookable slots and the wholesale module all assumed a buyer
 * on the other side. The only buyers were other members, who are themselves
 * there to sell.
 *
 * IFC found **61% of women selling on Jumia also sell through WhatsApp**, more
 * than men do. She already has customers. They will not install an app to buy a
 * ₹400 blouse. So this is a link she pastes into a chat: no login, no download,
 * no account, and it works on the cheapest phone in the house.
 *
 * ── Why it is her page and not a listing ────────────────────────────────────
 * A nationwide randomised evaluation of rural e-commerce found no income gains
 * for producers, because a crowded market of strangers leaves a small seller
 * nowhere to stand out. This page is never browsed and never ranked — it is
 * only ever arrived at from her own message. The buyer already knows her name,
 * which is the one advantage no marketplace can hand her.
 *
 * ── It used to answer for exactly one woman ─────────────────────────────────
 * `shopFrom()` was `(h) => h === SHOP.handle ? SHOP : null`, so every seller
 * who copied her link sent customers to Priya's shop, and every other handle
 * rendered "This shop is not here". It reads `GET /public/shop/{handle}` now —
 * unauthenticated, and carrying no phone, no email and no member id, because
 * the reader is a stranger.
 *
 * Rendered on the server: the page arrives with her things already in it, so
 * there is no spinner on a slow phone and no request for anyone to block.
 */

export const metadata: Metadata = {
  title: "Her shop",
};

// Her listings change when she changes them, and a customer reading the link
// she sent five minutes ago should see what she just added.
export const revalidate = 60;

export default async function OpenShopPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  let shop: PublicShop | null = null;
  try {
    const res = await fetch(`${apiBase()}/public/shop/${encodeURIComponent(handle)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) shop = (await res.json()) as PublicShop;
  } catch {
    // Falls through to the not-here card. A stranger cannot act on a stack
    // trace, and "try again" is the same advice either way.
    shop = null;
  }

  if (!shop || !shop.name) {
    return (
      <Card>
        <EmptyState
          icon="SearchX"
          title="This shop is not here"
          body="The link may be old, or she may have closed it. Ask her for a new one."
        />
      </Card>
    );
  }

  return <ShopView shop={{ ...shop, listings: shop.listings ?? [] }} />;
}

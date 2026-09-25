"use client";

import { Btn } from "@/components/ux/kit";
import { useT } from "@/i18n";
import { NotYetScreen } from "@/components/ux/shopplus/notyet";

/**
 * Show and sell — half an hour, to her own circle.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * Three live sales from `@/components/ux/shopplus/data`, two of them "finished"
 * with takings — 34 watched, 11 sold, ₹4,860 — summed into "taken from selling
 * live" and presented as her earnings. "Start now" flipped `state` in React
 * state and announced *"You are on. Your circle has been told."* No circle was
 * told; no video was carried anywhere; there is no streaming in this product
 * and no collection that would hold one of these rows.
 *
 * ── Why the screen stays ────────────────────────────────────────────────────
 * Live selling works, and the reason it works is the part usually missed: the
 * seller keeps her own stock, her own audience and her own customer
 * relationship. It is the opposite of a marketplace. It also needs no
 * logistics, no photography and no capital — she holds a blouse up and eleven
 * women who already know her decide.
 *
 * All of which she can do on WhatsApp this Saturday. WomSakhi carrying the
 * video would add a broadcast, a payment rail and a moderation problem; it
 * would not add the thing that makes it work, which is that they already know
 * her.
 */
export default function LivePage() {
  const tr = useT();
  return (
    <NotYetScreen
      eyebrow={tr("shopLive.showAndSell")}
      title={tr("shopLive.halfAnHourYourOwnPeople")}
      lede="Hold things up, say the price, take the orders. No photographs, no stock, no delivery —
            and the women watching already know you."
      cannot="WomSakhi cannot carry video, so there is nothing to go live on here."
      why="Nothing on this screen broadcasts anything, nobody is told when you start, and no order
           can be placed by someone watching. Takings shown here would be takings we invented."
      today={[
        {
          what: "Do it on WhatsApp. A group video call with eight or ten women from your circle is the whole idea, and it costs nothing.",
        },
        {
          what: "Pick a Saturday evening and tell them the day before — once. Everyone is on her phone then anyway.",
          say: "Saturday 6pm I will show the new cotton pieces on a video call. Twenty minutes. Tell me if you want to be added.",
        },
        {
          what: "Hold each piece up, say the price out loud, and let them say what they want as you go. Write the names down as they come — do not trust it to memory afterwards.",
        },
        {
          what: "Or send a short video to your status instead, with the price written on it. The same thing, slower, and nobody has to be free at six.",
        },
        {
          what: "Then write each order down under Your shop, and send anyone who asks your shop link so she can see the rest.",
        },
      ]}
      later={[
        "Tell your circle once that you are about to start — never repeatedly, and never to people who did not ask.",
        "Let a woman watching claim a piece as you hold it up, so you are not writing names down while you talk.",
        "Keep what sold, so the next one is easier to plan than the last.",
      ]}
      footer={
        <>
          <Btn variant="outline" size="sm" icon="Store" href="/app/documents">{tr("shopLive.yourShopAndOrders")}</Btn>
          <Btn variant="ghost" size="sm" icon="ExternalLink" href="/app/collect">{tr("shopLive.yourShopLink")}</Btn>
        </>
      }
    />
  );
}

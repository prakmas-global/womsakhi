"use client";

import { Btn } from "@/components/ux/kit";
import { useT } from "@/i18n";
import { NotYetScreen } from "@/components/ux/shopplus/notyet";

/**
 * Big orders — and the one place in this app where they are real.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * Three bulk asks from `@/components/ux/shopplus/data`, including "Sunrise
 * Hostel, 120 school uniform shirts, ₹28,800", totalled into "on the table now"
 * and "already won". "Send my price" set `state: "quoted"` in React state and
 * told her *"Price sent for school uniform shirts — as a group quote, with the
 * women who will share the work named."* No price was sent, no women were
 * named, nobody at Sunrise Hostel heard anything, and it was gone on reload.
 *
 * There is no collection for buyer tenders and no router that accepts one, so
 * a bulk ask cannot arrive here at all.
 *
 * ── Except that bulk orders DO exist, one screen away ───────────────────────
 * `/app/contracts` reads `GET /growth/opportunities?kind=Craft order` — real
 * bulk orders that staff have actually placed, with a real
 * `POST /growth/opportunities/{id}/apply` behind the button. So the honest
 * thing this screen can do is send her there rather than describe a parallel
 * inbox that does not exist.
 *
 * ── The warning worth keeping ───────────────────────────────────────────────
 * A big order won on bad terms is worse than no order. When a buyer pays in
 * sixty or ninety days, a woman who has just spent her own money on cloth is
 * financing them — and when the US federal government accelerated payments to
 * small suppliers, employment at those suppliers went up. Payment timing was
 * the binding constraint, not access to the contract.
 */
export default function WholesalePage() {
  const tr = useT();
  return (
    <NotYetScreen
      eyebrow={tr("ch.contracts.label")}
      title={tr("shopWholesale.twentyPiecesToOneBuyer")}
      lede="One conversation, one delivery, one payment. Too big for one machine is not a reason to
            say no — it is a reason to quote it with your circle."
      cannot="A shop or a hostel cannot send you a bulk order through WomSakhi yet."
      why="There is nowhere for a buyer to post one and nothing that would reach you if she did. But
           bulk orders that buyers have actually placed with us are real, and they are on Big orders
           — that list comes from the server and applying to one is a real application."
      today={[
        {
          what: "Look at Big orders. Everything on that list was placed by a real buyer, and when you apply, that buyer sees your name.",
        },
        {
          what: "Go and ask the shops you already sell to whether they would take a standing quantity. A shop that has bought from you twice is a better prospect than any list.",
          say: "You have taken twenty blouses from me twice now. If I quote you for forty at a time, would you take them? I can do a better price at that size.",
        },
        {
          what: "Before you agree to anything: ask when they pay. Sixty days after delivery is normal for a hostel or a company, and it means you are lending them the cloth money for two months. Ask for a third up front.",
          say: "I can start once a third is paid. The rest on delivery, or within fifteen days — could you put that in writing?",
        },
        {
          what: "If it is too big for your machine, do not turn it down — quote it with your circle. Ten women, one price, one delivery, and the buyer sees one supplier. Who actually signs is worth reading about first.",
        },
      ]}
      later={[
        "Let a shop, a hostel or a school send a quantity and a date, and put it in front of the women who can make it.",
        "Hold a group quote — several women, one price, one delivery — so nobody has to be the only name on it by accident.",
        "Show the payment terms at the same size as the money, every time.",
      ]}
      footer={
        <>
          <Btn variant="outline" size="sm" icon="Briefcase" href="/app/contracts">{tr("shopWholesale.seeRealBigOrders")}</Btn>
          <Btn variant="ghost" size="sm" icon="FileSignature" href="/app/contracts/together">{tr("shopWholesale.whoSignsIt")}</Btn>
        </>
      }
    />
  );
}

"use client";

import { NotYetScreen, WriteItDown } from "@/components/ux/shopplus/notyet";

import { useT } from "@/i18n";
/**
 * Money before you buy cloth.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * It rendered four pre-orders from `@/components/ux/shopplus/data` — "6 festival
 * blouses for Sunita Devi, ₹4,200, ₹1,800 paid" — summed them into a headline
 * figure labelled "paid to you up front", and offered two buttons. "Ask again"
 * set a string: *"Asked Sunita Devi for ₹1,800 cloth money. She sees why, and
 * what it buys."* Sunita Devi does not exist, nobody was asked, and no request
 * left the browser. "She paid" moved a progress bar that was drawn from the
 * same fixture.
 *
 * There is no pre-orders collection, no router, and no payment link — so there
 * is nothing to wire this to and nothing to half-wire it to either.
 *
 * ── Why the screen stays ────────────────────────────────────────────────────
 * The idea behind it is the most direct answer this product has to the thing
 * that actually binds: capital. The typical male-owned firm in the African
 * evidence holds over six times the capital of a female-owned one, and the gap
 * in business *practices* is less than half the capital gap — so training does
 * not close it and lending only turns it into debt. Letting the buyer fund the
 * materials does.
 *
 * And she can do all of that today, with no app, which is what the screen now
 * says. The framing is the part worth keeping: "deposit" sounds like a favour
 * she is asking for, "cloth money" is a thing anyone who has ever had clothes
 * made understands.
 */
export default function PreOrdersPage() {
  const tr = useT();
  return (
    <NotYetScreen
      eyebrow={tr("shopPreorders.beforeYouBuyCloth")}
      title={tr("shopPreorders.letTheOrderPayForIts")}
      lede="Ask for the cost of the material up front — nothing more. Then you never spend your own
            money to start someone else's order, and you never borrow to do it."
      cannot="WomSakhi cannot take a pre-order for you yet."
      why="There is nowhere in WomSakhi to record that a buyer has paid for the cloth, nothing that
           asks her for it, and no payment link to send her. Anything this screen showed you would
           be a number we made up."
      today={[
        {
          what: "Work out what the material costs — just the cloth, the thread, the lining. Not your time.",
        },
        {
          what: "Ask for that much before you start, and say what it is for. Most buyers say yes to this, because it is not a deposit and it is not a favour — it is the cloth.",
          say: "The cloth and thread for six blouses comes to ₹1,800. Send that and I will buy it tomorrow and start. The rest when you collect.",
        },
        {
          what: "Take it into your own UPI id or in cash. Your money goes from her hand to yours with nothing in between.",
        },
        {
          what: "Then write the order down under Your shop, so what you are owed is written somewhere and not only in your head.",
        },
      ]}
      later={[
        "Record the material cost against an order, separately from the whole price, so you can see which orders are already paid for and safe to start.",
        "Send the buyer the ask, and remind her once, without you having to write the message.",
        "Show what is funded and what is still your own money at risk — the one number nobody shows a woman running a business from home.",
      ]}
      footer={<WriteItDown />}
    />
  );
}

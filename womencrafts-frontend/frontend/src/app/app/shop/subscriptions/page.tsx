"use client";

import { NotYetScreen, WriteItDown } from "@/components/ux/shopplus/notyet";

/**
 * Customers who pay every month.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * Four standing orders out of `@/components/ux/shopplus/data`, summed into
 * "₹7,000 every month, dependable" and "₹5,200 already in your hand" — money
 * presented as hers, from rows nobody had ever created. "Ask for the month up
 * front" flipped a boolean in React state and announced *"Sunita Devi will pay
 * for the month up front from now"*, and "Pause" said *"Lakshmi paused. Nothing
 * is charged."* Nothing was ever charged, because nothing here can charge
 * anybody: there is no subscriptions collection, no schedule, and no live
 * payment connection.
 *
 * ── Why the screen stays ────────────────────────────────────────────────────
 * HomeFoodi survives by explicitly *not* being a delivery company — direct
 * contact, no platform fee, tiffin subscriptions. Curryful died building
 * delivery, and its founder's account is that supply was never the problem:
 * customers could not tell home food from another cloud kitchen. Twenty people
 * who already know her, paying monthly in advance, beats a listing page seen by
 * a thousand strangers — and she can arrange every part of that herself.
 *
 * The one thing that mattered on the old screen was **prepaid**: money taken at
 * the start of the month is working capital, and working capital is the
 * constraint. That is now the thing the screen asks her to go and do.
 */
export default function SubscriptionsPage() {
  return (
    <NotYetScreen
      eyebrow="Every month"
      title="Money you can count on"
      lede="Twenty people who know you, paying every month, is a better business than a thousand
            strangers who might buy once."
      cannot="WomSakhi cannot keep a standing order for you yet."
      why="Nothing here charges anyone, nothing reminds them, and there is no record of who pays you
           every month. A list on this screen would be a list we invented."
      today={[
        {
          what: "Pick three customers who already buy from you most weeks. Those are the ones who will say yes.",
        },
        {
          what: "Ask them to pay at the start of the month instead of the end. It is the same money to her and it changes everything for you — you buy the rice and the cloth with her money, not yours.",
          say: "From next month, would you pay for the whole month on the 1st? Same price. It just means I can buy everything at the start and you never have to think about it again.",
        },
        {
          what: "Agree what a month is — how many boxes, how many days, what happens when she travels. Say it once, plainly, before the first month starts.",
        },
        {
          what: "Write the month down as one order under Your shop, so you can see at a glance who has paid and who has not.",
        },
      ]}
      later={[
        "Keep who pays you every month, how much, and when it is next due — so you are not counting it on your fingers on the 1st.",
        "Show what is already paid for against what is still to come, because that is the difference between a good month and a month you have to borrow through.",
        "Remind the customer, once, in her own language — never you having to ask twice.",
      ]}
      footer={<WriteItDown />}
    />
  );
}

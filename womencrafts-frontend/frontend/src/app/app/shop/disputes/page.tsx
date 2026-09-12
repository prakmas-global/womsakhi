"use client";

import { Btn } from "@/components/ux/kit";
import { NotYetScreen } from "@/components/ux/shopplus/notyet";

/**
 * When something goes wrong between two women.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * Three disagreements out of `@/components/ux/eight/data` — "Ritu says the
 * blouse is too tight at the sleeve, ₹420" — drawn as two sides with a helper
 * between them. "Ask someone you both trust" set `state: "helper"` in React
 * state and announced *"Sunita Devi has been asked. She will hear both of you
 * before she says anything."* Sunita Devi was never asked. "We have sorted it"
 * wrote an outcome nobody had agreed to. "Add a photo of the work" said *"Photo
 * added. Both of you and the helper can see it"* without opening a file picker.
 *
 * A woman in a real disagreement about real money would have believed a
 * neighbour had been brought in to mediate, and waited for her.
 *
 * ── Why the screen stays ────────────────────────────────────────────────────
 * The idea is the one thing a trust network can do that a marketplace cannot:
 * the neutral party is a woman they both already know, rather than a ticket
 * queue with the platform in the middle. And unlike most of this module, she
 * needs no software to do it — the whole method is three steps she can take
 * this afternoon, which is what the screen now gives her.
 *
 * The old screen's promise — "having a dispute never lowers your shop" — is
 * kept, and it is now simply true: nothing about a disagreement is recorded
 * anywhere in WomSakhi, so there is nothing that could count against her.
 */
export default function DisputesPage() {
  return (
    <NotYetScreen
      eyebrow="When it goes wrong"
      title="Sorted by someone you both know"
      lede="No complaint form, and no company deciding who is right. If the two of you cannot agree,
            a woman you both trust hears it out."
      cannot="WomSakhi cannot open a case between you and a buyer."
      why="There is no record of a disagreement anywhere in this app, nothing that tells the other
           person, and nobody here who would hear it. Which also means the thing women are most
           afraid of cannot happen: nothing about a disagreement can count against your shop,
           because nothing about it is written down."
      today={[
        {
          what: "Talk to her first, directly, and ask what would make it right rather than who was wrong. Most of these end here.",
          say: "Tell me what is wrong with it and I will fix it. If you would rather have the money back, say so and we will sort it out.",
        },
        {
          what: "Photograph the work before it leaves you, every time. A photo taken on the day settles almost every argument about finishing, and it costs nothing.",
        },
        {
          what: "If the two of you cannot agree, ask a woman you both know — not a friend of yours, someone you both respect — to hear you both out. Ask her before you are angry, and agree in advance that you will both accept what she says.",
          say: "We cannot agree about this and I do not want it to go bad between us. Would you hear us both and tell us what you think is fair? We will both go with what you say.",
        },
        {
          what: "Keep the messages. If money has already changed hands, write down what was paid and when, so there is one version of that at least.",
        },
      ]}
      later={[
        "Let either woman raise it, with the photos and what was agreed already attached — so nobody has to reconstruct it from memory weeks later.",
        "Let them choose a woman they both trust to hear it, and give her what she needs to be fair to both.",
        "Never count it against either shop, never show it to a buyer, and never take a share of the money. A system that punishes disputes teaches women not to raise them, and the woman who stops raising them is the one being cheated.",
      ]}
      footer={
        <>
          <Btn variant="outline" size="sm" icon="MessageCircle" href="/app/messages">Your messages</Btn>
          <Btn variant="ghost" size="sm" icon="LifeBuoy" href="/app/help">Ask WomSakhi for help</Btn>
        </>
      }
    />
  );
}

"use client";

import { Btn } from "@/components/ux/kit";
import { useT } from "@/i18n";
import { NotYetScreen } from "@/components/ux/shopplus/notyet";

/**
 * Say it, don't type it.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * A microphone button filling the screen, a waveform that animated while it was
 * "listening", and then — after a 2,400ms `setTimeout` — a card headed **"What
 * I heard you say"** quoting a Hindi sentence out of a fixture:
 * *"Blouse silai karti hoon, chaar sau rupaye, teen din mein ready."*
 *
 * Nothing was recorded. `getUserMedia` was never called, the microphone
 * permission was never requested, and the eight language buttons set a variable
 * that nothing read. A woman who spoke into it was shown words she had not
 * said, attributed to her, and invited to publish them as her listing. Pressing
 * "Yes, that is right" set `published = true` and said *"Added. Nothing was
 * published until you said yes"* — and added nothing to her shop.
 *
 * That is the most damaging kind of fake in this app, because the entire point
 * of the screen is to be trusted by a woman who cannot check it by reading.
 *
 * ── Why the screen stays ────────────────────────────────────────────────────
 * The argument behind it is right. Adult female literacy in the rural sample
 * behind this research was 36% against 71% for men, so a form excludes
 * two-thirds of the women this is for, and a form with a microphone bolted on
 * is still a form.
 *
 * And the thing she needs already exists, on the phone in her hand: the
 * microphone key on the Android keyboard does Hindi, Marathi, Bengali, Tamil,
 * Telugu, Kannada and Gujarati, free, offline in most of them, in every app.
 * Telling her where that key is does more for her today than any amount of what
 * this screen was pretending to be.
 */
export default function VoicePage() {
  const tr = useT();
  return (
    <NotYetScreen
      eyebrow={tr("documents.addSomethingToSell")}
      title={tr("shopVoice.sayItInsteadOfTypingIt")}
      lede="Nobody should have to be good at typing to sell what she makes. In your own words, in
            your own language."
      cannot="WomSakhi cannot listen to you yet."
      why="This screen used to show a microphone and then print a sentence we had written, as though
           you had said it. It never recorded anything. It is gone, and until WomSakhi can really
           hear you, your own phone does this better than we would."
      today={[
        {
          what: "Open Your shop and start adding something. When the keyboard comes up, look for the small microphone on it — usually top right, or beside the space bar.",
        },
        {
          what: "Press it and just talk. Say it the way you would say it to a customer standing in front of you: what it is, what it costs, how long it takes.",
          say: "Blouse silai — chaar sau rupaye. Teen din mein ready ho jaata hai.",
        },
        {
          what: "It writes in your own language and your own script. You do not have to speak English and you do not have to type in it.",
        },
        {
          what: "Read it back before you save, and fix the numbers. The price is the one word worth checking every time — a microphone hears 'chaar sau' and 'chaalis' more alike than you do.",
        },
        {
          what: "If reading it back is the hard part, ask a daughter, a neighbour or anyone in your circle to read it out to you once. That is not a failure — it is what everyone should do before publishing a price.",
        },
      ]}
      later={[
        "Really listen — your voice, your language, on a phone that may have no data at the time.",
        "Show you your own sentence first, as you said it, before showing what it became. You correct a sentence, not a form.",
        "Ask about anything it is unsure of instead of guessing quietly — the price above all.",
        "Put nothing in your shop until you have heard it read back and said yes.",
      ]}
      footer={
        <>
          <Btn variant="outline" size="sm" icon="Store" href="/app/documents">{tr("documents.addSomethingToSell")}</Btn>
          <Btn variant="ghost" size="sm" icon="Languages" href="/app/settings">{tr("shopVoice.changeYourLanguage")}</Btn>
        </>
      }
    />
  );
}

import type { Metadata } from "next";

/*
  `Card`, `Btn` and `I` are client COMPONENTS, which a server component may
  render freely. `v()` is a client FUNCTION, and calling one during a server
  render throws "Attempted to call v() from the server" — the whole page then
  renders as an error boundary. Same trap as the i18n barrel: what crosses the
  boundary is the reference, not the value. The tokens are written out here.
*/
import { Btn, Card, I } from "@/components/ux/kit";

/**
 * The page at the end of a payment link — which cannot take a payment.
 *
 * ── What this used to be ────────────────────────────────────────────────────
 * A seller, an amount, "27 finished orders and no complaints", and a Pay
 * button that ran `setTimeout(() => setState("paid"), 1400)` and then told a
 * stranger **"Paid. It went straight to her bank account. She has been told."**
 *
 * Nothing was paid. Nobody was told. Every figure on it came from one fixture,
 * so every visitor saw the same seller and the same amount whatever reference
 * they arrived with — and this is a PUBLIC route, reachable by anyone holding
 * the link. It is the only screen in the product where a lie costs a stranger
 * her money, and it was the most convincing screen we had.
 *
 * ── Why it is not simply deleted ────────────────────────────────────────────
 * `/app/collect` had a Copy link button, so links may already be in real
 * WhatsApp threads. A 404 tells the customer nothing; she is left assuming the
 * payment either worked or did not, with no way to tell which. This page's job
 * now is to answer exactly that question: nothing has been paid, pay her
 * directly, and here is how not to be robbed while you do it.
 *
 * ── The single sentence that prevents most UPI fraud ────────────────────────
 * A PIN is only ever for sending. Nobody entering a PIN is receiving money.
 * It survived the rewrite because it is true regardless of what this platform
 * can do, and this is still the screen where a customer is about to type one.
 *
 * Bring the real page back when there is a payee on the order, a public read
 * for one request, and a settlement route that pays her directly — see the
 * notes on `/app/collect`. Until then there is nothing here to render
 * truthfully but this.
 */

export const metadata: Metadata = {
  title: "This link cannot take a payment",
  // Nothing here should be indexed or previewed: the link is a private message
  // between two people, and the page is a correction, not a destination.
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div className="flex flex-col items-center px-6 py-9 text-center"
             style={{ background: "linear-gradient(160deg, var(--ux-tint-amber), var(--ux-surface))" }}>
          <span className="grid h-[64px] w-[64px] place-items-center rounded-full"
                style={{ background: "var(--ux-amber-ink)", color: "var(--ux-on-brand)" }}>
            <I name="Info" className="h-[32px] w-[32px]" sw={2.4} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.03em]" style={{ color: "var(--ux-ink)" }}>
            This link cannot take a payment
          </h1>
          {/*
            The first thing she needs is not an apology, it is the fact: no
            money has moved. A customer holding this link does not know whether
            she has paid, and that is the question to answer before any other.
          */}
          <p className="mt-3 max-w-[36ch] text-[15px] font-semibold leading-relaxed"
             style={{ color: "var(--ux-ink)" }}>
            Nothing has been paid, and nothing has been taken from you.
          </p>
          <p className="mt-2.5 max-w-[38ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            WomSakhi cannot collect money for anyone yet. If someone sent you
            this link, she is still waiting to be paid.
          </p>
        </div>
      </Card>

      <Card pad={18}>
        <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>
          Pay her directly instead
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          Ask her for her UPI id or her bank details and send the money the way
          you normally would. It reaches her account the same day, and no part
          of it passes through us.
        </p>
      </Card>

      <Card pad={16} style={{ background: "var(--ux-surface-2)", borderColor: "transparent" }}>
        <ul className="flex flex-col gap-2.5">
          {[
            {
              icon: "ShieldCheck",
              t: "You are sending money, so your app will ask for your PIN. Never enter a PIN to receive money — that is always someone taking it.",
            },
            {
              icon: "MessageCircle",
              t: "Check the UPI id or account number with her yourself, in a call or in person. A number sent in a message can be changed by whoever forwarded it.",
            },
          ].map((x) => (
            <li key={x.icon} className="flex items-start gap-2.5">
              <I name={x.icon} className="mt-[2px] h-[15px] w-[15px] shrink-0"
                 style={{ color: "var(--ux-muted)" }} />
              <span className="text-[13px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                {x.t}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Btn variant="outline" full icon="ArrowRight" href="/">
        What WomSakhi is
      </Btn>
    </div>
  );
}

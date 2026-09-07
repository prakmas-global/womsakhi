"use client";

import { use, useCallback, useMemo, useState } from "react";

import { Btn, Card, EmptyState, I, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { REQUESTS, SHOP } from "@/components/ux/reach/data";

/**
 * Paying her — the page at the end of the link.
 *
 * ── Why it says who she is before it says how much ──────────────────────────
 * A bare amount and a Pay button is what a phishing message looks like. The
 * customer arrived from a WhatsApp message and has to satisfy herself, in about
 * two seconds, that this is the woman who stitched her blouse. So the page
 * opens with the seller, what the money is for, and what she has done before —
 * and only then the amount.
 *
 * ── We do not hold the money, and the page says so ──────────────────────────
 * Settlement is bank to bank, into her own account. Holding pooled customer
 * funds would make WomSakhi a payment aggregator, which is a licensing question
 * this product has no reason to open. Saying it plainly also answers the
 * objection her household raises — "what if the app takes it?"
 *
 * ── The single sentence that prevents most UPI fraud ────────────────────────
 * A PIN is only ever for sending. Nobody entering a PIN is receiving money.
 * That line lives here as well as in the fraud module, because this is the
 * screen where a customer is about to type one.
 */
export default function PayPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const req = useMemo(() => REQUESTS.find((r) => r.ref.toLowerCase() === ref.toLowerCase()), [ref]);
  const [state, setState] = useState<"ready" | "paying" | "paid">("ready");

  const pay = useCallback(() => {
    setState("paying");
    setTimeout(() => setState("paid"), 1400);
  }, []);

  if (!req) {
    return (
      <Card>
        <EmptyState icon="SearchX" title="This request is not here"
                    body="The link may be old, or already paid. Ask her to send it again." />
      </Card>
    );
  }

  if (state === "paid") {
    return (
      <div className="flex flex-col gap-4">
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex flex-col items-center px-6 py-10 text-center"
               style={{ background: `linear-gradient(160deg, ${v("--ux-tint-green")}, ${v("--ux-surface")})` }}>
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full"
                  style={{ background: v("--ux-green-ink"), color: v("--ux-on-brand") }}>
              <I name="Check" className="h-[36px] w-[36px]" sw={2.6} />
            </span>
            <p className="mt-5 text-[1.5rem] font-extrabold tracking-[-0.03em]" style={{ color: v("--ux-ink") }}>
              Paid
            </p>
            <p className="mt-1.5 text-[0.875rem]" style={{ color: v("--ux-ink-2") }}>
              {formatRupees(req.minor)} to {SHOP.name}
            </p>
            <p className="mt-4 max-w-[34ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              It went straight to her bank account. She has been told. Keep this page or the message
              she sends you as your receipt.
            </p>
          </div>
        </Card>
        <Btn variant="outline" full icon="Store" href={`/s/${SHOP.handle}`}>
          See what else she makes
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Who, before how much. */}
      <Card pad={20}>
        <div className="flex items-center gap-3.5">
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full text-[1.125rem] font-bold"
                style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
            {SHOP.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{SHOP.name}</p>
            <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>{SHOP.trade} · {SHOP.place}</p>
          </div>
        </div>

        <div className="mt-5 border-t pt-5 text-center" style={{ borderColor: v("--ux-line") }}>
          <p className="text-[0.8125rem]" style={{ color: v("--ux-muted") }}>{req.what}</p>
          <p className="mt-1.5 text-[clamp(2.375rem,10vw,3.25rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums"
             style={{ color: v("--ux-ink") }}>
            {formatRupees(req.minor)}
          </p>
          <p className="mt-2.5 text-[0.75rem]" style={{ color: v("--ux-faint") }}>
            Reference {req.ref} · asked {req.when.toLowerCase()}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Btn full size="lg" onClick={pay} disabled={state === "paying"}
               icon={state === "paying" ? "Loader" : "Smartphone"}>
            {state === "paying" ? "Opening your UPI app…" : "Pay with UPI"}
          </Btn>
          <Btn full variant="outline" icon="QrCode" onClick={pay} disabled={state === "paying"}>
            Show a QR to scan
          </Btn>
        </div>
      </Card>

      {/* Reassurance, and the one sentence that stops most UPI fraud */}
      <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
        <ul className="flex flex-col gap-2.5">
          {[
            { icon: "Landmark", t: "This goes to her own bank account. WomSakhi never holds it and takes nothing." },
            { icon: "ShieldCheck", t: "You are sending money, so your app will ask for your PIN. Never enter a PIN to receive money — that is always someone taking it." },
            { icon: "UserCheck", t: `${SHOP.ordersDone} finished orders, ${SHOP.repeatBuyers} buyers who came back, and no complaints.` },
          ].map((x) => (
            <li key={x.icon} className="flex items-start gap-2.5">
              <I name={x.icon} className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-muted") }} />
              <span className="text-[0.75rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>{x.t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { REQUESTS, SHOP, paidTotal, unpaidTotal, type Request } from "@/components/ux/reach/data";

/**
 * Your link, and getting paid.
 *
 * ── Two gaps, one screen, because they are one job ──────────────────────────
 * Before this, every public route in the app was contact/privacy/terms/about —
 * a customer could not see her shop at all — and `settings/payments` held only
 * her *payout* account, the direction money leaves in. So the app recorded what
 * she was owed and never once observed the money arriving.
 *
 * That is the difference between a diary and a ledger, and it weakened
 * everything downstream: proof of income, the trust record, the employer
 * payment history and the whole pricing corpus all rested on her typing a
 * number in rather than on anything the app saw happen.
 *
 * ── We do not hold the money ────────────────────────────────────────────────
 * Settlement is bank to bank into her own account. Pooling customer funds would
 * make WomSakhi a payment aggregator, which is a licence this product has no
 * reason to need — and a balance held by an app is exactly the thing a
 * household distrusts. Stated on the screen, not buried in terms.
 */
export default function CollectPage() {
  const [rows, setRows] = useState<Request[]>(REQUESTS);
  const [copied, setCopied] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");

  const owed = useMemo(() => unpaidTotal(rows), [rows]);
  const got = useMemo(() => paidTotal(rows), [rows]);
  const link = `womsakhi.com/s/${SHOP.handle}`;

  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  /** Hands the link to WhatsApp with the message already written. */
  const sendOnWhatsApp = useCallback(() => {
    const text = `Hello! This is ${SHOP.name}. You can see what I make and pay me here: https://${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }, [link]);

  const ask = useCallback(() => {
    const minor = Math.round(Number(amount.replace(/[^0-9]/g, "")) * 100);
    if (!minor) return;
    const n = 4822 + rows.length;
    setRows((r) => [{
      id: `q${n}`, ref: `PR-${n}`, what: what.trim() || "Work done", minor,
      who: "Not sent yet", when: "Just now", state: "unpaid", via: "link",
    }, ...r]);
    setAmount(""); setWhat("");
  }, [amount, what, rows.length]);

  return (
    <HomeShell active="/app/collect">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Your link
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Sell to people who are not on WomSakhi
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Your customers are already on WhatsApp. They are not going to install an app to buy a
            blouse. Send them this link instead — it opens on any phone, needs no account, and the
            money comes to your bank, not to us.
          </p>
        </header>

        {/* The link, made as easy to send as it is to say. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="px-5 py-6 sm:px-7"
               style={{ background: `linear-gradient(140deg, ${v("--ux-brand-tint")}, ${v("--ux-surface")})` }}>
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-brand") }}>
              Your shop, on the open web
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 break-all rounded-[12px] px-3.5 py-3 text-[1rem] font-bold"
                 style={{ background: v("--ux-surface"), color: v("--ux-ink"), border: `1px solid ${v("--ux-line")}` }}>
                {link}
              </p>
              <Btn icon={copied === "link" ? "Check" : "Copy"} onClick={() => copy(`https://${link}`, "link")}>
                {copied === "link" ? "Copied" : "Copy"}
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="outline" size="sm" icon="MessageCircle" onClick={sendOnWhatsApp}>Send on WhatsApp</Btn>
              <Btn variant="ghost" size="sm" icon="QrCode" onClick={() => window.print()}>Print a QR for your door</Btn>
              <Btn variant="ghost" size="sm" icon="ExternalLink" href={`/s/${SHOP.handle}`}>
                See what they see
              </Btn>
            </div>
          </div>
        </Card>

        {/* Money in, money waiting */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { n: formatRupees(got), l: "has reached your bank", i: "Landmark", tint: "--ux-tint-green", ink: "--ux-green-ink" },
            { n: formatRupees(owed), l: "asked for, not yet paid", i: "Clock", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
          ].map((x) => (
            <Card key={x.l} pad={16}>
              <div className="flex items-center gap-3.5">
                <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: v(x.tint), color: v(x.ink) }}>
                  <I name={x.i} className="h-[20px] w-[20px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[1.25rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                    {x.n}
                  </p>
                  <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-muted") }}>{x.l}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Ask for money — the direction that did not exist */}
        <div>
          <SectionHead title="Ask someone for money"
                       sub="Makes a link you can send. They do not need an account" icon="HandCoins" />
          <Card pad={16}>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[110px] flex-1">
                <span className="mb-1.5 block text-[0.75rem] font-semibold" style={{ color: v("--ux-muted") }}>
                  How much
                </span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)}
                       inputMode="numeric" placeholder="400"
                       className="ux-sq w-full rounded-[12px] border px-3.5 py-3 text-[1rem] font-bold outline-none"
                       style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface"), color: v("--ux-ink") }} />
              </label>
              <label className="min-w-[160px] flex-[2]">
                <span className="mb-1.5 block text-[0.75rem] font-semibold" style={{ color: v("--ux-muted") }}>
                  What for
                </span>
                <input value={what} onChange={(e) => setWhat(e.target.value)}
                       placeholder="Blouse stitching"
                       className="ux-sq w-full rounded-[12px] border px-3.5 py-3 text-[0.875rem] outline-none"
                       style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface"), color: v("--ux-ink") }} />
              </label>
              <Btn icon="Plus" onClick={ask} disabled={!amount.trim()}>Make the link</Btn>
            </div>
          </Card>
        </div>

        {/* What she has asked for */}
        <div>
          <SectionHead title="What you have asked for" icon="Receipt" chip={String(rows.length)} />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {rows.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3.5 px-5 py-4"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <span className="h-[32px] w-[3px] shrink-0 rounded-full"
                      style={{ background: v(r.state === "paid" ? "--ux-green-ink"
                                             : r.state === "seen" ? "--ux-amber-ink" : "--ux-line-strong") }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{r.what}</p>
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                    {r.who} · {r.when} · {r.ref}
                    {r.paidOn ? ` · paid ${r.paidOn.toLowerCase()}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-[1rem] font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                  {formatRupees(r.minor)}
                </p>
                {r.state === "paid"
                  ? <Pill tone="green" size="sm">In your bank</Pill>
                  : r.state === "seen"
                    ? <Pill tone="orange" size="sm">She has seen it</Pill>
                    : <Btn size="sm" variant="outline"
                           icon={copied === r.id ? "Check" : "Copy"}
                           onClick={() => copy(`https://womsakhi.com/pay/${r.ref}`, r.id)}>
                        {copied === r.id ? "Copied" : "Copy link"}
                      </Btn>}
              </div>
            ))}
          </Card>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Landmark" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Money paid on your link goes to your own bank account. WomSakhi never holds it, cannot
              stop it, and takes nothing from it. That is also the answer if anyone at home asks what
              the app does with your money: nothing — it never touches it.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";

import { usePayoutMethods } from "@/components/ux/business";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { useT } from "@/i18n";
import { apiShopOrders, apiShopSummary, type ShopOrder } from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";

/**
 * Your link, and getting paid.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * "Make the link" made no request at all. It prepended a row to React state
 * with a reference this file invented — `PR-${4822 + rows.length}` — and "Copy
 * link" copied a string that was hardcoded in a fixture: the SAME URL for every
 * row, pointing at a page whose Pay button is a 1.4-second timer that then says
 * "Paid. It went straight to her bank account."
 *
 * That is the most damaging thing a screen in this app could do. A woman sends
 * that link to a customer, believing she is about to be paid; the reference
 * disappears on reload; and if the customer opens it, she is told she has paid
 * when no money has moved anywhere.
 *
 * ── Why there is no link, rather than a better one ──────────────────────────
 * The backend cannot make one, and the reasons are structural, not missing
 * plumbing:
 *
 *   · `POST /payments/orders` is the wrong direction. It is authenticated as
 *     the member and stores `user_id` = the person paying. There is no payee
 *     field on the order at all, and `GET /payments/orders/{id}` is scoped by
 *     `user_id`, so a customer with no account has nothing to open.
 *   · She cannot name an amount. `CreateOrderRequest` is `{purpose,
 *     reference_id}` with purpose ∈ {booking, program}, and the price is looked
 *     up server-side from the catalogue — deliberately, so the client can never
 *     state a price. "₹750 for kurta stitching" has no row to point at.
 *   · The gateway is the sandbox one. `/payments/methods` answers
 *     `provider: "sandbox"`, and `SandboxProvider.create_order` returns
 *     `upi://pay?pa=womsakhi@sandbox` with `test_mode: true`. No network, no
 *     money, and a VPA that is not a real payee.
 *   · Even wired to Razorpay it would be wrong. `RazorpayProvider.create_order`
 *     posts to WomSakhi's own account with `"name": "WomSakhi"`, so the
 *     customer's money would settle to WomSakhi and be paid out afterwards.
 *     That is pooling customer funds — the payment-aggregator licence this
 *     product has no reason to need, and the exact thing the note at the bottom
 *     of this screen promises never happens.
 *
 * So the screen says so, and shows her the things that are actually hers: where
 * her money reaches her (`/me/payout/accounts`) and the orders recorded against
 * her (`/shop/orders`). Both are real, both persist, and neither invents a
 * reference.
 */

/** The backend's own division: Sent and Done are out of her hands. */
const DELIVERED = new Set(["Sent", "Done"]);

const toneFor = (state: string): "green" | "orange" | "neutral" =>
  DELIVERED.has(state) ? "green" : state === "Cancelled" ? "neutral" : "orange";

export default function CollectPage() {
  const tr = useT();
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * Her real orders. The fallback is an empty list, never a sample one: on a
   * screen about money, a plausible row she did not make is worse than a gap.
   */
  const orders = useResource(
    useCallback((s: AbortSignal) => apiShopOrders(s), []),
    [] as ShopOrder[],
  );
  const payout = usePayoutMethods();

  /** True only when the server actually answered. `[]` from a failure is not an answer. */
  const known = orders.source === "live";
  const live = useMemo(
    () => orders.data.filter((o) => o.state !== "Cancelled"),
    [orders.data],
  );
  const openMinor = useMemo(
    () => live.filter((o) => !DELIVERED.has(o.state)).reduce((n, o) => n + o.total_minor, 0),
    [live],
  );
  const doneMinor = useMemo(
    () => live.filter((o) => DELIVERED.has(o.state)).reduce((n, o) => n + o.total_minor, 0),
    [live],
  );

  /** The UPI id she has saved is the one thing here a customer can pay into. */
  const upi = useMemo(() => payout.data.find((m) => m.kind === "UPI"), [payout.data]);
  const primary = useMemo(
    () => payout.data.find((m) => m.primary) ?? payout.data[0],
    [payout.data],
  );

  /*
    Her shop link, from the server.

    It was `womsakhi.com/s/${SHOP.handle}` off a fixture — so every member who
    pressed Copy sent her customers to Priya's shop, on the marketing domain
    rather than the app, where `/s/[handle]` answered for exactly one handle
    and rendered "This shop is not here" for everyone else. Three wrongs in one
    string, on the button whose whole job is to be pasted into a stranger's
    WhatsApp.

    The origin comes from the browser rather than a constant, so a staging
    build sends a staging link instead of a production one.
  */
  const shop = useResource(useCallback((s: AbortSignal) => apiShopSummary(s), []), null);
  const handle = shop.data?.handle ?? "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = handle ? `${origin.replace(/^https?:\/\//, "")}/s/${handle}` : "";

  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  /** Hands the link to WhatsApp with the message already written. */
  const sendOnWhatsApp = useCallback(() => {
    const text = `Hello! This is ${shop.data?.name ?? ""}. You can see what I make here: ${origin}/s/${handle}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }, [origin, handle, shop.data]);

  return (
    <HomeShell active="/app/collect">
      {/*
        The copy buttons swap their icon to a tick for two seconds. That is the
        right place for the feedback — right where she pressed — and it is
        completely silent, so a woman using a screen reader pressed Copy and got
        nothing at all. The tick stays; this says the same thing out loud.

        A live region, not a toast: the confirmation belongs beside the button,
        and it is `polite` because she asked for this and is not to be
        interrupted mid-sentence to be told it worked.
      */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied." : ""}
      </span>
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("collect.gettingPaid")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("collect.sellToPeopleWhoAreNot")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Your customers are already on WhatsApp. They are not going to install an app to buy a
            blouse. Send them this link instead — it opens on any phone and needs no account.
          </p>
        </header>

        {/* The link, made as easy to send as it is to say. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="px-5 py-6 sm:px-7"
               style={{ background: `linear-gradient(140deg, ${v("--ux-brand-tint")}, ${v("--ux-surface")})` }}>
            <p className="text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-brand") }}>{tr("collect.yourShopOnTheOpenWeb")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 break-all rounded-[12px] px-3.5 py-3 text-base font-bold"
                 style={{ background: v("--ux-surface"), color: v("--ux-ink"), border: `1px solid ${v("--ux-line")}` }}>
                {link}
              </p>
              <Btn icon={copied === "link" ? "Check" : "Copy"} onClick={() => copy(`https://${link}`, "link")}>
                {copied === "link" ? "Copied" : "Copy"}
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="outline" size="sm" icon="MessageCircle" onClick={sendOnWhatsApp}>{tr("collect.sendOnWhatsapp")}</Btn>
              <Btn variant="ghost" size="sm" icon="QrCode" onClick={() => window.print()}>{tr("collect.printAQrForYourDoor")}</Btn>
              <Btn variant="ghost" size="sm" icon="ExternalLink" href={`/s/${handle}`}>{tr("collect.seeWhatTheySee")}</Btn>
            </div>
          </div>
        </Card>

        {/*
          The honest answer, above everything it affects.

          This used to be a form that made a payment reference out of thin air.
          Saying plainly that the app cannot do it is not a smaller feature than
          a fake one — it is the only version of this that is not a lie to a
          woman about being paid.
        */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex items-start gap-3.5 px-5 py-5"
               style={{ background: v("--ux-tint-amber") }}>
            <I name="Info" className="mt-[2px] h-[20px] w-[20px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
            <div className="min-w-0">
              <p className="text-base font-extrabold leading-snug" style={{ color: v("--ux-amber-ink") }}>
                {tr("collect.noPaymentLinkYet")}
              </p>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-amber-ink") }}>
                There is no payment link to send. WomSakhi is not connected to a live payment
                service, so anything this screen made would not take a single rupee from anyone.
                We would rather tell you that than hand you a link that fails in front of your
                customer.
              </p>
            </div>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
              {tr("collect.askThemYourself")}
            </p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {[
                "Give your customer your own UPI id, or your account number from your passbook. The money goes from her bank to yours, with nothing in between.",
                "Or take cash when you hand the work over. That is not a lesser way to be paid.",
                "Then write the order down here, so the record of what you earned is yours and not only in your head.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <I name="Check" className="mt-[3px] h-[14px] w-[14px] shrink-0" sw={2.6} style={{ color: v("--ux-green-ink") }} />
                  <span className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              When a payment link does exist, it will pay you directly. WomSakhi will not hold the
              money on the way — not for a day, not for an hour.
            </p>
          </div>
        </Card>

        {/* Where money reaches her — her own saved account, or the gap. */}
        <div>
          <SectionHead title={tr("collect.whereYourMoneyReaches")} icon="Landmark" />
          <Card pad={16}>
            {payout.source === "loading" ? (
              <p className="text-xsm" style={{ color: v("--ux-muted") }}>Loading…</p>
            ) : primary ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                        style={{ background: v(primary.tint), color: v(primary.ink) }}>
                    <I name={primary.icon} className="h-[20px] w-[20px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{primary.label}</p>
                    <p className="mt-0.5 break-all text-xs" style={{ color: v("--ux-muted") }}>
                      {primary.kind} · {primary.detail}
                    </p>
                  </div>
                  {primary.verified
                    ? <Pill tone="green" size="sm">Checked</Pill>
                    : <Pill tone="orange" size="sm">Not checked yet</Pill>}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                  {upi
                    ? `This is the id to read out to a customer: ${upi.detail}. She pays it from her own phone, and it arrives in your account.`
                    : "This is where WomSakhi sends money you withdraw. It is not something to give a customer — we only keep the last four digits of your account number. Add your UPI id and you will have it here to read out."}
                </p>
                <div>
                  <Btn variant="outline" size="sm" icon="Settings2" href="/app/settings/payments">
                    {tr("collect.addHowYouGetPaid")}
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  You have not told us where money should reach you. Add your bank account or your
                  UPI id, and it is yours to read out to a customer.
                </p>
                <div>
                  <Btn variant="outline" size="sm" icon="Plus" href="/app/settings/payments">
                    {tr("collect.addHowYouGetPaid")}
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/*
          Her orders, as the server has them.

          These two totals used to be sums of a fixture, labelled "has reached
          your bank" — a sentence the app had no way of knowing. What it does
          know is which orders she has marked delivered, so that is what they
          say now.

          Until the request lands they read "—", not "₹0". Those are different
          statements: one is "we have not asked yet", the other is "you are owed
          nothing", and printing the second while the first is true is the same
          class of lie this screen was rebuilt to remove.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { n: known ? formatRupees(openMinor) : "—", l: tr("collect.stillWithYou"), i: "Clock", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
            { n: known ? formatRupees(doneMinor) : "—", l: tr("collect.markedDelivered"), i: "Package", tint: "--ux-tint-green", ink: "--ux-green-ink" },
          ].map((x) => (
            <Card key={x.l} pad={16}>
              <div className="flex items-center gap-3.5">
                <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: v(x.tint), color: v(x.ink) }}>
                  <I name={x.i} className="h-[20px] w-[20px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                    {x.n}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{x.l}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <SectionHead title={tr("collect.yourOrders")} sub={tr("collect.recordedHereNotPaid")}
                       icon="Receipt" chip={known ? String(live.length) : undefined} />

          {/*
            A failed fetch says so and offers the way back. It must not fall
            through to an empty list: "you have no orders" and "we could not
            ask" are different sentences, and only one of them is true.
          */}
          {orders.error ? (
            <Card pad={16}>
              <div className="flex flex-wrap items-center gap-3">
                <I name="CloudOff" className="h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
                <p className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                  {tr("collect.couldNotLoadOrders")}
                </p>
                <Btn size="sm" variant="outline" icon="RotateCw" onClick={orders.refetch}>
                  {tr("common.retry")}
                </Btn>
              </div>
            </Card>
          ) : orders.source === "loading" ? (
            <Card pad={16}>
              <p className="text-xsm" style={{ color: v("--ux-muted") }}>Loading…</p>
            </Card>
          ) : live.length === 0 ? (
            <Card pad={16}>
              <EmptyState icon="Receipt" title={tr("collect.noOrdersYet")}
                          body={tr("collect.noOrdersYetLine")} />
            </Card>
          ) : (
            <Card pad={0} style={{ overflow: "hidden" }}>
              {live.map((o, i) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3.5 px-5 py-4"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="h-[32px] w-[3px] shrink-0 rounded-full"
                        style={{ background: v(DELIVERED.has(o.state) ? "--ux-green-ink" : "--ux-amber-ink") }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{o.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {o.buyer_name} · {o.placed_on}
                      {o.quantity > 1 ? ` · ${o.quantity}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {formatRupees(o.total_minor)}
                  </p>
                  <Pill tone={toneFor(o.state)} size="sm">{o.state}</Pill>
                </div>
              ))}
            </Card>
          )}
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Landmark" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              WomSakhi does not hold your money and does not take anything from it. Right now it
              does not touch it at all — your customer pays you, and the app only keeps the record.
              That is also the answer if anyone at home asks what the app does with your money.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

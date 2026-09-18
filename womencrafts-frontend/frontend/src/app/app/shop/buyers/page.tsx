"use client";

import { useCallback, useMemo } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, Pill, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { apiShopOrders, type ShopOrder } from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/i18n";

/**
 * Who comes back.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * Five buyers out of `@/components/ux/shopplus/data` — Sunita Devi, Anand Cloth
 * House, Sunrise Hostel — each with a spend, a note about her ("Buys every
 * festival, and brings her sister"), and a total of ₹57,400 labelled "they have
 * spent with you". None of them had bought anything, because none of them
 * existed. "Ask her for a standing order" set `committed: true` in React state
 * and told her *"Asked Anand Cloth House for a standing order"* — no message was
 * sent, nobody was asked, and it was gone on reload.
 *
 * ── What it does now ────────────────────────────────────────────────────────
 * Every buyer on this screen is a buyer in `GET /shop/orders` — her real order
 * history — folded by name. Nothing is fetched that was not already hers, and
 * nothing is derived that the orders do not contain:
 *
 *   · orders      — how many of her orders carry that name
 *   · spent       — the sum of those orders, minus anything cancelled
 *   · comes back  — two or more orders. Not a score, not stars, just the count
 *
 * ── Why there are no stars, and no "quiet score" ────────────────────────────
 * The old screen ranked buyers by `quietScore` — a formula invented in the
 * fixture file (`repeat ? 60 : 20`, plus three per order, minus twenty-five per
 * complaint) presented as though it measured something. The reasoning behind it
 * is sound — displayed ratings are biased upward, and repeat purchase is much
 * harder to game than a five-star review — but a number is not made honest by
 * having a good argument behind it. Complaints are not recorded anywhere in
 * this product, so the formula's own inputs did not exist.
 *
 * What is left is the part that was always true: she came back, or she did not.
 */
export default function BuyersPage() {
  const tr = useT();

  const orders = useResource(
    useCallback((s: AbortSignal) => apiShopOrders(s), []),
    [] as ShopOrder[],
  );
  /** True only when the server actually answered. `[]` from a failure is not an answer. */
  const known = orders.source === "live";

  /**
   * Her buyers, folded out of her orders.
   *
   * Cancelled orders are dropped rather than counted at zero: a cancelled order
   * is not a purchase, and letting one stand would make a woman who ordered
   * once and changed her mind look like a customer.
   */
  const buyers = useMemo(() => {
    const by = new Map<string, { name: string; orders: number; spent: number; what: string[] }>();
    for (const o of orders.data) {
      if (o.state === "Cancelled") continue;
      const name = o.buyer_name?.trim();
      if (!name) continue;
      const row = by.get(name) ?? { name, orders: 0, spent: 0, what: [] };
      row.orders += 1;
      row.spent += o.total_minor;
      if (!row.what.includes(o.title)) row.what.push(o.title);
      by.set(name, row);
    }
    return [...by.values()].sort((a, b) => b.orders - a.orders || b.spent - a.spent);
  }, [orders.data]);

  const repeat = useMemo(() => buyers.filter((b) => b.orders > 1), [buyers]);
  const once = useMemo(() => buyers.filter((b) => b.orders === 1), [buyers]);
  const spent = useMemo(() => buyers.reduce((n, b) => n + b.spent, 0), [buyers]);

  const card = (b: { name: string; orders: number; spent: number; what: string[] }) => (
    <Card key={b.name} pad={16} className={GROUP_ROW}>
      <div className="flex flex-wrap items-start gap-3.5">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-base font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {b.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{b.name}</p>
            {b.orders > 1 && <Pill tone="blue" size="sm">{tr("shopBuyers.comesBack")}</Pill>}
          </div>
          {/* What she bought — her own order titles, not a description of the buyer. */}
          <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {b.what.join(" · ")}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
            {formatRupees(b.spent)}
          </p>
          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>
            over {b.orders} {b.orders === 1 ? "order" : "orders"}
          </p>
        </div>
      </div>
    </Card>
  );

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/shop" label="Back to ways to sell" />

        <header>
          <p className={EYEBROW}>{tr("shopBuyers.yourBuyers")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("shopBuyers.oneSteadyBuyerBeatsAHundred")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed"
             style={{ color: v("--ux-muted") }}>
            Being seen by strangers changes very little. Someone who has agreed to keep buying
            changes what you can plan for. Everyone below is here because you recorded an order
            from her.
          </p>
        </header>

        {/* A failed read says so. An empty list under a failed request is a lie. */}
        {orders.error && (
          <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
            <div className="flex flex-wrap items-center gap-3">
              <I name="CloudOff" className="h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
              <p role="status" className="min-w-0 flex-1 text-xsm leading-relaxed" style={{ color: v("--ux-amber-ink") }}>
                We could not reach WomSakhi, so your buyers are not showing. This is not an empty
                list — try again in a moment.
              </p>
              <Btn size="sm" variant="outline" icon="RotateCw" onClick={orders.refetch}>
                {tr("common.retry")}
              </Btn>
            </div>
          </Card>
        )}

        {/*
          Two counts and a total, all three of them sums of her own orders.

          They read "—" until the request lands, never "0". Those are different
          statements — "we have not asked yet" and "nobody has bought from you"
          — and printing the second while the first is true is exactly the class
          of thing this screen was rebuilt to remove.
        */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={known ? String(repeat.length) : "—"} label="have bought more than once"
                  icon="Repeat" tint="--ux-tint-blue" ink="--ux-blue-ink" />
            <Stat value={known ? String(buyers.length) : "—"} label="people have bought from you"
                  icon="Users" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={known ? formatRupees(spent) : "—"} label={tr("shopBuyers.theyHaveSpentWithYou")}
                  icon="Wallet" tint="--ux-tint-violet" ink="--ux-violet" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Counted from the orders you have written down here — not from everything you have ever
              sold. An order you took in cash and never recorded is not in this.
            </p>
          </div>
        </Card>

        {!known ? (
          <Card pad={16}>
            <p className="text-xsm" style={{ color: v("--ux-muted") }}>
              {orders.error ? "Not showing." : "Loading…"}
            </p>
          </Card>
        ) : buyers.length === 0 ? (
          <Card>
            <EmptyState
              icon="Users"
              title="No buyers here yet"
              body="This fills up from your orders. Write down what you sell — including what you sold for cash at the door — and the people who come back will show up here on their own."
              action={<Btn href="/app/documents" icon="Store">Your shop and orders</Btn>}
            />
          </Card>
        ) : (
          <>
            {repeat.length > 0 && (
              <div>
                <Section title={tr("shopBuyers.theyKeepComingBack")}
                             sub="More than one order in your own records" icon="Handshake"
                             chip={String(repeat.length)} />
                <div className={`flex flex-col gap-3 ${GROUP}`}>{repeat.map(card)}</div>
              </div>
            )}

            {once.length > 0 && (
              <div>
                <Section title={tr("shopBuyers.boughtOnce")}
                             sub={tr("shopBuyers.worthOneMessageBeforeTheSeason")} icon="User"
                             chip={String(once.length)} />
                <div className={`flex flex-col gap-3 ${GROUP}`}>{once.map(card)}</div>
              </div>
            )}
          </>
        )}

        {/*
          The action the old screen faked, handed back to her.

          There is no button here because WomSakhi does not hold her buyer's
          phone number — `buyer_name` is a name she typed, and nothing more. She
          already has the number; what is hard is the sentence, so the sentence
          is what this gives her.
        */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="p-4 lg:p-5">
            <div className="flex items-start gap-3.5">
              <IconTile icon="Handshake" tint="--ux-tint-green" ink="--ux-green-ink" size={42} radius={12} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
                  When someone buys twice, ask her to make it regular
                </p>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  WomSakhi cannot message them for you — we do not keep your buyers&rsquo; phone
                  numbers, and we are not going to start. You have them already. What is hard is the
                  asking, so here are the words:
                </p>
                <p className="mt-2.5 border-s-2 ps-3 text-xsm italic leading-relaxed"
                   style={{ borderColor: v("--ux-brand"), color: v("--ux-ink") }}>
                  &ldquo;You have bought from me more than once now and I am grateful. If I keep
                  two pieces aside for you every month, would you take them? I would know what to
                  make, and you would not have to ask.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              There are no stars here on purpose. Most sellers have too few ratings for stars to mean
              anything, and the ones that exist are almost all five. Coming back is harder to fake,
              and you can see it from the second order. These customers are yours, not ours — their
              numbers are in your phone, and if you ever stop using WomSakhi they stay with you.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

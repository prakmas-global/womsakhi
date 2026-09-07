"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { ITEMS, TIE_LABEL, sellerOf, sortedItems } from "@/components/ux/market/data";

/**
 * One thing, and the woman who makes it.
 *
 * ── The seller is the product ───────────────────────────────────────────────
 * On a normal marketplace the item is the hero and the seller is a footnote.
 * Here it is the other way round, because the only reason to buy through this
 * app rather than the shop on the corner is that you know who she is. So her
 * name, her trade, how far away she is and what her other buyers did are all
 * above the fold — and the thing that closes the sale is "six women you know
 * have bought this."
 *
 * ── Made-to-order asks for the materials, not a deposit ─────────────────────
 * Where an item is made after ordering, the buyer is asked for the cost of the
 * cloth up front. That is the single most direct answer to the capital gap on
 * the seller's side — a woman with no working capital cannot start an order —
 * and "cloth money" is a thing anyone who has had clothes made understands.
 * "Deposit" sounds like a favour being asked; it is not one.
 */
export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const item = useMemo(() => ITEMS.find((i) => i.id === id), [id]);
  const seller = useMemo(() => (item ? sellerOf(item) : null), [item]);
  const alsoHers = useMemo(
    () => (item ? ITEMS.filter((i) => i.sellerId === item.sellerId && i.id !== item.id) : []),
    [item],
  );
  const nearby = useMemo(
    () => sortedItems().filter((i) => i.id !== id && i.sellerId !== item?.sellerId).slice(0, 3),
    [id, item],
  );

  const [placed, setPlaced] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const order = useCallback(() => {
    setPlaced(true);
    setNote(
      item?.madeToOrder
        ? `${seller?.name} has your order. She will buy the material today and start.`
        : `${seller?.name} has your order. She will message you about collecting it.`,
    );
  }, [item, seller]);

  if (!item || !seller) {
    return (
      <HomeShell active="/app/market">
        <Card>
          <EmptyState icon="SearchX" title="That is not for sale any more"
                      body="She may have closed her shop, or the link may be old."
                      action={<Btn size="sm" href="/app/market">Back to the market</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  const materials = Math.round(item.minor * 0.4);

  return (
    <HomeShell active="/app/market">
      <div className="flex flex-col gap-5">
        <Back to="/app/market" label="Back to the market" />

        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex flex-wrap items-start gap-4 p-5" style={{ background: v(item.tint) }}>
            <IconTile icon={item.icon} tint="--ux-surface" ink={item.ink} size={56} radius={15} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[clamp(1.25rem,2.6vw,1.625rem)] font-extrabold leading-tight tracking-[-0.03em]"
                    style={{ color: v("--ux-ink") }}>{item.title}</h1>
                {item.madeToOrder && <Pill tone="green" size="sm">Made for you</Pill>}
              </div>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>{item.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[1.5rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {formatRupees(item.minor)}
              </p>
              {item.stock !== null && (
                <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-ink-2") }}>{item.stock} left</p>
              )}
            </div>
          </div>

          {item.madeToOrder && (
            <div className="px-5 py-4" style={{ background: v("--ux-surface-2") }}>
              <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                She makes this after you order. To start she needs{" "}
                <b style={{ color: v("--ux-ink") }}>{formatRupees(materials)}</b> for the cloth and
                thread — the rest when you collect. That is how she can take the order at all without
                borrowing.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 px-5 py-4">
            <Btn disabled={placed || !seller.open} onClick={order}>
              {placed ? "Ordered" : !seller.open ? "She is closed just now"
                : item.kind === "service" ? "Book her"
                : item.madeToOrder ? `Order — pay ${formatRupees(materials)} now` : "Buy it"}
            </Btn>
            <Btn variant="outline" icon="MessageCircle"
                 onClick={() => setNote(`Message sent to ${seller.name}. She usually replies the same day.`)}>
              Ask her something
            </Btn>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* The seller — the actual product */}
        <div>
          <SectionHead title="Who makes it" icon="User" />
          <Card pad={20}>
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-[1.25rem] font-bold"
                    style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                {seller.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{seller.name}</p>
                  <span className="rounded-full px-2.5 py-[3px] text-[0.6875rem] font-bold"
                        style={{
                          background: v(seller.tie === "circle" ? "--ux-tint-pink" : "--ux-surface-2"),
                          color: v(seller.tie === "circle" ? "--ux-pink-ink" : "--ux-muted"),
                        }}>
                    {TIE_LABEL[seller.tie]}
                  </span>
                </div>
                <p className="mt-1 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                  {seller.trade} · {seller.km} km away
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: "Repeat", label: `${seller.repeatBuyers} buyers come back`, tone: "--ux-green-ink" },
                    { icon: seller.complaints === 0 ? "Check" : "Minus",
                      label: seller.complaints === 0 ? "Never a complaint" : `${seller.complaints} complaint`,
                      tone: seller.complaints === 0 ? "--ux-green-ink" : "--ux-muted" },
                    { icon: "Package", label: `${seller.ordersDone} orders finished`, tone: "--ux-ink-2" },
                  ].map((x) => (
                    <div key={x.label} className="flex items-center gap-2 rounded-[12px] px-3 py-2.5"
                         style={{ background: v("--ux-surface-2") }}>
                      <I name={x.icon} className="h-[14px] w-[14px] shrink-0" style={{ color: v(x.tone) }} sw={2.4} />
                      <span className="text-[0.75rem] font-semibold" style={{ color: v("--ux-ink-2") }}>{x.label}</span>
                    </div>
                  ))}
                </div>

                {item.boughtByCircle > 0 && (
                  <p className="mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[0.8125rem] font-semibold"
                     style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                    <I name="Users" className="h-[14px] w-[14px]" />
                    {item.boughtByCircle} women you know have bought this
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {alsoHers.length > 0 && (
          <div>
            <SectionHead title={`Also from ${seller.name}`} icon="Store" chip={String(alsoHers.length)} />
            <div className="flex flex-col gap-2.5">
              {alsoHers.map((i) => (
                <Link key={i.id} href={`/app/market/${i.id}`}
                        className="ux-press ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5 text-left"
                        style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{i.title}</p>
                    <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>{i.detail}</p>
                  </div>
                  <p className="shrink-0 text-[1rem] font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {formatRupees(i.minor)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionHead title="Other women near you" icon="Users" />
          <div className="flex flex-col gap-2.5">
            {nearby.map((i) => {
              const s = sellerOf(i);
              return (
                <Link key={i.id} href={`/app/market/${i.id}`}
                        className="ux-press ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5 text-left"
                        style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{i.title}</p>
                    <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                      {s.name} · {TIE_LABEL[s.tie].toLowerCase()} · {s.km} km
                    </p>
                  </div>
                  <p className="shrink-0 text-[1rem] font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {formatRupees(i.minor)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

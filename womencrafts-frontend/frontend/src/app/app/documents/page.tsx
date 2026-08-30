"use client";

import { useState } from "react";

import { apiAdvanceOrder, apiReplyToReview } from "@/lib/shop-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "lucide-react";

import {
  ActionBtn, Btn, Card, EmptyState, I, IconTile,
  NoteBtn, Pill, Progress, SectionHead, SourceNote, Tabs,
  copy, plural
} from "@/components/ux/kit";
import { useCountUp } from "@/components/ux/kit/motion";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  ORDER_STATES, SHOP_ART, STATE_TONE, WEEK_DAYS, rupees, type OrderState,
} from "@/components/ux/shop/data";
import { useBusiness } from "@/components/ux/business";
import { useDocuments } from "@/components/ux/live";

/**
 * "What you sell" covers products AND services on purpose.
 *
 * To her they are one thing — what she earns from. Most women on WomSakhi earn
 * from their time rather than from stock: beauty, tuition, tailoring to
 * measure, cooking, childcare. A shop that only lists things in boxes has no
 * room for how most of its members actually work.
 */
const TABS = ["Orders", "What you sell", "Reviews", "Paperwork"] as const;

/**
 * My Business — the shop she runs.
 *
 * Orders open first, and the ones needing her come first within that, because
 * this screen is checked between other work: the question is always "is anyone
 * waiting on me?" and it should be answered before she has to look for it.
 */
export default function MyBusinessPage() {
  // One request for the whole screen — summary, listings, orders and reviews
  // together, because four would be four round trips.
  const { data: biz, source, refetch } = useBusiness();
  const { SHOP, orders: ORDERS, products: PRODUCTS, services: SERVICES,
          reviews: REVIEWS, stats: SHOP_STATS, week: WEEK_ORDERS } =
    { ...biz, SHOP: biz.shop };
  const { data: DOCUMENTS } = useDocuments();
  const [tab, setTab] = useState<string>("Orders");
  const [state, setState] = useState<OrderState | "All">("All");
  const [moved, setMoved] = useState<Record<string, OrderState>>({});

  /** Where an order has got to, counting a move that is still in flight. */
  const stateOf = (o: (typeof ORDERS)[number]) => moved[o.id] ?? o.state;

  // No `useMemo` here on purpose. The compiler memoizes this component itself,
  // and a hand-written memo it cannot prove — this one reads `moved`, which an
  // optimistic update rewrites — makes it skip the whole component rather than
  // just this line. The hand-rolled version was also the shape that showed 6
  // of 24 mentors elsewhere in this app.
  const shown = ORDERS.filter((o) => state === "All" || stateOf(o) === state);

  const needsHer = ORDERS.filter((o) => ["New", "Making", "Ready"].includes(stateOf(o)));
  const month = useCountUp(Math.round(SHOP_STATS.month_minor / 100), 900);
  const growth = Math.round((SHOP_STATS.month_minor / SHOP_STATS.lastMonth_minor - 1) * 100);
  const docsDone = DOCUMENTS.filter((d) => d.status === "verified").length;
  const docsNeeded = DOCUMENTS.filter((d) => d.status !== "optional").length;

  /**
   * Move an order along, on the server.
   *
   * This used to write the next state into local component state and stop
   * there. The card said "Making", the buyer's order said "New", and the
   * difference only showed up when somebody asked where their order was.
   */
  const move = useAction(
    async (id: string) => { await apiAdvanceOrder(id); },
    {
      onDone: refetch,
      optimistic: (id) => {
        const from = moved[id] ?? ORDERS.find((o) => o.id === id)?.state;
        const order: OrderState[] = ["New", "Making", "Ready", "Sent", "Done"];
        const i = order.indexOf(from as OrderState);
        if (i >= 0 && i < order.length - 1) setMoved((m) => ({ ...m, [id]: order[i + 1] }));
      },
      rollback: (id) => setMoved((m) => { const n = { ...m }; delete n[id]; return n; }),
      fallbackError: "That did not move. The order is as it was — try again in a moment.",
    },
  );
  const advance = (id: string) => void move.run(id);

  return (
    <HomeShell
      active="/app/documents"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <div className="flex items-center gap-3">
              <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[14px]"
                    style={{ background: "var(--ux-tint-orange)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOP.art} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[14.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{SHOP.name}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                  <Icons.Star className="h-3.5 w-3.5" fill="var(--ux-amber)" style={{ color: "var(--ux-amber)" }} />
                  {SHOP.rating} · {SHOP.reviews} reviews
                </p>
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {[["Followers", SHOP.followers], ["Views, 30 days", SHOP.views30.toLocaleString("en-IN")]].map(([k, v]) => (
                <div key={k as string} className="ux-sq rounded-[11px] p-2.5" style={{ background: "var(--ux-surface-2)" }}>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                  <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--ux-muted)" }}>{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 truncate text-[11.5px]" style={{ color: "var(--ux-faint)" }}>{SHOP.handle}</p>
            <div className="mt-3 flex gap-2">
              <ActionBtn variant="soft" size="sm" icon="Share2" doneIcon="Copy" done="Shop link copied"
                         act={() => copy(`https://${SHOP.handle}`, "Shop link copied — send it to anyone", "Copy it by hand from the line above")}>
                Share shop
              </ActionBtn>
              <Btn href="/app/profile" variant="outline" size="sm" icon="Pencil">Edit</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="This week" sub={`${WEEK_ORDERS.reduce((a, b) => a + b, 0)} orders`} />
            <div className="flex items-end gap-[7px]" style={{ height: 92 }}>
              {/* `Math.max(1, ...)`: a week with no orders in it made every bar
                  `height: 0 / 0` — React refused the NaN and logged an error
                  on every render of this screen. A shop's first week is
                  exactly when that happens. */}
              {WEEK_ORDERS.map((v, i) => {
                const max = Math.max(1, ...WEEK_ORDERS);
                const last = i === WEEK_ORDERS.length - 1;
                return (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: 92 }}>
                    <div className="ux-sq w-full rounded-[5px]"
                         style={{
                           height: Math.max(3, Math.round((v / max) * 70)),
                           background: last ? "var(--ux-brand-600)" : "var(--ux-brand-tint-2)",
                           transition: `height var(--ux-t-slow) var(--ux-ease-out) ${i * 45}ms`,
                         }}
                         title={`${WEEK_DAYS[i]}: ${v} orders`} />
                    <span className="mt-1.5 text-[9.5px]" style={{ color: last ? "var(--ux-brand)" : "var(--ux-faint)" }}>
                      {WEEK_DAYS[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SHOP_ART.stall} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Sell at a mela
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              A stall at the Craft Mela on 24 May. Twelve places left.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/events" variant="soft" size="sm" iconEnd="ArrowRight">Book a stall</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>My Business</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {needsHer.length
              ? `${needsHer.length} ${plural("order", needsHer.length)} waiting on you.`
              : "Nothing is waiting on you right now."}
          </p>

      <SourceNote source={source} what="your business" />
        </div>
        <Tabs items={[...TABS]} active={tab} onChange={setTab} />
      </div>

      {/* ── the headline ────────────────────────────────────────────────── */}
      <div className="ux-sq ux-onscroll relative overflow-hidden rounded-[20px] p-[20px]"
           style={{ background: "linear-gradient(100deg, var(--ux-brand-900) 0%, var(--ux-brand-700) 55%, var(--ux-brand-600) 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -end-12 -top-16 h-[220px] w-[220px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SHOP_ART.packing} alt=""
             className="ux-float pointer-events-none absolute -bottom-2 end-6 h-[124px] w-auto object-contain" />
        <div className="relative max-w-[62%]">
          <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.82)" }}>Earned this month</p>
          <p className="mt-1.5 text-[34px] font-bold leading-none tabular-nums text-white">
            ₹{month.toLocaleString("en-IN")}
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "rgba(255,255,255,0.9)" }}>
            <Icons.TrendingUp className="h-4 w-4" />
            {growth}% more than last month · {SHOP_STATS.repeatBuyers}% of buyers came back
          </p>
          <div className="mt-4 flex gap-2.5">
            <Btn href="/app/documents/product/new" variant="soft" size="sm" icon="Plus">Add a product</Btn>
            <Btn href="/app/wallet" variant="on-brand" size="sm" iconEnd="ArrowRight">See money</Btn>
          </div>
        </div>
      </div>

      {/* ── orders ──────────────────────────────────────────────────────── */}
      {tab === "Orders" && (
        <>
          <div className="my-[15px] flex flex-wrap gap-2">
            {(["All", ...ORDER_STATES] as const).map((s) => {
              const n = s === "All" ? ORDERS.length : ORDERS.filter((o) => stateOf(o) === s).length;
              if (s !== "All" && n === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => setState(s as OrderState | "All")}
                  aria-pressed={state === s}
                  className="ux-press ux-sq rounded-[11px] border px-3.5 py-2 text-[12.5px] font-medium transition-colors"
                  style={{
                    borderColor: state === s ? "var(--ux-brand)" : "var(--ux-line-strong)",
                    background: state === s ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                    color: state === s ? "var(--ux-brand)" : "var(--ux-ink)",
                  }}
                >
                  {s} <span style={{ color: "var(--ux-faint)" }}>{n}</span>
                </button>
              );
            })}
          </div>

          {shown.length ? (
            <div className="ux-deck ux-stagger space-y-[13px]">
              {shown.map((o, i) => {
                const st = stateOf(o);
                const tone = STATE_TONE[st];
                return (
                  <Card key={o.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                    <div className="flex items-start gap-3.5">
                      <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[12px]"
                            style={{ background: "var(--ux-tint-orange)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.art} alt="" className="ux-art h-full w-full object-cover" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                            {o.item}
                          </h3>
                          <Pill tone={tone.pill} size="sm">{st}</Pill>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                          <span className="inline-flex items-center gap-1"><Icons.User className="h-3.5 w-3.5" /> {o.buyer}</span>
                          <span>{o.ref}</span>
                          <span>×{o.qty}</span>
                          <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {o.when}</span>
                        </p>
                        <p className="mt-2 text-[12px]" style={{ color: st === "Cancelled" ? "var(--ux-faint)" : "var(--ux-ink-2)" }}>
                          {o.due}
                        </p>
                      </div>
                      <p className="shrink-0 text-[16px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                        {rupees(o.amount_minor)}
                      </p>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
                         style={{ borderColor: "var(--ux-line)" }}>
                      <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ux-faint)" }}>
                        <I name={o.channel === "WhatsApp" ? "MessageCircle" : o.channel === "Mela" ? "Store" : "ShoppingBag"}
                           className="h-[14px] w-[14px]" />
                        {o.channel === "Repeat" ? "Repeat buyer" : `From ${o.channel}`}
                      </span>
                      <span className="flex items-center gap-2">
                        <Btn href={`/app/documents/order/${o.id}`} variant="outline" size="sm">Open</Btn>
                        <Btn href="/app/messages" variant="outline" size="sm" icon="MessageCircle">Message</Btn>
                        {/* One button, one next step. A row of every possible
                            state change is a quiz; the next state is an action. */}
                        {tone.next && (
                          <Btn variant="primary" size="sm" iconEnd="ArrowRight" onClick={() => advance(o.id)}>
                            {tone.next}
                          </Btn>
                        )}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon="Package"
                title={`No ${String(state).toLowerCase()} orders`}
                body="Orders from your shop, WhatsApp and melas all arrive here."
                action={<Btn onClick={() => setState("All")} variant="soft">Show all orders</Btn>}
              />
            </Card>
          )}
        </>
      )}

      {/* ── products ────────────────────────────────────────────────────── */}
      {tab === "What you sell" && (
        <>
        <div className="mb-3 mt-[20px] flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--ux-faint)" }}>
            Your time and skill
          </h2>
          <Btn href="/app/documents/service/new" variant="soft" size="sm" icon="Plus">Offer a service</Btn>
        </div>
        {SERVICES.length ? (
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {SERVICES.map((sv, i) => (
              <div key={sv.id} className="ux-i ux-sq ux-onscroll flex overflow-hidden rounded-[16px] border"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}>
                <span className="h-[130px] w-[112px] shrink-0 overflow-hidden" style={{ background: "var(--ux-tint-pink)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sv.art} alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {sv.name}
                    </h3>
                    {!sv.live && <Pill tone="neutral" size="sm">Hidden</Pill>}
                  </div>
                  <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                    {rupees(sv.rate_minor)} <span className="text-[11.5px] font-medium" style={{ color: "var(--ux-muted)" }}>{sv.rateKind}</span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]" style={{ color: "var(--ux-muted)" }}>
                    <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3 w-3" /> {sv.where}</span>
                    <span>{sv.booked} booked</span>
                  </p>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Btn href={`/app/documents/service/${sv.id}`} variant="outline" size="sm" icon="Pencil">Edit</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="HandHeart" title="No services yet"
                        body="Stitching, mehendi, tuition, cooking, childcare — anything you do with your time."
                        action={<Btn href="/app/documents/service/new" variant="primary" iconEnd="ArrowRight">Offer a service</Btn>} />
          </Card>
        )}

        <div className="mb-3 mt-[26px] flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--ux-faint)" }}>
            Things you make
          </h2>
          <Btn href="/app/documents/product/new" variant="soft" size="sm" icon="Plus">Add a product</Btn>
        </div>
        <div className="ux-deck grid grid-cols-2 gap-[15px]">
          {PRODUCTS.map((p, i) => (
            <div key={p.id} className="ux-i ux-sq ux-onscroll flex overflow-hidden rounded-[16px] border"
                 style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}>
              <span className="h-[120px] w-[120px] shrink-0 overflow-hidden" style={{ background: "var(--ux-tint-orange)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.art} alt="" className="ux-art h-full w-full object-cover" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col p-3.5">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {p.name}
                  </h3>
                  {!p.live && <Pill tone="neutral" size="sm">Hidden</Pill>}
                </div>
                <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {rupees(p.price_minor)}
                </p>
                <p className="mt-1.5 text-[11.5px]" style={{ color: p.stock === 0 ? "var(--ux-orange-ink)" : "var(--ux-muted)" }}>
                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`} · {p.sold} sold
                </p>
                <div className="mt-auto flex gap-2 pt-3">
                  <Btn href={`/app/documents/product/${p.id}`} variant="outline" size="sm" icon="Pencil">Edit</Btn>
                  {p.stock === 0 && (
                    <Btn href={`/app/documents/product/${p.id}`} variant="soft" size="sm">Restock</Btn>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {tab === "Reviews" && (
        <div className="mt-[15px]">
          <Card className="mb-[15px]">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="text-[38px] font-bold leading-none" style={{ color: "var(--ux-ink)" }}>{SHOP.rating}</p>
                {/* Filled to her actual rating. Five gold stars were painted
                    beside it whatever the number said, including beside a
                    shop with no reviews at all. */}
                <p className="mt-1.5 flex justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const on = i <= Math.round(Number(SHOP.rating) || 0);
                    return (
                      <Icons.Star key={i} className="h-[13px] w-[13px]"
                                  fill={on ? "var(--ux-amber)" : "none"}
                                  style={{ color: on ? "var(--ux-amber)" : "var(--ux-line-strong)" }} />
                    );
                  })}
                </p>
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{SHOP.reviews} reviews</p>
              </div>
              {/* Counted from the reviews the server returned. The bars
                  were [[5, 38], [4, 7], [3, 2], [2, 0], [1, 0]] over a
                  denominator of 47 — a shop's reputation, written by nobody. */}
              <div className="min-w-0 flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const n = REVIEWS.filter((r) => r.stars === stars).length;
                  return (
                  <div key={stars} className="flex items-center gap-2.5">
                    <span className="w-[10px] text-[11px] tabular-nums" style={{ color: "var(--ux-muted)" }}>{stars}</span>
                    <Icons.Star className="h-[11px] w-[11px] shrink-0" fill="var(--ux-amber)" style={{ color: "var(--ux-amber)" }} />
                    <span className="ux-sq h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
                      <span className="block h-full rounded-full"
                            style={{ width: `${REVIEWS.length ? (n / REVIEWS.length) * 100 : 0}%`, background: "var(--ux-amber)" }} />
                    </span>
                    <span className="w-[24px] text-end text-[11px] tabular-nums" style={{ color: "var(--ux-faint)" }}>{n}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="ux-deck ux-stagger space-y-[13px]">
            {REVIEWS.map((r, i) => (
              <Card key={r.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <span className="h-[44px] w-[44px] shrink-0 overflow-hidden rounded-full"
                        style={{ background: "var(--ux-brand-tint)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.avatar} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {r.who}
                      </p>
                      <span className="flex shrink-0 gap-0.5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Icons.Star key={i} className="h-[12px] w-[12px]"
                                      fill={i < r.stars ? "var(--ux-amber)" : "none"}
                                      style={{ color: i < r.stars ? "var(--ux-amber)" : "var(--ux-line-strong)" }} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{r.what} · {r.when}</p>
                    <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{r.text}</p>
                    <div className="mt-2.5">
                      {/* This said "Your reply is on the review" and posted
                          nothing — the buyer waited for an answer that was
                          never written down. It is /shop/reviews/{id}/reply,
                          which the endpoint has had all along. */}
                      <NoteBtn label="Reply" variant="ghost" icon="MessageCircle"
                               title={`Reply to ${r.who}`} to={r.who}
                               placeholder="Thank her, or put right whatever went wrong. Everyone browsing your shop sees this reply."
                               send={async (n) => { await apiReplyToReview(r.id, n.text); refetch(); }}
                               sent="Your reply is on the review"
                               sentBody="Anyone reading this review now sees your answer under it."
                               sentLink={null} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── paperwork ───────────────────────────────────────────────────── */}
      {tab === "Paperwork" && (
        <Card className="mt-[15px]">
          <SectionHead
            title="Your documents"
            sub={`${docsDone} of ${docsNeeded} done — the rest unlock bigger orders and loans`}
          />
          <div className="mb-4">
            <Progress pct={(docsDone / docsNeeded) * 100} track="--ux-track" />
          </div>
          <div className="mb-4">
            <Btn href="/app/documents/vault" variant="outline" size="sm" full iconEnd="ArrowRight">
              Open, download or replace any of them
            </Btn>
          </div>
          <ul className="ux-deck ux-stagger space-y-2.5">
            {DOCUMENTS.map((d, i) => (
              <li key={d.id} className="ux-i ux-sq flex items-center gap-3.5 rounded-[13px] border p-3"
                  style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                <IconTile icon={d.icon} tint={d.tint} ink={d.ink} size={42} radius={11} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{d.name}</p>
                  <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{d.when}</p>
                </div>
                {d.status === "verified" && (
                  <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium"
                        style={{ color: "var(--ux-green-ink)" }}>
                    <Icons.BadgeCheck className="h-[16px] w-[16px]" /> Verified
                  </span>
                )}
                {d.status === "missing" && <Btn href="/app/documents/vault" variant="primary" size="sm" icon="Upload">Add</Btn>}
                {d.status === "optional" && (
                  <span className="shrink-0 text-[11.5px]" style={{ color: "var(--ux-faint)" }}>Optional</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-[11px] p-3 text-[12px] leading-relaxed"
             style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
            <Icons.Lock className="me-1.5 inline h-[14px] w-[14px]" style={{ color: "var(--ux-brand)" }} />
            Only you and the WomSakhi review team can open these. They are never shown to buyers or employers.
          </p>
        </Card>
      )}
    </HomeShell>
  );
}

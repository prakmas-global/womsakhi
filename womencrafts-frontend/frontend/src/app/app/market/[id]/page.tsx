"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  Back, Btn, Card, EmptyState, I, IconTile, Pill, ScreenSkeleton, SectionHead, v,
} from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { useMarketListing } from "@/components/ux/live";
import { apiErrorMessage } from "@/lib/api";
import { apiSave, apiUnsave } from "@/lib/entitlements-api";
import { useAttemptKey, settled } from "@/lib/idempotency";
import { apiAskSeller, apiPlaceOrder, type MarketListing, type MyMarketOrder } from "@/lib/market-api";
import { lookOf } from "@/components/ux/market/data";
import { useT } from "@/i18n";

/**
 * One thing, and the woman who makes it.
 *
 * ── Three buttons here used to lie ──────────────────────────────────────────
 * "Buy it" set `placed = true` and showed a green tick reading "Sunita Devi has
 * your order. She will buy the material today and start." No request was made,
 * nobody was told, and it was gone on reload. "Ask her something" set a note
 * reading "Message sent" and sent nothing. Save was a `useState` array.
 *
 * All three now write to the server, and every confirmation below repeats what
 * the server actually returned — the order's state, the name it was delivered
 * to. Where a write fails she is told, and the button comes back.
 *
 * ── WomSakhi never holds her money ──────────────────────────────────────────
 * Ordering takes NO payment. It puts a real row in the seller's order book and
 * says, in the server's own words, that the buyer pays the seller directly.
 * The payments module cannot be used for this: `POST /payments/orders` raises
 * an order against WomSakhi's own merchant account and has no payee field, so
 * the money would land with WomSakhi and have to be paid back out — custody of
 * her money, which this platform says it must not take. Buyer-to-seller
 * settlement needs a rail with the SELLER as the payee, and that is a decision
 * this screen will not make on its own.
 *
 * ── The seller is the product ───────────────────────────────────────────────
 * On a normal marketplace the item is the hero and the seller is a footnote.
 * Here it is the other way round, because the only reason to buy through this
 * app rather than the shop on the corner is that you know who she is.
 *
 * What is NOT here any more: a distance in kilometres, an "open right now"
 * flag, "never a complaint", and a made-to-order materials deposit computed as
 * 40% of the price. Nothing in the database knows any of those, and the last
 * one was asking a woman for a specific sum of money that nobody had agreed.
 */
export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const listing = useMarketListing(id);
  const item = listing.data;

  const attempt = useAttemptKey("market-order");

  /** Orders placed since this screen opened. The ones that already existed
   *  come from the server, not from here — see `orders` below. */
  const [placed, setPlaced] = useState<MyMarketOrder[]>([]);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [asked, setAsked] = useState<{ to: string; conversation: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [pressedSave, setPressedSave] = useState<boolean | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const photos = item?.photos?.length ? item.photos : item?.photo ? [item.photo] : [];

  /**
   * Every order she has on this listing — the server's, plus anything placed
   * in the last few seconds.
   *
   * DERIVED, not copied into state by an effect. Copying meant the list was a
   * snapshot that a refetch could not correct, and it is exactly the pattern
   * (`setState` inside `useEffect`) that made "Ordered" a lie in the first
   * place. A refetch overwrites nothing here: an id already sent by the server
   * is dropped from the local list, so nothing is ever counted twice.
   */
  const orders = useMemo(() => {
    const fromServer = item?.my_orders ?? [];
    const known = new Set(fromServer.map((o) => o.id));
    return [...placed.filter((o) => !known.has(o.id)), ...fromServer];
  }, [item, placed]);

  const saved = pressedSave ?? item?.saved ?? false;

  const order = useCallback(async () => {
    if (!item) return;
    setProblem(null);
    try {
      const made = await apiPlaceOrder(item.id, { quantity: 1 }, attempt.current());
      attempt.settle();
      // What is shown is what came back — the server's order and the server's
      // sentence about payment, not a sentence written here.
      setPlaced((o) => [made.order, ...o]);
      setPayNote(made.pay_note);
    } catch (e) {
      if (settled(e)) attempt.settle();
      setProblem(apiErrorMessage(e, "That order did not go through. Nothing was sent to her — try again."));
    }
  }, [item, attempt]);

  const ask = useCallback(async () => {
    if (!item || !question.trim()) return;
    setProblem(null);
    try {
      const result = await apiAskSeller(item.id, question.trim());
      setAsked({ to: result.delivered_to, conversation: result.conversation_id });
      setQuestion("");
      setAsking(false);
    } catch (e) {
      setProblem(apiErrorMessage(e, "That message was not sent. Try again in a moment."));
    }
  }, [item, question]);

  const toggleSave = useCallback(async () => {
    if (!item) return;
    const was = saved;
    setPressedSave(!was);
    setProblem(null);
    try {
      if (was) await apiUnsave("listing", item.id);
      else await apiSave("listing", item.id);
    } catch (e) {
      setPressedSave(was);
      setProblem(apiErrorMessage(e, "That could not be saved. Try again in a moment."));
    }
  }, [item, saved]);

  if (listing.source === "loading" && !item) {
    return <HomeShell active="/app/market"><ScreenSkeleton shape="detail" /></HomeShell>;
  }

  if (!item) {
    return (
      <HomeShell active="/app/market">
        <Card>
          <EmptyState icon="SearchX" title={tr("market.thatIsNotForSaleAny")}
                      body={listing.error
                        ? "She may have paused it, or we could not reach WomSakhi just now."
                        : "She may have closed her shop, or the link may be old."}
                      action={<Btn size="sm" href="/app/market">{tr("market.backToTheMarket")}</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  const look = lookOf(item);
  const soldOut = item.out_of_stock;
  const needsQuote = item.price_mode === "quote" || item.price_mode === "range";

  const smallRow = (l: MarketListing) => {
    const lk = lookOf(l);
    return (
      <Link key={l.id} href={`/app/market/${l.id}`}
            className="ux-press ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5 text-left"
            style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
        <IconTile icon={lk.icon} tint={lk.tint} ink={lk.ink} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{l.title}</p>
          <p className="truncate text-xs" style={{ color: v("--ux-muted") }}>{l.desc || l.category}</p>
        </div>
        <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
          {formatRupees(l.price_minor)}
        </p>
      </Link>
    );
  };

  return (
    <HomeShell active="/app/market">
      <div className="flex flex-col gap-5">
        <Back to="/app/market" label={tr("market.backToTheMarket2")} />

        <Card pad={0} style={{ overflow: "hidden" }}>
          {photos.length > 0 && (
            <div className="p-4" style={{ background: v("--ux-surface") }}>
              <div className="grid h-[260px] place-items-center sm:h-[360px]">
                <img src={photos[selectedPhoto] || photos[0]} alt={item.title}
                     className="h-full min-h-0 w-full object-contain" />
              </div>
              {photos.length > 1 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Product photos">
                  {photos.map((photo, index) => (
                    <button key={photo} type="button" onClick={() => setSelectedPhoto(index)}
                            aria-label={`View photo ${index + 1}`} aria-pressed={selectedPhoto === index}
                            className="h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors hover:ring-1 hover:ring-[var(--ux-brand)] focus-visible:outline-2 focus-visible:outline-offset-2"
                            style={{ borderColor: selectedPhoto === index ? v("--ux-brand") : v("--ux-line") }}>
                      <img src={photo} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-start gap-4 p-5" style={{ background: v(look.tint) }}>
            <IconTile icon={look.icon} tint="--ux-surface" ink={look.ink} size={56} radius={15} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold leading-tight tracking-normal"
                    style={{ color: v("--ux-ink") }}>{item.title}</h1>
                {item.kind === "service" && <Pill tone="blue" size="sm">{tr("market.someoneToDoIt")}</Pill>}
              </div>
              {item.desc && (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{item.desc}</p>
              )}
              {item.place && (
                <p className="mt-1.5 text-xsm" style={{ color: v("--ux-ink-2") }}>
                  {item.place}{item.travels_km > 0 ? ` · she travels up to ${item.travels_km} km` : ""}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {item.price_label}
              </p>
              {item.rate && <p className="mt-1 text-xs" style={{ color: v("--ux-ink-2") }}>{item.rate}</p>}
              {item.stock !== null && (
                <p className="mt-1 text-xs" style={{ color: v("--ux-ink-2") }}>
                  {soldOut ? "None left just now" : `${item.stock} left`}
                </p>
              )}
            </div>
          </div>

          {/* Said before she presses, not after. The one thing a buyer needs to
              know about this market is who takes the money — and the answer is
              that nobody in the middle does. */}
          <div className="px-5 py-4" style={{ background: v("--ux-surface-2") }}>
            <p className="flex items-start gap-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              <I name="HandCoins" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-ink-2") }} />
              Ordering costs nothing now. You pay {item.seller.name} directly when you collect it —
              WomSakhi does not take the money and does not hold it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4">
            <Btn disabled={soldOut} onClick={needsQuote ? () => setAsking(true) : order}>
              {soldOut ? "None left just now" : needsQuote ? "Ask for a quote"
                : item.kind === "service" ? "Book her"
                : orders.length > 0 ? "Order it again" : "Order it"}
            </Btn>
            <Btn variant="outline" icon="MessageCircle" onClick={() => setAsking((x) => !x)}>
              {tr("market.askHerSomething")}
            </Btn>
            <Btn variant={saved ? "soft" : "ghost"} icon="Heart"
                 ariaLabel={saved ? "Remove from saved" : "Save this"}
                 onClick={toggleSave}>
              {saved ? "Saved" : "Save"}
            </Btn>
          </div>

          {asking && (
            <div className="border-t px-5 py-4" style={{ borderColor: v("--ux-line") }}>
              <label htmlFor="ask" className="text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                Ask {item.seller.name} about {item.title}
              </label>
              <textarea id="ask" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
                        placeholder={tr("market.doYouHaveThisInDark")}
                        className="ux-sq mt-2 w-full rounded-[12px] border p-3 text-sm"
                        style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface"), color: v("--ux-ink") }} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Btn size="sm" disabled={!question.trim()} onClick={ask}>{tr("booksProof.sendIt")}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => { setAsking(false); setQuestion(""); }}>{tr("discover.notNow")}</Btn>
              </div>
            </div>
          )}
        </Card>

        {problem && (
          <Card pad={16} style={{ background: v("--ux-tint-orange"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: v("--ux-orange-ink") }}>
              <I name="AlertCircle" className="mt-[1px] h-[16px] w-[16px] shrink-0" />{problem}
            </p>
          </Card>
        )}

        {asked && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="mt-[1px] h-[16px] w-[16px] shrink-0" />
              Your question is in {asked.to}&rsquo;s inbox.
            </p>
            <div className="mt-2.5">
              <Btn size="sm" variant="outline" icon="MessageCircle" href="/app/messages">
                {tr("market.openTheConversation")}
              </Btn>
            </div>
          </Card>
        )}

        {/* Her orders on this listing — from the server, so this is still here
            after a reload. Each row says what state the SELLER has it in. */}
        {orders.length > 0 && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="mt-[1px] h-[16px] w-[16px] shrink-0" />
              {item.seller.name} has your order.
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {orders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] px-3 py-2.5"
                     style={{ background: v("--ux-surface") }}>
                  <span className="text-xs font-semibold" style={{ color: v("--ux-ink") }}>
                    {o.quantity} × {o.title}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
                          style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>{o.state}</span>
                    <span className="text-xs tabular-nums" style={{ color: v("--ux-ink-2") }}>
                      {formatRupees(o.total_minor)}
                    </span>
                    <span className="text-2xs" style={{ color: v("--ux-muted") }}>{o.placed_on}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {payNote ?? "You pay her directly when you collect it. WomSakhi does not take the money and does not hold it."}
            </p>
          </Card>
        )}

        {/* The seller — the actual product */}
        <div>
          <SectionHead title={tr("market.whoMakesIt")} icon="User" />
          <Card pad={20}>
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-xl font-bold"
                    style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                {item.seller.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{item.seller.name}</p>
                  <span className="rounded-full px-2.5 py-[3px] text-2xs font-bold"
                        style={{
                          background: v(item.seller.tie === "circle" ? "--ux-tint-pink" : "--ux-surface-2"),
                          color: v(item.seller.tie === "circle" ? "--ux-pink-ink" : "--ux-muted"),
                        }}>
                    {item.seller.tie_label}
                  </span>
                </div>
                {(item.category || item.seller.place) && (
                  <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
                    {[item.category, item.seller.place].filter(Boolean).join(" · ")}
                  </p>
                )}

                {/* Counted from her order book. A woman with nothing counted
                    yet gets one honest line instead of three zeroes. */}
                {item.seller.orders_done > 0 || item.seller.repeat_buyers > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {item.seller.repeat_buyers > 0 && (
                      <div className="flex items-center gap-2 rounded-[12px] px-3 py-2.5"
                           style={{ background: v("--ux-surface-2") }}>
                        <I name="Repeat" className="h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.4} />
                        <span className="text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
                          {item.seller.repeat_buyers} buyers came back
                        </span>
                      </div>
                    )}
                    {item.seller.orders_done > 0 && (
                      <div className="flex items-center gap-2 rounded-[12px] px-3 py-2.5"
                           style={{ background: v("--ux-surface-2") }}>
                        <I name="Package" className="h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-ink-2") }} sw={2.4} />
                        <span className="text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
                          {item.seller.orders_done} orders finished
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 rounded-[12px] px-3 py-2.5 text-xs"
                     style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                    She has not finished an order through WomSakhi yet. Somebody has to be first.
                  </p>
                )}

                {item.bought_by_circle > 0 && (
                  <p className="mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-xsm font-semibold"
                     style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                    <I name="Users" className="h-[14px] w-[14px]" />
                    {item.bought_by_circle} {item.bought_by_circle === 1 ? "woman" : "women"} you know
                    {item.bought_by_circle === 1 ? " has" : " have"} bought this
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {item.also_hers.length > 0 && (
          <div>
            <SectionHead title={`Also from ${item.seller.name}`} icon="Store"
                         chip={String(item.also_hers.length)} />
            <div className="flex flex-col gap-2.5">{item.also_hers.map(smallRow)}</div>
          </div>
        )}
      </div>
    </HomeShell>
  );
}

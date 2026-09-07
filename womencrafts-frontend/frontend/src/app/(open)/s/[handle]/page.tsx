"use client";

import { use, useCallback, useMemo, useState } from "react";

import { Btn, Card, EmptyState, I, IconTile, Pill, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { shopFrom, type PublicItem } from "@/components/ux/reach/data";

/**
 * Her shop, on the open web.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 * Every public route in this app was contact, privacy, terms and about. A
 * customer could not see a shop without creating an account — while the
 * marketplace, the bookable slots, the pre-orders, the subscriptions, the live
 * selling and the wholesale module all assumed a buyer on the other side. The
 * only buyers were other members, who are themselves there to sell.
 *
 * IFC found **61% of women selling on Jumia also sell through WhatsApp**, more
 * than men do. She already has customers. They will not install an app to buy a
 * ₹400 blouse. So this is a link she pastes into a chat: no login, no download,
 * no account, and it works on the cheapest phone in the house.
 *
 * ── Why it is her page and not a listing ────────────────────────────────────
 * A nationwide randomised evaluation of rural e-commerce found no income gains
 * for producers, because a crowded market of strangers leaves a small seller
 * nowhere to stand out. This page is never browsed and never ranked — it is
 * only ever arrived at from her own message. The buyer already knows her name,
 * which is the one advantage no marketplace can hand her.
 *
 * ── No stars ────────────────────────────────────────────────────────────────
 * Same rule as the member market: what is shown is that buyers came back and
 * nobody complained. Harder to fake, and it exists from the first order.
 */
export default function OpenShopPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const shop = useMemo(() => shopFrom(handle), [handle]);

  const [cart, setCart] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const items = shop?.items ?? [];
  const total = useMemo(
    () => cart.reduce((n, id) => n + (items.find((i) => i.id === id)?.minor ?? 0), 0),
    [cart, items],
  );
  /** A buyer with no account still has a phone. Both hand off to it. */
  const messageHer = useCallback(() => {
    if (!shop) return;
    const text = `Hello ${shop.name.split(" ")[0]}, I saw your page and wanted to ask about something.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }, [shop]);
  const callHer = useCallback(() => { window.location.href = "tel:+919000000000"; }, []);

  const add = useCallback((id: string) => {
    setCart((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }, []);

  if (!shop) {
    return (
      <Card>
        <EmptyState icon="SearchX" title="This shop is not here"
                    body="The link may be old, or she may have closed it. Ask her for a new one." />
      </Card>
    );
  }

  const free = shop.slots.filter((s) => !s.taken);

  return (
    <div className="flex flex-col gap-4">

      {/* Her, first. The seller is the reason this page works at all. */}
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div className="px-5 pb-5 pt-6"
             style={{ background: `linear-gradient(150deg, ${v("--ux-brand-tint")}, ${v("--ux-surface")})` }}>
          <div className="flex items-start gap-4">
            <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full text-[1.5rem] font-bold"
                  style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
              {shop.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em]" style={{ color: v("--ux-ink") }}>
                {shop.name}
              </h1>
              <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>{shop.trade}</p>
              <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                {shop.place} · since {shop.since}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {shop.about}
          </p>

          {/* In place of stars */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { icon: "Package", text: `${shop.ordersDone} orders finished`, tone: "--ux-ink-2" },
              { icon: "Repeat", text: `${shop.repeatBuyers} buyers come back`, tone: "--ux-green-ink" },
              { icon: shop.complaints === 0 ? "Check" : "Minus",
                text: shop.complaints === 0 ? "No complaints, ever" : `${shop.complaints} complaint`,
                tone: shop.complaints === 0 ? "--ux-green-ink" : "--ux-muted" },
            ].map((x) => (
              <span key={x.text} className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold"
                    style={{ color: v(x.tone) }}>
                <I name={x.icon} className="h-[13px] w-[13px]" sw={2.4} />{x.text}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t px-5 py-3.5" style={{ borderColor: v("--ux-line") }}>
          <Btn size="sm" variant="outline" icon="MessageCircle" full onClick={messageHer}>Message her</Btn>
          <Btn size="sm" variant="ghost" icon="Phone" full onClick={callHer}>Call</Btn>
        </div>
      </Card>

      {/* What she sells */}
      <div>
        <p className="mb-2 px-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.16em]" style={{ color: v("--ux-muted") }}>
          What she makes
        </p>
        <div className="flex flex-col gap-2.5">
          {items.map((i) => <Row key={i.id} i={i} on={cart.includes(i.id)} onToggle={() => add(i.id)} />)}
        </div>
      </div>

      {/* Her free hours — the slots module, made bookable by someone with no account */}
      {free.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.16em]" style={{ color: v("--ux-muted") }}>
            When she is free
          </p>
          <Card pad={16}>
            <div className="flex flex-wrap gap-2">
              {free.map((s) => (
                <button key={s.id} type="button" onClick={() => setSlot(slot === s.id ? null : s.id)}
                        className="ux-press ux-sq rounded-[12px] px-3 py-2.5 text-left"
                        style={{
                          background: v(slot === s.id ? "--ux-fill" : "--ux-surface-2"),
                          color: v(slot === s.id ? "--ux-on-brand" : "--ux-ink"),
                        }}>
                  <p className="text-[0.8125rem] font-bold">{s.day}, {s.time}</p>
                  <p className="text-[0.6875rem]" style={{ opacity: 0.8 }}>{s.service} · {s.minutes} min</p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* The only thing that matters: a way to pay her */}
      {(cart.length > 0 || slot) && !done && (
        <Card pad={16} style={{ borderColor: v("--ux-brand") }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-bold" style={{ color: v("--ux-ink") }}>
                {cart.length > 0 && `${cart.length} ${cart.length === 1 ? "thing" : "things"}`}
                {cart.length > 0 && slot && " · "}
                {slot && "a time booked"}
              </p>
              {total > 0 && (
                <p className="text-[1.125rem] font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                  {formatRupees(total)}
                </p>
              )}
            </div>
            <Btn onClick={() => setDone(true)} icon="ArrowRight">
              {total > 0 ? "Pay her" : "Book it"}
            </Btn>
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            The money goes to her own bank account. WomSakhi does not hold it and takes nothing from it.
          </p>
        </Card>
      )}

      {done && (
        <Card pad={20} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="CheckCircle2" className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            <div>
              <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-green-ink") }}>
                {shop.name.split(" ")[0]} has your order
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                She will message you on this number. You do not need an account, and nothing here
                signed you up for anything.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ i, on, onToggle }: { i: PublicItem; on: boolean; onToggle: () => void }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: on ? v("--ux-brand") : undefined }}>
      <button type="button" onClick={onToggle} className="ux-press flex w-full items-start gap-3.5 p-4 text-left">
        <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={44} radius={12} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.875rem] font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
            {i.madeToOrder && <Pill tone="green" size="sm">Made for you</Pill>}
            {i.stock !== null && i.stock <= 5 && <Pill tone="orange" size="sm">{i.stock} left</Pill>}
          </div>
          <p className="mt-1 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{i.detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[1rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
            {formatRupees(i.minor)}
          </p>
          {i.unit && <p className="mt-1 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>{i.unit}</p>}
          <span className="mt-2 inline-flex h-[24px] w-[24px] items-center justify-center rounded-full"
                style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"), color: v(on ? "--ux-on-brand" : "--ux-muted") }}>
            <I name={on ? "Check" : "Plus"} className="h-[13px] w-[13px]" sw={2.6} />
          </span>
        </div>
      </button>
    </Card>
  );
}

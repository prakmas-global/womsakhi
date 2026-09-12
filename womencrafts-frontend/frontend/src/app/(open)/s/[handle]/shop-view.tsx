"use client";

import { useCallback, useMemo, useState } from "react";

import { Btn, Card, I, formatRupees, v } from "@/components/ux/kit";

export type PublicListing = {
  id: string;
  title: string;
  desc?: string;
  price_minor?: number;
  price_label?: string;
  rate?: string;
  out_of_stock?: boolean;
};

export type PublicShop = {
  handle: string;
  name: string;
  trade?: string;
  place?: string;
  listings: PublicListing[];
};

/**
 * What she makes, and a way to tell her which one.
 *
 * ── What this replaced ──────────────────────────────────────────────────────
 * A cart, a slot picker and a "Pay her" button whose entire implementation was
 * `setDone(true)`, followed by a green tick reading "Priya has your order. She
 * will message you on this number." No request was made, no number was ever
 * collected, and nobody was told. Beside it: a hardcoded `tel:+919000000000`,
 * a WhatsApp link with no recipient, "No complaints, ever" over a field
 * nothing records, and an order history, a founding date and a set of free
 * hours that all came from one fixture — so every seller's page showed the
 * same woman's life. This is a PUBLIC page; the person reading it has no
 * account and no way to check any of it.
 *
 * ── Why there is no checkout ────────────────────────────────────────────────
 * There cannot be one yet. An order needs a payee and this backend has none;
 * taking the money any other way would route it through WomSakhi, which is
 * custody and a licence this product has always said it will not need.
 *
 * ── Why that costs almost nothing here ──────────────────────────────────────
 * This page is never browsed and never ranked. It is only ever arrived at from
 * her own message — so the buyer is already in a conversation with her when
 * she reads it. She does not need an order button; she needs to be able to say
 * which one. Tapping items writes the message and copies it, and she sends it
 * back in the chat she is already in. Nothing is claimed on anyone's behalf.
 */
export function ShopView({ shop }: { shop: PublicShop }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const toggle = useCallback((id: string) => {
    setCopied(false);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }, []);

  const chosen = useMemo(
    () => shop.listings.filter((l) => picked.includes(l.id)),
    [shop.listings, picked],
  );

  // Only items that carry a real price contribute. An item priced by the hour
  // has a `rate` and no `price_minor`, and adding a rate to a total would
  // quote her a figure she never set.
  const priced = chosen.filter((l) => typeof l.price_minor === "number" && l.price_minor > 0);
  const total = priced.reduce((n, l) => n + (l.price_minor ?? 0), 0);
  const allPriced = priced.length === chosen.length;

  const message = useMemo(() => {
    if (chosen.length === 0) return "";
    const lines = chosen.map((l) => `• ${l.title}${l.price_label ? ` — ${l.price_label}` : ""}`);
    return `Hello ${shop.name}, I would like:\n${lines.join("\n")}`;
  }, [chosen, shop.name]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // A clipboard that refuses is not a failure worth a dialog — the message
      // is on screen and can be selected by hand.
      setCopied(false);
    }
  }, [message]);

  return (
    <div className="flex flex-col gap-4">
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div
          className="px-5 pb-5 pt-6"
          style={{ background: `linear-gradient(150deg, ${v("--ux-brand-tint")}, ${v("--ux-surface")})` }}
        >
          <div className="flex items-start gap-4">
            <span
              className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full text-2xl font-bold"
              style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}
            >
              {shop.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <h1
                className="text-2xl font-extrabold leading-tight tracking-[-0.03em]"
                style={{ color: v("--ux-ink") }}
              >
                {shop.name}
              </h1>
              {/* Trade and place are the only two things the server knows about
                  her here, and both are hers to have typed. Anything more —
                  orders finished, buyers returning, years in business — would
                  be a claim to a stranger that nothing backs. */}
              {shop.trade && (
                <p className="mt-0.5 text-xsm" style={{ color: v("--ux-ink-2") }}>{shop.trade}</p>
              )}
              {shop.place && (
                <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{shop.place}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div>
        <p
          className="mb-2 px-1 text-xs font-extrabold uppercase tracking-[0.16em]"
          style={{ color: v("--ux-muted") }}
        >
          What she makes
        </p>
        <div className="flex flex-col gap-2.5">
          {shop.listings.map((l) => {
            const on = picked.includes(l.id);
            return (
              <Card key={l.id} pad={0} style={{ overflow: "hidden", borderColor: on ? v("--ux-brand") : undefined }}>
                <button
                  type="button"
                  onClick={() => toggle(l.id)}
                  aria-pressed={on}
                  className="ux-press flex w-full items-start gap-3.5 p-4 text-left"
                >
                  <span
                    className="mt-[2px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2"
                    style={{
                      borderColor: v(on ? "--ux-brand" : "--ux-line"),
                      background: on ? v("--ux-brand") : "transparent",
                      color: v("--ux-on-brand"),
                    }}
                  >
                    {on && <I name="Check" className="h-[13px] w-[13px]" sw={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold" style={{ color: v("--ux-ink") }}>
                      {l.title}
                    </span>
                    {l.desc && (
                      <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                        {l.desc}
                      </span>
                    )}
                    {l.out_of_stock && (
                      <span className="mt-1.5 block text-xs font-semibold" style={{ color: v("--ux-muted") }}>
                        She has none left just now — ask her when there will be more.
                      </span>
                    )}
                  </span>
                  <span
                    className="shrink-0 text-sm font-extrabold tabular-nums"
                    style={{ color: v("--ux-ink") }}
                  >
                    {l.price_label || l.rate || ""}
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      {chosen.length > 0 && (
        <Card pad={16} style={{ borderColor: v("--ux-brand") }}>
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
            Tell her which one
          </p>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            This page cannot take an order or a payment. Copy the message below
            and send it back to her in the chat where you got this link — she
            will reply with how to pay her directly.
          </p>

          <pre
            className="mt-3 whitespace-pre-wrap rounded-[12px] p-3 text-xsm leading-relaxed"
            style={{ background: v("--ux-surface-2"), color: v("--ux-ink"), fontFamily: "inherit" }}
          >
            {message}
          </pre>

          {total > 0 && (
            <p className="mt-2.5 text-xs" style={{ color: v("--ux-muted") }}>
              {allPriced ? "That comes to " : "The priced ones come to "}
              <span className="font-bold tabular-nums" style={{ color: v("--ux-ink") }}>
                {formatRupees(total)}
              </span>
              {allPriced ? "." : " — the rest she will quote you."}
            </p>
          )}

          <div className="mt-3.5">
            <Btn full icon={copied ? "Check" : "Copy"} onClick={copy}>
              {copied ? "Copied — paste it in the chat" : "Copy this message"}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

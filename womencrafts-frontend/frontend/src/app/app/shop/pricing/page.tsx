"use client";

import { useCallback, useMemo } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, Pill, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { apiListings, type Listing } from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/i18n";

/**
 * What should you charge.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * It drew a price bar to scale for four items out of
 * `@/components/ux/shopplus/data`: her price, a low, a high, and a "most ask"
 * marker, under the line *"From 11 women near you"*. There are no eleven women.
 * There is no collection of what anyone charges, no survey, and no router that
 * could answer the question — the whole range was four numbers typed into a
 * fixture, and the screen then told her she was asking **₹1,440 less per item
 * than the women around her** and offered a button to "ask that too", which
 * changed a number in React state and nothing in her shop.
 *
 * A bar drawn to scale is the most convincing thing on a screen. This one was
 * pointing at a price for her actual work, in a product whose entire argument
 * is that women underprice — so the fixture was not decoration, it was advice
 * about her income, and it was invented.
 *
 * The "where the bigger money is" section went with it: three trades with a
 * typical monthly income and *"4 women you know already do this"*, plus a
 * button that said "We will introduce you to a woman doing bridal wear" and
 * introduced her to nobody.
 *
 * ── What it does now ────────────────────────────────────────────────────────
 * Her own prices, from `GET /shop/listings` — real, hers, and the only prices
 * in this product. The comparison is named as the thing we do not have, once,
 * at the top, rather than drawn from nothing.
 *
 * The finding behind the screen is still true and still worth saying, so it is
 * said as what it is: a reason to go and ask three women this week, not a
 * number about her.
 */
export default function PricingPage() {
  const tr = useT();

  const listings = useResource(
    useCallback((s: AbortSignal) => apiListings(s), []),
    [] as Listing[],
  );
  const known = listings.source === "live";
  const rows = useMemo(
    () => [...listings.data].sort((a, b) => b.price_minor - a.price_minor),
    [listings.data],
  );
  const unpriced = useMemo(() => rows.filter((l) => l.price_minor <= 0), [rows]);

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/shop" label="Back to ways to sell" />

        <header>
          <p className={EYEBROW}>{tr("shopPricing.yourPrices")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>What you charge, in one place</h1>
          <p className="mt-1.5 max-w-[56ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed"
             style={{ color: v("--ux-muted") }}>
            Every price you have set, side by side. Seeing them together is usually enough to notice
            the one that has not changed in two years.
          </p>
        </header>

        {/* The thing this screen cannot do, said before the thing it can. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex items-start gap-3.5 p-4 lg:p-5" style={{ background: v("--ux-tint-amber") }}>
            <I name="Info" className="mt-[2px] h-[20px] w-[20px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
            <div className="min-w-0">
              <p className="text-base font-extrabold leading-snug" style={{ color: v("--ux-amber-ink") }}>
                We cannot tell you what other women near you charge.
              </p>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-amber-ink") }}>
                Nobody has collected it. This screen used to draw a range and say it came from eleven
                women in your area — it did not come from anywhere, and it was telling you that you
                were underpriced by a figure we had made up. It is gone.
              </p>
            </div>
          </div>
        </Card>

        {listings.error && (
          <Card pad={16}>
            <div className="flex flex-wrap items-center gap-3">
              <I name="CloudOff" className="h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
              <p role="status" className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                We could not reach WomSakhi, so your prices are not showing. Try again in a moment.
              </p>
              <Btn size="sm" variant="outline" icon="RotateCw" onClick={listings.refetch}>
                {tr("common.retry")}
              </Btn>
            </div>
          </Card>
        )}

        <div>
          <Section title={tr("shopPricing.whatYouSell")} icon="Tag"
                       sub="Your own prices, from your shop"
                       chip={known ? String(rows.length) : undefined} />

          {!known ? (
            <Card pad={16}>
              <p className="text-xsm" style={{ color: v("--ux-muted") }}>
                {listings.error ? "Not showing." : "Loading…"}
              </p>
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon="Tag"
                title="You have not listed anything yet"
                body="Add what you make and what you ask for it. Then this screen is a list of your prices in one place, which is the only thing it can honestly be."
                action={<Btn href="/app/documents" icon="Plus">Add something to sell</Btn>}
              />
            </Card>
          ) : (
            <Card pad={0} style={{ overflow: "hidden" }}>
              {rows.map((l, i) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3.5 px-4 py-4 lg:px-5"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="h-[32px] w-[3px] shrink-0 rounded-full"
                        style={{ background: v(l.kind === "service" ? "--ux-blue-ink" : "--ux-brand") }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{l.title}</p>
                      {l.status !== "live" && <Pill tone="neutral" size="sm">Paused</Pill>}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {l.kind === "service" ? "Your time" : "Something you make"}
                      {l.category ? ` · ${l.category}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    {l.price_minor > 0 ? (
                      <>
                        <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                          {formatRupees(l.price_minor)}
                        </p>
                        {l.rate && (
                          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>{l.rate}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xsm font-bold" style={{ color: v("--ux-amber-ink") }}>
                        No price set
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {known && unpriced.length > 0 && (
            <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              {unpriced.length === 1 ? "One thing has" : `${unpriced.length} things have`} no price on
              it. A customer who has to ask usually does not ask.
            </p>
          )}

          {known && rows.length > 0 && (
            <div className="mt-3">
              <Btn variant="outline" size="sm" icon="Pencil" href="/app/documents" className="max-lg:w-full max-lg:px-4">
                Change a price
              </Btn>
            </div>
          )}
        </div>

        {/* Guidance, not a claim about her. Nothing here is a number about her work. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="p-4 lg:p-5">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
              How to find out what others charge
            </p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              This is the one piece of information that would change your income most, and the only
              way to get it today is to ask. Women systematically underprice, and nobody tells each
              other what they charge — which is exactly why everyone charges too little.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {[
                {
                  what: "Ask three women who do the same work as you. Not what they think you should charge — what they actually got for the last one.",
                  say: "What did you get for the last bridal set you did? I am trying to work out whether I am asking too little.",
                },
                {
                  what: "Ask in your circle rather than one to one. It is a much easier question to answer when several women answer it together, and everybody learns something.",
                },
                {
                  what: "Count the material and your hours before you decide anything. If the price does not cover both, it is not a low price — it is unpaid work.",
                },
                {
                  what: "Raise it on the next new customer, not on the ones you have. You find out what the market takes without risking anybody who already buys from you.",
                },
              ].map((t) => (
                <li key={t.what} className="flex items-start gap-2.5">
                  <I name="Check" className="mt-[3px] h-[14px] w-[14px] shrink-0" sw={2.6}
                     style={{ color: v("--ux-green-ink") }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{t.what}</p>
                    {t.say && (
                      <p className="mt-1.5 border-s-2 ps-3 text-xsm italic leading-relaxed"
                         style={{ borderColor: v("--ux-brand"), color: v("--ux-ink") }}>
                        &ldquo;{t.say}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn variant="outline" size="sm" icon="Users" href="/app/circles" className="max-lg:w-full max-lg:px-4">Ask your circle</Btn>
            </div>
          </div>
        </Card>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              When there is a real range to show you, it will say how many women it came from — and
              below four it will say so plainly, because below four a range is gossip rather than
              information.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

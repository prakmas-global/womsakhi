"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import {
  Back, Btn, Card, DemoNote, I, IconTile, Rating, v,
} from "@/components/ux/kit";
import { LISTINGS, SENT_QUOTE, type QuoteDraft } from "@/components/ux/earn/data";
import { formatWholeRupees } from "@/components/ux/kit/money";
import { GROUP, GROUP_ROW, STEP_NAV } from "@/components/ux/earn/phone";

/**
 * "Request sent" — the end of the buyer's half of a quote.
 *
 * ── Why the whole screen is about what happens next ─────────────────────────
 * A quote request is the one thing a buyer sends that gets no immediate
 * answer. Left with a tick and nothing else she does not know whether to wait
 * an hour or a week, so she asks again, or gives up. Three numbered steps and
 * a stated response time are the whole point of this screen; the tick is the
 * smallest part of it.
 *
 * ── Nothing was sent ────────────────────────────────────────────────────────
 * There is no quote endpoint yet. The drawer put its draft in sessionStorage
 * and this screen reads it back, so what she sees is what she typed — but no
 * seller has been told, and the note at the top says exactly that.
 */

const NEXT = [
  { icon: "Mail",          title: "She reads what you sent",
    body: "She goes through your requirements and what you can spend, usually within a day." },
  { icon: "MessageSquare", title: "A price comes back",
    body: "You are told the moment it does — the price, how long it takes, and anything she needs to ask." },
  { icon: "Check",         title: "Talk it through, then agree",
    body: "You can change the details with her. Nothing is an order until you both say so." },
] as const;

/**
 * The draft, read from sessionStorage without a render-then-correct.
 *
 * `useState` + `useEffect` would paint the fallback figures first and swap in
 * hers a frame later — a visible flicker on the one screen whose whole job is
 * to show her what she just typed. `useSyncExternalStore` gives React a server
 * snapshot (null) and a client snapshot (the stored string), so the first
 * client render already has it and hydration still matches.
 */
const NOTHING_CHANGES = () => () => {};
const readDraft = () => {
  try { return sessionStorage.getItem("ws.quote.draft"); }
  catch { return null; }        // private window, or storage switched off
};

export default function QuoteSentPage() {
  const raw = useSyncExternalStore(NOTHING_CHANGES, readDraft, () => null);
  const draft = useMemo<QuoteDraft | null>(() => {
    if (!raw) return null;
    try { return JSON.parse(raw) as QuoteDraft; }
    catch { return null; }       // something else wrote nonsense to that key
  }, [raw]);

  const seller = draft?.seller || SENT_QUOTE.seller;
  const budget = draft?.budgetLow && draft?.budgetHigh
    ? `${formatWholeRupees(Number(draft.budgetLow))} – ${formatWholeRupees(Number(draft.budgetHigh))}`
    : draft?.budgetLow
      ? `About ${formatWholeRupees(Number(draft.budgetLow))}`
      : `${formatWholeRupees(SENT_QUOTE.budgetLow ?? 0)} – ${formatWholeRupees(SENT_QUOTE.budgetHigh ?? 0)}`;

  return (
    <HomeShell active="/app/documents" wide bare>
      <div className="mx-auto w-full max-w-[1080px]">
        <Back to="/app/documents/new" label="Add product or service" />

        <DemoNote what="The quote you just sent, and the seller's other listings," />

        {/* The tick, and the one line she needs */}
        <header className="mb-6 flex flex-wrap items-start gap-4 lg:mb-5">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full"
                style={{ background: v("--ux-green"), color: v("--ux-on-green") }}>
            <Icons.Check className="h-[26px] w-[26px]" strokeWidth={3} />
          </span>
          <div className="min-w-[260px] flex-1">
            <h1 className="ux-screen-title text-3xl font-extrabold leading-tight tracking-[-0.02em]"
                style={{ color: v("--ux-ink") }}>
              Request sent
            </h1>
            <p className="mt-1.5 text-smd font-bold" style={{ color: v("--ux-ink-2") }}>
              Your quote request has gone to {seller}.
            </p>
            <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
              She will read your requirements and come back to you.
            </p>
          </div>
          <Btn href="/app/documents#orders" variant="outline" className="max-lg:w-full">See all your requests</Btn>
        </header>

        {/* What happens next */}
        <Card className="mb-6 lg:mb-5">
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_270px]">
            <div className="relative overflow-hidden rounded-[16px]"
                 style={{ background: "linear-gradient(160deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/scene-women-celebrating.webp" alt="" aria-hidden loading="lazy" decoding="async"
                   className="h-full min-h-[190px] w-full object-cover object-top" />
              <p className="absolute end-3 top-3 text-lg font-extrabold italic leading-none"
                 style={{ color: v("--ux-brand") }}>
                Thank you!
              </p>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>
                What happens next?
              </h2>
              <ol className="space-y-4">
                {NEXT.map((n, i) => (
                  <li key={n.title} className="relative flex gap-3.5 pb-1">
                    {/* The rule between the steps — this really is a sequence. */}
                    {i < NEXT.length - 1 && (
                      <span aria-hidden className="absolute start-[11px] top-[30px] h-[calc(100%+8px)] w-[1.5px]"
                            style={{ background: v("--ux-line") }} />
                    )}
                    <span className="relative z-[1] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-2xs font-extrabold"
                          style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
                      {i + 1}
                    </span>
                    <IconTile icon={n.icon} tint="--ux-brand-tint-2" ink="--ux-brand" size={34} radius={10} />
                    <span className="min-w-0">
                      <span className="block text-xsm font-bold" style={{ color: v("--ux-ink") }}>{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                        {n.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3.5">
              <div className="rounded-[12px] p-4 lg:rounded-[14px]" style={{ background: v("--ux-brand-tint") }}>
                <div className="flex items-start gap-2.5">
                  <IconTile icon="Clock" tint="--ux-surface" ink="--ux-brand" size={34} radius={10} />
                  <span className="min-w-0">
                    <span className="block text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                      She usually replies
                    </span>
                    <span className="mt-0.5 block text-smd font-extrabold" style={{ color: v("--ux-ink") }}>
                      Within 24 hours
                    </span>
                  </span>
                </div>
                <p className="mt-2.5 text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  You are told here in the app{draft?.email ? `, and at ${draft.email}` : ""}.
                </p>
              </div>

              <figure className="rounded-[12px] p-4 lg:rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
                <I name="Quote" className="h-[17px] w-[17px]" style={{ color: v("--ux-brand") }} />
                <blockquote className="mt-2 text-smd font-extrabold leading-snug" style={{ color: v("--ux-brand") }}>
                  Every big order started as somebody asking a question.
                </blockquote>
                <figcaption className="mt-2 text-2xs" style={{ color: v("--ux-muted") }}>— WomSakhi</figcaption>
              </figure>
            </div>
          </div>
        </Card>

        {/* What she asked for, back in her own words */}
        <Card className="mb-6 lg:mb-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3.5"
               style={{ borderColor: v("--ux-line") }}>
            <h2 className="text-xl font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>
              What you asked for
            </h2>
            <span className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>
              Request {SENT_QUOTE.id}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex gap-3.5 md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft?.photo || LISTINGS[0].photo} alt="" aria-hidden loading="lazy" decoding="async"
                   className="h-[92px] w-[92px] rounded-[12px] object-cover md:h-[150px] md:w-full"
                   style={{ background: v("--ux-media-bed") }} />
              <div className="min-w-0 md:mt-3">
                <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                  {draft?.title || LISTINGS[0].title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>By {seller}</p>
                <span className="mt-1.5 block"><Rating value="4.7" count="3 reviews" /></span>
                <Link href="/app/documents/listings" className="ux-sq mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold"
                      style={{ color: v("--ux-brand") }}>
                  See the listing <Icons.ChevronRight className="h-[13px] w-[13px]" />
                </Link>
              </div>
            </div>

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Fact k="How many" v={draft?.quantity ? `${draft.quantity} pieces` : `${SENT_QUOTE.quantity} pieces`} />
              <Fact k="When you need it" v={draft?.by || SENT_QUOTE.by || "No date given"} />
              <Fact k="What you can spend" v={budget} />
              <Fact k="Where it goes" v={draft?.place || SENT_QUOTE.place} />
              <div className="sm:col-span-2">
                <dt className="text-2xs font-semibold" style={{ color: v("--ux-muted") }}>What you said</dt>
                <dd className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink") }}>
                  {draft?.needs?.trim() || SENT_QUOTE.notes.join(". ") + "."}
                </dd>
                {(draft?.extras?.length ?? 0) > 0 && (
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {draft!.extras.map((x) => (
                      <span key={x} className="rounded-full px-2.5 py-1 text-2xs font-semibold"
                            style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                        {x}
                      </span>
                    ))}
                  </dd>
                )}
              </div>
            </dl>
          </div>
        </Card>

        {/* The rest of the shop, while she is here */}
        <section className="mb-6">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 lg:mb-3.5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--ux-muted)] max-lg:px-1 lg:text-xl lg:font-extrabold lg:normal-case lg:tracking-[-0.01em] lg:text-[color:var(--ux-ink)]">
                You might also like
              </h2>
              <p className="mt-0.5 text-[13px] max-lg:px-1 lg:text-xs" style={{ color: v("--ux-muted") }}>
                More from {seller}
              </p>
            </div>
            <Link href="/app/documents/listings" className="ux-sq flex items-center gap-0.5 text-[15px] font-semibold lg:text-xs lg:font-bold"
                  style={{ color: v("--ux-brand") }}>
              See the whole shop <Icons.ArrowRight className="h-[13px] w-[13px]" />
            </Link>
          </div>

          {/* A phone gets the shelf as a list: thumbnail, name, price, rating. */}
          <div className={`grid gap-3.5 ${GROUP}`} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {LISTINGS.filter((l) => l.priceMode !== "quote").map((l) => (
              <Link key={l.id} href="/app/documents/listings" className={`ux-card ux-hov ux-sq block overflow-hidden max-lg:flex max-lg:items-center ${GROUP_ROW}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.photo} alt="" aria-hidden loading="lazy" decoding="async"
                     className="h-[132px] w-full object-cover max-lg:ms-4 max-lg:h-[64px] max-lg:w-[64px] max-lg:shrink-0 max-lg:rounded-[12px]" style={{ background: v("--ux-media-bed") }} />
                <span className="block p-3.5 max-lg:min-w-0 max-lg:flex-1 max-lg:px-4 max-lg:py-3">
                  <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{l.title}</span>
                  <span className="mt-1 block text-smd font-extrabold" style={{ color: v("--ux-brand") }}>
                    {formatWholeRupees(l.price)}
                  </span>
                  <span className="mt-1.5 block"><Rating value="4.7" count={`${l.orders} sold`} /></span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className={`flex flex-wrap items-center justify-between gap-3 pb-2 ${STEP_NAV}`}>
          <Btn href="/app/documents/listings" variant="outline" icon="ArrowLeft" className="max-lg:w-full">Back to what you sell</Btn>
          <Btn href="/app/documents/new" icon="Plus" className="ux-action-primary">Ask about something else</Btn>
        </div>
      </div>
    </HomeShell>
  );
}

function Fact({ k, v: val }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold" style={{ color: v("--ux-muted") }}>{k}</dt>
      <dd className="mt-1 text-xsm font-bold" style={{ color: v("--ux-ink") }}>{val}</dd>
    </div>
  );
}

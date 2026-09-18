"use client";

import type { ReactNode } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, v } from "@/components/ux/kit";
import { EYEBROW } from "@/components/ux/earn/phone";

/**
 * The shape of a selling screen that is an intention, not a feature.
 *
 * ── Why these screens still exist ───────────────────────────────────────────
 * Seven of the ten screens under "Ways to sell" were built on
 * `@/components/ux/shopplus/data` — a fixture file whose own header says "mock
 * data throughout". Every one of them rendered money as though it were hers
 * (`₹6.6 lakh paid to you up front`), and every button on them was a
 * `setState` that printed a confirmation for something that had not happened:
 * "Asked Sunita Devi for ₹1,800 cloth money", "Price sent to Anand Cloth
 * House", "Sunita Devi has been asked. She will hear both of you."
 *
 * There is no collection and no router behind any of it. Nothing was requested,
 * nobody was told, and it was gone on reload.
 *
 * Deleting the routes was the other option and it is the worse one. These are
 * real intentions for this product, each with a finding behind it, and — more
 * useful than either — each one describes something she can do **today, on
 * WhatsApp, with no app at all.** A woman who reads "ask for the cost of the
 * cloth up front, and take it on your own UPI" has got the whole value of the
 * pre-orders module without WomSakhi being involved. A 404 gives her nothing.
 *
 * ── So the shape is fixed, and it is three parts ────────────────────────────
 *   1. What WomSakhi cannot do, named in one sentence, at the top, before
 *      anything else. Not an apology and not a roadmap promise.
 *   2. What she can do today without us — specific enough to act on, with the
 *      words to say where the words are the hard part.
 *   3. What the screen will do when it is built — so the intention is not lost,
 *      and so nobody rebuilds the fixture.
 *
 * Anything the server genuinely knows goes in `children`, between 1 and 2.
 * That is the only place a number may appear on one of these screens.
 */
export function NotYetScreen({
  eyebrow, title, lede, cannot, why, today, later, footer, children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** One sentence, in her words, naming what the app cannot do. */
  cannot: string;
  /** Why not — the structural reason, not a schedule. */
  why: string;
  /** What she can do without the app. `say` is the sentence to send, if any. */
  today: { what: string; say?: string }[];
  /** What this screen will do once there is something behind it. */
  later: string[];
  /** Where to go from here. */
  footer?: ReactNode;
  /** Anything real the server actually holds. */
  children?: ReactNode;
}) {
  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/shop" label="Back to ways to sell" />

        <header>
          <p className={EYEBROW}>{eyebrow}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{title}</h1>
          <p className="mt-1.5 max-w-[58ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed"
             style={{ color: v("--ux-muted") }}>{lede}</p>
        </header>

        {/* The thing that is not true, said before anything that is. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex items-start gap-3.5 p-4 lg:p-5" style={{ background: v("--ux-tint-amber") }}>
            <I name="Info" className="mt-[2px] h-[20px] w-[20px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
            <div className="min-w-0">
              <p className="text-base font-extrabold leading-snug" style={{ color: v("--ux-amber-ink") }}>
                {cannot}
              </p>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-amber-ink") }}>
                {why}
              </p>
            </div>
          </div>
        </Card>

        {children}

        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="p-4 lg:p-5">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
              What you can do today, without us
            </p>
            <ul className="mt-2.5 flex flex-col gap-3">
              {today.map((t) => (
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
            {footer && <div className="mt-4 flex flex-wrap gap-2 max-lg:[&>*]:w-full max-lg:[&>*]:px-4">{footer}</div>}
          </div>
        </Card>

        <div>
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:text-2xs lg:font-extrabold lg:tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
              What this screen will do when it is built
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {later.map((l) => (
                <li key={l} className="flex items-start gap-2.5">
                  <I name="Dot" className="mt-[2px] h-[15px] w-[15px] shrink-0" sw={2.4}
                     style={{ color: v("--ux-line-strong") }} />
                  <span className="text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{l}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              Until then nothing on this screen is a record of anything, and there is no number here
              about you or your money.
            </p>
          </Card>
        </div>
      </div>
    </HomeShell>
  );
}

/** The single place these screens send her when she asks "so where do I write it down?" */
export function WriteItDown() {
  return (
    <>
      <Btn variant="outline" size="sm" icon="Store" href="/app/documents">Your shop and orders</Btn>
      <Btn variant="ghost" size="sm" icon="Landmark" href="/app/collect">How you get paid</Btn>
    </>
  );
}

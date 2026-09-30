"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useToast } from "@/design-system";
import { useMarket } from "@/components/ux/live";
import { messageFrom } from "@/lib/use-action";
import {
  apiCheckin, apiDismissMakeItYours, changeHref, questionForReason, reasonDetail, reasonGoal,
  type ApiHomePersonal, type HomeChecklistItem, type HomeJobMatch,
} from "@/lib/personal-api";

/**
 * The personal home — the parts of Home her onboarding answers add.
 *
 * ── The rules these components keep ─────────────────────────────────────
 * **Nothing is removed.** Her answers bring some existing cards forward and
 * add a few of their own; every card a woman with no answers sees is still
 * here, lower down. A helper handed the phone finds the same things.
 *
 * **Every card says why.** A personalised card carries the server's own reason
 * ("Because you chose Earn · Tailoring") and a Change link to the one question
 * that put it there. Nothing is reasoned about on this side.
 *
 * **No invented progress.** The checklist ticks exactly what the server says
 * is done — read from her account, her listing and her enrolments every time.
 *
 * Two sizes: `phone` matches MobileHome (px type, 12px radii, the section
 * label style), `desk` matches the Dashboard panels (the text-* scale, 16px
 * radii, the card shadow).
 */

export type Size = "phone" | "desk";

/* ── ordering ─────────────────────────────────────────────────────────── */

/**
 * Her blocks first, in her order, then every other block in its usual order.
 *
 * `available` is what this screen can draw. A hint for a block the screen does
 * not have (a phone has no circles panel) is skipped rather than invented, and
 * `shop_feed` is drawn only when the server asked for it.
 */
export function orderBlocks(base: readonly string[], personal: ApiHomePersonal | null | undefined, extra: readonly string[] = []) {
  if (!personal) return { mine: [] as string[], rest: [...base] };
  const can = new Set([...base, ...extra]);
  const mine = personal.order.filter((b, i, a) => can.has(b) && a.indexOf(b) === i
    && (b !== "shop_feed" || personal.shop_feed));
  if (personal.shop_feed && can.has("shop_feed") && !mine.includes("shop_feed")) mine.push("shop_feed");
  return { mine, rest: base.filter((b) => !mine.includes(b)) };
}

/* ── "Why this? · Change" ─────────────────────────────────────────────── */

/**
 * The reason line.
 *
 * "Change" opens the single question the reason came from — her skills for a
 * tailoring card — not the whole flow. The link is 44px tall; the negative
 * margin keeps the line itself compact.
 */
export function WhyLine({ reason, size = "phone", tone = "card" }: {
  reason: string | undefined; size?: Size; tone?: "card" | "brand";
}) {
  if (!reason) return null;
  const q = questionForReason(reason);
  const said = [reasonGoal(reason), reasonDetail(reason)].filter(Boolean).join(" · ");
  const ink = tone === "brand" ? "var(--ux-on-brand-2)" : "var(--ux-muted)";
  const link = tone === "brand" ? "var(--ux-on-brand)" : "var(--ux-brand)";
  const what = q === "skills" ? "your skills" : q === "learn_topics" ? "what you want to learn"
    : q === "meet" ? "who you want to meet" : "what brings you here";
  return (
    /* A div, not a p: the phone tier exempts links inside a paragraph from
       the 44px floor (they are words in a sentence), and this one is a real
       control that must keep its target. */
    <div className={`flex flex-wrap items-center gap-x-1.5 ${size === "phone" ? "text-[13px]" : "text-2xs"} leading-snug`}
         style={{ color: ink }}>
      <Icons.Sparkles aria-hidden className={size === "phone" ? "h-3.5 w-3.5 shrink-0" : "h-3 w-3 shrink-0"} />
      <span>
        <span className="font-semibold">Why this?</span> You chose {said || "this"}
      </span>
      <span aria-hidden>·</span>
      <Link href={changeHref(q, "/app")}
            aria-label={`Change ${what}`}
            className="ux-hov -mx-2 -my-3 inline-flex min-h-[44px] items-center rounded-[10px] px-2 font-semibold"
            style={{ color: link }}>
        Change
      </Link>
    </div>
  );
}

/* ── the card frame ───────────────────────────────────────────────────── */

function Frame({ size, children, label, className = "", style }: {
  size: Size; children: ReactNode; label: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <section aria-label={label}
             className={`ux-sq ${size === "phone" ? "rounded-[16px] p-4" : "rounded-[16px] p-5"} ${className}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: size === "desk" ? "var(--ux-shadow-card)" : undefined, ...style }}>
      {children}
    </section>
  );
}

const btnPrimary = "ux-press ux-btn-g inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 font-bold";
const btnQuiet = "ux-press ux-hov inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 font-semibold";
const primaryStyle = { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" };
const quietStyle = { background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" };

/* ── First steps ──────────────────────────────────────────────────────── */

/**
 * Four steps, ticked only where the server found them done.
 *
 * The next undone step is the one link with weight: the smallest thing she can
 * finish now. Done steps stay visible — two honest ticks are the reason the
 * card is worth finishing — but are not links, because there is nothing left
 * to do there.
 */
export function FirstSteps({ items, size = "phone" }: { items: HomeChecklistItem[]; size?: Size }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done);
  const pct = Math.round((done * 100) / items.length);
  const phone = size === "phone";

  return (
    <Frame size={size} label="Your first steps">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={phone ? "text-[17px] font-semibold" : "text-sm font-bold tracking-tight"}
            style={{ color: "var(--ux-ink)" }}>
          Your first steps
        </h2>
        <p className={`${phone ? "text-[13px]" : "text-xs"} font-semibold tabular-nums`} style={{ color: "var(--ux-muted)" }}>
          {done} of {items.length} done
        </p>
      </div>
      <div className="mt-2.5 h-[7px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}
           role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
           aria-label={`${done} of ${items.length} first steps done`}>
        <div className="h-full rounded-full"
             style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))",
                      transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
      </div>

      <ol className="mt-3 space-y-0.5">
        {items.map((it) => {
          const isNext = it === next;
          const mark = (
            <span aria-hidden
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                  style={it.done
                    ? { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }
                    : { border: `2px solid ${isNext ? "var(--ux-brand)" : "var(--ux-line-strong)"}` }}>
              {it.done && <Icons.Check className="h-[14px] w-[14px]" strokeWidth={3} />}
            </span>
          );
          const text = (
            <span className={`min-w-0 flex-1 ${phone ? "text-[15px]" : "text-xsm"} ${isNext ? "font-bold" : "font-medium"}`}
                  style={{ color: it.done ? "var(--ux-ink-2)" : "var(--ux-ink)" }}>
              {it.label}
              <span className="sr-only">{it.done ? " — done" : isNext ? " — your next step" : " — not done yet"}</span>
            </span>
          );
          return (
            <li key={it.key}>
              {it.done ? (
                <div className="flex min-h-[44px] items-center gap-3 px-1">{mark}{text}</div>
              ) : (
                <Link href={it.href}
                      className="ux-row -mx-1 flex min-h-[44px] items-center gap-3 rounded-[12px] px-2"
                      style={isNext ? { background: "var(--ux-brand-tint)" } : undefined}>
                  {mark}{text}
                  {isNext
                    ? <span className={`${phone ? "text-[13px]" : "text-xs"} shrink-0 font-bold`} style={{ color: "var(--ux-brand)" }}>Next</span>
                    : null}
                  <Icons.ChevronRight aria-hidden className="h-4 w-4 shrink-0" style={{ color: isNext ? "var(--ux-brand)" : "var(--ux-faint)" }} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}

/* ── Make WomSakhi yours ──────────────────────────────────────────────── */

export function MakeItYours({ size = "phone" }: { size?: Size }) {
  const toast = useToast();
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (gone) return null;
  const phone = size === "phone";

  const hide = async () => {
    setBusy(true);
    try {
      await apiDismissMakeItYours();
      setGone(true);
      toast.success("Hidden", { description: "You can answer any time from More → My answers." });
    } catch (e) {
      toast.error("That did not go through", { description: messageFrom(e, "Try again in a moment.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame size={size} label="Make WomSakhi yours" className="@container overflow-hidden !p-0">
      {/* Side by side only when the CARD is wide enough — the home column
          beside the nav and the rail is ~640px on a laptop, so a viewport
          breakpoint would squeeze the text into a strip. */}
      <div className={phone ? "flex flex-col" : "flex flex-col @lg:flex-row"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/onboarding/sakhi-480.webp" alt="" aria-hidden width={480} height={320}
             loading="lazy" decoding="async"
             className={phone ? "h-[132px] w-full object-cover object-[50%_40%]" : "h-[150px] w-full object-cover object-[50%_40%] @lg:h-auto @lg:w-[220px] @lg:shrink-0"} />
        <div className={phone ? "p-4" : "flex min-w-0 flex-1 flex-col justify-center p-5"}>
          <h2 className={phone ? "text-[17px] font-semibold" : "text-base font-bold tracking-tight"}
              style={{ color: "var(--ux-ink)" }}>
            Make WomSakhi yours
          </h2>
          <p className={`mt-1 ${phone ? "text-[14px]" : "text-xsm"} leading-snug`} style={{ color: "var(--ux-ink-2)" }}>
            A few quick taps so your home shows what you need first. About a minute, and you can skip any question.
          </p>
          <div className={`mt-3.5 flex flex-wrap gap-2 ${phone ? "text-[15px]" : "text-xsm"}`}>
            <Link href="/app/onboarding" className={btnPrimary} style={primaryStyle}>
              Continue <Icons.ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <button type="button" onClick={() => void hide()} disabled={busy} aria-busy={busy}
                    className={btnQuiet} style={quietStyle}>
              {busy ? "Hiding…" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ── the 90-day check-in ──────────────────────────────────────────────── */

/**
 * "Still looking for tailoring work?"
 *
 * The question is built from her own reason lines — the skill and the goal the
 * server already names — so it asks about something she said, and falls back
 * to "your answers" when there is nothing specific to name.
 */
export function CheckIn({ personal, size = "phone" }: { personal: ApiHomePersonal; size?: Size }) {
  const toast = useToast();
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (gone) return null;
  const phone = size === "phone";

  const goals = personal.goals;
  const skill = reasonDetail(personal.reasons.opportunities || personal.reasons.earnings || "");
  const topic = reasonDetail(personal.reasons.recommended || "");
  const question =
    (goals.includes("find_job") || goals.includes("earn_home")) && skill ? `Still looking for ${skill.toLowerCase()} work?`
    : goals.includes("sell") && skill ? `Still selling ${skill.toLowerCase()}?`
    : goals.includes("learn") && topic ? `Still want to learn about ${topic.toLowerCase()}?`
    : "Are your answers still right for you?";

  const same = async () => {
    setBusy(true);
    try {
      await apiCheckin();
      setGone(true);
      toast.success("Thanks — nothing changed", { description: "We'll ask again in three months." });
    } catch (e) {
      toast.error("That did not go through", { description: messageFrom(e, "Try again in a moment.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame size={size} label="Check your answers">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          <Icons.RefreshCw className="h-[19px] w-[19px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={phone ? "text-[17px] font-semibold leading-snug" : "text-sm font-bold leading-snug"}
              style={{ color: "var(--ux-ink)" }}>
            {question}
          </h2>
          <p className={`mt-0.5 ${phone ? "text-[13px]" : "text-xs"} leading-snug`} style={{ color: "var(--ux-muted)" }}>
            It&apos;s been a while since you told us. Your home follows your answers.
          </p>
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap gap-2 ${phone ? "text-[15px]" : "text-xsm"}`}>
        <button type="button" onClick={() => void same()} disabled={busy} aria-busy={busy}
                className={btnPrimary} style={primaryStyle}>
          <Icons.Check className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : "Yes, same"}
        </button>
        <Link href="/app/settings/answers" className={btnQuiet} style={quietStyle}>
          Update
        </Link>
      </div>
    </Frame>
  );
}

/* ── new jobs from her saved search ───────────────────────────────────── */

export function NewJobs({ matches, reason, size = "phone" }: {
  matches: { count: number; items: HomeJobMatch[] }; reason?: string; size?: Size;
}) {
  if (!matches.count) return null;
  const phone = size === "phone";
  return (
    <Frame size={size} label="New jobs for you" className="overflow-hidden !p-0">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/onboarding/job-480.webp" alt="" aria-hidden width={480} height={320}
             loading="lazy" decoding="async"
             className={`w-full object-cover object-[50%_35%] ${phone ? "h-[104px]" : "h-[112px]"}`} />
        <span className="absolute bottom-2.5 start-3 rounded-full px-2.5 py-1 text-2xs font-bold tabular-nums"
              style={{ background: "var(--ux-surface)", color: "var(--ux-brand)", boxShadow: "var(--ux-shadow-sm)" }}>
          {matches.count} new
        </span>
      </div>
      <div className={phone ? "p-4" : "p-5"}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={phone ? "text-[17px] font-semibold" : "text-sm font-bold tracking-tight"}
              style={{ color: "var(--ux-ink)" }}>
            New jobs for you
          </h2>
          <Link href="/app/opportunities"
                className={`ux-hov -my-3 -me-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-[10px] px-2 ${phone ? "text-[13px]" : "text-xs"} font-semibold`}
                style={{ color: "var(--ux-brand)" }}>
            See all <Icons.ChevronRight className="h-[14px] w-[14px]" aria-hidden />
          </Link>
        </div>
        <p className={`mt-0.5 ${phone ? "text-[13px]" : "text-xs"}`} style={{ color: "var(--ux-muted)" }}>
          {matches.count === 1 ? "1 job matches" : `${matches.count} jobs match`} your skills since you saved your search.
        </p>
        <ul className="mt-2.5 space-y-0.5">
          {matches.items.map((j) => (
            <li key={j.id}>
              <Link href={`/app/opportunities/${j.id}`}
                    className="ux-row -mx-2 flex min-h-[44px] items-center gap-3 rounded-[12px] px-2 py-1.5">
                <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
                      style={{ background: "var(--ux-tint-blue)", color: "var(--ux-blue-ink)" }}>
                  <Icons.Briefcase className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${phone ? "text-[15px]" : "text-xsm"} font-semibold`} style={{ color: "var(--ux-ink)" }}>
                    {j.title || "Job"}
                  </span>
                  {(j.org || j.location) && (
                    <span className={`block truncate ${phone ? "text-[13px]" : "text-2xs"}`} style={{ color: "var(--ux-muted)" }}>
                      {[j.org, j.location].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <Icons.ChevronRight aria-hidden className="h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} />
              </Link>
            </li>
          ))}
        </ul>
        {reason && <div className="mt-2"><WhyLine reason={reason} size={size} /></div>}
      </div>
    </Frame>
  );
}

/* ── the shop feed ────────────────────────────────────────────────────── */

/**
 * What women are selling, for a woman who said she came to shop (or to sell —
 * seeing what sells is the first market research she will do).
 *
 * Read from the market as it is; mounted only when the server asks for it, so
 * no one else pays for the request. Nothing is followed or saved for her.
 */
export function ShopFeed({ size = "phone" }: { size?: Size }) {
  const { data: rows, source } = useMarket();
  const phone = size === "phone";
  const items = rows.slice(0, phone ? 6 : 4);

  if (source === "loading") {
    return <div className="ux-shimmer h-[178px] rounded-[12px]" style={{ background: "var(--ux-surface-2)" }} aria-hidden />;
  }
  if (!items.length) {
    return (
      <p className={`${phone ? "px-4 text-[13px]" : "text-xsm"} py-2`} style={{ color: "var(--ux-muted)" }}>
        {source === "error" ? "We could not load the market just now." : "Nothing is for sale near you yet. New things show up here first."}
      </p>
    );
  }
  return (
    <ul className={phone ? "ux-hscroll flex gap-3" : "grid grid-cols-2 gap-3 2xl:grid-cols-4"}>
      {items.map((l) => (
        <li key={l.id} className={phone ? "w-[44vw] max-w-[190px] shrink-0" : "min-w-0"}>
          <Link href={`/app/market/${l.id}`}
                className="ux-sq ux-card block overflow-hidden rounded-[12px]"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            {l.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photo} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <span className="grid aspect-[4/3] w-full place-items-center" style={{ background: "var(--ux-brand-tint-2)" }}>
                <Icons.ShoppingBag className="h-6 w-6" style={{ color: "var(--ux-brand)" }} aria-hidden />
              </span>
            )}
            <span className="block p-3">
              <span className={`block truncate ${phone ? "text-[14px]" : "text-xsm"} font-semibold`} style={{ color: "var(--ux-ink)" }}>
                {l.title}
              </span>
              <span className={`mt-0.5 block truncate ${phone ? "text-[13px]" : "text-2xs"} tabular-nums`} style={{ color: "var(--ux-muted)" }}>
                {[l.price_label, l.seller?.name].filter(Boolean).join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── the cards that come before her blocks ────────────────────────────── */

/**
 * The check-in, the "Make it yours" invitation and new jobs — each only when
 * the server says so. The checklist is drawn by the caller: under her name on
 * a phone, in the rail on a computer.
 */
export function PersonalCards({ personal, size = "phone" }: { personal: ApiHomePersonal; size?: Size }) {
  const cards = [
    personal.checkin_due && <CheckIn key="checkin" personal={personal} size={size} />,
    personal.make_it_yours && <MakeItYours key="yours" size={size} />,
    personal.new_job_matches.count > 0 && (
      <NewJobs key="jobs" matches={personal.new_job_matches} size={size}
               reason={personal.reasons.opportunities} />
    ),
  ].filter(Boolean);
  if (!cards.length) return null;
  return (
    <div className={size === "desk" ? "@container" : ""}>
      <div className={size === "desk" ? "grid grid-cols-1 gap-4 @4xl:grid-cols-2" : "flex flex-col gap-4"}>
        {cards}
      </div>
    </div>
  );
}

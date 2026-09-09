"use client";

import { memo } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";
import { matchFor, matchTone } from "@/services/job-match";

import type { Application, Opportunity } from "@/lib/growth-api";
import type { GroupBuy } from "@/lib/entitlements-api";
import type { Listing, ShopOrder } from "@/lib/shop-api";
import type { WalletTxn } from "@/lib/wallet-api";
import { formatMoney } from "@/components/ux/kit/money";
import { useT } from "@/i18n";

/**
 * Earn, four ways.
 *
 * The same work, the same numbers, four ways of looking at them — because the
 * women using this do not think about money the same way. One reads a ledger
 * and adds it up; one reads a feed; one wants to see what is stuck and what
 * has cleared; one wants to be shown the single best thing and told why.
 *
 * Every view is built from the same props, so none of them can drift into
 * showing a different truth than its neighbour.
 */

export interface EarnData {
  balanceMinor: number;
  earnedMinor: number;
  owedMinor: number;
  openMinor: number;
  orders: ShopOrder[];
  opps: Opportunity[];
  apps: Application[];
  pools: GroupBuy[];
  listings: Listing[];
  txns: WalletTxn[];
}

/**
 * One formatter, hoisted, in `kit/money`.
 *
 * This file carried its own copy, and the copy built a fresh
 * `Intl.NumberFormat` on every single call — constructing a locale formatter
 * per figure, on screens that print dozens of them. `kit/money` builds it once
 * at module scope. Byte-identical output; re-exported under the old name so
 * nothing has to change its imports.
 */
export const rupees = formatMoney;

/**
 * What a day of it actually pays.
 *
 * The number every listing hides and every woman needs: ₹18,000 for three
 * weeks is worse than ₹12,000 a month, and no job board will tell her that.
 * Returns null rather than a guess when the period is not something we can
 * divide honestly.
 */
/**
 * Whether she can still apply.
 *
 * `status` stays "open" past the closing date — the server only checks the
 * deadline when the application is posted, so a listing whose date has gone
 * still renders an Apply button that can only fail. Better to say "Closed"
 * than to let her press a button and be told no.
 */
export function isOpen(o: Opportunity): boolean {
  const d = o.deadline;
  if (!d) return true;
  const when = new Date(`${d}T23:59:59`);
  return Number.isNaN(when.getTime()) || when.getTime() >= Date.now();
}

export function dayRate(o: Opportunity): string | null {
  const high = (o as unknown as { pay_high_minor?: number }).pay_high_minor ?? 0;
  const period = ((o as unknown as { pay_period?: string }).pay_period ?? "").toLowerCase();
  if (!high) return null;
  const days = period.includes("month") ? 26
    : period.includes("week") ? 6
    : period.includes("order") || period.includes("project") ? 21
    : period.includes("day") ? 1
    : 0;
  if (!days) return null;
  return `₹${Math.round(high / 100 / days).toLocaleString("en-IN")} a day`;
}

const TONE: Record<string, [string, string]> = {
  green: ["--ux-tint-green", "--ux-green-ink"],
  amber: ["--ux-tint-amber", "--ux-amber-ink"],
  violet: ["--ux-tint-violet", "--ux-violet-ink"],
  blue: ["--ux-tint-blue", "--ux-blue-ink"],
  pink: ["--ux-tint-pink", "--ux-pink-ink"],
};

function Tile({ tone, children, size = 40 }: { tone: string; children: React.ReactNode; size?: number }) {
  const [tint, ink] = TONE[tone] ?? TONE.violet;
  return (
    <span className="grid shrink-0 place-items-center rounded-[12px] font-extrabold"
          style={{ width: size, height: size, color: `var(${ink})`,
                   background: `linear-gradient(150deg, var(${tint}), color-mix(in srgb, var(${tint}) 52%, var(--ux-surface)))`,
                   boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)" }}>
      {children}
    </span>
  );
}

const Sec = ({ children, href }: { children: React.ReactNode; href?: string }) => {
  const tr = useT();
  return (
  <h2 className="mb-3.5 mt-7 flex items-center gap-2.5 text-2xs font-extrabold uppercase tracking-[0.16em] first:mt-0"
      style={{ color: "var(--ux-faint)" }}>
    {children}
    {href && (
      <Link href={href} className="ux-press ms-auto flex min-h-[34px] items-center rounded-[12px] px-3 text-xs font-bold normal-case tracking-normal"
            style={{ color: "var(--ux-brand)" }}>{tr("opportunities.seeAll")}</Link>
    )}
  </h2>
  );
};

const Btn = ({ primary, onClick, children, disabled }: {
  primary?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean;
}) => (
  <button type="button" onClick={onClick} disabled={disabled}
          className="ux-press inline-flex min-h-[42px] items-center gap-2 rounded-[12px] px-4 text-xsm font-bold disabled:opacity-60"
          style={primary
            ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
            : { border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                color: "var(--ux-ink-2)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
    {children}
  </button>
);

/**
 * A link that looks like a button.
 *
 * These were `<Link><Btn/></Link>`, which nests a button inside an anchor —
 * invalid, and the anchor collapsed to a 20px hit area on a phone while the
 * button inside it looked 42px tall. One element, styled, is both correct and
 * actually tappable.
 */
const LinkBtn = ({ href, primary, children }: {
  href: string; primary?: boolean; children: React.ReactNode;
}) => (
  <Link href={href}
        className="ux-press inline-flex min-h-[42px] items-center gap-2 rounded-[12px] px-4 text-xsm font-bold"
        style={primary
          ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
          : { border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
              color: "var(--ux-ink-2)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
    {children}
  </Link>
);

const card = {
  background: "linear-gradient(168deg, var(--ux-surface-2), var(--ux-surface) 48%)",
  border: "1px solid var(--ux-line)",
  boxShadow: "var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)",
} as const;

/**
 * Why this one fits her.
 *
 * The board drew a match percentage from a `match` field that live listings
 * never populate, so it was either absent or a number with no derivation. This
 * compares the skills the listing actually asks for against the ones she has
 * listed, and says the result in a sentence — because "92%" tells her nothing
 * she can act on and "you have 4 of the 5, the one missing is Analytics" tells
 * her whether to apply anyway.
 *
 * Always leads with what she HAS. Leading with the gap is how a woman who is
 * qualified talks herself out of applying.
 */
function MatchNote({ skills, compact = false }: { skills?: string[]; compact?: boolean }) {
  const tr = useT();
  const fit = matchFor(skills ?? []);
  if (!fit.because) return null;
  const tone = matchTone(fit.pct);
  return (
    <p className={`flex items-start gap-1.5 ${compact ? tr("opportunities.mtTextXs")
              : tr("opportunities.mtRoundedPxPxPyText")} leading-snug`}
       style={compact ? { color: "var(--ux-muted)" }
                      : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
      <Icons.Sparkles className="mt-[2px] h-[0.75rem] w-[0.75rem] shrink-0"
                      style={{ color: `var(${tone.ink})` }} />
      <span><b style={{ color: "var(--ux-ink)" }}>{tone.label}.</b> {fit.because}</span>
    </p>
  );
}

/* ══ A · LEDGER ═══════════════════════════════════════════════════════════ */

/**
 * All four views are memoised, and none of them needs a `useMemo` inside.
 *
 * Every one of them is a pure function of `d` and `act` — the filters, the
 * sorts and the `new Date()` per opening that `isOpen` and `dayRate` do are
 * all derived from `d` alone. Both props are held stable by the page, so the
 * two renders that every action costs (busy on, busy off) now stop here
 * instead of re-filtering the orders and re-parsing every deadline. Wrapping
 * the internals in `useMemo` as well would key on the same `d` and buy
 * nothing.
 */
export const Ledger = memo(function Ledger({ d, act }: { d: EarnData; act: Acts }) {
  const tr = useT();
  return (
    <>
      <div className="mb-6 grid overflow-hidden rounded-[20px]"
           style={{ border: "1px solid var(--ux-line)",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {([
          ["In your wallet", rupees(d.balanceMinor), "ready to take out", "--ux-green-ink"],
          ["Earned this month", rupees(d.earnedMinor), `from ${d.txns.filter((t) => t.kind === "credit").length} payments`, "--ux-ink"],
          ["Owed to you", rupees(d.owedMinor), `${d.orders.filter((o) => o.needs_her).length} orders waiting`, "--ux-amber-ink"],
          ["Open to you", rupees(d.openMinor), `${d.opps.length} openings`, "--ux-violet-ink"],
        ] as const).map(([lab, val, note, ink]) => (
          <div key={lab} className="p-[20px]"
               style={{ background: "var(--ux-surface)", borderInlineEnd: "1px solid var(--ux-line)" }}>
            <span className="text-2xs font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "var(--ux-faint)" }}>{lab}</span>
            <b className="mt-2 block text-2xlm font-extrabold tabular-nums tracking-[-0.035em]"
               style={{ color: `var(${ink})` }}>{val}</b>
            <em className="mt-0.5 block text-xs not-italic" style={{ color: "var(--ux-faint)" }}>{note}</em>
          </div>
        ))}
      </div>

      {d.orders.some((o) => o.needs_her) && (
        <>
          <Sec href="/app/documents">{tr("opportunities.waitingOnYou")}</Sec>
          <table className="ux-ledger text-xsm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ux-line)" }}>
                {["What", "Who", "Amount", "Do"].map((h, i) => (
                  <th key={h} className="pb-2.5 text-2xs font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: "var(--ux-faint)", padding: "0 12px 10px",
                               textAlign: i > 1 ? "end" : "start" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.orders.filter((o) => o.needs_her).map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--ux-line)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--ux-ink)" }}>
                    {o.title}
                    <div className="mt-0.5 text-xs font-normal" style={{ color: "var(--ux-faint)" }}>
                      Order · {o.state}
                    </div>
                  </td>
                  <td className="p-3" style={{ color: "var(--ux-ink-2)" }}>{o.buyer_name}</td>
                  <td className="p-3 text-end text-base font-extrabold tabular-nums"
                      style={{ color: "var(--ux-amber-ink)" }}>{o.total_label}</td>
                  <td className="p-3 text-end">
                    <Btn primary onClick={() => act.advance(o.id)}>{o.next_state ?? "Open"}</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Sec href="/app/opportunities">{tr("opportunities.workOpenToYou")}</Sec>
      <table className="ux-ledger text-xsm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ux-line)" }}>
            {["Role", "Pays", "A day", "Closes", "Do"].map((h, i) => (
              <th key={h} className="pb-2.5 text-2xs font-extrabold uppercase tracking-[0.12em]"
                  style={{ color: "var(--ux-faint)", padding: "0 12px 10px",
                           textAlign: i > 1 ? "end" : "start" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.opps.slice(0, 6).map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid var(--ux-line)" }}>
              <td className="p-3 font-bold" style={{ color: "var(--ux-ink)" }}>
                {o.title}
                <div className="mt-0.5 text-xs font-normal" style={{ color: "var(--ux-faint)" }}>
                  {o.org} · {o.kind} · {o.location}
                </div>
                <MatchNote skills={o.skills} compact />
              </td>
              <td className="p-3 tabular-nums" style={{ color: "var(--ux-ink-2)" }}>{o.pay}</td>
              <td className="p-3 text-end text-base font-extrabold tabular-nums"
                  style={{ color: "var(--ux-green-ink)" }}>{dayRate(o) ?? "—"}</td>
              <td className="p-3 text-end text-xs"
                  style={{ color: "var(--ux-amber-ink)" }}>{o.deadline_label}</td>
              <td className="p-3 text-end">
                <Btn primary={!o.applied && isOpen(o)} disabled={o.applied || !isOpen(o)}
                     onClick={() => act.apply(o.id)}>
                  {o.applied ? "Applied" : isOpen(o) ? "Apply" : "Closed"}
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {d.pools.length > 0 && (
        <>
          <Sec href="/app/group-buy">{tr("opportunities.buyingTogether")}</Sec>
          <table className="ux-ledger text-xsm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ux-line)" }}>
                {["Material", "Alone", "Together", "You save", "Do"].map((h, i) => (
                  <th key={h} className="pb-2.5 text-2xs font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: "var(--ux-faint)", padding: "0 12px 10px",
                               textAlign: i > 2 ? "end" : "start" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.pools.slice(0, 4).map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid var(--ux-line)" }}>
                  <td className="p-3 font-bold" style={{ color: "var(--ux-ink)" }}>
                    {g.item}
                    <div className="mt-0.5 text-xs font-normal" style={{ color: "var(--ux-faint)" }}>
                      {g.unit} · {g.still_needed} more women needed
                    </div>
                  </td>
                  <td className="p-3 tabular-nums" style={{ color: "var(--ux-ink-2)" }}>{rupees(g.alone_minor)}</td>
                  <td className="p-3 tabular-nums" style={{ color: "var(--ux-ink-2)" }}>{rupees(g.together_minor)}</td>
                  <td className="p-3 text-end text-base font-extrabold tabular-nums"
                      style={{ color: "var(--ux-green-ink)" }}>{rupees(g.saving_minor)}</td>
                  <td className="p-3 text-end">
                    <Btn primary={!g.joined_by_me} onClick={() => act.pool(g.id, !g.joined_by_me)}>
                      {g.joined_by_me ? "Joined" : "Join"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
});

/* ══ B · FEED ═════════════════════════════════════════════════════════════ */

export const Feed = memo(function Feed({ d, act }: { d: EarnData; act: Acts }) {
  const tr = useT();
  const top = d.opps[0];
  return (
    <div className="mx-auto w-full max-w-[640px]">
      {d.orders.filter((o) => o.needs_her).slice(0, 2).map((o) => (
        <article key={o.id} className="mb-3.5 rounded-[20px] p-[16px]" style={card}>
          <div className="mb-3 flex items-center gap-3">
            <Tile tone="amber">{o.buyer_name.charAt(0)}</Tile>
            <div className="min-w-0">
              <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                {o.buyer_name} ordered from you
              </b>
              <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{o.title}</span>
            </div>
            <time className="ms-auto shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{o.placed_on}</time>
          </div>
          <p className="my-2 text-2xl font-extrabold tabular-nums tracking-[-0.03em]"
             style={{ color: "var(--ux-amber-ink)" }}>{o.total_label}</p>
          <p className="m-0 text-sm" style={{ color: "var(--ux-ink-2)" }}>
            {o.quantity} · {o.state}. Accepting moves it into your orders.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Btn primary onClick={() => act.advance(o.id)}>{o.next_state ?? "Open the order"}</Btn>
            <LinkBtn href="/app/messages">Message {o.buyer_name.split(" ")[0]}</LinkBtn>
          </div>
        </article>
      ))}

      {top && (
        <article className="mb-3.5 rounded-[20px] p-[16px]" style={card}>
          <div className="mb-3 flex items-center gap-3">
            <Tile tone="violet"><Icons.Sparkles className="h-[19px] w-[19px]" /></Tile>
            <div className="min-w-0">
              <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("opportunities.workThatFitsYou")}</b>
              <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{top.org} · {top.kind}</span>
            </div>
            <time className="ms-auto shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{top.deadline_label}</time>
          </div>
          <p className="m-0 text-base font-bold" style={{ color: "var(--ux-ink)" }}>{top.title}</p>
          <MatchNote skills={top.skills} />
          <p className="my-2 text-2xl font-extrabold tabular-nums tracking-[-0.03em]"
             style={{ color: "var(--ux-green-ink)" }}>
            {top.pay}
            {dayRate(top) && (
              <span className="ms-2 text-xsm font-semibold" style={{ color: "var(--ux-faint)" }}>
                · {dayRate(top)}
              </span>
            )}
          </p>
          <p className="m-0 text-sm" style={{ color: "var(--ux-ink-2)" }}>{top.desc}</p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Btn primary={!top.applied && isOpen(top)} disabled={top.applied || !isOpen(top)}
                 onClick={() => act.apply(top.id)}>
              {top.applied ? "Applied" : isOpen(top) ? "Apply" : "Closed"}
              <Icons.ArrowRight className="h-4 w-4" />
            </Btn>
            <Btn onClick={() => act.save(top.id)}>{top.saved ? "Saved" : "Save"}</Btn>
          </div>
        </article>
      )}

      {d.pools.slice(0, 1).map((g) => (
        <article key={g.id} className="mb-3.5 rounded-[20px] p-[16px]" style={card}>
          <div className="mb-3 flex items-center gap-3">
            <Tile tone="green"><Icons.ShoppingCart className="h-[19px] w-[19px]" /></Tile>
            <div className="min-w-0">
              <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                {g.joined} women are buying {g.item.toLowerCase()} together
              </b>
              <span className="text-xs" style={{ color: "var(--ux-faint)" }}>
                {g.still_needed} more and the order goes in
              </span>
            </div>
          </div>
          <p className="my-2 text-2xl font-extrabold tabular-nums tracking-[-0.03em]"
             style={{ color: "var(--ux-green-ink)" }}>{rupees(g.saving_minor)} less</p>
          <p className="m-0 text-sm" style={{ color: "var(--ux-ink-2)" }}>
            {g.unit}. {rupees(g.alone_minor)} alone, {rupees(g.together_minor)} together.
          </p>
          <div className="mt-3.5">
            <Btn primary={!g.joined_by_me} onClick={() => act.pool(g.id, !g.joined_by_me)}>
              {g.joined_by_me ? "Joined" : "Join them"}
            </Btn>
          </div>
        </article>
      ))}

      {d.txns.filter((t) => t.kind === "credit").slice(0, 1).map((t) => (
        <article key={t.id} className="mb-3.5 rounded-[20px] p-[16px]" style={card}>
          <div className="mb-3 flex items-center gap-3">
            <Tile tone="green"><Icons.Wallet className="h-[19px] w-[19px]" /></Tile>
            <div className="min-w-0">
              <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                {t.amount_label} landed in your wallet
              </b>
              <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{t.label}</span>
            </div>
            <time className="ms-auto shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{t.when}</time>
          </div>
          <p className="m-0 text-sm" style={{ color: "var(--ux-ink-2)" }}>
            Your balance is {rupees(d.balanceMinor)}, all of it ready to take out.
          </p>
          <div className="mt-3.5"><LinkBtn href="/app/wallet" primary>{tr("opportunities.takeMoneyOut")}</LinkBtn></div>
        </article>
      ))}
    </div>
  );
});

/* ══ C · BOARD ════════════════════════════════════════════════════════════ */

export const Board = memo(function Board({ d, act }: { d: EarnData; act: Acts }) {
  const tr = useT();
  const needs = d.orders.filter((o) => o.needs_her);
  const moving = d.apps.filter((a) => a.status !== "closed");
  const paid = d.txns.filter((t) => t.kind === "credit");

  const lane = (tone: string, title: string, n: number, kids: React.ReactNode) => (
    <section className="rounded-[20px] p-[16px]"
             style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: `var(${tone})` }} />
        <b className="text-xsm font-extrabold" style={{ color: "var(--ux-ink)" }}>{title}</b>
        <span className="ms-auto rounded-full px-2.5 py-0.5 text-2xs font-extrabold"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                       color: "var(--ux-ink-2)" }}>{n}</span>
      </div>
      {kids}
    </section>
  );

  const tk = (key: string, title: string, meta: string, amt?: string, ink?: string, extra?: React.ReactNode) => (
    <article key={key} className="mb-2.5 rounded-[16px] p-3.5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <b className="block text-xsm font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>{title}</b>
      <p className="mt-1 text-xs" style={{ color: "var(--ux-faint)" }}>{meta}</p>
      {amt && (
        <p className="mt-2 text-lg font-extrabold tabular-nums" style={{ color: `var(${ink ?? "--ux-ink"})` }}>
          {amt}
        </p>
      )}
      {extra}
    </article>
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {lane("--ux-amber", "Needs you", needs.length,
        needs.length === 0
          ? <p className="text-xsm" style={{ color: "var(--ux-faint)" }}>{tr("opportunities.nothingIsWaitingOnYou")}</p>
          : needs.map((o) => tk(o.id, o.title, `${o.buyer_name} · ${o.state}`, o.total_label, "--ux-amber-ink",
              <div className="mt-2.5"><Btn primary onClick={() => act.advance(o.id)}>{o.next_state ?? "Open"}</Btn></div>)))}

      {lane("--ux-blue", "In progress", moving.length + d.pools.filter((g) => g.joined_by_me).length,
        <>
          {moving.slice(0, 3).map((a) => tk(a.id, a.opportunity_title, `${a.org} · ${a.status}`))}
          {d.pools.filter((g) => g.joined_by_me).slice(0, 2).map((g) =>
            tk(g.id, g.item, `Joined · ${g.still_needed} more needed`, `${rupees(g.saving_minor)} saved`, "--ux-green-ink"))}
        </>)}

      {lane("--ux-green", "Paid", paid.length,
        <>
          {paid.slice(0, 3).map((t) => tk(t.id, t.label, t.when, t.amount_label, "--ux-green-ink"))}
          {paid.length > 3 && (
            <article className="rounded-[16px] p-3.5 text-center"
                     style={{ border: "1px dashed var(--ux-line-strong)", color: "var(--ux-faint)" }}>
              <b className="text-xsm font-semibold">{paid.length - 3} more this month</b>
              <p className="mt-1 text-xs">
                {rupees(paid.slice(3).reduce((s, t) => s + t.amount_minor, 0))} altogether
              </p>
            </article>
          )}
        </>)}
    </div>
  );
});

/* ══ D · MAGAZINE ═════════════════════════════════════════════════════════ */

export const Magazine = memo(function Magazine({ d, act }: { d: EarnData; act: Acts }) {
  const tr = useT();
  const top = d.opps[0];
  const needs = d.orders.filter((o) => o.needs_her);
  return (
    <>
      {top && (
        <section className="relative mb-6 flex min-h-[330px] items-end overflow-hidden rounded-[24px]">
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(112deg, var(--ux-brand-900), var(--ux-fill) 42%, var(--ux-rib-3))" }} />
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(0deg, rgba(10,4,26,.92) 8%, rgba(10,4,26,.5) 48%, rgba(10,4,26,.18))" }} />
          <div className="relative max-w-[620px] p-8">
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-2xs font-extrabold uppercase tracking-[0.06em]"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
              <Icons.Sparkles className="h-[13px] w-[13px]" />{tr("opportunities.bestWorkForYouThisWeek")}</span>
            <h2 className="mt-3.5 text-[clamp(1.5625rem,3.6vw,2.375rem)] font-extrabold leading-[1.12] tracking-[-0.035em]"
                style={{ color: "var(--ux-on-brand)" }}>{top.title}</h2>
            <div className="mt-3.5 flex flex-wrap items-baseline gap-3">
              <b className="text-4xl font-extrabold tabular-nums tracking-[-0.04em]"
                 style={{ color: "var(--ux-rib-5)" }}>{top.pay}</b>
              {dayRate(top) && (
                <span className="text-xsm" style={{ color: "rgba(255,255,255,0.86)" }}>· {dayRate(top)}</span>
              )}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
              {top.desc}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button type="button" disabled={top.applied || !isOpen(top)} onClick={() => act.apply(top.id)}
                      className="ux-press inline-flex min-h-[46px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold disabled:opacity-70"
                      style={{ background: "var(--ux-on-brand)", color: "var(--ux-brand-900)" }}>
                {top.applied ? "Applied" : isOpen(top) ? "Apply" : "Closed"}
                <Icons.ArrowRight className="h-4 w-4" />
              </button>
              <Link href={`/app/opportunities/${top.id}`}
                    className="ux-press inline-flex min-h-[46px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
                    style={{ background: "rgba(255,255,255,0.16)", color: "var(--ux-on-brand)",
                             boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.34)" }}>{tr("opportunities.seeTheWholeThing")}</Link>
            </div>
          </div>
        </section>
      )}

      <Sec>{tr("opportunities.thisMonth")}</Sec>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        <article className="rounded-[20px] p-4" style={card}>
          <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            {rupees(d.earnedMinor)} earned
          </b>
          <p className="mt-1 text-xs" style={{ color: "var(--ux-faint)" }}>
            From {d.txns.filter((t) => t.kind === "credit").length} payments.
            {rupees(d.balanceMinor)} is ready to take out now.
          </p>
          <p className="mt-2.5 text-xl font-extrabold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
            {rupees(d.balanceMinor)}
          </p>
          <div className="mt-3"><LinkBtn href="/app/wallet" primary>{tr("opportunities.takeMoneyOut2")}</LinkBtn></div>
        </article>

        {needs.length > 0 && (
          <article className="rounded-[20px] p-4" style={card}>
            <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
              {needs.length === 1 ? "One order is waiting" : `${needs.length} orders are waiting`}
            </b>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-faint)" }}>
              {needs.map((o) => o.buyer_name.split(" ")[0]).join(" and ")}, both this week.
            </p>
            <p className="mt-2.5 text-xl font-extrabold tabular-nums" style={{ color: "var(--ux-amber-ink)" }}>
              {rupees(d.owedMinor)}
            </p>
            <div className="mt-3"><LinkBtn href="/app/documents">{tr("opportunities.openYourOrders")}</LinkBtn></div>
          </article>
        )}

        {d.pools.slice(0, 1).map((g) => (
          <article key={g.id} className="rounded-[20px] p-4" style={card}>
            <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
              {g.joined} women buying {g.item.toLowerCase()}
            </b>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-faint)" }}>
              {g.saving_label}. {g.still_needed} more and the order goes in.
            </p>
            <p className="mt-2.5 text-xl font-extrabold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
              {rupees(g.saving_minor)} saved
            </p>
            <div className="mt-3">
              <Btn primary={!g.joined_by_me} onClick={() => act.pool(g.id, !g.joined_by_me)}>
                {g.joined_by_me ? "Joined" : "Join them"}
              </Btn>
            </div>
          </article>
        ))}
      </div>
    </>
  );
});

export interface Acts {
  apply: (id: string) => void;
  save: (id: string) => void;
  pool: (id: string, join: boolean) => void;
  advance: (id: string) => void;
}

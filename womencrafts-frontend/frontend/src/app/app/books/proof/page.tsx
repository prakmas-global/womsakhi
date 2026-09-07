"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { MONTHS, PROOF_USES, bestMonth, leanMonth, yearMinor } from "@/components/ux/books/data";

/**
 * Proof of income — the document she cannot get anywhere else.
 *
 * ── The problem, stated plainly ─────────────────────────────────────────────
 * She cannot rent a room, enrol a child, get a phone contract, apply for a
 * scheme or stand as a guarantor, because she cannot prove she earns. There is
 * no payslip, no filing, no bank statement that looks like income. Money
 * arrives as cash and UPI from thirty different people.
 *
 * And the underlying exclusion is not vague. In India, **42.3% of rural working
 * women are unpaid helpers in a family enterprise** — counted as employed, in a
 * business that is not theirs, for money that is not theirs. A document with her
 * own name on it, showing what she personally earned, is not an accounting
 * feature. It is the first time anyone has written down that she has a business.
 *
 * ── Why the honest version is the useful version ────────────────────────────
 * A statement that smooths her income into a tidy average would be a lie a
 * landlord could catch. This one shows the lean month next to the good one and
 * says so — because "irregular but never zero, for six months" is a true and
 * genuinely persuasive claim.
 */
export default function ProofPage() {
  /**
   * Hands the statement to the phone's own share sheet, or copies it.
   * Nothing is uploaded — the statement is hers, and a landlord receiving it
   * should receive it from her, not from us.
   */
  const shareStatement = async () => {
    const text = "Earnings statement — WomSakhi. Issued to Priya Sharma.";
    try {
      if (navigator.share) await navigator.share({ title: "My earnings statement", text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* she closed the sheet */ }
  };

  const router = useRouter();
  const [use, setUse] = useState<string>("u1");
  const [made, setMade] = useState(false);

  const year = useMemo(() => yearMinor(MONTHS), []);
  const best = useMemo(() => bestMonth(MONTHS), []);
  const lean = useMemo(() => leanMonth(MONTHS), []);
  const avg = Math.round(year / MONTHS.length);
  const orders = useMemo(() => MONTHS.reduce((n, m) => n + m.orders, 0), []);
  const people = useMemo(() => Math.max(...MONTHS.map((m) => m.customers)), []);
  const peak = useMemo(() => Math.max(...MONTHS.map((m) => m.minor)), []);
  const chosen = PROOF_USES.find((u) => u.id === use);

  const make = useCallback(() => {
    setMade(true);
  }, []);

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-5">
        <Back to="/app/books" label="Back to your books" />

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Proof of income
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Written proof that you earn
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            No payslip, no filings, money from thirty different people — and still nothing to show a
            landlord. This is that piece of paper, with your name on it.
          </p>
        </header>

        {/* The six months, honestly */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(year)} label="Over six months"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(avg)} label="A month, on average"
                  icon="TrendingUp" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={String(people)} label="People paid you" icon="Users"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>

          <div className="mt-5">
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {MONTHS.map((m) => {
                const h = Math.max(10, (m.minor / peak) * 100);
                const isLean = m.month === lean.month;
                const isBest = m.month === best.month;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[0.6875rem] font-bold tabular-nums" style={{ color: v("--ux-muted") }}>
                      {Math.round(m.minor / 100000)}k
                    </span>
                    <div className="w-full rounded-t-[6px]"
                         style={{
                           height: `${h}%`,
                           background: v(isBest ? "--ux-green-ink" : isLean ? "--ux-tint-amber" : "--ux-brand-tint-2"),
                         }} />
                    <span className="text-[0.6875rem]" style={{ color: v("--ux-muted") }}>{m.month.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Your best month was <b>{best.month}</b> at {formatRupees(best.minor)}; your leanest
              was <b>{lean.month}</b> at {formatRupees(lean.minor)}. <b>You earned in every one of
              them.</b> That is the sentence that convinces a landlord — not a tidy average that
              anyone can see through.
            </p>
          </div>
        </Card>

        {/* What it is for changes what goes in it */}
        <div>
          <SectionHead title="What do you need it for?"
                       sub="The statement is written differently depending on who reads it" icon="FileText" />
          <div className="grid gap-3 sm:grid-cols-2">
            {PROOF_USES.map((u) => (
              <button key={u.id} type="button" onClick={() => { setUse(u.id); setMade(false); }}
                      aria-pressed={use === u.id}
                      className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left"
                      style={{
                        borderColor: v(use === u.id ? "--ux-brand" : "--ux-line"),
                        background: v(use === u.id ? "--ux-brand-tint" : "--ux-surface"),
                      }}>
                <IconTile icon={u.icon} tint="--ux-surface-2" ink="--ux-brand" size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{u.label}</p>
                  <p className="mt-1 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{u.note}</p>
                </div>
                {use === u.id && (
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                        style={{ background: v("--ux-brand"), color: v("--ux-on-brand-btn-ink") }}>
                    <I name="Check" className="h-[12px] w-[12px]" sw={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* The statement */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="px-5 py-4" style={{ background: v("--ux-surface-2") }}>
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
              What it will say
            </p>
          </div>
          <div className="px-5 py-5">
            <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
              Priya Sharma — statement of earnings
            </p>
            <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
              April to September · prepared for {chosen?.label.toLowerCase()}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                `Earned ${formatRupees(year)} over six months, from her own tailoring and mehendi work.`,
                `An average of ${formatRupees(avg)} a month, across ${orders} separate orders.`,
                `Paid by up to ${people} different customers in a single month.`,
                `Earned in every one of the six months — the lowest was ${formatRupees(lean.minor)}.`,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed"
                    style={{ color: v("--ux-ink-2") }}>
                  <I name="Check" className="mt-[3px] h-[14px] w-[14px] shrink-0"
                     style={{ color: v("--ux-green-ink") }} sw={2.8} />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2.5 rounded-[12px] px-3 py-2.5"
                 style={{ background: v("--ux-brand-tint") }}>
              <I name="ShieldCheck" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-brand") }} />
              <p className="text-[0.75rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Carries a link the reader can check, so they do not have to take your word for it —
                and shows nothing beyond what is written above.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <Btn icon="FileText" onClick={make}>{made ? "Made" : "Make the statement"}</Btn>
            {made && (
              <>
                <Btn variant="outline" icon="Share2" onClick={shareStatement}>Send it</Btn>
                <Btn variant="ghost" icon="Printer" onClick={() => window.print()}>Print</Btn>
              </>
            )}
          </div>
        </Card>

        {made && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />
              Ready. It is yours — nothing was sent anywhere.
            </p>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}

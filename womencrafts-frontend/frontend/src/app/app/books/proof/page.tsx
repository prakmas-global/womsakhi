"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { PROOF_USES as RAW_PROOF_USES } from "@/components/ux/books/data";
import { useResource } from "@/lib/use-resource";
import { apiProof, type Proof, type ProofMonth } from "@/lib/books-api";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

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
/** Nothing until the server answers. A statement must never show a guess. */
const EMPTY_PROOF: Proof = {
  months: [], total_minor: 0, months_counted: 0, months_with_earnings: 0, average_minor: 0,
};

export default function ProofPage() {
  const PROOF_USES = useTranslated(RAW_PROOF_USES);
  const tr = useT();

  /*
    Her real months, counted from her own paid entries.

    `MONTHS` was six invented rows — April to September, ₹13,400 to ₹23,800 —
    identical for every woman in the product. This screen's whole purpose is a
    document she hands a landlord, a school or a loan officer; a fabricated one
    is not a weaker version of that, it is the opposite of it.

    Only `paid` rows count, and every month in the window is included even when
    it is zero. See `/me/books/proof`.
  */
  const { data: proof } = useResource(
    useCallback(async (sig: AbortSignal) => apiProof(6, sig), []),
    EMPTY_PROOF,
  );
  const MONTHS = proof.months;
  const { user } = useAuth();
  /**
   * Hands the statement to the phone's own share sheet, or copies it.
   * Nothing is uploaded — the statement is hers, and a landlord receiving it
   * should receive it from her, not from us.
   */
  const shareStatement = async () => {
    // Her name, from her account. This read "Issued to Priya Sharma" for
    // every woman — on the one document in this product whose entire value is
    // that it is about HER, handed to somebody deciding whether to trust her.
    const text = tr("booksProof.statementText", {
      name: (user?.full_name || "").trim(),
      total: formatRupees(proof.total_minor),
      months: proof.months_counted,
    });
    try {
      if (navigator.share) await navigator.share({ title: tr("booksProof.myEarningsStatement"), text });
      else await navigator.clipboard?.writeText(text);
    } catch { /* she closed the sheet */ }
  };

  const router = useRouter();
  const [use, setUse] = useState<string>("u1");
  const [made, setMade] = useState(false);

  const year = proof.total_minor;
  /*
    A zero row, not `undefined`, when she has no months yet.

    `MONTHS` is empty on the first render — before the server answers, and for
    a woman who has written nothing down. Reducing an empty array returns
    undefined, and `best.month` three hundred lines below then throws into the
    error boundary, which is why this screen said "We could not load your
    earnings statement" when nothing had failed at all.
  */
  const ZERO_MONTH: ProofMonth = { month: "—", minor: 0, orders: 0, customers: 0 };
  const best = useMemo(
    () => MONTHS.reduce((a, b) => (b.minor > a.minor ? b : a), MONTHS[0] ?? ZERO_MONTH),
    [MONTHS],
  );
  const lean = useMemo(
    () => MONTHS.reduce((a, b) => (b.minor < a.minor ? b : a), MONTHS[0] ?? ZERO_MONTH),
    [MONTHS],
  );
  const avg = proof.average_minor;
  const orders = useMemo(() => MONTHS.reduce((n, m) => n + m.orders, 0), [MONTHS]);
  /*
    Both of these read `Math.max(...[])` on the first render, which is
    `-Infinity`, and both had an EMPTY dependency array — so the value computed
    before the server answered was the value kept forever. The screen showed
    "People paid you: -Infinity", and told a landlord she had been "paid by up
    to -Infinity different customers in a single month".

    `peak` was worse than it looked: dividing by -Infinity made every bar in
    the chart -0% tall, so the whole six-month graph flatlined at the 10%
    floor whatever she had earned.
  */
  const people = useMemo(
    () => MONTHS.reduce((n, m) => Math.max(n, m.customers), 0),
    [MONTHS],
  );
  const peak = useMemo(
    () => MONTHS.reduce((n, m) => Math.max(n, m.minor), 0),
    [MONTHS],
  );
  /*
    Whether the "earned in every month" claim is actually true. The screen
    asserted it unconditionally — on a statement whose only job is to be
    believed by somebody deciding whether to rent her a room. A woman with a
    lean month handing over a document that overstates her is worse off than
    one handing over nothing.
  */
  const everyMonth = MONTHS.length > 0 && proof.months_with_earnings === MONTHS.length;
  const span = MONTHS.length > 0 ? `${MONTHS[0].month} to ${MONTHS[MONTHS.length - 1].month}` : "";
  const hasAny = proof.total_minor > 0;
  const chosen = PROOF_USES.find((u) => u.id === use);

  const make = useCallback(() => {
    setMade(true);
  }, []);

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/books" label={tr("booksProof.backToYourBooks")} />

        <header>
          <p className={EYEBROW}>{tr("booksProof.proofOfIncome")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("booksProof.writtenProofThatYouEarn")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            No payslip, no filings, money from thirty different people — and still nothing to show a
            landlord. This is that piece of paper, with your name on it.
          </p>
        </header>

        {/* The six months, honestly */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(year)} label={tr("booksProof.overSixMonths")}
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(avg)} label={tr("booksProof.aMonthOnAverage")}
                  icon="TrendingUp" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={String(people)} label={tr("booksProof.peoplePaidYou")} icon="Users"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>

          <div className="mt-5">
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {MONTHS.map((m) => {
                // `peak` is 0 for a woman who has written nothing down, and
                // 0/0 is NaN — `Math.max(10, NaN)` is NaN, so every bar got
                // `height: NaN%` and the chart drew nothing at all.
                const h = peak > 0 ? Math.max(10, (m.minor / peak) * 100) : 10;
                const isLean = m.month === lean.month;
                const isBest = m.month === best.month;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-2xs font-bold tabular-nums" style={{ color: v("--ux-muted") }}>
                      {Math.round(m.minor / 100000)}k
                    </span>
                    <div className="w-full rounded-t-[6px]"
                         style={{
                           height: `${h}%`,
                           background: v(isBest ? "--ux-green-ink" : isLean ? "--ux-tint-amber" : "--ux-brand-tint-2"),
                         }} />
                    <span className="text-2xs" style={{ color: v("--ux-muted") }}>{m.month.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
            {hasAny ? (
              <p className="mt-3 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{tr("booksProof.yourBestMonthWas")}<b>{best.month}</b> at {formatRupees(best.minor)}; your leanest
                was <b>{lean.month}</b> at {formatRupees(lean.minor)}.{" "}
                {everyMonth && <><b>You earned in every one of them.</b>{" "}</>}
                That is the sentence that convinces a landlord — not a tidy average that
                anyone can see through.
              </p>
            ) : (
              <p className="mt-3 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Nothing is written down yet, so there is nothing to prove. Every sale you enter in
                your books — the WhatsApp ones and the cash ones too — becomes a line on this
                statement.
              </p>
            )}
          </div>
        </Card>

        {/* What it is for changes what goes in it */}
        <div>
          <Section title={tr("booksProof.whatDoYouNeedItFor")}
                   sub={tr("booksProof.theStatementIsWrittenDifferentlyDe")} icon="FileText" />
          <div className={`grid gap-3 sm:grid-cols-2 ${GROUP}`}>
            {PROOF_USES.map((u) => (
              <button key={u.id} type="button" onClick={() => { setUse(u.id); setMade(false); }}
                      aria-pressed={use === u.id}
                      className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-[color:var(--ux-line)]! max-lg:first:border-t-0"
                      style={{
                        borderColor: v(use === u.id ? "--ux-brand" : "--ux-line"),
                        background: v(use === u.id ? "--ux-brand-tint" : "--ux-surface"),
                      }}>
                <IconTile icon={u.icon} tint="--ux-surface-2" ink="--ux-brand" size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{u.label}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{u.note}</p>
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
          <div className="px-4 py-4 lg:px-5" style={{ background: v("--ux-surface-2") }}>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:text-2xs lg:font-extrabold lg:tracking-[0.14em]" style={{ color: v("--ux-muted") }}>{tr("booksProof.whatItWillSay")}</p>
          </div>
          <div className="p-4 lg:px-5 lg:py-5">
            {/*
              Her name, her months, her trade. Every one of these four lines
              used to be a constant: the heading said "Priya Sharma" to every
              woman who opened it, the dates said "April to September" whatever
              month it was, and the work was always "tailoring and mehendi".

              On any other screen that is a cosmetic bug. On this one it is the
              whole document — a landlord reads it precisely because it is
              supposed to be about the woman standing in front of him.
            */}
            <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>
              {(user?.full_name || "").trim() || "Your name"} — statement of earnings
            </p>
            <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>
              {span && <>{span} · </>}prepared for {chosen?.label.toLowerCase()}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                `Earned ${formatRupees(year)} over ${proof.months_counted} months, from her own work.`,
                `An average of ${formatRupees(avg)} a month, across ${orders} separate ${orders === 1 ? "order" : "orders"}.`,
                people > 0 && `Paid by up to ${people} different ${people === 1 ? "customer" : "customers"} in a single month.`,
                // Only claimed when it is true. See `everyMonth` above.
                everyMonth
                  ? `Earned in every one of the ${proof.months_counted} months — the lowest was ${formatRupees(lean.minor)}.`
                  : proof.months_with_earnings > 0 &&
                    `Earned in ${proof.months_with_earnings} of the ${proof.months_counted} months.`,
              ].filter((x): x is string => Boolean(x)).map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-xsm leading-relaxed"
                    style={{ color: v("--ux-ink-2") }}>
                  <I name="Check" className="mt-[3px] h-[14px] w-[14px] shrink-0"
                     style={{ color: v("--ux-green-ink") }} sw={2.8} />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2.5 rounded-[12px] px-4 py-3 lg:px-3 lg:py-2.5"
                 style={{ background: v("--ux-brand-tint") }}>
              <I name="ShieldCheck" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-brand") }} />
              <p className="text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Carries a link the reader can check, so they do not have to take your word for it —
                and shows nothing beyond what is written above.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-4 lg:px-5 lg:pb-5">
            <Btn icon="FileText" onClick={make} disabled={!hasAny} className="ux-action-primary">{made ? "Made" : "Make the statement"}</Btn>
            {!hasAny && (
              <Btn variant="outline" icon="Plus" href="/app/books" className="max-lg:w-full">
                Add what you have sold
              </Btn>
            )}
            {made && (
              <>
                <Btn variant="outline" icon="Share2" onClick={shareStatement} className="max-lg:w-full">{tr("booksProof.sendIt")}</Btn>
                <Btn variant="ghost" icon="Printer" onClick={() => window.print()} className="max-lg:w-full">Print</Btn>
              </>
            )}
          </div>
        </Card>

        {made && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{tr("booksProof.readyItIsYoursNothingWas")}</p>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}

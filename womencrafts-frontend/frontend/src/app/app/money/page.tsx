"use client";

import { useMemo } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, formatRupees, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import {
  COMMITMENTS, INCOMING, IN_HAND, WEIGHT_LABEL, budgetTotals,
} from "@/components/ux/money/budget";
import { useT } from "@/i18n";

/**
 * Is there enough for the things that cannot wait?
 *
 * ── Why this screen is one question, not a budget ───────────────────────────
 * §64 asks for a budget and says not to make it look like a banking app. Those
 * two things fight each other unless you drop the budgeting frame entirely: a
 * budget assumes a predictable month with a salary in and categories out, and
 * for a woman whose income arrives in uneven pieces from different people, the
 * variance report is noise.
 *
 * So the whole screen answers one question, in the heading, in words, before
 * any number: **is there enough for the things that cannot wait.** Everything
 * below only explains that answer.
 *
 * ── Ranked by consequence, never by amount ──────────────────────────────────
 * A ₹1,800 school fee that loses a term test sits above ₹3,500 of rent that can
 * be a week late. Sorting by size would put the rent first and teach her the
 * wrong thing about which one to worry about.
 *
 * ── Nothing turns red, and nothing is scored ────────────────────────────────
 * There is no "you overspent". A woman who had to spend it did not overspend.
 * The only warning on this screen is about money that has not been agreed yet
 * being counted as money — which is the mistake that actually costs her.
 */
export default function MoneyPage() {
  const tr = useT();
  const t = useMemo(() => budgetTotals(), []);
  const ordered = useMemo(() => {
    const rank = { "cannot-wait": 0, "should-pay": 1, "can-move": 2 } as const;
    return [...COMMITMENTS].sort((a, b) => rank[a.weight] - rank[b.weight]);
  }, []);

  return (
    <HomeShell active="/app/money">
      <div className="flex flex-col gap-6 lg:gap-5" id="money-page">

        <header>
          <p className={EYEBROW}>{tr("money.yourMoney")}</p>
          {/* The answer, in words, before any number. */}
          <h1 className="ux-screen-title mt-2 max-w-[20ch] text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            {t.coversMust
              ? tr("money.youHaveEnoughForTheThings")
              : tr("money.twoThingsCannotWaitAndYou")}
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            {t.coversMust
              ? tr("money.everythingBelowIsOnlyTheWorking")
              : tr("money.theTwoBelowCostYouMost")}
          </p>
          <div className="mt-3"><ReadAloud targetId="money-page" /></div>
        </header>

        {/* The three numbers that matter, and nothing else. */}
        <div className={`grid gap-3 sm:grid-cols-3 ${GROUP}`}>
          {[
            { n: formatRupees(IN_HAND), l: "in your hand now", i: "Wallet",
              tint: "--ux-tint-green", ink: "--ux-green-ink" },
            { n: formatRupees(t.sure), l: "agreed and coming", i: "ArrowDownLeft",
              tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
            { n: formatRupees(t.committed), l: "already promised", i: "ArrowUpRight",
              tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
          ].map((x) => (
            <Card key={x.l} pad={16} className={GROUP_ROW}>
              <div className="flex items-center gap-3.5">
                <IconTile icon={x.i} tint={x.tint} ink={x.ink} size={42} />
                <div className="min-w-0">
                  <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                    {x.n}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{x.l}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* What is left, said plainly rather than as a balance. */}
        <Card pad={18} style={{ background: v(t.spare >= 0 ? "--ux-tint-green" : "--ux-tint-amber"),
                                borderColor: "transparent" }}>
          <p className="text-smd font-bold" style={{ color: v("--ux-ink") }}>
            {t.spare >= 0
              ? `${formatRupees(t.spare)} is yours to do what you like with`
              : `You are ${formatRupees(Math.abs(t.spare))} short of everything you have promised`}
          </p>
          <p className="mt-1 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {t.spare >= 0
              ? tr("money.afterEverythingBelowIsPaidSpend")
              : tr("money.theThingsThatCannotWaitAre")}
          </p>
        </Card>

        {/* Commitments, by consequence. */}
        <div>
          <Section title={tr("money.whatYouHavePromised")}
                       sub={tr("money.hardestToMissFirstNotBiggest")} icon="ListChecks" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {ordered.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-start gap-3.5 px-4 py-4 lg:px-5"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}`,
                            opacity: c.weight === "can-move" ? 0.72 : 1 }}>
                <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-smd font-bold" style={{ color: v("--ux-ink") }}>{c.what}</p>
                    <Pill tone={c.weight === "cannot-wait" ? "orange" : "neutral"} size="sm">
                      {WEIGHT_LABEL[c.weight]}
                    </Pill>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{c.when}</p>
                  {/* The consequence, which is the reason it is ordered here. */}
                  {c.ifMissed && (
                    <p className="mt-1.5 text-xs leading-snug"
                       style={{ color: v(c.weight === "cannot-wait" ? "--ux-amber-ink" : "--ux-muted") }}>
                      If you miss it: {c.ifMissed}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                  {formatRupees(c.minor)}
                </p>
              </div>
            ))}
          </Card>
        </div>

        {/* Incoming — agreed and not agreed, kept apart on purpose. */}
        <div>
          <Section title={tr("money.whatIsComingToYou")}
                       sub={tr("money.onlyTheAgreedMoneyIsCounted")} icon="ArrowDownLeft" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {INCOMING.map((inc, i) => (
              <div key={inc.id} className="flex flex-wrap items-center gap-3.5 px-4 py-4 lg:px-5"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <I name={inc.certain ? "CheckCircle2" : "HelpCircle"} className="h-[1.0625rem] w-[1.0625rem] shrink-0"
                   style={{ color: v(inc.certain ? "--ux-green-ink" : "--ux-muted") }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold"
                     style={{ color: v(inc.certain ? "--ux-ink" : "--ux-muted") }}>{inc.from}</p>
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>{inc.when}</p>
                </div>
                <p className="shrink-0 text-smd font-bold tabular-nums"
                   style={{ color: v(inc.certain ? "--ux-ink" : "--ux-faint") }}>
                  {formatRupees(inc.minor)}
                </p>
              </div>
            ))}
          </Card>
          {t.maybe > 0 && (
            <p className="mt-2.5 flex items-start gap-2 rounded-[12px] px-4 py-3 text-xsm leading-relaxed lg:px-3.5"
               style={{ background: v("--ux-tint-amber"), color: v("--ux-ink-2") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[0.9375rem] w-[0.9375rem] shrink-0"
                 style={{ color: v("--ux-amber-ink") }} />
              <span>
                {formatRupees(t.maybe)} of that is not agreed yet, so it is not counted above.
                Counting a maybe is how a woman promises a fee she cannot cover.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn href="/app/collect" icon="QrCode" className="ux-action-primary">{tr("money.askSomeoneToPayYou")}</Btn>
          <Btn variant="outline" href="/app/vault" icon="Lock" className="max-lg:w-full">{tr("money.putSomeAside")}</Btn>
          <Btn variant="ghost" href="/app/books" icon="BookOpen" className="max-lg:w-full">{tr("money.whoOwesYou")}</Btn>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing here is a score and nothing goes red. If you had to spend it, you had to spend
              it — this screen is only here so the things that cost you most if they are missed are
              the ones you see first.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

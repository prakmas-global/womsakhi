"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { BUYER_CHECKS, SCAMS, riskCount, type ScamPattern } from "@/components/ux/reach/data";

/**
 * Money traps — the lesson turned into a guardrail.
 *
 * ── Why /app/digital was not enough ─────────────────────────────────────────
 * Digital literacy teaches spotting a scam message as a lesson. A lesson is
 * read once, months before any money moves, and by someone who is not at that
 * moment being told she has won a contract. She is now taking payments and
 * shipping goods, so the teaching has to exist at the point of risk.
 *
 * ── Led by their words, not by a category name ──────────────────────────────
 * "Advance fee fraud" means nothing. *"Registration and material kit, ₹500"* is
 * recognisable, because it is the sentence she will actually be sent. So every
 * pattern opens with the message in quotation marks, in the register the scam
 * is written in, and only then explains it.
 *
 * ── The single sentence that prevents most of it ────────────────────────────
 * **A PIN is only ever for sending money.** Anyone asking her to approve a
 * request or enter a PIN in order to *receive* money is taking it. This is the
 * most misunderstood mechanic in UPI and it is set as the hero of the screen
 * rather than filed as item four in a list.
 *
 * Every pattern here targets home-based women workers specifically — the
 * work-from-home kit fee, the overpayment reversal, the courier-it-first bulk
 * order, the expiring-KYC link.
 */
export default function SafeMoneyPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [checks] = useState(BUYER_CHECKS);
  const risks = useMemo(() => riskCount(checks), [checks]);
  const [reported, setReported] = useState(false);

  const flip = useCallback((id: string) => setOpen((o) => (o === id ? null : id)), []);

  return (
    <HomeShell active="/app/safe-money">
      <div className="flex flex-col gap-5" id="safe-money-page">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Money traps
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            The tricks aimed at women working from home
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            These are not general internet scams. Each one below is written for a woman who sews,
            cooks or does mehendi at home, and each is the exact message you will be sent.
          </p>
          <div className="mt-3"><ReadAloud targetId="safe-money-page" label="Read these to me" /></div>
        </header>

        {/* The one rule, given the whole width it deserves. */}
        <div className="rounded-[var(--ux-r-card)] px-6 py-7 sm:px-9"
             style={{ background: v("--ux-fill") }}>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.18em]"
             style={{ color: v("--ux-on-brand"), opacity: 0.75 }}>
            If you remember one thing
          </p>
          <p className="mt-2.5 max-w-[22ch] text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
             style={{ color: v("--ux-on-brand") }}>
            A PIN is only ever for sending money.
          </p>
          <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed"
             style={{ color: v("--ux-on-brand"), opacity: 0.9 }}>
            Money coming to you needs nothing from you — no PIN, no approval, no code. If a screen
            asks for your PIN, you are paying someone, whatever they told you. That one sentence
            stops most of what is below.
          </p>
        </div>

        {/* Their words first. */}
        <div>
          <SectionHead title="What they will say to you"
                       sub="Tap one to see what is really happening" icon="MessageSquareWarning"
                       chip={String(SCAMS.length)} />
          <div className="flex flex-col gap-3">
            {SCAMS.map((s) => <Trap key={s.id} s={s} open={open === s.id} onFlip={() => flip(s.id)} />)}
          </div>
        </div>

        {/* Point-of-risk check on a live buyer */}
        <div>
          <SectionHead title="Before you send anything to a buyer"
                       sub="Kavita R. — 50 pieces, wants them couriered today" icon="UserSearch" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4"
                 style={{ background: v(risks >= 2 ? "--ux-danger-tint" : "--ux-tint-green") }}>
              <I name={risks >= 2 ? "AlertTriangle" : "ShieldCheck"} className="h-[19px] w-[19px] shrink-0"
                 style={{ color: v(risks >= 2 ? "--ux-danger-solid" : "--ux-green-ink") }} />
              <p className="min-w-0 flex-1 text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>
                {risks >= 2
                  ? `${risks} things here look wrong. Ask for the material cost before you make anything.`
                  : "Nothing here looks wrong."}
              </p>
            </div>
            {checks.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3.5 px-5 py-3.5"
                   style={{ borderTop: `1px solid ${v("--ux-line")}` }}>
                <I name={c.ok ? "Check" : "AlertCircle"} className="h-[16px] w-[16px] shrink-0"
                   style={{ color: v(c.ok ? "--ux-green-ink" : "--ux-danger-solid") }} sw={2.4} />
                <p className="min-w-0 flex-1 text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink") }}>
                  {c.what}
                </p>
                <p className="shrink-0 text-[0.75rem]" style={{ color: v("--ux-muted") }}>{c.note}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t px-5 py-4" style={{ borderColor: v("--ux-line") }}>
              <Btn size="sm" icon="HandCoins" href="/app/collect">Ask for the cloth money first</Btn>
              <Btn size="sm" variant="outline" icon="Flag" disabled={reported}
                   onClick={() => setReported(true)}>
                {reported ? "Reported" : "Report this buyer"}
              </Btn>
            </div>
          </Card>
        </div>

        {reported && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />
              Recorded. The next woman this buyer contacts will see it, and your name is not shown.
            </p>
          </Card>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Users" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              If something feels wrong, ask your circle before you act — not after. Nobody there will
              think less of you for asking, and every woman who has been cheated says the same thing
              afterwards: she knew, and she was in a hurry.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/** Their sentence, then the truth underneath it. */
function Trap({ s, open, onFlip }: { s: ScamPattern; open: boolean; onFlip: () => void }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: open ? v("--ux-danger-solid") : undefined }}>
      <button type="button" onClick={onFlip} aria-expanded={open} className="ux-press w-full p-5 text-left">
        <div className="flex items-start gap-3.5">
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            <I name={s.icon} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-semibold italic leading-relaxed" style={{ color: v("--ux-ink") }}>
              {s.theyWillSay}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="orange" size="sm">{s.name}</Pill>
              {!open && (
                <span className="text-[0.75rem] font-semibold" style={{ color: v("--ux-brand") }}>
                  What is really happening?
                </span>
              )}
            </div>
          </div>
          <I name={open ? "ChevronUp" : "ChevronDown"} className="mt-1 h-[16px] w-[16px] shrink-0"
             style={{ color: v("--ux-faint") }} />
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4" style={{ borderColor: v("--ux-line") }}>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {s.whatIsHappening}
          </p>
          <p className="mt-3 flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-[0.8125rem] font-semibold leading-relaxed"
             style={{ background: v("--ux-tint-green"), color: v("--ux-ink") }}>
            <I name="ShieldCheck" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            {s.whatToDo}
          </p>
        </div>
      )}
    </Card>
  );
}

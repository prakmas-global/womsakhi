"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Tag } from "@/components/ux/work/native";
import { Btn, Card, Chip, I, IconTile, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { EMPLOYERS, WORK_CLAIMS, owedFromWork, type Employer } from "@/components/ux/eight/data";
import { useT } from "@/i18n";

/**
 * Was she actually paid?
 *
 * ── Not a job board. Discovery is thoroughly owned; trust is not ────────────
 * Apna claims 55M+ registered users, Awign 1.5M workers. Competing on listings
 * is competing with a solved problem. What none of them fix is that a woman
 * cannot tell a real listing from a fraud, has no proof she was paid, and no
 * record she can carry when she leaves. Urban Company's own history — commission
 * protests, forced product purchases, a monthly job minimum, auto-assign that
 * removed the ability to decline a job for a family emergency, ID blocking, and
 * an injunction against its own protesting workers — is the illustration.
 *
 * ── The bad employer is drawn loudly, on purpose ────────────────────────────
 * A warning that looks like every other row is not a warning. The employer four
 * women say never paid them gets a red-barred panel, a wide gap around it and a
 * plain-language instruction — *ask for money up front, or walk away.* Every
 * other employer is a quiet ledger row. Loudness here is calibrated to
 * consequence: this is a woman's month of work.
 */
export default function VerifiedPage() {
  const tr = useT();
  const [filter, setFilter] = useState<"all" | "safe" | "risky">("all");
  const [reported, setReported] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const owed = useMemo(() => owedFromWork(WORK_CLAIMS), []);
  const risky = useMemo(() => EMPLOYERS.filter((e) => e.neverPaid > 0), []);
  const clean = useMemo(() => EMPLOYERS.filter((e) => e.neverPaid === 0), []);
  const shown = filter === "safe" ? clean : filter === "risky" ? risky : EMPLOYERS;

  const report = useCallback((id: string, name: string) => {
    setReported((r) => [...r, id]);
    setNote(`Recorded. The next woman offered work by ${name} will see it — your name is not shown.`);
  }, []);

  return (
    <HomeShell active="/app/verified">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("verified.beforeYouTakeTheWork")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("verified.didTheyActuallyPayHer")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed" style={{ color: v("--ux-muted") }}>
            Every line below was written by a woman who did the work — not by the company, and not
            by us. There are plenty of places to find work. There is nowhere to find out whether
            the money came.
          </p>
        </header>

        {/* The loud one, above everything, in its own space. */}
        {risky.map((e) => (
          <div key={e.id} className="rounded-[var(--ux-r-card)] pl-[8px]"
               style={{ background: v("--ux-danger-solid") }}>
            <div className="rounded-[calc(var(--ux-r-card)-1px)] p-5 sm:p-6"
                 style={{ background: v("--ux-danger-tint") }}>
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
                      style={{ background: v("--ux-danger-solid"), color: v("--ux-on-brand") }}>
                  <I name="AlertTriangle" className="h-[24px] w-[24px]" sw={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] lg:text-2xs" style={{ color: v("--ux-ink") }}>{tr("verified.womenAreWarningEachOtherAbout")}</p>
                  <p className="mt-1.5 text-[clamp(1.1875rem,2.4vw,1.5rem)] font-extrabold leading-tight tracking-[-0.025em]"
                     style={{ color: v("--ux-ink") }}>
                    {e.name}
                  </p>
                  <p className="mt-2 max-w-[52ch] text-sm font-semibold leading-relaxed" style={{ color: v("--ux-ink") }}>
                    {e.flag}
                  </p>

                  {/* the count, drawn as bodies not a bar */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: e.workedBy }).map((_, i) => (
                        <I key={i} name="User" className="h-[17px] w-[17px]"
                           sw={2.4}
                           style={{ color: v(i < e.neverPaid ? "--ux-danger-solid" : "--ux-line-strong") }} />
                      ))}
                    </div>
                    <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                      {e.neverPaid} of {e.workedBy} were never paid at all
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
                    {e.paidLate} more were paid late · last report {e.lastReport}
                  </p>

                  {/* Full width and stacked on a phone: "This happened to me
                      too" is the whole point of this card and it should not be
                      a 140px pill in a wrapped row. */}
                  <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
                    <Btn className="ux-action-primary" variant="outline" icon="Flag" disabled={reported.includes(e.id)}
                         onClick={() => report(e.id, e.name)}>
                      {reported.includes(e.id) ? tr("verified.youHaveReportedThis")
              : tr("verified.thisHappenedToMeToo")}
                    </Btn>
                    <Btn className="ux-action-primary" variant="ghost" icon="MessageCircle" href="/app/messages">{tr("verified.talkToAWomanWhoWorked")}</Btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Her own money, waiting */}
        <div>
          <SectionHead title={tr("verified.workYouHaveDone")}
                       sub={owed > 0 ? `${formatRupees(owed)} of it has not reached you` : "All paid"}
                       icon="Receipt" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {WORK_CLAIMS.map((w, i) => {
              const tone = w.state === "paid" ? "green" : "orange";
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-4 px-5 py-4"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="h-[34px] w-[3px] shrink-0 rounded-full"
                        style={{ background: v(w.state === "paid" ? "--ux-green-ink" : w.state === "disputed" ? "--ux-danger-solid" : "--ux-amber-ink") }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{w.what}</p>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {w.employer} · {w.dueOn}
                      {w.daysLate ? ` · ${w.daysLate} days late` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                      {formatRupees(w.dueMinor)}
                    </p>
                    <Tag tone={tone as "green" | "orange"} size="sm">
                      {w.state === "paid" ? "Paid" : w.state === "disputed" ? "They are refusing" : "Late"}
                    </Tag>
                  </div>
                  {w.state !== "paid" && (
                    <Btn size="sm" variant="outline" href="/app/haq">{tr("verified.chaseIt")}</Btn>
                  )}
                </div>
              );
            })}
          </Card>
        </div>

        {/* The quiet ledger */}
        <div>
          <SectionHead title={tr("verified.whoElseHasHiredWomenHere")} icon="Building2" chip={String(shown.length)} />
          <div className="ux-chiprow mb-3.5 flex flex-wrap gap-2" style={{ ["--ux-pad" as string]: "20px" }}>
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everyone</Chip>
            <Chip icon="Check" selected={filter === "safe"} onClick={() => setFilter("safe")}>{tr("verified.alwaysPaid")}</Chip>
            <Chip icon="AlertTriangle" selected={filter === "risky"} onClick={() => setFilter("risky")}>{tr("verified.beCareful")}</Chip>
          </div>
          <div className="flex flex-col gap-2.5">
            {shown.map((e) => <Row key={e.id} e={e} />)}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nobody can pay to look good here. A company cannot remove a report, and we do not sell
              a badge. When you say you were not paid, your name is never shown to them — only the
              count changes.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/** A quiet ledger row — deliberately unlike the warning panel above it. */
function Row({ e }: { e: Employer }) {
  const tr = useT();
  const bad = e.neverPaid > 0;
  const pct = Math.round((e.paidOnTime / e.workedBy) * 100);
  return (
    <Card pad={16} style={bad ? { borderColor: v("--ux-danger-solid") } : undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <IconTile icon={bad ? "AlertTriangle" : "Building2"}
                  tint={bad ? "--ux-danger-tint" : "--ux-surface-2"}
                  ink={bad ? "--ux-danger-solid" : "--ux-ink-2"} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{e.name}</p>
            {!bad && e.paidLate === 0 && <Tag tone="green" size="sm">{tr("verified.alwaysPaidOnTime")}</Tag>}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
            {e.kind} · {e.workedBy} women have worked for them · last report {e.lastReport}
          </p>

          {/* Payment history as a stacked bar — reads at a glance, no stars anywhere */}
          <div className="mt-2.5 flex h-[7px] w-full overflow-hidden rounded-full"
               style={{ background: v("--ux-line") }}>
            <span style={{ width: `${(e.paidOnTime / e.workedBy) * 100}%`, background: v("--ux-green-ink") }} />
            <span style={{ width: `${(e.paidLate / e.workedBy) * 100}%`, background: v("--ux-amber-ink") }} />
            <span style={{ width: `${(e.neverPaid / e.workedBy) * 100}%`, background: v("--ux-danger-solid") }} />
          </div>
          <p className="mt-1.5 text-xs" style={{ color: v("--ux-muted") }}>
            {e.paidOnTime} on time · {e.paidLate} late
            {e.neverPaid > 0 ? ` · ${e.neverPaid} never paid` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-extrabold leading-none tabular-nums"
             style={{ color: v(bad ? "--ux-danger-solid" : "--ux-green-ink") }}>
            {pct}%
          </p>
          <p className="mt-1 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>paid on time</p>
        </div>
      </div>
    </Card>
  );
}

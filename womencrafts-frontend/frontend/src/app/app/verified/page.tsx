"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { SectionLabel, Tag } from "@/components/ux/work/native";
import { Btn, Card, Chip, I, IconTile, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { apiBooks, type BookEntry, type Books } from "@/lib/books-api";
import { EmptyState } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { apiEmployers, apiReportEmployer, type EmployerRecord } from "@/lib/employers-api";
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

  /*
    Real employers, real reports, or an empty screen.

    This ran on four invented businesses. One of them, "Bright Future
    Exports", carried the line "Four women say they were never paid. Ask for
    money up front, or walk away." Nobody had said anything. If that name had
    matched a real company it is a defamatory claim about them, and either way
    a woman was deciding whether to take work on evidence that did not exist.

    `enough` is the important field: below two reports the counts come back
    null rather than zero, so the row can say "too few women have reported"
    instead of reading as a clean record.
  */
  const { data: directory, refetch } = useResource(
    useCallback(async (sig: AbortSignal) => apiEmployers("", sig), []),
    { employers: [] as EmployerRecord[], reported_total: 0 },
  );
  const EMPLOYERS = directory.employers;

  /**
   * What she is actually owed, from her own books.
   *
   * This section used to list three invented jobs — ₹1,480 late from "Ghar Ka
   * Khana", ₹960 that "Bright Future Exports" were refusing — on a screen
   * whose whole subject is which employers pay women and which do not. A woman
   * checking whether she had been paid would have read someone else's debts.
   *
   * An `owed` row in her books is precisely this: work delivered, money not
   * yet arrived. `paid` rows are shown alongside so the list is a record of
   * the work and not only of the trouble.
   */
  const books = useResource<Books>(
    useCallback(async (sig: AbortSignal) => apiBooks(sig),
      []),
    { entries: [], paid_minor: 0, owed_minor: 0, promised_minor: 0, late_count: 0 },
  );
  const claims = useMemo(
    () => books.data.entries
      .filter((e) => e.state === "owed" || e.state === "paid")
      // Outstanding first — the reason she opened this screen.
      .sort((a, b) => Number(b.state === "owed") - Number(a.state === "owed")
        || b.late_days - a.late_days)
      .slice(0, 12),
    [books.data.entries],
  );
  const owed = books.data.owed_minor;
  // Only ever split on counts we are actually showing. An unreported employer
  // is neither safe nor risky, and putting it in "safe" is the whole bug.
  const risky = useMemo(() => EMPLOYERS.filter((e) => e.enough && (e.never_paid ?? 0) > 0), [EMPLOYERS]);
  const clean = useMemo(() => EMPLOYERS.filter((e) => e.enough && (e.never_paid ?? 0) === 0), [EMPLOYERS]);
  const shown = filter === "safe" ? clean : filter === "risky" ? risky : EMPLOYERS;

  const report = useCallback(async (id: string, name: string) => {
    // Written before it is claimed. The old version only pushed an id into
    // local state and told her the next woman would see it.
    await apiReportEmployer(id, { outcome: "never_paid" });
    await refetch();
    setReported((r) => [...r, id]);
    setNote(tr("verified.recorded", { name }));
  }, [refetch, tr]);

  return (
    <HomeShell active="/app/verified">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("verified.beforeYouTakeTheWork")}</p>
          <h1 className="ux-screen-title mt-1 lg:mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("verified.didTheyActuallyPayHer")}</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] leading-snug lg:mt-1.5 lg:text-sm lg:leading-relaxed" style={{ color: v("--ux-muted") }}>
            Every line below was written by a woman who did the work — not by the company, and not
            by us. There are plenty of places to find work. There is nowhere to find out whether
            the money came.
          </p>
        </header>

        {/* The loud one, above everything, in its own space. */}
        {risky.map((e) => (
          <div key={e.id} className="rounded-[var(--ux-r-card)] lg:pl-[8px]"
               style={{ background: v("--ux-danger-solid") }}>
            {/* On a phone the red edge is the panel's own border rather than
                8px of padding on a wrapper, so the panel keeps the one 16px
                inset and 16px radius every other block has. */}
            <div className="rounded-[16px] border-s-[6px] border-[color:var(--ux-danger-solid)] p-4 sm:p-6 lg:rounded-[calc(var(--ux-r-card)-1px)] lg:border-s-0"
                 style={{ background: v("--ux-danger-tint") }}>
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
                      style={{ background: v("--ux-danger-solid"), color: v("--ux-on-danger") }}>
                  <I name="AlertTriangle" className="h-[24px] w-[24px]" sw={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] lg:text-2xs" style={{ color: v("--ux-ink") }}>{tr("verified.womenAreWarningEachOtherAbout")}</p>
                  <p className="mt-2 text-xl font-extrabold lg:mt-1.5 lg:text-[clamp(1.1875rem,2.4vw,1.5rem)] leading-tight tracking-[-0.025em]"
                     style={{ color: v("--ux-ink") }}>
                    {e.name}
                  </p>
                  {/*
                    The old fixture wrote her advice into the data — "Ask for
                    money up front, or walk away" — beside a number nobody had
                    reported. The count is ours to state; what to do about it
                    is hers.
                  */}
                  <p className="mt-2 max-w-[52ch] text-sm font-semibold leading-relaxed" style={{ color: v("--ux-ink") }}>
                    {tr("verified.reportedByWomenWhoWorked", { count: e.worked_by })}
                  </p>

                  {/* the count, drawn as bodies not a bar */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: e.worked_by }).map((_, i) => (
                        <I key={i} name="User" className="h-[17px] w-[17px]"
                           sw={2.4}
                           style={{ color: v(i < (e.never_paid ?? 0) ? "--ux-danger-solid" : "--ux-line-strong") }} />
                      ))}
                    </div>
                    <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                      {tr("verified.neverPaidOf", { never: e.never_paid ?? 0, total: e.worked_by })}
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
                    {tr("verified.morePaidLate", { late: e.paid_late ?? 0 })}
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
          <SectionLabel title={tr("verified.workYouHaveDone")}
                        sub={owed > 0 ? `${formatRupees(owed)} of it has not reached you` : "All paid"}
                        icon="Receipt" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {claims.length === 0 ? (
              <EmptyState
                icon="Receipt"
                title="Nothing recorded yet"
                body="What you are owed comes from your books. Write down a job when you deliver it, and it shows here until the money arrives."
                action={<Btn size="sm" variant="outline" icon="BookOpen" href="/app/books">Open your books</Btn>}
              />
            ) : claims.map((w: BookEntry, i: number) => {
              const late = w.state === "owed" && w.late_days > 0;
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-4 lg:gap-4 lg:px-5"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="h-[34px] w-[3px] shrink-0 rounded-full"
                        style={{ background: v(w.state === "paid" ? "--ux-green-ink" : late ? "--ux-amber-ink" : "--ux-line-strong") }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{w.what || w.who}</p>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                      {w.who}
                      {late ? ` · ${w.late_days} ${w.late_days === 1 ? "day" : "days"} late` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                      {formatRupees(w.minor)}
                    </p>
                    <Tag tone={w.state === "paid" ? "green" : late ? "orange" : "neutral"} size="sm">
                      {w.state === "paid" ? "Paid" : late ? "Late" : "Waiting"}
                    </Tag>
                  </div>
                  {/* Its own full-width line on a phone: beside the amount it
                      squeezed "Embroidery, 24 pieces" into a 58px column. */}
                  {w.state !== "paid" && (
                    <Btn size="sm" variant="outline" href="/app/haq" className="w-full lg:w-auto">{tr("verified.chaseIt")}</Btn>
                  )}
                </div>
              );
            })}
          </Card>
        </div>

        {/* The quiet ledger */}
        <div>
          <SectionLabel title={tr("verified.whoElseHasHiredWomenHere")} icon="Building2" chip={String(shown.length)} />
          <div className="ux-chiprow mb-3 flex flex-wrap gap-2 lg:mb-3.5" style={{ ["--ux-pad" as string]: "20px" }}>
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everyone</Chip>
            <Chip icon="Check" selected={filter === "safe"} onClick={() => setFilter("safe")}>{tr("verified.alwaysPaid")}</Chip>
            <Chip icon="AlertTriangle" selected={filter === "risky"} onClick={() => setFilter("risky")}>{tr("verified.beCareful")}</Chip>
          </div>
          <div className="flex flex-col gap-3 lg:gap-2.5">
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
function Row({ e }: { e: EmployerRecord }) {
  const tr = useT();
  // Below the reporting threshold there is nothing to judge, so nothing is
  // drawn as good or bad. `enough` is false and the row says why.
  const bad = e.enough && (e.never_paid ?? 0) > 0;
  const pct = e.enough && e.worked_by > 0
    ? Math.round(((e.paid_on_time ?? 0) / e.worked_by) * 100)
    : null;
  return (
    <Card pad={16} style={bad ? { borderColor: v("--ux-danger-solid") } : undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <IconTile icon={bad ? "AlertTriangle" : "Building2"}
                  tint={bad ? "--ux-danger-tint" : "--ux-surface-2"}
                  ink={bad ? "--ux-danger-solid" : "--ux-ink-2"} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{e.name}</p>
            {e.enough && !bad && e.paid_late === 0 && <Tag tone="green" size="sm">{tr("verified.alwaysPaidOnTime")}</Tag>}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
            {e.kind ? `${e.kind} · ` : ""}{tr("verified.womenHaveWorked", { count: e.worked_by })}
          </p>

          {/* Payment history as a stacked bar — reads at a glance, no stars anywhere */}
          {/* Drawn only when there is something to draw. A full grey bar over
              one report reads as a record; it is not one. */}
          {e.enough ? (
            <>
              <div className="mt-2.5 flex h-[7px] w-full overflow-hidden rounded-full"
                   style={{ background: v("--ux-line") }}>
                <span style={{ width: `${((e.paid_on_time ?? 0) / e.worked_by) * 100}%`, background: v("--ux-green-ink") }} />
                <span style={{ width: `${((e.paid_late ?? 0) / e.worked_by) * 100}%`, background: v("--ux-amber-ink") }} />
                <span style={{ width: `${((e.never_paid ?? 0) / e.worked_by) * 100}%`, background: v("--ux-danger-solid") }} />
              </div>
              <p className="mt-1.5 text-xs" style={{ color: v("--ux-muted") }}>
                {tr("verified.onTimeLate", { onTime: e.paid_on_time ?? 0, late: e.paid_late ?? 0 })}
                {(e.never_paid ?? 0) > 0 ? tr("verified.neverPaidSuffix", { n: e.never_paid ?? 0 }) : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("verified.tooFewReports")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {pct === null ? (
            <p className="text-2xs font-semibold" style={{ color: v("--ux-faint") }}>{tr("verified.noRecordYet")}</p>
          ) : (
            <>
              <p className="text-xl font-extrabold leading-none tabular-nums"
                 style={{ color: v(bad ? "--ux-danger-solid" : "--ux-green-ink") }}>
                {pct}%
              </p>
              <p className="mt-1 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>{tr("verified.paidOnTime")}</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

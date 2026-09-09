"use client";

import { useState } from "react";
import { COPY } from "@/components/ux/copy";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, EmptyState, IconTile, Pill,
  Progress, SectionHead, SourceNote, Tabs, copy
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { RailStat, StageTrack } from "@/components/ux/work/parts";
import { STAGES, WORK_ART } from "@/components/ux/work/data";
import { useApplications, workStats } from "@/components/ux/growth";
import { useT } from "@/i18n";

const TABS = ["Active", "Interviews", "Closed", "All"] as const;

/**
 * Everything she has applied for, and where each one has got to.
 *
 * The point of this screen is that waiting is the hardest part: a row says not
 * only which stage it is at but what is actually happening next, and rows that
 * ended say so plainly rather than sitting at "Applied" forever.
 */
export default function Applications() {
  const tr = useT();
  const { data: APPLICATIONS, source } = useApplications();
  const WORK_STATS = workStats(APPLICATIONS);
  const [tab, setTab] = useState<string>("Active");

  // No `useMemo`. Both of these used to have one, and neither listed
  // `APPLICATIONS` — which arrives from the server a moment after the first
  // render. They were therefore computed once, from the mock fallback, and
  // never again: seven real applications sat behind a list of invented ones
  // while the header above counted the real seven. The compiler memoizes this
  // component, so the memo bought nothing even when it was correct.
  const shown = APPLICATIONS.filter((a) => {
    if (tab === "All") return true;
    if (tab === "Closed") return a.step === 0;
    if (tab === "Interviews") return a.stage === "Interview";
    return a.step > 0;
  });

  const counts = {
    Active: APPLICATIONS.filter((a) => a.step > 0).length,
    Interviews: APPLICATIONS.filter((a) => a.stage === "Interview").length,
    Closed: APPLICATIONS.filter((a) => a.step === 0).length,
    All: APPLICATIONS.length,
  };

  return (
    <HomeShell
      active="/app/applications"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("applications.yourRecord")} sub={tr("applications.sinceYouJoined")} />
            <div className="space-y-3.5">
              <RailStat value={WORK_STATS.applied} label="Sent" icon="Send" tint="--ux-tint-violet" ink="--ux-violet" />
              <RailStat value={WORK_STATS.shortlisted} label="Shortlisted" icon="ListChecks" tint="--ux-tint-blue" ink="--ux-blue" />
              <RailStat value={WORK_STATS.interviews} label="Interviews" icon="MessageSquare" tint="--ux-tint-green" ink="--ux-green" />
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span style={{ color: "var(--ux-muted)" }}>{tr("applications.replyRate")}</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>{WORK_STATS.responseRate}%</span>
              </div>
              <Progress pct={WORK_STATS.responseRate} track="--ux-track" />
              <p className="mt-2 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                {WORK_STATS.responseRate
                  ? `${WORK_STATS.responseRate}% of yours have had a reply so far.`
                  : "None have had a reply yet. That is normal in the first week."}
              </p>
            </div>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={WORK_ART.interview} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("applications.interviewOnMonday")}</h3>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("applications.tenMinutesOfPracticeMakesA")}</p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">Practise</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("applications.yourApplications")}</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {counts.Active === 1
              ? "One application is still moving."
              : `${counts.Active} applications are still moving.`}
            {counts.Interviews > 0 &&
              ` ${counts.Interviews === 1 ? "One is" : `${counts.Interviews} are`} at interview.`}
          </p>

      <SourceNote source={source} what="applications" />
        </div>
        <Tabs items={[...TABS]} active={tab} onChange={setTab} />
      </div>

      {shown.length ? (
        <div className="ux-deck space-y-[12px]">
          {shown.map((a, i) => {
            const closed = a.step === 0;
            return (
              <Card key={a.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={closed ? "CircleSlash" : "Briefcase"}
                            tint={closed ? "--ux-surface-2" : a.tone}
                            ink={closed ? "--ux-muted" : a.ink} size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold"
                          style={{ color: closed ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                        {a.title}
                      </h3>
                      <Pill tone={closed ? "neutral" : a.stage === "Interview" ? "brand" : "blue"} size="sm">
                        {a.stage}
                      </Pill>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs" style={{ color: "var(--ux-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icons.Building2 className="h-3.5 w-3.5" /> {a.org}</span>
                      <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> Applied {a.at}</span>
                    </p>
                    <p className="mt-2 text-xsm" style={{ color: closed ? "var(--ux-faint)" : "var(--ux-ink-2)" }}>
                      {a.when}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
                     style={{ borderColor: "var(--ux-line)" }}>
                  <StageTrack step={a.step} stages={STAGES} />
                  <span className="flex items-center gap-2">
                    <Btn href={`/app/opportunities/${a.jobId}`} variant="outline" size="sm">{tr("applications.theListing")}</Btn>
                    {a.stage === "Interview" && (
                      <ActionBtn variant="primary" size="sm" icon="Video" doneIcon="Copy"
                                 done={COPY.linkCopied}
                                 act={() => copy(`https://meet.womsakhi.in/${a.id}`, COPY.linkCopied, "Copy it by hand: meet.womsakhi.in/" + a.id)}>{tr("applications.joinTheCall")}</ActionBtn>
                    )}
                    {closed && <Btn href="/app/opportunities" variant="soft" size="sm">{tr("applications.findSimilar")}</Btn>}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="Inbox"
            title={tab === "Closed" ? "Nothing has closed" : `No ${tab.toLowerCase()} applications`}
            body="Everything you apply for shows up here, with what is happening next."
            action={<Btn href="/app/opportunities" variant="primary" iconEnd="ArrowRight">{tr("applications.findWork")}</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}

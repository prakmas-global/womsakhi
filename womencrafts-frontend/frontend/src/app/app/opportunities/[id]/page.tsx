"use client";

import { use, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import { apiApply, apiToggleSaveOpportunity } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useAttemptKey } from "@/lib/idempotency";
import { useJobs } from "@/components/ux/growth";
import { matchFor } from "@/services/job-match";
import { WORK_ART, payLabel } from "@/components/ux/work/data";
import {
  Back, Btn, Card, EmptyState, Pill, RailSkeleton, ScreenSkeleton, SourceNote, v,
} from "@/components/ux/kit";
import { useT } from "@/i18n";

import { Block, CheckList, KeyDetails, MatchCard, SimilarJobs, WhoCanApply } from "./detail-views";

/**
 * One opening, in the order she has to decide in.
 *
 * ── Apply lives in the rail, and stays there ────────────────────────────────
 * The decision is made while reading the requirements, which is halfway down.
 * A button at the top means scrolling back up to act on a decision she made
 * while looking at something else.
 *
 * ── What this screen will not claim ─────────────────────────────────────────
 * The design it is built from carries a company profile — employee counts, a
 * culture rating, office photographs, "Apply with LinkedIn". None of that
 * exists here: there is no company record, no rating, no LinkedIn integration.
 * Rather than draw them, the rail carries the thing this product actually
 * knows and no job board does — whether this employer has PAID the women who
 * worked for them before. That is the question she is really asking when she
 * looks at a company's page.
 *
 * Benefits, a deadline and a reviews tab are absent for the same reason. An
 * empty "Deadline —" reads as "apply whenever", which is worse than not asking.
 */
export default function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: JOBS, source, refetch } = useJobs();
  const job = JOBS.find((j) => j.id === id);

  // The same computation the list uses, so the two screens can never disagree.
  const fit = matchFor(job?.skills ?? []);

  const [sentNow, setSentNow] = useState(false);
  const [savedNow, setSavedNow] = useState<boolean | null>(null);
  const attempt = useAttemptKey("apply");

  const applied = sentNow || (job?.applied ?? false);
  const saved = savedNow ?? job?.saved ?? false;

  const apply = useAction(
    async () => { await apiApply(id, ""); },
    {
      onDone: () => { attempt.settle(); setSentNow(true); refetch(); },
      fallbackError: "That did not go through. Your application has not been sent — try again in a moment.",
    },
  );

  const bookmark = useAction(
    async () => { await apiToggleSaveOpportunity(id); },
    {
      onDone: refetch,
      optimistic: () => setSavedNow(!saved),
      rollback: () => setSavedNow(null),
      fallbackError: "Could not save it just now.",
    },
  );

  // "Not listed" is a claim, and it cannot be made while the answer is still
  // on its way — saying it during the fetch makes every detail screen flash
  // "that is not here" before showing itself.
  if (!job && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!job) {
    return (
      <HomeShell active="/app/opportunities">
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("opportunities.thatOpeningIsNoLongerListed")}
            body="It may have been filled, or the link may be old. The rest are still here."
            action={<Btn href="/app/opportunities" variant="primary" iconEnd="ArrowRight">{tr("opportunities.backToWork")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const similar = JOBS.filter((j) => j.id !== job.id && j.kind === job.kind).slice(0, 3);

  return (
    <HomeShell
      active="/app/opportunities"
      rail={
        <div className="space-y-[16px]">
          <MatchCard fit={fit} job={job} />

          {/* Apply. The one thing this screen is for. */}
          <Card>
            {applied ? (
              <>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={WORK_ART.applied} alt=""
                       className="h-[54px] w-[54px] shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                      It is with {job.org} now.
                    </p>
                    <p className="mt-1 text-xs leading-snug" style={{ color: v("--ux-muted") }}>
                      {tr("opportunities.mostEmployersReplyWithinThreeDays")}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Btn href="/app/applications" variant="soft" full iconEnd="ArrowRight">
                    {tr("opportunities.trackIt")}
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <Btn
                  variant="primary"
                  full
                  iconEnd={apply.busy ? undefined : "ArrowRight"}
                  icon={apply.busy ? "Loader" : undefined}
                  disabled={apply.busy}
                  onClick={() => void apply.run()}
                >
                  {apply.busy ? "Sending…" : "Apply now"}
                </Btn>
                <div className="mt-2">
                  <Btn variant="outline" full icon={saved ? "BookmarkCheck" : "Bookmark"}
                       onClick={() => void bookmark.run()}>
                    {saved ? "Saved" : "Save for later"}
                  </Btn>
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-2xs"
                   style={{ color: v("--ux-muted") }}>
                  <Icons.Clock className="h-[12px] w-[12px]" />{tr("jobdetail.applyingTakesAboutAMinute")}</p>
                <p className="mt-1.5 flex items-center justify-center gap-1.5 text-2xs"
                   style={{ color: v("--ux-muted") }}>
                  <Icons.ShieldCheck className="h-[12px] w-[12px]" />{tr("jobdetail.theySeeYourProfileNeverYour")}</p>
              </>
            )}
            {(apply.error || bookmark.error) && (
              <p role="alert" className="ux-slide-up mt-3 text-xs leading-relaxed"
                 style={{ color: v("--ux-orange-ink") }}>
                {apply.error || bookmark.error}
              </p>
            )}
          </Card>

          {/* What a job board's "About the company" cannot tell her. */}
          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
              About {job.org}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-xsm">
              {job.verified ? (
                <>
                  <Icons.BadgeCheck className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-green-ink") }} />
                  <span style={{ color: v("--ux-ink-2") }}>{tr("jobdetail.theyPaidTheWomenWhoWorked")}</span>
                </>
              ) : (
                <>
                  <Icons.HelpCircle className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
                  <span style={{ color: v("--ux-ink-2") }}>{tr("jobdetail.noWomanHereHasReportedOn")}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              We do not rate employers. We record whether the money arrived, from the women it
              was owed to.
            </p>
            <div className="mt-3">
              <Btn href="/app/verified" variant="outline" size="sm" full iconEnd="ArrowRight">{tr("jobdetail.didTheyPayHer")}</Btn>
            </div>
          </Card>

          <SimilarJobs jobs={similar} />

          {/* Help, as three real destinations. */}
          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("jobdetail.needHelpApplying")}</h2>
            <div className="mt-2.5 space-y-1">
              {[
                { icon: "Sparkles", label: "Ask Sakhi about this one", href: "/app/sakhi" },
                { icon: "FileText", label: "Get your papers ready",    href: "/app/vault" },
                { icon: "Search",   label: "Find work like this",      href: "/app/opportunities" },
              ].map((a) => (
                <Btn key={a.href} href={a.href} variant="ghost" size="sm" full icon={a.icon} iconEnd="ArrowRight">
                  {a.label}
                </Btn>
              ))}
            </div>
          </Card>
        </div>
      }
    >
      <Back to="/app/opportunities" label={tr("opportunities.allWork")} className="mb-4" />

      {/* ── Who is hiring, and for what ─────────────────────────────────── */}
      <Card className="mb-[16px]" pad={20}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[16px]"
                style={{ background: v(job.logoTint) }}>
            <Icons.Briefcase className="h-[26px] w-[26px]" style={{ color: v(job.logoInk) }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.02em]"
                  style={{ color: v("--ux-ink") }}>
                {job.title}
              </h1>
              {fit.pct !== null && fit.pct > 0 && (
                <Pill tone="green" size="sm">{fit.pct}% match</Pill>
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xsm"
               style={{ color: v("--ux-muted") }}>
              <span className="font-bold" style={{ color: v("--ux-ink-2") }}>{job.org}</span>
              {job.verified && (
                <Icons.BadgeCheck className="h-[15px] w-[15px]" style={{ color: v("--ux-green-ink") }} />
              )}
              <span aria-hidden>·</span>
              <span>{job.place}</span>
              <span aria-hidden>·</span>
              <span>{job.mode}</span>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xsm"
               style={{ color: v("--ux-ink-2") }}>
              <span className="inline-flex items-center gap-1.5">
                <Icons.Briefcase className="h-[14px] w-[14px]" style={{ color: v("--ux-muted") }} />{job.kind}
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Icons.IndianRupee className="h-[14px] w-[14px]" style={{ color: v("--ux-muted") }} />{payLabel(job)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icons.Clock className="h-[14px] w-[14px]" style={{ color: v("--ux-muted") }} />Posted {job.posted}
              </span>
            </p>
            {job.womenLed && <div className="mt-3"><Pill tone="pink" size="sm">Women-led</Pill></div>}
          </div>
        </div>
        <SourceNote source={source} what={tr("jobdetail.thisOpening")} />
      </Card>

      <div className="flex flex-col gap-6">
        <Block icon="Info" title={tr("jobdetail.aboutTheRole")} tint="--ux-tint-violet" ink="--ux-violet-ink">
          <p className="max-w-[70ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {job.about}
          </p>
          {job.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.skills.map((s) => {
                const has = fit.have.includes(s);
                return (
                  <span key={s} className="inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-xs font-semibold"
                        style={{ background: v(has ? "--ux-tint-green" : "--ux-surface-2"),
                                 color: v(has ? "--ux-green-ink" : "--ux-ink-2") }}>
                    {has && <Icons.Check className="h-[12px] w-[12px]" />}
                    {s}
                  </span>
                );
              })}
            </div>
          )}
        </Block>

        <Block icon="ClipboardList" title={tr("jobdetail.keyDetails")} tint="--ux-tint-blue" ink="--ux-blue-ink">
          <KeyDetails job={job} />
        </Block>

        <Block icon="UsersRound" title={tr("jobdetail.whoCanApply")} tint="--ux-tint-pink" ink="--ux-pink-ink">
          <WhoCanApply job={job} />
        </Block>

        {job.responsibilities.length > 0 && (
          <Block icon="ListChecks" title={tr("opportunities.whatYouWouldDo")}
                 tint="--ux-tint-amber" ink="--ux-amber-ink">
            <CheckList items={job.responsibilities} tint="--ux-amber-ink" />
          </Block>
        )}

        {job.needs.length > 0 && (
          <Block icon="BadgeCheck" title={tr("opportunities.whatTheyAskFor")}
                 tint="--ux-tint-green" ink="--ux-green-ink">
            <CheckList items={job.needs} tint="--ux-green-ink" />
          </Block>
        )}

        {/* Kept from the screen this replaces — it is the part a job board
            never has, and the part that matters most on a bad listing. */}
        <Block icon="ShieldCheck" title={tr("opportunities.stayingSafe")}
               tint="--ux-surface-2" ink="--ux-muted">
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <ul className="space-y-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              <li>{tr("jobdetail.nobodyHiringThroughWomsakhiShouldE")}</li>
              <li>{tr("jobdetail.noEmployerNeedsYourPinYour")}</li>
              <li>{tr("jobdetail.ifSomethingFeelsWrongStopAnd")}</li>
            </ul>
            <div className="mt-3">
              <Btn href="/app/safety" variant="outline" size="sm" icon="Flag">
                {tr("opportunities.reportThisListing")}
              </Btn>
            </div>
          </Card>
        </Block>

        <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[16px] p-5"
             style={{ background: "linear-gradient(120deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={WORK_ART.interview} alt="" aria-hidden
               className="h-[86px] w-[86px] shrink-0 object-contain" />
          <div className="min-w-[240px] flex-1">
            <p className="text-base font-extrabold" style={{ color: v("--ux-brand") }}>{tr("jobdetail.youAreMoreCapableThanYou")}</p>
            <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("jobdetail.mostWomenWhoAppliedHereHad")}</p>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

"use client";

import { use, useState } from "react";
import { COPY } from "@/components/ux/copy";

import { apiApply, apiToggleSaveOpportunity } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useAttemptKey } from "@/lib/idempotency";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";
import { matchFor } from "@/services/job-match";

import {Back, Btn, Card, EmptyState, I, IconTile, Pill, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useJobs } from "@/components/ux/growth";
import { JobRow, RailStat } from "@/components/ux/work/parts";
import { STAGES, WORK_ART, money, payLabel } from "@/components/ux/work/data";
import { useT } from "@/i18n";

/**
 * One opening, in full.
 *
 * Applying is three visible states, not a link to a form: idle, sending, sent.
 * She should never have to wonder whether the tap registered, and she should
 * never be able to send the same application twice by tapping again.
 */
export default function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: JOBS, source, refetch } = useJobs();
  const job = JOBS.find((j) => j.id === id);
  // Which of the asked-for skills she already has — the same computation the
  // list uses, so the two screens can never disagree.
  const fit = matchFor(job?.skills ?? []);
  /**
   * Whether she has applied, and whether she has saved it — from the server,
   * with a press still in flight allowed to show through.
   *
   * Both were plain `useState` starting at false. The API has carried
   * `applied` and `saved` all along; ignoring them meant a woman who applied
   * last week opened this screen to "Apply now" and no sign she had. The
   * button then set a timer and said "sent" without sending, so applying
   * again would not have helped her either.
   */
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

  const similar = JOBS.filter((j) => j.id !== job.id && j.kind === job.kind).slice(0, 2);

  return (
    <HomeShell
      active="/app/opportunities"
      rail={
        <div className="space-y-[16px]">
          {/* This card used to be "Your fit": a ring, and a verdict — "Strong
              match" / "A stretch" — under the line "based on your skills, your
              location and what you have finished". Nothing computes a match
              score. `match` is hardcoded to zero for every listing, so every
              opening in the app told her she was a stretch for it, in a ring
              that looked measured. What the listing actually asks for is real,
              and is what she needs to decide. */}
          {job.skills.length > 0 && (
            <Card>
              <SectionHead title={tr("opportunities.whatTheyAskFor")} sub={tr("opportunities.straightFromTheListing")} />
              {/* Ticked where she has it, outlined where she does not. A flat
                  list of requirements makes every listing look equally out of
                  reach; showing which ones she already meets is the difference
                  between a wall and a short list. */}
              <ul className="space-y-2">
                {job.skills.map((s, i) => {
                  const has = fit.have.includes(s);
                  return (
                    <li key={s} className="ux-rise flex items-center gap-2 text-xsm"
                        style={{ ["--i" as string]: i, color: has ? "var(--ux-ink)" : "var(--ux-muted)" }}>
                      <Icons.Check className="h-[15px] w-[15px] shrink-0"
                                   style={{ color: has ? "var(--ux-green-ink)" : "var(--ux-line-strong)" }}
                                   strokeWidth={2.6} />
                      {s}
                      {has && <span className="text-2xs font-semibold"
                                    style={{ color: "var(--ux-green-ink)" }}>you have this</span>}
                    </li>
                  );
                })}
              </ul>
              {fit.missing.length > 0 && (
                <p className="mt-3 rounded-[8px] px-3 py-2.5 text-xs leading-relaxed"
                   style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                  You can still apply without {fit.missing.length === 1 ? "it" : "all of them"}. Most
                  women here were missing something on the job they got.
                </p>
              )}
            </Card>
          )}

          <Card>
            <SectionHead title={tr("opportunities.atAGlance")} />
            <div className="space-y-3.5">
              <RailStat value={money(job.payLow)} label={tr("opportunities.lowestTheyPay")} icon="BadgeIndianRupee"
                        tint="--ux-tint-green" ink="--ux-green" />
              <RailStat value={job.applicants} label={tr("opportunities.womenAppliedSoFar")} icon="Users"
                        tint="--ux-tint-violet" ink="--ux-violet" />
              <RailStat value={job.posted} label="Posted" icon="Clock"
                        tint="--ux-tint-blue" ink="--ux-blue" />
            </div>
          </Card>

          {/* What to have ready. A woman who reaches the form and discovers she
              needs a document she does not have loses the application and often
              does not come back. Saying it before she starts is the whole
              point — and every one of these is already in her vault. */}
          <Card>
            <SectionHead title={tr("opportunities.whatToHaveReady")} sub={tr("opportunities.allOfItIsAlreadyIn")} icon="FolderLock" />
            <ul className="space-y-2.5">
              {[
                { what: "A photo ID", why: "Aadhaar, voter card or driving licence", have: true },
                { what: "Your bank details", why: "So they can pay you", have: true },
                { what: "Proof you earn", why: "Only for the bigger contracts", have: true },
                { what: "A reference", why: "A woman who has worked with you", have: false },
              ].map((d) => (
                <li key={d.what} className="flex items-start gap-2.5">
                  <Icons.Check className="mt-[2px] h-[15px] w-[15px] shrink-0"
                               style={{ color: d.have ? "var(--ux-green-ink)" : "var(--ux-line-strong)" }}
                               strokeWidth={2.6} />
                  <span className="min-w-0">
                    <span className="text-xsm font-semibold"
                          style={{ color: d.have ? "var(--ux-ink)" : "var(--ux-muted)" }}>{d.what}</span>
                    <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>{d.why}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn size="sm" variant="outline" href="/app/vault" icon="Lock">{tr("opportunities.openYourLocker")}</Btn>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("opportunities.whatHappensNext")} />
            <ol className="space-y-3">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                    {["You send this application", "They read your profile", "A call or a video chat", "They make an offer"][i]}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      }
    >
      <Back to="/app/opportunities" label={tr("opportunities.allWork")} className="mb-4" />

      <Card className="mb-[16px]">
        <div className="flex items-start gap-4">
          <IconTile icon={job.icon} tint={job.logoTint} ink={job.logoInk} size={62} radius={16} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{job.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1"><Icons.Building2 className="h-4 w-4" /> {job.org}</span>
              <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {job.place}</span>
              <span className="inline-flex items-center gap-1"><Icons.Clock className="h-4 w-4" /> {job.posted}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="brand">{job.kind}</Pill>
              <Pill tone="neutral">{job.mode}</Pill>
              {job.verified && <Pill tone="green">{tr("opportunities.verifiedEmployer")}</Pill>}
              {job.womenLed && <Pill tone="pink">Women-led</Pill>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
          <div>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{tr("opportunities.theyPay")}</p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>{payLabel(job)}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Btn variant="outline" icon={saved ? "BookmarkCheck" : "Bookmark"} onClick={() => void bookmark.run()}>
              {saved ? "Saved" : "Save"}
            </Btn>
            {applied ? (
              <span className="ux-pop ux-sq inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-xsm font-semibold"
                    style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                <Icons.CheckCheck className="h-[15px] w-[15px]" />{tr("opportunities.applicationSent")}</span>
            ) : (
              <Btn
                variant="primary"
                iconEnd={apply.busy ? undefined : "ArrowRight"}
                icon={apply.busy ? "Loader" : undefined}
                disabled={apply.busy}
                onClick={() => void apply.run()}
              >
                {apply.busy ? "Sending…" : "Apply now"}
              </Btn>
            )}
          </div>
          {(apply.error || bookmark.error) && (
            <p role="alert" className="ux-slide-up mt-3 text-xsm leading-relaxed"
               style={{ color: "var(--ux-orange-ink)" }}>
              {apply.error || bookmark.error}
            </p>
          )}
        </div>

        {applied && (
          <div className="ux-slide-up mt-4 flex items-center gap-3.5 rounded-[12px] p-3.5"
               style={{ background: "var(--ux-tint-green)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={WORK_ART.applied} alt="" className="h-[62px] w-[62px] shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
                It is with {job.org} now.
              </p>
              <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-ink-2)" }}>{tr("opportunities.mostEmployersReplyWithinThreeDays")}</p>
            </div>
            <Btn href="/app/applications" variant="soft" size="sm" iconEnd="ArrowRight">{tr("opportunities.trackIt")}</Btn>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-[16px]">
        <Card>
          <SectionHead title={tr("opportunities.aboutThisWork")} />
          <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{job.about}</p>

          {/* Both lists are hidden when the listing carries nothing, rather
              than printing a heading over empty space. The API has no
              responsibilities field at all today, so that heading stood over
              nothing on every opening in the app. */}
          {job.responsibilities.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("opportunities.whatYouWouldDo")}</h3>
              <ul className="ux-stagger space-y-2">
                {job.responsibilities.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                    <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: "var(--ux-brand)" }} />
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}

          {job.needs.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("opportunities.whatYouNeed")}</h3>
              <ul className="ux-stagger space-y-2">
                {job.needs.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                    <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <SectionHead title={tr("opportunities.stayingSafe")} icon="ShieldCheck" />
          <ul className="space-y-3">
            {[
              ["No employer on WomSakhi may ask you for money", "IndianRupee"],
              ["Never share an OTP, even with someone who says they are hiring", "KeyRound"],
              [COPY.meetSafely, "Video"],
            ].map(([t, ic]) => (
              <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                <I name={ic} className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Btn href="/app/safety" variant="outline" size="sm" full icon="Flag">{tr("opportunities.reportThisListing")}</Btn>
          </div>
        </Card>
      </div>

      {similar.length > 0 && (
        <div className="mt-[16px]">
          <SectionHead title={tr("opportunities.similarWork")} sub={`Other ${job.kind.toLowerCase()} openings you may like`} />
          <div className="space-y-[12px]">
            {similar.map((j, i) => (
              <JobRow key={j.id} job={j} i={i} saved={false} onSave={() => {}} />
            ))}
          </div>
        </div>
      )}
    </HomeShell>
  );
}

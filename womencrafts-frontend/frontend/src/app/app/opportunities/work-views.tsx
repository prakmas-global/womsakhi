"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, IconTile, v } from "@/components/ux/kit";
import { payLabel, type Job } from "@/components/ux/work/data";
import { matchFor } from "@/services/job-match";
import { MediaCard, Fact } from "@/components/ux/media/MediaCard";
import { jobPicture, useWorkTaxonomy } from "@/components/ux/work/pictures";
import { FitLine, PostedBy } from "@/components/ux/work/parts";
import { useT } from "@/i18n";

/* ------------------------------------------------------------------ */
/*  The kinds of work, as a strip                                      */
/* ------------------------------------------------------------------ */

export const FAMILIES = [
  { id: "Remote",     label: "Remote jobs",  sub: "Work from anywhere",  icon: "Globe",         tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  { id: "Part-time",  label: "Part-time",    sub: "Flexible hours",      icon: "Clock",         tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  { id: "Full-time",  label: "Full-time",    sub: "Build your career",   icon: "Briefcase",     tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { id: "Freelance",  label: "Freelance",    sub: "Be your own boss",    icon: "Laptop",        tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  { id: "Internship", label: "Internships",  sub: "Gain experience",     icon: "GraduationCap", tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
] as const;

export type FamilyId = (typeof FAMILIES)[number]["id"];

export function FamilyStrip({ active, onPick }: {
  active: FamilyId | null; onPick: (id: FamilyId | null) => void;
}) {
  return (
    <div className="ux-noscroll -mx-5 flex items-stretch gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
      {FAMILIES.map((f) => {
        const on = active === f.id;
        return (
          <button key={f.id} type="button" aria-pressed={on}
                  onClick={() => onPick(on ? null : f.id)}
                  className="ux-press ux-sq flex w-[196px] shrink-0 items-center gap-3 rounded-[12px] border p-4 text-start lg:rounded-[14px] lg:p-3.5"
                  style={{
                    borderColor: v(on ? "--ux-brand" : "--ux-line"),
                    background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                  }}>
            <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={40} radius={11} />
            <span className="min-w-0">
              <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{f.label}</span>
              <span className="block truncate text-[13px] lg:text-xs" style={{ color: v("--ux-muted") }}>{f.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One opening                                                        */
/* ------------------------------------------------------------------ */

/**
 * A job, as she has to judge it.
 *
 * A big picture of the WORK itself (tailoring, kitchen, data entry — picked
 * by `artFor` from the job's title and skills), with the two things that
 * decide a tap on it: what kind of work it is, and what it pays, exactly as the
 * listing words it. Under it: who posted it, where, when it closes, and the
 * honest fit — the server compares her My work profile skills with the skill
 * keys the job was posted with, and the card says which ones she has.
 */
export function JobCard({ job, saved, onSave }: {
  job: Job; saved: boolean; onSave: () => void;
}) {
  const tr = useT();
  const workCats = useWorkTaxonomy();
  // Her work-profile skills against this listing's skill keys, from the
  // server. `matchFor` returns pct null when there is nothing to compare,
  // and the fit line and badge are then left out rather than shown as zero.
  const match = matchFor(job);
  const of = match.have.length + match.missing.length;
  const kind = job.kind === "Order" ? "Order to make" : job.kind;
  return (
    <MediaCard
      href={`/app/opportunities/${job.id}`}
      image={jobPicture(job, workCats)}
      alt={job.title}
      topLeft={{ text: kind, tone: "light" }}
      topRight={{ text: payLabel(job), tone: "dark" }}
      overlay={match.pct !== null && match.have.length > 0 ? (
        <><Icons.BadgeCheck className="h-[13px] w-[13px]" />{match.have.length} of {of} of your skills match</>
      ) : job.applied ? (<><Icons.CheckCircle2 className="h-[13px] w-[13px]" />You applied</>) : null}
      highlight={match.pct !== null && match.pct >= 80}
      title={job.title}
      subtitle={<PostedBy job={job} />}
      meta={<>
        {job.place && <Fact icon="MapPin">{job.place}</Fact>}
        <Fact icon="Laptop">{job.mode === "Remote" ? "From home" : job.mode}</Fact>
        <Fact icon="Clock">{job.deadline ? `Closes ${new Date(job.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : `Posted ${job.posted}`}</Fact>
      </>}
      footer={
        <div className="grid grid-cols-2 gap-2">
          {job.isMine ? (
            <>
              <Btn size="sm" variant="outline" href={`/app/opportunities/${job.id}`} full>{tr("workviews.viewDetails")}</Btn>
              <Btn size="sm" href={`/app/work/posts?job=${job.id}`} full icon="Users">See applicants</Btn>
            </>
          ) : (
            <>
              <Btn size="sm" variant={saved ? "soft" : "outline"} icon="Bookmark" full onClick={onSave}>
                {saved ? "Saved" : "Save"}
              </Btn>
              <Btn size="sm" href={`/app/opportunities/${job.id}`} full iconEnd="ArrowRight">{tr("workviews.viewDetails")}</Btn>
            </>
          )}
        </div>
      }
    >
      {match.pct !== null && <FitLine fit={match} />}
      {job.skills.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${match.pct !== null ? "mt-2" : ""}`}>
          {job.skills.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full px-2.5 py-1 text-2xs font-semibold"
                  style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>{s}</span>
          ))}
          {job.skills.length > 3 && (
            <span className="rounded-full px-2.5 py-1 text-2xs font-semibold"
                  style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>+{job.skills.length - 3}</span>
          )}
        </div>
      )}
    </MediaCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Right rail                                                         */
/* ------------------------------------------------------------------ */

/** Where each application has got to, counted from the real list. */
export function WorkSummary({ counts }: { counts: { label: string; n: number; icon: string; tint: string; ink: string }[] }) {
  const tr = useT();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("workviews.yourWorkSummary")}</h2>
        <Link href="/app/applications" className="ux-sq flex items-center gap-0.5 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>{tr("workviews.viewAll")}<Icons.ArrowRight className="h-[13px] w-[13px]" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {counts.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5 rounded-[12px] border p-3"
               style={{ borderColor: v("--ux-line") }}>
            <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={32} radius={9} />
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-none" style={{ color: v("--ux-ink") }}>{c.n}</span>
              <span className="mt-1 block truncate text-2xs" style={{ color: v("--ux-muted") }}>{c.label}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The skills these listings actually ask for — counted, not guessed. */
export function SkillsInDemand({ skills }: { skills: string[] }) {
  const tr = useT();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("workviews.whatEmployersAreAskingFor")}</h2>
        <Link href="/app/programs" className="ux-sq text-xs font-bold" style={{ color: v("--ux-brand") }}>{tr("workviews.learnOne")}</Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <Link key={s} href={`/app/search?q=${encodeURIComponent(s)}`}
                className="ux-press ux-sq rounded-[10px] px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
            {s}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-2xs leading-relaxed" style={{ color: v("--ux-faint") }}>{tr("workviews.countedFromTheOpeningsOnThis")}</p>
    </Card>
  );
}

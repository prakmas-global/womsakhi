"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, v } from "@/components/ux/kit";
import { payLabel, type Job } from "@/components/ux/work/data";
import { matchFor, matchTone } from "@/services/job-match";
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
    <div className="ux-noscroll flex items-stretch gap-3 overflow-x-auto pb-1">
      {FAMILIES.map((f) => {
        const on = active === f.id;
        return (
          <button key={f.id} type="button" aria-pressed={on}
                  onClick={() => onPick(on ? null : f.id)}
                  className="ux-press ux-sq flex w-[196px] shrink-0 items-center gap-3 rounded-[14px] border p-3.5 text-start"
                  style={{
                    borderColor: v(on ? "--ux-brand" : "--ux-line"),
                    background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                  }}>
            <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={40} radius={11} />
            <span className="min-w-0">
              <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{f.label}</span>
              <span className="block truncate text-xs" style={{ color: v("--ux-muted") }}>{f.sub}</span>
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
 * The order is deliberate and it is not the order a job board usually uses.
 * Money and the match are on the right where the eye lands last but stays,
 * because they are the two things that decide whether she reads the rest. The
 * match percentage is honest: it comes from her skills against the listing's,
 * and `job-match.ts` computes it from what she HAS rather than what she lacks.
 *
 * Pay is shown per month, never as a "LPA" figure. A woman deciding whether to
 * take a stitching order does not convert annual salaries in her head, and the
 * whole listing set here is comparable only in monthly terms.
 */
export function JobCard({ job, saved, onSave }: {
  job: Job; saved: boolean; onSave: () => void;
}) {
  const tr = useT();
  // Computed from her skills against this listing's, not carried by the API —
  // which sends no score, so the card was printing a flat "0% match" on every
  // opening. `matchFor` returns null when there is nothing to compare, and the
  // badge is then not shown at all rather than shown as a zero.
  const match = matchFor(job.skills);
  const tone = matchTone(match.pct);
  return (
    <Card pad={18}>
      <div className="flex flex-wrap items-start gap-4">
        {/* Who is hiring */}
        <IconTile icon={job.icon} tint={job.logoTint} ink={job.logoInk} size={52} radius={14} />

        {/* What the work is */}
        <div className="min-w-[240px] flex-1">
          <h3 className="text-base font-bold leading-snug" style={{ color: v("--ux-ink") }}>
            {job.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xsm"
             style={{ color: v("--ux-muted") }}>
            <span className="font-semibold" style={{ color: v("--ux-ink-2") }}>{job.org}</span>
            <span aria-hidden>·</span>
            <span>{job.place}</span>
            <span aria-hidden>·</span>
            <span>{job.mode}</span>
            {job.verified && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold"
                    style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                <Icons.BadgeCheck className="h-[11px] w-[11px]" />{tr("workviews.theyPaidLastTime")}</span>
            )}
          </p>
          <p className="mt-2 max-w-[62ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {job.about}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 3).map((s) => (
              <span key={s} className="rounded-[7px] px-2 py-1 text-2xs font-semibold"
                    style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                {s}
              </span>
            ))}
            {job.skills.length > 3 && (
              <span className="rounded-[7px] px-2 py-1 text-2xs font-semibold"
                    style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                +{job.skills.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* What it pays, and how well it fits */}
        <div className="w-[172px] shrink-0">
          {/* Hidden at zero, not shown as "0%". `matchTone` says it plainly: a
              low score here measures how much she has written down, not what
              she can do, and a column of "0%" badges is a discouraging machine
              pointed at exactly the women this exists for. */}
          {match.pct !== null && match.pct > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold"
                  title={match.because}
                  style={{ background: v("--ux-surface-2"), color: v(tone.ink) }}>
              <Icons.BadgeCheck className="h-[12px] w-[12px]" />
              {match.pct}% · {tone.label}
            </span>
          )}
          <p className="mt-2 text-sm font-extrabold" style={{ color: v("--ux-ink") }}>
            {payLabel(job)}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-muted") }}>
            <Icons.Briefcase className="h-[12px] w-[12px]" /> {job.kind}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-faint") }}>
            <Icons.Clock className="h-[12px] w-[12px]" /> Posted {job.posted}
          </p>
        </div>

        {/* What she can do about it */}
        <div className="flex w-[140px] shrink-0 flex-col gap-2">
          <Btn size="sm" variant={saved ? "soft" : "outline"} icon="Bookmark" full onClick={onSave}>
            {saved ? "Saved" : "Save"}
          </Btn>
          <Btn size="sm" href={`/app/opportunities/${job.id}`} full iconEnd="ArrowRight">{tr("workviews.viewDetails")}</Btn>
        </div>
      </div>
    </Card>
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
                className="ux-press ux-sq rounded-[9px] px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
            {s}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-2xs leading-relaxed" style={{ color: v("--ux-faint") }}>{tr("workviews.countedFromTheOpeningsOnThis")}</p>
    </Card>
  );
}

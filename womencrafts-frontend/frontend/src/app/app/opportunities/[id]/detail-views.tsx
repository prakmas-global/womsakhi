"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Card, I, IconTile, v } from "@/components/ux/kit";
import { payLabel, type Job } from "@/components/ux/work/data";
import { matchTone, type Match } from "@/services/job-match";
import { useT } from "@/i18n";

/* ------------------------------------------------------------------ */
/*  How well it fits                                                   */
/* ------------------------------------------------------------------ */

/**
 * The fit, as a ring and three plain lines.
 *
 * Leads with what she HAS. The wireframe's "You're a great match!" is only
 * honest above a real threshold, so the heading follows the number rather than
 * cheering regardless — and at zero the whole card says the useful thing
 * instead, which is that this is a different line of work, not that she is
 * lacking.
 */
export function MatchCard({ fit, job }: { fit: Match; job: Job }) {
  const tr = useT();
  const tone = matchTone(fit.pct);
  const pct = fit.pct ?? 0;
  // 2πr for r=34
  const C = 213.6;

  return (
    <Card>
      <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
        {fit.pct === null ? "Nothing to compare yet"
          : pct >= 80 ? "You are a strong fit"
          : pct >= 50 ? "Worth a look"
          : pct > 0 ? tr("jobviews.someOfThisFitsYou")
              : tr("jobviews.thisIsDifferentWork")}
      </h2>

      <div className="mt-3 flex items-center gap-4">
        <span className="relative grid h-[80px] w-[80px] shrink-0 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7"
                    stroke={v("--ux-surface-2")} />
            {pct > 0 && (
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round"
                      stroke={v(tone.ink)}
                      strokeDasharray={`${(pct / 100) * C} ${C}`}
                      style={{ transition: "stroke-dasharray var(--ux-t-draw) var(--ux-ease-out)" }} />
            )}
          </svg>
          <span className="text-base font-extrabold" style={{ color: v(tone.ink) }}>
            {fit.pct === null ? "—" : `${pct}%`}
          </span>
        </span>

        <ul className="min-w-0 flex-1 space-y-1.5">
          <li className="flex items-start gap-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
            <Icons.Check className="mt-[2px] h-[13px] w-[13px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            <span>
              You have {fit.have.length} of {job.skills.length} skills they ask for
            </span>
          </li>
          {fit.have.slice(0, 2).map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-xs" style={{ color: v("--ux-muted") }}>
              <Icons.Check className="mt-[2px] h-[13px] w-[13px] shrink-0" style={{ color: v("--ux-green-ink") }} />
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {fit.because && (
        <p className="mt-3 rounded-[10px] p-2.5 text-xs leading-relaxed"
           style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          {fit.because}
        </p>
      )}

      {fit.missing.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
          Not needed to apply: {fit.missing.slice(0, 3).join(", ")}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  The facts, as a grid                                               */
/* ------------------------------------------------------------------ */

/**
 * Everything a listing states, in one block.
 *
 * Only fields the listing actually carries. The wireframe has a Deadline tile
 * and a Benefits section; this API has neither, and an empty "Deadline —"
 * would read as "apply whenever", which is worse than not asking.
 */
export function KeyDetails({ job }: { job: Job }) {
  const tiles = [
    { label: "Kind of work", value: job.kind,          icon: "Briefcase",    tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { label: "Where",        value: job.place,         icon: "MapPin",       tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
    { label: "How",          value: job.mode,          icon: "Laptop",       tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
    { label: "Pay",          value: payLabel(job),     icon: "IndianRupee",  tint: "--ux-tint-green",  ink: "--ux-green-ink" },
    { label: "Posted",       value: job.posted,        icon: "Clock",        tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
    ...(job.applicants
      ? [{ label: "Women applied", value: `${job.applicants}`, icon: "Users", tint: "--ux-surface-2", ink: "--ux-muted" }]
      : []),
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="flex items-start gap-3 rounded-[12px] border p-3.5"
             style={{ borderColor: v("--ux-line") }}>
          <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={34} radius={10} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.1em] lg:text-2xs"
                  style={{ color: v("--ux-faint") }}>{t.label}</span>
            <span className="mt-0.5 block text-xsm font-bold" style={{ color: v("--ux-ink") }}>{t.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A checked list                                                     */
/* ------------------------------------------------------------------ */

export function CheckList({ items, tint = "--ux-brand" }: { items: string[]; tint?: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-xsm leading-relaxed"
            style={{ color: v("--ux-ink-2") }}>
          <Icons.CheckCircle2 className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v(tint) }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Who this is open to                                                */
/* ------------------------------------------------------------------ */

/**
 * The three lines that decide whether she reads on.
 *
 * These are WomSakhi's own terms of listing rather than claims about the
 * employer — every opening here is open to women from any background, and the
 * platform is built around women returning to work. Saying so is honest;
 * attributing it to a company we have not asked would not be.
 */
export function WhoCanApply({ job }: { job: Job }) {
  const tr = useT();
  const rows = [
    { icon: "UsersRound", tint: "--ux-tint-pink",   ink: "--ux-pink-ink",
      text: "Women from every background are encouraged to apply" },
    { icon: "Undo2",      tint: "--ux-tint-blue",   ink: "--ux-blue-ink",
      text: "Open to women coming back after a break" },
    ...(job.mode !== "On-site"
      ? [{ icon: "Home", tint: "--ux-tint-green", ink: "--ux-green-ink",
           text: `Can be done ${job.mode === "Remote" ? tr("jobviews.fromHome")
              : tr("jobviews.partlyFromHome")}` }]
      : []),
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.text} className="flex items-start gap-3 rounded-[12px] p-3.5"
             style={{ background: v("--ux-surface-2") }}>
          <IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={32} radius={9} />
          <p className="text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>{r.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Similar openings                                                   */
/* ------------------------------------------------------------------ */

export function SimilarJobs({ jobs }: { jobs: Job[] }) {
  const tr = useT();
  if (!jobs.length) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("jobviews.similarOpenings")}</h2>
        <Link href="/app/opportunities" className="ux-sq text-xs font-bold" style={{ color: v("--ux-brand") }}>{tr("jobviews.seeAll")}</Link>
      </div>
      <div className="space-y-1">
        {jobs.map((j) => (
          <Link key={j.id} href={`/app/opportunities/${j.id}`}
                className="ux-hov ux-sq -mx-2 flex items-start gap-3 rounded-[10px] px-2 py-2.5">
            <IconTile icon={j.icon} tint={j.logoTint} ink={j.logoInk} size={34} radius={10} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs" style={{ color: v("--ux-muted") }}>{j.org}</span>
              <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{j.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] lg:text-2xs" style={{ color: v("--ux-faint") }}>
                <span className="inline-flex items-center gap-1">
                  <Icons.MapPin className="h-[10px] w-[10px]" />{j.place}
                </span>
                <span>{payLabel(j)}</span>
              </span>
            </span>
            <Icons.ChevronRight className="mt-1 h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-faint") }} />
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

export function Block({ icon, title, tint, ink, children }: {
  icon: string; title: string; tint: string; ink: string; children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-extrabold tracking-[-0.01em]"
          style={{ color: v("--ux-ink") }}>
        <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
              style={{ background: v(tint) }}>
          <I name={icon} className="h-[16px] w-[16px]" style={{ color: v(ink) }} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

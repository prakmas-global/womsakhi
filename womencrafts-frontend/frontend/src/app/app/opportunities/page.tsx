"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, I, SourceNote, v } from "@/components/ux/kit";
import { useApplications, useJobs } from "@/components/ux/growth";
import { KINDS, MODES } from "@/components/ux/work/data";
import { useT } from "@/i18n";

import { FAMILIES, FamilyStrip, JobCard, SkillsInDemand, WorkSummary, type FamilyId } from "./work-views";

/** The lists across the top. Each is a real subset, never a mood. */
const TABS = [
  { id: "all",        label: "Opportunities" },
  { id: "Freelance",  label: "Freelance" },
  { id: "Internship", label: "Internships" },
  { id: "Order",      label: "Orders" },
  { id: "remote",     label: "Work from home" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SORTS = [
  { id: "match",  label: "Best match for you" },
  { id: "new",    label: "Newest first" },
  { id: "pay",    label: "Pays most" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

/**
 * Find work — the list that was missing.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * This route rendered an EARNINGS LEDGER — four ways to read money she has
 * already made — under a nav label reading "Find work · Jobs, orders and
 * freelance". Meanwhile `/app/opportunities/[id]` existed, fetched real
 * listings, and **nothing anywhere linked to it**. The Work section's front
 * door showed her last month's income and there was no way to reach a job.
 *
 * Everything the ledger did is already in Earn — `/app/money`, `/app/wallet`,
 * `/app/books` — so this is not a feature removed, it is one put back where a
 * woman would look for it.
 *
 * ── Why pay is monthly, never "LPA" ─────────────────────────────────────────
 * A woman weighing a stitching order against a support role does not convert
 * annual salaries in her head, and half these listings have no annual figure to
 * convert. Monthly is the only unit in which the whole list is comparable.
 *
 * ── Why the match percentage is safe to show ────────────────────────────────
 * It is computed from her skills against the listing's, and it leads with what
 * she HAS. A score that mostly told her what she lacked would be a discouraging
 * machine pointed at exactly the women this app exists for.
 */
export default function FindWorkPage() {
  const tr = useT();
  const { data: jobs, source } = useJobs();
  const { data: apps } = useApplications();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [family, setFamily] = useState<FamilyId | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [sort, setSort] = useState<SortId>("match");
  const [saved, setSaved] = useState<string[]>([]);

  const save = useCallback((id: string) => {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = jobs.filter((j) => {
      if (tab === "remote" ? j.mode !== "Remote" : tab !== "all" && j.kind !== tab) return false;
      if (family === "Remote" && j.mode !== "Remote") return false;
      if (family === "Freelance" && j.kind !== "Freelance") return false;
      if (family === "Internship" && j.kind !== "Internship") return false;
      if (family === "Full-time" && j.kind !== "Job") return false;
      if (family === "Part-time" && j.kind === "Job") return false;
      if (mode && j.mode !== mode) return false;
      if (kind && j.kind !== kind) return false;
      if (!words.length) return true;
      const hay = `${j.title} ${j.org} ${j.place} ${j.skills.join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return [...list].sort((a, b) =>
      sort === "new" ? a.postedDays - b.postedDays
      : sort === "pay" ? b.payHigh - a.payHigh
      : b.match - a.match);
  }, [jobs, q, tab, family, mode, kind, sort]);

  /** Counted off her real applications — never a fixed set of numbers. */
  const counts = useMemo(() => {
    const at = (s: string) => apps.filter((a) => a.stage === s).length;
    return [
      { label: "Applied",     n: apps.length,      icon: "Send",        tint: "--ux-tint-green",  ink: "--ux-green-ink" },
      { label: "Shortlisted", n: at("Shortlisted"), icon: "BadgeCheck", tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
      { label: "Interviews",  n: at("Interview"),   icon: "Video",      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
      { label: "Offers",      n: at("Offer"),       icon: "Gift",       tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
    ];
  }, [apps]);

  /** The skills these openings actually ask for, most common first. */
  const skills = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of jobs) for (const s of j.skills) n.set(s, (n.get(s) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  }, [jobs]);

  const clear = q || family || mode || kind || tab !== "all";

  return (
    <HomeShell
      active="/app/opportunities"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
                    style={{ background: v("--ux-brand-tint-2") }}>
                <Icons.Target className="h-[18px] w-[18px]" style={{ color: v("--ux-brand") }} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("findwork.yourNextStep")}</h2>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("findwork.addTheSkillsYouAlreadyHave")}</p>
              </div>
            </div>
            <div className="mt-3">
              <Btn href="/app/profile" size="sm" variant="outline" full iconEnd="ArrowRight">{tr("findwork.addMySkills")}</Btn>
            </div>
          </Card>

          <WorkSummary counts={counts} />
          <SkillsInDemand skills={skills} />

          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/scene-woman-reading-document.webp" alt="" loading="lazy" decoding="async"
                 aria-hidden
                 className="ux-float pointer-events-none absolute -bottom-2 -end-3 h-[104px] w-[104px] object-contain" />
            <h3 className="relative text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("findwork.aProfileTheyCanRead")}</h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("findwork.employersOpenAFilledInProfile")}</p>
            <div className="relative mt-3">
              <Btn href="/app/profile" size="sm" iconEnd="ArrowRight">{tr("findwork.buildMyProfile")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">

        {/* ── Hero: the promise, and the search ─────────────────────────── */}
        <div className="relative overflow-hidden rounded-[18px] p-6 sm:p-7"
             style={{ background: "linear-gradient(120deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-woman-with-trolley-bag.webp" alt="" loading="lazy" decoding="async"
               aria-hidden
               className="pointer-events-none absolute -bottom-4 end-4 hidden h-[210px] w-[210px] object-contain lg:block" />

          <div className="relative max-w-[62%]">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Work
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-[1.15] tracking-[-0.02em]"
                style={{ color: v("--ux-ink") }}>{tr("findwork.findWorkThatFits")}<span style={{ color: v("--ux-brand") }}>your life</span>
            </h1>
            <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("findwork.jobsOrdersFreelanceAndInternshipsF")}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-[12px] border px-3.5"
                   style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
                <Icons.Search className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tr("findwork.searchWorkSkillsPlaces")}
                  aria-label={tr("findwork.searchWork")}
                  className="min-h-[46px] w-full bg-transparent text-xsm outline-none"
                  style={{ color: v("--ux-ink") }}
                />
              </div>
            </div>

            {/* Filters that narrow a real field, not decorative dropdowns. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {MODES.map((m) => {
                const on = mode === m;
                return (
                  <button key={m} type="button" aria-pressed={on}
                          onClick={() => setMode(on ? null : m)}
                          className="ux-press ux-sq flex min-h-[34px] items-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold"
                          style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"),
                                   background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                   color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                    <Icons.MapPin className="h-[13px] w-[13px]" /> {m}
                  </button>
                );
              })}
              {KINDS.map((k) => {
                const on = kind === k;
                return (
                  <button key={k} type="button" aria-pressed={on}
                          onClick={() => setKind(on ? null : k)}
                          className="ux-press ux-sq flex min-h-[34px] items-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold"
                          style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"),
                                   background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                   color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                    <Icons.Briefcase className="h-[13px] w-[13px]" /> {k}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── The kinds of work ─────────────────────────────────────────── */}
        <FamilyStrip active={family} onPick={setFamily} />

        {/* ── Tabs and sort ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b"
             style={{ borderColor: v("--ux-line") }}>
          <div className="ux-noscroll flex items-center gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={on}
                        className="ux-press ux-sq shrink-0 border-b-2 px-3.5 pb-2.5 pt-1 text-xsm font-bold"
                        style={{ borderColor: on ? v("--ux-brand") : "transparent",
                                 color: v(on ? "--ux-brand" : "--ux-muted") }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <label className="flex shrink-0 items-center gap-2 pb-2 text-xs" style={{ color: v("--ux-muted") }}>{tr("findwork.sortBy")}<select value={sort} onChange={(e) => setSort(e.target.value as SortId)}
                    className="ux-sq rounded-[9px] border px-2 py-1.5 text-xs font-bold"
                    style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>
            {shown.length} {shown.length === 1 ? "opening" : "openings"} open to you
          </p>
          {clear && (
            <Btn size="sm" variant="ghost" onClick={() => {
              setQ(""); setTab("all"); setFamily(null); setMode(null); setKind(null);
            }}>{tr("findwork.clearFilters")}</Btn>
          )}
        </div>
        <SourceNote source={source} what={tr("findwork.theseOpenings")} />

        {/* ── The openings ──────────────────────────────────────────────── */}
        {shown.length ? (
          <div className="flex flex-col gap-3">
            {shown.map((j) => (
              <JobCard key={j.id} job={j} saved={saved.includes(j.id)} onSave={() => save(j.id)} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="SearchX" title={tr("findwork.nothingMatchesThatYet")}
                        body="Try a wider filter, or look at what women near you moved into — that is where most work here actually comes from."
                        action={<Btn size="sm" variant="outline" onClick={() => {
                          setQ(""); setTab("all"); setFamily(null); setMode(null); setKind(null);
                        }}>{tr("findwork.clearFilters2")}</Btn>} />
          </Card>
        )}

        {/* ── When she does not know what to look for ───────────────────── */}
        <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[16px] p-5"
             style={{ background: v("--ux-brand-tint") }}>
          <I name="Sparkles" className="h-[22px] w-[22px] shrink-0" style={{ color: v("--ux-brand") }} />
          <div className="min-w-[240px] flex-1">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("findwork.notSureWhatKindOfWork")}</p>
            <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("findwork.tellSakhiWhatYouCanDo")}</p>
          </div>
          <Btn href="/app/sakhi" icon="Sparkles" iconEnd="ArrowRight">{tr("findwork.askSakhi")}</Btn>
        </div>
      </div>
    </HomeShell>
  );
}

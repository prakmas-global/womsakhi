"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow } from "@/components/ux/work/native";
import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, ScreenSkeleton, v } from "@/components/ux/kit";
import { useApplications, useJobsFor } from "@/components/ux/growth";
import { apiToggleSaveOpportunity } from "@/lib/growth-api";
import { apiMyWorkProfile, apiWorkTaxonomy, type WorkCategory, type WorkProfile } from "@/lib/work-api";
import { useResource } from "@/lib/use-resource";
import { Select } from "@/components/ux/kit/form";
import type { Job } from "@/components/ux/work/data";

import { JobCard, WorkSummary } from "./work-views";
import { MediaGrid } from "@/components/ux/media/MediaCard";

/**
 * Find work.
 *
 * ── One of each control ──────────────────────────────────────────────────────
 * This screen used to carry three rows that all filtered by kind and place —
 * chips in the hero, a "Remote / Part-time / Full-time / Freelance /
 * Internship" strip, and a tab row — and they disagreed: "Part-time" meant
 * "anything that is not a Job" (there is no part-time field), and the Orders
 * tab compared against "Order" while the server stores "Craft order", so it was
 * always empty. Search filtered only the list already on screen, so in "For my
 * skills" it searched two jobs and looked broken.
 *
 * Now there is one search box, one row of views, and one set of filters, and
 * every one of them is a query to the server (`GET /growth/opportunities`):
 *
 *   view     For my skills (for_me) · All work · Saved (saved)
 *   search   q — title, employer, skills, place, description; always across
 *            all open work, because that is what a search box means
 *   filters  kind of work + skills (the work masters), type, where
 *   sort     best match · newest · pays most (monthly figures, client-side)
 *
 * Expired listings are left out by the server, so nothing here hides rows.
 */

const TYPES = [
  { id: "", label: "Any type" },
  { id: "Job", label: "Job" },
  { id: "Freelance", label: "Freelance" },
  { id: "Craft order", label: "Order to make" },
  { id: "Internship", label: "Internship" },
  { id: "Training", label: "Training" },
] as const;

const WHERE = [
  { id: "", label: "Anywhere" },
  { id: "On-site", label: "At their place" },
  { id: "Remote", label: "From home" },
  { id: "Hybrid", label: "Both" },
] as const;

const SORTS = [
  { value: "match", label: "Best match for me" },
  { value: "new", label: "Newest first" },
  { value: "pay", label: "Pays most" },
];

type View = "mine" | "all" | "saved";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
            className="ux-press ux-sq flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold lg:min-h-[34px] lg:text-xs"
            style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"),
                     background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                     color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
      {on && <Icons.Check className="h-[12px] w-[12px]" />}{children}
    </button>
  );
}

export default function FindWorkPage() {
  const [view, setView] = useState<View>("mine");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [cat, setCat] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [where, setWhere] = useState("");
  const [sort, setSort] = useState("match");

  // Search as she types, without a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setQd(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  // A search is across ALL open work — searching inside "for my skills" is
  // what made the box look broken.
  const searching = qd.length > 0;
  const scope: View = searching && view === "mine" ? "all" : view;

  const { data: jobs, source, refetch } = useJobsFor({
    q: qd || undefined,
    for_me: scope === "mine" || undefined,
    saved: scope === "saved" || undefined,
    kind: type || undefined,
    mode: where || undefined,
    category: scope === "all" && cat ? cat : undefined,
    skills: scope === "all" && picked.length ? picked : undefined,
  });
  const { data: apps } = useApplications();
  const tax = useResource(useCallback((s: AbortSignal) => apiWorkTaxonomy(s), []), [] as WorkCategory[]);
  const profile = useResource(
    useCallback((s: AbortSignal) => apiMyWorkProfile(s).catch(() => null), []), null as WorkProfile | null);
  const mySkills = profile.data?.skills ?? [];
  const category = tax.data.find((c) => c.key === cat);

  // Bookmarks: the server's answer, with her taps since this list loaded on top.
  const [flips, setFlips] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedOf = useCallback((j: Job) => flips[j.id] ?? Boolean(j.saved), [flips]);
  const save = useCallback(async (j: Job, now: boolean) => {
    setFlips((f) => ({ ...f, [j.id]: !now }));
    setSaveError(null);
    try {
      await apiToggleSaveOpportunity(j.id);
      if (scope === "saved") refetch();
    } catch {
      setFlips((f) => ({ ...f, [j.id]: now }));
      setSaveError("That did not save. Nothing has changed — try again in a moment.");
    }
  }, [scope, refetch]);

  const shown = useMemo(() => {
    const open = jobs.filter((j) => !j.closed);
    if (sort === "pay") return [...open].sort((a, b) => b.payHigh - a.payHigh);
    if (sort === "match") return [...open].sort((a, b) => b.match - a.match);
    return open; // the server sends newest first
  }, [jobs, sort]);

  const counts = useMemo(() => {
    const at = (s: string) => apps.filter((a) => a.stage === s).length;
    return [
      { label: "Applied",     n: apps.length,       icon: "Send",       tint: "--ux-tint-green",  ink: "--ux-green-ink" },
      { label: "Shortlisted", n: at("Shortlisted"), icon: "BadgeCheck", tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
      { label: "Interviews",  n: at("Interview"),   icon: "Video",      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
      { label: "Offers",      n: at("Offer"),       icon: "Gift",       tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
    ];
  }, [apps]);

  // What open work is asking for — tap one to search for it.
  const inDemand = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of jobs) for (const s of j.skills) n.set(s, (n.get(s) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  }, [jobs]);

  const filtersOn = Boolean(type || where || cat || picked.length);

  // Nothing fits her skills yet: show everything rather than an empty page,
  // once, and say why. (Adjusted during render, not in an effect.)
  const [autoAll, setAutoAll] = useState(false);
  if (!autoAll && view === "mine" && !searching && !filtersOn && source === "live" && jobs.length === 0 && mySkills.length > 0) {
    setAutoAll(true);
    setView("all");
  }
  const clearAll = () => { setQ(""); setQd(""); setType(""); setWhere(""); setCat(""); setPicked([]); };

  const heading = searching ? `Results for “${qd}”`
    : scope === "mine" ? "Work that needs your skills"
    : scope === "saved" ? "Saved for later" : category ? category.name : "All open work";

  return (
    <HomeShell
      active="/app/opportunities"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>My skills</h2>
              <Btn href="/app/work/profile" size="sm" variant="ghost" iconEnd="ArrowRight">Edit</Btn>
            </div>
            {mySkills.length ? (
              <>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {mySkills.slice(0, 8).map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                          style={{ background: v(s.visible ? "--ux-brand-tint" : "--ux-surface-2"),
                                   color: v(s.visible ? "--ux-brand" : "--ux-muted") }}>
                      {s.verified && <Icons.BadgeCheck className="h-[11px] w-[11px]" />}{s.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                  &ldquo;For my skills&rdquo; uses all of these. Pink ones can also be found by people hiring.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                  Add what you can do and this page shows the work that needs it.
                </p>
                <div className="mt-3"><Btn href="/app/work/profile" size="sm" variant="primary" full iconEnd="ArrowRight">Add my skills</Btn></div>
              </>
            )}
          </Card>

          <WorkSummary counts={counts} />

          {inDemand.length > 0 && (
            <Card>
              <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Asked for most</h2>
              <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>In the work listed here. Tap to search.</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {inDemand.map((s) => (
                  <button key={s} type="button" onClick={() => setQ(s)}
                          className="ux-press rounded-full px-2.5 py-1 text-2xs font-semibold"
                          style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>{s}</button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Hiring?</h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              Post the work and women with those skills are told. You choose whom to talk to.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn href="/app/work/post" size="sm" icon="Plus">Post a job</Btn>
              <Btn href="/app/work/find" size="sm" variant="outline">Find people</Btn>
            </div>
          </Card>
        </div>
      }
    >
      {/* ── Header and search ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[20px] p-5 lg:p-7"
               style={{ background: "linear-gradient(120deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
        <span aria-hidden className="ux-frame pointer-events-none absolute bottom-5 end-5 hidden h-[150px] w-[150px] overflow-hidden rounded-[18px] xl:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-woman-at-laptop-thinking.webp" alt="" width={540} height={540} loading="lazy" decoding="async"
               className="h-full w-full object-cover" />
        </span>
        <div className="relative xl:max-w-[70%]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="ux-screen-title text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] lg:text-3xl" style={{ color: v("--ux-ink") }}>
                Find work that fits <span style={{ color: v("--ux-brand") }}>your life</span>
              </h1>
              <p className="mt-1.5 text-[15px] leading-snug lg:text-sm" style={{ color: v("--ux-muted") }}>
                Jobs, orders to make, freelance work and training — from the WomSakhi team and from members who are hiring.
              </p>
            </div>
            <Btn href="/app/work/post" icon="Plus" size="sm" className="xl:hidden">Post a job</Btn>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-[14px] border px-4 shadow-sm"
               style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
            <Icons.Search className="h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-muted") }} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
                   placeholder="Search work — tailoring, data entry, Hyderabad…" aria-label="Search work"
                   className="min-h-[52px] w-full bg-transparent text-[16px] outline-none [&::-webkit-search-cancel-button]:hidden lg:text-sm"
                   style={{ color: v("--ux-ink") }} />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search"
                      className="grid h-8 w-8 place-items-center rounded-full" style={{ color: v("--ux-muted") }}>
                <Icons.X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div role="tablist" aria-label="Which work" className="mt-3 inline-flex rounded-[12px] border p-1"
               style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
            {([["mine", "For my skills"], ["all", "All work"], ["saved", "Saved"]] as const).map(([id, label]) => {
              const on = scope === id;
              return (
                <button key={id} type="button" role="tab" aria-selected={on} onClick={() => { setView(id); if (id !== "all") setQ(""); }}
                        className="ux-press ux-sq min-h-[38px] rounded-[9px] px-3.5 text-xsm font-bold"
                        style={{ background: v(on ? "--ux-brand-tint" : "--ux-surface"), color: v(on ? "--ux-brand" : "--ux-muted") }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card className="mt-[16px]" pad={16}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
          {scope === "all" ? (
            <Select value={cat} onChange={(c) => { setCat(c); setPicked([]); }} label="Kind of work"
                    placeholder="Every kind of work" options={tax.data.map((c) => ({ value: c.key, label: c.name }))} />
          ) : (
            <p className="self-center text-xs" style={{ color: v("--ux-muted") }}>
              {scope === "mine" ? "Showing work that needs a skill on My work profile." : "Openings you bookmarked."}
              {" "}<button type="button" className="font-bold underline" style={{ color: v("--ux-brand") }} onClick={() => setView("all")}>Browse all work</button>
            </p>
          )}
          <Select value={sort} onChange={setSort} label="Sort" options={SORTS} />
        </div>
        {scope === "all" && category && (
          <ChipRow className="mt-3" pad={16}>
            {category.skills.map((sk) => (
              <Chip key={sk.key} on={picked.includes(sk.key)}
                    onClick={() => setPicked(picked.includes(sk.key) ? picked.filter((k) => k !== sk.key) : [...picked, sk.key])}>
                {sk.name}
              </Chip>
            ))}
          </ChipRow>
        )}
        <ChipRow className="mt-3" pad={16}>
          {TYPES.map((t) => <Chip key={t.id || "any"} on={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}
        </ChipRow>
        <ChipRow className="mt-2" pad={16}>
          {WHERE.map((w) => <Chip key={w.id || "any"} on={where === w.id} onClick={() => setWhere(w.id)}>{w.label}</Chip>)}
        </ChipRow>
      </Card>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <div className="mt-[16px] mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>{heading}</h2>
          {autoAll && scope === "all" && !searching && (
            <p className="mb-1 text-xs font-semibold" style={{ color: v("--ux-brand") }}>
              No open work needs your skills yet — showing all open work.
            </p>
          )}
          <p className="text-xs" style={{ color: v("--ux-muted") }}>
            {source === "loading" ? "Looking…" : `${shown.length} ${shown.length === 1 ? "opening" : "openings"} open now`}
            {searching && view === "mine" ? " · searching all work, not only your skills" : ""}
          </p>
        </div>
        {(filtersOn || q) && <Btn size="sm" variant="ghost" icon="X" onClick={clearAll}>Clear all</Btn>}
      </div>

      {saveError && (
        <p role="alert" className="mb-3 rounded-[12px] px-4 py-3 text-xsm font-semibold"
           style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>{saveError}</p>
      )}

      {source === "loading" && !jobs.length ? (
        <ScreenSkeleton shape="list" />
      ) : source === "error" ? (
        <Card><EmptyState icon="WifiOff" title="Work could not load" body="Check your connection and try again."
                          action={<Btn size="sm" onClick={refetch}>Try again</Btn>} /></Card>
      ) : shown.length ? (
        <MediaGrid cols={2}>
          {shown.map((j) => {
            const on = savedOf(j);
            return <JobCard key={j.id} job={j} saved={on} onSave={() => save(j, on)} />;
          })}
        </MediaGrid>
      ) : (
        <Card>
          {scope === "mine" && !mySkills.length ? (
            <EmptyState icon="IdCard" title="Add your skills to see work that fits you"
                        body="Pick what you can do on My work profile — it takes a minute, and this list fills with work that needs it."
                        action={<Btn size="sm" variant="primary" href="/app/work/profile" iconEnd="ArrowRight">Add my skills</Btn>} />
          ) : scope === "mine" && !filtersOn ? (
            <EmptyState icon="SearchX" title="No open work needs your skills right now"
                        body="New work is posted all the time — we tell you when something fits. Meanwhile, look at everything."
                        action={<Btn size="sm" variant="outline" onClick={() => setView("all")}>See all work</Btn>} />
          ) : scope === "saved" && !filtersOn ? (
            <EmptyState icon="Bookmark" title="Nothing saved yet"
                        body="Tap Save on any opening to keep it here for later."
                        action={<Btn size="sm" variant="outline" onClick={() => setView("all")}>Browse all work</Btn>} />
          ) : (
            <EmptyState icon="SearchX" title={searching ? `Nothing matches “${qd}”` : "Nothing matches these filters"}
                        body="Try fewer filters, or a shorter word — a skill, a town, or a kind of work."
                        action={<Btn size="sm" variant="outline" onClick={clearAll}>Clear all</Btn>} />
          )}
        </Card>
      )}
    </HomeShell>
  );
}

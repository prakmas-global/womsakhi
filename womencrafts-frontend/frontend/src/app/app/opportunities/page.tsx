"use client";

import { useState } from "react";

import { apiToggleSaveOpportunity } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "lucide-react";

import {
  Btn, Card, Chip, EmptyState, SectionHead,
  SourceNote, Tabs, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { JobRow, RailStat } from "@/components/ux/work/parts";
import {
  KINDS, MODES, WORK_ART, money, type WorkKind, type WorkMode,
} from "@/components/ux/work/data";
import { useApplications, useJobs, workStats } from "@/components/ux/growth";

type Sort = "Best match" | "Newest" | "Highest pay";

/**
 * Work she can actually apply for.
 *
 * The filters narrow one list rather than fetching a new one, so the counts
 * beside each filter and the rows below them come from the same pass and can
 * never disagree. Sorting is separate from filtering for the same reason —
 * changing the order should never change what is in the list.
 */
export default function Opportunities() {
  const { data: JOBS, source, refetch } = useJobs();
  // Counted from her own applications, not from a fixture: "12 applied" beside
  // a list of three is the sort of small lie that makes her stop trusting the
  // numbers on the money screens too.
  const { data: APPLICATIONS } = useApplications();
  const SKILL_DEMAND = Object.entries(
    JOBS.flatMap((j) => j.skills).reduce<Record<string, number>>(
      (a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, n]) => ({ name, jobs: n }));
  const [tab, setTab] = useState("All work");
  const [kinds, setKinds] = useState<WorkKind[]>([]);
  const [modes, setModes] = useState<WorkMode[]>([]);
  const [minPay, setMinPay] = useState(0);
  const [sort, setSort] = useState<Sort>("Best match");
  /**
   * Saved listings, as the server has them — with presses still in flight
   * allowed to show through.
   *
   * This was a local `string[]` starting empty, so the Saved tab was empty on
   * every visit no matter what she had bookmarked, and the bookmark button
   * only ever changed the icon.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isSaved = (j: { id: string; saved?: boolean }) => pending[j.id] ?? j.saved ?? false;

  const WORK_STATS = workStats(APPLICATIONS, JOBS.filter(isSaved).length);

  const bookmark = useAction(
    async (id: string) => { await apiToggleSaveOpportunity(id); },
    {
      onDone: refetch,
      optimistic: (id) => setPending((p) => ({ ...p, [id]: !(p[id] ?? JOBS.find((j) => j.id === id)?.saved ?? false) })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "Could not save it just now.",
    },
  );

  const toggle = <T,>(v: T, list: T[], set: (n: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // No `useMemo`. The compiler memoizes this component, and a hand-written
  // memo it cannot prove — this one reads `pending`, which an optimistic save
  // rewrites — makes it skip the whole component. The hand-rolled version was
  // also missing `JOBS` from its deps, so the list showed the mock fallback
  // for the whole session.
  const shown = (() => {
    const out = JOBS.filter((j) => {
      if (tab === "Saved" && !isSaved(j)) return false;
      if (tab === "Near me" && j.mode === "Remote") return false;
      if (tab === "Work from home" && j.mode !== "Remote") return false;
      if (kinds.length && !kinds.includes(j.kind)) return false;
      if (modes.length && !modes.includes(j.mode)) return false;
      if (j.payHigh < minPay) return false;
      return true;
    });
    const by: Record<Sort, (a: typeof out[number], b: typeof out[number]) => number> = {
      "Best match": (a, b) => b.match - a.match,
      "Newest": (a, b) => a.postedDays - b.postedDays,
      "Highest pay": (a, b) => b.payHigh - a.payHigh,
    };
    return [...out].sort(by[sort]);
  })();

  const activeFilters = kinds.length + modes.length + (minPay > 0 ? 1 : 0);

  return (
    <HomeShell
      active="/app/opportunities"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="How you are doing" sub="Across everything you have applied to" />
            <div className="space-y-3.5">
              <RailStat value={WORK_STATS.applied} label="Applications sent" icon="Send"
                        tint="--ux-tint-violet" ink="--ux-violet" />
              <RailStat value={WORK_STATS.shortlisted} label="Shortlisted" icon="ListChecks"
                        tint="--ux-tint-blue" ink="--ux-blue" />
              <RailStat value={WORK_STATS.interviews} label="Interviews" icon="MessageSquare"
                        tint="--ux-tint-green" ink="--ux-green" />
            </div>
            <div className="mt-4 rounded-[11px] p-3" style={{ background: "var(--ux-surface-2)" }}>
              <p className="text-[12px]" style={{ color: "var(--ux-ink-2)" }}>
                {/* No "usually within three days": the server records when she
                    applied, not when anyone replied, so there is no honest
                    average to put there. */}
                <strong style={{ color: "var(--ux-ink)" }}>{WORK_STATS.responseRate}%</strong> of your{" "}
                {WORK_STATS.applied === 1 ? "application has" : `${WORK_STATS.applied} applications have`} had a reply.
              </p>
            </div>
            <div className="mt-3">
              <Btn href="/app/applications" variant="soft" full iconEnd="ArrowRight">Track applications</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="What is being hired for" sub="In and around Jaipur, this month" />
            <ul className="ux-stagger space-y-2.5">
              {SKILL_DEMAND.map((s) => (
                <li key={s.name} className="flex items-center gap-2.5">
                  {/* How many listings ask for it, not a trend: a trend needs
                      last month's figures, which nothing is keeping yet. */}
                  <Icons.Briefcase className="h-[15px] w-[15px] shrink-0"
                                   style={{ color: "var(--ux-brand)" }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--ux-muted)" }}>
                    {s.jobs} {plural("role", s.jobs)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* This card used to say "Set an alert — we will message you the day
              something matching turns up", above an ActionBtn with no action
              at all: it announced "Alert set" and nothing anywhere had been
              set. Nothing in this app watches for new listings on her behalf,
              so the card now points at the one thing that does keep — the
              bookmark, which is a real write and survives the session. */}
          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-blue))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WORK_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[104px] w-[104px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Keep what you like
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Tap the bookmark on any opening and it waits in Saved — on this phone or the next one.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn variant="soft" size="sm" icon="Bookmark" onClick={() => setTab("Saved")}>
                Your saved work
              </Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Work &amp; Opportunities</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {shown.length} {plural("opening", shown.length)} you can apply for today.
            {activeFilters > 0 && ` ${activeFilters} ${plural("filter", activeFilters)} applied.`}
          </p>

      <SourceNote source={source} what="listings" />
      {bookmark.error && (
        <p role="alert" className="ux-slide-up mt-2 text-[12.5px] leading-relaxed"
           style={{ color: "var(--ux-orange-ink)" }}>
          {bookmark.error}
        </p>
      )}
        </div>
        <Tabs items={["All work", "Near me", "Work from home", "Saved"]} active={tab} onChange={setTab} />
      </div>

      <Card className="mb-[15px] ux-onscroll-soft" pad={14}>
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <Chip key={k} selected={kinds.includes(k)} onClick={() => toggle(k, kinds, setKinds)}>{k}</Chip>
          ))}
          <span className="mx-1 h-6 w-px" style={{ background: "var(--ux-line)" }} />
          {MODES.map((m) => (
            <Chip key={m} selected={modes.includes(m)} onClick={() => toggle(m, modes, setModes)}>{m}</Chip>
          ))}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-4 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
          <label className="flex min-w-[280px] flex-1 items-center gap-3">
            <span className="shrink-0 text-[12px]" style={{ color: "var(--ux-muted)" }}>Pays at least</span>
            <input
              type="range" min={0} max={50000} step={1000} value={minPay}
              onChange={(e) => setMinPay(Number(e.target.value))}
              className="ux-range min-w-0 flex-1"
              aria-label="Minimum monthly pay"
            />
            <span className="w-[76px] shrink-0 text-end text-[12px] font-semibold tabular-nums"
                  style={{ color: minPay ? "var(--ux-brand)" : "var(--ux-faint)" }}>
              {minPay ? money(minPay) : "Any"}
            </span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--ux-muted)" }}>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort openings"
              className="ux-sq h-[34px] rounded-[10px] border px-2.5 text-[12.5px]"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            >
              <option>Best match</option>
              <option>Newest</option>
              <option>Highest pay</option>
            </select>
          </div>

          {activeFilters > 0 && (
            <Btn variant="ghost" size="sm" icon="X"
                 onClick={() => { setKinds([]); setModes([]); setMinPay(0); }}>
              Clear
            </Btn>
          )}
        </div>
      </Card>

      {shown.length ? (
        <div className="ux-deck space-y-[13px]">
          {shown.map((j, i) => (
            <JobRow key={j.id} job={j} i={i} saved={isSaved(j)}
                    onSave={(id) => void bookmark.run(id)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="SearchX"
            title={tab === "Saved" ? "Nothing saved yet" : "Nothing matches those filters"}
            body={
              tab === "Saved"
                ? "Tap the bookmark on any opening and it will wait for you here."
                : "Loosen one of them — the pay floor is usually the one doing it."
            }
            action={
              tab === "Saved"
                ? <Btn onClick={() => setTab("All work")} variant="soft">Browse all work</Btn>
                : <Btn onClick={() => { setKinds([]); setModes([]); setMinPay(0); }} variant="soft">Clear filters</Btn>
            }
          />
        </Card>
      )}
    </HomeShell>
  );
}

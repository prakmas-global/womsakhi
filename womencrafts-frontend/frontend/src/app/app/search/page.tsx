"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, Chip, EmptyState, IconTile, SectionHead,
  SourceNote, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { SEARCH_KINDS, SEARCH_SUGGESTED, type SearchHit } from "@/components/ux/home/data";
import { useSearch } from "@/components/ux/growth";
import { useT } from "@/i18n";

/**
 * Search results.
 *
 * The query lives in the URL, so a result page can be shared, bookmarked and
 * reached with the back button. Filtering by kind narrows what is already
 * matched rather than re-running the search — the counts beside each filter
 * come from the same pass, so they can never disagree with the list.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={<HomeShell active="/app/explore"><Card>Loading…</Card></HomeShell>}>
      <Results />
    </Suspense>
  );
}

function Results() {
  const tr = useT();
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [kind, setKind] = useState<string>("All");

  // Searched on the server across nine collections, not filtered over a
  // fixture that shipped with the app weeks ago.
  const { data: all, source } = useSearch(q);
  const counts = useMemo(() => {
    const m: Record<string, number> = { All: all.length };
    for (const h of all) m[h.kind] = (m[h.kind] ?? 0) + 1;
    return m;
  }, [all]);
  const shown = kind === "All" ? all : all.filter((h) => h.kind === kind);

  return (
    <HomeShell
      active="/app/explore"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("search.refineByKind")} />
            <div className="space-y-1">
              {SEARCH_KINDS.filter((k) => k === "All" || counts[k]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-xsm transition-colors"
                  style={{
                    background: kind === k ? "var(--ux-brand-tint)" : "transparent",
                    color: kind === k ? "var(--ux-brand)" : "var(--ux-ink-2)",
                    fontWeight: kind === k ? 600 : 400,
                  }}
                >
                  {k === "All" ? "Everything" : plural(k)}
                  <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{counts[k] ?? 0}</span>
                </button>
              ))}
            </div>
          </Card>

          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-blue))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/mascot-robot-reading.webp" alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-3 h-[92px] w-[92px] object-contain" />
            <h3 className="relative w-[62%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("search.canTFindIt")}</h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("search.askSakhiInYourOwnWords")}</p>
            <div className="relative mt-3 w-[62%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">{tr("search.askSakhi")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[20px]">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>
          {q ? <>Results for “{q}”</> : "Search"}
        </h1>
        <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
          {q
            ? `${all.length} match${all.length === 1 ? "" : "es"} across courses, work, mentors and circles.`
            : "Press ⌘ K anywhere, or pick one of the ideas below."}
        </p>

      <SourceNote source={source} what="results" />
      </div>

      {q && all.length > 0 && (
        <div className="mb-[16px] flex flex-wrap gap-2">
          {SEARCH_KINDS.filter((k) => k === "All" || counts[k]).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
              {k === "All" ? "Everything" : plural(k)} · {counts[k] ?? 0}
            </Chip>
          ))}
        </div>
      )}

      {!q && (
        <Card>
          <SectionHead title={tr("search.popularSearches")} sub={tr("search.whatOtherMembersAreLookingFor")} />
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => router.push(`/app/search?q=${encodeURIComponent(s)}`)}
                className="ux-press ux-i rounded-full border border-transparent px-3.5 py-2 text-xsm font-medium"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      {q && shown.length === 0 && (
        <Card>
          <EmptyState
            icon="SearchX"
            title={all.length ? `No ${plural(kind).toLowerCase()} matched` : `Nothing matched “${q}”`}
            body={
              all.length
                ? tr("search.tryAnotherKindTheOtherFilters")
              : tr("search.checkTheSpellingTryAShorter")
            }
            action={
              all.length
                ? <Btn variant="soft" onClick={() => setKind("All")}>{tr("search.showEverything")}</Btn>
                : <Btn href="/app/sakhi" variant="primary" iconEnd="ArrowRight">{tr("search.askSakhi2")}</Btn>
            }
          />
        </Card>
      )}

      {shown.length > 0 && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {shown.map((h, i) => <Hit key={h.id} h={h} q={q} i={i} />)}
        </div>
      )}
    </HomeShell>
  );
}

function Hit({ h, q, i }: { h: SearchHit; q: string; i: number }) {
  return (
    <Link href={h.href} className="block">
      <Card className="ux-i ux-rise" style={{ ["--i" as string]: i }}>
        <div className="flex items-center gap-4">
          {h.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <span className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[12px]"
                  style={{ background: `var(${h.tint})` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={h.img} alt="" className="ux-art h-full w-full object-cover" />
            </span>
          ) : (
            <IconTile icon={h.icon} tint={h.tint} ink={h.ink} size={54} radius={12} />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              <Mark text={h.title} q={q} />
            </h3>
            <p className="mt-1 truncate text-xsm" style={{ color: "var(--ux-muted)" }}>{h.sub}</p>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-[4px] text-2xs font-semibold"
                style={{ background: `var(${h.tint})`, color: `var(${h.ink}-ink)` }}>
            {h.kind}
          </span>
          <Icons.ArrowRight className="ux-arrow h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} />
        </div>
      </Card>
    </Link>
  );
}

/** Highlights the matched span so it is obvious why a row is in the list. */
function Mark({ text, q }: { text: string; q: string }) {
  const t = q.trim();
  if (!t) return <>{text}</>;
  const at = text.toLowerCase().indexOf(t.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark style={{ background: "var(--ux-brand-tint-2)", color: "var(--ux-brand)", borderRadius: 3 }}>
        {text.slice(at, at + t.length)}
      </mark>
      {text.slice(at + t.length)}
    </>
  );
}

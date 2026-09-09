"use client";

import { use, useCallback, useMemo, useState } from "react";

import { apiSave, apiSaved, apiUnsave, type SavedItem } from "@/lib/entitlements-api";
import { apiProgramDetail } from "@/lib/growth-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, copy, EmptyState, IconTile, Pill, Progress, RailSkeleton, Rating,
  ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useLearning } from "@/components/ux/growth";
import { useT } from "@/i18n";


/**
 * One course.
 *
 * The primary action is never "Enrol" when she is already part-way through —
 * it is "Continue", and it names the exact lesson. A woman with twenty minutes
 * between other work should not have to find her place first.
 */
export default function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: learning, source } = useLearning();
  const CONTINUING = learning.continuing;
  const TOP_PICKS = learning.picks;
  const ALL = [...CONTINUING, ...TOP_PICKS];
  const course = ALL.find((c) => c.id === id);
  /**
   * Saved, as the server has it.
   *
   * This was `useState(false)`: the bookmark filled in, she navigated away,
   * and the course was not on her Saved list. `/saved` has carried these all
   * along.
   */
  const { data: savedItems, refetch: refetchSaved } = useResource(
    useCallback((sig: AbortSignal) => apiSaved(sig), []),
    [] as SavedItem[],
  );
  const [pending, setPending] = useState<boolean | null>(null);
  const saved = pending ?? savedItems.some((it) => it.kind === "program" && it.ref_id === id);

  const bookmark = useAction(
    async () => {
      if (saved) await apiUnsave("program", id);
      else await apiSave("program", id);
    },
    {
      onDone: () => { setPending(null); refetchSaved(); },
      optimistic: () => setPending(!saved),
      rollback: () => setPending(null),
      fallbackError: "Could not save it just now.",
    },
  );

  /**
   * Her actual curriculum, and her actual progress.
   *
   * This screen used to import a constant called CURRICULUM — one fixed
   * digital-marketing syllabus, rendered for EVERY course in the catalogue,
   * with lessons already ticked off. A woman opening a tailoring course was
   * shown somebody else's twelve lessons and told she had finished eight of
   * them. Every number under "Where you are" was invented, on her own record.
   *
   * `/me/programs/{id}/detail` has carried the real lessons and the real
   * percentage the whole time. It 404s for a course she has not joined, which
   * is correct — there is no progress to report — so the failure is swallowed
   * and the screen shows the course rather than her place in it.
   */
  const { data: detail } = useResource(
    useCallback((sig: AbortSignal) => apiProgramDetail(id, sig).catch(() => null), [id]),
    null,
  );
  const flat = useMemo(() => detail?.curriculum ?? [], [detail]);
  const done = flat.filter((l) => l.done).length;
  const nextIndex = flat.findIndex((l) => !l.done);
  const next = nextIndex >= 0 ? { n: nextIndex + 1, title: flat[nextIndex].title } : null;
  // From the server, not counted off a mock. Guarded, because dividing by an
  // empty curriculum is how "NaN%" reaches a screen.
  const pct = Math.round(detail?.progress ?? 0);
  const started = pct > 0 || done > 0;
  const hasCurriculum = flat.length > 0;

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way — saying it during the fetch makes the screen flash "that is not
  // here" before showing itself.
  if (!course && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!course) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("programs.thatCourseIsNotHere")}
            body="It may have been retired, or the link may be old."
            action={<Btn href="/app/programs" variant="primary" iconEnd="ArrowRight">{tr("programs.allCourses")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const similar = ALL.filter((c) => c.id !== course.id && c.category === course.category).slice(0, 2);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={started ? tr("programs.whereYouAre")
              : tr("programs.whatYouGet")} />
            {started ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>
                    {done} of {flat.length} lessons
                  </span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{pct}%</span>
                </div>
                <div className="mt-2.5"><Progress pct={pct} track="--ux-track" /></div>
                <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  {course.hours ? `${course.hours} in total. ` : ""}Fifteen minutes a day finishes
                  this inside a fortnight.
                </p>
              </>
            ) : (
              <ul className="space-y-2.5">
                {[
                  [`${flat.length} lessons`, "PlayCircle"],
                  [course.hours || "Ask when you join", "Clock"],
                  ["A certificate you can share", "Award"],
                  ["Yours to rewatch, always", "Infinity"],
                ].map(([t, ic]) => (
                  <li key={t} className="flex items-center gap-2.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                    <IconTile icon={ic} tint="--ux-tint-lilac" ink="--ux-brand" size={30} radius={9} />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              {/* Never "Enrol" when she is mid-way — name the lesson she is on. */}
              <Btn href={`/app/programs/${course.id}/lesson/${next?.n ?? 1}`} variant="primary" full iconEnd="ArrowRight">
                {started && next ? `Continue lesson ${next.n}` : "Start the first lesson"}
              </Btn>
            </div>
            <div className="mt-2.5 flex gap-2">
              <Btn variant="outline" size="sm" icon={saved ? "BookmarkCheck" : "Bookmark"}
                   onClick={() => void bookmark.run()}>
                {saved ? "Saved" : "Save"}
              </Btn>
              <ActionBtn variant="outline" size="sm" icon="Share2" doneIcon="Copy" done={tr("programs.linkCopied")}
                         act={() => copy(`https://womsakhi.in/course/${course.id}`, "Link copied — send it to a friend", "Copy it by hand from the address bar")}>
                Share
              </ActionBtn>
            </div>
          </Card>

          {course.author && (
            <Card>
              <SectionHead title={tr("programs.whoTeachesIt")} />
              <div className="ux-hov flex items-center gap-3">
                <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-full"
                      style={{ background: "var(--ux-tint-orange)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src="/ux/art/avatar-woman-blazer.webp" alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{course.author}</p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{tr("programs.teachesOnWomsakhiSince")}</p>
                </div>
              </div>
              <div className="mt-3">
                <Btn href="/app/mentors" variant="soft" size="sm" full iconEnd="ArrowRight">{tr("programs.askHerAQuestion")}</Btn>
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/programs"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" />{tr("programs.allCourses2")}</Link>

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        <div className="relative h-[180px] overflow-hidden" style={{ background: "var(--ux-tint-violet)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={course.thumb} alt="" className="h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55), transparent 60%)" }} />
          {course.tag && <span className="absolute start-4 top-4"><Pill tone="brand" size="sm">{course.tag}</Pill></span>}
        </div>
        <div className="p-[20px]">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{course.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            <span className="inline-flex items-center gap-1.5"><Icons.PlayCircle className="h-4 w-4" /> {flat.length} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Icons.Clock className="h-4 w-4" /> {course.hours || "—"}</span>
            <span className="inline-flex items-center gap-1.5"><Icons.BarChart3 className="h-4 w-4" /> {course.level}</span>
            <Rating value={course.rating} count={`${course.count} learners`} />
          </p>

          {started && next && (
            <div className="mt-4 flex items-center gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ux-brand-tint)" }}>
              <Icons.PlayCircle className="h-[20px] w-[20px] shrink-0" style={{ color: "var(--ux-brand)" }} />
              <p className="min-w-0 flex-1 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                You stopped at lesson {next?.n} — <strong style={{ color: "var(--ux-ink)" }}>{next?.title}</strong>
              </p>
              <Btn href={`/app/programs/${course.id}/lesson/${next?.n}`} variant="primary" size="sm" iconEnd="ArrowRight">
                Continue
              </Btn>
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-[16px]">
        <SectionHead title={tr("programs.whatYouWillBeAbleTo")} />
        <ul className="ux-stagger grid grid-cols-2 gap-x-6 gap-y-2.5">
          {[
            "Write posts people stop to read",
            "Photograph what you sell, on a phone",
            "Find the customers already looking for you",
            "Read what the numbers are telling you",
            "Spend a small budget without wasting it",
            "Know when you can raise your prices",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      {/* ── What is in it ──────────────────────────────────────────────────
          Only when there IS something in it. The lessons come from
          `/me/programs/{id}/detail` — her real enrolment, flat, with real
          `done` flags — so a course she has not joined shows no lesson list
          rather than somebody else's.

          What was here rendered a hardcoded three-section digital-marketing
          syllabus, with an accordion, for every course in the catalogue. */}
      {hasCurriculum && (
        <Card>
          <SectionHead title={tr("programs.whatIsInIt")} sub={`${flat.length} lessons · ${done} done`} />
          <ul className="ux-sq overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--ux-line)" }}>
            {flat.map((l, i) => {
              const current = i === nextIndex;
              return (
                <li key={`${l.title}-${i}`} style={{ borderTop: i ? "1px solid var(--ux-line)" : "none" }}>
                  <Link
                    href={`/app/programs/${course.id}/lesson/${i + 1}`}
                    className="ux-hov flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ux-surface-2)]"
                    style={{ background: current ? "var(--ux-brand-tint)" : "transparent" }}
                  >
                    <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full"
                          style={{ background: l.done ? "var(--ux-green-ink)" : current ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                      {l.done
                        ? <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3} />
                        : <Icons.Play className="h-[11px] w-[11px]" style={{ color: current ? "var(--ux-on-brand)" : "var(--ux-muted)" }} fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xsm"
                            style={{ color: current ? "var(--ux-brand)" : "var(--ux-ink-2)", fontWeight: current ? 600 : 400 }}>
                        <span style={{ color: "var(--ux-faint)" }}>{i + 1}.</span> {l.title}
                      </span>
                      {l.detail && (
                        <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                          {l.detail}
                        </span>
                      )}
                    </span>
                    {current && <Pill tone="brand" size="sm">{tr("programs.youAreHere")}</Pill>}
                    {/* Only when the lesson says how long — an empty duration
                        rendering as a bare "min" is the kind of thing that ships. */}
                    {l.duration && (
                      <span className="shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{l.duration}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {similar.length > 0 && (
        <div className="mt-[16px]">
          <SectionHead title={tr("programs.womenWhoTookThisAlsoTook")} />
          <div className="ux-deck grid grid-cols-2 gap-[16px]">
            {similar.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="h-[54px] w-[70px] shrink-0 overflow-hidden rounded-[12px]"
                        style={{ background: "var(--ux-tint-violet)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={c.thumb} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h3>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                      {c.lessons} lessons · {c.level}
                    </p>
                  </div>
                  <Btn href={`/app/programs/${c.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Open</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </HomeShell>
  );
}

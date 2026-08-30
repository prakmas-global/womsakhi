"use client";

import { use, useCallback, useMemo, useState } from "react";

import { apiSave, apiSaved, apiUnsave, type SavedItem } from "@/lib/entitlements-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  ActionBtn, Btn, Card, copy, EmptyState, IconTile, Pill, Progress, RailSkeleton, Rating,
  ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useLearning } from "@/components/ux/growth";
import { CURRICULUM } from "@/components/ux/learning/data";


/**
 * One course.
 *
 * The primary action is never "Enrol" when she is already part-way through —
 * it is "Continue", and it names the exact lesson. A woman with twenty minutes
 * between other work should not have to find her place first.
 */
export default function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: learning, source } = useLearning();
  const CONTINUING = learning.continuing;
  const TOP_PICKS = learning.picks;
  const ALL = [...CONTINUING, ...TOP_PICKS];
  const course = ALL.find((c) => c.id === id);
  const [open, setOpen] = useState<string | null>("Doing the Work");
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

  const flat = useMemo(() => CURRICULUM.flatMap((s) => s.lessons), []);
  const next = useMemo(() => flat.find((l) => !l.done), [flat]);
  const done = flat.filter((l) => l.done).length;
  const totalMins = flat.reduce((a, l) => a + l.mins, 0);
  const leftMins = flat.filter((l) => !l.done).reduce((a, l) => a + l.mins, 0);
  const pct = Math.round((done / flat.length) * 100);
  const started = done > 0;

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
            title="That course is not here"
            body="It may have been retired, or the link may be old."
            action={<Btn href="/app/programs" variant="primary" iconEnd="ArrowRight">All courses</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const similar = ALL.filter((c) => c.id !== course.id && c.category === course.category).slice(0, 2);

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title={started ? "Where you are" : "What you get"} />
            {started ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
                    {done} of {flat.length} lessons
                  </span>
                  <span className="text-[19px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{pct}%</span>
                </div>
                <div className="mt-2.5"><Progress pct={pct} track="--ux-track" /></div>
                <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  About {Math.floor(leftMins / 60)} hr {leftMins % 60} min left. Fifteen minutes a day finishes
                  this inside a fortnight.
                </p>
              </>
            ) : (
              <ul className="space-y-2.5">
                {[
                  [`${flat.length} lessons`, "PlayCircle"],
                  [`${Math.round(totalMins / 60)} hours in total`, "Clock"],
                  ["A certificate you can share", "Award"],
                  ["Yours to rewatch, always", "Infinity"],
                ].map(([t, ic]) => (
                  <li key={t} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>
                    <IconTile icon={ic} tint="--ux-tint-lilac" ink="--ux-brand" size={30} radius={9} />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              {/* Never "Enrol" when she is mid-way — name the lesson she is on. */}
              <Btn href={`/app/programs/${course.id}/lesson/${next?.n ?? 1}`} variant="primary" full iconEnd="ArrowRight">
                {started ? `Continue lesson ${next?.n}` : "Start the first lesson"}
              </Btn>
            </div>
            <div className="mt-2.5 flex gap-2">
              <Btn variant="outline" size="sm" icon={saved ? "BookmarkCheck" : "Bookmark"}
                   onClick={() => void bookmark.run()}>
                {saved ? "Saved" : "Save"}
              </Btn>
              <ActionBtn variant="outline" size="sm" icon="Share2" doneIcon="Copy" done="Link copied"
                         act={() => copy(`https://womsakhi.in/course/${course.id}`, "Link copied — send it to a friend", "Copy it by hand from the address bar")}>
                Share
              </ActionBtn>
            </div>
          </Card>

          {course.author && (
            <Card>
              <SectionHead title="Who teaches it" />
              <div className="ux-hov flex items-center gap-3">
                <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-full"
                      style={{ background: "var(--ux-tint-orange)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ux/art/avatar-woman-blazer.webp" alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{course.author}</p>
                  <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                    Teaches on WomSakhi since 2025
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Btn href="/app/mentors" variant="soft" size="sm" full iconEnd="ArrowRight">Ask her a question</Btn>
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/programs"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> All courses
      </Link>

      <Card className="mb-[15px] overflow-hidden" pad={0}>
        <div className="relative h-[180px] overflow-hidden" style={{ background: "var(--ux-tint-violet)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.thumb} alt="" className="h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55), transparent 60%)" }} />
          {course.tag && <span className="absolute start-4 top-4"><Pill tone="brand" size="sm">{course.tag}</Pill></span>}
        </div>
        <div className="p-[20px]">
          <h1 className="text-[24px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{course.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
            <span className="inline-flex items-center gap-1.5"><Icons.PlayCircle className="h-4 w-4" /> {flat.length} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Icons.Clock className="h-4 w-4" /> {Math.round(totalMins / 60)} hours</span>
            <span className="inline-flex items-center gap-1.5"><Icons.BarChart3 className="h-4 w-4" /> {course.level}</span>
            <Rating value={course.rating} count={`${course.count} learners`} />
          </p>

          {started && (
            <div className="mt-4 flex items-center gap-3 rounded-[13px] p-3.5" style={{ background: "var(--ux-brand-tint)" }}>
              <Icons.PlayCircle className="h-[20px] w-[20px] shrink-0" style={{ color: "var(--ux-brand)" }} />
              <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>
                You stopped at lesson {next?.n} — <strong style={{ color: "var(--ux-ink)" }}>{next?.title}</strong>
              </p>
              <Btn href={`/app/programs/${course.id}/lesson/${next?.n}`} variant="primary" size="sm" iconEnd="ArrowRight">
                Continue
              </Btn>
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-[15px]">
        <SectionHead title="What you will be able to do" />
        <ul className="ux-stagger grid grid-cols-2 gap-x-6 gap-y-2.5">
          {[
            "Write posts people stop to read",
            "Photograph what you sell, on a phone",
            "Find the customers already looking for you",
            "Read what the numbers are telling you",
            "Spend a small budget without wasting it",
            "Know when you can raise your prices",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHead title="What is in it" sub={`${CURRICULUM.length} parts · ${flat.length} lessons`} />
        <div className="space-y-2.5">
          {CURRICULUM.map((sec, si) => {
            const on = open === sec.section;
            const secDone = sec.lessons.filter((l) => l.done).length;
            return (
              <div key={sec.section} className="ux-sq overflow-hidden rounded-[13px] border"
                   style={{ borderColor: "var(--ux-line)" }}>
                <button
                  onClick={() => setOpen(on ? null : sec.section)}
                  aria-expanded={on}
                  className="ux-hov flex w-full items-center gap-3 px-4 py-3.5 text-start"
                >
                  <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
                        style={{
                          background: secDone === sec.lessons.length ? "var(--ux-green-ink)" : "var(--ux-brand-tint)",
                          color: secDone === sec.lessons.length ? "#fff" : "var(--ux-brand)",
                        }}>
                    {secDone === sec.lessons.length ? <Icons.Check className="h-[13px] w-[13px]" strokeWidth={3} /> : si + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>{sec.section}</span>
                    <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      {secDone} of {sec.lessons.length} done ·{" "}
                      {sec.lessons.reduce((a, l) => a + l.mins, 0)} min
                    </span>
                  </span>
                  <Icons.ChevronDown className="h-[18px] w-[18px] shrink-0 transition-transform"
                                     style={{ color: "var(--ux-faint)", transform: on ? "rotate(180deg)" : "none" }} />
                </button>

                {on && (
                  <ul className="ux-slide-up border-t" style={{ borderColor: "var(--ux-line)" }}>
                    {sec.lessons.map((l) => {
                      const current = "current" in l && l.current;
                      return (
                        <li key={l.n}>
                          <Link
                            href={`/app/programs/${course.id}/lesson/${l.n}`}
                            className="ux-hov flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--ux-surface-2)]"
                            style={{ background: current ? "var(--ux-brand-tint)" : "transparent" }}
                          >
                            <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full"
                                  style={{ background: l.done ? "var(--ux-green-ink)" : current ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                              {l.done
                                ? <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3} />
                                : <Icons.Play className="h-[11px] w-[11px]" style={{ color: current ? "#fff" : "var(--ux-muted)" }} fill="currentColor" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12.5px]"
                                  style={{ color: current ? "var(--ux-brand)" : "var(--ux-ink-2)", fontWeight: current ? 600 : 400 }}>
                              <span style={{ color: "var(--ux-faint)" }}>{l.n}.</span> {l.title}
                            </span>
                            {current && <Pill tone="brand" size="sm">You are here</Pill>}
                            <span className="shrink-0 text-[11px]" style={{ color: "var(--ux-faint)" }}>{l.mins} min</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {similar.length > 0 && (
        <div className="mt-[15px]">
          <SectionHead title="Women who took this also took" />
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {similar.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="h-[54px] w-[70px] shrink-0 overflow-hidden rounded-[11px]"
                        style={{ background: "var(--ux-tint-violet)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.thumb} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h3>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
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

"use client";

import { use, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, Progress, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useLearning } from "@/components/ux/growth";
import { useProgramDetail } from "@/components/ux/growth";
import { apiSetProgress } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useT } from "@/i18n";


/**
 * A lesson.
 *
 * Two decisions shape this screen, and both come from who uses it: a woman on a
 * cheap Android with expensive data, between other work.
 *
 * The transcript is not an afterthought — it is beside the video, always open.
 * Reading is free, video is not, and a noisy room makes audio useless. And
 * "Done, next lesson" is one button, because finishing a lesson and starting
 * the next are the same intention.
 */
export default function LessonPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const tr = useT();
  const { id, n } = use(params);
  const { data: learning, source } = useLearning();
  const ALL = [...learning.continuing, ...learning.picks];
  const course = ALL.find((c) => c.id === id);
  const num = Number(n);

  /**
   * The course's own lessons, and how far through she is.
   *
   * `CURRICULUM` was a constant: the same weeks, with the same titles and the
   * same `done` flags, under every course in the app. Marking a lesson
   * finished called `setDone(true)` and nothing else, so a woman working
   * through a course closed the app and came back to find she had not started
   * — and the certificate at the end counts the same lessons.
   */
  const { data: detail, refetch } = useProgramDetail(id);
  const flat = (detail?.curriculum ?? []).map((c, i) => ({
    n: i + 1,
    title: c.title,
    mins: c.duration || "",
    done: c.done,
  }));
  const lesson = flat.find((l) => l.n === num);
  const idx = flat.findIndex((l) => l.n === num);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  // Marked just now, or already marked on the server.
  const [markedNow, setMarkedNow] = useState(false);
  const done = markedNow || (lesson?.done ?? false);

  /**
   * Mark this lesson finished.
   *
   * The server keeps one number — how far through the course she is — so a
   * lesson is recorded by moving that number to cover it. Sending the highest
   * lesson she has reached rather than a count means going back to an earlier
   * one cannot undo the ones after it.
   */
  const finish = useAction(
    async () => {
      const total = flat.length || 1;
      const reached = Math.max(num, Math.round(((detail?.progress ?? 0) / 100) * total));
      await apiSetProgress(id, Math.min(100, Math.round((reached / total) * 100)));
    },
    { onDone: () => { setMarkedNow(true); refetch(); },
      fallbackError: "That did not save. This lesson is not marked finished yet — try again in a moment." },
  );
  const [playing, setPlaying] = useState(false);
  const [notes, setNotes] = useState("");

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

  if (!course || !lesson) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("programsLesson.thatLessonIsNotHere")}
            body="The course may have changed since this link was made."
            action={<Btn href="/app/programs" variant="primary" iconEnd="ArrowRight">{tr("programsLesson.allCourses")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const completed = flat.filter((l) => l.done).length + (done && !lesson.done ? 1 : 0);
  const pct = flat.length ? Math.round((completed / flat.length) * 100) : 0;

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("programsLesson.thisCourse")} sub={`${completed} of ${flat.length} lessons`} />
            <Progress pct={pct} track="--ux-track" />
            <div className="mt-3.5 max-h-[380px] space-y-1 overflow-y-auto">
              {/* The course's own lessons, flat. The server keeps no sections,
                  and inventing them here is how the mock got in. */}
              <div>
                <>
                  {flat.map((l) => {
                    const here = l.n === num;
                    return (
                      <Link
                        key={l.n}
                        href={`/app/programs/${course.id}/lesson/${l.n}`}
                        className="ux-hov flex items-center gap-2.5 rounded-[8px] px-2 py-2 transition-colors hover:bg-[var(--ux-surface-2)]"
                        style={{ background: here ? "var(--ux-brand-tint)" : "transparent" }}
                      >
                        <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                              style={{ background: l.done || (here && done) ? "var(--ux-green-ink)" : here ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                          {l.done || (here && done)
                            ? <Icons.Check className="h-[11px] w-[11px] text-white" strokeWidth={3} />
                            : <span className="text-2xs font-bold" style={{ color: here ? "var(--ux-on-brand)" : "var(--ux-muted)" }}>{l.n}</span>}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs"
                              style={{ color: here ? "var(--ux-brand)" : "var(--ux-ink-2)", fontWeight: here ? 600 : 400 }}>
                          {l.title}
                        </span>
                        {l.mins && (
                          <span className="shrink-0 text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{l.mins}</span>
                        )}
                      </Link>
                    );
                  })}
                </>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("programsLesson.yourNotes")} sub={tr("programsLesson.onlyYouCanSeeThese")} />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder={tr("programsLesson.writeDownAnythingYouWantTo")}
              aria-label={tr("programsLesson.yourNotesForThisLesson")}
              className="ux-sq w-full resize-y rounded-[12px] border p-3 text-xsm leading-relaxed outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            />
          </Card>
        </div>
      }
    >
      <Link href={`/app/programs/${course.id}`}
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> {course.title}
      </Link>

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        {/* The player. A poster and one button until she asks for it — data is
            expensive, and nothing should start downloading uninvited. */}
        <div className="relative aspect-video w-full overflow-hidden" style={{ background: "var(--ux-brand-900)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={course.thumb} alt="" className="h-full w-full object-cover"
               style={{ opacity: playing ? 0.28 : 0.6 }} />
          <div className="absolute inset-0 grid place-items-center">
            {playing ? (
              <div className="text-center">
                <Icons.Loader className="mx-auto h-[30px] w-[30px] animate-spin text-white" strokeWidth={1.8} />
                <p className="mt-3 text-xsm" style={{ color: "rgba(255,255,255,0.86)" }}>{tr("programsLesson.loadingTheVideo")}</p>
              </div>
            ) : (
              <button
                onClick={() => setPlaying(true)}
                aria-label={`Play lesson ${lesson.n}`}
                className="ux-press ux-hov grid h-[74px] w-[74px] place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.92)", boxShadow: "var(--ux-shadow-pop)" }}
              >
                <Icons.Play className="ux-ico ms-1 h-[28px] w-[28px]" style={{ color: "var(--ux-brand)" }} fill="currentColor" />
              </button>
            )}
          </div>
          <span className="absolute bottom-3 end-3 rounded-full px-2.5 py-1 text-[13px] font-medium text-white lg:text-2xs"
                style={{ background: "rgba(0,0,0,0.55)" }}>
            {lesson.mins} min
          </span>
        </div>

        <div className="p-[20px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
            Lesson {lesson.n} of {flat.length}
          </p>
          <h1 className="mt-1.5 text-[24px] font-bold leading-tight lg:text-xl" style={{ color: "var(--ux-ink)" }}>
            {lesson.title}
          </h1>

          {/* Previous and Next: stacked and full width on a phone — the pair
              was a 90px pill at one edge and a 170px pill at the other, with
              260px of nothing between them. Next comes first in the source so
              it is the first thing a screen reader and a thumb both reach; on
              desktop `order` puts Previous back on the left. */}
          <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4" style={{ borderColor: "var(--ux-line)" }}>
            <span className="flex items-center gap-2 [&>*]:w-full lg:[&>*]:w-auto">
              {prev && (
                <Btn href={`/app/programs/${course.id}/lesson/${prev.n}`} variant="outline" size="sm" icon="ArrowLeft">
                  Previous
                </Btn>
              )}
            </span>
            {/* Finishing this and starting the next are one intention. */}
            {next ? (
              <Btn href={`/app/programs/${course.id}/lesson/${next.n}`} variant="primary" iconEnd="ArrowRight"
                   onClick={() => void finish.run()}>
                {finish.busy ? "Saving…" : done ? `Next: lesson ${next.n}` : "Done — next lesson"}
              </Btn>
            ) : (
              <Btn href="/app/certificates" variant="primary" iconEnd="Award"
                   onClick={() => void finish.run()}>
                {finish.busy ? "Saving…" : "Finish the course"}
              </Btn>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead
          title={tr("programsLesson.whatSheSaysInWords")}
          sub={tr("programsLesson.readItInsteadOfWatchingNo")}
          action="Keep offline"
          onAction={() => { window.location.href = "/app/settings/offline"; }}
        />
        {/* Always open, never behind a toggle. Reading is free; video is not. */}
        <div className="space-y-3.5 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          <p>
            <span className="me-2 font-mono text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>0:00</span>
            Most women I meet think a strategy is a big word for something complicated. It is not. A strategy is
            deciding, before you post anything, who you are talking to and what you want them to do.
          </p>
          <p>
            <span className="me-2 font-mono text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>1:24</span>
            Take three minutes now and write down one sentence: who buys from you, and why they chose you over
            the shop down the road. If you cannot answer the second part, that is the first thing to fix — not
            your posting schedule.
          </p>
          <p>
            <span className="me-2 font-mono text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>4:10</span>
            Post twice a week, not twice a day. Twice a week for six months beats twice a day for two weeks,
            every single time, and it is the schedule you can actually keep alongside your work.
          </p>
          <p>
            <span className="me-2 font-mono text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>8:52</span>
            When somebody messages you, reply the same day even if the answer is &ldquo;let me check and come back to
            you&rdquo;. A reply that is slow is forgivable. Silence is not.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
          <Icons.PenLine className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          <p className="min-w-0 flex-1 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
            <strong style={{ color: "var(--ux-ink)" }}>{tr("programsLesson.tryThisBeforeTheNextLesson")}</strong> write the one
            sentence from 1:24 and keep it where you can see it.
          </p>
        </div>
      </Card>
    </HomeShell>
  );
}

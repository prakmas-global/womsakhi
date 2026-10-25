"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, Progress, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useProgramDetail } from "@/components/ux/growth";
import { courseArt } from "@/components/ux/learning/data";
import { CourseQA } from "@/components/ux/learning/CourseQA";
import { apiCompleteLesson } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useT } from "@/i18n";

/**
 * A YouTube link, as an embed that loads only when she presses play.
 * Anything else is opened in her browser — we do not frame other sites.
 */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

/**
 * A lesson.
 *
 * The lesson's own words come first and are always open — reading is free,
 * video is not, and a noisy room makes audio useless. A video, if the teacher
 * added one, waits behind a play button so nothing downloads uninvited.
 *
 * "Done — next lesson" is one button, because finishing a lesson and starting
 * the next are the same intention. Each lesson is recorded on its own, so the
 * progress bar is exactly the lessons she has finished.
 */
export default function LessonPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const tr = useT();
  const router = useRouter();
  const { id, n } = use(params);
  const num = Number(n);
  const { data: detail, source, refetch } = useProgramDetail(id);
  const lessons = detail?.curriculum ?? [];
  const lesson = lessons[num - 1];
  const hasNext = num < lessons.length;
  const [playing, setPlaying] = useState(false);
  const [notes, setNotes] = useState("");

  const finish = useAction(() => apiCompleteLesson(id, num), {
    onDone: () => {
      refetch();
      router.push(hasNext ? `/app/programs/${id}/lesson/${num + 1}` : `/app/programs/${id}`);
    },
    fallbackError: "That did not save. This lesson is not marked finished yet — try again in a moment.",
  });

  if (!detail && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!detail || !lesson) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("programsLesson.thatLessonIsNotHere")}
            body={tr("programsLesson.theCourseMayHaveChangedSince")}
            action={<Btn href="/app/programs" variant="primary" iconEnd="ArrowRight">{tr("programsLesson.allCourses")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  // Not joined yet (or a paid course still waiting on the teacher): the
  // lesson's text is not sent, so say why, and send her where she can join —
  // unless the teacher made this lesson a free preview.
  const previewing = !detail.can_learn && !!lesson.preview;
  if (!detail.can_learn && !previewing) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="Lock"
            title="Join the course to open this lesson"
            body={detail.status === "pending"
              ? `The lessons open as soon as ${detail.teacher_name} confirms your payment.`
              : "It takes one tap, and your progress is saved as you go."}
            action={<Btn href={`/app/programs/${id}`} variant="primary" iconEnd="ArrowRight">Go to the course</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const owner = detail.is_owner;
  const done = lessons.filter((l) => l.done).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const yt = lesson.video_url ? youtubeId(lesson.video_url) : null;
  const paragraphs = (lesson.body || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("programsLesson.thisCourse")}
                         sub={owner ? "Preview — as a learner sees it" : previewing ? "Free preview — join to open every lesson" : `${done} of ${lessons.length} lessons`} />
            {!owner && !previewing && <Progress pct={pct} track="--ux-track" />}
            <div className="mt-3.5 max-h-[380px] space-y-1 overflow-y-auto">
              {lessons.map((l, i) => {
                const here = i + 1 === num;
                if (previewing && !l.preview) {
                  return (
                    <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                      <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-track)" }}>
                        <Icons.Lock className="h-[10px] w-[10px]" style={{ color: "var(--ux-muted)" }} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{l.title}</span>
                    </div>
                  );
                }
                return (
                  <Link key={i} href={`/app/programs/${id}/lesson/${i + 1}`}
                        className="ux-hov flex items-center gap-2.5 rounded-[8px] px-2 py-2 transition-colors hover:bg-[var(--ux-surface-2)]"
                        style={{ background: here ? "var(--ux-brand-tint)" : "transparent" }}>
                    <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                          style={{ background: l.done ? "var(--ux-green-ink)" : here ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                      {l.done
                        ? <Icons.Check className="h-[11px] w-[11px] text-white" strokeWidth={3} />
                        : <span className="text-2xs font-bold" style={{ color: here ? "var(--ux-on-brand)" : "var(--ux-muted)" }}>{i + 1}</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs"
                          style={{ color: here ? "var(--ux-brand)" : "var(--ux-ink-2)", fontWeight: here ? 600 : 400 }}>
                      {l.title}
                    </span>
                    {l.duration && <span className="shrink-0 text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{l.duration}</span>}
                  </Link>
                );
              })}
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
      <Link href={`/app/programs/${id}`}
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> {detail.name}
      </Link>

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        {lesson.video_url && (
          <div className="relative aspect-video w-full overflow-hidden" style={{ background: "var(--ux-brand-900)" }}>
            {playing && yt ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
                title={lesson.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={courseArt(detail.category, detail.cover)} alt=""
                     className="h-full w-full object-cover" style={{ opacity: 0.55 }} />
                <div className="absolute inset-0 grid place-items-center">
                  {yt ? (
                    <button onClick={() => setPlaying(true)} aria-label={`Play lesson ${num}`}
                            className="ux-press ux-hov grid h-[74px] w-[74px] place-items-center rounded-full"
                            style={{ background: "rgba(255,255,255,0.92)", boxShadow: "var(--ux-shadow-pop)" }}>
                      <Icons.Play className="ux-ico ms-1 h-[28px] w-[28px]" style={{ color: "var(--ux-brand)" }} fill="currentColor" />
                    </button>
                  ) : (
                    <Btn href={lesson.video_url} variant="primary" icon="PlayCircle">Watch the video</Btn>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-[20px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
            Lesson {num} of {lessons.length}{lesson.duration ? ` · ${lesson.duration}` : ""}
          </p>
          <h1 className="mt-1.5 text-[24px] font-bold leading-tight lg:text-xl" style={{ color: "var(--ux-ink)" }}>{lesson.title}</h1>
          {lesson.detail && <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{lesson.detail}</p>}

          {paragraphs.length > 0 && (
            <div className="mt-4 space-y-3.5 text-smd leading-relaxed lg:text-sm" style={{ color: "var(--ux-ink-2)" }}>
              {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4" style={{ borderColor: "var(--ux-line)" }}>
            <span className="flex items-center gap-2 [&>*]:w-full lg:[&>*]:w-auto">
              {num > 1 && !previewing && (
                <Btn href={`/app/programs/${id}/lesson/${num - 1}`} variant="outline" size="sm" icon="ArrowLeft">Previous</Btn>
              )}
            </span>
            {previewing ? (
              <Btn href={`/app/programs/${id}`} variant="primary" iconEnd="ArrowRight">
                {detail.price_minor ? `Join to keep learning · ₹${(detail.price_minor / 100).toLocaleString("en-IN")}` : "Join free to keep learning"}
              </Btn>
            ) : owner ? (
              hasNext && <Btn href={`/app/programs/${id}/lesson/${num + 1}`} variant="primary" iconEnd="ArrowRight">Next lesson</Btn>
            ) : (
              <Btn variant="primary" iconEnd={hasNext ? "ArrowRight" : "Award"} loading={finish.busy} onClick={() => void finish.run()}>
                {hasNext ? (lesson.done ? `Next: lesson ${num + 1}` : "Done — next lesson") : lesson.done ? "Back to the course" : "Finish the course"}
              </Btn>
            )}
          </div>
          {finish.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{finish.error}</p>}
        </div>
      </Card>

      {!previewing && <CourseQA programId={id} lesson={num} />}
    </HomeShell>
  );
}

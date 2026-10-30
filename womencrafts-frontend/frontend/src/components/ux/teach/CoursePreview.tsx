"use client";

import * as Icons from "@/components/ux/icons";
import { Card, SectionHead } from "@/components/ux/kit";
import { CourseCard } from "@/components/ux/learning/parts";
import { courseArt, normCategory, realDuration, type Course } from "@/components/ux/learning/data";
import { useMe } from "@/components/ux/me";
import { useMasterPictures } from "@/components/ux/media/MasterPictures";
import type { CourseInput } from "@/lib/teach-api";

/**
 * "How it will look" — beside the course editor, live as she types.
 *
 * The card is the real `CourseCard` from Learn, not a drawing of it, so what
 * she sees here is what a learner sees in Courses. Under it, the top of the
 * course page: her description and the lessons, with the free previews open
 * and the rest locked — the part a learner reads before deciding to join.
 */
export function CoursePreview({ value, paid }: { value: CourseInput; paid: boolean }) {
  const me = useMe();
  const catPics = useMasterPictures("course_categories");
  const category = normCategory(value.category || "");
  const lessons = value.lessons.filter((l) => l.title.trim() || l.video_url.trim() || l.body.trim());
  const c: Course = {
    id: "preview",
    title: value.name.trim() || "Your course title",
    lessons: lessons.length,
    level: "Beginner",
    rating: "",
    count: "",
    // The picture a learner sees until the course has a cover: its category's.
    thumb: value.cover || (value.category ? catPics.pic(value.category) : courseArt(category)),
    category: category || "Category",
    hours: realDuration(value.duration),
    teacher: me.name,
    byMember: true,
    priceMinor: paid ? Math.round((Number(value.price_rupees) || 0) * 100) : 0,
  };

  return (
    <div className="xl:sticky xl:top-[96px]">
      <Card>
        <SectionHead title="How it will look" icon="Eye" />
        <p className="-mt-1 mb-3.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          Your course in Learn → Courses. It changes as you type — with your picture, or your category’s until you add one.
        </p>
        <div className="mx-auto max-w-[280px]">
          <CourseCard c={c} preview />
        </div>

        <div className="mt-4 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
          <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>On the course page</p>
          <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed" style={{ color: value.desc.trim() ? "var(--ux-ink-2)" : "var(--ux-faint)" }}>
            {value.desc.trim() || "Your description shows here — what she will be able to do at the end."}
          </p>
          {lessons.length > 0 ? (
            <ol className="mt-3 space-y-1.5">
              {lessons.slice(0, 6).map((l, i) => (
                <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--ux-ink)" }}>
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                        style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{l.title.trim() || `Lesson ${i + 1}`}</span>
                  {l.preview
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold" style={{ color: "var(--ux-green-ink)" }}>
                        <Icons.Eye className="h-[12px] w-[12px]" />Free preview
                      </span>
                    : <Icons.Lock className="h-[12px] w-[12px] shrink-0" style={{ color: "var(--ux-faint)" }} aria-label="Opens after joining" />}
                </li>
              ))}
              {lessons.length > 6 && (
                <li className="ps-7 text-2xs" style={{ color: "var(--ux-muted)" }}>and {lessons.length - 6} more</li>
              )}
            </ol>
          ) : (
            <p className="mt-3 text-xs" style={{ color: "var(--ux-faint)" }}>Your lessons will be listed here.</p>
          )}
          <p className="mt-3 rounded-[10px] px-3 py-2 text-2xs font-semibold"
             style={{ background: c.priceMinor ? "var(--ux-tint-orange)" : "var(--ux-tint-green)",
                      color: c.priceMinor ? "var(--ux-orange-ink)" : "var(--ux-green-ink)" }}>
            {c.priceMinor
              ? `Learners pay you ₹${(c.priceMinor / 100).toLocaleString("en-IN")} by UPI, then you confirm and the lessons open.`
              : "Free — anyone can join and start straight away."}
          </p>
        </div>
      </Card>
    </div>
  );
}

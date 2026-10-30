"use client";

import { useCallback } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, IconTile, Pill, ScreenSkeleton, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { courseArt } from "@/components/ux/learning/data";
import { apiTeachCourses, apiTeachSummary, rupees, type TeachCourseRow, type TeachSummary } from "@/lib/teach-api";
import { useResource } from "@/lib/use-resource";

/**
 * Teach — the courses she teaches.
 *
 * The first thing on the screen is anything waiting on HER: learners who say
 * they have paid. Then what she has earned, then each course with its learners.
 */
export default function TeachPage() {
  const { data: courses, source } = useResource(
    useCallback((s: AbortSignal) => apiTeachCourses(s), []),
    [] as TeachCourseRow[],
  );
  const { data: summary } = useResource(
    useCallback((s: AbortSignal) => apiTeachSummary(s).catch(() => null), []),
    null as TeachSummary | null,
  );

  if (source === "loading" && !courses.length) {
    return <HomeShell skeleton="list"><ScreenSkeleton shape="list" /></HomeShell>;
  }

  const toConfirm = courses.filter((c) => c.stats.to_confirm > 0);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="How teaching works" icon="Sparkles" />
            <ol className="space-y-3.5">
              {([
                ["PenLine", "Write your lessons", "Short text lessons, and a video link if you have one."],
                ["IndianRupee", "Free or paid — you decide", "Learners pay you directly by UPI. No fee."],
                ["CheckCircle2", "Confirm each payment", "The lessons open for her when you confirm."],
                ["Wallet", "See it in Earn", "Every payment goes into your income book."],
              ] as const).map(([icon, t, s]) => (
                <li key={t} className="flex items-start gap-3">
                  <IconTile icon={icon} tint="--ux-tint-lilac" ink="--ux-brand" size={34} radius={10} />
                  <span className="min-w-0">
                    <span className="block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{t}</span>
                    <span className="block text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{s}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      }
    >
      <ScreenHead title="Create a course" sub="Teach what you know to other women — free, or for a price you set. Learners pay you directly.">
        <Btn href="/app/teach/new" variant="primary" icon="Plus">New course</Btn>
      </ScreenHead>

      {summary && summary.courses > 0 && (
        <div className="mb-[16px] grid grid-cols-2 gap-[12px] lg:grid-cols-4">
          {([
            ["Courses live", `${summary.live} of ${summary.courses}`, "GraduationCap", "--ux-tint-violet", "--ux-violet"],
            ["Learners", String(summary.learners), "Users", "--ux-tint-blue", "--ux-blue"],
            ["Earned this month", rupees(summary.month_minor), "IndianRupee", "--ux-tint-green", "--ux-green"],
            ["Earned in all", rupees(summary.earned_minor), "Wallet", "--ux-tint-orange", "--ux-orange"],
          ] as const).map(([label, value, icon, tint, ink]) => (
            <Card key={label}>
              <div className="flex items-center gap-3">
                <IconTile icon={icon} tint={tint} ink={ink} size={38} radius={11} />
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{value}</p>
                  <p className="truncate text-xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {toConfirm.length > 0 && (
        <Card className="mb-[16px]" style={{ background: "var(--ux-tint-orange)" }}>
          <div className="flex items-start gap-3">
            <Icons.Bell className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                {summary?.to_confirm ?? toConfirm.length} payment{(summary?.to_confirm ?? 2) === 1 ? "" : "s"} to confirm
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--ux-ink-2)" }}>
                Check your UPI app, then confirm — the lessons open for her straight away.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {toConfirm.map((c) => (
                  <Btn key={c.id} href={`/app/teach/${c.id}?tab=learners`} variant="primary" size="sm" iconEnd="ArrowRight">
                    {c.name} · {c.stats.to_confirm}
                  </Btn>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {courses.length === 0 ? (
        <Card pad={0} className="overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_280px]">
            <div className="p-[24px]">
              <h2 className="text-xl font-bold" style={{ color: "var(--ux-ink)" }}>What do you know that others want to learn?</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                Stitching, cooking for orders, mehendi, spoken English, saving money — if you do it well,
                there is a woman who wants to learn it from you.
              </p>
              <div className="mt-5"><Btn href="/app/teach/new" variant="primary" icon="Plus">Create your first course</Btn></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/course-teaching-another-woman.webp" alt="" className="hidden h-full w-full object-cover lg:block" />
          </div>
        </Card>
      ) : (
        <div className="space-y-[12px]">
          {courses.map((c) => (
            <Card key={c.id} pad={0} className="overflow-hidden">
              <div className="flex flex-col gap-4 p-[16px] lg:flex-row lg:items-center">
                <span className="hidden h-[72px] w-[96px] shrink-0 overflow-hidden rounded-[12px] lg:block" style={{ background: "var(--ux-tint-violet)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={courseArt(c.category, c.cover)} alt="" className="h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-bold" style={{ color: "var(--ux-ink)" }}>{c.name}</h2>
                    {c.status === "Archived"
                      ? <Pill tone="neutral" size="sm">Hidden by our team</Pill>
                      : c.live ? <Pill tone="green" size="sm">Live</Pill> : <Pill tone="neutral" size="sm">Draft</Pill>}
                    <Pill tone={c.price_minor ? "orange" : "blue"} size="sm">{c.price_minor ? rupees(c.price_minor) : "Free"}</Pill>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                    <span>{c.category}</span>
                    <span>{c.lesson_count} lessons</span>
                    <span>{c.stats.learners} learning · {c.stats.completed} finished</span>
                    {c.price_minor > 0 && <span>{rupees(c.stats.earned_minor)} earned</span>}
                    {c.stats.pending > 0 && <span style={{ color: "var(--ux-orange-ink)" }}>{c.stats.pending} waiting to pay</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn href={`/app/teach/${c.id}?tab=learners`} variant="outline" size="sm" icon="Users">Learners</Btn>
                  <Btn href={`/app/teach/${c.id}`} variant="soft" size="sm" icon="PenLine">Edit</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}

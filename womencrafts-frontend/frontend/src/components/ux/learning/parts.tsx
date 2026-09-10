"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { AvatarStack, Btn, Card, IconTile, Pill, Progress, Rating, SectionHead, v } from "../kit";
import { ACHIEVEMENTS, type Course, LEARNER, SKILLS, STREAK } from "./data";

const TAG_TONE = { Bestseller: "pink", New: "brand", Popular: "orange", Trending: "green" } as const;

/** The card the whole module is built around — grid and rail both use it. */
export function CourseCard({ c, w }: { c: Course; w?: number }) {
  return (
    /* `/ux/learning/course/${c.id}` until the /ux preview tree was deleted on
       2026-08-26. `c.id` is the catalogue programme id — `toPick` in growth.ts
       carries it straight through — so this is the screen it always meant. */
    /*
      A row on a phone, the poster card it always was from `lg` up.

      In a 3-column grid the poster is right; `.ux-deck` collapses that grid to
      one column below 1024, and eight full-width posters with 110px covers is
      1,900px of scrolling to see eight titles. The same eight as rows is 800px,
      and every title is beside its own picture rather than under it. Only the
      classes change — same markup, same link, same information.
    */
    <Link href={`/app/programs/${c.id}`}
      /* `padding: 0` inline is what lets the picture reach the card's edge on
         desktop, and an inline rule cannot be undone by a `lg:` class — so the
         phone row's inset lives on the two children instead. */
      className="ux-card ux-i ux-sq flex shrink-0 items-center gap-3 overflow-hidden lg:block"
      style={{ width: w, padding: 0 }}>
      <div className="relative m-2.5 me-0 shrink-0 overflow-hidden rounded-[10px] lg:m-0 lg:rounded-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.thumb} alt=""
             className="ux-art h-[84px] w-[84px] object-cover lg:h-[110px] lg:w-full" />
        {/* The corner badge needs a corner. On the row it moves inline, under
            the title, where it is legible against the card rather than against
            whatever the photograph happens to be. */}
        {c.tag && (
          <span className="absolute start-2.5 top-2.5 hidden lg:block">
            <Pill tone={TAG_TONE[c.tag]} size="sm">{c.tag}</Pill>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-2.5 pe-3 lg:p-3">
        <h2 className="line-clamp-2 text-smd font-semibold leading-snug lg:text-xsm"
            style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] lg:text-xs"
           style={{ color: "var(--ux-muted)" }}>
          <span>{c.lessons} Lessons <span aria-hidden>•</span> {c.level}</span>
          {c.tag && <span className="lg:hidden"><Pill tone={TAG_TONE[c.tag]} size="sm">{c.tag}</Pill></span>}
        </p>
        {typeof c.pct === "number" ? (
          <div className="mt-2.5">
            <Progress pct={c.pct} />
            <p className="mt-1.5 text-end text-[13px] font-medium lg:text-2xs"
               style={{ color: "var(--ux-brand)" }}>{c.pct}% Complete</p>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <Rating value={c.rating} count={c.count} />
            <Icons.Bookmark className="ux-ico hidden h-[15px] w-[15px] lg:block" style={{ color: "var(--ux-faint)" }} strokeWidth={1.9} />
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * The wide "resume this" card at the top of Continue Learning.
 *
 * **Its button did nothing.** `<Btn variant="primary" icon="Play">Resume
 * Learning</Btn>` had no `onClick` and no `href` — the single most prominent
 * action on the screen a woman opens to carry on with a course she has already
 * started, and pressing it was silence. The picture beside it, with a play
 * symbol over it, was not a link either.
 *
 * Both now go to the course. The whole card is the target, because a 152px
 * thumbnail with a play button drawn on it is a thing people press.
 */
export function ResumeCard({ c }: { c: Course }) {
  const href = `/app/programs/${c.id}`;
  return (
    /*
      Stacked on a phone, side by side from `lg`.

      232px of thumbnail is 60% of a 390px screen, and what was left could not
      hold the title: the before shot showed "Entrepreneur / Bootcamp" wrapping
      and clipping at the card edge, with "Resume / Learning" broken across two
      lines inside a button pushed against the right margin. The picture takes
      the full width instead, and the action becomes a full-width one under the
      words — `.ux-action-primary` is the phone-only rule that does it.
    */
    <Link href={href} className="ux-card ux-hov flex flex-col overflow-hidden lg:flex-row lg:gap-4" style={{ padding: 0 }}>
      <div className="relative h-[168px] w-full shrink-0 lg:h-[152px] lg:w-[232px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.thumb} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-[56px] w-[56px] place-items-center rounded-full backdrop-blur lg:h-[52px] lg:w-[52px]"
                style={{ background: "rgba(255,255,255,.82)" }}>
            <Icons.Play className="h-5 w-5 translate-x-[1px]" fill="var(--ux-brand)" style={{ color: "var(--ux-brand)" }} />
          </span>
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-4 lg:p-0 lg:pe-5">
        <h2 className="text-[17px] font-semibold leading-tight lg:text-base" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
        <p className="mt-1 text-[14px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
          Course <span aria-hidden>•</span> {c.lessons} Lessons
        </p>
        <div className="mt-3.5 flex items-center gap-3">
          <Progress pct={c.pct ?? 0} />
          <span className="shrink-0 text-[13px] font-medium lg:text-xs" style={{ color: "var(--ux-brand)" }}>{c.pct}% Complete</span>
        </div>
        <div className="mt-4">
          {/* A span, not a nested link: the card around it is already the
              anchor, and an <a> inside an <a> is invalid and unpredictable to
              a keyboard and a screen reader. It still looks and reads as the
              button it always was. */}
          <span className="ux-press ux-action-primary inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-xsm font-semibold"
                style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "var(--ux-on-brand)" }}>
            <Icons.Play className="h-4 w-4" fill="currentColor" aria-hidden />
            {(c.pct ?? 0) > 0 ? "Resume Learning" : "Start learning"}
          </span>
        </div>
      </div>
    </Link>
  );
}

/*
 * `PathRow` was here. It rendered a learning path and linked to
 * `/ux/learning/paths/{id}` — a route that has never existed in this codebase,
 * not even among the deleted prototypes, which had `/ux/learning/paths` and no
 * detail page. Its only caller was the Paths tab on `/app/programs`, which is
 * gone: there is no learning-path feature on the server to render.
 */

export function SkillCard({ s }: { s: (typeof SKILLS)[number] }) {
  return (
    <div className="ux-card flex w-[176px] shrink-0 items-start gap-2.5" style={{ padding: 13 }}>
      <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={34} radius={9} />
      <div className="min-w-0">
        <h2 className="text-xsm font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>{s.name}</h2>
        <p className="mt-1 text-2xs" style={{ color: "var(--ux-muted)" }}>{s.level}</p>
      </div>
    </div>
  );
}

/* ── right rail ─────────────────────────────────────────────────────────── */

export function LearnerCard() {
  const pct = (LEARNER.xp / LEARNER.xpMax) * 100;
  return (
    <Card>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/ux/art/avatar-woman-purple-kurta.webp" alt="" className="h-[52px] w-[52px] rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
            {LEARNER.name}
            <Icons.BadgeCheck className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
          </h2>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
            Level {LEARNER.level} <span aria-hidden>•</span> {LEARNER.title}
          </p>
        </div>
      </div>
      <div className="mt-3"><Progress pct={pct} /></div>
      <p className="mt-1.5 text-end text-2xs" style={{ color: "var(--ux-muted)" }}>
        {LEARNER.xp.toLocaleString()} / {LEARNER.xpMax.toLocaleString()} XP
      </p>
    </Card>
  );
}

export function StreakCard() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
          <Icons.Flame className="h-[16px] w-[16px]" style={{ color: "var(--ux-orange-ink)" }} aria-hidden /> Learning Streak
        </h2>
        <Btn variant="outline" size="sm">View Calendar</Btn>
      </div>
      <div className="mt-3.5 flex items-center gap-4">
        <div className="shrink-0 text-center">
          <p className="text-2xl font-bold leading-none" style={{ color: "var(--ux-ink)" }}>{STREAK.days}</p>
          <p className="mt-0.5 text-2xs" style={{ color: "var(--ux-muted)" }}>Days</p>
        </div>
        <div className="flex flex-1 justify-between">
          {STREAK.marks.map((on, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>{days[i]}</span>
              <span className="ux-pop grid h-[26px] w-[26px] place-items-center rounded-full border"
                    style={{ ["--i" as string]: i,
                             background: on ? "var(--ux-brand-600)" : "transparent",
                             borderColor: on ? "transparent" : "var(--ux-line-strong)" }}>
                {on && <Icons.Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function AchievementsCard() {
  return (
    <Card>
      <SectionHead title="Achievements" action="View All" />
      <div className="grid grid-cols-3 gap-2">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.name} className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={a.img} alt="" className="mx-auto h-[58px] w-[58px]" />
            <p className="mt-1.5 text-2xs font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>{a.name}</p>
            <p className="mt-0.5 text-2xs leading-tight" style={{ color: "var(--ux-muted)" }}>{a.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ReminderCard() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
            <Icons.Bell className="h-[16px] w-[16px]" style={{ color: "var(--ux-brand)" }} /> Study Reminder
          </h2>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            Keep the momentum going. You have a study goal for today.
          </p>
          <div className="mt-3"><Btn variant="soft" size="sm">Start Learning Now</Btn></div>
        </div>
        <IconTile icon="CalendarClock" tint="--ux-tint-violet" ink="--ux-violet" size={52} radius={14} />
      </div>
    </Card>
  );
}

export function AskSakhiCard() {
  return (
    <div className="relative overflow-hidden rounded-[16px] p-[20px]"
         style={{ background: "linear-gradient(150deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      <h2 className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>Hi, I&apos;m Sakhi!</h2>
      <p className="mt-2 w-[76%] text-xs leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
        I&apos;m here to guide you to the best learning opportunities.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/ux/art/avatar-woman-pink-glasses.webp" alt=""
           className="pointer-events-none absolute -bottom-1 end-1 h-[96px] w-[96px] object-contain" />
      <div className="mt-4 w-[70%]"><Btn variant="primary" full iconEnd="ArrowRight">Chat with Sakhi</Btn></div>
    </div>
  );
}

export function LearningRail() {
  return (
    <div className="space-y-[16px]">
      <LearnerCard />
      <StreakCard />
      <AchievementsCard />
      <ReminderCard />
      <AskSakhiCard />
    </div>
  );
}

export { AvatarStack, v };

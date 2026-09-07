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
    <Link href={`/app/programs/${c.id}`}
      className="ux-card ux-i ux-sq block shrink-0 overflow-hidden"
      style={{ width: w, padding: 0 }}>
      <div className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.thumb} alt="" className="ux-art h-[110px] w-full object-cover" />
        {c.tag && <span className="absolute start-2.5 top-2.5"><Pill tone={TAG_TONE[c.tag]} size="sm">{c.tag}</Pill></span>}
      </div>
      <div className="p-3">
        <h2 className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
          {c.lessons} Lessons <span aria-hidden>•</span> {c.level}
        </p>
        {typeof c.pct === "number" ? (
          <div className="mt-2.5">
            <Progress pct={c.pct} />
            <p className="mt-1.5 text-end text-[0.6875rem] font-medium" style={{ color: "var(--ux-brand)" }}>{c.pct}% Complete</p>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <Rating value={c.rating} count={c.count} />
            <Icons.Bookmark className="ux-ico h-[15px] w-[15px]" style={{ color: "var(--ux-faint)" }} strokeWidth={1.9} />
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
    <Link href={href} className="ux-card ux-hov flex gap-4 overflow-hidden" style={{ padding: 0 }}>
      <div className="relative h-[152px] w-[232px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.thumb} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-[52px] w-[52px] place-items-center rounded-full backdrop-blur"
                style={{ background: "rgba(255,255,255,.82)" }}>
            <Icons.Play className="h-5 w-5 translate-x-[1px]" fill="var(--ux-brand)" style={{ color: "var(--ux-brand)" }} />
          </span>
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center pe-5">
        <h2 className="text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
        <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
          Course <span aria-hidden>•</span> {c.lessons} Lessons
        </p>
        <div className="mt-3.5 flex items-center gap-3">
          <Progress pct={c.pct ?? 0} />
          <span className="shrink-0 text-[0.75rem] font-medium" style={{ color: "var(--ux-brand)" }}>{c.pct}% Complete</span>
        </div>
        <div className="mt-4">
          {/* A span, not a nested link: the card around it is already the
              anchor, and an <a> inside an <a> is invalid and unpredictable to
              a keyboard and a screen reader. It still looks and reads as the
              button it always was. */}
          <span className="ux-press inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[0.8125rem] font-semibold"
                style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "#fff" }}>
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
        <h2 className="text-[0.8125rem] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>{s.name}</h2>
        <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>{s.level}</p>
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
          <h2 className="flex items-center gap-1.5 text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
            {LEARNER.name}
            <Icons.BadgeCheck className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
          </h2>
          <p className="text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
            Level {LEARNER.level} <span aria-hidden>•</span> {LEARNER.title}
          </p>
        </div>
      </div>
      <div className="mt-3"><Progress pct={pct} /></div>
      <p className="mt-1.5 text-end text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>
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
        <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
          <span aria-hidden>🔥</span> Learning Streak
        </h2>
        <Btn variant="outline" size="sm">View Calendar</Btn>
      </div>
      <div className="mt-3.5 flex items-center gap-4">
        <div className="shrink-0 text-center">
          <p className="text-[1.5rem] font-bold leading-none" style={{ color: "var(--ux-ink)" }}>{STREAK.days}</p>
          <p className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>Days</p>
        </div>
        <div className="flex flex-1 justify-between">
          {STREAK.marks.map((on, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>{days[i]}</span>
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
            <p className="mt-1.5 text-[0.6875rem] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>{a.name}</p>
            <p className="mt-0.5 text-[0.6875rem] leading-tight" style={{ color: "var(--ux-muted)" }}>{a.body}</p>
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
          <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
            <Icons.Bell className="h-[16px] w-[16px]" style={{ color: "var(--ux-brand)" }} /> Study Reminder
          </h2>
          <p className="mt-2 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
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
      <h2 className="text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>Hi, I&apos;m Sakhi! <span aria-hidden>👋</span></h2>
      <p className="mt-2 w-[76%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
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

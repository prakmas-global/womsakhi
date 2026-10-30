"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Progress } from "../kit";
import type { Course } from "./data";

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "W";

/**
 * The course card — the one shape a course takes in Learn, and the preview a
 * teacher sees while she writes hers (`preview`: same card, not a link).
 *
 * The title and the teacher sit ON the photograph, over a dark fade, so they
 * read the same in light and dark mode. Under it: what it costs, what kind of
 * course it is, and one full-width button saying what tapping will do. Two
 * across on a phone, three on a desktop.
 */
export function CourseCard({ c, w, preview = false }: { c: Course; w?: number; preview?: boolean }) {
  const started = typeof c.pct === "number";
  const finished = c.myStatus === "completed" || (started && (c.pct ?? 0) >= 100);
  const waiting = c.myStatus === "pending";
  const team = !c.byMember;
  const teacher = c.teacher || "WomSakhi team";
  const cta = finished ? "Look again" : started ? "Continue" : waiting ? "Payment being checked"
    : c.priceMinor ? "See the course" : "Start free";
  const facts = [c.category, c.lessons > 0 ? `${c.lessons} ${c.lessons === 1 ? "lesson" : "lessons"}` : c.hours]
    .filter(Boolean).join(" · ");

  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: "#1c1024" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.thumb} alt=""
             className="ux-art h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <span aria-hidden className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 30%, rgba(16,6,24,.55) 58%, rgba(16,6,24,.92) 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 p-3 lg:p-3.5">
          <h2 className="line-clamp-2 text-xsm font-bold leading-snug text-white lg:text-[15px]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.35)" }}>{c.title}</h2>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-2xs text-white/85 lg:text-xs">
            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[8px] font-bold"
                  style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>
              {team ? <Icons.Sparkles className="h-[10px] w-[10px]" /> : initialsOf(teacher)}
            </span>
            <span className="truncate">{teacher}</span>
            {team && <Icons.BadgeCheck className="h-[12px] w-[12px] shrink-0 text-white" />}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 lg:p-3.5">
        <p className="flex min-w-0 items-center gap-2 text-2xs lg:text-xs">
          <span className="shrink-0 rounded-full px-2 py-[3px] font-bold"
                style={c.priceMinor ? { background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }
                                    : { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            {c.priceMinor ? `₹${(c.priceMinor / 100).toLocaleString("en-IN")}` : "Free"}
          </span>
          <span className="truncate" style={{ color: "var(--ux-muted)" }}>{facts}</span>
        </p>

        {started && !finished && (
          <div className="flex items-center gap-2">
            <Progress pct={c.pct ?? 0} />
            <span className="shrink-0 text-2xs font-bold tabular-nums" style={{ color: "var(--ux-brand)" }}>{c.pct}%</span>
          </div>
        )}

        <span className="mt-auto flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] px-3 text-2xs font-bold lg:text-xs"
              style={finished ? { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }
                : waiting ? { background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }
                : started ? { background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "var(--ux-on-brand)" }
                : { background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          {finished && <Icons.CheckCircle2 className="h-[13px] w-[13px]" />}
          {cta}
          {!finished && !waiting && <Icons.ArrowRight className="h-[13px] w-[13px] transition-transform group-hover:translate-x-0.5" />}
        </span>
      </div>
    </>
  );

  const cls = "ux-card ux-i ux-sq group flex shrink-0 flex-col overflow-hidden";
  const style = { width: w, padding: 0 };
  return preview
    ? <div className={cls} style={style} aria-label={`Preview: ${c.title}`}>{body}</div>
    : <Link href={`/app/programs/${c.id}`} className={`${cls} ux-hov`} style={style}>{body}</Link>;
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
        <p className="mt-1 text-[15px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
          By {c.teacher ?? "WomSakhi team"} <span aria-hidden>•</span> {c.lessons || ""} {c.lessons ? "Lessons" : c.hours}
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

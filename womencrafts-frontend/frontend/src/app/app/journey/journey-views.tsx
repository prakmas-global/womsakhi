"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, Progress, v } from "@/components/ux/kit";
import { stepPct, stepState, type JourneyStep, type StepState } from "@/services/journey";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

/** The arc of the whole thing, as the signposts on the path. */
const SIGNS = ["Learn", "Practice", "Get opportunities", "Earn", "Grow"];

export function JourneyHero() {
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(104deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 46%, var(--ux-tint-pink) 78%, var(--ux-tint-amber) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 p-6 sm:p-7">
          <p className="text-2xs font-extrabold uppercase tracking-[0.16em]" style={{ color: v("--ux-muted") }}>
            My journey
          </p>
          <h1 className="mt-2.5 text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] xl:text-4xlm"
              style={{ color: v("--ux-ink") }}>
            Small steps.<br />Big possibilities.
          </h1>
          <p className="mt-3 max-w-[420px] text-smd leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            A guided journey to help you learn, build skills, find opportunities and create the
            life you deserve.
          </p>

          <figure className="mt-5 max-w-[380px] rounded-[14px] p-4"
                  style={{ background: "color-mix(in srgb, var(--ux-surface) 78%, transparent)",
                           border: "1px solid var(--ux-line)" }}>
            <blockquote className="text-xsm font-bold italic leading-snug"
                        style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
              &ldquo;You are not just learning a skill, you are building a stronger you.&rdquo;
            </blockquote>
            <figcaption className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>— WomSakhi</figcaption>
          </figure>
        </div>

        <div className="relative hidden w-[200px] shrink-0 items-end xl:flex wide:w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-woman-walking-with-bag.webp" alt="" aria-hidden loading="lazy" decoding="async"
               className="max-h-[300px] w-[186px] self-end object-contain object-bottom"
               style={{ maskImage: "linear-gradient(100deg, transparent, #000 32%)",
                        WebkitMaskImage: "linear-gradient(100deg, transparent, #000 32%)" }} />

          {/* The five signposts of the path, staggered the way they are on it. */}
          <ul className="hidden w-[186px] flex-col gap-1.5 self-center pe-6 wide:flex">
            {SIGNS.map((s, i) => (
              <li key={s} className="rounded-[9px] px-3 py-1.5 text-end text-2xs font-bold"
                  style={{ background: v("--ux-surface"), color: v("--ux-ink-2"),
                           marginInlineStart: `${i * 9}px`,
                           boxShadow: "var(--ux-shadow-card)" }}>
                {s}
              </li>
            ))}
          </ul>

          <p className="pointer-events-none absolute end-6 top-5 hidden text-end text-smd font-bold italic leading-tight wide:block"
             style={{ color: v("--ux-pink-ink"), fontFamily: "var(--font-display)" }}>
            A brighter you <Icons.Heart className="inline h-[13px] w-[13px]" />
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The four numbers                                                   */
/* ------------------------------------------------------------------ */

export function JourneyStats({ total, done, doing, todo, cheer }: {
  total: number; done: number; doing: number; todo: number; cheer: string;
}) {
  const cells = [
    { n: total, label: "Journey steps", icon: "ListChecks", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { n: done,  label: "Completed",     icon: "CheckCircle2", tint: "--ux-tint-green", ink: "--ux-green-ink" },
    { n: doing, label: "In progress",   icon: "Loader",     tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
    { n: todo,  label: "Not started",   icon: "Circle",     tint: "--ux-brand-tint-2", ink: "--ux-brand" },
  ];
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {cells.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5">
            <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={36} radius={11} />
            <span>
              <b className="block text-lg font-extrabold leading-none" style={{ color: v("--ux-ink") }}>{c.n}</b>
              <span className="mt-1 block text-2xs font-semibold" style={{ color: v("--ux-muted") }}>{c.label}</span>
            </span>
          </div>
        ))}
        <span className="ms-auto flex items-center gap-1.5 text-xsm font-bold" style={{ color: v("--ux-brand") }}>
          <Icons.Sparkles className="h-[15px] w-[15px]" />
          {cheer}
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  The seven, in a row                                                */
/* ------------------------------------------------------------------ */

const WORD: Record<StepState, string> = {
  done: "Completed", doing: "In progress", todo: "Not started",
};

export function Stepper({ steps, at, onPick }: {
  steps: JourneyStep[]; at: string; onPick: (id: string) => void;
}) {
  return (
    <Card className="mb-5" pad={16}>
      {/* Seven nodes sharing the row, not seven fixed widths: at 132px each the
          last two fell off the end of a 1030px column, and a journey whose end
          you cannot see is not much of a map. */}
      <ol className="ux-noscroll flex min-w-[760px] items-start overflow-x-auto pb-1 lg:min-w-0">
        {steps.map((s, i) => {
          const st = stepState(s);
          const here = s.id === at;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-start">
              <button type="button" onClick={() => onPick(s.id)} aria-current={here ? "step" : undefined}
                      className="ux-press ux-sq flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[12px] px-1 py-1.5 text-center">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-xs font-extrabold"
                      style={{
                        background: v(st === "done" ? "--ux-green" : st === "doing" ? "--ux-fill" : "--ux-surface-2"),
                        color: v(st === "done" ? "--ux-on-green" : st === "doing" ? "--ux-on-brand" : "--ux-muted"),
                        outline: here ? `2px solid ${v("--ux-brand")}` : undefined,
                        outlineOffset: "2px",
                      }}>
                  {st === "done" ? <Icons.Check className="h-[16px] w-[16px]" strokeWidth={3} /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xs font-bold leading-tight"
                        style={{ color: v(st === "todo" ? "--ux-muted" : "--ux-ink") }}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-3xs font-semibold"
                        style={{ color: v(st === "done" ? "--ux-green-ink" : st === "doing" ? "--ux-brand" : "--ux-faint") }}>
                    {WORD[st]}
                  </span>
                </span>
              </button>
              {i < steps.length - 1 && (
                <Icons.ChevronRight aria-hidden className="mt-[9px] h-[14px] w-[14px] shrink-0"
                                    style={{ color: v("--ux-line-strong") }} />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  The step she is standing in                                        */
/* ------------------------------------------------------------------ */

export function StepCard({ step, total, onCheck, onLater }: {
  step: JourneyStep; total: number;
  onCheck: (label: string) => void; onLater: () => void;
}) {
  const pct = stepPct(step);
  return (
    <Card className="mb-5" pad={22}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <IconTile icon={step.icon} tint={step.tint} ink={step.ink} size={54} radius={16} />
            <div className="min-w-0">
              <p className="text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
                Step {step.n} of {total}
              </p>
              <h2 className="mt-1.5 text-2xlm font-extrabold leading-tight tracking-[-0.02em]"
                  style={{ color: v("--ux-ink") }}>
                {step.label}
              </h2>
            </div>
          </div>

          <p className="mt-3.5 max-w-[520px] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {step.blurb}
          </p>

          <ul className="mt-4 space-y-1">
            {step.checks.map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => onCheck(c.label)}
                        className="ux-press ux-sq flex w-full items-center gap-2.5 rounded-[10px] px-1 py-2 text-start">
                  <span className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full"
                        style={{ background: v(c.done ? "--ux-fill" : "--ux-surface"),
                                 border: `2px solid ${v(c.done ? "--ux-fill" : "--ux-line-strong")}`,
                                 color: v("--ux-on-brand") }}>
                    {c.done && <Icons.Check className="h-[12px] w-[12px]" strokeWidth={3.2} />}
                  </span>
                  <span className="text-xsm"
                        style={{ color: v(c.done ? "--ux-muted" : "--ux-ink"),
                                 textDecoration: c.done ? "line-through" : undefined }}>
                    {c.label}
                    {c.optional && (
                      <span className="ms-1.5 text-2xs" style={{ color: v("--ux-faint") }}>(optional)</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Btn href={step.href} iconEnd="ArrowRight">{step.cta}</Btn>
            <Btn variant="ghost" icon="Bookmark" onClick={onLater}>Save for later</Btn>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <Ring pct={pct} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/empty-desk-closed-laptop-plant.webp" alt="" aria-hidden loading="lazy" decoding="async"
               className="mt-2 h-[190px] w-full rounded-[16px] object-cover"
               style={{ background: v("--ux-tint-pink") }} />
        </div>
      </div>
    </Card>
  );
}

/** How far through this one step, drawn rather than stated. */
function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center justify-end gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke={v("--ux-brand-tint-2")} />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
                stroke={v("--ux-brand")} transform="rotate(-90 32 32)"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
        <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="800" fill={v("--ux-brand")}>
          {pct}%
        </text>
      </svg>
      <span className="text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
        Step<br />progress
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  What to read next                                                  */
/* ------------------------------------------------------------------ */

export interface Rec {
  id: string; title: string; kind: string; meta: string;
  icon: string; tint: string; ink: string; href: string;
}

export function Recommended({ rows }: { rows: Rec[] }) {
  return (
    <section className="mb-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>
          Recommended for you
        </h2>
        <Link href="/app/programs" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[13px] w-[13px]" />
        </Link>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {rows.map((r) => (
          <Link key={r.id} href={r.href} className="ux-card ux-hov ux-sq flex items-start gap-3 p-4">
            <IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={40} radius={11} />
            <span className="min-w-0">
              <span className="block text-xsm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
                {r.title}
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
                <I name={r.kind === "Video" ? "Play" : r.kind === "Article" ? "FileText" : "BookOpen"}
                   className="h-[12px] w-[12px]" />
                {r.kind} · {r.meta}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: why she is doing this                                        */
/* ------------------------------------------------------------------ */

export function Motivation({ text, name, onEdit }: {
  text: string; name: string; onEdit: () => void;
}) {
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>My motivation</h2>
        <button type="button" onClick={onEdit}
                className="ux-sq -me-2 flex min-h-[36px] items-center rounded-[10px] px-2 text-xs font-bold"
                style={{ color: v("--ux-brand") }}>
          Edit
        </button>
      </div>
      <blockquote className="text-xsm font-semibold italic leading-relaxed"
                  style={{ color: v("--ux-pink-ink"), fontFamily: "var(--font-display)" }}>
        &ldquo;{text}&rdquo;
      </blockquote>
      <p className="mt-2 text-2xs" style={{ color: v("--ux-muted") }}>— {name}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what she is aiming at                                        */
/* ------------------------------------------------------------------ */

export interface RailGoal {
  id: string; title: string; pct: number; have: string;
  icon: string; tint: string; ink: string;
}

export function GoalsRail({ rows }: { rows: RailGoal[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>My goals</h2>
        <Link href="/app/goals" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      <div className="space-y-3.5">
        {rows.map((g) => (
          <div key={g.id} className="flex items-start gap-2.5">
            <IconTile icon={g.icon} tint={g.tint} ink={g.ink} size={36} radius={11} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold" style={{ color: v("--ux-ink") }}>{g.title}</span>
              <span className="mt-2 flex items-center gap-2.5">
                <span className="min-w-0 flex-1"><Progress pct={g.pct} h={5} /></span>
                <span className="shrink-0 text-2xs font-semibold tabular-nums" style={{ color: v("--ux-muted") }}>
                  {g.have}
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what she has already earned                                  */
/* ------------------------------------------------------------------ */

export interface Badge {
  id: string; label: string; icon: string; earned: boolean;
  tint: string; ink: string;
}

export function Achievements({ rows }: { rows: Badge[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>My achievements</h2>
        <Link href="/app/certificates" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {rows.map((r) => (
          <div key={r.id} className="text-center">
            <span className="mx-auto grid h-[46px] w-[46px] place-items-center rounded-full"
                  style={{ background: v(r.earned ? r.tint : "--ux-surface-2"),
                           color: v(r.earned ? r.ink : "--ux-faint"),
                           opacity: r.earned ? 1 : 0.75 }}>
              <I name={r.earned ? r.icon : "Lock"} className="h-[20px] w-[20px]" sw={2} />
            </span>
            <span className="mt-1.5 block text-3xs font-semibold leading-tight"
                  style={{ color: v(r.earned ? "--ux-ink-2" : "--ux-faint") }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: somebody to ask, and a line to end on                        */
/* ------------------------------------------------------------------ */

export function NeedGuidance() {
  return (
    <section className="rounded-[16px] p-[18px]"
             style={{ background: "linear-gradient(150deg, var(--ux-tint-pink), var(--ux-tint-lilac))" }}>
      <div className="flex items-start gap-3">
        <IconTile icon="MessageCircle" tint="--ux-surface" ink="--ux-brand" size={38} radius={11} />
        <div className="min-w-0">
          <p className="text-xsm font-extrabold" style={{ color: v("--ux-ink") }}>Need guidance?</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            Ask Sakhi what to do next on your journey. She has read every screen you have.
          </p>
        </div>
      </div>
      <div className="mt-3.5">
        <Btn href="/app/sakhi" size="sm" full variant="outline" iconEnd="ArrowRight">Chat with Sakhi</Btn>
      </div>
    </section>
  );
}

export function OnYourWay() {
  return (
    <section className="relative overflow-hidden rounded-[16px] p-[22px]"
             style={{ background: "linear-gradient(150deg, var(--ux-deep), var(--ux-deep-2))" }}>
      <p className="relative w-[80%] text-lg font-bold leading-snug tracking-[-0.01em]"
         style={{ color: v("--ux-deep-ink") }}>
        You&rsquo;re on your way to something amazing.
      </p>
      <p className="relative mt-3 flex items-center gap-2">
        <span aria-hidden className="h-[2px] w-[28px] rounded-full" style={{ background: v("--ux-deep-ink-3") }} />
        <Icons.Heart className="h-[14px] w-[14px]" style={{ color: v("--ux-pink") }} />
      </p>
      <Icons.Leaf aria-hidden className="pointer-events-none absolute -bottom-4 -end-3 h-[110px] w-[110px]"
                  style={{ color: v("--ux-deep-ink-3"), opacity: 0.5 }} />
    </section>
  );
}

"use client";

import Link from "next/link";

import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, Progress, Skeleton, v } from "@/components/ux/kit";
import { GroupHead, MediaRow, RowGroup } from "@/components/ux/learning/native";
import { ListGroup, ListRow, type RowTint } from "@/components/ux/mobile/ListRow";
import { stepPct, stepState, type JourneyStep, type StepState } from "@/services/journey";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

/** The arc of the whole thing, as the signposts on the path. */
const SIGNS = ["Learn", "Practice", "Get opportunities", "Earn", "Grow"];

export function JourneyHero() {
  const tr = useT();
  return (
    <>
    {/*
      On a phone: one large title and a quiet line under it. The banner — a
      34px two-line slogan inside a gradient slab with a quote card — was a
      website's hero, and it pushed the first thing she can act on below the
      fold. Every word of it is still here.
    */}
    <header className="mb-6 lg:hidden">
      <h1 className="ux-screen-title" style={{ color: v("--ux-ink") }}>{tr("ch.journey.label")}</h1>
      <p className="mt-2 text-[15px] leading-snug" style={{ color: v("--ux-muted") }}>
        Small steps. Big possibilities. A guided journey to help you learn, build skills, find
        opportunities and create the life you deserve.
      </p>
      <p className="mt-2 text-[13px] italic leading-snug" style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
        &ldquo;You are not just learning a skill, you are building a stronger you.&rdquo; — WomSakhi
      </p>
    </header>
    <section className="relative mb-4 hidden overflow-hidden rounded-[20px] lg:block"
             style={{ background: "linear-gradient(104deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 46%, var(--ux-tint-pink) 78%, var(--ux-tint-amber) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 p-6 sm:p-7">
          <p className="text-2xs font-extrabold uppercase tracking-[0.16em]" style={{ color: v("--ux-muted") }}>
            {tr("ch.journey.label")}
          </p>
          <h1 className="mt-2.5 text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] xl:text-4xlm"
              style={{ color: v("--ux-ink") }}>
            {tr("discover.smallSteps")}<br />{tr("discover.bigPossibilities")}
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
          {/*
            A woman climbing steps toward a flag, which is what this screen is
            about — the one it replaced was a woman walking with a bag, and it
            was both off-subject and soft: 523px of source drawn at up to 400px
            is 1.3x on a 2x display, well under the 2x a picture needs to look
            sharp. This is 699x760 drawn at 400, and the artwork itself is
            cleaner.

            Masked on every edge, not one. The art carries a near-white ground
            and the band behind it is a lilac-to-amber gradient, so ANY hard
            edge draws a pale rectangle across it — left, right, top and
            bottom alike. Same problem Sakhi had on the Work board's foot
            strip, same fix, applied all the way round this time.
          */}
          <img src="/ux/art/scene-woman-climbing-steps.webp"
               alt="" aria-hidden loading="lazy" decoding="async"
               width={699} height={760}
               className="max-h-[300px] w-[186px] self-end object-contain object-bottom wide:w-[290px]"
               style={{ maskImage: "linear-gradient(to right, transparent 0%, #000 22%, #000 84%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%)",
                        WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 22%, #000 84%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%)",
                        maskComposite: "intersect", WebkitMaskComposite: "source-in" }} />

          {/* The five signposts of the path, staggered the way they are on it. */}
          <ul className="hidden w-[186px] flex-col gap-1.5 self-center pe-6 wide:flex">
            {SIGNS.map((s, i) => (
              <li key={s} className="rounded-[10px] px-3 py-1.5 text-end text-2xs font-bold"
                  style={{ background: v("--ux-surface"), color: v("--ux-ink-2"),
                           marginInlineStart: `${i * 9}px`,
                           boxShadow: "var(--ux-shadow-card)" }}>
                {s}
              </li>
            ))}
          </ul>

          <p className="pointer-events-none absolute end-6 top-5 hidden text-end text-smd font-bold italic leading-tight wide:block"
             style={{ color: v("--ux-pink-ink"), fontFamily: "var(--font-display)" }}>
            {tr("journeyviews.aBrighterYou")} <Icons.Heart className="inline h-[13px] w-[13px]" />
          </p>
        </div>
      </div>
    </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  The four numbers                                                   */
/* ------------------------------------------------------------------ */

export function JourneyStats({ total, done, doing, todo, cheer }: {
  total: number; done: number; doing: number; todo: number; cheer: string;
}) {
  const tr = useT();
  const cells = [
    { n: total, label: tr("journeyviews.journeySteps"), icon: "ListChecks", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { n: done,  label: "Completed",     icon: "CheckCircle2", tint: "--ux-tint-green", ink: "--ux-green-ink" },
    { n: doing, label: tr("programs.inProgress"),   icon: "Loader",     tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
    { n: todo,  label: tr("library.notStarted"),   icon: "Circle",     tint: "--ux-brand-tint-2", ink: "--ux-brand" },
  ];
  const rowTint: RowTint[] = ["violet", "green", "amber", "pink"];
  return (
    <>
    {/* Four numbers as four value rows on a phone — label left, number right,
        the way a phone shows a count. The cheer is the group's footnote. */}
    <ListGroup className="mb-6 lg:hidden" footnote={cheer}>
      {cells.map((c, i) => (
        <ListRow key={c.label} icon={c.icon} tint={rowTint[i]} title={c.label}
                 value={<b className="font-semibold" style={{ color: v("--ux-ink") }}>{c.n}</b>} />
      ))}
    </ListGroup>
    <Card className="mb-4 hidden lg:block">
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
    </>
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
  const tr = useT();
  return (
    <>
    {/*
      On a phone the seven are a list, not a strip. The strip was 760px wide
      inside a 350px card — five of the seven off the glass, labels at 12px —
      so "where am I?" needed a sideways scroll to answer. As rows, all seven
      are there at once; the one on show carries the tick.
    */}
    <ListGroup className="mb-6 lg:hidden" title={tr("journeyviews.journeySteps")}>
      {steps.map((s) => {
        const st = stepState(s);
        return (
          <ListRow key={s.id} onClick={() => onPick(s.id)} selected={s.id === at}
                   avatar={
                     <span aria-hidden className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full text-[13px] font-bold"
                           style={{
                             background: v(st === "done" ? "--ux-green" : st === "doing" ? "--ux-fill" : "--ux-surface-2"),
                             color: v(st === "done" ? "--ux-on-green" : st === "doing" ? "--ux-on-brand" : "--ux-muted"),
                           }}>
                       {st === "done" ? <Icons.Check className="h-[16px] w-[16px]" strokeWidth={3} /> : s.n}
                     </span>
                   }
                   title={s.label}
                   subtitle={<span style={{ color: v(st === "done" ? "--ux-green-ink" : st === "doing" ? "--ux-brand" : "--ux-muted") }}>{WORD[st]}</span>} />
        );
      })}
    </ListGroup>
    <Card className="mb-5 hidden lg:block" pad={16}>
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
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  The step she is standing in                                        */
/* ------------------------------------------------------------------ */

export function StepCard({ step, total, onCheck, onLater }: {
  step: JourneyStep; total: number;
  onCheck: (label: string) => void; onLater: () => void;
}) {
  const tr = useT();
  const pct = stepPct(step);
  return (
    <Card className="mb-6 lg:mb-5" pad={22}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <IconTile icon={step.icon} tint={step.tint} ink={step.ink} size={54} radius={16} />
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] lg:text-2xs" style={{ color: v("--ux-muted") }}>
                Step {step.n} of {total}
              </p>
              <h2 className="mt-1 text-xl font-extrabold leading-tight tracking-[-0.02em] lg:mt-1.5 lg:text-2xlm"
                  style={{ color: v("--ux-ink") }}>
                {step.label}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-[520px] text-xsm leading-relaxed lg:mt-3.5" style={{ color: v("--ux-ink-2") }}>
            {step.blurb}
          </p>

          <ul className="mt-4 space-y-1">
            {step.checks.map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => onCheck(c.label)}
                        className="ux-press ux-sq flex min-h-[44px] w-full items-center gap-3 rounded-[12px] px-1 py-2 text-start lg:min-h-0 lg:gap-2.5 lg:rounded-[10px]">
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

          {/* The step's action full width on a phone, where a thumb reaches. */}
          <div className="mt-6 flex flex-col items-stretch gap-2 lg:mt-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2.5">
            <Btn href={step.href} iconEnd="ArrowRight" className="ux-action-primary">{step.cta}</Btn>
            <Btn variant="ghost" icon="Bookmark" onClick={onLater}>{tr("journeyviews.saveForLater")}</Btn>
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
  const tr = useT();
  return (
    <section className="mb-6 lg:mb-5">
      {/* A grouped list on a phone — each of these is a place to go. */}
      <div className="lg:hidden">
        <GroupHead title={tr("wellness.recommendedForYou")} action={tr("calendar.viewAll")} href="/app/programs" />
        <RowGroup>
          {rows.map((r) => (
            <MediaRow key={r.id} href={r.href}
                      media={<IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={44} radius={12} />}
                      title={r.title} lines={[`${r.kind} · ${r.meta}`]} />
          ))}
        </RowGroup>
      </div>
      <div className="mb-3.5 hidden items-center justify-between gap-3 lg:flex">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>
          {tr("wellness.recommendedForYou")}
        </h2>
        <Link href="/app/programs" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          {tr("calendar.viewAll")} <Icons.ArrowRight className="h-[13px] w-[13px]" />
        </Link>
      </div>
      <div className="hidden gap-3.5 lg:grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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

/**
 * Why she is doing this, in her own words.
 *
 * Three states, and they are three because two of them used to be one. `null`
 * is "we have not read her profile yet"; `""` is "she has not written a line";
 * a string is hers. Collapsing the first two onto a default sentence is what
 * put "I want to earn my own money and show my daughter it can be done" in
 * quotation marks above a woman's own name, on a profile whose bio is empty.
 */
export function Motivation({ text, name, onEdit }: {
  text: string | null; name: string; onEdit: () => void;
}) {
  const tr = useT();
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("journeyviews.myMotivation")}</h2>
        <button type="button" onClick={onEdit}
                className="ux-sq -me-2 flex min-h-[36px] items-center rounded-[10px] px-2 text-xs font-bold"
                style={{ color: v("--ux-brand") }}>
          Edit
        </button>
      </div>
      {text === null ? (
        <div className="space-y-2"><Skeleton w="94%" h={13} /><Skeleton w="62%" h={13} /></div>
      ) : text ? (
        <>
          <blockquote className="text-xsm font-semibold italic leading-relaxed"
                      style={{ color: v("--ux-pink-ink"), fontFamily: "var(--font-display)" }}>
            &ldquo;{text}&rdquo;
          </blockquote>
          <p className="mt-2 text-2xs" style={{ color: v("--ux-muted") }}>— {name}</p>
        </>
      ) : (
        <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
          You have not written one yet. One line about why you are doing this goes on your
          profile — and it shows up here.
        </p>
      )}
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

export function GoalsRail({ rows, loading = false }: { rows: RailGoal[]; loading?: boolean }) {
  const tr = useT();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("ch.goals.label")}</h2>
        <Link href="/app/goals" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          {tr("calendar.viewAll")} <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      {loading && rows.length === 0 && (
        <div className="space-y-3"><Skeleton w="80%" h={13} /><Skeleton w="60%" h={13} /></div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
          No goals yet. Naming one — an amount, a course, a number of clients — is what lets
          this screen tell you how close you are.
        </p>
      )}
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
  const tr = useT();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("journeyviews.myAchievements")}</h2>
        <Link href="/app/certificates" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          {tr("calendar.viewAll")} <Icons.ArrowRight className="h-[12px] w-[12px]" />
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
  const tr = useT();
  return (
    <section className="rounded-[16px] p-[18px]"
             style={{ background: "linear-gradient(150deg, var(--ux-tint-pink), var(--ux-tint-lilac))" }}>
      <div className="flex items-start gap-3">
        <IconTile icon="MessageCircle" tint="--ux-surface" ink="--ux-brand" size={38} radius={11} />
        <div className="min-w-0">
          <p className="text-xsm font-extrabold" style={{ color: v("--ux-ink") }}>{tr("journeyviews.needGuidance")}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {tr("journeyviews.askSakhiWhatToDoNext")}
          </p>
        </div>
      </div>
      <div className="mt-3.5">
        <Btn href="/app/sakhi" size="sm" full variant="outline" iconEnd="ArrowRight">{tr("journeyviews.chatWithSakhi")}</Btn>
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

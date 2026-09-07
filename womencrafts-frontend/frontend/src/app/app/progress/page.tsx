"use client";

import { useState } from "react";

import { useJourney } from "@/components/ux/journey";
import * as Icons from "@/components/ux/icons";

import { Card, IconTile, Pill, SectionHead, Tabs, plural } from "@/components/ux/kit";
import { useCountUp } from "@/components/ux/kit/motion";
import { HomeShell } from "@/components/ux/home/HomeShell";

/**
 * Your journey — the one screen that looks across everything.
 *
 * Every other screen answers "what should I do now?". This one answers "am I
 * getting anywhere?", which is a different question and needs a longer view:
 * months, not days, and outcomes rather than activity. Lessons watched is
 * activity. Money earned and work found are outcomes.
 */

const NEXT_STEPS = [
  { id: "n1", title: "Add your work experience", why: "Profiles with it get opened twice as often.",
    mins: 5, icon: "User", href: "/app/profile" },
  { id: "n2", title: "Add your Udyam registration", why: "It unlocks bigger orders and small-business loans.",
    mins: 10, icon: "Building2", href: "/app/documents" },
  { id: "n3", title: "Finish Digital Marketing Mastery", why: "Four lessons left, and it is the one employers ask about.",
    mins: 45, icon: "BookOpen", href: "/app/programs" },
];

export default function JourneyPage() {
  const [tab, setTab] = useState("The story so far");
  /**
   * Her journey, from what actually happened — see `useJourney`.
   *
   * Everything here used to be a constant, including "₹1,48,500 earned" and
   * three named women she had supposedly brought in.
   */
  const { data: journey } = useJourney();
  const MILESTONES = journey.milestones;
  const OUTCOMES = journey.outcomes;
  const EARNED = journey.earned;
  const MONTHS = journey.months;

  const done = MILESTONES.filter((m) => m.done).length;
  /** This month, as the "Now" row reads it. */
  const nowLabel = () =>
    new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const earned = useCountUp(OUTCOMES[0]?.value ?? 0, 1000);

  // Growth needs a month with something in it to compare against; with one
  // month of earnings, or none, there is nothing honest to say.
  const first = EARNED.find((v) => v > 0) ?? 0;
  const last = EARNED[EARNED.length - 1] ?? 0;
  const growth = first > 0 ? Math.round((last / first - 1) * 100) : null;

  return (
    <HomeShell
      active="/app/progress"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="What to do next" sub="Three things, in order of what they unlock" />
            <ul className="ux-deck ux-stagger space-y-2.5">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.id}>
                  <a href={s.href}
                     className="ux-i ux-sq flex items-start gap-3 rounded-[12px] border p-3"
                     style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                    <IconTile icon={s.icon} tint="--ux-tint-lilac" ink="--ux-brand" size={36} radius={10} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{s.title}</span>
                      <span className="mt-1 block text-[0.75rem] leading-snug" style={{ color: "var(--ux-muted)" }}>{s.why}</span>
                    </span>
                    <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--ux-faint)" }}>{s.mins}m</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Where you started" />
            <div className="space-y-3 text-[0.8125rem]">
              {/* Both rows were literals — "March 2025", and a "Now" of
                  "A shop, 87 orders, 4 certificates" that counted nothing. */}
              {[
                ["Then", journey.memberSince || "When you joined", "No online presence, no records"],
                ["Now", nowLabel(), nowSummary(journey)],
              ].map(([k, when, what]) => (
                <div key={k}>
                  <p className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: "var(--ux-ink)" }}>{k}</span>
                    <span style={{ color: "var(--ux-faint)" }}>{when}</span>
                  </p>
                  <p className="mt-0.5" style={{ color: "var(--ux-muted)" }}>{what}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Your journey</h1>
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {done} of {MILESTONES.length} milestones · {journey.monthsHere > 0
              ? `${journey.monthsHere} ${plural("month", journey.monthsHere)} since you joined`
              : "you joined this month"}
          </p>
        </div>
        <Tabs items={["The story so far", "What changed"]} active={tab} onChange={setTab} />
      </div>

      <div className="ux-sq ux-onscroll relative overflow-hidden rounded-[20px] p-[24px]"
           style={{ background: "linear-gradient(100deg, var(--ux-brand-900) 0%, var(--ux-brand-700) 55%, var(--ux-brand-600) 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -end-12 -top-16 h-[240px] w-[240px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/scene-woman-planting-sapling.webp" alt=""
             className="ux-float pointer-events-none absolute -bottom-2 end-6 h-[132px] w-auto object-contain" />
        <div className="relative max-w-[64%]">
          <p className="text-[0.8125rem]" style={{ color: "rgba(255,255,255,0.82)" }}>Earned through WomSakhi so far</p>
          <p className="mt-1.5 text-[2.25rem] font-bold leading-none tabular-nums text-white">
            ₹{earned.toLocaleString("en-IN")}
          </p>
          {/* Only said when there is a month to compare against. It used to
              state a growth figure and "fourteen months of your work" as
              literals, to a woman who joined this month. */}
          <p className="mt-3 text-[0.8125rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
            {growth !== null && growth > 0 && journey.monthsHere > 1
              ? `Your monthly earnings are ${growth}% higher than when you started. That is not the app — that is ${plural("month", journey.monthsHere)} of your work.`
              : journey.lifetimeMinor > 0
                ? "Every rupee here is one you earned. The chart fills in as the months go by."
                : "Nothing has come in yet. The first payment that reaches your wallet shows up here."}
          </p>
        </div>
      </div>

      {tab === "The story so far" && (
        <Card className="ux-onscroll mt-[16px]">
          <SectionHead title="Your milestones" sub={`${done} reached, ${MILESTONES.length - done} to go`} />
          <ol className="relative ps-[26px]">
            {/* The spine. Absolute so it sits behind the dots and does not
                push the text across. */}
            <span aria-hidden className="absolute bottom-3 start-[10px] top-3 w-[2px] rounded-full"
                  style={{ background: "var(--ux-line)" }} />
            {MILESTONES.map((m, i) => (
              <li key={m.id} className="ux-rise relative pb-5 last:pb-0" style={{ ["--i" as string]: i }}>
                <span className="absolute -start-[26px] top-[3px] grid h-[21px] w-[21px] place-items-center rounded-full"
                      style={{ background: m.done ? "var(--ux-brand-600)" : "var(--ux-surface)",
                               border: m.done ? "none" : "2px dashed var(--ux-line-strong)" }}>
                  {m.done && <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3.2} />}
                </span>
                <div className="flex items-start gap-3">
                  <IconTile icon={m.icon} tint={m.tint} ink={m.ink} size={38} radius={11} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.875rem] font-semibold" style={{ color: m.done ? "var(--ux-ink)" : "var(--ux-ink-2)" }}>
                        {m.title}
                      </span>
                      {!m.done && <Pill tone="brand" size="sm">Next</Pill>}
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{m.body}</p>
                    <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--ux-faint)" }}>{m.when}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === "What changed" && (
        <>
          <div className="ux-deck mt-[16px] grid grid-cols-2 gap-[16px]">
            {OUTCOMES.map((o, i) => (
              <Card key={o.label} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={o.icon} tint={o.tint} ink={o.ink} size={44} radius={12} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.5rem] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>
                      {o.prefix}{o.value.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] font-medium" style={{ color: "var(--ux-ink-2)" }}>{o.label}</p>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{o.note}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="ux-onscroll mt-[16px]">
            <SectionHead title="What you earn each month" sub={`Up ${growth}% since ${MONTHS[0]}`} />
            <div className="flex items-end gap-[8px]" style={{ height: 150 }}>
              {EARNED.map((v, i) => {
                const max = Math.max(...EARNED);
                const last = i === EARNED.length - 1;
                return (
                  <div key={MONTHS[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: 150 }}>
                    <span className="mb-1 text-[0.6875rem] tabular-nums" style={{ color: "var(--ux-faint)" }}>
                      {last ? `₹${(v * 10).toLocaleString("en-IN")}` : ""}
                    </span>
                    <div className="ux-sq w-full rounded-[8px]"
                         style={{
                           height: Math.max(3, Math.round((v / max) * 108)),
                           background: last
                             ? "linear-gradient(180deg, var(--ux-brand-600), var(--ux-brand-700))"
                             : "var(--ux-brand-tint-2)",
                           transition: `height var(--ux-t-slow) var(--ux-ease-out) ${i * 40}ms`,
                         }}
                         title={`${MONTHS[i]}: ₹${(v * 10).toLocaleString("en-IN")}`} />
                    <span className="mt-1.5 text-[0.6875rem]"
                          style={{ color: last ? "var(--ux-brand)" : "var(--ux-faint)", fontWeight: last ? 700 : 400 }}>
                      {MONTHS[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </HomeShell>
  );
}

/**
 * The "Now" line, counted rather than claimed.
 *
 * It read "A shop, 87 orders, 4 certificates" for everyone. Only the parts
 * that are true are said, and if none of them are, the row says so plainly
 * instead of describing somebody else's year.
 */
function nowSummary(journey: ReturnType<typeof useJourney>["data"]): string {
  const bits: string[] = [];
  const shop = journey.outcomes.find((o) => o.label === "Things you sell");
  const courses = journey.outcomes.find((o) => o.label === "Courses finished");
  if (shop?.value) bits.push(`a shop with ${shop.value} ${plural("thing", shop.value)} in it`);
  if (courses?.value) bits.push(`${courses.value} ${plural("course", courses.value)} finished`);
  if (journey.lifetimeMinor > 0) {
    bits.push(`₹${Math.round(journey.lifetimeMinor / 100).toLocaleString("en-IN")} earned`);
  }
  return bits.length ? bits.join(", ") : "Just getting started";
}

"use client";

import Link from "next/link";
import { useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, DeskTitle, QuoteCard, SoftHeart } from "./parts";
import { MOODS, PHASE_COPY, forYou, quoteFor, type ForYouTab } from "./data";
import { useCycle } from "./use-cycle";

const TABS: { key: ForYouTab; label: string; head: string; sub: string }[] = [
  { key: "food", label: "Food", head: "Food suggestions for today", sub: "Nutritious choices to support your body and mood." },
  { key: "wellness", label: "Wellness", head: "Care for your body today", sub: "Small things that make a hard day softer." },
  { key: "mind", label: "Mind", head: "For your mind today", sub: "A minute or two is enough." },
  { key: "activity", label: "Activity", head: "Movement for today", sub: "Gentle, at home, no equipment." },
];

/**
 * "For you today" — food, rest, mind and movement for where she is in her
 * cycle and how she said she feels.
 *
 * Four routes share it: the tracker's own screen, and Nutrition, Mental
 * Wellness and Workouts in the Health & Wellness menu, each opening on its
 * tab. It works without the tracker too — a woman who does not track gets
 * the general suggestions and one line offering the personal ones.
 */
export function ForYou({ initial = "food", title = "For You Today" }: { initial?: ForYouTab; title?: string }) {
  const { state, data } = useCycle();
  const [tab, setTab] = useState<ForYouTab>(initial);
  const phase = state?.status.phase ?? "menstrual";
  const mood = state?.log?.mood ?? null;
  const feelings = state?.log?.feelings ?? [];
  const items = forYou(tab, phase, mood, feelings);
  const t = TABS.find((x) => x.key === tab)!;
  const moodLabel = MOODS.find((m) => m.key === mood)?.label;

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title={title} />
        <DeskTitle title={title} sub={state ? `${PHASE_COPY[phase].chip}${moodLabel ? ` · feeling ${moodLabel.toLowerCase()}` : ""}` : undefined} />

        <div role="tablist" aria-label="Suggestions" className="grid grid-cols-4 gap-1 rounded-full p-1"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          {TABS.map((x) => {
            const on = x.key === tab;
            return (
              <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.key)}
                      className="ux-tap-exempt h-[40px] rounded-full text-[13px] transition-colors"
                      style={on
                        ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                        : { color: "var(--ux-ink-2)" }}>
                {x.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{t.head}</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {t.sub}
            {moodLabel && tab === "food" && <> Chosen for feeling <b style={{ color: "var(--ux-ink-2)" }}>{moodLabel.toLowerCase()}</b>.</>}
          </p>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="overflow-hidden rounded-[16px]" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <div className="relative h-[112px] overflow-hidden" style={{ background: it.art ? "var(--cy-hero-b)" : "var(--ux-surface-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.img} alt="" loading="lazy" decoding="async"
                     className={it.art ? "absolute bottom-0 left-1/2 h-[108px] w-auto max-w-none -translate-x-1/2 object-contain" : "h-full w-full object-cover"} />
              </div>
              <div className="px-3 pb-3 pt-2.5">
                <b className="block text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{it.title}</b>
                <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{it.sub}</span>
              </div>
            </li>
          ))}
        </ul>

        {data && !data.setup && (
          <Link href="/app/health/cycle/start" className="ux-press mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3.5"
                style={{ background: "var(--cy-fertile)", border: "1px solid var(--ux-line)" }}>
            <Icons.CalendarDays className="h-5 w-5 shrink-0" style={{ color: "var(--cy-ovulation)" }} aria-hidden />
            <span className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
              <b className="font-semibold" style={{ color: "var(--ux-ink)" }}>Track your cycle</b> for suggestions that fit your week.
            </span>
            <Icons.ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
          </Link>
        )}

        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3.5"
             style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
          <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-surface)" }}>
            <Icons.Sparkles className="h-[18px] w-[18px]" style={{ color: "var(--cy-period)" }} aria-hidden />
          </span>
          <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--cy-period)" }}>
            Small nourishing choices<br /><span style={{ color: "var(--ux-ink-2)", fontWeight: 400 }}>make a big difference</span> <SoftHeart />
          </p>
        </div>

        {state && <QuoteCard className="mt-4" text={quoteFor(mood, state.today)} />}
      </Column>
    </HomeShell>
  );
}

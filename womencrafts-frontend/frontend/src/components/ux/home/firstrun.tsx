"use client";

import { useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, I } from "../kit";
import { usePointer } from "../kit/motion";
import { FIRST_RUN_STEPS, ME } from "./data";

/**
 * The home screen a brand new member actually sees.
 *
 * The dashboard is built for someone with earnings, a streak and three
 * applications in flight. On day one she has none of that, and the normal
 * layout renders as six cards of zeroes — the worst possible first impression,
 * and the state most people are in the first time they open anything.
 *
 * So the page switches. Not an empty state bolted onto the dashboard: a
 * different screen, with one job, which is to get her to a first win. Four
 * steps, each under five minutes, each with the reason it matters.
 */
export function FirstRun({ name }: { name?: string }) {
  const [done, setDone] = useState<string[]>([]);
  const point = usePointer<HTMLDivElement>();

  const steps = FIRST_RUN_STEPS.map((s) => ({ ...s, done: done.includes(s.id) }));
  const finished = steps.filter((s) => s.done).length;
  const pct = Math.round((finished / steps.length) * 100);
  const left = steps.filter((s) => !s.done).reduce((n, s) => n + s.mins, 0);
  const next = steps.find((s) => !s.done);

  return (
    <>
      <div
        ref={point}
        className="ux-sq ux-aurora ux-grain ux-spot relative rounded-[20px]"
        style={{
          minHeight: 216,
          background: "linear-gradient(104deg, oklch(0.32 0.13 294) 0%, oklch(0.44 0.19 294) 58%, oklch(0.52 0.19 320) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 end-0 w-[42%] overflow-hidden">
          <span aria-hidden className="absolute end-[6%] top-1/2 h-[220px] w-[220px] -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.28), transparent 72%)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/ux/brand/womsakhi-emblem.webp" alt=""
               className="ux-float absolute end-[4%] top-1/2 h-[168px] w-auto -translate-y-1/2 object-contain"
               style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.34))" }} draggable={false} />
        </div>

        <div className="relative flex max-w-[58%] flex-col justify-center px-9 py-8">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.62)" }}>
            Welcome to WomSakhi
          </p>
          <h1 className="ux-gradient-text mt-2 text-[1.75rem] font-bold leading-[1.12]">
            Let us get you your first win, {name ?? ME.first}
          </h1>
          <p className="mt-2.5 text-[0.875rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.86)" }}>
            {finished === steps.length
              ? "That is everything. Your dashboard is ready."
              : `Four small things, about ${left} minutes in total. Employers see complete profiles first.`}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span className="h-[7px] w-[190px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
              <span className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: "#fff",
                             transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
            </span>
            <span className="text-[0.75rem] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.9)" }}>
              {finished} of {steps.length}
            </span>
          </div>
        </div>
      </div>

      <section className="ux-tilt-scene mt-[16px] grid grid-cols-2 gap-[16px]">
        {steps.map((s, i) => (
          <Card key={s.id} className={`ux-onscroll ${s.done ? "" : "ux-i ux-edge"}`}
                style={{ ["--i" as string]: i, opacity: s.done ? 0.72 : 1 }}>
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => setDone((d) => (d.includes(s.id) ? d.filter((x) => x !== s.id) : [...d, s.id]))}
                aria-pressed={s.done}
                aria-label={s.done ? `Mark "${s.label}" not done` : `Mark "${s.label}" done`}
                className="ux-press ux-hov ux-sq grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] border-2"
                style={{
                  borderColor: s.done ? "var(--ux-green)" : "var(--ux-line-strong)",
                  background: s.done ? "var(--ux-green)" : "transparent",
                }}
              >
                {s.done
                  ? <Icons.Check className="ux-pop h-[19px] w-[19px] text-white" strokeWidth={3} />
                  : <I name={s.icon} className="ux-ico h-[18px] w-[18px]" style={{ color: "var(--ux-brand)" }} />}
              </button>

              <div className="min-w-0 flex-1">
                <h3 className="text-[0.875rem] font-semibold"
                    style={{ color: "var(--ux-ink)", textDecoration: s.done ? "line-through" : "none" }}>
                  {s.label}
                </h3>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                  About {s.mins} {s.mins === 1 ? "minute" : "minutes"}
                </p>
              </div>

              {!s.done && (
                <Btn href={s.href} variant={s.id === next?.id ? "primary" : "outline"} size="sm" iconEnd="ArrowRight">
                  {s.id === next?.id ? "Start" : "Open"}
                </Btn>
              )}
            </div>
          </Card>
        ))}
      </section>

      {/* What she gets for finishing, stated concretely rather than as a promise. */}
      <Card className="ux-onscroll mt-[16px]">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/ux/art/scene-women-celebrating.webp" alt=""
               className="h-[84px] w-[84px] shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              What happens when you finish
            </h3>
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
              {[["Employers can find you", "Search"],
                ["Work matched to your skills", "Target"],
                ["Free first mentor session", "Users"]].map(([t, ic]) => (
                <li key={t} className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
                  <I name={ic} className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Link href="/app/sakhi"
                className="ux-hov ux-sq flex shrink-0 items-center gap-2 rounded-[12px] px-3.5 py-2.5 text-[0.8125rem] font-semibold"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
            <Icons.Sparkles className="ux-ico h-[15px] w-[15px]" /> Ask Sakhi to help
          </Link>
        </div>
      </Card>
    </>
  );
}

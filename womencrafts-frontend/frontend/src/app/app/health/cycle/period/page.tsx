"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Sheet } from "@/components/ux/kit/sheet";
import {
  CareRow, Column, CycleHeader, CyButton, DeskTitle, ErrorLine, Heading, SoftHeart, heroBg,
} from "@/components/ux/cycle/parts";
import { TODAY_CARE } from "@/components/ux/cycle/data";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog } from "@/lib/cycle-api";

/**
 * "Day 1 of your period" — what she sees while it is on.
 *
 * "I'm feeling better today" is ambiguous on purpose in the reference, and a
 * guess either way is wrong for someone: feeling better is not the same as
 * the period being over. So it asks, once, in a sheet — and each answer does
 * exactly what it says.
 */
export default function YourPeriod() {
  const router = useRouter();
  const { state, data, act, busy, error } = useCycle();
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);

  const s = state?.status;
  const day = s?.on_period ? s.period_day : null;

  const stopped = async () => {
    if (!state) return;
    setAsk(false);
    const next = await act(() => apiCycleLog(state.today, { period: false }));
    if (next) router.push("/app/health/cycle");
  };
  const better = async () => {
    if (!state) return;
    setAsk(false);
    const next = await act(() => apiCycleLog(state.today, { mood: "happy" }));
    if (next) router.push("/app/health/cycle/today");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Your Period" action={{ label: "Edit", href: "/app/health/cycle" }} />
        <DeskTitle title="Your Period" sub="Today's care, for today." />

        <div className="relative -mx-[20px] overflow-hidden lg:mx-0 lg:rounded-[24px]" style={{ background: heroBg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden className="absolute -end-16 -top-10 h-[220px] w-auto opacity-50 mix-blend-multiply" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/course-meditation.webp" alt="A woman resting calmly"
               className="relative mx-auto h-[230px] w-[230px] rounded-full object-cover"
               style={{ marginTop: 14, boxShadow: "0 0 0 8px var(--ux-surface)" }} />
          <div className="relative -mt-2 rounded-t-[28px] px-5 pb-5 pt-6 text-center" style={{ background: "var(--ux-canvas)" }}>
            {day ? (
              <>
                <h2 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Day {day} of your period</h2>
                <p className="mt-1 text-[15px]" style={{ color: "var(--ux-muted)" }}>
                  {day === 1 ? "Take it easy. You're doing great!" : day <= 3 ? "Be gentle with yourself today." : "Almost through. You're doing great!"} <SoftHeart />
                </p>
              </>
            ) : state ? (
              <>
                <h2 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>You&apos;re not on your period</h2>
                <p className="mt-1 text-[15px]" style={{ color: "var(--ux-muted)" }}>
                  {s?.days_until != null && s.days_until > 0 ? `Your next one is likely in ${s.days_until} days.` : "Log today if that has changed."}
                </p>
              </>
            ) : (
              <div className="mx-auto h-[56px] w-[220px] animate-pulse rounded-[12px]" style={{ background: "var(--ux-surface-2)" }} />
            )}
          </div>
        </div>

        <div className="mt-6"><Heading>Today&apos;s Care</Heading></div>
        <div className="space-y-2.5">
          {TODAY_CARE[day ? "menstrual" : (s?.phase ?? "follicular")].map((c) => <CareRow key={c.title} item={c} />)}
        </div>

        <div className="mt-6">
          {day ? (
            <CyButton onClick={() => setAsk(true)} busy={busy} iconEnd={null}>I&apos;m feeling better today</CyButton>
          ) : (
            <CyButton href="/app/health/cycle/log">Log today</CyButton>
          )}
        </div>
        <ErrorLine text={error} />

        <Sheet open={ask} onClose={() => setAsk(false)} title="Glad you're feeling better" icon="Heart"
               description="Has your period stopped?">
          <div className="space-y-2.5 pb-2">
            <CyButton onClick={stopped} iconEnd="Check">Yes, it has stopped</CyButton>
            <button type="button" onClick={better}
                    className="ux-press h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
              No, just feeling better
            </button>
          </div>
        </Sheet>
      </Column>
    </HomeShell>
  );
}

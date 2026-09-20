"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, CyButton, DeskTitle, Icon } from "@/components/ux/cycle/parts";
import { useCycle } from "@/components/ux/cycle/use-cycle";

/**
 * "Your period has continued for 6 days" — the owner's day-5 rule.
 *
 * The reference says "It's normal for most periods to last 3–5 days". That
 * is not what the clinical sources say (NHS: 2 to 7 days), and a woman told
 * her normal period is abnormal will worry for nothing. So the words compare
 * this period with HER usual length, and the line that sends her to a doctor
 * is drawn where the guidance draws it: more than seven days.
 */
export default function PeriodCheck() {
  const router = useRouter();
  const { state, data } = useCycle();

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);

  const s = state?.status;
  const day = s?.on_period ? s.period_day ?? 0 : 0;
  const doctor = s?.long_level === "doctor";
  const long = !!s?.long_level;

  const steps = [
    { icon: "UserRound", title: "Consult a mentor", sub: "Get guidance from our health experts", href: "/app/health/mentors" },
    { icon: "Activity", title: "Track your symptoms", sub: "Help us understand better", href: "/app/health/cycle/symptoms" },
    { icon: "BookOpen", title: "Read helpful resources", sub: "Learn about possible reasons", href: "/app/health/cycle/learn/long-periods" },
  ];

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="" />
        <DeskTitle title="A check on your period" />

        <div className="text-center">
          <span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full"
                style={{ background: "var(--ux-danger-tint)", boxShadow: "0 0 0 10px var(--cy-predicted)" }}>
            <Icons.AlertCircle className="h-9 w-9" style={{ color: "var(--ux-danger-solid)" }} aria-hidden />
          </span>
          <h1 className="mx-auto mt-6 max-w-[320px] text-[24px] font-bold leading-snug" style={{ color: "var(--cy-period-ink)", fontFamily: "var(--font-sans)" }}>
            {!state ? "…" : !s?.on_period ? "Your period is not on right now"
              : doctor ? "Your period has lasted more than 7 days"
              : `Your period has continued for ${day} days`}
          </h1>
          <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            {!s?.on_period ? "Nothing to check today. If a period runs long, we will let you know here."
              : doctor ? "That is worth checking with a doctor. It is usually easy to treat, and you don't have to put up with it. Here is what you can do:"
              : long ? "Most periods last between 2 and 7 days, so this can still be normal. Since it's longer than your usual, here are some suggestions:"
              : "This is within your usual length. If anything feels different, here is where to go:"}
          </p>
        </div>

        <ul className="mt-6 space-y-2.5">
          {steps.map((st) => (
            <li key={st.title}>
              <Link href={st.href} className="ux-press flex items-center gap-3.5 rounded-[16px] px-4 py-3"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--cy-predicted)" }}>
                  <Icon name={st.icon} className="h-5 w-5" style={{ color: "var(--cy-period-ink)" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{st.title}</b>
                  <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{st.sub}</span>
                </span>
                <Icons.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        <p role="note" className="mt-4 flex items-start gap-2 rounded-[14px] px-3.5 py-3 text-[13px] leading-snug"
           style={{ background: "var(--ux-danger-tint)", color: "var(--ux-ink)" }}>
          <Icons.ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ux-danger-solid)" }} aria-hidden />
          Go to a hospital now if you are soaking a pad every hour for several hours, or you feel faint.
        </p>

        <div className="mt-6 space-y-1">
          <CyButton href="/app/health/mentors">Talk to a Mentor</CyButton>
          <Link href="/app/health/cycle" className="flex h-11 items-center justify-center text-[15px] underline underline-offset-4"
                style={{ color: "var(--ux-muted)" }}>Not now</Link>
        </div>
      </Column>
    </HomeShell>
  );
}

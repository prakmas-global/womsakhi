"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CyButton, ErrorLine, Icon, heroBg } from "@/components/ux/cycle/parts";
import { addDays, useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog, apiCycleSetup } from "@/lib/cycle-api";

/**
 * "Your Cycle, Your Power" — the first screen of the tracker.
 *
 * Two questions stand between "Let's get started" and her calendar, and both
 * are asked because something breaks without them:
 *
 * - **Is she 18 or over.** India's DPDP Act forbids tracking anyone younger.
 *   A "no" stores nothing and sends her to the guides, which are for everyone.
 * - **When did her last period start.** Without it the calendar is blank for a
 *   month. "Not sure" is a real answer and the tracker still works.
 */

const FEATURES = [
  { icon: "CalendarDays", label: "Track\nyour cycle" },
  { icon: "Bell", label: "Get smart\nreminders" },
  { icon: "Sparkles", label: "Personalized\nhealth tips" },
  { icon: "Heart", label: "Feel your\nbest self" },
];

const WHEN = [
  { key: "now", label: "I'm on my period now" },
  { key: "3", label: "Earlier this week" },
  { key: "10", label: "1–2 weeks ago" },
  { key: "17", label: "2–3 weeks ago" },
  { key: "24", label: "3–4 weeks ago" },
  { key: "pick", label: "Pick the date" },
  { key: "unsure", label: "Not sure" },
] as const;

export default function CycleStart() {
  const tr = useT();
  const router = useRouter();
  const { data, act, busy, error } = useCycle();
  const [step, setStep] = useState<"intro" | "ask" | "young">("intro");
  const [adult, setAdult] = useState<boolean | null>(null);
  const [when, setWhen] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const today = data?.today ?? new Date().toISOString().slice(0, 10);

  const ready = adult === true && when !== null && (when !== "pick" || !!picked);

  const begin = async () => {
    if (adult === false) { setStep("young"); return; }
    const last = when === "pick" ? picked
      : when && /^\d+$/.test(when) ? addDays(today, -Number(when)) : null;
    const s = await act(() => apiCycleSetup({ adult: true, last_start: last }));
    if (!s) return;
    if (when === "now") {
      const on = await act(() => apiCycleLog(s.today, { period: true }));
      if (on) router.replace("/app/health/cycle/period");
      return;
    }
    router.replace("/app/health/cycle");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        {/* The reference's own top: the brand, not a back arrow. */}
        <div className="flex items-center justify-center pt-4 lg:pt-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/womsakhi-wordmark.png" alt="WomSakhi" className="h-[38px] w-auto" />
        </div>

        {step === "intro" && (
          <div className="ux-fade">
            <h1 className="ux-display mt-4 text-center text-[34px] font-bold leading-[1.1]" style={{ color: "var(--ux-ink)" }}>
              {tr("healthCycleStart.yourCycle")}<br />{tr("healthCycleStart.yourPower")}
            </h1>
            <p className="mt-3 text-center text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {tr("healthCycleStart.trackUnderstandFeelBetter")}<br />{tr("healthCycleStart.aHealthierHappierYouEveryDay")}
            </p>

            <div className="relative mx-auto mt-4 h-[300px] max-w-[340px] overflow-hidden rounded-[28px]" style={{ background: heroBg }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden
                   className="absolute -end-10 -top-6 h-[200px] w-auto opacity-60 mix-blend-multiply" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/hero-petals-left.webp" alt="" aria-hidden className="absolute -start-2 top-8 h-[220px] w-auto opacity-80" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/scene-woman-meditating.webp" alt={tr("healthCycleStart.aWomanSittingCalmlyEyesClosed")}
                   className="absolute bottom-0 left-1/2 h-[285px] w-auto max-w-none -translate-x-1/2 object-contain" />
            </div>

            <ul className="mt-5 grid grid-cols-4 gap-2">
              {FEATURES.map((f) => (
                <li key={f.icon} className="flex flex-col items-center gap-2 text-center">
                  <span className="grid h-[52px] w-[52px] place-items-center rounded-[16px]"
                        style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
                    <Icon name={f.icon} className="h-[22px] w-[22px]" style={{ color: "var(--cy-period-ink)" }} />
                  </span>
                  <span className="whitespace-pre-line text-[12px] leading-tight" style={{ color: "var(--ux-ink-2)" }}>{f.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2">
              <CyButton onClick={() => setStep("ask")}>Let&apos;s Get Started</CyButton>
              <Link href="/app" className="flex h-11 items-center justify-center text-[15px]" style={{ color: "var(--ux-muted)" }}>
                {tr("healthCycleStart.maybeLater")}
              </Link>
            </div>
          </div>
        )}

        {step === "ask" && (
          <div className="ux-fade mt-6">
            <h1 className="ux-display text-[28px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleStart.twoQuickQuestions")}</h1>
            <p className="mt-1.5 text-[15px]" style={{ color: "var(--ux-muted)" }}>{tr("healthCycleStart.soYourCalendarIsRightFrom")}</p>

            <p className="mt-6 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleStart.areYou18OrOlder")}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {[{ v: true, l: "Yes, I am" }, { v: false, l: "No, not yet" }].map((o) => (
                <button key={o.l} type="button" onClick={() => setAdult(o.v)} aria-pressed={adult === o.v}
                        className="ux-press h-[52px] rounded-[14px] text-[15px] font-semibold"
                        style={adult === o.v
                          ? { background: "var(--cy-predicted)", color: "var(--cy-predicted-ink)", boxShadow: "inset 0 0 0 2px var(--cy-period)" }
                          : { background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line-strong)" }}>
                  {o.l}
                </button>
              ))}
            </div>

            {adult !== false && (
              <>
                <p className="mt-6 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleStart.whenDidYourLastPeriodStart")}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {WHEN.map((w) => (
                    <button key={w.key} type="button" onClick={() => setWhen(w.key)} aria-pressed={when === w.key}
                            className="ux-press min-h-[44px] rounded-full px-4 text-[15px]"
                            style={when === w.key
                              ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                              : { background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line-strong)" }}>
                      {w.label}
                    </button>
                  ))}
                </div>
                {when === "pick" && (
                  <input type="date" value={picked} max={today} min={addDays(today, -120)}
                         onChange={(e) => setPicked(e.target.value)} aria-label={tr("healthCycleStart.theDayYourLastPeriodStarted")}
                         className="mt-3 h-[52px] w-full rounded-[14px] px-4 text-[17px]"
                         style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }} />
                )}
              </>
            )}

            <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              <Icons.Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Only you can see this. Nobody at WomSakhi reads it, and you can delete all of it in one tap.
            </p>

            <div className="mt-5">
              <CyButton onClick={begin} busy={busy} disabled={adult === null || (adult === true && !ready)}>
                {adult === false ? "Continue" : "Start tracking"}
              </CyButton>
            </div>
            <ErrorLine text={error} />
          </div>
        )}

        {step === "young" && (
          <div className="ux-fade mt-8 text-center">
            <span className="mx-auto grid h-[64px] w-[64px] place-items-center rounded-full" style={{ background: "var(--cy-fertile)" }}>
              <Icons.BookOpen className="h-7 w-7" style={{ color: "var(--cy-ovulation-ink)" }} aria-hidden />
            </span>
            <h1 className="ux-display mt-4 text-[28px] font-bold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleStart.theGuidesAreForYou")}</h1>
            <p className="mx-auto mt-2 max-w-[340px] text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              The tracker is for women 18 and over, so we have not saved anything. Everything in the guides is
              open to you — periods, cramps, what to eat, and when to see a doctor.
            </p>
            <div className="mt-6 space-y-2">
              <CyButton href="/app/health/cycle/learn">{tr("healthCycleStart.readTheGuides")}</CyButton>
              <Link href="/app" className="flex h-11 items-center justify-center text-[15px]" style={{ color: "var(--ux-muted)" }}>{tr("schedule.backToHome")}</Link>
            </div>
          </div>
        )}
      </Column>
    </HomeShell>
  );
}

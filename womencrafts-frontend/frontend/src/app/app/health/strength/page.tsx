"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, Progress, SectionHead, Stat, v } from "@/components/ux/kit";
import {
  CHECKS, IRON_WEEKS, TIRED_SIGNS, dueNow, freeCount, ironStreak, type Check,
} from "@/components/ux/wellness/data";
import { useT } from "@/i18n";

/**
 * Tiredness, treated as a money problem.
 *
 * ── The number that justifies this screen ───────────────────────────────────
 * Among 138 women tea pluckers in Darjeeling, anaemia predicted **9.1% less tea
 * picked and 4.0% lower wages per three-hour shift** — controlling for physical
 * effort. That is a measured wage elasticity, in Indian women, in piece-rate
 * work, and it is the only study in the entire health review that measures the
 * right thing in the right population in the right units.
 *
 * For a salaried worker, feeling weak is presenteeism and invisible. For a woman
 * paid by the piece it is a direct pay cut she takes home the same day.
 *
 * ── Why it is careful about the diagnosis ───────────────────────────────────
 * Prevalence in Indian women is genuinely contested — 57% by the NFHS capillary
 * method, about 41% by venous blood, mostly mild, with iron deficiency
 * explaining under a third of it. And NFHS-6 dropped the indicator entirely,
 * so there is no current national figure at all. So this screen does not tell
 * her she is anaemic. It tells her the test is free, takes ten minutes, and
 * that a woman will be there — because "no female provider" is one of the most
 * common reasons Indian women give for not seeking care.
 *
 * Stored: "I took the tablet." A boolean. Nothing else.
 */
export default function StrengthPage() {
  const tr = useT();
  const router = useRouter();
  const [weeks, setWeeks] = useState(IRON_WEEKS);
  const [signs, setSigns] = useState<string[]>([]);
  const [booked, setBooked] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const streak = useMemo(() => ironStreak(weeks), [weeks]);
  const test = useMemo(() => CHECKS.find((c) => c.id === "ch1")!, []);
  const many = signs.length >= 3;

  const took = useCallback(() => {
    setWeeks((w) => w.map((x, i) => (i === w.length - 1 ? { ...x, took: x.of } : x)));
    setNote("Marked. That is all we keep — not how you feel, not anything else.");
  }, []);

  const toggleSign = (s: string) =>
    setSigns((r) => (r.includes(s) ? r.filter((x) => x !== s) : [...r, s]));

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        <Back to="/app/health" label={tr("healthStrength.backToHealth")} />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Strength
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("healthStrength.tiredIsNotJustTired")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            When you are paid for what you finish, feeling weak is money. Women doing piece work
            with low iron finished about <b>9% less in a shift</b> and earned about <b>4% less</b> —
            without ever taking a day off.
          </p>
        </header>

        {/* Free test */}
        <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
          <div className="flex flex-wrap items-start gap-4 p-5" style={{ background: v("--ux-brand-tint") }}>
            <IconTile icon="Droplet" tint="--ux-surface" ink="--ux-brand" size={48} radius={14} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{test.what}</p>
              <p className="mt-1.5 max-w-[52ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {test.why}. It costs <b>nothing</b>, takes <b>ten minutes</b>, and a woman does it.
                Most women skip it because nobody ever told them those three things.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
                <span className="inline-flex items-center gap-1.5">
                  <I name="MapPin" className="h-[13px] w-[13px]" />{test.where}
                </span>
                {test.lastOn && (
                  <span className="inline-flex items-center gap-1.5">
                    <I name="History" className="h-[13px] w-[13px]" />Last: {test.lastOn}
                  </span>
                )}
              </div>
            </div>
            <Btn disabled={booked} onClick={() => { setBooked(true); setNote("We will remind you on Monday evening, and again on the morning."); }}>
              {booked ? tr("healthStrength.reminderSet")
              : tr("healthStrength.remindMeTuesday")}
            </Btn>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Signs — a prompt, explicitly not a diagnosis */}
        <div>
          <SectionHead title={tr("healthStrength.doesAnyOfThisSoundLike")}
                       sub={tr("healthStrength.thisIsNotADiagnosisOnly")} icon="ListChecks" />
          <Card pad={16}>
            <div className="flex flex-col gap-2">
              {TIRED_SIGNS.map((s) => {
                const on = signs.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSign(s)} aria-pressed={on}
                          className="ux-press ux-sq flex items-center gap-3 rounded-[12px] border p-3 text-left"
                          style={{
                            borderColor: v(on ? "--ux-brand" : "--ux-line"),
                            background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                          }}>
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[8px] border-2"
                          style={{
                            borderColor: v(on ? "--ux-brand" : "--ux-line-strong"),
                            background: v(on ? "--ux-brand" : "--ux-surface"),
                            color: v("--ux-on-brand-btn-ink"),
                          }}>
                      {on && <I name="Check" className="h-[13px] w-[13px]" sw={3} />}
                    </span>
                    <span className="text-xsm" style={{ color: v("--ux-ink") }}>{s}</span>
                  </button>
                );
              })}
            </div>
            {many && (
              <div className="mt-3.5 rounded-[12px] px-3.5 py-3" style={{ background: v("--ux-tint-amber") }}>
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  That is worth ten minutes on a Tuesday. It might be iron, it might be something
                  else — the point is that a free test tells you, and guessing does not.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Iron — weekly, which beats a monthly ritual */}
        <div>
          <SectionHead title={tr("healthStrength.theWeeklyTablet")} sub={tr("healthStrength.freeFromTheAnganwadiOneA")}
                       icon="Pill" chip={streak > 0 ? `${streak} weeks running` : undefined} />
          <Card pad={16}>
            <div className="flex items-end gap-2" style={{ height: 76 }}>
              {weeks.map((w) => (
                <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <div className="w-full rounded-t-[6px]"
                       style={{
                         height: w.took >= w.of ? "100%" : "18%",
                         background: v(w.took >= w.of ? "--ux-green-ink" : "--ux-surface-2"),
                       }} />
                  <span className="text-2xs leading-tight" style={{ color: v("--ux-muted") }}>
                    {w.week.replace(" weeks ago", "w").replace("Last week", "now")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>{tr("healthStrength.aWeeklyTabletIsEasierTo")}</p>
              <Btn size="sm" onClick={took}>{tr("healthStrength.iTookIt")}</Btn>
            </div>
          </Card>
        </div>

        {/* Other free checks */}
        <div>
          <SectionHead title={tr("healthStrength.otherThingsThatCostNothing")}
                       sub={`${freeCount(CHECKS)} free · ${dueNow(CHECKS)} due soon`} icon="Stethoscope"
                       action="All of health" onAction={() => router.push("/app/health")} />
          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKS.filter((c) => c.id !== "ch1").map((c) => (
              <Card key={c.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={c.icon} tint="--ux-tint-green" ink="--ux-green-ink" size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.what}</p>
                      {c.womanThere && <Pill tone="pink" size="sm">{tr("healthStrength.aWomanDoesIt")}</Pill>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{c.why}</p>
                    <p className="mt-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
                      <b>{c.costs}</b> · {c.takes} · {c.where}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Lock" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              We keep whether you took a tablet and whether you had a test. Not your cycle, not your
              symptoms, not how you feel. Nothing here is ever shown to your circle or sent anywhere.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, SectionHead, ScreenSkeleton, v } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { TIRED_SIGNS as RAW_TIRED_SIGNS } from "@/components/ux/wellness/data";
import { toast } from "@/components/ux/mobile/Toast";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { PhoneTitle, phonePrimary } from "@/components/ux/PhoneParts";
import { useResource } from "@/lib/use-resource";
import { apiHealth, type Reference } from "@/lib/entitlements-api";
import { apiCreateReminder } from "@/lib/engines-api";
import {
  TEST_RESULT_LABEL, apiRecordStrengthTest, apiStrength, apiTickIron, type Strength, type TestResult,
} from "@/lib/my-records-api";

/**
 * Tiredness, treated as a money problem.
 *
 * ── The number that justifies this screen ───────────────────────────────────
 * Among 138 women tea pluckers in Darjeeling, anaemia predicted **9.1% less tea
 * picked and 4.0% lower wages per three-hour shift** — controlling for physical
 * effort. For a woman paid by the piece, feeling weak is a pay cut she takes
 * home the same day.
 *
 * ── What is real here ───────────────────────────────────────────────────────
 * This screen used to keep everything in the browser: "I took it" filled a bar
 * that was gone on reload, "Last: 8 months ago" was the same fixture for every
 * woman, and "Remind me Tuesday" set a flag and reminded nobody. Now:
 *
 *   - the weekly tablet is ticked on the server (`/me/health/strength/iron`),
 *     one tick per week, shown as the last eight weeks — her record, not a score;
 *   - her last strength test is what SHE records (date + what they told her);
 *   - "Remind me" creates a real reminder in her reminders (the clinic preset);
 *   - the free checks come from the staff-managed health catalogue
 *     (`/wellbeing/health`), not a constant with made-up camp dates.
 *
 * It still never tells her she is anaemic. Signs are a prompt to get the free
 * test, explicitly not a diagnosis.
 */

const RESULTS: TestResult[] = ["normal", "low", "very_low", "not_told"];

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const WHEN_PICKS = [
  { label: "This week", days: 0 }, { label: "Last month", days: 30 },
  { label: "3 months ago", days: 90 }, { label: "6 months ago", days: 180 }, { label: "A year ago", days: 365 },
];

/** The next Tuesday at 10am, local — when the Anganwadi usually tests. */
function nextTuesday10() {
  const d = new Date();
  const add = ((2 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + add);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function since(date: string, now: number) {
  const days = Math.floor((now - new Date(`${date}T00:00:00`).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : `${Math.round(months / 12)} year${months >= 18 ? "s" : ""} ago`;
}

export default function StrengthPage() {
  const TIRED_SIGNS = useTranslated(RAW_TIRED_SIGNS);
  const tr = useT();
  const rec = useResource(useCallback((s: AbortSignal) => apiStrength(s), []), null as Strength | null);
  const checks = useResource(useCallback((s: AbortSignal) => apiHealth(s).catch(() => []), []), [] as Reference[]);
  const [view, setView] = useState<Strength | null>(null);
  const data = view ?? rec.data;

  const [signs, setSigns] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [when, setWhen] = useState("");
  const [result, setResult] = useState<TestResult | "">("");
  const [busy, setBusy] = useState<"" | "iron" | "test" | "remind">("");
  const [reminded, setReminded] = useState(false);
  // "Now", fixed once per visit — the quick date picks are relative to it.
  const [now] = useState(() => Date.now());
  const ago = (days: number) => ymd(new Date(now - days * 86_400_000));
  const many = signs.length >= 3;

  const tick = async (took: boolean) => {
    setBusy("iron");
    try { setView(await apiTickIron(took)); toast(took ? "Ticked for this week" : "Tick removed", { tone: "success" }); }
    catch { toast("That did not save. Try again.", { tone: "error" }); }
    finally { setBusy(""); }
  };
  const saveTest = async () => {
    if (!when || !result) return;
    setBusy("test");
    try {
      setView(await apiRecordStrengthTest(when, result));
      setRecording(false); setWhen(""); setResult("");
      toast("Saved — only you can see it", { tone: "success" });
    } catch { toast("That did not save. Try again.", { tone: "error" }); }
    finally { setBusy(""); }
  };
  const remind = async () => {
    setBusy("remind");
    try {
      await apiCreateReminder({ title_key: "rem.preset.clinic", schedule_type: "once", at: nextTuesday10(), category: "health" });
      setReminded(true);
      toast("We will remind you on Tuesday morning", { tone: "success" });
    } catch { toast("The reminder did not save. Try again.", { tone: "error" }); }
    finally { setBusy(""); }
  };

  const last = data?.last_test ?? null;
  const hbCheck = checks.data.find((c) => /haemoglobin|hemoglobin|blood test/i.test(c.title));
  const ironInfo = checks.data.find((c) => /iron/i.test(c.title));
  const others = checks.data.filter((c) => c !== hbCheck && c !== ironInfo);
  const tookWeeks = data?.weeks.filter((w) => w.took).length ?? 0;

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        <div className="hidden lg:flex">
          <Back to="/app/health" label={tr("healthStrength.backToHealth")} />
        </div>

        <PhoneTitle title="Strength" sub={tr("healthStrength.tiredIsNotJustTired")}
                    note={<>When you are paid for what you finish, feeling weak is money. Women doing piece work
                      with low iron finished about <b>9% less in a shift</b> {tr("healthStrength.andEarnedAbout")} <b>4% less</b>.</>} />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>Strength</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("healthStrength.tiredIsNotJustTired")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            When you are paid for what you finish, feeling weak is money. Women doing piece work with low iron
            finished about <b>9% less in a shift</b> {tr("healthStrength.andEarnedAbout")} <b>4% less</b> — without ever taking a day off.
          </p>
        </header>

        {rec.source === "loading" && !data ? <ScreenSkeleton shape="list" /> : (
          <>
            {/* The free test, and her own record of it */}
            <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
              <div className="flex flex-wrap items-start gap-4 p-5 max-lg:p-4" style={{ background: v("--ux-brand-tint") }}>
                <IconTile icon="Droplet" tint="--ux-surface" ink="--ux-brand" size={48} radius={14} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{hbCheck?.title || "Blood test for strength (haemoglobin)"}</p>
                  <p className="mt-1.5 max-w-[52ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                    It tells you if tiredness has a cause you can fix. It costs <b>nothing</b>, takes <b>{tr("healthStrength.tenMinutes")}</b>, and a woman usually does it.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
                    <span className="inline-flex items-center gap-1.5">
                      <I name="MapPin" className="h-[13px] w-[13px]" />
                      {String(hbCheck?.payload?.where || "Primary Health Centre or an Anganwadi camp")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <I name="History" className="h-[13px] w-[13px]" />
                      {last ? <>Your last test: <b>{since(last.date, now)}</b> · {TEST_RESULT_LABEL[last.result]}</> : "You have not added a test yet"}
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  <Btn className={phonePrimary} icon={reminded ? "Check" : "Bell"} disabled={reminded} loading={busy === "remind"} onClick={() => void remind()}>
                    {reminded ? tr("healthStrength.reminderSet") : tr("healthStrength.remindMeTuesday")}
                  </Btn>
                  <Btn variant="outline" icon="Plus" onClick={() => setRecording((x) => !x)}>
                    {recording ? "Close" : "I had a test"}
                  </Btn>
                </div>
              </div>
              {recording && (
                <div className="border-t p-5 max-lg:p-4" style={{ borderColor: v("--ux-line") }}>
                  <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>When was it?</p>
                  <Picks options={WHEN_PICKS.map((w) => w.label)}
                         value={WHEN_PICKS.find((w) => ago(w.days) === when)?.label ?? ""}
                         onPick={(l) => setWhen(ago(WHEN_PICKS.find((x) => x.label === l)!.days))}
                         label="When" />
                  <input type="date" value={when} max={ago(0)} onChange={(e) => setWhen(e.target.value)}
                         aria-label="Date of the test"
                         className="ux-sq mt-2 min-h-[44px] rounded-[12px] border px-3 text-xsm outline-none"
                         style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
                  <p className="mt-4 text-xsm font-bold" style={{ color: v("--ux-ink") }}>What did they tell you?</p>
                  <Picks options={RESULTS.map((r) => TEST_RESULT_LABEL[r])} value={result ? TEST_RESULT_LABEL[result] : ""}
                         onPick={(l) => setResult(RESULTS.find((r) => TEST_RESULT_LABEL[r] === l)!)} label="Result" />
                  <div className="mt-4 flex gap-2">
                    <Btn disabled={!when || !result} loading={busy === "test"} onClick={() => void saveTest()}>Save</Btn>
                    <Btn variant="ghost" onClick={() => setRecording(false)}>Cancel</Btn>
                  </div>
                </div>
              )}
            </Card>

            {last && last.result !== "normal" && last.result !== "not_told" && (
              <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  A low result is common and usually fixable. The weekly iron tablet below is free at your Anganwadi —
                  ask there, and get tested again in three months.
                </p>
              </Card>
            )}

            {/* Signs — a prompt, explicitly not a diagnosis */}
            <div>
              <SectionHead title={tr("healthStrength.doesAnyOfThisSoundLike")} sub={tr("healthStrength.thisIsNotADiagnosisOnly")} icon="ListChecks" />
              <Card pad={16}>
                <Picks options={TIRED_SIGNS} value={signs} multi label="Signs"
                       onPick={(s) => setSigns(signs.includes(s) ? signs.filter((x) => x !== s) : [...signs, s])} />
                {many && (
                  <p className="mt-3.5 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed" style={{ background: v("--ux-tint-amber"), color: v("--ux-ink-2") }}>
                    That is worth ten minutes at a free test. It might be iron, it might be something else — a test tells you,
                    and guessing does not. Nothing you tick here is saved.
                  </p>
                )}
              </Card>
            </div>

            {/* Iron — weekly, ticked on the server */}
            <div>
              <SectionHead title={tr("healthStrength.theWeeklyTablet")}
                           sub={String(ironInfo?.payload?.where ? `Free at ${ironInfo.payload.where}` : tr("healthStrength.freeFromTheAnganwadiOneA"))}
                           icon="Pill" chip={tookWeeks ? `${tookWeeks} of ${data?.weeks.length ?? 8} weeks` : undefined} />
              <Card pad={16}>
                <div className="flex items-end gap-2" style={{ height: 80 }}>
                  {(data?.weeks ?? []).map((w) => (
                    <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1.5" title={w.starts}>
                      <div className="w-full rounded-t-[6px]"
                           style={{ height: w.took ? "100%" : "16%", background: v(w.took ? "--ux-green-ink" : "--ux-surface-2") }} />
                      <span className="text-center text-[10px] leading-tight" style={{ color: v("--ux-muted") }}>{w.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
                  <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                    {data?.took_this_week ? "Ticked for this week. Well done." : tr("healthStrength.aWeeklyTabletIsEasierTo")}
                  </p>
                  {data?.took_this_week
                    ? <Btn size="sm" variant="ghost" loading={busy === "iron"} onClick={() => void tick(false)}>Undo</Btn>
                    : <Btn size="sm" icon="Check" loading={busy === "iron"} onClick={() => void tick(true)}>{tr("healthStrength.iTookIt")}</Btn>}
                </div>
              </Card>
            </div>

            {/* Other free checks, from the staff-managed catalogue */}
            {others.length > 0 && (
              <div>
                <SectionHead title={tr("healthStrength.otherThingsThatCostNothing")} sub={`${others.length} free checks`} icon="Stethoscope" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {others.map((c) => (
                    <Card key={c.id} pad={16}>
                      <div className="flex items-start gap-3.5">
                        <IconTile icon="Stethoscope" tint="--ux-tint-green" ink="--ux-green-ink" size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.title}</p>
                            {c.free && <Pill tone="green" size="sm">Free</Pill>}
                          </div>
                          {c.body && <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{c.body}</p>}
                          <p className="mt-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
                            {[c.payload?.every, c.payload?.where].filter(Boolean).map(String).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
              <div className="flex items-start gap-3">
                <I name="Lock" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  We keep which weeks you ticked and the tests you add. Not your symptoms, not how you feel.
                  Nothing here is ever shown to your circle or to anyone else.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </HomeShell>
  );
}

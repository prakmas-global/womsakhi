"use client";

import { useCallback, useEffect, useState } from "react";

import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, SectionHead, v } from "@/components/ux/kit";
import {
  MOODS, SUPPORT_STYLES, apiHabitTaken, apiListHabits, apiMoodCard,
  apiMoodCheckIn, apiResetActivity, apiSetEncouragement,
  type Habit, type Mood, type ResetActivity, type SupportCard, type SupportStyle,
} from "@/lib/engines-api";

const k = (s: string) => s as MessageKey;

/**
 * How are you today?
 *
 * ── The limits are the feature ──────────────────────────────────────────────
 * This is the part of a product like this most often built badly, so the rules
 * it refuses to break are written here rather than left to be rediscovered:
 *
 * 1. **One tap produces one reply, never a series.** Checking in does not
 *    enrol her in anything. There is no "daily check-in" switch on this screen
 *    because a voluntary tap must not become a standing obligation.
 * 2. **`good` returns nothing.** The server sends no card for it, and this
 *    screen shows none. A woman who says she is fine does not need handling,
 *    and a product that always has something to say is one that talks over her.
 * 3. **Nothing reads her silence.** Not coming back is not sadness, consent,
 *    worsening health or disinterest. Nothing here records an absence.
 * 4. **Frequency never rises because she seems low.** There is no path on this
 *    screen — or in the engine behind it — from "she picked `low` twice" to
 *    "ask more often".
 * 5. **Every card was read by a person first.** The server only returns cards
 *    marked reviewed; an unreviewed one is not shown with a disclaimer, it is
 *    simply not eligible.
 *
 * ── Why the style is asked once, quietly ────────────────────────────────────
 * The same sentence lands differently on different days, so she chooses how
 * she wants to be met — practical, gentle, or nothing at all. `quiet` and
 * `none` are first-class answers: they return no card, and they cost her
 * nothing else in the app.
 */
export default function TodayPage() {
  const tr = useT();

  const [picked, setPicked] = useState<Mood | null>(null);
  const [style, setStyle] = useState<SupportStyle | null>(null);
  const [card, setCard] = useState<SupportCard | null>(null);
  const [activity, setActivity] = useState<ResetActivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [encouragement, setEncouragement] = useState<"general" | "scripture" | "none" | null>(null);

  /*
    If she already answered today, show that card rather than asking again.
    Asking twice in one day is the smallest version of the thing this whole
    screen is built to avoid — and `null` here is the ordinary answer, not a
    failure, so nothing is shown when there is nothing to show.
  */
  useEffect(() => {
    let alive = true;
    void apiMoodCard()
      .then((c) => { if (alive && c) { setCard(c); setDone(true); } })
      .catch(() => {});
    void apiListHabits()
      .then((h) => { if (alive) setHabits(h); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const markTaken = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await apiHabitTaken(id);
      setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, done_today: true } : h)));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseEncouragement = useCallback(async (choice: "general" | "scripture" | "none") => {
    setEncouragement(choice);
    try {
      await apiSetEncouragement(choice);
    } catch {
      setEncouragement(null);
    }
  }, []);

  const checkIn = useCallback(async (mood: Mood) => {
    setBusy(true);
    setFailed(false);
    setPicked(mood);
    try {
      const out = await apiMoodCheckIn(mood, style ? { style } : {});
      setCard(out.card);
      setDone(true);
    } catch {
      setFailed(true);
      setPicked(null);
    } finally {
      setBusy(false);
    }
  }, [style]);

  const fetchActivity = useCallback(async () => {
    setBusy(true);
    try {
      setActivity(await apiResetActivity());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <HomeShell>
      <div className="space-y-4">
        <SectionHead icon="HeartPulse" title={tr("today.title")} sub={tr("today.subtitle")} />

        {/* ── the one question ─────────────────────────────────────────── */}
        {!done && (
          <Card>
            <h2 className="text-base font-semibold" style={{ color: v("--ux-ink") }}>
              {tr("today.howAreYou")}
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => void checkIn(m)}
                  aria-pressed={picked === m}
                  className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition disabled:opacity-60"
                  style={{
                    background: picked === m ? v("--ux-brand-tint") : v("--ux-surface-2"),
                    outline: picked === m ? `2px solid ${v("--ux-brand")}` : "none",
                    outlineOffset: -2,
                  }}
                >
                  <I name={MOOD_ICON[m]} className="h-[22px] w-[22px]"
                     style={{ color: v(MOOD_INK[m]) }} />
                  <span className="text-2xs font-medium leading-tight" style={{ color: v("--ux-ink") }}>
                    {tr(k(`today.mood.${m}`))}
                  </span>
                </button>
              ))}
            </div>

            {/*
              Asked once, and quietly. Two of the four answers mean "say
              nothing", and they are offered as plainly as the other two.
            */}
            <h3 className="mt-5 text-sm font-semibold" style={{ color: v("--ux-ink") }}>
              {tr("today.howShouldIMeetYou")}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUPPORT_STYLES.map((sName) => {
                const on = style === sName;
                return (
                  <button
                    key={sName}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStyle(on ? null : sName)}
                    className="min-h-[38px] rounded-full px-3.5 text-xsm font-medium transition"
                    style={{
                      background: on ? v("--ux-brand") : v("--ux-surface-2"),
                      color: on ? "#fff" : v("--ux-ink"),
                    }}
                  >
                    {tr(k(`today.style.${sName}`))}
                  </button>
                );
              })}
            </div>

            {failed && (
              <p className="mt-3 text-xsm" style={{ color: v("--ux-danger-ink") }}>
                {tr("today.failed")}
              </p>
            )}
          </Card>
        )}

        {/* ── one reply, and only if she wants one ─────────────────────── */}
        {done && (
          <>
            <Card>
              <p className="text-xsm" style={{ color: v("--ux-muted") }}>
                {tr("today.thanks")}
              </p>

              {card ? (
                <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: v("--ux-surface-2") }}>
                  <h3 className="text-sm font-semibold" style={{ color: v("--ux-ink") }}>{card.title}</h3>
                  <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                    {card.body}
                  </p>
                  {card.minutes > 0 && (
                    <p className="mt-2 text-2xs" style={{ color: v("--ux-muted") }}>
                      {tr("today.minutes", { minutes: card.minutes })}
                    </p>
                  )}
                </div>
              ) : (
                /*
                  No card, and that is the right answer — for `good`, and for a
                  woman who asked to be left alone. Saying so beats an empty
                  space she reads as a failure.
                */
                <p className="mt-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {picked === "good" ? tr("today.nothingNeeded") : tr("today.quietChosen")}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Btn size="sm" variant="soft" icon="Sparkles" onClick={fetchActivity} loading={busy}>
                  {tr("today.somethingToDo")}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => { setDone(false); setCard(null); setActivity(null); setPicked(null); }}>
                  {tr("today.changeAnswer")}
                </Btn>
              </div>
            </Card>

            {activity && (
              <Card pad={14}>
                <div className="flex items-start gap-2.5">
                  <I name="Sparkles" className="mt-0.5 h-[18px] w-[18px] shrink-0"
                     style={{ color: v("--ux-brand") }} />
                  <div className="min-w-0">
                    <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                      {activity.text}
                    </p>
                    {activity.minutes > 0 && (
                      <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>
                        {tr("today.minutes", { minutes: activity.minutes })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── what she keeps ──────────────────────────────────────────── */}
        {habits.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold" style={{ color: v("--ux-ink") }}>
              {tr("today.whatYouKeep")}
            </h2>
            <div className="mt-2.5 space-y-2">
              {habits.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                     style={{ background: v("--ux-surface-2") }}>
                  <div className="min-w-0">
                    <p className="text-xsm font-medium" style={{ color: v("--ux-ink") }}>{h.label}</p>
                    {h.note && (
                      <p className="mt-0.5 text-2xs leading-snug" style={{ color: v("--ux-muted") }}>{h.note}</p>
                    )}
                  </div>
                  {/*
                    Done, and nothing else. No streak, no "3 of 7", no red for a
                    day she missed — her adherence log is her record, not a
                    score, and a number here is how medicine starts to feel like
                    something she is failing at.
                  */}
                  {h.done_today ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-2xs font-semibold"
                          style={{ color: v("--ux-green-ink") }}>
                      <I name="Check" className="h-[14px] w-[14px]" />
                      {tr("today.taken")}
                    </span>
                  ) : (
                    <Btn size="sm" variant="outline" disabled={busy}
                         onClick={() => void markTaken(h.id)}>
                      {tr("today.iTookIt")}
                    </Btn>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── how she wants to be encouraged, if at all ────────────────── */}
        <Card>
          <h2 className="text-sm font-semibold" style={{ color: v("--ux-ink") }}>
            {tr("today.encouragement")}
          </h2>
          <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
            {tr("today.encouragementSub")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(["general", "scripture", "none"] as const).map((c) => {
              const on = encouragement === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void chooseEncouragement(c)}
                  className="min-h-[38px] rounded-full px-3.5 text-xsm font-medium transition"
                  style={{
                    background: on ? v("--ux-brand") : v("--ux-surface-2"),
                    color: on ? "#fff" : v("--ux-ink"),
                  }}
                >
                  {tr(k(`today.enc.${c}`))}
                </button>
              );
            })}
          </div>
        </Card>

        <Card pad={14}>
          <div className="flex items-start gap-2.5">
            <I name="Lock" className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("today.privacy")}
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/**
 * Plain and few. Nothing here grades her day.
 *
 * Every name is checked against `components/ux/icons.ts`: this set has no
 * `Wind` or `Thermometer`, and a name it does not have draws nothing at all —
 * a mood button with a hole in it.
 */
const MOOD_ICON: Record<Mood, string> = {
  good: "Smile", tired: "Moon", low: "CloudRain",
  anxious: "Brain", angry: "Flame", unwell: "HeartPulse",
};

const MOOD_INK: Record<Mood, string> = {
  good: "--ux-green-ink", tired: "--ux-violet-ink", low: "--ux-blue-ink",
  anxious: "--ux-amber-ink", angry: "--ux-orange-ink", unwell: "--ux-pink-ink",
};

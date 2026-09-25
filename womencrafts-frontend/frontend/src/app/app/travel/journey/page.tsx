"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, SectionHead, v } from "@/components/ux/kit";
import {
  apiRaiseEngineAlert, apiResolveEngineAlert, apiTrackingHealth,
  apiTravelCheckIn, apiTravelEnd, apiTravelStart,
} from "@/lib/engines-api";

/**
 * A tracked journey.
 *
 * ── Why the deadline is not a timer on this page ────────────────────────────
 * The whole point is what happens when she cannot reach the phone. A countdown
 * in the browser dies with the tab, the battery, or the handset — which is
 * exactly the situation this feature exists for. So the deadline lives on the
 * server the moment she presses Start, and the clock below is only a picture
 * of it. Close this screen and the deadline still passes; her people are still
 * told.
 *
 * ── What survives a reload ──────────────────────────────────────────────────
 * The journey id, the deadline and the label, in `localStorage`. Not the
 * safety guarantee — that is already on the server — just enough for the
 * screen to show the right thing when she comes back to it. If this storage is
 * ever empty and a deadline is still running, she is not in danger of missing
 * anything; she simply cannot see the countdown, and the alert still fires.
 *
 * ── The battery warning ─────────────────────────────────────────────────────
 * A tracked journey whose phone is about to die is about to stop being
 * tracked, and the moment to say so is before it goes, not after. Read from
 * the Battery API where the browser has one, and simply skipped where it does
 * not — never guessed at.
 */

const STORE = "womsakhi_journey";

interface Active {
  id: string;
  label: string;
  /** ISO. When she said she would be there. */
  due: string;
  minutes: number;
}

function read(): Active | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Active) : null;
  } catch {
    return null;
  }
}
function write(a: Active | null) {
  try {
    if (a) localStorage.setItem(STORE, JSON.stringify(a));
    else localStorage.removeItem(STORE);
  } catch {
    // A private window with storage blocked. The journey is still tracked
    // server-side; only the countdown on this screen is lost.
  }
}

const MINUTES = [15, 30, 45, 60, 90];

export default function JourneyPage() {
  const tr = useT();

  const [active, setActive] = useState<Active | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [told, setTold] = useState(0);
  const [noContacts, setNoContacts] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef(false);

  useEffect(() => { setActive(read()); }, []);

  // One second is enough for a countdown and cheap enough to leave running;
  // it stops as soon as there is no journey, so an idle screen does no work.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Battery, where the browser has it. Safari and Firefox do not, and a
  // guessed number would be worse than none on a screen about safety.
  useEffect(() => {
    if (!active) return;
    type BatteryLike = { level: number };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let alive = true;
    void nav.getBattery().then((b) => {
      if (!alive) return;
      const pct = Math.round(b.level * 100);
      setBattery(pct);
      if (pct <= 15 && !warned.current) {
        warned.current = true;
        void apiTrackingHealth(active.id, pct, true).catch(() => {});
      }
    });
    return () => { alive = false; };
  }, [active]);

  const start = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      // A new id per journey, so a check-in can never land on yesterday's.
      const id = `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await apiTravelStart(id, minutes);
      const a: Active = {
        id,
        label: tr("journey.thisJourney"),
        due: new Date(Date.now() + minutes * 60_000).toISOString(),
        minutes,
      };
      write(a);
      setActive(a);
      warned.current = false;
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [minutes, tr]);

  const checkIn = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    setFailed(false);
    try {
      await apiTravelCheckIn(active.id, active.minutes);
      const a = { ...active, due: new Date(Date.now() + active.minutes * 60_000).toISOString() };
      write(a);
      setActive(a);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [active]);

  const arrive = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    setFailed(false);
    try {
      await apiTravelEnd(active.id);
      write(null);
      setActive(null);
    } catch {
      // Said plainly. If this failed the deadline is still live, and a woman
      // who believes she has arrived while her contacts are about to be told
      // is the worst outcome this screen can produce.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [active]);

  /* ── on the way ─────────────────────────────────────────────────────── */

  if (active) {
    const left = Math.max(0, new Date(active.due).getTime() - now);
    const mins = Math.floor(left / 60_000);
    const secs = Math.floor((left % 60_000) / 1000);
    const over = left === 0;

    return (
      <HomeShell>
        <div className="space-y-4">
          <SectionHead icon="MapPin" title={tr("journey.onTheWay")} sub={active.label} />

          <Card>
            <div className="flex flex-col items-center py-2 text-center">
              <p className="text-xsm" style={{ color: v("--ux-muted") }}>
                {over ? tr("journey.deadlinePassed") : tr("journey.shouldArriveIn")}
              </p>
              <p className="mt-1 text-[40px] font-bold leading-none tabular-nums"
                 style={{ color: v(over ? "--ux-danger-ink" : "--ux-ink") }}>
                {over ? tr("journey.now") : `${mins}:${String(secs).padStart(2, "0")}`}
              </p>
              <p className="mt-2 max-w-[34ch] text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
                {over ? tr("journey.tellingThem") : tr("journey.ifYouDoNot")}
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {/*
                Arrive is the primary and the largest. It is the one she will
                press nine times out of ten, often one-handed, sometimes in the
                dark — so it is never the smaller of the two.
              */}
              <Btn icon="Check" onClick={arrive} loading={busy} full>
                {tr("journey.imHere")}
              </Btn>
              <Btn icon="Clock" variant="outline" onClick={checkIn} loading={busy} full>
                {tr("journey.stillOnTheWay", { minutes: active.minutes })}
              </Btn>
            </div>

            {failed && (
              <p className="mt-3 text-xsm" style={{ color: v("--ux-danger-ink") }}>
                {tr("journey.actionFailed")}
              </p>
            )}
          </Card>

          {/*
            Not waiting for the deadline.
            The deadline is for when she CANNOT reach the phone; this is for
            when she can and something is wrong now. It sits below the two
            ordinary buttons, in its own card, because a woman reaching for
            "I am here" must never land on this by accident.
          */}
          {!alertId ? (
            <Card pad={14}>
              <Btn variant="outline" icon="ShieldAlert" full disabled={busy}
                   onClick={async () => {
                     setBusy(true);
                     try {
                       const out = await apiRaiseEngineAlert(active.id, "member_pressed");
                       setAlertId(out.alert_id);
                       setTold(out.told);
                       setNoContacts(out.no_contacts);
                     } catch {
                       setFailed(true);
                     } finally {
                       setBusy(false);
                     }
                   }}>
                {tr("journey.tellThemNow")}
              </Btn>
            </Card>
          ) : (
            <Card pad={14}>
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {noContacts
                  ? tr("journey.noContacts")
                  : tr("journey.toldPeople", { count: told })}
              </p>
              <div className="mt-3">
                <Btn size="sm" variant="soft" icon="Check" disabled={busy}
                     onClick={async () => {
                       setBusy(true);
                       try {
                         await apiResolveEngineAlert(alertId);
                         setAlertId(null);
                       } catch {
                         setFailed(true);
                       } finally {
                         setBusy(false);
                       }
                     }}>
                  {tr("journey.iAmFine")}
                </Btn>
              </div>
              <p className="mt-2 text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
                {tr("journey.ackNote")}
              </p>
            </Card>
          )}

          {battery !== null && battery <= 15 && (
            <Card pad={14}>
              <div className="flex items-start gap-2.5">
                <I name="BatteryLow" className="mt-0.5 h-[18px] w-[18px] shrink-0"
                   style={{ color: v("--ux-orange-ink") }} />
                <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {tr("journey.batteryLow", { percent: battery })}
                </p>
              </div>
            </Card>
          )}

          <Card pad={14}>
            <div className="flex items-start gap-2.5">
              <I name="ShieldCheck" className="mt-0.5 h-[18px] w-[18px] shrink-0"
                 style={{ color: v("--ux-green-ink") }} />
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
                {tr("journey.worksWithPhoneOff")}
              </p>
            </div>
          </Card>
        </div>
      </HomeShell>
    );
  }

  /* ── setting off ────────────────────────────────────────────────────── */

  return (
    <HomeShell>
      <div className="space-y-4">
        <SectionHead icon="MapPin" title={tr("journey.title")} sub={tr("journey.subtitle")} />

        <Card>
          {/*
            There is no "where are you going?" here on purpose.

            The only list the app has is `useRoutes()`, and behind it is
            `/wellbeing/travel` — which returns travel ADVICE, not saved
            journeys. On this screen it offered "Women's helpline — 181" and
            "Travelling after dark" as destinations. A wrong list of places is
            worse than none: she would pick the closest-sounding one and the
            label on her own journey would be a lie.

            Nothing here needs it. The deadline, the check-in and the alert all
            key off a journey id we generate; the label was only ever for her
            to read back.
          */}
          <h2 className="text-sm font-semibold" style={{ color: v("--ux-ink") }}>
            {tr("journey.byWhen")}
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMinutes(m)}
                  className="min-h-[40px] rounded-full px-3.5 text-xsm font-medium transition"
                  style={{
                    background: on ? v("--ux-brand") : v("--ux-surface-2"),
                    color: on ? "#fff" : v("--ux-ink"),
                  }}
                >
                  {tr("journey.inMinutes", { minutes: m })}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Btn icon="Play" onClick={start} loading={busy} full>
              {tr("journey.start")}
            </Btn>
          </div>

          {failed && (
            <p className="mt-3 text-xsm" style={{ color: v("--ux-danger-ink") }}>
              {tr("journey.startFailed")}
            </p>
          )}
        </Card>

        <Card pad={14}>
          <div className="flex items-start gap-2.5">
            <I name="Info" className="mt-0.5 h-[18px] w-[18px] shrink-0"
               style={{ color: v("--ux-brand") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("journey.howItWorks")}
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";

import {
  apiFileReport, apiRaiseAlert, apiSafetyCentre, apiStandDown,
  REPORT_CATEGORIES, type SafetyCentre,
} from "@/lib/safety-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, NoteBtn, SectionHead, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { AlsoHere } from "@/components/ux/AlsoHere";


const SCAMS = [
  { id: "s1", title: "Nobody may ask you for money to get you work",
    body: "No employer, mentor or agent on WomSakhi may charge a registration, training or placement fee. Ever.", icon: "IndianRupee" },
  { id: "s2", title: "Never share an OTP, not even with 'support'",
    body: "We will never ask for one. Anyone who does is trying to get into your account or your bank.", icon: "KeyRound" },
  { id: "s3", title: COPY.meetSafely,
    body: "For a first meeting with a buyer or employer, choose somewhere with other people around.", icon: "MapPin" },
  { id: "s4", title: "A government scheme is always free to apply for",
    body: "If someone offers to 'get it approved' for a fee, that is not how any of them work.", icon: "Landmark" },
];

/**
 * Safety — the screen that has to work when nothing else matters.
 *
 * Two rules shape it. Every number is on the page as text, not behind a tap:
 * she may be reading this to someone else, or copying it onto paper. And the
 * alert is a press-and-hold, not a tap, because a button this consequential
 * sitting under a thumb in a pocket must not fire by accident.
 */
export default function SafetyPage() {
  const [tab, setTab] = useState("Get help now");
  const [holding, setHolding] = useState(0);
  // A ref, not `useState(...)[0]`: this holds a frame handle that is written
  // on every tick, and writing into a value React handed back from state is
  // exactly what the compiler refuses to optimise around.
  const timer = useRef<number | null>(null);

  /**
   * The safety centre — her real trusted contacts, and the real helplines.
   *
   * Both were constants. The contacts said "Sunita Devi (Sister)" and "Meera
   * Joshi (Circle member)" to every woman; hers are her sister and her mother.
   * A woman raising an alert believed those two were being told.
   */
  const { data: centre, refetch } = useResource(
    useCallback(() => apiSafetyCentre(), []),
    null as SafetyCentre | null,
  );
  const CONTACTS = centre?.contacts ?? [];
  const HELPLINES = centre?.helplines ?? [];
  const openAlert = centre?.open_alert ?? null;
  const sent = !!openAlert;
  /**
   * Reports she has already filed.
   *
   * `/safety` has returned these all along and nothing read them, so a woman
   * who reported somebody had no way of knowing whether it had been looked at
   * — or whether it had been filed at all.
   */
  const REPORTS = centre?.reports ?? [];

  /**
   * Raise the alert.
   *
   * **This is the most important request in the application, and it was not
   * being made.** The button filled over a second and a half and then called
   * `setSent(true)`. Nothing left the browser. A woman in trouble held it,
   * read that her contacts had her location, and was on her own.
   */
  const raise = useAction(
    async () => { await apiRaiseAlert({ location: await whereSheIs() }); },
    {
      onDone: refetch,
      // Said plainly, because the alternative is she waits for help that is
      // not coming. The helplines are directly below this button.
      fallbackError: "The alert did NOT go out. Call 112 or 181 now — the numbers are just below.",
    },
  );

  const standDown = useAction(
    async () => { if (openAlert) await apiStandDown(openAlert.id); },
    { onDone: refetch, fallbackError: "Could not stand it down. Your contacts still think you need help." },
  );

  const startHold = () => {
    if (sent || raise.busy) return;
    const started = Date.now();
    const tick = () => {
      const pct = Math.min(100, ((Date.now() - started) / 1500) * 100);
      setHolding(pct);
      if (pct >= 100) {
        setHolding(0);
        void raise.run();
        return;
      }
      timer.current = window.requestAnimationFrame(tick);
    };
    timer.current = window.requestAnimationFrame(tick);
  };
  const endHold = () => {
    if (timer.current) window.cancelAnimationFrame(timer.current);
    timer.current = null;
    setHolding(0);
  };

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Who gets told" sub="They see your location only while an alert is on" />
            {CONTACTS.length === 0 && (
              <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
                You have not named anyone yet, so an alert would reach nobody. Add someone you trust
                before you need to.
              </p>
            )}
            <ul className="ux-stagger space-y-2.5">
              {CONTACTS.map((c) => (
                <li key={c.id} className="ux-hov flex items-center gap-3">
                  {/* The server keeps no photograph of a trusted contact, and
                      one is not needed to know who she picked. */}
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-sm font-semibold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{c.name}</p>
                    <p className="mt-0.5 truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                      {c.relation} · {c.phone}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn href="/app/settings/account" variant="outline" size="sm" full icon="UserPlus">Add someone</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="What we never do" icon="Lock" />
            <ul className="space-y-2.5">
              {[
                "We never ask for an OTP or your password.",
                "We never show your phone number to a buyer or employer.",
                "We never share your location unless you start an alert.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Get help now</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Help you can reach in one step, and the tricks worth knowing about.
          </p>
        </div>
        <Tabs items={["Get help now", "Know the tricks"]} active={tab} onChange={setTab} />
      </div>

      {tab === "Get help now" && (
        <>
          <Card className="ux-onscroll mb-[16px]">
            <SectionHead title="Tell your people something is wrong"
                         sub="Our team is alerted and these people are named on it. Nothing is sent until you finish holding." />
            {sent ? (
              <div className="ux-slide-up flex items-center gap-3.5 rounded-[12px] p-4"
                   style={{ background: "var(--ux-tint-green)" }}>
                <Icons.CheckCheck className="h-[22px] w-[22px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {/*
                      * Said exactly, because this is the sentence a woman acts
                      * on. It used to read "Sunita and Meera have been told
                      * where you are" — two invented names, and a claim that
                      * nothing in the system performs: there is no SMS
                      * provider, so no message goes to anybody. What is true is
                      * that staff see the alert straight away and the people
                      * she named are on it.
                      */}
                    {openAlert && openAlert.contacts_notified > 0
                      ? `Our team has it, with ${namesOf(CONTACTS)} named on it.`
                      : "Our team has it. You have named nobody to be reached, so add someone — or call 112 now."}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ux-ink-2)" }}>
                    If you are in danger right now, call 112 as well — do not wait for us.
                  </p>
                </div>
                <Btn variant="outline" size="sm" disabled={standDown.busy}
                     onClick={() => void standDown.run()}>
                  {standDown.busy ? "Standing down…" : "Stand down"}
                </Btn>
              </div>
            ) : (
              <>
              {/* A failed alert is the one refusal in this app that cannot be
                  quiet. It sits above the button, says what did not happen,
                  and names the numbers to ring instead. */}
              {raise.error && (
                <p role="alert" className="ux-slide-up mb-3 rounded-[12px] p-3 text-xsm font-semibold leading-relaxed"
                   style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
                  {raise.error}
                </p>
              )}
              <button
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") startHold(); }}
                onKeyUp={endHold}
                className="ux-sq relative w-full overflow-hidden rounded-[16px] px-5 py-5 text-start"
                style={{ background: "var(--ux-tint-orange)", border: "1px solid var(--ux-orange)" }}
              >
                {/* Press and hold, not tap. A button this consequential sitting
                    under a thumb in a pocket must not fire by accident. */}
                <span aria-hidden className="absolute inset-y-0 start-0"
                      style={{ width: `${holding}%`, background: "var(--ux-orange)", opacity: 0.28,
                               transition: holding === 0 ? "width 200ms var(--ux-ease-out)" : "none" }} />
                <span className="relative flex items-center gap-3.5">
                  <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
                        style={{ background: "var(--ux-orange)" }}>
                    <Icons.Siren className="h-[22px] w-[22px] text-white" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {raise.busy ? "Sending the alert…"
                        : holding > 0 ? "Keep holding…"
                        : "Press and hold to send an alert"}
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: "var(--ux-ink-2)" }}>
                      {holding > 0
                        ? `${Math.max(0, Math.ceil((100 - holding) / 100 * 1.5))} seconds`
                        : "Hold for one and a half seconds. Let go and nothing happens."}
                    </span>
                  </span>
                </span>
              </button>
              </>
            )}
          </Card>

          <SectionHead title="Numbers that always work" sub="Free from any phone, even without credit" />
          <div className="ux-deck grid grid-cols-3 gap-[16px]">
            {HELPLINES.map((h, i) => (
              <Card key={h.number} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                {/* Tone by urgency, from the server, rather than a colour
                    hardcoded beside a hardcoded number. */}
                <IconTile icon={h.urgent ? "Siren" : "Phone"}
                          tint={h.urgent ? "--ux-tint-orange" : "--ux-tint-pink"}
                          ink={h.urgent ? "--ux-orange" : "--ux-pink"} size={44} radius={12} />
                {/* The number is text on the page, not hidden behind the tap —
                    she may be reading it out or writing it down. */}
                <p className="mt-3 text-2xlm font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {h.number}
                </p>
                <p className="mt-2 text-xsm font-medium" style={{ color: "var(--ux-ink-2)" }}>{h.name}</p>
                <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{h.desc}</p>
                <div className="mt-3.5">
                  <Btn href={`tel:${h.number}`} variant="soft" size="sm" full icon="Phone">Call {h.number}</Btn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "Know the tricks" && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {SCAMS.map((s, i) => (
            <Card key={s.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              <div className="flex items-start gap-3.5">
                <IconTile icon={s.icon} tint="--ux-tint-orange" ink="--ux-orange" size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{s.title}</h3>
                  <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.body}</p>
                </div>
              </div>
            </Card>
          ))}
          <Card className="ux-onscroll">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                  Has any of this happened to you?
                </h3>
                <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
                  Tell us. We remove the account and warn everyone else.
                </p>
              </div>
              {/* This said "Reported. We are looking at it now." and filed
                  nothing. `apiFileReport` — POST /safety/reports — has existed
                  in safety-api.ts the whole time and was imported by nobody.
                  The category is asked for because the server requires one,
                  and because "harassment" and "a fake account" are not the
                  same queue. */}
              <NoteBtn label="Report someone" variant="primary" size="md" icon="Flag"
                       title="Report someone" to="the WomSakhi safety team"
                       choices={REPORT_CATEGORIES} choiceDefault="Something else"
                       choiceLabel="What kind of thing is this?"
                       placeholder="Who was it, what happened, and when? Anything you have — a name, a number, a screenshot description — helps."
                       send={async (n) => {
                         await apiFileReport({ category: n.choice, details: n.text });
                         refetch();
                       }}
                       sent="Filed. The safety team has it."
                       sentBody="It is listed below with what has happened to it. If you are in danger right now, call 112."
                       sentLink={null} />
            </div>
          </Card>

          {/* Filed reports, from the server — not a claim that one was filed. */}
          {REPORTS.length > 0 && (
            <Card className="ux-onscroll">
              <SectionHead title="What you have reported"
                           sub={`${REPORTS.length} ${REPORTS.length === 1 ? "report" : "reports"}, and where each one has got to`} />
              <ul className="space-y-2.5">
                {REPORTS.map((r) => (
                  <li key={r.id} className="ux-sq flex items-start gap-3 rounded-[12px] border p-3"
                      style={{ borderColor: "var(--ux-line)" }}>
                    <Icons.Flag className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{r.category}</p>
                      <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                        Filed {r.filed_on}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-[8px] px-2 py-1 text-2xs font-semibold"
                          style={{
                            background: r.status === "closed" ? "var(--ux-surface-2)" : "var(--ux-tint-amber)",
                            color: r.status === "closed" ? "var(--ux-muted)" : "var(--ux-amber-ink)",
                          }}>
                      {r.status === "open" ? "With the team"
                        : r.status === "reviewing" ? "Being looked at"
                        : r.status === "actioned" ? "Acted on" : "Closed"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <AlsoHere
        items={[
          { href: "/app/intake", label: "Ask for help", note: "Tell us what you need in your own words, and we will find it.", icon: "MessageCircleQuestion" },
        ]}
      />
    </HomeShell>
  );
}

/**
 * Where she is, if the phone will say and quickly.
 *
 * Bounded hard at four seconds. An alert that waits on a GPS fix is an alert
 * that does not go out, and her contacts would rather know she pressed the
 * button without a location than not know at all. `enableHighAccuracy` is off
 * for the same reason — a rough position now beats an exact one later.
 */
async function whereSheIs(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "";
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string) => { if (!settled) { settled = true; resolve(v); } };
    window.setTimeout(() => done(""), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => done(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => done(""),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
    );
  });
}

/** "Your sister and your mother", from the contacts she actually named. */
function namesOf(contacts: { name: string }[]): string {
  const names = contacts.map((c) => c.name.split(" ")[0]);
  if (names.length === 0) return "Nobody";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

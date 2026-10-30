"use client";

import { useMaster } from "@/lib/masters-api";
import { useCallback, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";

import {
  apiFileReport, apiRaiseAlert, apiSafetyCentre, apiStandDown,
  REPORT_CATEGORIES, type SafetyCentre,
} from "@/lib/safety-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, I, IconTile, NoteBtn, SectionHead, Tabs } from "@/components/ux/kit";
import { PlaceMark } from "@/components/ux/nav/Place";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { AlsoHere } from "@/components/ux/AlsoHere";
import { useT, useI18n } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { GroupLabel, PhoneRow } from "@/components/ux/PhoneParts";
import { useToast } from "@/design-system";


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
  // Categories are the staff-controlled master (its top level); the built-in
  // list shows until it loads. The server checks against the same master.
  const reportCategories = useMaster("safety_report_categories", [...REPORT_CATEGORIES]).items.map((c) => c.label);
  const tr = useT();
  const toast = useToast();
  const { locale } = useI18n();
  const [manualShareUrl, setManualShareUrl] = useState("");

  /**
   * Put the alert on somebody else's phone.
   *
   * The link carries a 256-bit token minted with the alert, so holding it is
   * the whole permission — which is what a forwarded link has to be. The page
   * it opens needs no account and no app.
   */
  const shareAlert = useCallback(async (alert: { id: string; share_token?: string }) => {
    if (!alert.share_token) return;
    const url = `${window.location.origin}/sos/${alert.id}?t=${encodeURIComponent(alert.share_token)}`;
    const text = tr("safety.shareMessage");
    try {
      if (navigator.share) {
        await navigator.share({ text: `${text} ${url}` });
        return;
      }
    } catch {
      // She dismissed the sheet. Not an error, and not a reason to then copy
      // something to her clipboard she did not ask for.
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setManualShareUrl("");
      toast.success(tr("safety.linkCopied"));
    } catch {
      setManualShareUrl(url);
      toast.error("Copy was blocked", { description: "Press and hold the link below to copy or share it." });
    }
  }, [toast, tr]);

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
            <SectionHead title={tr("safety.whoGetsTold")} sub={tr("safety.theySeeYourLocationOnlyWhile")} />
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
              <Btn href="/app/settings/account" variant="outline" size="sm" full icon="UserPlus">{tr("safety.addSomeone")}</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("safety.whatWeNeverDo")} icon="Lock" />
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
      {/* On a phone: a column — the large title, its line, then a full-width
          segmented control where the desktop has tabs. */}
      <div className="mb-6 flex flex-col gap-4 lg:mb-[20px] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("safety.getHelpNow")}</h1>
          </div>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("safety.helpYouCanReachInOne")}</p>
        </div>
        <div className="hidden lg:flex">
          <Tabs items={["Get help now", "Know the tricks"]} active={tab} onChange={setTab} />
        </div>
        <SegmentedControl className="lg:hidden" label={tr("safety.getHelpNow")} value={tab} onChange={setTab}
          options={["Get help now", "Know the tricks"].map((t) => ({ value: t, label: t }))} />
      </div>

      {tab === "Get help now" && (
        <>
          <Card className="ux-onscroll mb-[16px]">
            <SectionHead title={tr("safety.tellYourPeopleSomethingIsWrong")}
                         sub={tr("safety.ourTeamIsAlertedAndThese")} />
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
                    {/*
                      Through the catalogue, not a template literal.

                      These two sentences are the ones a woman acts on, and
                      they were the only English left on this screen: a Telugu
                      or Hindi speaker in trouble read them in a language she
                      may not have. The joining of the names is a separate
                      problem — "and" is not a word every language puts in the
                      same place — so `namesOf` uses Intl's list formatter for
                      her locale rather than hardcoding it.
                    */}
                    {openAlert && openAlert.contacts_notified > 0
                      ? tr("safety.ourTeamHasItWithNamed", { names: namesOf(CONTACTS, locale) })
                      : tr("safety.ourTeamHasItNobodyNamed")}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--ux-ink-2)" }}>{tr("safety.ifYouAreInDangerRight")}</p>

                  {/*
                    The part that actually reaches somebody.

                    Naming her contacts tells staff who to call. It does not
                    tell HER contacts anything: there is no SMS provider, no
                    WhatsApp and no voice line, so nothing in this product can
                    reach a phone number. Her own phone can, so she sends the
                    link herself, from whichever app she already has.

                    `navigator.share` where the phone offers it — one tap into
                    WhatsApp, Messages, anything — and a copy button where it
                    does not, which is every desktop browser.
                  */}
                  {openAlert?.share_token && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Btn size="sm" variant="primary" icon="Send"
                           onClick={() => void shareAlert(openAlert)}>
                        {tr("safety.sendToMyPeople")}
                      </Btn>
                      {manualShareUrl && (
                        <a href={manualShareUrl} className="min-w-0 break-all text-2xs font-semibold underline"
                           style={{ color: "var(--ux-brand)" }}>
                          {manualShareUrl}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Who has answered. Until somebody opens that link, nobody
                      has — and saying so is the honest state of an alert. */}
                  {openAlert?.acknowledged_by && openAlert.acknowledged_by.length > 0 && (
                    <p className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-green-ink)" }}>
                      {tr("safety.theyHaveGotIt", { names: namesOf(openAlert.acknowledged_by.map((n) => ({ name: n })), locale) })}
                    </p>
                  )}
                </div>
                <Btn variant="outline" size="sm" disabled={standDown.busy}
                     onClick={() => void standDown.run()}>
                  {standDown.busy ? tr("safety.standingDown")
              : tr("safety.standDown")}
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
              {/*
                A big red round button, not a wide orange card.

                The card was a sentence to read ("Press and hold to send an
                alert") with a small siren beside it. Read without the words it
                was one more box on the page. A large red circle with a siren is
                the alarm button everywhere, and the ring that fills around it
                while she holds is the instruction: keep holding until it is
                full. Press and hold, not tap — a button this consequential
                under a thumb in a pocket must not fire by accident.
              */}
              <div className="flex flex-col items-center gap-3 py-2 sm:flex-row sm:gap-6">
                <button
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") startHold(); }}
                  onKeyUp={endHold}
                  aria-label={tr("safety.pressAndHoldToSendAn")}
                  className="relative grid h-[148px] w-[148px] shrink-0 select-none place-items-center rounded-full touch-none"
                  style={{ background: `conic-gradient(#ff3b3b ${holding * 3.6}deg, color-mix(in oklab, #e01e1e 22%, var(--ux-surface)) 0deg)` }}
                >
                  <span className="grid h-[124px] w-[124px] place-items-center rounded-full"
                        style={{ background: "radial-gradient(circle at 35% 30%, #ff5a5a 0%, #e01e1e 55%, #b30f0f 100%)",
                                 boxShadow: "0 12px 28px -8px rgba(200,20,20,.6)",
                                 transform: holding > 0 ? "scale(.96)" : "none", transition: "transform 160ms var(--ux-ease-out)" }}>
                    <span className="flex flex-col items-center text-white">
                      <Icons.Siren className="h-[44px] w-[44px]" strokeWidth={1.9} />
                      <span className="mt-1 text-lg font-extrabold tracking-[0.08em]">
                        {raise.busy ? "…" : holding > 0 ? `${Math.max(1, Math.ceil((100 - holding) / 100 * 1.5))}` : "SOS"}
                      </span>
                    </span>
                  </span>
                </button>
                <span className="min-w-0 text-center sm:text-start">
                  <span className="flex items-center justify-center gap-2 text-base font-semibold sm:justify-start" style={{ color: "var(--ux-ink)" }}>
                    <Icons.Hand className="h-5 w-5 shrink-0" style={{ color: "#e01e1e" }} />
                    {raise.busy ? "Sending the alert…"
                      : holding > 0 ? tr("safety.keepHolding")
                        : tr("safety.pressAndHoldToSendAn")}
                  </span>
                  <span className="mt-1 block text-xs" style={{ color: "var(--ux-ink-2)" }}>
                    Hold for one and a half seconds. Let go and nothing happens.
                  </span>
                </span>
              </div>
              </>
            )}
          </Card>

          <GroupLabel sub={tr("safety.freeFromAnyPhoneEvenWithout")}>{tr("safety.numbersThatAlwaysWork")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("safety.numbersThatAlwaysWork")} sub={tr("safety.freeFromAnyPhoneEvenWithout")} />
          </div>
          {/*
            Every number as a picture you can tap.

            A grouped list of "181 · Women's Helpline (All India) · Free, 24x7…"
            asks her to read before she can choose. Each line is now a tile
            whose picture says who answers — a siren for 112, a woman for 181,
            a child for 1098, a house for abuse at home — with the number large
            under it and a phone on it. The whole tile is the call. The number
            stays on the page as text: she may be reading it out, or writing
            it down.
          */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-[16px]">
            {HELPLINES.map((h, i) => {
              const pic = helplinePicture(h);
              return (
                <a key={h.number} href={`tel:${h.number}`} aria-label={`Call ${h.number}, ${h.name}`}
                   className="ux-press ux-rise flex min-w-0 flex-col overflow-hidden rounded-[18px]"
                   style={{ ["--i" as string]: i, background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-card)" }}>
                  <span className="relative grid aspect-[16/10] place-items-center overflow-hidden"
                        style={{ background: "var(--ux-pic-ground)" }}>
                    <span aria-hidden className="absolute -end-[14%] -top-[26%] aspect-square w-[58%] rounded-full bg-white/15" />
                    <I name={pic.icon} sw={1.7} className="relative h-[46%] w-[46%] text-white" />
                    <span className="absolute bottom-2 end-2 grid h-9 w-9 place-items-center rounded-full bg-white shadow-md">
                      <Icons.PhoneCall className="h-[18px] w-[18px]" style={{ color: "var(--ux-fill)" }} />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col px-3 py-2.5 lg:px-4 lg:py-3">
                    {/* A ten-digit number in a two-up tile on a 390px phone needs a smaller size to stay inside it. */}
                    <span className={`font-extrabold leading-none tabular-nums tracking-[-0.01em] ${h.number.length > 6 ? "text-[19px] lg:text-[24px]" : "text-[26px] lg:text-[30px]"}`}
                          style={{ color: "var(--ux-ink)" }}>
                      {h.number}
                    </span>
                    <span className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>{h.name}</span>
                    <span className="mt-1 line-clamp-3 hidden text-xs leading-snug sm:block" style={{ color: "var(--ux-muted)" }}>{h.desc}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </>
      )}

      {tab === "Know the tricks" && (
        <ListGroup className="mb-4 lg:hidden">
          {SCAMS.map((s) => (
            <PhoneRow key={s.id} icon={s.icon} tint="--ux-tint-orange" ink="--ux-orange" title={s.title} body={s.body} />
          ))}
        </ListGroup>
      )}
      {tab === "Know the tricks" && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {SCAMS.map((s, i) => (
            <Card key={s.id} className="ux-i ux-onscroll max-lg:hidden" style={{ ["--i" as string]: i }}>
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("safety.hasAnyOfThisHappenedTo")}</h3>
                <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("safety.tellUsWeRemoveTheAccount")}</p>
              </div>
              {/* This said "Reported. We are looking at it now." and filed
                  nothing. `apiFileReport` — POST /safety/reports — has existed
                  in safety-api.ts the whole time and was imported by nobody.
                  The category is asked for because the server requires one,
                  and because "harassment" and "a fake account" are not the
                  same queue. */}
              <NoteBtn label={tr("safety.reportSomeone")} variant="primary" size="md" icon="Flag"
                       title={tr("safety.reportSomeone2")} to="the WomSakhi safety team"
                       choices={reportCategories} choiceDefault="Something else"
                       choiceLabel="What kind of thing is this?"
                       placeholder={tr("safety.whoWasItWhatHappenedAnd")}
                       send={async (n) => {
                         await apiFileReport({ category: n.choice, details: n.text });
                         refetch();
                       }}
                       sent={tr("safety.filedTheSafetyTeamHasIt")}
                       sentBody={tr("safety.itIsListedBelowWithWhat")}
                       sentLink={null} />
            </div>
          </Card>

          {/* Filed reports, from the server — not a claim that one was filed. */}
          {REPORTS.length > 0 && (
            <Card className="ux-onscroll">
              <SectionHead title={tr("safety.whatYouHaveReported")}
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
          { href: "/app/intake", label: tr("fund.ask"), note: tr("safety.tellUsWhatYouNeedIn"), icon: "MessageCircleQuestion" },
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
/**
 * The picture of who answers a number: by the number where it is a national
 * one, by its words otherwise. Every tile stands on the brand; the picture is
 * what tells them apart.
 */
function helplinePicture(h: { number: string; name: string; desc?: string; urgent?: boolean }): { icon: string } {
  const text = `${h.name} ${h.desc ?? ""}`.toLowerCase();
  const by: Record<string, string> = {
    "112": "Siren", "100": "Siren", "181": "Venus", "1091": "Venus", "108": "Ambulance", "102": "Ambulance",
    "1098": "Baby", "14416": "Brain", "1930": "Smartphone", "7827170170": "Venus", "14490": "Venus",
  };
  if (by[h.number]) return { icon: by[h.number] };
  // Who it is for before what it offers: a women's line that also counsels is a women's line.
  if (/wom[ae]n|ncw/.test(text)) return { icon: "Venus" };
  if (/domestic|abuse|home/.test(text)) return { icon: "Home" };
  if (/child/.test(text)) return { icon: "Baby" };
  if (/mental|counsel|mind/.test(text)) return { icon: "Brain" };
  if (/cyber|fraud|online/.test(text)) return { icon: "Smartphone" };
  if (/ambulance|medical/.test(text)) return { icon: "Ambulance" };
  if (/wom[ae]n/.test(text)) return { icon: "Venus" };
  return { icon: h.urgent ? "Siren" : "Phone" };
}

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
/**
 * "Meera, Kavita and Sunita" — in her language's own way of joining a list.
 *
 * This hardcoded ", " and " and ", which is English. `Intl.ListFormat` knows
 * that Telugu joins with "మరియు" and Hindi with "और", and where each goes.
 */
function namesOf(contacts: { name: string }[], locale: string): string {
  const names = contacts.map((c) => c.name.split(" ")[0]).filter(Boolean);
  if (names.length === 0) return "";
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
  } catch {
    // An engine or a locale tag Intl does not know. Never let a formatter
    // decide whether a safety sentence renders at all.
    return names.join(", ");
  }
}

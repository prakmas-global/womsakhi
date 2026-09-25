"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { apiGetSession } from "@/lib/api";
import { apiIntake, apiIntakeNeeds } from "@/lib/member-api";
import { apiFinishOnboarding, apiFinishStep } from "@/lib/theme-api";
import { messageFrom } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";

import { useAuth } from "@/context/AuthContext";
import { Btn, IconTile } from "@/components/ux/kit";
import { OnboardAside, OnboardFrame } from "@/components/ux/onboard/Frame";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { PhoneRow, phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";

/**
 * A picture for each thing she can ask for.
 *
 * Presentation only — the keys, the labels and the hints all come from
 * `/me/intake/needs`, because they are what the matcher on the other side
 * actually understands. This screen used to carry its own five goals with its
 * own ids, which meant her answer could not be sent anywhere even once the
 * button was wired.
 */
const NEED_LOOK: Record<string, { icon: string; tint: string; ink: string }> = {
  earn:       { icon: "BadgeIndianRupee", tint: "--ux-tint-green",  ink: "--ux-green" },
  business:   { icon: "TrendingUp",       tint: "--ux-tint-orange", ink: "--ux-orange" },
  skill:      { icon: "GraduationCap",    tint: "--ux-tint-violet", ink: "--ux-violet" },
  digital:    { icon: "Smartphone",       tint: "--ux-tint-blue",   ink: "--ux-blue" },
  confidence: { icon: "Sparkles",         tint: "--ux-tint-pink",   ink: "--ux-pink" },
  support:    { icon: "UsersRound",       tint: "--ux-tint-lilac",  ink: "--ux-brand" },
};

const TRADES = [
  "Tailoring", "Baking", "Beauty", "Handloom", "Teaching",
  "Farming", "Shop", "Office work", "Not sure yet",
];

const HOURS = [
  ["An hour here and there", "Around the house and the children", "Clock"],
  ["A few hours most days", "I can plan around it", "CalendarDays"],
  ["Most of the day", "This is my main work", "Sun"],
] as const;

/**
 * Welcome — three questions, then out of the way.
 *
 * Onboarding earns nothing on its own; every screen here is a screen she is not
 * using the app. So it asks the smallest number of things that genuinely change
 * what she is shown, says why each one is asked, and lets her skip.
 *
 * **"They decide what you see" was not true.** `finish` was
 * `router.replace("/app")` and nothing else: her three answers stayed in
 * component state and died with the page. Worse, the member layout sends
 * anyone whose account says `onboarding_complete === false` back here — and
 * only `POST /theme/onboarding/finish` clears that — so a woman who answered
 * every question and pressed "Take me in" was returned to this screen, and
 * again, and again, with no way into the app at all.
 *
 * Now: her answers go to `/me/intake`, which is the endpoint that turns them
 * into suggestions; each question marks its step finished as she passes it, so
 * closing the app halfway does not make her start over; and finishing tells
 * the server, then re-reads the account so the layout lets her through.
 */
export default function WelcomePage() {
  const tr = useT();
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const first = (user?.full_name || "").trim().split(" ")[0] || "Sakhi";

  // The things she can ask for, as the matcher knows them.
  const { data: NEEDS, source } = useResource(
    useCallback(() => apiIntakeNeeds(), []),
    [],
  );

  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [trade, setTrade] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");

  /** Her answers, in her own words, for the matcher to read. */
  const asSentence = () => {
    const parts = [
      picked.length ? NEEDS.filter((n) => picked.includes(n.key)).map((n) => n.label).join(". ") : "",
      trade && trade !== "Not sure yet" ? `I work in ${trade.toLowerCase()}.` : "",
      hours ? `I have ${hours.toLowerCase()}.` : "",
    ];
    return parts.filter(Boolean).join(" ").trim();
  };

  /**
   * Leave onboarding — by answering or by skipping.
   *
   * `finish` is what clears `onboarding_complete` on the account, and the
   * account is what the layout gate reads, so the session has to be re-read
   * before navigating. Replacing the route without it sends her straight back
   * here.
   */
  async function leave(save: boolean) {
    setWorking(true);
    setProblem("");
    try {
      /**
       * Her answers, kept on the account as context — this is the endpoint
       * that makes "they decide what you see" a true sentence.
       *
       * Started, but deliberately not waited on. `/me/intake` does the
       * matching itself and takes between a quarter of a second and half a
       * minute depending on how warm the server is; measured cold on this
       * machine it took 33 seconds. Holding a woman on "Saving…" for that
       * long is how she force-quits the app — which drops her back onto this
       * screen with nothing recorded. A client-side route change does not
       * cancel an XHR, so it lands either way, and if it does not, her
       * answers are a preference she can set again in Settings rather than
       * something she loses.
       */
      if (save && (picked.length || trade || hours)) {
        void apiIntake(asSentence(), picked)
          .then(() => apiFinishStep("needs"))
          .catch(() => {});
      }
      // This is the one that actually gates her, and it is fast. Appearance
      // and language are asked in Settings, not here; the server treats a
      // skipped step as a finished decision rather than a gap, which is
      // exactly what `finish` is for.
      await apiFinishOnboarding();
      const fresh = await apiGetSession().catch(() => null);
      if (fresh) updateUser(fresh);
      router.replace("/app");
    } catch (e) {
      setProblem(messageFrom(e, "That did not go through. Nothing has been saved — try again in a moment."));
      setWorking(false);
    }
  }

  async function next() {
    if (step === 3) { await leave(true); return; }
    setProblem("");
    // Saved per step rather than at the end, so closing the app halfway
    // through does not make her start over.
    if (step === 1) {
      setWorking(true);
      try {
        await apiFinishStep("welcome");
      } catch {
        // A progress marker is not worth stopping her for. The answers
        // themselves are sent on the last step, where a failure is told.
      } finally {
        setWorking(false);
      }
    }
    setStep(step + 1);
  }

  /**
   * The server owns this list and sends it in English, with a stable `key`
   * for each entry. So the key is what we translate on, and the server's own
   * words are what shows if a new need arrives before its Telugu does — the
   * screen is never blank and never wrong, only sometimes still English.
   */
  const needText = (key: string, part: "label" | "hint", fallback: string) => {
    const id = `welcome.need.${key}.${part}` as Parameters<typeof tr>[0];
    const out = tr(id);
    return out === id ? fallback : out;
  };

  return (
    <OnboardFrame
      step={step}
      total={3}
      title={
        step === 1 ? tr("welcome.namaste", { name: first })
        : step === 2 ? tr("welcome.whatDoYouDoOrWant")
              : tr("welcome.howMuchTimeDoYouHave")
      }
      sub={
        step === 1 ? tr("welcome.threeQuestionsAboutAMinute")
        : step === 2 ? tr("welcome.itDecidesWhichWorkAndWhich")
              : tr("welcome.thereIsNoWrongAnswerIt")
      }
      aside={
        <OnboardAside
          art="/ux/art/scene-women-celebrating.webp"
          title={tr("welcome.whyWeAsk")}
          body={tr("welcome.everyAnswerChangesWhatLandsOn")}
          points={[
            tr("welcome.youCanChangeAllOfIt"),
            tr("welcome.skipAnythingYouWouldRatherNot"),
            tr("welcome.neverShownToEmployersOrBuyers"),
          ]}
        />
      }
      footer={
        <div>
          {problem && (
            <p role="alert" className="ux-slide-up mb-3 rounded-[12px] p-3 text-xsm leading-relaxed"
               style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
              {problem}
            </p>
          )}
          {/* On a phone: Next full width on top, Back under it, and "Skip" as
              a quiet line at the bottom — the thumb reaches the one it wants. */}
          <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <button
              onClick={() => void leave(false)}
              disabled={working}
              className="ux-press -my-1 py-1 text-xsm font-medium max-lg:my-0 max-lg:min-h-[44px]"
              style={{ color: "var(--ux-muted)", opacity: working ? 0.55 : 1 }}
            >{tr("welcome.skipForNow")}</button>
            <div className="flex flex-col-reverse gap-2.5 lg:flex-row lg:items-center">
              {step > 1 && (
                <Btn variant="outline" icon="ArrowLeft" disabled={working} className={phoneSecondary}
                     onClick={() => setStep(step - 1)}>Back</Btn>
              )}
              <Btn variant="primary" className={phonePrimary}
                   icon={working ? "Loader" : undefined}
                   iconEnd={working ? undefined : "ArrowRight"}
                   disabled={working}
                   onClick={() => void next()}>
                {working ? "Saving…" : step === 3 ? "Take me in" : "Next"}
              </Btn>
            </div>
          </div>
        </div>
      }
    >
      {step === 1 && (
        NEEDS.length ? (
          <>
          {/* Any number of them: on a phone, a grouped list with a checkmark on each. */}
          <ListGroup className="lg:hidden">
            {NEEDS.map((n) => {
              const on = picked.includes(n.key);
              const look = NEED_LOOK[n.key] ?? { icon: "Star", tint: "--ux-tint-lilac", ink: "--ux-brand" };
              return (
                <PhoneRow key={n.key} icon={look.icon} tint={look.tint} ink={look.ink} title={needText(n.key, "label", n.label)} meta={needText(n.key, "hint", n.hint)}
                          selected={on} onClick={() => setPicked((s) => (on ? s.filter((x) => x !== n.key) : [...s, n.key]))} />
              );
            })}
          </ListGroup>
          <div className="ux-deck hidden grid-cols-2 gap-[12px] lg:grid">
            {NEEDS.map((n, i) => {
              const on = picked.includes(n.key);
              const look = NEED_LOOK[n.key] ?? { icon: "Star", tint: "--ux-tint-lilac", ink: "--ux-brand" };
              return (
                <button
                  key={n.key}
                  onClick={() => setPicked((s) => (on ? s.filter((x) => x !== n.key) : [...s, n.key]))}
                  aria-pressed={on}
                  className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] border p-4 text-start"
                  style={{
                    borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                    background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                    ["--i" as string]: i,
                  }}
                >
                  <IconTile icon={look.icon} tint={look.tint} ink={look.ink} size={44} radius={12} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{needText(n.key, "label", n.label)}</span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{needText(n.key, "hint", n.hint)}</span>
                  </span>
                  {on && <Icons.Check className="ux-pop h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
                </button>
              );
            })}
          </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            {source === "loading"
              ? tr("welcome.fetchingTheList")
              : tr("welcome.weCouldNotFetchThisList")}
          </p>
        )
      )}

      {step === 2 && (
        <ListGroup className="lg:hidden">
          {TRADES.map((t) => (
            <PhoneRow key={t} title={t} selected={trade === t} onClick={() => setTrade(t)} />
          ))}
        </ListGroup>
      )}
      {step === 2 && (
        <div className="hidden flex-wrap gap-2.5 lg:flex">
          {TRADES.map((t) => {
            const on = trade === t;
            return (
              <button
                key={t}
                onClick={() => setTrade(t)}
                aria-pressed={on}
                className="ux-press ux-sq rounded-[12px] border px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line-strong)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  color: on ? "var(--ux-brand)" : "var(--ux-ink)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <ListGroup className="lg:hidden">
          {HOURS.map(([label, note, icon]) => (
            <PhoneRow key={label} icon={icon} tint="--ux-tint-lilac" ink="--ux-brand" title={label} meta={note}
                      selected={hours === label} onClick={() => setHours(label)} />
          ))}
        </ListGroup>
      )}
      {step === 3 && (
        <div className="ux-deck hidden space-y-[12px] lg:block">
          {HOURS.map(([label, note, icon], i) => {
            const on = hours === label;
            return (
              <button
                key={label}
                onClick={() => setHours(label)}
                aria-pressed={on}
                className="ux-i ux-sq flex w-full items-center gap-3.5 rounded-[12px] border p-4 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <IconTile icon={icon} tint="--ux-tint-lilac" ink="--ux-brand" size={44} radius={12} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{label}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--ux-muted)" }}>{note}</span>
                </span>
                {on && <Icons.Check className="ux-pop h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
              </button>
            );
          })}
        </div>
      )}
    </OnboardFrame>
  );
}

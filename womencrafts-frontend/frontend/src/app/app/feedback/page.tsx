"use client";

import { useState } from "react";

import { apiLeaveFeedback } from "@/lib/member-api";
import { messageFrom } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useT } from "@/i18n";

const KINDS = [
  { id: "idea", label: "An idea", note: "Something you wish this app did",
    icon: "Lightbulb", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "broken", label: "Something is broken", note: "A screen or number that is wrong",
    icon: "Bug", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "hard", label: "Something is confusing", note: "You could not work out how to do it",
    icon: "HelpCircle", tint: "--ux-tint-blue", ink: "--ux-blue" },
  { id: "thanks", label: "Something good", note: "What worked, so we keep it",
    icon: "Heart", tint: "--ux-tint-pink", ink: "--ux-pink" },
];

const SHIPPED = [
  { id: "s1", what: "Sakhi now speaks Telugu properly", who: "Asked for by 40 women", when: "May 2026" },
  { id: "s2", what: "The wallet shows money that is still on its way", who: "Asked for by 112 women", when: "April 2026" },
  { id: "s3", what: "Course videos work on a slow connection", who: "Asked for by 89 women", when: "March 2026" },
];

/**
 * Feedback — and proof that it goes somewhere.
 *
 * The list of what has already changed because women asked is the point of this
 * screen, not decoration. A feedback form with no evidence anyone reads it is a
 * suggestion box nailed shut, and most people work that out after one try.
 */
export default function FeedbackPage() {
  const tr = useT();
  const [kind, setKind] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState("");

  const canSend = kind !== null && text.trim().length >= 10;

  /**
   * Send it.
   *
   * This waited 850ms and said "sent". Nothing left the browser — which is
   * the one thing a feedback form must not do, because the whole screen is an
   * argument that somebody reads these, and the rail beside it lists what
   * changed "because women asked".
   *
   * `rating` is 0: this form asks what kind of thing it is, not for stars, and
   * inventing a score she never gave would land in the same tables the real
   * ratings do.
   */
  const send = async () => {
    if (!canSend || stage !== "idle") return;
    setStage("sending");
    setProblem("");
    try {
      await apiLeaveFeedback({ text: text.trim(), rating: 0, type: kind ?? "idea" });
      setStage("sent");
    } catch (e) {
      setProblem(messageFrom(e, "That did not go through. Nothing has been lost — try again in a moment."));
      setStage("idle");
    }
  };

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("feedback.whatChangedBecauseWomenAsked")} sub={tr("feedback.theLastThree")} />
            <ul className="ux-stagger space-y-3.5">
              {SHIPPED.map((s) => (
                <li key={s.id} className="ux-hov flex items-start gap-3">
                  <span className="mt-[2px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full"
                        style={{ background: "var(--ux-green-ink)" }}>
                    <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3.2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xsm font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{s.what}</p>
                    <p className="mt-1 text-2xs" style={{ color: "var(--ux-muted)" }}>{s.who} · {s.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("feedback.ifItIsUrgent")} icon="LifeBuoy" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              This goes to the team who build the app, and they read it within a few days. If money is
              stuck or someone is behaving badly, use Help or Safety instead — those reach someone today.
            </p>
            <div className="mt-3.5 flex gap-2">
              <Btn href="/app/help" variant="outline" size="sm">Help</Btn>
              <Btn href="/app/safety" variant="outline" size="sm">Safety</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("feedback.tellUsWhatYouThink")}</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("feedback.weReadEveryMessageOurselvesNo")}</p>

      {stage === "sent" ? (
        <Card className="ux-slide-up">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/scene-woman-order-notification.webp" alt=""
                 className="h-[86px] w-[86px] shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("feedback.thankYouWeHaveIt")}</h2>
              <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                Someone on the team will read this within a few days. If it turns into a change, you will
                see it in the list of what women asked for.
              </p>
              <div className="mt-4 flex gap-2.5">
                <Btn href="/app" variant="primary" iconEnd="ArrowRight">{tr("feedback.backToHome")}</Btn>
                <Btn variant="outline" onClick={() => { setStage("idle"); setText(""); setKind(null); }}>{tr("feedback.saySomethingElse")}</Btn>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--ux-faint)" }}>{tr("feedback.whatKindOfThingIsIt")}</p>
          <div className="ux-deck mb-[20px] grid grid-cols-2 gap-[12px]">
            {KINDS.map((k, i) => {
              const on = kind === k.id;
              return (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  aria-pressed={on}
                  className="ux-i ux-sq ux-onscroll flex items-center gap-3.5 rounded-[12px] border p-3.5 text-start"
                  style={{
                    borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                    background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                    ["--i" as string]: i,
                  }}
                >
                  <IconTile icon={k.icon} tint={k.tint} ink={k.ink} size={42} radius={11} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {k.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                      {k.note}
                    </span>
                  </span>
                  {on && <Icons.Check className="ux-pop h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
                </button>
              );
            })}
          </div>

          <Card>
            <label className="block">
              <span className="mb-2 block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("feedback.tellUsInYourOwnWords")}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={tr("feedback.whateverItIsLongOrShort")}
                aria-label={tr("feedback.yourMessage")}
                className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none"
                style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
              />
            </label>

            <div className="mt-3 flex items-center justify-between gap-4">
              {/* Say what is still needed, rather than a disabled button that
                  gives no reason for being disabled. */}
              <p className="text-xs" style={{ color: "var(--ux-faint)" }}>
                {!kind
                  ? "Pick what kind of thing it is above."
                  : text.trim().length < 10
                    ? tr("feedback.aSentenceOrTwoIsEnough")
              : tr("feedback.sentStraightToThePeopleWho")}
              </p>
              <Btn
                variant="primary"
                icon={stage === "sending" ? "Loader" : undefined}
                iconEnd={stage === "sending" ? undefined : "Send"}
                onClick={() => void send()}
                disabled={!canSend || stage === "sending"}
              >
                {stage === "sending" ? "Sending…" : "Send"}
              </Btn>
            </div>
            {problem && (
              <p role="alert" className="ux-slide-up mt-3 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}
          </Card>
        </>
      )}
    </HomeShell>
  );
}

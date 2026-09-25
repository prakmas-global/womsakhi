"use client";

import { useCallback, useState } from "react";

import {
  apiIntake, apiIntakeNeeds, type IntakeNeed, type IntakeResult,
} from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, EmptyState, IconTile, Pill, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneRow, phonePrimary } from "@/components/ux/PhoneParts";

/** What a given need maps to. Real routes, so nothing here is a dead end. */
/**
 * Tell us what you need — the shortest path from a sentence to a next step.
 *
 * The point is that it ANSWERS. A form that thanks her and says someone will be
 * in touch teaches her the app is a waiting room; this one turns what she says
 * into three things she can open right now, each with a reason attached.
 */
/**
 * How each need looks. Keyed on the server's own keys, with a plain fallback —
 * the screen used to carry its own five keys, which did not match the server's.
 */
const LOOK: Record<string, { icon: string; tint: string; ink: string }> = {
  earn:       { icon: "BadgeIndianRupee", tint: "--ux-tint-green",  ink: "--ux-green" },
  business:   { icon: "Store",            tint: "--ux-tint-orange", ink: "--ux-orange" },
  skill:      { icon: "GraduationCap",    tint: "--ux-tint-violet", ink: "--ux-violet" },
  digital:    { icon: "Smartphone",       tint: "--ux-tint-blue",   ink: "--ux-blue" },
  confidence: { icon: "MessageCircle",    tint: "--ux-tint-pink",   ink: "--ux-pink" },
  loan:       { icon: "Landmark",         tint: "--ux-tint-blue",   ink: "--ux-blue" },
};
const PLAIN = { icon: "Target", tint: "--ux-tint-lilac", ink: "--ux-brand" };

export default function IntakePage() {
  const tr = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");

  /**
   * The needs the server offers, and the answer it gives back.
   *
   * Both were constants. The five needs here used different keys from the
   * server's own list, and the suggestions were five hand-written cards — one
   * of them a "Craft Mela — Jaipur, a stall on 24 May, ₹300, twelve places
   * left" that no office was holding. The screen says above the button that
   * "everything on your home screen is chosen from what you say here", and
   * nothing she said was ever sent.
   */
  const { data: NEEDS } = useResource(
    useCallback(() => apiIntakeNeeds(), []),
    [] as IntakeNeed[],
  );

  const [result, setResult] = useState<IntakeResult | null>(null);
  const answered = result !== null;
  const results = result ? [...result.services, ...result.programs] : [];

  const ask = useAction(
    async () => { setResult(await apiIntake(text.trim(), picked)); },
    { fallbackError: "That did not go through. Nothing you picked has been lost — try again in a moment." },
  );

  return (
    <HomeShell
      active="/app/explore"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("intake.whyThisIsWorthAMinute")} icon="Info" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Everything on your home screen is chosen from what you say here. Change it whenever your
              situation changes — after a good month, or a hard one.
            </p>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-green))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/mascot-robot-waving.webp" alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[96px] w-[96px] object-contain" />
            <h3 className="relative w-[62%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("intake.orJustSayIt")}</h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("intake.sakhiListensInYourOwnLanguage")}</p>
            <div className="relative mt-3 w-[62%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">{tr("intake.talkToSakhi")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("intake.askForHelp")}</h1>
      <p className="mb-6 mt-1.5 text-xsm lg:mb-[20px]" style={{ color: "var(--ux-muted)" }}>{tr("intake.pickAsManyAsAreTrue")}</p>

      {/* Any number of them, so on a phone: a grouped list, a checkmark on
          each one she picks. */}
      <ListGroup className="mb-6 lg:hidden">
        {NEEDS.map((n) => {
          const on = picked.includes(n.key);
          const look = LOOK[n.key] ?? PLAIN;
          return (
            <PhoneRow key={n.key} icon={look.icon} tint={look.tint} ink={look.ink}
                      title={n.label} meta={n.hint} selected={on}
                      onClick={() => { setPicked((p) => (on ? p.filter((x) => x !== n.key) : [...p, n.key])); setResult(null); }} />
          );
        })}
      </ListGroup>
      <div className="ux-deck mb-[20px] hidden grid-cols-2 gap-[12px] lg:grid">
        {NEEDS.map((n, i) => {
          const on = picked.includes(n.key);
          return (
            <button
              key={n.key}
              onClick={() => { setPicked((p) => (on ? p.filter((x) => x !== n.key) : [...p, n.key])); setResult(null); }}
              aria-pressed={on}
              className="ux-i ux-sq ux-onscroll flex items-center gap-3.5 rounded-[12px] border p-4 text-start"
              style={{
                borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                ["--i" as string]: i,
              }}
            >
              <IconTile {...LOOK[n.key] ?? PLAIN} size={44} radius={12} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{n.label}</span>
                <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{n.hint}</span>
              </span>
              {on && <Icons.Check className="ux-pop h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
            </button>
          );
        })}
      </div>

      <Card className="mb-[20px]">
        <label className="block">
          <span className="mb-2 block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("intake.anythingElseInYourOwnWords")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={tr("intake.optionalHindiOrEnglishWhateverCome")}
            aria-label={tr("intake.anythingElse")}
            className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none max-lg:p-4 max-lg:text-[17px]"
            style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
          />
        </label>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <p className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
            {picked.length ? `${picked.length} selected` : "Pick at least one above."}
          </p>
          <Btn variant="primary" iconEnd={ask.busy ? undefined : "ArrowRight"} className={phonePrimary}
               icon={ask.busy ? "Loader" : undefined}
               disabled={!picked.length || ask.busy}
               onClick={() => void ask.run()}>
            {ask.busy ? "Looking…" : "Show me what to do"}
          </Btn>
        </div>
      </Card>

      {/* The answer, on this screen. Not a thank-you and a wait. */}
      {answered && (
        results.length ? (
          <div className="ux-slide-up">
            <GroupLabel sub={tr("intake.chosenFromWhatYouJustTold")}>{tr("intake.startWithThese")}</GroupLabel>
            <div className="hidden lg:block">
              <SectionHead title={tr("intake.startWithThese")} sub={tr("intake.chosenFromWhatYouJustTold")} />
            </div>
            <ListGroup className="lg:hidden">
              {results.map((r) => (
                <PhoneRow key={r.id} href={r.kind === "program" ? `/app/programs/${r.id}` : `/app/explore/service/${r.id}`}
                          icon={r.kind === "program" ? "GraduationCap" : "Store"}
                          tint={r.kind === "program" ? "--ux-tint-violet" : "--ux-tint-orange"}
                          ink={r.kind === "program" ? "--ux-violet" : "--ux-orange"}
                          title={
                            <span className="flex flex-wrap items-center gap-2">
                              {r.name}
                              <Pill tone="brand" size="sm">{r.kind === "program" ? "Course" : "Service"}</Pill>
                            </span>
                          }
                          body={r.reason || r.meta || r.description} />
              ))}
            </ListGroup>
            <div className="ux-deck ux-stagger hidden space-y-[12px] lg:block">
              {results.map((r, i) => (
                <a key={r.id} href={r.kind === "program" ? `/app/programs/${r.id}` : `/app/explore/service/${r.id}`}
                   className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}>
                  <IconTile icon={r.kind === "program" ? "GraduationCap" : "Store"}
                            tint={r.kind === "program" ? "--ux-tint-violet" : "--ux-tint-orange"}
                            ink={r.kind === "program" ? "--ux-violet" : "--ux-orange"} size={46} radius={12} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {r.name}
                      </span>
                      <Pill tone="brand" size="sm">{r.kind === "program" ? "Course" : "Service"}</Pill>
                    </span>
                    {/* Why it was chosen — otherwise it is just a list again. */}
                    <span className="mt-1 block text-xsm" style={{ color: "var(--ux-muted)" }}>{r.reason || r.meta || r.description}</span>
                  </span>
                  <Icons.ArrowRight className="ux-arrow h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <EmptyState icon="Compass" title={tr("intake.nothingMatched")}
                        body={tr("intake.tellSakhiInsteadSheCanLook")}
                        action={<Btn href="/app/sakhi" variant="primary" iconEnd="ArrowRight">{tr("intake.talkToSakhi2")}</Btn>} />
          </Card>
        )
      )}
    </HomeShell>
  );
}

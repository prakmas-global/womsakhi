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
            <SectionHead title="Why this is worth a minute" icon="Info" />
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
            <h3 className="relative w-[62%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              Or just say it
            </h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Sakhi listens in your own language and finds the same things.
            </p>
            <div className="relative mt-3 w-[62%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">Talk to Sakhi</Btn>
            </div>
          </div>
        </div>
      }
    >
      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Ask for help</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        Pick as many as are true. You get answers on this screen, not a promise to call you back.
      </p>

      <div className="ux-deck mb-[20px] grid grid-cols-2 gap-[12px]">
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
          <span className="mb-2 block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
            Anything else, in your own words
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Optional. Hindi or English — whatever comes easier."
            aria-label="Anything else"
            className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none"
            style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "var(--ux-faint)" }}>
            {picked.length ? `${picked.length} selected` : "Pick at least one above."}
          </p>
          <Btn variant="primary" iconEnd={ask.busy ? undefined : "ArrowRight"}
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
            <SectionHead title="Start with these" sub="Chosen from what you just told us — each one opens where it lives" />
            <div className="ux-deck ux-stagger space-y-[12px]">
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
            <EmptyState icon="Compass" title="Nothing matched"
                        body="Tell Sakhi instead — she can look in places this form cannot."
                        action={<Btn href="/app/sakhi" variant="primary" iconEnd="ArrowRight">Talk to Sakhi</Btn>} />
          </Card>
        )
      )}
    </HomeShell>
  );
}

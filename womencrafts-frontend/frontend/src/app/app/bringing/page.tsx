"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { OBJECTIONS, SPEAKERS, type Objection } from "@/components/ux/reach/data";

/**
 * Bringing them along — deliberately the narrowest module in the app.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * Bain and Google found the top constraint for roughly half of rural women
 * solopreneurs in India is the **absence of social permission to work** — not
 * tools, not skills, not credit — and their satisfaction with existing services
 * scores *negative*. The research artifact's own conclusion was blunt: a better
 * app does not move that. The intermediary, the circle, and the
 * household-facing view do. Two of those three are already built.
 *
 * ── What this is NOT, and the restraint is the design ───────────────────────
 * Not an app that manages her family. Not a script for her marriage. Not advice
 * on handling a man. That would be patronising at best, and on a shared handset
 * — where the person she would be "handling" may read this screen — it could
 * put her in danger. There is no tracking here, no "progress" on a household,
 * and nothing is ever sent to anyone on her behalf.
 *
 * ── What it IS ──────────────────────────────────────────────────────────────
 * Three concrete things she can choose to put in front of a household: the
 * sentence they actually said, an answer to that specific sentence, and a woman
 * further along who will come and speak to them. The evidence for the third is
 * the strongest — in the Delhi trial, someone who physically went with her
 * raised follow-through 70%, against 41% for help with paperwork alone.
 *
 * Every objection is phrased as *they said this*, never as *your husband is
 * wrong*. She is not being coached against her family. She is being handed
 * something to show.
 */
export default function BringingPage() {
  const [open, setOpen] = useState<string | null>("ob2");
  const [asked, setAsked] = useState<string | null>(null);

  const answer = useMemo(() => OBJECTIONS.find((o) => o.id === open) ?? null, [open]);

  const ask = useCallback((name: string) => {
    setAsked(`${name} has been asked. She will message you first — nobody at your home is contacted until you say so.`);
  }, []);

  return (
    <HomeShell active="/app/bringing">
      <div className="flex flex-col gap-5" id="bringing-page">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            At home
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            When someone at home is not sure about this
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            For about half the women doing this, the hardest part was never the work — it was
            somebody at home. This page does not tell you what to say to them. It gives you
            something to show them, and somebody who will come and speak to them if you want.
          </p>
          <div className="mt-3"><ReadAloud targetId="bringing-page" label="Read this to me" /></div>
        </header>

        {/* Their words, then something to show. */}
        <div>
          <SectionHead title="What did they say?" sub="Pick the one you actually heard" icon="MessageCircle" />
          <div className="flex flex-wrap gap-2">
            {OBJECTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setOpen(open === o.id ? null : o.id)}
                      aria-pressed={open === o.id}
                      className="ux-press ux-sq rounded-[12px] px-3.5 py-2.5 text-left text-[0.8125rem] font-semibold"
                      style={{
                        background: v(open === o.id ? "--ux-fill" : "--ux-surface"),
                        color: v(open === o.id ? "--ux-on-brand" : "--ux-ink"),
                        border: `1px solid ${v(open === o.id ? "--ux-fill" : "--ux-line")}`,
                      }}>
                {o.said}
              </button>
            ))}
          </div>
        </div>

        {answer && <Answer o={answer} />}

        {/* The arm with the strongest evidence behind it. */}
        <div>
          <SectionHead title="Or ask a woman to come and speak to them"
                       sub="Someone from here who has done this for years" icon="UserRoundCheck" />
          <div className="flex flex-col gap-2.5">
            {SPEAKERS.map((s) => (
              <Card key={s.id} pad={16}>
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-[1.125rem] font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                      <Pill tone="neutral" size="sm">{s.years} years</Pill>
                    </div>
                    <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                      {s.trade} · {s.note}
                    </p>
                  </div>
                  <Btn size="sm" variant="outline" icon="MessageCircle" onClick={() => ask(s.name)}>
                    Ask her
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {asked && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="mt-[1px] h-[16px] w-[16px] shrink-0" />
              {asked}
            </p>
          </Card>
        )}

        {/* The line that has to be on this screen. */}
        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Lock" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing on this page is ever sent to anyone at your home. Nobody is contacted, nobody
              is told you looked at it, and there is no record of it on the screen you hand over.
              You decide what to show and when — and if the answer is nothing, that is a complete
              answer.
            </p>
          </div>
        </Card>

        <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="ShieldAlert" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-danger-solid") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink") }}>
              If someone at home frightens you rather than doubts you, this is the wrong page.{" "}
              <a href="/app/safety" className="font-bold underline" style={{ color: v("--ux-ink") }}>
                Go here instead
              </a>
              . Persuading is for people who will listen.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

function Answer({ o }: { o: Objection }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
      <div className="px-5 pt-5">
        <p className="border-l-2 pl-4 text-[1.125rem] font-semibold italic leading-relaxed"
           style={{ borderColor: v("--ux-line-strong"), color: v("--ux-muted") }}>
          {o.said}
        </p>
      </div>
      <div className="px-5 py-5">
        <p className="text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink") }}>{o.answer}</p>
        {o.proof && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-[0.8125rem] font-bold"
                  style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              <I name={o.icon} className="h-[14px] w-[14px]" />
              {o.proof}
            </span>
            <Btn size="sm" variant="outline" icon="Smartphone" href="/app/vault/showing">
              Show it to them
            </Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

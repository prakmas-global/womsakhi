"use client";

import { useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, EmptyState, I, NoteBtn, Pill, SectionHead, v } from "@/components/ux/kit";
import { OBJECTIONS as RAW_OBJECTIONS, type Objection } from "@/components/ux/reach/data";
import { useMentors } from "@/components/ux/live";
import { apiRequestMentor } from "@/lib/growth-api";
import type { Mentor } from "@/components/ux/mentors/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneRow, PhoneTitle } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

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
/** Mentors whose experience fits "come and speak to my family" best go first. */
const FITS = /communication|getting started|confidence|family|business|tailoring|career/i;

/** "Ask her" — a real mentoring request (POST /growth/mentors/{id}/request). */
function AskHer({ m }: { m: Mentor }) {
  if (m.requested) return <Pill tone="green" size="sm">Asked</Pill>;
  return (
    <NoteBtn label="Ask her" icon="MessageCircle" variant="outline" size="sm"
             title={`Ask ${m.name.split(" ")[0]} to speak to your family`} to={m.name.split(" ")[0]}
             placeholder="Say what you would like her to do"
             phrases={["Could you come and speak to my family about my work?",
                       "Could you talk to them on a phone call?",
                       "They worry it is not safe", "They think it will not earn money",
                       "Weekends are best"]}
             send={async (n) => { await apiRequestMentor(m.id, n.text); }}
             sent={`Your request is with ${m.name.split(" ")[0]}`}
             sentBody="She replies with a time. Nobody at your home is contacted — you decide when she meets them."
             sentLink={{ href: "/app/mentors", label: "See your requests" }} />
  );
}

export default function BringingPage() {
  const OBJECTIONS = useTranslated(RAW_OBJECTIONS);
  const tr = useT();
  const [open, setOpen] = useState<string | null>("ob2");
  // Real women who chose to mentor — not a list of invented names.
  const { data: mentors, source: mentorSource } = useMentors();
  const SPEAKERS = useMemo(() => [...mentors.filter((m) => !m.is_mine)]
    .sort((a, b) => Number(FITS.test(b.expertise.join(" "))) - Number(FITS.test(a.expertise.join(" ")))
                  || b.experience_years - a.experience_years)
    .slice(0, 4), [mentors]);

  const answer = useMemo(() => OBJECTIONS.find((o) => o.id === open) ?? null, [open, OBJECTIONS]);

  return (
    <HomeShell active="/app/bringing">
      <div className="flex flex-col gap-5" id="bringing-page">

        <PhoneTitle title={tr("bringing.atHome")} sub={tr("bringing.whenSomeoneAtHomeIsNot")}
                    note={tr("bringing.forAboutHalfTheWomenDoing")}>
          <div className="mt-3"><ReadAloud targetId="bringing-page" /></div>
        </PhoneTitle>
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("bringing.atHome")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("bringing.whenSomeoneAtHomeIsNot")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            For about half the women doing this, the hardest part was never the work — it was
            somebody at home. This page does not tell you what to say to them. It gives you
            something to show them, and somebody who will come and speak to them if you want.
          </p>
          <div className="mt-3"><ReadAloud targetId="bringing-page" /></div>
        </header>

        {/* Their words, then something to show. */}
        <div>
          <GroupLabel sub={tr("bringing.pickTheOneYouActuallyHeard")}>{tr("bringing.whatDidTheySay")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("bringing.whatDidTheySay")} sub={tr("bringing.pickTheOneYouActuallyHeard")} icon="MessageCircle" />
          </div>
          {/* One of several, so on a phone: a grouped list with a checkmark. */}
          <ListGroup className="lg:hidden">
            {OBJECTIONS.map((o) => (
              <PhoneRow key={o.id} title={o.said} selected={open === o.id}
                        onClick={() => setOpen(open === o.id ? null : o.id)} />
            ))}
          </ListGroup>
          <div className="hidden flex-wrap gap-2 lg:flex">
            {OBJECTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setOpen(open === o.id ? null : o.id)}
                      aria-pressed={open === o.id}
                      className="ux-press ux-sq rounded-[12px] px-3.5 py-2.5 text-left text-xsm font-semibold"
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
          <GroupLabel sub={tr("bringing.someoneFromHereWhoHasDone")}>{tr("bringing.orAskAWomanToCome")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("bringing.orAskAWomanToCome")}
                         sub={tr("bringing.someoneFromHereWhoHasDone")} icon="UserRoundCheck" />
          </div>
          <ListGroup className="lg:hidden">
            {SPEAKERS.map((s) => (
              <PhoneRow key={s.id}
                        lead={
                          <span className="mt-0.5 grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full text-[15px] font-bold"
                                style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                            {s.name.charAt(0)}
                          </span>
                        }
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {s.name}
                            <Pill tone="neutral" size="sm">{s.experience_years} years</Pill>
                          </span>
                        }
                        meta={`${s.headline}${s.location ? ` · ${s.location}` : ""}`}
                        trailing={<AskHer m={s} />} />
            ))}
          </ListGroup>
          {mentorSource !== "loading" && SPEAKERS.length === 0 && (
            <Card>
              <EmptyState icon="UserRoundCheck" title="No mentors yet"
                          body="When women further along start mentoring, they appear here. You can still show them the answers above."
                          action={<Btn size="sm" variant="outline" href="/app/mentors">See mentors</Btn>} />
            </Card>
          )}
          <div className="hidden flex-col gap-2.5 lg:flex">
            {SPEAKERS.map((s) => (
              <Card key={s.id} pad={16}>
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-lg font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                      <Pill tone="neutral" size="sm">{s.experience_years} years</Pill>
                    </div>
                    <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                      {s.headline}{s.location ? ` · ${s.location}` : ""}
                    </p>
                  </div>
                  <AskHer m={s} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* The line that has to be on this screen. */}
        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Lock" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
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
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink") }}>
              If someone at home frightens you rather than doubts you, this is the wrong page.{" "}
              <a href="/app/safety" className="font-bold underline" style={{ color: v("--ux-ink") }}>{tr("bringing.goHereInstead")}</a>
              . Persuading is for people who will listen.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

function Answer({ o }: { o: Objection }) {
  const tr = useT();
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
      <div className="px-5 pt-5 max-lg:px-4 max-lg:pt-4">
        <p className="border-l-2 pl-4 text-lg font-semibold italic leading-relaxed"
           style={{ borderColor: v("--ux-line-strong"), color: v("--ux-muted") }}>
          {o.said}
        </p>
      </div>
      <div className="px-5 py-5 max-lg:p-4">
        <p className="text-sm leading-relaxed" style={{ color: v("--ux-ink") }}>{o.answer}</p>
        {o.proof && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-xsm font-bold max-lg:px-4"
                  style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              <I name={o.icon} className="h-[14px] w-[14px]" />
              {o.proof}
            </span>
            <Btn size="sm" variant="outline" icon="Smartphone" href="/app/vault/showing">{tr("bringing.showItToThem")}</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

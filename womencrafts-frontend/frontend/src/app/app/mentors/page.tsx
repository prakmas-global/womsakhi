"use client";

import { useMemo, useState } from "react";
import { COPY } from "@/components/ux/copy";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, Chip, EmptyState, NoteBtn, Rating, SectionHead, SourceNote,
  copy, plural
} from "@/components/ux/kit";
import { apiRequestMentor } from "@/lib/growth-api";
import { apiLeaveFeedback } from "@/lib/member-api";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ActionRow, ChipRow, ScreenHead, Segments, Tag } from "@/components/ux/learning/native";
import {
  EXPERTISE as RAW_EXPERTISE, LANGUAGES as RAW_LANGUAGES, MENTOR_ART as RAW_MENTOR_ART, rupees,
} from "@/components/ux/mentors/data";
import { useMentors } from "@/components/ux/live";
import { useMentorSessions } from "@/components/ux/growth";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Mentors — women who have done it, and will sit with you.
 *
 * Language is a first-class filter, not a detail in a profile. A mentor she
 * cannot comfortably talk to is not a mentor, and burying that below the fold
 * wastes both their time.
 */
export default function MentorsPage() {
  const LANGUAGES = useTranslated(RAW_LANGUAGES);
  const EXPERTISE = useTranslated(RAW_EXPERTISE);
  const MENTOR_ART = useTranslated(RAW_MENTOR_ART);
  const tr = useT();
  const { data: MENTORS, source, refetch } = useMentors();
  const { data: MY_SESSIONS } = useMentorSessions();
  const [tab, setTab] = useState("Find a mentor");
  const [skills, setSkills] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);

  const shown = useMemo(() => MENTORS.filter((m) => {
    if (skills.length && !m.expertise.some((e) => skills.includes(e))) return false;
    if (langs.length && !m.languages.some((l) => langs.includes(l))) return false;
    if (freeOnly && !m.free_first) return false;
    return true;
  }), [MENTORS, skills, langs, freeOnly]);

  const toggle = (v: string, list: string[], set: (n: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const upcoming = MY_SESSIONS.filter((s) => s.state === "Upcoming");
  const active = skills.length + langs.length + (freeOnly ? 1 : 0);

  return (
    <HomeShell
      active="/app/mentors"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("mentors.yourSessions")} action={tr("circles.seeAll")} onAction={() => setTab("My sessions")} />
            {MY_SESSIONS.length ? (
              <div className="ux-stagger space-y-2.5">
                {MY_SESSIONS.map((s) => (
                  <div key={s.id} className="ux-hov flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={s.photo} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
                         style={{ background: "var(--ux-brand-tint)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{s.mentor}</p>
                      <p className="mt-0.5 truncate text-2xs" style={{ color: "var(--ux-muted)" }}>{s.when}</p>
                    </div>
                    <Tag tone={s.state === "Upcoming" ? "brand" : s.state === "Requested" ? "blue" : "neutral"} size="sm">
                      {s.state}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("mentors.nothingBookedYet")}</p>
            )}
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("mentors.howASessionWorks")} icon="Info" />
            <ol className="space-y-3">
              {[
                "Ask for a session and say what you want help with.",
                "She replies with a time that suits you both.",
                "Talk for 45 minutes, by video or voice.",
                "You both write two lines about what to do next.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={MENTOR_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[104px] w-[104px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("mentors.becomeAMentor")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("mentors.youKnowMoreThanYouThink")}</p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/documents/service/new" variant="soft" size="sm" iconEnd="ArrowRight">{tr("mentors.offerToHelp")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <ScreenHead
        title="Mentors"
        sub={tab === "Find a mentor"
          ? `${shown.length} ${plural("woman", shown.length)} ready to help${active ? ` · ${active} ${plural("filter", active)} on` : ""}`
          : `${upcoming.length} ${plural("session", upcoming.length)} coming up`}
        note={<SourceNote source={source} what="mentors" />}
      >
        <Segments items={["Find a mentor", "My sessions"]} active={tab} onChange={setTab} label={tr("mentors.mentorsView")} />
      </ScreenHead>

      {tab === "Find a mentor" && (
        <>
          {/*
            Fifteen chips. Wrapped, they were 700px of filter above the first
            mentor — measured on the before shot at 390x844, where the whole
            screen was the filter and not one woman was visible. Each set now
            runs on one line the thumb pushes along; `pad={16}` matches the
            card's own padding, so the row bleeds exactly to its edge rather
            than past it. Above 1023 `.ux-chiprow` does not exist and both sets
            wrap as before.
          */}
          <Card className="mb-6 ux-onscroll-soft lg:mb-[16px]" pad={16}>
            <ChipRow label={tr("mentors.whatYouNeedHelpWith")} pad={16}>
              {EXPERTISE.map((e) => (
                <Chip key={e} selected={skills.includes(e)} onClick={() => toggle(e, skills, setSkills)}>{e}</Chip>
              ))}
            </ChipRow>

            <div className="mt-4">
              <ChipRow label={tr("mentors.aLanguageYouAreComfortableIn")} pad={16}>
                {LANGUAGES.map((l) => (
                  <Chip key={l} selected={langs.includes(l)} onClick={() => toggle(l, langs, setLangs)}>{l}</Chip>
                ))}
              </ChipRow>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 lg:pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
              <Chip selected={freeOnly} onClick={() => setFreeOnly(!freeOnly)} icon="Gift">{tr("mentors.firstSessionFree")}</Chip>
              {active > 0 && (
                <Btn variant="ghost" size="sm" icon="X"
                     onClick={() => { setSkills([]); setLangs([]); setFreeOnly(false); }}>
                  Clear
                </Btn>
              )}
            </div>
          </Card>

          {shown.length ? (
            <div className="ux-deck ux-stagger space-y-[12px]">
              {shown.map((m, i) => (
                <Card key={m.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                  <div className="flex items-start gap-4">
                    <span className="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[16px]"
                          style={{ background: `var(${m.tint})` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img loading="lazy" decoding="async" src={m.photo} alt="" className="ux-art h-full w-full object-cover" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h2 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                          <Link href={`/app/mentors/${m.id}`} className="-my-1 inline-block py-1 hover:underline">
                            {m.name}
                          </Link>
                        </h2>
                        {m.free_first && <Tag tone="green" size="sm">{tr("mentors.firstSessionFree2")}</Tag>}
                        {m.requested && <Tag tone="blue" size="sm">{tr("mentors.youAsked")}</Tag>}
                      </div>
                      <p className="mt-0.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>{m.headline}</p>

                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                         style={{ color: "var(--ux-muted)" }}>
                        <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {m.location}</span>
                        <span className="inline-flex items-center gap-1"><Icons.Briefcase className="h-3.5 w-3.5" /> {m.experience_years} years</span>
                        <span className="inline-flex items-center gap-1"><Icons.Languages className="h-3.5 w-3.5" /> {m.languages.join(", ")}</span>
                      </p>

                      <p className="mt-2"><Rating value={m.rating} count={`${m.sessions_done} sessions`} /></p>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.expertise.map((e) => (
                          <span key={e} className="ux-sq rounded-full border px-2.5 py-[3px] text-[13px] lg:rounded-[8px] lg:px-2 lg:text-2xs"
                                style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{e}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:mt-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
                      <Icons.Clock className="h-[14px] w-[14px]" /> {m.availability}
                      <span aria-hidden>·</span>
                      {m.free_first ? "Free first session" : `${rupees(m.fee_minor)} a session`}
                    </span>
                    {/* Full width and stacked on a phone: two 96px pills
                        floated to the right edge is where a right-handed
                        thumb cannot comfortably go. */}
                    <ActionRow className="[&>*]:w-full lg:[&>*]:w-auto">
                      <Btn href={`/app/mentors/${m.id}`} variant="outline" size="sm">{tr("mentors.readMore")}</Btn>
                      {/* Not offered twice. The server refuses a second open
                          request with a 409, and the pill above already says
                          she has asked — leaving the button there only led
                          her into a refusal she had done nothing to earn.
                          Her detail page has always hidden it; this list did
                          not.

                          Her words go to the mentor as the request's `goal` —
                          the field the server requires, and the one that lets
                          a mentor decide whether she is the right person to
                          say yes. Same call the mentor's own page makes. */}
                      {!m.requested && (
                      <NoteBtn label={tr("mentors.askForASession")} variant="primary"
                               title={`Ask ${m.name} for a session`} to={m.name}
                               placeholder={tr("mentors.sayWhatYouWantHelpWith")}
                               send={async (n) => { await apiRequestMentor(m.id, n.text); refetch(); }}
                               sent={`Your request is with ${m.name}`}
                               sentBody={tr("mentors.sheUsuallyRepliesWithinADay")}
                               sentLink={{ href: "/app/mentors", label: tr("mentors.seeYourSessions") }} />
                      )}
                    </ActionRow>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon="SearchX"
                title={tr("mentors.noMentorMatchesAllOfThat")}
                body={tr("mentors.loosenOneFilterLanguageIsUsually")}
                action={<Btn onClick={() => { setSkills([]); setFreeOnly(false); }} variant="soft">{tr("mentors.keepLanguageOnly")}</Btn>}
              />
            </Card>
          )}
        </>
      )}

      {tab === "My sessions" && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {MY_SESSIONS.map((s, i) => (
            <Card key={s.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              {/* The action drops to its own full-width line on a phone —
                  beside the words it squeezed the topic to a stub. */}
              <div className="flex flex-wrap items-center gap-3.5 lg:flex-nowrap">
                <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full"
                      style={{ background: "var(--ux-brand-tint)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={s.photo} alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {s.topic}
                    </h2>
                    <Tag tone={s.state === "Upcoming" ? "brand" : s.state === "Requested" ? "blue" : "neutral"} size="sm">
                      {s.state}
                    </Tag>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                    <span className="inline-flex items-center gap-1"><Icons.User className="h-3.5 w-3.5" /> {s.mentor}</span>
                    <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {s.when}</span>
                    <span className="inline-flex items-center gap-1"><Icons.Video className="h-3.5 w-3.5" /> {s.mode}</span>
                  </p>
                </div>
                <span className="flex w-full shrink-0 items-center gap-2 empty:hidden [&>*]:flex-1 lg:w-auto lg:empty:flex lg:[&>*]:flex-none">
                  {s.state === "Upcoming" && (
                    <ActionBtn variant="primary" size="sm" icon="Video" doneIcon="Copy" done={tr("mentors.linkCopied")}
                               act={() => copy(`https://meet.womsakhi.com/${s.id}`, COPY.linkCopied, "meet.womsakhi.com/" + s.id)}>
                      Join
                    </ActionBtn>
                  )}
                  {/* This said "We have told {her}" and told nobody: there is
                      no member endpoint for withdrawing a mentor request —
                      only staff can move one. So it no longer claims. It goes
                      where she can actually ask, which is her thread with the
                      team. */}
                  {s.state === "Requested" && (
                    <Btn href="/app/messages" variant="outline" size="sm" icon="MessageCircle">{tr("mentors.askUsToCancel")}</Btn>
                  )}
                  {/* `to` and the placeholder both used to say this reached
                      the mentor and was published for other women. It does
                      neither: /me/feedback lands in the team's feedback
                      module. The box now names who actually reads it. */}
                  {s.state === "Done" && (
                    <NoteBtn label={tr("mentors.leaveANote")} icon="Star" stars
                             title={`How was your session with ${s.mentor}?`} to="the WomSakhi team"
                             placeholder={tr("mentors.whatHelpedAndWhatYouStill")}
                             send={(n) => apiLeaveFeedback({
                               text: n.text, rating: n.rating,
                               type: "Mentoring Session", program: s.mentor,
                             })}
                             sent={COPY.noteReceived}
                             sentBody={tr("mentors.itGoesToThePeopleWho")}
                             sentLink={null} />
                  )}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}

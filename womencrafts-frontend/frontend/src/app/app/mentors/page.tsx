"use client";

import { useCallback, useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, Chip, EmptyState, NoteBtn, SectionHead, SourceNote,
  copy, plural
} from "@/components/ux/kit";
import { apiMentorSessionPaid, apiRequestMentor, apiWithdrawMentorRequest } from "@/lib/growth-api";
import { apiMyReviewedSessions, apiReviewSession } from "@/lib/mentor-reviews-api";
import { useResource } from "@/lib/use-resource";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ActionRow, ChipRow, ScreenHead, Segments, Tag } from "@/components/ux/learning/native";
import { MENTOR_ART as RAW_MENTOR_ART, rupees } from "@/components/ux/mentors/data";
import { useMentors } from "@/components/ux/live";
import { useMentorSessions } from "@/components/ux/growth";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { toast } from "@/components/ux/mobile/Toast";
import { SkillBadges } from "@/components/ux/SkillBadges";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/** An uploaded photo — not the generated initials image, not a stock avatar drawing. */
const isRealPhoto = (src?: string) => !!src && !src.startsWith("data:") && !src.includes("/ux/art/avatar-");

/**
 * Mentors — women who have done it, and will sit with you.
 *
 * Language is a first-class filter, not a detail in a profile. A mentor she
 * cannot comfortably talk to is not a mentor, and burying that below the fold
 * wastes both their time.
 */
/** Tap-to-add words for rating a session — most women will not type a review. */
const RATE_PHRASES = [
  "She explained clearly", "I know my next step", "Very patient", "Practical advice", "I will book again",
];

export default function MentorsPage() {
  const MENTOR_ART = useTranslated(RAW_MENTOR_ART);
  const tr = useT();
  const { data: MENTORS, source, refetch } = useMentors();
  const { data: MY_SESSIONS, refetch: refetchSessions } = useMentorSessions();
  const reviewed = useResource(
    useCallback((s: AbortSignal) => apiMyReviewedSessions(s).catch(() => ({} as Record<string, number>)), []), {} as Record<string, number>);

  /*
    The chips come from the mentors who are actually here — most common first.
    They were a fixed list (eight topics, seven languages), translated before
    being compared with the mentors' English words, so a topic no mentor
    offered led to an empty list, and in Hindi every chip did.
  */
  const EXPERTISE = useMemo(() => rank(MENTORS.flatMap((m) => m.expertise)).slice(0, 12), [MENTORS]);
  const LANGUAGES = useMemo(() => rank(MENTORS.flatMap((m) => m.languages)), [MENTORS]);
  const [withdrawing, setWithdrawing] = useState("");
  const [paying, setPaying] = useState("");
  const [tab, setTab] = useState("Find a mentor");
  const [skills, setSkills] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const shown = useMemo(() => MENTORS.filter((m) => {
    if (needle && ![
      m.name, m.headline, m.bio, m.location, ...m.expertise, ...m.languages,
      ...(m.verified_skills ?? []).map((v) => `${v.skill} ${v.title}`),
    ].join(" ").toLowerCase().includes(needle)) return false;
    if (skills.length && !m.expertise.some((e) => skills.includes(e))) return false;
    if (langs.length && !m.languages.some((l) => langs.includes(l))) return false;
    if (freeOnly && !m.free_first) return false;
    return true;
  }), [MENTORS, skills, langs, freeOnly, needle]);

  const toggle = (v: string, list: string[], set: (n: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const upcoming = MY_SESSIONS.filter((s) => s.state === "Upcoming");
  const active = skills.length + langs.length + (freeOnly ? 1 : 0) + (needle ? 1 : 0);
  const clearAll = () => { setSkills([]); setLangs([]); setFreeOnly(false); setQ(""); };

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
              <Btn href="/app/mentoring" variant="soft" size="sm" iconEnd="ArrowRight">Become a mentor</Btn>
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
            {/* Search first: a woman who already knows a name, a city or a
                trade ("mehendi", "Hyderabad") should not have to find it in
                fifteen chips. Matches what the card shows, plus her bio. */}
            <div className="relative mb-4">
              <Icons.Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--ux-faint)" }} />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
                placeholder="Search name, skill or city"
                aria-label="Search mentors"
                className="ux-sq min-h-[46px] w-full rounded-[12px] border ps-10 pe-10 text-xsm outline-none [&::-webkit-search-cancel-button]:hidden"
                style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear search"
                        className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full"
                        style={{ color: "var(--ux-muted)" }}>
                  <Icons.X className="h-4 w-4" />
                </button>
              )}
            </div>

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
                     onClick={clearAll}>
                  Clear
                </Btn>
              )}
            </div>
          </Card>

          {shown.length ? (
            <MediaGrid>
              {shown.map((m) => {
                const real = isRealPhoto(m.photo);
                return (
                  <MediaCard
                    key={m.id}
                    href={`/app/mentors/${m.id}`}
                    image={artFor([...m.expertise, m.headline], "mentor", real ? m.photo : null, m.id)}
                    alt={real ? m.name : ""}
                    topLeft={m.is_mine ? { text: "You", tone: "brand" } : m.requested ? { text: tr("mentors.youAsked"), tone: "light" } : (m.rating_count ?? 0) > 0 ? { text: `★ ${m.rating.toFixed(1)}`, tone: "light" } : { text: "New mentor", tone: "light" }}
                    topRight={m.free_first ? { text: "Free", tone: "green" } : { text: `${rupees(m.fee_minor)} / session`, tone: "dark" }}
                    overlay={<><Icons.Video className="h-[13px] w-[13px]" /> {m.session_mode ?? "Video call"} · {m.sessions_done} sessions</>}
                    title={m.name}
                    avatar={{ src: m.photo, name: m.name }}
                    subtitle={m.headline}
                    meta={<>
                      {m.location && <Fact icon="MapPin">{m.location}</Fact>}
                      <Fact icon="Briefcase">{m.experience_years} years</Fact>
                      <Fact icon="Languages">{m.languages.join(", ")}</Fact>
                      {m.availability && <Fact icon="Clock">{m.availability}</Fact>}
                    </>}
                    footer={
                      <ActionRow className="[&>*]:flex-1">
                        <Btn href={`/app/mentors/${m.id}`} variant="outline" size="sm">{tr("mentors.readMore")}</Btn>
                        {m.is_mine && <Btn href="/app/mentoring" variant="soft" size="sm" iconEnd="ArrowRight">My mentoring</Btn>}
                        {/* Not offered twice: the server refuses a second open request, and the
                            badge on the picture already says she asked. Her words go to the mentor
                            as the request's `goal`. */}
                        {!m.requested && !m.is_mine && (
                          <NoteBtn label={tr("mentors.askForASession")} variant="primary"
                                   title={`Ask ${m.name} for a session`} to={m.name}
                                   placeholder={tr("mentors.sayWhatYouWantHelpWith")}
                                   phrases={[...m.expertise.slice(0, 4).map((e) => `I want help with ${e.toLowerCase()}`),
                                             "I am just starting out", "I want more customers"]}
                                   send={async (n) => { await apiRequestMentor(m.id, n.text); refetch(); }}
                                   sent={`Your request is with ${m.name}`}
                                   sentBody={tr("mentors.sheUsuallyRepliesWithinADay")}
                                   sentLink={{ href: "/app/mentors", label: tr("mentors.seeYourSessions") }} />
                        )}
                      </ActionRow>
                    }
                  >
                    {!!m.verified_skills?.length && <div className="mb-2"><SkillBadges skills={m.verified_skills} size="sm" /></div>}
                    <div className="flex flex-wrap gap-1.5">
                      {m.expertise.slice(0, 4).map((e) => (
                        <span key={e} className="rounded-full px-2.5 py-[3px] text-2xs font-semibold"
                              style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{e}</span>
                      ))}
                    </div>
                  </MediaCard>
                );
              })}
            </MediaGrid>
          ) : (
            <Card>
              {needle ? (
                <EmptyState
                  icon="SearchX"
                  title={`No mentor matches “${q.trim()}”`}
                  body="Try a shorter word — a skill like “tailoring”, a city, or a language."
                  action={<Btn onClick={clearAll} variant="soft">Show every mentor</Btn>}
                />
              ) : (
                <EmptyState
                  icon="SearchX"
                  title={tr("mentors.noMentorMatchesAllOfThat")}
                  body={tr("mentors.loosenOneFilterLanguageIsUsually")}
                  action={<Btn onClick={() => { setSkills([]); setFreeOnly(false); }} variant="soft">{tr("mentors.keepLanguageOnly")}</Btn>}
                />
              )}
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
                <span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[14px]"
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
                  {s.state === "Upcoming" && s.paymentStatus === "awaiting" && (
                    <>
                      <ActionBtn variant="outline" size="sm" icon="Copy" doneIcon="Check" done="UPI ID copied"
                                 act={() => copy(s.upiId ?? "", "UPI ID copied", s.upiId ?? "")}>
                        Pay {rupees(s.priceMinor ?? 0)} to {s.upiId}
                      </ActionBtn>
                      <Btn variant="primary" size="sm" icon="CheckCircle2" loading={paying === s.id}
                           onClick={async () => {
                             setPaying(s.id);
                             try { await apiMentorSessionPaid(s.id); refetchSessions(); toast("We told her you paid", { tone: "success" }); }
                             catch { toast("That did not reach her. Try again.", { tone: "error" }); }
                             finally { setPaying(""); }
                           }}>I&apos;ve paid</Btn>
                    </>
                  )}
                  {s.state === "Upcoming" && s.paymentStatus === "claimed" && (
                    <Tag tone="orange" size="sm">Waiting for her to confirm your payment</Tag>
                  )}
                  {s.state === "Upcoming" && s.meeting && (/^https?:\/\//i.test(s.meeting)
                    ? <Btn href={s.meeting} variant="primary" size="sm" icon="Video">Join</Btn>
                    : <ActionBtn variant="primary" size="sm" icon="Copy" doneIcon="Check" done="Copied"
                                 act={() => copy(s.meeting ?? "", "Copied", s.meeting ?? "")}>{s.meeting}</ActionBtn>)}
                  {s.state === "Upcoming" && !s.meeting && !s.paymentStatus && (
                    <span className="text-xs" style={{ color: "var(--ux-muted)" }}>The team will send you how to join.</span>
                  )}
                  {s.state === "Requested" && (
                    <Btn variant="outline" size="sm" icon="X" loading={withdrawing === s.id}
                         onClick={async () => {
                           setWithdrawing(s.id);
                           try {
                             await apiWithdrawMentorRequest(s.id); refetchSessions();
                             toast("Mentor request withdrawn", { tone: "success" });
                           } catch { toast("Could not withdraw that request.", { tone: "error" }); }
                           finally { setWithdrawing(""); }
                         }}>Withdraw request</Btn>
                  )}
                  {/* A rating that goes on her page, counted with everyone
                      else's — what other women read before they ask her. */}
                  {s.status === "closed" && (reviewed.data[s.id] ? (
                    <Tag tone="green" size="sm">You rated it {"★".repeat(reviewed.data[s.id])}</Tag>
                  ) : (
                    <NoteBtn label="Rate this session" icon="Star" stars
                             title={`How was your session with ${s.mentor}?`} to={s.mentor}
                             placeholder="What helped? Tap below or write a line."
                             phrases={RATE_PHRASES}
                             send={async (n) => { await apiReviewSession(s.id, n.rating ?? 0, n.text); reviewed.refetch(); refetch(); }}
                             sent="Thank you — your rating is on her page"
                             sentBody="Other women read it before they ask her for a session."
                             sentLink={{ href: `/app/mentors/${s.mentorId}`, label: "See her page" }} />
                  ))}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}

/** Distinct values, most frequent first. */
function rank(values: string[]): string[] {
  const n = new Map<string, number>();
  for (const v of values) if (v?.trim()) n.set(v.trim(), (n.get(v.trim()) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

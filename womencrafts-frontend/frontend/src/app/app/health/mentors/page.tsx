"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Btn, Sheet } from "@/components/ux/kit";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";
import { MessageHer } from "@/components/ux/MessageHer";
import { toast } from "@/components/ux/mobile/Toast";
import {
  Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel,
} from "@/components/ux/health/kit";
import {
  TOPICS, fitsTime, inTopic, scoreMentors, topicFrom, type BestTime, type MatchQuiz,
} from "@/components/ux/health/mentor-topics";
import { apiErrorMessage } from "@/lib/api";
import { apiMentors, type ApiMentor } from "@/lib/me-api";
import {
  apiMyMentorRequests, apiRequestMentor, apiWithdrawMentorRequest, type MentorRequest,
} from "@/lib/growth-api";
import { apiMentorReviews, apiMyReviewedSessions, apiReviewSession, type MentorReviewPage } from "@/lib/mentor-reviews-api";
import { useResource } from "@/lib/use-resource";
import { WatchListen } from "@/components/ux/health/WatchListen";
import { FormLauncher, PicChoice, Review, StepSheet, useFlow, type FlowStep } from "@/components/ux/health/StepFlow";

/**
 * Mentor Connect — guidance from women who have been there.
 *
 * Every mentor here is a row in our `mentors` collection (GET /growth/mentors):
 * staff-added mentors and members who mentor. Nothing on this screen is a
 * sample. Asking for time is the existing request flow (POST
 * /growth/mentors/{id}/request); her sessions are her real requests, rated
 * through /growth/mentors/requests/{id}/review once they are done.
 *
 * Mentors guide; they do not diagnose. Health questions that need a doctor go
 * to Doctor Consultation, and the screen says so.
 */

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "discover", label: "Discover" },
  { id: "match", label: "Find my match" },
  { id: "sessions", label: "My sessions" },
  { id: "watch", label: "Watch & listen" },
];

const GOALS = [
  "I want advice on my health",
  "I want to start earning from home",
  "I need help with money and savings",
  "I want to grow my business",
  "I need someone to talk to",
];
/** The goal lines as picture tiles: a short name, and the line it starts her request with. */
const GOAL_TILES = [
  { value: GOALS[0], label: "My health", art: "Wellness Coaching" },
  { value: GOALS[1], label: "Earning from home", art: "Career Development" },
  { value: GOALS[2], label: "Money and savings", art: "Finance Education" },
  { value: GOALS[3], label: "Growing my business", art: "Business" },
  { value: GOALS[4], label: "Someone to talk to", art: "Chat" },
  { value: "other", label: "Something else", art: "Sparkles" },
];
const WHEN = ["Weekday mornings", "Weekday evenings", "Weekends", "Any time"];

/** Pictures for the match questions. */
const TOPIC_ART: Record<string, string> = {
  "Women's health": "Heart", Pregnancy: "Pregnancy", Fertility: "Fertility", Nutrition: "Nutrition",
  "Mental wellness": "Mental health professional", Fitness: "Fitness Coaching", Career: "Career Development",
  Money: "Finance Education", Business: "Business", "Crafts & skills": "Bag", "Rights & family": "Parenting",
};
/** How a mentor meets: the values mentors pick on their own profile. */
const FORMATS = [
  { value: "", label: "Any way", art: "Mentor session" },
  { value: "Video call", label: "Video call", art: "Video" },
  { value: "Phone call", label: "Phone call", art: "Audio" },
  { value: "In person", label: "In person", art: "In person" },
];
const BEST_TIMES = ["Any", "Mornings", "Evenings", "Weekends"];

const STATUS: Record<string, { label: string; tone: string; ink: string }> = {
  pending: { label: "Waiting for her", tone: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)" },
  accepted: { label: "Accepted", tone: "var(--ux-tint-green)", ink: "var(--ux-green-ink)" },
  closed: { label: "Done", tone: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)" },
  declined: { label: "Not this time", tone: "var(--ux-surface-2)", ink: "var(--ux-muted)" },
  withdrawn: { label: "Withdrawn", tone: "var(--ux-surface-2)", ink: "var(--ux-muted)" },
};

const rupees = (minor = 0) => (minor > 0 ? `₹${Math.round(minor / 100).toLocaleString("en-IN")}` : "Free");

export default function MentorConnect() {
  const mentors = useResource(useCallback((s: AbortSignal) => apiMentors(s), []), [] as ApiMentor[]);
  const requests = useResource(useCallback((s: AbortSignal) => apiMyMentorRequests(s), []), [] as MentorRequest[]);
  const [asking, setAsking] = useState<ApiMentor | null>(null);
  const [viewing, setViewing] = useState<ApiMentor | null>(null);

  const refresh = () => { mentors.refetch(); requests.refetch(); };
  const ctx: Ctx = {
    mentors: mentors.data, loading: mentors.source === "loading", requests: requests.data,
    ask: setAsking, view: setViewing, refresh,
  };

  return (
    <HealthFrame active="/app/health/mentors" hue="orange" icon="Users" eyebrow="Mentor Connect"
                 title="Mentor Connect" art="/ux/health/ill/mentor.webp"
                 sub="Guidance from women who've been there: health, career, money, family and growth."
                 tabs={TABS}
                 actions={<>
                   <Btn href="/app/health/mentors?tab=match" icon="Sparkles">Find my match</Btn>
                   <Btn href="/app/health/mentors?tab=sessions" variant="outline">My sessions</Btn>
                 </>}>
      {(tab) => (
        <>
          {tab === "dashboard" && <Dashboard {...ctx} />}
          {tab === "discover" && <Discover {...ctx} />}
          {tab === "match" && <Match {...ctx} />}
          {tab === "sessions" && <Sessions {...ctx} />}
          {tab === "watch" && <WatchListen section="mentor" hue="orange" sub="Women who have been there, on work, money and family." />}
          <AskSheet mentor={asking} onClose={() => setAsking(null)} onSent={refresh} />
          <ProfileSheet mentor={viewing} onClose={() => setViewing(null)} onAsk={(m) => { setViewing(null); setAsking(m); }} />
        </>
      )}
    </HealthFrame>
  );
}

interface Ctx {
  mentors: ApiMentor[];
  loading: boolean;
  requests: MentorRequest[];
  ask: (m: ApiMentor) => void;
  view: (m: ApiMentor) => void;
  refresh: () => void;
}

/* ── cards ───────────────────────────────────────────────────────────── */

function MentorCard({ m, ask, view, why }: { m: ApiMentor; ask: (m: ApiMentor) => void; view: (m: ApiMentor) => void; why?: string[] }) {
  return (
    <MediaCard ratio="4/3" onClick={() => view(m)} highlight={!!why}
      image={artFor([m.expertise.join(" "), m.headline, m.focus], "health", m.photo, m.id)} alt={m.name}
      topLeft={m.expertise[0] ? { text: m.expertise[0] } : null}
      topRight={m.requested ? { text: "Asked", tone: "green" } : m.rating_count ? { text: `★ ${m.rating.toFixed(1)}`, tone: "dark" } : null}
      title={m.name}
      subtitle={m.headline}
      avatar={m.photo ? null : { name: m.name }}
      meta={<>
        {m.experience_years > 0 && <Fact icon="Briefcase">{m.experience_years} yrs</Fact>}
        {m.languages.length > 0 && <Fact icon="Languages">{m.languages.slice(0, 2).join(", ")}</Fact>}
        <Fact icon="IndianRupee">{rupees(m.price_minor)}</Fact>
      </>}
      footer={m.is_mine ? (
        <span className="flex min-h-[40px] items-center justify-center rounded-[10px] text-[13px] font-bold"
              style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>Your mentor profile</span>
      ) : m.requested ? (
        <span className="flex min-h-[40px] items-center justify-center rounded-[10px] text-[13px] font-bold"
              style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Asked — see My sessions</span>
      ) : (
        <Btn full size="sm" icon="MessageCircle" onClick={() => ask(m)}>Ask {m.name.split(" ")[0]}</Btn>
      )}>
      {why ? (
        <ul className="space-y-1">
          {why.slice(0, 3).map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--ux-green-ink)" }}>
              <I name="CheckCircle2" className="mt-px h-3.5 w-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      ) : (m.focus || m.bio) ? (
        <p className="line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{m.focus || m.bio}</p>
      ) : null}
    </MediaCard>
  );
}

function Skeletons() {
  return (
    <MediaGrid>
      {[0, 1, 2].map((i) => <div key={i} className="h-[320px] animate-pulse rounded-[16px]" style={{ background: "var(--ux-surface-2)" }} />)}
    </MediaGrid>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────── */

function Dashboard({ mentors, loading, requests, ask, view }: Ctx) {
  const live = requests.filter((r) => r.status === "pending" || r.status === "accepted");
  const next = [...live].sort((a, b) => (a.scheduled_for || "~").localeCompare(b.scheduled_for || "~"))[0];
  const done = requests.filter((r) => r.status === "closed").length;
  const top = [...mentors].filter((m) => !m.is_mine).sort((a, b) => b.rating * b.rating_count - a.rating * a.rating_count || b.sessions_done - a.sessions_done).slice(0, 3);
  const counts = TOPICS.map((t) => ({ ...t, n: mentors.filter((m) => inTopic(m, t.label)).length })).filter((t) => t.n > 0);

  return (
    <Cols
      main={<>
        <MetricGrid>
          <Metric hue="orange" icon="Users" label="Mentors to choose from" value={loading ? "…" : mentors.length} href="/app/health/mentors?tab=discover" />
          <Metric hue="amber" icon="Hourglass" label="Waiting or booked" value={live.length} href="/app/health/mentors?tab=sessions" />
          <Metric hue="green" icon="CheckCircle2" label="Sessions done" value={done} href="/app/health/mentors?tab=sessions" />
        </MetricGrid>

        <Panel title="Browse by topic" sub="Every mentor below is a real person on WomSakhi.">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {counts.map((t, i) => {
              const hue = HUE[(["orange", "pink", "violet", "green", "blue", "amber"] as const)[i % 6]];
              return (
                <a key={t.label} href={`/app/health/mentors?tab=discover&topic=${encodeURIComponent(t.label)}`}
                   className="ux-card ux-hov ux-press flex flex-col items-start gap-2 p-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: hue.tint, color: hue.ink }}>
                    <I name={t.icon} />
                  </span>
                  <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{t.label}</b>
                  <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{t.n} {t.n === 1 ? "mentor" : "mentors"}</span>
                </a>
              );
            })}
          </div>
        </Panel>

        <Panel title="Women others found helpful" action={<Btn size="sm" variant="ghost" href="/app/health/mentors?tab=discover" iconEnd="ArrowRight">See all</Btn>}>
          {loading ? <Skeletons /> : top.length ? (
            <MediaGrid>{top.map((m) => <MentorCard key={m.id} m={m} ask={ask} view={view} />)}</MediaGrid>
          ) : <Empty icon="Users" title="No mentors yet" body="Our team is adding mentors. Check back soon." />}
        </Panel>
      </>}
      side={<>
        <Panel title="Next session">
          {next ? <SessionLine r={next} /> : (
            <Empty icon="CalendarClock" title="No sessions booked" body="Answer a few quick questions and we will suggest the mentors who fit you."
                   action={<Btn size="sm" href="/app/health/mentors?tab=match" icon="Sparkles">Find my match</Btn>} />
          )}
        </Panel>
        <Disclaimer>
          Mentors offer guidance and their own experience. They aren&apos;t doctors or licensed counsellors. For medical care, use{" "}
          <a href="/app/health/doctors" className="font-bold underline" style={{ color: "var(--ux-amber-ink)" }}>Doctor Consultation</a>.
          In an emergency, call 108.
        </Disclaimer>
      </>}
    />
  );
}

/* ── Discover ────────────────────────────────────────────────────────── */

function Discover({ mentors, loading, ask, view }: Ctx) {
  const params = useSearchParams();
  const [topic, setTopic] = useState(() => topicFrom(params.get("topic")));
  const [language, setLanguage] = useState("");
  const [time, setTime] = useState<BestTime | "">("");
  const [q, setQ] = useState("");
  const languages = useMemo(() => [...new Set(mentors.flatMap((m) => m.languages))].sort(), [mentors]);
  const topics = TOPICS.filter((t) => mentors.some((m) => inTopic(m, t.label)));

  const shown = mentors.filter((m) =>
    (!topic || inTopic(m, topic)) && (!language || m.languages.includes(language)) && fitsTime(m, time) &&
    (!q.trim() || [m.name, m.headline, m.focus, m.bio, ...m.expertise].join(" ").toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <Panel title="Find a mentor" sub={loading ? "Loading mentors…" : `${shown.length} of ${mentors.length} mentors`}>
      <label className="flex min-h-[46px] items-center gap-2 rounded-[12px] border px-3.5" style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
        <I name="Search" className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or what you need help with"
               aria-label="Search mentors" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--ux-ink)" }} />
      </label>
      <Chips label="Topic" hue="orange" options={["All", ...topics.map((t) => t.label)]} value={topic || "All"}
             onChange={(v) => setTopic(v === "All" ? "" : v)} />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Language</p>
          <Chips label="Language" hue="orange" options={["Any", ...languages.slice(0, 8)]} value={language || "Any"} onChange={(v) => setLanguage(v === "Any" ? "" : v)} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Best time</p>
          <Chips label="Best time" hue="orange" options={["Any", "Mornings", "Evenings", "Weekends"]} value={time || "Any"}
                 onChange={(v) => setTime(v === "Any" ? "" : (v as BestTime))} />
        </div>
      </div>
      {loading ? <Skeletons /> : shown.length ? (
        <MediaGrid>{shown.map((m) => <MentorCard key={m.id} m={m} ask={ask} view={view} />)}</MediaGrid>
      ) : (
        <Empty icon="SearchX" title="No mentors match" body="Try fewer filters, or another topic."
               action={<Btn size="sm" variant="outline" onClick={() => { setTopic(""); setLanguage(""); setTime(""); setQ(""); }}>Clear filters</Btn>} />
      )}
    </Panel>
  );
}

/* ── Find my match ───────────────────────────────────────────────────── */

function Match({ mentors, loading, ask, view }: Ctx) {
  const [quiz, setQuiz] = useState<MatchQuiz>({ topics: [], language: "", time: "", freeOnly: false });
  // How she would like to meet: a gentle preference. Mentors who meet that way come first.
  const [format, setFormat] = useState("");
  const [shown, setShown] = useState(false);
  const flow = useFlow();
  const languages = useMemo(() => [...new Set(mentors.flatMap((m) => m.languages))].sort(), [mentors]);
  const results = useMemo(() => {
    const scored = scoreMentors(mentors, quiz);
    if (!format) return scored.slice(0, 6);
    const fits = (m: ApiMentor) => (m.session_mode || "Video call") === format;
    return [...scored.filter((x) => fits(x.m)).map((x) => ({ ...x, why: [...x.why.slice(0, 1), `Meets by ${format.toLowerCase()}`, ...x.why.slice(1)] })),
            ...scored.filter((x) => !fits(x.m))].slice(0, 6);
  }, [mentors, quiz, format]);
  const toggle = (t: string) => setQuiz((q) => ({ ...q, topics: q.topics.includes(t) ? q.topics.filter((x) => x !== t) : [...q.topics, t] }));

  // On a phone the launcher comes first and the results follow; on a wide
  // screen the results sit left and the launcher stays beside them.
  const find = () => {
    if (!quiz.topics.length) return;
    flow.close();
    setShown(true);
    window.setTimeout(() => document.getElementById("match-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const steps: FlowStep[] = [
    { id: "help", title: "What would you like help with?", hint: "Tap one or more.", valid: quiz.topics.length > 0,
      body: <PicChoice label="Topics" hue="orange" multi value={quiz.topics} onChange={toggle}
                       options={TOPICS.map((t) => ({ value: t.label, label: t.label, art: TOPIC_ART[t.label] ?? "Mentor" }))} /> },
    { id: "lang", title: "Which language are you most comfortable in?",
      body: <Chips label="Language" hue="orange" options={["Any", ...languages.slice(0, 8)]} value={quiz.language || "Any"}
                   onChange={(v) => setQuiz((q) => ({ ...q, language: v === "Any" ? "" : v }))} /> },
    { id: "format", title: "How would you like to meet?",
      body: <PicChoice label="How you meet" hue="orange" columns={4} options={FORMATS} value={format} onChange={setFormat} onPicked={() => flow.setStep(3)} /> },
    { id: "time", title: "When suits you best?",
      body: <Chips label="Best time" hue="orange" options={BEST_TIMES} value={quiz.time || "Any"}
                   onChange={(v) => setQuiz((q) => ({ ...q, time: v === "Any" ? "" : (v as BestTime) }))} /> },
    { id: "find", title: "Ready to find your matches", hint: "Choose free sessions only if you like, then press Find matches.", valid: quiz.topics.length > 0,
      body: <>
        <Chips label="Budget" hue="orange" options={["Free or paid", "Free only"]} value={quiz.freeOnly ? "Free only" : "Free or paid"}
               onChange={(v) => setQuiz((q) => ({ ...q, freeOnly: v === "Free only" }))} />
        <Review rows={[["Help with", quiz.topics.join(", ")], ["Language", quiz.language || "Any"], ["Meet by", format || "Any way"],
                       ["Best time", quiz.time || "Any"], ["Sessions", quiz.freeOnly ? "Free only" : "Free or paid"]]} />
      </> },
  ];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 min-w-0 xl:order-1" id="match-results" style={{ scrollMarginTop: "calc(var(--ux-topbar-h, 72px) + 12px)" }}>
        <Panel title="Your matches" sub={shown ? `${results.length} ${results.length === 1 ? "mentor fits" : "mentors fit"} your answers` : "Answer the questions, then press Find matches."}>
          {!shown ? (
            <Empty icon="Sparkles" title="Tell us what you need" body="Pick at least one topic. We look through every mentor on WomSakhi and show who fits best, and why."
                   action={<Btn size="sm" icon="Play" onClick={flow.start}>Start</Btn>} />
          ) : loading ? <Skeletons /> : results.length ? (
            <MediaGrid cols={2}>{results.map(({ m, why }) => <MentorCard key={m.id} m={m} ask={ask} view={view} why={why} />)}</MediaGrid>
          ) : (
            <Empty icon="SearchX" title="No close match yet" body="Try another language or time, or pick more topics."
                   action={<Btn size="sm" variant="outline" href="/app/health/mentors?tab=discover">Browse all mentors</Btn>} />
          )}
        </Panel>
      </div>
      <div className="order-1 min-w-0 xl:order-2">
        <FormLauncher art="Mentor" hue="orange" steps={steps.length} onStart={flow.start}
                      title={shown ? "Change my answers" : "Find my match"} cta={shown ? "Change" : "Start"}
                      sub={shown ? `${quiz.topics.join(", ")}${quiz.language ? ` · ${quiz.language}` : ""}` : `${steps.length} quick questions · mostly taps`} />
      </div>
      <StepSheet open={flow.open} onClose={flow.close} icon="Sparkles" title="Find my match" hue="orange"
                 steps={steps} step={flow.step} setStep={flow.setStep} onSubmit={find} submitLabel="Find matches" />
    </div>
  );
}

/* ── My sessions ─────────────────────────────────────────────────────── */

function SessionLine({ r }: { r: MentorRequest }) {
  const st = STATUS[r.status] ?? STATUS.pending;
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold"
            style={{ background: HUE.orange.tint, color: HUE.orange.ink }}>
        {r.mentor_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[15px]" style={{ color: "var(--ux-ink)" }}>{r.mentor_name}</b>
        <p className="line-clamp-2 text-xs" style={{ color: "var(--ux-muted)" }}>{r.goal}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: st.tone, color: st.ink }}>{st.label}</span>
          <span style={{ color: "var(--ux-muted)" }}>{r.scheduled_for ? `On ${r.scheduled_for}` : r.preferred_time ? `You asked for ${r.preferred_time.toLowerCase()}` : `Asked ${r.when}`}</span>
        </div>
      </div>
    </div>
  );
}

function Sessions({ requests, mentors, refresh }: Ctx) {
  const reviewed = useResource(useCallback((s: AbortSignal) => apiMyReviewedSessions(s), []), {} as Record<string, number>);
  const byId = useMemo(() => new Map(mentors.map((m) => [m.id, m])), [mentors]);
  const groups: [string, MentorRequest[]][] = [
    ["Upcoming and waiting", requests.filter((r) => r.status === "pending" || r.status === "accepted")],
    ["Done", requests.filter((r) => r.status === "closed")],
    ["Closed", requests.filter((r) => r.status === "declined" || r.status === "withdrawn")],
  ];

  const withdraw = async (r: MentorRequest) => {
    try { await apiWithdrawMentorRequest(r.id); toast("Request withdrawn", { tone: "success" }); refresh(); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };
  const rate = async (r: MentorRequest, stars: number) => {
    try { await apiReviewSession(r.id, stars); toast("Thank you — your rating helps other women", { tone: "success" }); reviewed.refetch(); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };

  if (!requests.length) {
    return (
      <Panel title="Your sessions">
        <Empty icon="CalendarClock" title="No sessions yet" body="Find a mentor who fits your goals and ask her for time. Her reply shows up here."
               action={<Btn size="sm" href="/app/health/mentors?tab=match" icon="Sparkles">Find my match</Btn>} />
      </Panel>
    );
  }

  return (
    <Panel title="Your sessions" sub="Requests you sent, and how each one stands.">
      {groups.filter(([, rs]) => rs.length).map(([label, rs]) => (
        <div key={label}>
          <p className="mb-2 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>{label} · {rs.length}</p>
          <ul className="flex flex-col gap-3">
            {rs.map((r) => {
              const m = byId.get(r.mentor_id);
              const stars = reviewed.data[r.id];
              return (
                <li key={r.id} className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--ux-line)" }} data-session={r.status}>
                  <SessionLine r={r} />
                  {r.meeting && (
                    <p className="mt-2.5 flex items-start gap-2 rounded-[10px] p-2.5 text-xs font-semibold"
                       style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                      <I name="Video" className="h-4 w-4 shrink-0" /> How to meet: {r.meeting}
                    </p>
                  )}
                  {r.mentor_note && <p className="mt-2 text-xs" style={{ color: "var(--ux-ink-2)" }}>&ldquo;{r.mentor_note}&rdquo;</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.status === "pending" && <Btn size="sm" variant="outline" onClick={() => withdraw(r)}>Withdraw</Btn>}
                    {m?.owner_id && (r.status === "accepted" || r.status === "closed") && (
                      <MessageHer userId={m.owner_id} name={m.name} about={`Mentoring: ${r.goal.slice(0, 60)}`} label="Message her"
                                  phrases={["Thank you for your time", "Can we fix a time?", "I have one more question"]} />
                    )}
                    {r.status === "closed" && (stars ? (
                      <span className="text-xs font-bold" style={{ color: "var(--ux-amber-ink)" }}>You rated {"★".repeat(stars)}</span>
                    ) : (
                      <span className="flex items-center gap-1" role="group" aria-label="Rate this session">
                        <span className="me-1 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Rate:</span>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => rate(r, n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                                  className="ux-press grid h-9 w-9 place-items-center rounded-full text-lg" style={{ color: "var(--ux-amber-ink)" }}>★</button>
                        ))}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Panel>
  );
}

/* ── sheets ──────────────────────────────────────────────────────────── */

function AskSheet({ mentor, onClose, onSent }: { mentor: ApiMentor | null; onClose: () => void; onSent: () => void }) {
  // A fresh flow for each mentor she asks.
  return mentor ? <AskFlow key={mentor.id} mentor={mentor} onClose={onClose} onSent={onSent} /> : null;
}

function AskFlow({ mentor, onClose, onSent }: { mentor: ApiMentor; onClose: () => void; onSent: () => void }) {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [when, setWhen] = useState("Any time");
  const [busy, setBusy] = useState(false);
  const first = mentor.name.split(" ")[0];
  const short = goal.trim().length > 0 && goal.trim().length < 5;
  const pickTopic = (v: string) => {
    setTopic(v);
    // Start her request with the line she tapped, unless she has written her own.
    if (!goal.trim() || GOALS.includes(goal)) setGoal(v === "other" ? "" : v);
  };
  const send = async () => {
    if (goal.trim().length < 5) return;
    setBusy(true);
    try {
      await apiRequestMentor(mentor.id, goal.trim(), when === "Any time" ? "" : when);
      toast(`Sent to ${first} — her reply will show in My sessions`, { tone: "success" });
      setGoal(""); onSent(); onClose();
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally { setBusy(false); }
  };
  const steps: FlowStep[] = [
    { id: "topic", title: `What would you like to talk to ${first} about?`, hint: "Tap the closest one.", valid: !!topic,
      body: <PicChoice label="Topic" hue="orange" options={GOAL_TILES} value={topic} onChange={pickTopic} onPicked={() => setStep(1)} /> },
    { id: "goal", title: "Say it in your words", hint: "We started it for you. Change any word.", valid: goal.trim().length >= 5,
      body: <>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value.slice(0, 400))} rows={4} aria-label="What you want to talk about"
                  aria-invalid={short || undefined} placeholder="For example: I make pickles and want to sell to shops."
                  className="w-full resize-none rounded-[12px] border-[1.5px] p-3 text-sm"
                  style={{ borderColor: short ? "var(--ux-danger-ink)" : "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        <p className="text-xs font-semibold" style={{ color: short ? "var(--ux-danger-ink)" : "var(--ux-muted)" }} aria-live="polite">
          {short ? "Write a little more, so she knows how to help." : `${goal.length} / 400`}
        </p>
      </> },
    { id: "when", title: "When suits you?",
      body: <Chips label="When suits you" hue="orange" options={WHEN} value={when} onChange={setWhen} /> },
    { id: "check", title: "Check, then send", valid: goal.trim().length >= 5,
      body: <>
        <Review rows={[["To", mentor.name], ["About", goal.trim()], ["When", when]]} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          {mentor.owner_kind === "member"
            ? `${first} replies herself with a time. ${mentor.price_minor ? `Her session costs ${rupees(mentor.price_minor)}, paid to her directly.` : "Her sessions are free."}`
            : "Our team passes your request on and introduces you once she confirms."}
          {" "}For heavy bleeding, severe pain or feeling faint, go to a hospital — don&apos;t wait for a reply.
        </p>
      </> },
  ];
  return (
    <StepSheet open onClose={onClose} icon="MessageCircle" title={`Ask ${mentor.name}`} hue="orange"
               steps={steps} step={step} setStep={setStep} onSubmit={send} busy={busy} submitLabel="Send my request" />
  );
}

function ProfileSheet({ mentor, onClose, onAsk }: { mentor: ApiMentor | null; onClose: () => void; onAsk: (m: ApiMentor) => void }) {
  const id = mentor?.id ?? "";
  const reviews = useResource(
    useCallback((s: AbortSignal) => (id ? apiMentorReviews(id, s) : Promise.resolve(null)), [id]),
    null as MentorReviewPage | null,
  );
  if (!mentor) return null;
  const m = mentor;
  const r = reviews.data;
  return (
    <Sheet open onClose={onClose} title={m.name} icon="UserRound" description={m.headline} width={520}
           footer={m.is_mine ? undefined : m.requested
             ? <Btn full variant="soft" href="/app/health/mentors?tab=sessions">See my request</Btn>
             : <Btn full icon="MessageCircle" onClick={() => onAsk(m)}>Ask {m.name.split(" ")[0]} for time</Btn>}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artFor([m.expertise.join(" "), m.headline, m.focus], "health", m.photo, m.id)} alt={m.name}
           className="mb-4 aspect-[16/10] w-full rounded-[16px] object-cover" />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {m.expertise.map((e) => (
          <span key={e} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: HUE.orange.tint, color: HUE.orange.ink }}>{e}</span>
        ))}
      </div>
      {m.bio && <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{m.bio}</p>}
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        {m.experience_years > 0 && <><dt style={{ color: "var(--ux-muted)" }}>Experience</dt><dd style={{ color: "var(--ux-ink)" }}>{m.experience_years} years</dd></>}
        {m.languages.length > 0 && <><dt style={{ color: "var(--ux-muted)" }}>Speaks</dt><dd style={{ color: "var(--ux-ink)" }}>{m.languages.join(", ")}</dd></>}
        {m.availability && <><dt style={{ color: "var(--ux-muted)" }}>Free</dt><dd style={{ color: "var(--ux-ink)" }}>{m.availability}</dd></>}
        {m.location && <><dt style={{ color: "var(--ux-muted)" }}>Based in</dt><dd style={{ color: "var(--ux-ink)" }}>{m.location}</dd></>}
        <dt style={{ color: "var(--ux-muted)" }}>Session</dt>
        <dd style={{ color: "var(--ux-ink)" }}>{m.session_mode || "Video call"}{m.session_minutes ? ` · ${m.session_minutes} min` : ""} · {rupees(m.price_minor)}</dd>
      </dl>
      <div className="mt-5">
        <p className="mb-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
          What women said {r && r.rating_count > 0 ? `· ★ ${r.rating.toFixed(1)} from ${r.rating_count}` : ""}
        </p>
        {r && r.reviews.length ? (
          <ul className="flex flex-col gap-2.5">
            {r.reviews.slice(0, 4).map((rv, i) => (
              <li key={i} className="rounded-[12px] p-3 text-sm" style={{ background: "var(--ux-surface-2)" }}>
                <span className="font-bold" style={{ color: "var(--ux-amber-ink)" }}>{"★".repeat(rv.rating)}</span>
                {rv.text && <p className="mt-1" style={{ color: "var(--ux-ink-2)" }}>{rv.text}</p>}
                <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>{rv.first_name} · {rv.date}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No ratings yet. Ratings come only from women who had a session with her.</p>
        )}
      </div>
    </Sheet>
  );
}

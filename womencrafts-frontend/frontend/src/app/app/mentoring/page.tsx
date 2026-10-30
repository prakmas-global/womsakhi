"use client";

import { useCallback, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, EmptyState, IconTile, Pill, ScreenSkeleton, SectionHead, Tabs } from "@/components/ux/kit";
import { Area, Choice, Label, More, Picks, Stepper, Text } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import {
  SESSION_MODES, apiAcceptRequest, apiDeclineRequest, apiIncomingRequests, apiMyMentorProfile, apiSaveMentorProfile,
  apiSessionDone, apiSessionPaymentReceived, apiSetMentoringLive,
  type IncomingRequest, type MentorInput, type MentorProfile,
} from "@/lib/mentoring-api";
import { rupees } from "@/lib/teach-api";
import { useMaster } from "@/lib/masters-api";
import { PicChip, useMasterPictures } from "@/components/ux/media/MasterPictures";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";

/**
 * Mentoring — become a mentor, and run your own sessions.
 *
 * No approval: she writes her profile and it is live in Mentors. Requests come
 * to her here; she accepts with a time and how to meet, or declines. A paid
 * session is paid to her by UPI — she confirms it, and only then does the
 * learner see how to join.
 */

/** What the list shipped with; staff edit the `languages` master. */
const LANGUAGES = ["Hindi", "English", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Kannada", "Malayalam", "Urdu", "Punjabi", "Odia"];
const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;

/*
  Choices, so setting up takes taps rather than typing. The server still wants
  a headline (8+) and a story (30+) in her words — so those are offered as
  sentences built from what she has already picked, which she can tap, edit,
  or replace with her own.
*/
/** What shows until the "mentor_topics" master loads. */
const TOPICS = [
  "Getting started", "Pricing", "Finding customers", "Online selling", "Savings", "Bookkeeping",
  "Tailoring", "Mehendi", "Beauty", "Cooking and tiffin", "Baking", "Digital marketing",
  "Spoken English", "Getting a loan", "Communication",
];
const AVAILABILITY = ["Weekday mornings", "Weekday afternoons", "Weekday evenings", "Saturdays", "Sundays"];
const PRICES = [50, 100, 150, 200, 300, 500];
const MINUTES = [{ v: 15, l: "15 minutes" }, { v: 30, l: "30 minutes" }, { v: 45, l: "45 minutes" }, { v: 60, l: "1 hour" }];

/** "a, b and c" */
const list = (xs: string[]) => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
/** Add or remove one item from a joined string. */
const toggleIn = (text: string, item: string, sep: string) => {
  const parts = text.split(sep.trim() ? sep : /(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return (parts.includes(item) ? parts.filter((x) => x !== item) : [...parts, item]).join(sep);
};

function headlineIdeas(f: MentorInput): string[] {
  const topics = f.expertise.slice(0, 2).map((e) => e.toLowerCase());
  if (!topics.length) return [];
  return [
    `I help women with ${list(topics)}`,
    f.experience_years ? `${f.experience_years} years in ${topics[0]} — happy to guide you` : `I learned ${topics[0]} the hard way — let me guide you`,
    `Starting out in ${topics[0]}? I can help`,
  ];
}

function storyIdeas(f: MentorInput): string[] {
  const topics = f.expertise.slice(0, 3).map((e) => e.toLowerCase());
  return [
    f.experience_years ? `I have ${f.experience_years} years of experience.` : "I learned by doing it myself.",
    ...(topics.length ? [`I can help you with ${list(topics)}.`] : []),
    "I started from home, like many of you.",
    "I can help you price your work fairly.",
    "I can help you find your first customers.",
    `I will explain things simply, in ${f.languages[0] ?? "your language"}.`,
    "No question is too small.",
  ];
}

/** Real dates on the chips — "Tomorrow" means nothing when she reads it two days later. */
function soon(): string[] {
  const at = (days: number, time: string) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
  };
  const toSat = ((6 - new Date().getDay() + 7) % 7) || 7;
  return [
    ...(new Date().getHours() < 16 ? [at(0, "6 pm")] : []),
    at(1, "11 am"), at(1, "6 pm"), at(toSat, "11 am"), at(toSat + 1, "11 am"),
  ];
}
const MEETING_WAYS = [
  "I will WhatsApp video call you", "I will phone you", "Google Meet — I will send you the link",
  "At my home — I will message you the address",
];
const NOTE_PHRASES = ["Bring two photos of your work", "Write down your questions", "Keep a notebook ready", "Bring your price list"];
const EMPTY: MentorInput = {
  headline: "", bio: "", expertise: [], languages: ["Hindi"], experience_years: 0, location: "",
  availability: "", session_mode: "Video call", session_minutes: 30, price_rupees: 0, upi_id: "",
};

function problemsFor(f: MentorInput, paid: boolean): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.headline.trim().length < 8) p.headline = "One line about what you do — at least 8 letters.";
  if (f.bio.trim().length < 30) p.bio = "Tell women a little about yourself — at least a couple of lines.";
  if (!f.expertise.length) p.expertise = "Add at least one thing you help with.";
  if (!f.languages.length) p.languages = "Choose at least one language.";
  if (paid) {
    if (f.price_rupees < 10) p.price = "A paid session costs at least ₹10.";
    if (!UPI_ID.test(f.upi_id.trim())) p.upi = "Add the UPI ID learners should pay, like name@okaxis.";
  }
  return p;
}

const Err = ({ children }: { children?: string }) =>
  children ? <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{children}</p> : null;

function MentorForm({ value, onChange, paid, onPaid, problems }: {
  value: MentorInput; onChange: (v: MentorInput) => void; paid: boolean; onPaid: (b: boolean) => void; problems: Record<string, string>;
}) {
  const set = <K extends keyof MentorInput>(k: K) => (v: MentorInput[K]) => onChange({ ...value, [k]: v });
  // Languages are the `languages` master staff edit; one already on her
  // profile stays shown even if staff have since disabled it.
  const langMaster = useMaster("languages", LANGUAGES);
  const languageOptions = [...langMaster.labels, ...value.languages.filter((l) => !langMaster.labels.includes(l))];
  const toggleTopic = (t: string) => {
    if (value.expertise.includes(t)) set("expertise")(value.expertise.filter((x) => x !== t));
    else if (value.expertise.length < 8) set("expertise")([...value.expertise, t]);
  };
  // Staff control what mentors can help with (Masters → Mentor topics); the
  // server checks it. Each group shows its topics, or itself when it has none.
  const topicPics = useMasterPictures("mentor_topics", TOPICS);
  const topicItems = topicPics.items;
  // Topics as picture chips: she recognises the work before she reads the word.
  const topicPicks = (options: string[], label: string) => (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <PicChip key={o} src={topicPics.pic(o)} selected={value.expertise.includes(o)} onClick={() => toggleTopic(o)}>{o}</PicChip>
      ))}
    </div>
  );
  // Groups with no topics under them are themselves the choice; they share one
  // row. Groups with topics get a row each, under their name.
  const single = topicItems.filter((g) => !g.children?.length).map((g) => g.label);
  const groups = topicItems.filter((g) => g.children?.length)
    .map((g) => ({ label: g.label, options: (g.children ?? []).map((c) => c.label) }));
  const known = new Set([...single, ...groups.flatMap((g) => g.options)]);
  // A topic already on her profile that staff have since retired stays tickable.
  const hers = value.expertise.filter((e) => !known.has(e));
  const headlines = headlineIdeas(value);
  const stories = storyIdeas(value);
  return (
    <div className="space-y-[16px]">
      <Card>
        <SectionHead title="About you" icon="UserRound" />
        <div className="space-y-4">
          <div>
            <Label need hint="tap all that fit, up to 8">What you help with</Label>
            <div className="space-y-3">
              {hers.length > 0 && topicPicks(hers, "Your topics")}
              {single.length > 0 && topicPicks(single, "Topics")}
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={topicPics.pic(g.label)} alt="" className="h-5 w-5 rounded-[6px] object-cover" />
                    {g.label}
                  </p>
                  {topicPicks(g.options, g.label)}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>
              Missing a topic? Tell us from <a href="/app/feedback" className="font-semibold underline">Tell us</a> and the team can add it.
            </p>
            <Err>{problems.expertise}</Err>
          </div>
          <div>
            <Label need>Languages you speak</Label>
            <div className="flex flex-wrap gap-1.5">
              {languageOptions.map((l) => {
                const on = value.languages.includes(l);
                return (
                  <button key={l} type="button" aria-pressed={on}
                          onClick={() => set("languages")(on ? value.languages.filter((x) => x !== l) : [...value.languages, l])}
                          className="ux-press rounded-full border px-3 py-1 text-xs"
                          style={on ? { borderColor: "var(--ux-brand)", color: "var(--ux-brand)", background: "var(--ux-brand-tint)" }
                            : { borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{l}</button>
                );
              })}
            </div>
            <Err>{problems.languages}</Err>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label hint="optional">Years of experience</Label>
              <Stepper value={value.experience_years ? String(value.experience_years) : "0"} label="Years of experience"
                       presets={[1, 3, 5, 10, 20]}
                       onChange={(s) => set("experience_years")(Math.min(60, Math.max(0, Number(s.replace(/\D/g, "")) || 0)))} />
            </div>
            <div>
              <Label hint="optional">When you are free</Label>
              <Picks options={AVAILABILITY} value={value.availability.split(", ")} multi label="When you are free"
                     onPick={(a) => set("availability")(toggleIn(value.availability, a, ", ").slice(0, 120))} />
            </div>
          </div>
          <div>
            <Label hint="optional">Where you are</Label>
            <Text value={value.location} onChange={set("location")} label="Location" max={80} placeholder="Pune, Maharashtra" />
          </div>
          <div>
            <Label need>One line about what you do</Label>
            {headlines.length > 0 && (
              <Picks options={headlines} value={value.headline} onPick={set("headline")} label="Ready-made lines" />
            )}
            <div className="mt-2">
              <Text value={value.headline} onChange={set("headline")} label="Headline" max={120}
                    placeholder={headlines.length ? "Tap a line above, or write your own" : "Pick what you help with first"} />
            </div>
            <Err>{problems.headline}</Err>
          </div>
          <div>
            <Label need hint="tap two or more">Your story, and how you can help</Label>
            <Picks options={stories} value={stories.filter((x) => value.bio.includes(x))} multi label="Ready-made sentences"
                   onPick={(x) => set("bio")(toggleIn(value.bio, x, " ").slice(0, 1500))} />
            <div className="mt-2">
              <Area value={value.bio} onChange={set("bio")} max={1500} rows={3} label="About you"
                    placeholder="Tap sentences above — you can change any word here." />
            </div>
            <Err>{problems.bio}</Err>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead title="Your sessions" icon="CalendarCheck" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Label>How you meet</Label>
            <Picks options={SESSION_MODES} value={value.session_mode} onPick={set("session_mode")} label="How you meet" />
          </div>
          <div>
            <Label>How long</Label>
            <Picks options={MINUTES.map((m) => m.l)} value={MINUTES.find((m) => m.v === value.session_minutes)?.l ?? ""}
                   onPick={(l) => set("session_minutes")(MINUTES.find((m) => m.l === l)?.v ?? 30)} label="How long" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <Choice icon="Gift" title="Free" sub="Help other women at no cost." on={!paid} onClick={() => onPaid(false)} />
          <Choice icon="IndianRupee" title="Paid" sub="A price per session, paid to you by UPI." on={paid} onClick={() => onPaid(true)} />
        </div>
        {paid && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <Label need>Price per session</Label>
              <Picks options={PRICES.map((n) => `₹${n}`)} value={value.price_rupees ? `₹${value.price_rupees}` : ""}
                     onPick={(x) => set("price_rupees")(Number(x.replace(/\D/g, "")))} label="Price per session" />
              <div className="mt-2">
                <Text value={value.price_rupees ? String(value.price_rupees) : ""} type="number" prefix="₹" label="Price"
                      onChange={(s) => set("price_rupees")(Math.max(0, Math.floor(Number(s.replace(/\D/g, "")) || 0)))} placeholder="Or type your price" />
              </div>
              <Err>{problems.price}</Err>
            </div>
            <div>
              <Label need>Your UPI ID</Label>
              <Text value={value.upi_id} onChange={set("upi_id")} label="UPI ID" max={120} placeholder="name@okaxis" />
              <Err>{problems.upi}</Err>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function RequestCard({ r, onChanged }: { r: IncomingRequest; onChanged: () => void }) {
  const [accepting, setAccepting] = useState(false);
  const [when, setWhen] = useState(r.preferred_time);
  const [meeting, setMeeting] = useState("");
  const [note, setNote] = useState("");
  const [times] = useState(soon);
  const act = useAction(async (what: string) => {
    if (what === "accept") await apiAcceptRequest(r.id, when.trim(), meeting.trim(), note.trim());
    if (what === "decline") await apiDeclineRequest(r.id);
    if (what === "paid") await apiSessionPaymentReceived(r.id);
    if (what === "done") await apiSessionDone(r.id);
  }, { onDone: () => { setAccepting(false); onChanged(); }, fallbackError: "That did not go through. Try again in a moment." });

  const tone = r.status === "pending" ? "orange" : r.status === "accepted" ? "blue" : "neutral";
  const label = r.status === "pending" ? "New request" : r.status === "accepted" ? "Accepted" : r.status === "closed" ? "Done" : "Declined";
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-sm font-bold"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          {r.learner.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{r.learner}</p>
            <Pill tone={tone} size="sm">{label}</Pill>
            {r.price_minor > 0 && <Pill tone="green" size="sm">{rupees(r.price_minor)}</Pill>}
            <span className="text-xs" style={{ color: "var(--ux-faint)" }}>asked {r.asked_on}</span>
          </div>
          <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>&ldquo;{r.goal}&rdquo;</p>
          {r.preferred_time && r.status === "pending" && (
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>Suits her: {r.preferred_time}</p>
          )}
          {r.status === "accepted" && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>
              <Icons.CalendarCheck className="me-1 inline h-3.5 w-3.5" />{r.scheduled_for} · {r.meeting}
            </p>
          )}
          {r.status === "accepted" && r.payment_status === "awaiting" && (
            <p className="mt-1 text-xs" style={{ color: "var(--ux-orange-ink)" }}>Waiting for her to pay you {rupees(r.price_minor)}. She sees how to join once you confirm it.</p>
          )}
          {r.status === "accepted" && r.payment_status === "claimed" && (
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--ux-orange-ink)" }}>
              She says she paid {rupees(r.price_minor)}{r.reference ? ` · reference ${r.reference}` : ""}. Check your UPI app.
            </p>
          )}

          {accepting && (
            <div className="mt-3 space-y-3 rounded-[12px] border p-3.5" style={{ borderColor: "var(--ux-line)" }}>
              <div>
                <Label need>When</Label>
                <Picks options={r.preferred_time ? [r.preferred_time, ...times] : times} value={when} onPick={setWhen} label="When" />
                <div className="mt-2">
                  <Text value={when} onChange={setWhen} label="When" max={80} placeholder="Or type a time" />
                </div>
              </div>
              <div>
                <Label need>How to meet</Label>
                <Picks options={MEETING_WAYS} value={meeting} onPick={setMeeting} label="How to meet" />
                <div className="mt-2">
                  <Text value={meeting} onChange={setMeeting} label="How to meet" max={300}
                        placeholder="Or paste a Meet / Zoom link, or a place" />
                </div>
              </div>
              <More label="A note for her (optional)" open={!!note}>
                <Picks options={NOTE_PHRASES} value={note.split(". ")} multi label="A note for her"
                       onPick={(x) => setNote(toggleIn(note, x, ". ").slice(0, 300))} />
                <div className="mt-2">
                  <Text value={note} onChange={setNote} label="Note" max={300} placeholder="Or in your own words" />
                </div>
              </More>
              <div className="flex gap-2">
                <Btn variant="primary" size="sm" icon="Check" loading={act.busy} disabled={when.trim().length < 3 || meeting.trim().length < 3}
                     onClick={() => void act.run("accept")}>Send to her</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setAccepting(false)}>Cancel</Btn>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === "pending" && !accepting && (
              <>
                <Btn variant="primary" size="sm" icon="Check" onClick={() => setAccepting(true)}>Accept with a time</Btn>
                <Btn variant="outline" size="sm" loading={act.busy} onClick={() => void act.run("decline")}>Decline</Btn>
              </>
            )}
            {r.status === "accepted" && ["awaiting", "claimed"].includes(r.payment_status) && (
              <Btn variant={r.payment_status === "claimed" ? "primary" : "outline"} size="sm" icon="IndianRupee" loading={act.busy}
                   onClick={() => void act.run("paid")}>Payment received</Btn>
            )}
            {r.status === "accepted" && (
              <Btn variant="outline" size="sm" icon="CheckCircle2" loading={act.busy} onClick={() => void act.run("done")}>Mark session done</Btn>
            )}
          </div>
          {act.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{act.error}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function MentoringPage() {
  const { data: profile, source, refetch } = useResource(
    useCallback((s: AbortSignal) => apiMyMentorProfile(s).catch(() => null), []),
    null as MentorProfile | null,
  );
  const { data: requests, refetch: refetchRequests } = useResource(
    useCallback((s: AbortSignal) => apiIncomingRequests(s).catch(() => []), []),
    [] as IncomingRequest[],
  );
  const [tab, setTab] = useState("Requests");
  const [form, setForm] = useState<MentorInput | null>(null);
  const [paid, setPaid] = useState(false);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (form || source === "loading") return;
    const t = window.setTimeout(() => {
      if (profile) {
        setForm({
          headline: profile.headline, bio: profile.bio, expertise: profile.expertise, languages: profile.languages,
          experience_years: profile.experience_years, location: profile.location, availability: profile.availability,
          session_mode: profile.session_mode, session_minutes: profile.session_minutes,
          price_rupees: Math.round(profile.price_minor / 100), upi_id: profile.upi_id,
        });
        setPaid(profile.price_minor > 0);
      } else {
        setForm({ ...EMPTY });
      }
    });
    return () => window.clearTimeout(t);
  }, [profile, source, form]);

  const input = form && { ...form, price_rupees: paid ? form.price_rupees : 0, upi_id: paid ? form.upi_id : "" };
  const problems = input ? problemsFor(input, paid) : {};
  const save = useAction(async () => { if (input) await apiSaveMentorProfile(input); }, {
    onDone: () => { setSaved(profile ? "Saved." : "You are a mentor now — members can find you in Mentors."); refetch(); setTab("Requests"); },
    fallbackError: "Your profile did not save. Try again in a moment.",
  });
  const live = useAction(async (on: boolean) => { await apiSetMentoringLive(on); }, { onDone: refetch });
  const submit = () => { setTried(true); if (!Object.keys(problems).length) void save.run(); };

  if (source === "loading" || !form) return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;

  // ── not a mentor yet: the setup ──
  if (!profile) {
    return (
      <HomeShell
        rail={
          <Card>
            <SectionHead title="How mentoring works" icon="Sparkles" />
            <ol className="space-y-3.5">
              {([
                ["PenLine", "Write your profile", "It is live in Mentors straight away — no approval."],
                ["Inbox", "Women ask you for time", "They say what they need help with."],
                ["CalendarCheck", "Accept with a time", "Add a meeting link, a number, or a place."],
                ["IndianRupee", "Free, or paid to you", "Paid sessions: she pays you by UPI, you confirm."],
              ] as const).map(([icon, t, s]) => (
                <li key={t} className="flex items-start gap-3">
                  <IconTile icon={icon} tint="--ux-tint-orange" ink="--ux-orange" size={34} radius={10} />
                  <span><span className="block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{t}</span>
                    <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>{s}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        }
      >
        <Back to="/app/services" label="My services" className="mb-4" />
        <ScreenHead title="Become a mentor" sub="You know more than you think. Guide women one to one — it takes five minutes to set up." />
        <MentorForm value={form} onChange={setForm} paid={paid} onPaid={setPaid} problems={tried ? problems : {}} />
        <Card className="mt-[16px]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs" style={{ color: tried && Object.keys(problems).length ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
              {tried && Object.keys(problems).length ? "A few things need fixing — they are marked above." : "Your profile goes live in Mentors as soon as you start."}
            </p>
            <Btn variant="primary" icon="HeartHandshake" loading={save.busy} onClick={submit}>Start mentoring</Btn>
          </div>
          {save.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{save.error}</p>}
        </Card>
      </HomeShell>
    );
  }

  // ── a mentor: her requests and her profile ──
  const waiting = requests.filter((r) => r.status === "pending" || r.payment_status === "claimed").length;
  return (
    <HomeShell>
      <Back to="/app/services" label="My services" className="mb-4" />
      <ScreenHead title="My mentoring"
                  sub={`${profile.live ? "Taking requests" : "Paused — you are hidden from Mentors"} · ${profile.sessions_done} session${profile.sessions_done === 1 ? "" : "s"} done · ${profile.price_minor ? `${rupees(profile.price_minor)} a session` : "Free"}`}>
        <div className="flex flex-wrap gap-2">
          <Btn href={`/app/mentors/${profile.id}`} variant="outline" icon="Eye">See my profile</Btn>
          {profile.live
            ? <Btn variant="outline" icon="Pause" loading={live.busy} onClick={() => void live.run(false)}>Pause</Btn>
            : <Btn variant="primary" icon="Play" loading={live.busy} onClick={() => void live.run(true)}>Take requests again</Btn>}
        </div>
      </ScreenHead>
      {saved && (
        <Card className="mb-[16px]" style={{ background: "var(--ux-tint-green)" }}>
          <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
            <Icons.CheckCircle2 className="h-4 w-4" style={{ color: "var(--ux-green-ink)" }} /> {saved}
          </p>
        </Card>
      )}
      <div className="mb-[16px]">
        <Tabs items={[waiting ? `Requests (${waiting})` : "Requests", "My profile"]}
              active={tab === "Requests" ? (waiting ? `Requests (${waiting})` : "Requests") : tab}
              onChange={(t) => setTab(t.startsWith("Requests") ? "Requests" : t)} />
      </div>
      {tab === "Requests" ? (
        requests.length ? (
          <div className="space-y-[12px]">
            {requests.map((r) => <RequestCard key={r.id} r={r} onChanged={() => { refetchRequests(); refetch(); }} />)}
          </div>
        ) : (
          <Card><EmptyState icon="Inbox" title="No requests yet" body="When a woman asks you for time, it appears here — and we tell you straight away." /></Card>
        )
      ) : (
        <>
          <MentorForm value={form} onChange={setForm} paid={paid} onPaid={setPaid} problems={tried ? problems : {}} />
          <Card className="mt-[16px]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Changes show in Mentors as soon as you save.</p>
              <Btn variant="primary" icon="Save" loading={save.busy} onClick={submit}>Save changes</Btn>
            </div>
            {save.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{save.error}</p>}
          </Card>
        </>
      )}
    </HomeShell>
  );
}

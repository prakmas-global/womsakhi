"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BookOpen, Briefcase, Check, ChevronRight, Scissors, Sparkles, Target, Users } from "lucide-react";

import {
  apiCircleInfo, apiJoinSuggestedCircle, apiKeepItem, apiRemoveItem, apiRunSetup,
  type Answers, type CircleInfo, type PreparedItem,
} from "@/lib/onboarding-api";
import { authError } from "@/lib/auth-api";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { Art } from "./art";
import { DraftTag, PrivateTag, ReviewItemCard, SettingUpList, Tag, type SetupRowState } from "./primitives";
import { labelOfSkill } from "./steps";
import { FREE_TIMES, LEARN_TOPICS } from "./vocab";
import { useDialogFocus } from "./useDialogFocus";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/** "Using: English · Tailoring · Evenings · 20 min" — her real answers, nothing else. */
export function answerPills(a: Answers, labels: Record<string, string>): string[] {
  const out = ["English"];
  const skills = a.skills ?? [];
  skills.slice(0, 2).forEach((s) => out.push(labelOfSkill(s, labels)));
  if (skills.length > 2) out.push(`+${skills.length - 2} more`);
  const topics = (a.learn_topics ?? []).map((t) => LEARN_TOPICS.find((x) => x.key === t)?.label ?? t);
  if (topics.length) out.push(topics.slice(0, 2).join(", "));
  const times = (a.free_times ?? []).map((t) => FREE_TIMES.find((x) => x.key === t)?.plural ?? t);
  const when = [times.join(", "), a.minutes_per_day ? `${a.minutes_per_day} min` : ""].filter(Boolean).join(" · ");
  if (when) out.push(when);
  return out;
}

function AnswerPills({ pills }: { pills: string[] }) {
  return (
    <ul className="wso-chips" aria-label="Your answers">
      {pills.map((p) => <li key={p}>{p}</li>)}
    </ul>
  );
}

// ── while she waits ────────────────────────────────────────────────────────

export function ThanksScreen({ firstName, answers, labels }: { firstName: string; answers: Answers; labels: Record<string, string> }) {
  return (
    <div id="wso-say" className="wso-stack wso-center-screen">
      <div className="wso-banner is-tall"><Art name="home" sizes="(min-width: 640px) 560px, 100vw" /></div>
      <h1 id="wso-q" className="wso-q" tabIndex={-1}>
        Thank you{firstName ? `, ${firstName}` : ""}. Your home will be ready when you&apos;re approved.
      </h1>
      <p className="wso-sub">
        We saved your answers. Nothing is made until our team approves you, usually within a day. Then your drafts and suggestions will be waiting.
      </p>
      <div className="wso-card">
        <p className="wso-label">Saved</p>
        <AnswerPills pills={answerPills(answers, labels)} />
      </div>
    </div>
  );
}

// ── setting up ─────────────────────────────────────────────────────────────

type RowKey = "listing" | "jobs" | "programme" | "circle" | "goal" | "reminder" | "home";
const ROW_TYPES: Record<RowKey, string[]> = {
  listing: ["listing"], jobs: ["saved_search", "opportunity"], programme: ["programme"],
  circle: ["circle"], goal: ["goal"], reminder: ["reminder"], home: [],
};

/** What her answers will make, in the order the server makes it. */
function plannedRows(a: Answers, labels: Record<string, string>): { key: RowKey; label: string }[] {
  const goals = a.goals ?? [];
  const skills = a.skills ?? [];
  const rows: { key: RowKey; label: string }[] = [];
  const first = skills[0] ? labelOfSkill(skills[0], labels) : "";
  if (first && (goals.includes("earn_home") || goals.includes("sell"))) rows.push({ key: "listing", label: `Your ${first.toLocaleLowerCase()} draft, private to you` });
  if (goals.includes("find_job") || goals.includes("earn_home")) rows.push({ key: "jobs", label: "A private job search for your skills" });
  if (goals.includes("learn")) rows.push({ key: "programme", label: "Short lessons on what you chose" });
  if (goals.includes("meet")) rows.push({ key: "circle", label: "Circles of women like you" });
  if (goals.length) rows.push({ key: "goal", label: "A first goal, for you to keep or change" });
  if ((a.free_times ?? []).length) rows.push({ key: "reminder", label: "A reminder time, off until you turn it on" });
  rows.push({ key: "home", label: "Your home" });
  return rows;
}

/** A row's words once its things exist, from what was really made. */
function madeLabel(key: RowKey, made: PreparedItem[], fallback: string): string {
  const of = (t: string) => made.filter((i) => i.type === t);
  if (key === "listing" && of("listing")[0]) return `Your ${of("listing")[0].title.toLocaleLowerCase()} draft, private to you`;
  if (key === "programme" && of("programme").length) return `${of("programme").length} lesson${of("programme").length > 1 ? "s" : ""} picked for you`;
  if (key === "circle" && of("circle").length) return `${of("circle").length} circle${of("circle").length > 1 ? "s" : ""} you might like`;
  if (key === "goal" && of("goal")[0]) return `A goal: ${of("goal")[0].title}`;
  return fallback;
}

const MIN_MS = 1200;

/*
  One setup request at a time from this tab. React's development double-mount
  (and a quick remount) would otherwise send two, and the second meets the
  server's "already preparing" lease. A pending call is shared instead.
*/
let setupInFlight: ReturnType<typeof apiRunSetup> | null = null;
function runSetupOnce(): ReturnType<typeof apiRunSetup> {
  if (!setupInFlight) setupInFlight = apiRunSetup().finally(() => { setupInFlight = null; });
  return setupInFlight;
}

/**
 * "Setting up your WomSakhi": runs the real setup and ticks each row from
 * what came back. It lasts as long as the work, and at least 1.2 s so it
 * reads as a moment rather than a flash; ticks are spread over that second.
 * A row whose thing was not made (no circles to suggest yet) is dropped, not
 * ticked — nothing here claims more than the server did.
 */
export function SettingUpScreen({ answers, labels, onDone, onNeedConsent, preview }: {
  answers: Answers; labels: Record<string, string>;
  onDone: (items: PreparedItem[]) => void; onNeedConsent: () => void;
  /** Local preview: the approved mid-run frame, held still. */
  preview: boolean;
}) {
  const planned = plannedRows(answers, labels);
  const [done, setDone] = useState<number>(0);
  const [made, setMade] = useState<PreparedItem[] | null>(null);
  const [problem, setProblem] = useState<{ text: string; consent?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  useEffect(() => {
    if (AUTH_PREVIEW && preview) {
      const t = window.setTimeout(() => setDone(2));
      return () => window.clearTimeout(t);
    }
    let alive = true;
    const timers: number[] = [];
    const started = performance.now();
    const run = async (retried: boolean): Promise<void> => {
      try {
        const res = await runSetupOnce();
        if (!alive) return;
        setMade(res.items);
        const elapsed = performance.now() - started;
        const spread = Math.max(0, MIN_MS - 200 - elapsed);
        const n = planned.length;
        for (let i = 1; i <= n; i++) timers.push(window.setTimeout(() => alive && setDone(i), (spread * i) / n));
        timers.push(window.setTimeout(() => alive && doneRef.current(res.items), Math.max(MIN_MS - elapsed, spread + 300)));
      } catch (e) {
        if (!alive) return;
        const err = authError(e, "We couldn't set things up just now. Check your connection and try again.");
        if (err.code === "setup_running" && !retried) {
          timers.push(window.setTimeout(() => void run(true), 1500));
          return;
        }
        setProblem({ text: err.message, consent: err.code === "consent_required" });
      }
    };
    void run(false);
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per attempt; `planned` is fixed while it runs
  }, [attempt, preview]);

  const rows = planned
    .filter((r) => !made || r.key === "home" || made.some((i) => ROW_TYPES[r.key].includes(i.type)))
    .map((r, i) => {
      const state: SetupRowState = i < done ? "done" : i === done && !problem ? "working" : "waiting";
      return { key: r.key, label: made ? madeLabel(r.key, made, r.label) : r.label, state };
    });

  return (
    <div className="wso-stack wso-center-screen" aria-busy={!problem && done < rows.length}>
      <div className="wso-round"><Art name="setup" sizes="160px" /></div>
      <h1 id="wso-q" className="wso-q wso-center" tabIndex={-1}>Setting up your WomSakhi</h1>
      <div className="wso-card">
        <p className="wso-label">Using your answers:</p>
        <AnswerPills pills={answerPills(answers, labels)} />
      </div>
      <SettingUpList rows={rows} />
      {problem && (
        <div className="wso-err" role="alert">
          <p>{problem.text}</p>
          {problem.consent ? (
            <button type="button" className="wso-btn wso-soft" onClick={onNeedConsent}>Go to the start</button>
          ) : (
            <button type="button" className="wso-btn wso-soft" onClick={() => { setProblem(null); setDone(0); setMade(null); setAttempt((n) => n + 1); }}>Try again</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── review ─────────────────────────────────────────────────────────────────

const SETTLED = new Set(["removed", "dismissed"]);

function clock(local?: string): string {
  if (!local) return "";
  const [h, m] = local.split(":").map(Number);
  if (Number.isNaN(h)) return local;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

type Busy = Record<string, boolean>;

export function ReviewScreen({ items, setItems, onOpenCircle, joined, preview }: {
  items: PreparedItem[];
  setItems: (fn: (prev: PreparedItem[]) => PreparedItem[]) => void;
  onOpenCircle: (item: PreparedItem, from: HTMLElement) => void;
  joined: Set<string>;
  preview: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>({});
  const live = (t: string) => items.filter((i) => i.type === t);
  const listings = live("listing");
  const search = live("saved_search")[0];
  const jobs = live("opportunity");
  const programmes = live("programme");
  const circles = live("circle");
  const welcome = live("welcome")[0];
  const goals = live("goal");
  const reminder = live("reminder")[0];

  const update = (item: PreparedItem, next: Partial<PreparedItem>) =>
    setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, ...next } : i)));

  async function act(item: PreparedItem, kind: "keep" | "on" | "off" | "remove", success: string) {
    setBusy((b) => ({ ...b, [item.key]: true }));
    try {
      let next: Partial<PreparedItem>;
      if (AUTH_PREVIEW && preview) {
        next = kind === "remove" ? { state: item.type === "listing" || item.type === "goal" || item.type === "reminder" || item.type === "saved_search" ? "removed" : "dismissed" }
          : { state: "kept", enabled: kind === "on" };
      } else if (kind === "remove") {
        next = await apiRemoveItem(item.type, item.id);
      } else {
        next = await apiKeepItem(item.type, item.id, kind === "on");
      }
      update(item, next);
      toast.success(success);
    } catch (e) {
      toast.error(authError(e, "That didn't go through. Please try again.").message);
    } finally {
      setBusy((b) => ({ ...b, [item.key]: false }));
    }
  }

  async function dismissAll(list: PreparedItem[]) {
    for (const c of list.filter((c) => !SETTLED.has(c.state) && !joined.has(c.id))) await act(c, "remove", "Put aside. You can find circles any time.");
  }

  const cards: ReactNode[] = [];

  listings.forEach((l) => cards.push(
    <ReviewItemCard key={l.key} labelId={`wso-i-${l.key}`} icon={<Scissors aria-hidden />} title={l.title}
      meta="Your service draft" tag={<DraftTag />} reason={l.reason}
      done={l.state === "removed" ? "Removed. Nothing was published." : undefined}>
      <Link className="wso-act is-primary" href={`/app/documents/service/${l.id}`}>Finish &amp; publish</Link>
      <Link className="wso-act" href={`/app/documents/service/${l.id}`}>Edit</Link>
      <button type="button" className="wso-act" disabled={busy[l.key]} onClick={() => act(l, "remove", "Draft removed")}>Remove</button>
    </ReviewItemCard>,
  ));

  if (programmes.length) {
    const open = programmes.filter((p) => !SETTLED.has(p.state));
    cards.push(
      <ReviewItemCard key="programmes" labelId="wso-i-programmes" icon={<BookOpen aria-hidden />}
        title={`${programmes.length} lesson${programmes.length > 1 ? "s" : ""} for you`}
        meta={programmes.map((p) => p.title).join(" · ")} reason={programmes[0].reason}
        done={open.length ? undefined : "Put aside. Lessons are always in Learn."}>
        <Link className="wso-act is-primary" href={`/app/programs/${open[0]?.id ?? programmes[0].id}`}>Start lesson 1</Link>
        <Link className="wso-act" href="/app/programs">Change</Link>
      </ReviewItemCard>,
    );
  }

  if (circles.length || welcome) {
    const open = circles.filter((c) => !SETTLED.has(c.state));
    cards.push(
      <ReviewItemCard key="circles" labelId="wso-i-circles" icon={<Users aria-hidden />}
        title={circles.length ? `${circles.length} circle${circles.length > 1 ? "s" : ""} you might like` : "Your first circle"}
        meta={circles.length ? "See who's there before you join."
          : `You're in the ${welcome?.title ?? "Welcome"} space. Only the WomSakhi team posts there.`}
        reason={circles[0]?.reason}
        done={circles.length && !open.length ? "Put aside. You can find circles any time." : undefined}>
        {open.length > 0 && (
          <ul className="wso-circle-list">
            {open.map((c) => (
              <li key={c.key}>
                <button type="button" className="wso-circle-row" onClick={(e) => onOpenCircle(c, e.currentTarget)}>
                  <span><b>{c.title}</b><small>{joined.has(c.id) ? "Joined" : "See who's there"}</small></span>
                  {joined.has(c.id) ? <Check aria-hidden className="wso-ok-ic" /> : <ChevronRight aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open.some((c) => !joined.has(c.id)) && (
          <button type="button" className="wso-act" onClick={() => void dismissAll(open)}>Not now</button>
        )}
      </ReviewItemCard>,
    );
  }

  if (search || jobs.length) {
    const s = search ?? jobs[0];
    cards.push(
      <ReviewItemCard key="jobs" labelId="wso-i-jobs" icon={<Briefcase aria-hidden />}
        title={search ? search.title : "Jobs that match you"}
        meta={jobs.length ? jobs.map((j) => j.title).join(" · ") : "We'll look for new work that fits your skills."}
        tag={search ? <PrivateTag>Private search · only you</PrivateTag> : undefined} reason={s.reason}
        done={search?.state === "removed" ? "Removed. You can search for work any time." : undefined}>
        <Link className="wso-act is-primary" href="/app/opportunities">See jobs</Link>
        {search && <button type="button" className="wso-act" disabled={busy[search.key]} onClick={() => act(search, "remove", "Job search removed")}>Remove</button>}
      </ReviewItemCard>,
    );
  }

  goals.forEach((g) => cards.push(
    <ReviewItemCard key={g.key} labelId={`wso-i-${g.key}`} icon={<Target aria-hidden />} title={g.title}
      meta="A goal for you" tag={<Tag>Only if you keep it</Tag>} reason={g.reason}
      done={g.state === "kept" ? "Kept. It's in your Goals." : g.state === "removed" ? "Removed." : undefined}>
      <button type="button" className="wso-act is-primary" disabled={busy[g.key]} onClick={() => act(g, "keep", "Goal kept")}>Keep</button>
      <button type="button" className="wso-act" disabled={busy[g.key]} onClick={() => act(g, "remove", "Goal removed")}>Remove</button>
    </ReviewItemCard>,
  ));

  if (reminder) {
    const at = clock(reminder.proposal?.local_time);
    const weekly = (reminder.proposal?.days ?? []).length > 0;
    cards.push(
      <ReviewItemCard key={reminder.key} labelId={`wso-i-${reminder.key}`} icon={<Bell aria-hidden />}
        title={at ? `Reminder at ${at}?` : reminder.title}
        meta={`${weekly ? "On Saturdays" : "Once a day"}, a discreet message`}
        tag={<Tag>Off until you turn it on</Tag>} reason={reminder.reason}
        done={reminder.state === "kept" ? (reminder.enabled ? `On. We'll remind you at ${at || "your time"}.` : "Off. Turn it on any time in Reminders.")
          : reminder.state === "removed" ? "Removed." : undefined}>
        <button type="button" className="wso-act is-primary" disabled={busy[reminder.key]} onClick={() => act(reminder, "on", "Reminder on")}>Turn on</button>
        <button type="button" className="wso-act" disabled={busy[reminder.key]} onClick={() => act(reminder, "off", "Reminder stays off")}>No thanks</button>
      </ReviewItemCard>,
    );
  }

  return (
    <div id="wso-say" className="wso-stack">
      <h1 id="wso-q" className="wso-q" tabIndex={-1}>Here&apos;s what we prepared</h1>
      <p className="wso-sub">Keep what you like. Nothing is public until you say so.</p>
      {cards.length ? <div className="wso-review">{cards}</div> : (
        <div className="wso-card">
          <p className="wso-sub">Nothing needed preparing from your answers. Your home is ready, and you can change your answers in Settings any time.</p>
        </div>
      )}
      {welcome && circles.length > 0 && (
        <p className="wso-small wso-welcome-line"><Sparkles aria-hidden />You&apos;re in the {welcome.title} space. Only the WomSakhi team posts there.</p>
      )}
    </div>
  );
}

// ── circle sheet ───────────────────────────────────────────────────────────

export function CircleSheet({ item, onClose, onJoined, preview, previewInfo }: {
  item: PreparedItem; onClose: () => void; onJoined: (id: string) => void; preview: boolean;
  previewInfo?: CircleInfo;
}) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<CircleInfo | null>(null);
  const [joining, setJoining] = useState(false);
  useDialogFocus(ref, true, onClose);

  useEffect(() => {
    let alive = true;
    if (AUTH_PREVIEW && preview) {
      const t = window.setTimeout(() => setInfo(previewInfo ?? null));
      return () => window.clearTimeout(t);
    }
    apiCircleInfo(item.id).then((c) => { if (alive) setInfo(c); }).catch(() => {});
    return () => { alive = false; };
  }, [item.id, preview, previewInfo]);

  async function join() {
    setJoining(true);
    try {
      if (!(AUTH_PREVIEW && preview)) await apiJoinSuggestedCircle(item.id);
      onJoined(item.id);
      toast.success(`You joined ${item.title}`);
      onClose();
    } catch (e) {
      toast.error(authError(e, "We couldn't join you just now. Please try again.").message);
    } finally {
      setJoining(false);
    }
  }

  const meta = info
    ? `${info.is_private ? "Private" : "Public"} circle · ${info.member_count} ${info.member_count === 1 ? "woman" : "women"}`
    : "Public circle";

  return (
    <div className="wso-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="wso-sheet" role="dialog" aria-modal="true" aria-labelledby="wso-sheet-t">
        <span className="wso-grab" aria-hidden />
        <div className="wso-banner is-sheet"><Art name="circle" sizes="(min-width: 640px) 480px, 100vw" /></div>
        <h2 id="wso-sheet-t" className="wso-h2" tabIndex={-1}>{item.title}</h2>
        <p className="wso-small">{meta}</p>
        {info?.desc && <p className="wso-sub">{info.desc}</p>}
        <div className="wso-card">
          <p className="wso-label">When you join</p>
          <ul className="wso-setup-list is-static">
            <li className="is-done"><i aria-hidden><Check strokeWidth={3.2} /></i><span>Members see your first name and photo</span></li>
            <li className="is-done"><i aria-hidden><Check strokeWidth={3.2} /></i><span>Your phone number stays hidden</span></li>
            <li className="is-done"><i aria-hidden><Check strokeWidth={3.2} /></i><span>Updates arrive as a daily summary</span></li>
          </ul>
        </div>
        <div className="wso-sheet-acts">
          <button type="button" className="wso-btn wso-go" onClick={join} disabled={joining} aria-busy={joining || undefined}>Join circle</button>
          <button type="button" className="wso-btn wso-ghost" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  );
}

// ── helper hand-back ───────────────────────────────────────────────────────

export function HandBack({ onContinue }: { onContinue: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  return (
    <div ref={ref} className="wso-handback" role="dialog" aria-modal="true" aria-labelledby="wso-hb-t" aria-describedby="wso-hb-s">
      <div className="wso-handback-in">
        <div className="wso-round is-light"><Art name="privacy" sizes="160px" decorative pos="46% 26%" /></div>
        <h2 id="wso-hb-t" className="wso-hb-t" tabIndex={-1}>Please give the phone back to her now</h2>
        <p id="wso-hb-s" className="wso-hb-s">Now it&apos;s just for you. The next part is private.</p>
        <button type="button" className="wso-btn wso-light" onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, BellOff, Check, Home, Lock, Moon, Plus, Search, Sparkles, Sun, Sunrise, Users, Volume2, X } from "lucide-react";

import { apiFindSkills, type Answers, type Skill, type SkillValue } from "@/lib/onboarding-api";
import { websiteUrl } from "@/lib/site";
import { Art } from "./art";
import { Busy, ChoiceCard, PictureTile, Pill, SakhiAvatar, ToggleRow } from "./primitives";
import { FREE_TIMES, GOALS, LEARN_TOPICS, MAX_SKILLS, MEET, MINUTES } from "./vocab";

/** The element each step's Listen button reads. */
export const SAY_ID = "wso-say";

/** The question, focusable so a screen reader lands on it when the step changes. */
function Question({ children }: { children: ReactNode }) {
  return <h1 id="wso-q" className="wso-q" tabIndex={-1}>{children}</h1>;
}

function toggle<T>(list: T[] | null | undefined, v: T): T[] {
  const l = list ?? [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

// ── Q0 · welcome and consent ───────────────────────────────────────────────

export interface ConsentDraft { jobs: boolean; employers: boolean }

export function WelcomeStep({ listen, consent, setConsent, error }: {
  listen: ReactNode; consent: ConsentDraft; setConsent: (c: ConsentDraft) => void; error?: string;
}) {
  const jobsId = useId();
  const empId = useId();
  return (
    <div id={SAY_ID} className="wso-stack">
      <div className="wso-row"><SakhiAvatar />{listen}</div>
      <Question>Hi, I&apos;m Sakhi. Let&apos;s make WomSakhi yours.</Question>
      <p className="wso-sub">
        I&apos;ll ask a few quick things so your home shows what you need. You can skip anything, and change or delete your answers any time.
      </p>
      <ul className="wso-why-list" aria-label="What we ask and why">
        <li><i aria-hidden /><span><b>What you want to do</b> · to show it first</span></li>
        <li><i aria-hidden /><span><b>Your skills</b> · to prepare a private draft</span></li>
        <li><i aria-hidden /><span><b>When you&apos;re free</b> · to suggest a reminder time</span></li>
      </ul>
      <fieldset className="wso-consents">
        <legend>You choose (optional) · change any time</legend>
        <label className="wso-consent" htmlFor={jobsId}>
          <input id={jobsId} type="checkbox" className="wso-cb" checked={consent.jobs}
                 onChange={(e) => setConsent({ jobs: e.target.checked, employers: e.target.checked ? consent.employers : false })} />
          <span className="wso-cb-box" aria-hidden><Check strokeWidth={3.2} /></span>
          <span className="wso-consent-text">Keep my details and tell me about jobs and work that match me, even if my account isn&apos;t approved</span>
        </label>
        <label className={`wso-consent${consent.jobs ? "" : " is-off"}`} htmlFor={empId}>
          <input id={empId} type="checkbox" className="wso-cb" checked={consent.employers} disabled={!consent.jobs}
                 aria-describedby={consent.jobs ? undefined : `${empId}-why`}
                 onChange={(e) => setConsent({ ...consent, employers: e.target.checked })} />
          <span className="wso-cb-box" aria-hidden><Check strokeWidth={3.2} /></span>
          <span className="wso-consent-text">
            Let employers see my work profile (name, skills, city). My number only when I say yes to a job
            {!consent.jobs && <small id={`${empId}-why`}>Tick the first box to choose this.</small>}
          </span>
        </label>
      </fieldset>
      <p className="wso-policy">
        Full policy:{" "}
        <a href={websiteUrl("/privacy")} target="_blank" rel="noopener noreferrer">
          womsakhi.com<ArrowUpRight aria-hidden /><span className="sr-only"> (opens the WomSakhi website in a new tab)</span>
        </a>
      </p>
      {error && <p className="wso-err" role="alert">{error}</p>}
    </div>
  );
}

// ── Q1 · how to talk to her ────────────────────────────────────────────────

export function LanguageStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>How should I talk to you?</Question>
      <div className="wso-pills" role="group" aria-label="Language">
        <Pill pressed onClick={() => {}}>English</Pill>
      </div>
      <p className="wso-small"><span lang="te">తెలుగు</span> and <span lang="hi">हिंदी</span> are coming soon. We&apos;ll ask you once they&apos;re ready.</p>
      <ToggleRow icon={<Volume2 aria-hidden />} title="Read questions aloud" desc="Sakhi speaks each question"
                 checked={answers.voice_prompts === true} onChange={(v) => patch({ voice_prompts: v })} />
      <ToggleRow icon={<Users aria-hidden />} title="Someone is helping me" desc="We'll hand the phone back to you before anything private"
                 checked={answers.helper_mode === true} onChange={(v) => patch({ helper_mode: v })} />
    </div>
  );
}

// ── Q2 · what brings her here ──────────────────────────────────────────────

export function GoalsStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  const goals = answers.goals ?? [];
  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>What brings you to WomSakhi?</Question>
      <p className="wso-sub">Pick as many as you like.</p>
      <div className="wso-tiles is-goals" role="group" aria-labelledby="wso-q">
        {GOALS.map((g) => (
          <PictureTile key={g.key} art={g.art} label={g.label} pressed={goals.includes(g.key)}
                       onClick={() => {
                         // "Just looking around" stands alone; any real goal replaces it.
                         if (g.key === "just_looking") patch({ goals: goals.includes("just_looking") ? [] : ["just_looking"] });
                         else patch({ goals: toggle(goals.filter((x) => x !== "just_looking"), g.key) });
                       }} />
        ))}
      </div>
    </div>
  );
}

// ── Q3 · skills ────────────────────────────────────────────────────────────

/** A skill she types: the server's rule (app/core/onboarding.py `clean_custom_skill`), said at the field. */
const LINKISH = /(https?:|www\.|:\/\/|@|\b[\w-]+\.(com|in|org|net|co|io|me|app|xyz)\b)/i;
const customSkill = z.object({
  skill: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z.string()
        .min(2, "Type a skill of at least 2 letters")
        .max(40, "Keep it under 40 characters")
        .refine((v) => !LINKISH.test(v), "A skill can't be a link or an address")
        .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} &\-'’./,()+]*$/u, "Use letters only — no symbols")
        .refine((v) => (v.match(/\p{L}/gu) ?? []).length >= 2, "A skill needs words, not only numbers"),
    ),
});

export const skillKey = (s: SkillValue) => (typeof s === "string" ? s : `custom:${s.custom.toLocaleLowerCase()}`);

export function labelOfSkill(s: SkillValue, labels: Record<string, string>): string {
  if (typeof s !== "string") return s.custom;
  if (labels[s]) return labels[s];
  const text = s.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function SkillsStep({ listen, answers, patch, labels, learnLabels, preview }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
  labels: Record<string, string>; learnLabels: (skills: Skill[]) => void;
  /** Local preview: search this list instead of the API. */
  preview: Skill[] | null;
}) {
  const picked = useMemo(() => answers.skills ?? [], [answers.skills]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Skill[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const full = picked.length >= MAX_SKILLS;
  const addRef = useRef<HTMLInputElement | null>(null);
  const learnRef = useRef(learnLabels);
  useEffect(() => { learnRef.current = learnLabels; });

  // Debounced search; the answer to an older query never replaces a newer one.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        let found: Skill[];
        if (preview) {
          const needle = q.trim().toLocaleLowerCase();
          found = preview.filter((s) => !needle || s.label.toLocaleLowerCase().includes(needle)).slice(0, 20);
        } else {
          found = await apiFindSkills(q.trim(), ctrl.signal);
        }
        if (ctrl.signal.aborted) return;
        setResults(found);
        learnRef.current(found);
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, q ? 250 : 0);
    return () => { ctrl.abort(); window.clearTimeout(t); };
  }, [q, preview, attempt]);

  const pickedKeys = new Set(picked.map(skillKey));
  const choose = (s: SkillValue) => {
    const k = skillKey(s);
    if (pickedKeys.has(k)) patch({ skills: picked.filter((x) => skillKey(x) !== k) });
    else if (!full) patch({ skills: [...picked, s] });
  };

  const form = useForm({ resolver: zodResolver(customSkill), mode: "onSubmit", reValidateMode: "onChange", defaultValues: { skill: "" } });
  const addErr = form.formState.errors.skill?.message;
  const submitCustom = form.handleSubmit(({ skill }) => {
    const known = results?.find((r) => r.label.toLocaleLowerCase() === skill.toLocaleLowerCase());
    const value: SkillValue = known ? known.key : { custom: skill };
    if (!pickedKeys.has(skillKey(value)) && !full) patch({ skills: [...picked, value] });
    form.reset({ skill: "" });
    setAdding(false);
  });
  const { ref: fieldRef, ...field } = form.register("skill");

  const others = (results ?? []).filter((s) => !pickedKeys.has(s.key));
  const heading = q.trim() ? `Matches for “${q.trim()}”` : "Popular with women here";

  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>What can you do?</Question>
      <p className="wso-sub">Pick any, or search. Your draft stays private until you publish.</p>
      <div className="wso-search">
        <Search aria-hidden />
        <label htmlFor="wso-skill-q" className="sr-only">Search skills</label>
        <input id="wso-skill-q" type="search" inputMode="search" enterKeyHint="search" autoComplete="off"
               placeholder="Search: embroidery, tuition, cake…" value={q} maxLength={40}
               aria-controls="wso-skill-list" onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" className="wso-search-x" onClick={() => setQ("")}><X aria-hidden /><span className="sr-only">Clear search</span></button>}
      </div>

      {picked.length > 0 && (
        <div className="wso-group">
          <p className="wso-label">Your skills <span className="wso-count">{picked.length} of {MAX_SKILLS}</span></p>
          <div className="wso-pills" role="group" aria-label="Your skills">
            {picked.map((s) => (
              <Pill key={skillKey(s)} pressed onClick={() => choose(s)}>{labelOfSkill(s, labels)}</Pill>
            ))}
          </div>
        </div>
      )}

      <div className="wso-group" id="wso-skill-list" aria-busy={searching || undefined}>
        <p className="wso-label" aria-live="polite">{heading}{searching && <Busy />}</p>
        {failed ? (
          <p className="wso-err" role="alert">
            We couldn&apos;t search just now.{" "}
            <button type="button" className="wso-inline" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </p>
        ) : (
          <div className="wso-pills" role="group" aria-label={heading}>
            {others.map((s) => (
              <Pill key={s.key} pressed={false} disabled={full} onClick={() => choose(s.key)}>{s.label}</Pill>
            ))}
            {!adding && (
              <Pill pressed={false} dashed disabled={full} onClick={() => {
                setAdding(true);
                if (q.trim() && !others.length) form.setValue("skill", q.trim());
                window.setTimeout(() => addRef.current?.focus(), 30);
              }}>
                <Plus aria-hidden className="wso-pill-plus" />Add your own
              </Pill>
            )}
          </div>
        )}
        {results && !failed && !others.length && q.trim() && (
          <p className="wso-small">No match yet. Add it as your own skill.</p>
        )}
        {full && <p className="wso-small" role="status">You&apos;ve picked {MAX_SKILLS}. Remove one to choose another.</p>}
      </div>

      {adding && (
        <form className="wso-add" onSubmit={submitCustom} noValidate>
          <label htmlFor="wso-skill-own" className="wso-label">Your own skill</label>
          <div className={`wso-add-row${addErr ? " is-bad" : ""}`}>
            <input id="wso-skill-own" type="text" autoComplete="off" maxLength={60} placeholder="For example: Kalamkari painting"
                   aria-invalid={addErr ? true : undefined} aria-describedby={addErr ? "wso-skill-own-err" : undefined}
                   {...field} ref={(el) => { fieldRef(el); addRef.current = el; }} />
            <button type="submit" className="wso-btn wso-soft">Add</button>
          </div>
          {addErr && <p id="wso-skill-own-err" className="wso-ferr" role="alert">{addErr}</p>}
          <button type="button" className="wso-inline wso-add-cancel" onClick={() => { setAdding(false); form.reset({ skill: "" }); }}>Cancel</button>
        </form>
      )}
    </div>
  );
}

// ── Q4 · learn, or meet ────────────────────────────────────────────────────

export function LearnStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  const topics = answers.learn_topics ?? [];
  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>What would you like to learn?</Question>
      <p className="wso-sub">Pick any.</p>
      <div className="wso-pills" role="group" aria-labelledby="wso-q">
        {LEARN_TOPICS.map((t) => (
          <Pill key={t.key} pressed={topics.includes(t.key)} onClick={() => patch({ learn_topics: toggle(topics, t.key) })}>{t.label}</Pill>
        ))}
      </div>
      <div className="wso-note">
        <span className="wso-ic"><Sparkles aria-hidden /></span>
        <span><b>We&apos;ll suggest 3 short lessons</b><small>You choose which to start. Nothing is marked done for you.</small></span>
      </div>
    </div>
  );
}

export function MeetStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  const meet = answers.meet ?? [];
  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>Who would you like to meet?</Question>
      <p className="wso-sub">Pick any.</p>
      <div className="wso-pills" role="group" aria-labelledby="wso-q">
        {MEET.map((m) => (
          <Pill key={m.key} pressed={meet.includes(m.key)} onClick={() => patch({ meet: toggle(meet, m.key) })}>{m.label}</Pill>
        ))}
      </div>
      <div className="wso-note">
        <span className="wso-ic"><Users aria-hidden /></span>
        <span><b>We&apos;ll suggest 3 circles</b><small>You see who&apos;s there first. You join only if you want to.</small></span>
      </div>
    </div>
  );
}

// ── Q5 · her time ──────────────────────────────────────────────────────────

const TIME_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon, weekends: Home } as const;

export function TimeStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  const times = answers.free_times ?? [];
  return (
    <div id={SAY_ID} className="wso-stack">
      {listen}
      <Question>When are you usually free?</Question>
      <div className="wso-tiles is-times" role="group" aria-labelledby="wso-q">
        {FREE_TIMES.map((t) => {
          const Icon = TIME_ICON[t.key];
          return <PictureTile key={t.key} icon={<Icon aria-hidden />} label={t.label} pressed={times.includes(t.key)}
                              onClick={() => patch({ free_times: toggle(times, t.key) })} />;
        })}
      </div>
      <p className="wso-label" id="wso-minutes">How much time a day?</p>
      <div className="wso-pills" role="group" aria-labelledby="wso-minutes">
        {MINUTES.map((m) => (
          <Pill key={m} pressed={answers.minutes_per_day === m}
                onClick={() => patch({ minutes_per_day: answers.minutes_per_day === m ? null : m })}>{m} min</Pill>
        ))}
      </div>
      <p className="wso-small">Nothing is switched on here. We&apos;ll only suggest a reminder time.</p>
    </div>
  );
}

// ── Q6 · shared phone ──────────────────────────────────────────────────────

export function PhoneStep({ listen, answers, patch }: {
  listen: ReactNode; answers: Answers; patch: (p: Partial<Answers>) => void;
}) {
  return (
    <div id={SAY_ID} className="wso-stack">
      <div className="wso-banner"><Art name="privacy" sizes="(min-width: 640px) 560px, 100vw" /></div>
      {listen}
      <Question>Do others use this phone?</Question>
      <p className="wso-sub">It&apos;s up to you, and you don&apos;t have to say why.</p>
      <div className="wso-choices" role="radiogroup" aria-labelledby="wso-q">
        <ChoiceCard checked={answers.shared_phone === true} onSelect={() => patch({ shared_phone: true })}
                    icon={<BellOff aria-hidden />} title="Yes, others use it"
                    desc="We'll remember this and keep things discreet for you." />
        <ChoiceCard checked={answers.shared_phone === false} onSelect={() => patch({ shared_phone: false })}
                    icon={<Lock aria-hidden />} title="No, just me" />
      </div>
      <div className="wso-note is-quiet">
        <span className="wso-ic"><Lock aria-hidden /></span>
        <span><b>Coming soon for shared phones</b><small>A 4-digit PIN so only you can open WomSakhi, and notifications that only say “You have a new message”. We&apos;ll offer them when they&apos;re ready.</small></span>
      </div>
    </div>
  );
}

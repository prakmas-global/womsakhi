"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useToast } from "@/design-system";
import { IconTile, Pill } from "@/components/ux/kit";
import { SettingsPage } from "@/components/ux/settings/Frame";
import { Group } from "../_parts/Group";
import { Intro, LoadFailed, LoadingRows, PrimaryButton, QuietButton } from "../_parts/personal";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";
import {
  apiFindSkills, apiOnboardingState, apiPreparedItems, apiRunSetup, changeHref,
  GOAL_LABELS, MEET_LABELS, TIME_LABELS, TOPIC_LABELS,
  type OnboardingAnswers, type OnboardingState, type PreparedItem, type Question, type SkillAnswer,
} from "@/lib/personal-api";

/**
 * Settings → My answers.
 *
 * Every answer she gave, each with an Edit link to that one question; what we
 * prepared from them and where each thing stands; and a way to prepare again
 * after she changes her mind — which adds what is new and never duplicates or
 * deletes (the server's rule, `prepare()` in app/core/onboarding.py).
 *
 * An answer she skipped says "Skipped", and a question she has not reached
 * says "Not answered yet". Neither is guessed.
 */

const QUESTIONS: { key: Question; label: string }[] = [
  { key: "goals", label: "What brings you to WomSakhi" },
  { key: "skills", label: "What you can do" },
  { key: "learn_topics", label: "What you'd like to learn" },
  { key: "meet", label: "Who you'd like to meet" },
  { key: "free_times", label: "When you're usually free" },
  { key: "minutes_per_day", label: "Time a day" },
  { key: "voice_prompts", label: "Read questions aloud" },
  { key: "helper_mode", label: "Someone is helping me" },
  { key: "shared_phone", label: "Others use this phone" },
];

type Loaded = { state: OnboardingState; items: PreparedItem[]; skillNames: Record<string, string> };

/** Her skill keys as she saw them in the picker. Unknown keys fall back to readable words. */
async function skillNamesFor(skills: SkillAnswer[] | null, signal: AbortSignal) {
  const keys = (skills ?? []).filter((s): s is string => typeof s === "string");
  const names: Record<string, string> = {};
  await Promise.all(keys.map(async (k) => {
    try {
      const found = await apiFindSkills(k.replace(/_/g, " "), signal);
      const hit = found.find((f) => f.key === k);
      if (hit) names[k] = hit.label;
    } catch { /* a readable fallback below */ }
  }));
  return names;
}

function answerText(key: Question, a: OnboardingAnswers, names: Record<string, string>): string {
  const list = (xs: string[] | null, labels: Record<string, string>) =>
    (xs ?? []).map((x) => labels[x] ?? x).join(", ");
  switch (key) {
    case "goals": return list(a.goals, GOAL_LABELS);
    case "skills": return (a.skills ?? []).map((s) =>
      typeof s === "string" ? names[s] ?? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : s.custom).join(", ");
    case "learn_topics": return list(a.learn_topics, TOPIC_LABELS);
    case "meet": return list(a.meet, MEET_LABELS);
    case "free_times": return list(a.free_times, TIME_LABELS);
    case "minutes_per_day": return a.minutes_per_day ? `${a.minutes_per_day} minutes` : "";
    case "voice_prompts": case "helper_mode": return a[key] === null ? "" : a[key] ? "On" : "Off";
    case "shared_phone": return a.shared_phone === null ? "" : a.shared_phone ? "Yes" : "No, just me";
  }
}

const TYPE_LOOK: Record<string, { icon: string; tint: string; ink: string; noun: string }> = {
  listing:      { icon: "Store", tint: "--ux-tint-amber", ink: "--ux-amber-ink", noun: "Your service draft" },
  saved_search: { icon: "Search", tint: "--ux-tint-blue", ink: "--ux-blue-ink", noun: "Saved job search" },
  goal:         { icon: "Target", tint: "--ux-tint-green", ink: "--ux-green-ink", noun: "Goal" },
  reminder:     { icon: "AlarmClock", tint: "--ux-tint-violet", ink: "--ux-violet-ink", noun: "Reminder" },
  programme:    { icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet-ink", noun: "Suggested course" },
  opportunity:  { icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue-ink", noun: "Suggested job" },
  circle:       { icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink-ink", noun: "Suggested circle" },
  welcome:      { icon: "Home", tint: "--ux-tint-pink", ink: "--ux-pink-ink", noun: "Welcome space" },
};

/** What each state means to her, in words. */
const STATE_WORDS: Record<string, { text: string; tone: "brand" | "green" | "neutral" | "blue" | "orange" }> = {
  draft: { text: "Draft · only you can see it", tone: "orange" },
  saved: { text: "Saved · only you", tone: "blue" },
  proposed: { text: "Waiting for your yes", tone: "brand" },
  kept: { text: "Yours", tone: "green" },
  suggested: { text: "Suggestion", tone: "blue" },
  joined: { text: "Joined · read-only", tone: "green" },
  removed: { text: "Removed", tone: "neutral" },
  dismissed: { text: "Put aside", tone: "neutral" },
};

function whereItLives(i: PreparedItem): string | null {
  switch (i.type) {
    case "listing": return "/app/shop";
    case "saved_search": return "/app/opportunities";
    case "goal": return "/app/goals";
    case "reminder": return "/app/reminders";
    case "programme": return `/app/programs/${i.id}`;
    case "opportunity": return `/app/opportunities/${i.id}`;
    case "circle": case "welcome": return `/app/circles/${i.id}`;
    default: return null;
  }
}

function ItemRow({ item, fresh }: { item: PreparedItem; fresh?: boolean }) {
  const look = TYPE_LOOK[item.type] ?? TYPE_LOOK.goal;
  const words = STATE_WORDS[item.state] ?? { text: item.state, tone: "neutral" as const };
  const href = item.state === "removed" || item.state === "dismissed" ? null : whereItLives(item);
  const body = (
    <>
      <IconTile icon={look.icon} tint={look.tint} ink={look.ink} size={40} radius={11} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>
          {look.noun}
        </span>
        <span className="mt-0.5 block text-[15px] font-semibold leading-snug lg:text-sm" style={{ color: "var(--ux-ink)" }}>
          {item.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {fresh && <Pill tone="green" size="sm">New</Pill>}
          <Pill tone={words.tone} size="sm">{words.text}</Pill>
        </span>
        {item.reason && (
          <span className="mt-1 block text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
            {item.reason}
            {!item.still_chosen && " — from an earlier answer, kept for you"}
          </span>
        )}
      </span>
      {href && <Icons.ChevronRight aria-hidden className="mt-3 h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="ux-row -mx-2 flex min-h-[44px] items-start gap-3 rounded-[12px] px-2 py-3">{body}</Link>
      ) : (
        <div className="flex items-start gap-3 py-3">{body}</div>
      )}
    </li>
  );
}

export default function MyAnswersPage() {
  const toast = useToast();
  const { data, source, refetch } = useResource<Loaded | null>(
    useCallback(async (s: AbortSignal) => {
      const [state, items] = await Promise.all([apiOnboardingState(s), apiPreparedItems(s)]);
      return { state, items, skillNames: await skillNamesFor(state.answers.skills, s) };
    }, []),
    null,
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ fresh: PreparedItem[] } | null>(null);
  const [setupError, setSetupError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const runSetup = async () => {
    if (!data) return;
    setRunning(true);
    setSetupError("");
    const before = new Set(data.items.map((i) => i.key));
    try {
      const out = await apiRunSetup();
      const fresh = out.items.filter((i) => !before.has(i.key));
      setResult({ fresh });
      toast.success(fresh.length ? `${fresh.length} new ${fresh.length === 1 ? "thing" : "things"} prepared` : "Nothing new to prepare",
        { description: fresh.length ? "Everything is private until you choose." : "Everything your answers call for is already here." });
      refetch();
      window.setTimeout(() => resultRef.current?.focus(), 50);
    } catch (e) {
      setSetupError(messageFrom(e, "That did not go through. Nothing was changed — try again in a moment."));
    } finally {
      setRunning(false);
    }
  };

  if (!data) {
    return (
      <SettingsPage title="My answers" sub="What you told us, and what we prepared from it.">
        {source === "loading" ? <LoadingRows label="Loading your answers" rows={6} />
          : <LoadFailed what="your answers" onRetry={refetch} />}
      </SettingsPage>
    );
  }

  const { state, items, skillNames } = data;
  const a = state.answers;
  const answered = new Set(state.answered);
  const hasAny = QUESTIONS.some((q) => answerText(q.key, a, skillNames));
  const freshKeys = new Set(result?.fresh.map((i) => i.key) ?? []);
  const setupConsent = state.consents.setup.granted;

  return (
    <SettingsPage title="My answers" sub="What you told us, and what we prepared from it.">
      <Intro image="/ux/onboarding/setup-480.webp">
        Your home follows these answers. Change any of them whenever your plans change — nothing you made is deleted when you do.
      </Intro>

      <Group title="Your answers" inset="flush"
             sub={hasAny ? undefined : "You haven't answered the questions yet."}>
        {!hasAny && (
          <div className="flex flex-col items-start gap-3 p-4 lg:p-0 lg:pb-1">
            <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
              A few quick taps and your home shows what you need first. You can skip any question.
            </p>
            <QuietButton href="/app/onboarding">Answer the questions</QuietButton>
          </div>
        )}
        {hasAny && (
          <ul className="divide-y lg:-my-1" style={{ borderColor: "var(--ux-line)" }}>
            {QUESTIONS.map((q) => {
              const text = answerText(q.key, a, skillNames);
              const status = text || (answered.has(q.key) ? "Skipped" : "Not answered yet");
              return (
                <li key={q.key} className="flex items-center gap-3 px-4 py-2.5 lg:px-0" style={{ borderColor: "var(--ux-line)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>{q.label}</p>
                    <p className="mt-0.5 break-words text-[15px] font-semibold leading-snug lg:text-sm"
                       style={{ color: text ? "var(--ux-ink)" : "var(--ux-muted)", fontStyle: text ? undefined : "italic" }}>
                      {status}
                    </p>
                  </div>
                  <Link href={changeHref(q.key, "/app/settings/answers")} aria-label={`Edit: ${q.label}`}
                        className="ux-hov inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-semibold lg:text-xsm"
                        style={{ color: "var(--ux-brand)" }}>
                    <Icons.Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Group>

      <Group title="What we prepared for you" inset="form"
             sub="Drafts stay private, and suggestions wait for you. Nothing is published, joined or applied for without your tap."
             chip={items.length ? String(items.length) : undefined}>
        {items.length === 0 ? (
          <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-muted)" }}>
            {state.setup.ready
              ? "Nothing yet. Use the button below to prepare things from your answers."
              : "Nothing yet. Things are prepared once your account is approved."}
          </p>
        ) : (
          <ul className="-my-1 divide-y" style={{ borderColor: "var(--ux-line)" }}>
            {items.map((i) => <ItemRow key={i.key} item={i} fresh={freshKeys.has(i.key)} />)}
          </ul>
        )}
      </Group>

      <Group title="Changed your answers?" inset="form">
        <p className="text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
          We&apos;ll prepare anything new your answers call for. Nothing is made twice, and nothing you have is removed.
        </p>
        {!state.setup.ready && (
          <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
            <Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {setupConsent !== true
              ? <span>You haven&apos;t said yes to using your answers to set up your WomSakhi. <Link href="/app/onboarding" className="font-semibold underline" style={{ color: "var(--ux-brand)" }}>Open the questions</Link> to say yes.</span>
              : "This opens once your account is approved."}
          </p>
        )}
        <div className="mt-3.5">
          <PrimaryButton onClick={() => void runSetup()} busy={running} disabled={!state.setup.ready} icon="Sparkles">
            {running ? "Preparing…" : "Set up again with my new answers"}
          </PrimaryButton>
        </div>
        {setupError && <p role="alert" className="mt-2.5 text-[13px] lg:text-xs" style={{ color: "var(--ux-danger-ink)" }}>{setupError}</p>}
        {result && (
          <div ref={resultRef} tabIndex={-1} role="status" className="mt-3.5 rounded-[12px] p-3.5 outline-none"
               style={{ background: result.fresh.length ? "var(--ux-tint-green)" : "var(--ux-surface-2)" }}>
            <p className="flex items-center gap-2 text-[15px] font-bold lg:text-sm" style={{ color: "var(--ux-ink)" }}>
              <Icons.CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--ux-green-ink)" }} aria-hidden />
              {result.fresh.length
                ? `New from your answers: ${result.fresh.length}`
                : "Nothing new — everything your answers call for is already here."}
            </p>
            {result.fresh.length > 0 && (
              <ul className="mt-1.5 list-disc ps-6 text-[14px] leading-snug lg:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                {result.fresh.map((i) => <li key={i.key}>{(TYPE_LOOK[i.type]?.noun ?? "Item")}: {i.title}</li>)}
              </ul>
            )}
          </div>
        )}
      </Group>

      <p className="px-4 text-[13px] leading-snug lg:px-0 lg:text-xs" style={{ color: "var(--ux-muted)" }}>
        Your choices about jobs, and deleting your answers, are in{" "}
        <Link href="/app/settings/data" className="-my-3 inline-flex min-h-[44px] items-center font-semibold underline" style={{ color: "var(--ux-brand)" }}>My data</Link>.
      </p>
    </SettingsPage>
  );
}

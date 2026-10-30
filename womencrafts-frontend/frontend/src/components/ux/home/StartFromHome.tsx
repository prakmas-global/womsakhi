"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { I } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { apiMyJourneys, type JourneyGoal, type MemberJourney } from "@/lib/journeys-api";

const KEY = "womsakhi.home.goal";
const EVENT = "womsakhi:home-goal";
let memory: JourneyGoal = "learn";
const valid = (value: string | null): value is JourneyGoal => value === "learn" || value === "sell" || value === "work";
const readGoal = (): JourneyGoal => { try { const linked = new URLSearchParams(window.location.search).get("goal"); if (valid(linked)) return linked; const saved = localStorage.getItem(KEY); return valid(saved) ? saved : memory; } catch { return memory; } };
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify); window.addEventListener(EVENT, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(EVENT, notify); };
};
const CHOICES = [{ id: "learn", label: "Learn a skill", icon: "BookOpen" }, { id: "sell", label: "Sell something", icon: "Store" }, { id: "work", label: "Work from home", icon: "Briefcase" }] as const;
const EMPTY: MemberJourney[] = [];
const FALLBACK: Record<JourneyGoal, { action: string; href: string; note: string }> = {
  learn: { action: "Find a free course", href: "/app/programs?price=free", note: "Choose a course, try a lesson and return whenever you have time." },
  sell: { action: "Set up my shop", href: "/app/documents/store#category", note: "Start with one product or service, then share your shop link." },
  work: { action: "Browse work from home", href: "/app/opportunities?where=Remote&view=all", note: "Browse first. Check the pay, skills and time before you apply." },
};

function chooseGoal(next: JourneyGoal) {
    memory = next;
    const url = new URL(window.location.href);
    if (url.searchParams.has("goal")) {
      url.searchParams.delete("goal");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    try { localStorage.setItem(KEY, next); } catch { /* Choice still works when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(EVENT));
}

export function StartFromHome() {
  const goal = useSyncExternalStore(subscribe, readGoal, () => "learn" as JourneyGoal);
  const { data, source, refetch } = useResource(useCallback((signal: AbortSignal) => apiMyJourneys(signal), []), EMPTY);
  const journey = data.find((item) => item.id === goal);
  const current = journey || FALLBACK[goal];

  return (
    <section data-home-pathways lang="en" aria-label="Your next step from home" className="scroll-mt-24 rounded-[20px] border p-4 sm:p-5"
      style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}>
      <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-brand)" }}><I name="Home" className="h-4 w-4" /> Your time. Your skills. Your choice.</p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight" style={{ color: "var(--ux-ink)" }}>One small step for yourself</h2>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ux-muted)" }}>Your work at home already matters. Choose what you want to do next.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose your goal">
        {CHOICES.map((item) => <button key={item.id} type="button" aria-pressed={item.id === goal} onClick={() => chooseGoal(item.id)}
          className="ux-press inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-bold"
          style={{ background: item.id === goal ? "var(--ux-brand)" : "var(--ux-surface-2)", color: item.id === goal ? "var(--ux-on-brand)" : "var(--ux-ink-2)", borderColor: item.id === goal ? "var(--ux-brand)" : "var(--ux-line)" }}><I name={item.icon} className="h-4 w-4" />{item.label}</button>)}
      </div>
      <p aria-live="polite" className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{current.note}</p>
      <Link href={current.href} data-journey-next className="ux-press mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"
        style={{ background: "var(--ux-brand)", color: "var(--ux-on-brand)" }}>{current.action}<I name="ArrowRight" className="h-4 w-4" /></Link>
      {journey && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold" style={{ color: "var(--ux-ink-2)" }}>See my three steps</summary><ol className="grid gap-2 sm:grid-cols-3" aria-label={`${journey.title} steps`}>
        {journey.steps.map((step, index) => <li key={step.id}>
          <Link href={step.href} className="ux-press flex h-full items-start gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ color: "var(--ux-brand)", background: "var(--ux-surface)" }}>{step.done ? <I name="Check" className="h-4 w-4" /> : index + 1}</span>
            <span className="min-w-0"><span className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{step.title}{step.done && <span className="sr-only"> — completed</span>}</span><span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{step.detail}</span></span>
          </Link>
        </li>)}
      </ol></details>}

      {source === "loading" && <p role="status" className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>Checking your saved progress… You can start now.</p>}
      {source === "error" && <p role="status" className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>Your progress could not load. These links still work. <button type="button" onClick={refetch} className="min-h-11 px-2 font-bold underline">Try again</button></p>}
      {goal === "work" && <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>Keep your OTP and UPI PIN private. Only accept work after checking its details.</p>}
    </section>
  );
}

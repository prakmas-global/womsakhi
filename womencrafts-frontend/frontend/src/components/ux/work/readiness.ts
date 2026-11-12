import type { ProfileSkill } from "@/lib/work-api";

/**
 * How ready her work profile is — one rule, read by My work profile and the
 * Work dashboard, so the two never show different numbers. (The dashboard
 * used to show her general profile's 100% beside a list of unticked work
 * tasks.) `to` is the section of My work profile that fixes the step.
 */

export interface Step { key: string; label: string; done: boolean; weight: number; to: string }

export function strengthOf(skills: Pick<ProfileSkill, "level" | "visible">[], workTypes: string[], days: string[], city: string): Step[] {
  return [
    { key: "skill", label: "Add the work you can do", done: skills.length > 0, weight: 20, to: "wp-add" },
    { key: "level", label: "Say how long for every skill", done: skills.length > 0 && skills.every((s) => s.level), weight: 20, to: "wp-skills" },
    { key: "shown", label: "Switch on at least one skill", done: skills.some((s) => s.visible), weight: 20, to: "wp-skills" },
    { key: "types", label: "Pick the kind of work", done: workTypes.length > 0, weight: 15, to: "wp-how" },
    { key: "days", label: "Say when you are free", done: days.length > 0, weight: 15, to: "wp-how" },
    { key: "city", label: "Add your city", done: !!city.trim(), weight: 10, to: "wp-how" },
  ];
}

export const readinessOf = (steps: Step[]) => steps.reduce((n, s) => n + (s.done ? s.weight : 0), 0);

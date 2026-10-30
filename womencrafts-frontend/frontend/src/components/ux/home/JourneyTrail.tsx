import Link from "next/link";
import type { JourneyGoal } from "@/lib/journeys-api";

const GUIDES = {
  learn: { title: "Learn a skill", note: "Choose a course → Try a lesson → Keep learning" },
  sell: { title: "Sell something", note: "Set up your shop → Add one listing → Share your link" },
  work: { title: "Work from home", note: "Add your skills → Find work → Check replies" },
} as const;

export function JourneyTrail({ goal }: { goal: JourneyGoal }) {
  const guide = GUIDES[goal];
  return <nav aria-label={`${guide.title} journey`} data-journey-trail className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
    style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
    <div><p className="text-xs font-bold" style={{ color: "var(--ux-brand)" }}>{guide.title}</p><p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{guide.note}</p></div>
    <Link href={`/app?goal=${goal}#start-from-home`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold underline" style={{ color: "var(--ux-brand)" }}>My next step</Link>
  </nav>;
}

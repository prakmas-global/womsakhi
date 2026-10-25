"use client";

import { useSyncExternalStore } from "react";
import { Btn } from "@/components/ux/kit";
import { HealthFrame, useEntries, useHealthSettings } from "@/components/ux/health/kit";
import { BedtimeTab, InsightsTab, LogTab, OverviewTab } from "@/components/ux/health/sleep/SleepTabs";

/**
 * Sleep — after the approved Health & Wellness design: a night hero, and
 * Overview, Sleep Log, Bedtime and Insights. Data is loaded once, above the
 * tabs: her nights (newest 500 entries) and her reminders, for the bedtime nudge.
 */
// Dates and times here are HER day (today's diary, the meal for this hour,
// weekday labels). The server renders in another time zone, so the body is
// drawn only in the browser — otherwise the two disagree and React re-renders.
const noop = () => () => {};
const useInBrowser = () => useSyncExternalStore(noop, () => true, () => false);

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Sleep Log" },
  { id: "bedtime", label: "Bedtime" },
  { id: "insights", label: "Insights" },
];

export default function SleepPage() {
  const store = useEntries(["sleep", "reminder"]);
  const s = useHealthSettings();
  const ready = useInBrowser();
  return (
    <HealthFrame night active="/app/health/sleep" hue="violet" icon="Moon" eyebrow="Rest better, live brighter"
                 title="Sleep" sub="Track your nights and build a calm bedtime routine."
                 art="/ux/art/scene-woman-meditating.webp" tabs={TABS}
                 actions={<>
                   <Btn size="sm" variant="on-brand" icon="Plus" href="/app/health/sleep?tab=log">Log sleep</Btn>
                   <Btn size="sm" variant="outline" icon="Bed" href="/app/health/sleep?tab=bedtime">Bedtime routine</Btn>
                 </>}>
      {(tab) => (
        !ready ? null
          : tab === "log" ? <LogTab store={store} />
          : tab === "bedtime" ? <BedtimeTab store={store} s={s} />
          : tab === "insights" ? <InsightsTab store={store} s={s} />
          : <OverviewTab store={store} s={s} />
      )}
    </HealthFrame>
  );
}

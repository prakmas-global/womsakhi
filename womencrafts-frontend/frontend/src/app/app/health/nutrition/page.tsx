"use client";

import { useSyncExternalStore } from "react";
import { Btn } from "@/components/ux/kit";
import { HealthFrame, useEntries, useHealthSettings } from "@/components/ux/health/kit";
import { FOOD_ART } from "@/components/ux/health/nutrition/data";
import { GoalsTab, InsightsTab, PlanTab, RecipesTab, TodayTab } from "@/components/ux/health/nutrition/NutritionTabs";
import { addDays, today } from "@/lib/health-api";

/**
 * Nutrition & Diet — after the approved Health & Wellness design.
 *
 * The data is loaded once here, above the tabs, so switching tab does not
 * fetch again: 30 days back (for Insights) and 7 ahead (for the meal plan).
 */
// Dates and times here are HER day (today's diary, the meal for this hour,
// weekday labels). The server renders in another time zone, so the body is
// drawn only in the browser — otherwise the two disagree and React re-renders.
const noop = () => () => {};
const useInBrowser = () => useSyncExternalStore(noop, () => true, () => false);

const TABS = [
  { id: "today", label: "Today" },
  { id: "plan", label: "Meal Plan" },
  { id: "recipes", label: "Recipes" },
  { id: "goals", label: "Goals" },
  { id: "insights", label: "Insights" },
];

export default function NutritionPage() {
  const store = useEntries(["meal", "plan", "water"], { from: addDays(today(), -31), to: addDays(today(), 8) });
  const s = useHealthSettings();
  const ready = useInBrowser();
  return (
    <HealthFrame active="/app/health/nutrition" hue="green" icon="Apple" eyebrow="Eat better, feel better"
                 title="Nutrition & Diet" sub="Eat better, feel better every day. Log meals and water in a tap, plan the week, and cook simple Indian recipes."
                 art={FOOD_ART[0]} tabs={TABS}
                 actions={<>
                   <Btn size="sm" icon="Plus" href="/app/health/nutrition#nt-log">Log a meal</Btn>
                   <Btn size="sm" variant="outline" icon="CalendarDays" href="/app/health/nutrition?tab=plan">Plan my week</Btn>
                 </>}>
      {(tab) => (
        !ready ? null
          : tab === "plan" ? <PlanTab store={store} s={s} />
          : tab === "recipes" ? <RecipesTab store={store} s={s} />
          : tab === "goals" ? <GoalsTab s={s} />
          : tab === "insights" ? <InsightsTab store={store} s={s} />
          : <TodayTab store={store} s={s} />
      )}
    </HealthFrame>
  );
}

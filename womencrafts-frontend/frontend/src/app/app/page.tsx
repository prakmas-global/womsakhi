"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Dashboard } from "@/components/ux/home/Dashboard";
import { HomeRail } from "@/components/ux/home/HomeRail";

/**
 * Home.
 *
 * `bare`, because the "complete your profile" footer belonged to the old
 * dashboard.
 *
 * The rail is back, carrying Upcoming Events, Your Balance, Your Progress and
 * My Circle Members as the approved design lays them out. The shell hides it
 * below `lg`, so every card in it also has a route reachable from the page
 * body — a phone must not lose a destination to a column it cannot see.
 */
export default function Home() {
  return (
    <HomeShell active="/app" bare rail={<HomeRail />}>
      <Dashboard />
    </HomeShell>
  );
}

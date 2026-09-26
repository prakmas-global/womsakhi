"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Dashboard } from "@/components/ux/home/Dashboard";
import { HomeRail } from "@/components/ux/home/HomeRail";
import { MobileHome } from "@/components/ux/home/MobileHome";

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
      <>
        <h1 className="hidden lg:block sr-only">WomSakhi home</h1>
        <MobileHome />
        {/* The desktop home keeps its hero — it is the right shape for a wide
            screen and the wrong one for a phone. See MobileHome for why this
            is two components rather than one restyled. */}
        <div className="hidden lg:block"><Dashboard /></div>
      </>
    </HomeShell>
  );
}

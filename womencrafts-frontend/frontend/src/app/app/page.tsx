"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  AskSakhiBar, Circles, ContinueJourney, Hero, Inspiration, MentorPick,
  Opportunities, ProfileCard, QuickActions, Recommended, Skills, Upcoming,
} from "@/components/ux/home/cards";
import { FirstRun } from "@/components/ux/home/firstrun";
import { MomentumStrip, Today } from "@/components/ux/home/today";

/**
 * Home — the member dashboard, redesigned.
 *
 * Content is mock for now, by agreement: see it working first, connect it
 * after. Every block reads from `components/ux/home/data.ts`, whose shapes
 * mirror what `/me/summary`, `/me/bookings` and `/catalog/*` already return —
 * so wiring it up later is a change of source, not of any component.
 *
 * Her real name comes from the session already, because a dashboard greeting
 * someone by the wrong name is worse than one greeting nobody.
 */
export default function MemberHomePage() {
  return (
    <Suspense fallback={<HomeShell active="/app"><div /></HomeShell>}>
      <MemberHome />
    </Suspense>
  );
}

function MemberHome() {
  const { user } = useAuth();
  const first = (user?.full_name || "").trim().split(" ")[0];

  /**
   * A new member gets a different screen, not an emptier one.
   *
   * The dashboard below assumes earnings, a streak and applications in flight.
   * On day one there are none, and rendering it anyway produces six cards of
   * zeroes. `?new=1` forces it while the data is still mock; when this is
   * wired up the condition becomes her real onboarding state.
   */
  const params = useSearchParams();
  const firstRun = params.get("new") === "1";

  if (firstRun) {
    // `bare`: the whole page is the profile prompt, so a second one in the
    // sidebar saying a different percentage is noise that contradicts it.
    return (
      <HomeShell active="/app" name={first || undefined} bare>
        <FirstRun name={first || undefined} />
      </HomeShell>
    );
  }

  return (
    <HomeShell
      active="/app"
      name={first || undefined}
      rail={
        <div className="space-y-[15px]">
          {/* Earnings used to sit here. It now says the same ₹24,350 as the
              Money panel at the top of the page, and a number printed twice on
              one screen is a number she has to check against itself. */}
          <ProfileCard />
          <Upcoming />
          <MentorPick />
          <Skills />
          <Inspiration />
        </div>
      }
    >
      <Hero name={first || undefined} />

      {/* Today comes before everything else on the page, and before the six
          shortcuts, because it is the only part that answers a question rather
          than offering a choice. */}
      <Today />
      <MomentumStrip />

      <div className="mt-[24px] mb-3 flex items-center gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ux-faint)" }}>
          Explore
        </h2>
        <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
      </div>

      <QuickActions />
      {/* Not a deck. Its children are cards, not rows — and the deck rule reaches
          descendants, so marking it here made hovering one circle dim every row in
          the Opportunities and Recommended cards too. Each list owns its own deck. */}
      <div className="mt-[18px] grid grid-cols-2 gap-[15px]">
        <ContinueJourney />
        <Recommended />
        <Opportunities />
        <Circles />
      </div>
      <div className="mt-[15px]"><AskSakhiBar /></div>
    </HomeShell>
  );
}

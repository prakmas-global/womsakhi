"use client";

import { ForYou } from "@/components/ux/cycle/ForYou";

/** Workouts — "For you today", opened on its own tab. See components/ux/cycle/ForYou.tsx. */
export default function Page() {
  return <ForYou initial="activity" title="Workouts" />;
}

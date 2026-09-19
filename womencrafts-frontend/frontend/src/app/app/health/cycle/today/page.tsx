"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ForYou } from "@/components/ux/cycle/ForYou";
import type { ForYouTab } from "@/components/ux/cycle/data";

const TABS: ForYouTab[] = ["food", "wellness", "mind", "activity"];

function Screen() {
  const tab = useSearchParams().get("tab") as ForYouTab | null;
  return <ForYou initial={tab && TABS.includes(tab) ? tab : "food"} />;
}

/** The tracker's "For you today". `?tab=` opens it on Wellness, Mind or Activity. */
export default function Page() {
  return <Suspense><Screen /></Suspense>;
}

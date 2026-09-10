import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenSkeleton } from "@/components/ux/kit";

/**
 * A section hub, while it loads.
 *
 * Its own file rather than `/app/loading.tsx`, which is now shaped like Home —
 * a hero, five figures and three panels — and which this screen is not. A hub
 * is a grid of destinations and carries no right-hand rail, so none is
 * reserved: the inherited skeleton held 344px open for a column that never
 * arrives, and the board slid sideways into the gap.
 */
export default function Loading() {
  return (
    <HomeShell skeleton="grid" bare>
      <ScreenSkeleton shape="grid" />
    </HomeShell>
  );
}

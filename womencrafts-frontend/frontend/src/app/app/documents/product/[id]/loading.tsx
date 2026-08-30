import { HomeShell } from "@/components/ux/home/HomeShell";
import { RailSkeleton, ScreenSkeleton } from "@/components/ux/kit";

/**
 * Shown while this route's code and data are on their way.
 *
 * Next renders this automatically in place of the page — no page changes, and
 * it appears on a real slow connection rather than only when forced.
 *
 * The rail is held open too. This screen renders one, and a skeleton that
 * leaves it out lays the content column out 345px wider than the screen it is
 * standing in for — so the page arrived and everything slid sideways.
 */
export default function Loading() {
  return (
    <HomeShell skeleton="form" rail={<RailSkeleton />}>
      <ScreenSkeleton shape="form" />
    </HomeShell>
  );
}

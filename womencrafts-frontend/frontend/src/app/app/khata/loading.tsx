import { HomeShell } from "@/components/ux/home/HomeShell";
import { RailSkeleton, ScreenSkeleton } from "@/components/ux/kit";

/**
 * Shown while this route's code and data are on their way.
 *
 * The rail is held open too — a skeleton that leaves it out lays the content
 * column out wider than the screen it stands in for, so the page arrives and
 * everything slides sideways.
 */
export default function Loading() {
  return (
    <HomeShell skeleton="list" rail={<RailSkeleton />}>
      <ScreenSkeleton shape="list" />
    </HomeShell>
  );
}

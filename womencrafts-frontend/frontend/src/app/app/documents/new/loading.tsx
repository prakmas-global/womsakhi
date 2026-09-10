import { HomeShell } from "@/components/ux/home/HomeShell";
import { RailSkeleton, ScreenSkeleton } from "@/components/ux/kit";

/** Shown while this route's code is on its way. */
export default function Loading() {
  return (
    <HomeShell skeleton="form" rail={<RailSkeleton />} bare>
      <ScreenSkeleton shape="form" />
    </HomeShell>
  );
}

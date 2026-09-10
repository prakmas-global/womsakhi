import { HomeShell } from "@/components/ux/home/HomeShell";
import { RailSkeleton, ScreenSkeleton } from "@/components/ux/kit";

/** Shown while this route's code and data are on their way. */
export default function Loading() {
  return (
    <HomeShell skeleton="list" rail={<RailSkeleton />} bare>
      <ScreenSkeleton shape="list" />
    </HomeShell>
  );
}

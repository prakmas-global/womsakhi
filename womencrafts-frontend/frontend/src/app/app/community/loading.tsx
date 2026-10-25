import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenSkeleton } from "@/components/ux/kit";

/** The feed, while it loads: a list with its side column. */
export default function Loading() {
  return (
    <HomeShell skeleton="list">
      <ScreenSkeleton shape="list" />
    </HomeShell>
  );
}

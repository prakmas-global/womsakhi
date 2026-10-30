import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenSkeleton } from "@/components/ux/kit";

/** Shown while this Rent & borrow screen's code and data are on their way. */
export default function Loading() {
  return (
    <HomeShell skeleton="list">
      <ScreenSkeleton shape="list" />
    </HomeShell>
  );
}

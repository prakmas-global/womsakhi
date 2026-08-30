import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenSkeleton } from "@/components/ux/kit";

/**
 * Shown while this route's code and data are on their way.
 *
 * Next renders this automatically in place of the page — no page changes, and
 * it appears on a real slow connection rather than only when forced.
 */
export default function Loading() {
  return (
    <HomeShell skeleton="list">
      <ScreenSkeleton shape="list" />
    </HomeShell>
  );
}

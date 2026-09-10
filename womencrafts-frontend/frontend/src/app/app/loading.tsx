import { HomeShell } from "@/components/ux/home/HomeShell";
import { HomeBodySkeleton, HomeRailSkeleton } from "@/components/ux/home/AppSkeleton";

/**
 * Shown while Home's own code and data are on their way.
 *
 * This file sits INSIDE the member layout, so the chrome around it — the
 * topbar, the left rail, the mobile bar — is already on screen and stays there;
 * only the content column and the right rail are being stood in for. The frame
 * itself is `AppShellSkeleton`, which the layout shows while its own boot is in
 * flight. Both draw the same body, so the two moments do not disagree.
 *
 * It used to render `ScreenSkeleton shape="grid"` — a title, a subtitle and
 * four cards in two columns — over a screen that opens with a full-width hero
 * and then five figures, six tiles and three panels. The rail was the kit's
 * generic pair of cards against the four this screen actually carries. Both
 * reserved a column; neither reserved the right one, so the page still settled
 * when it landed.
 */
export default function Loading() {
  return (
    <HomeShell bare rail={<HomeRailSkeleton />}>
      <HomeBodySkeleton />
    </HomeShell>
  );
}

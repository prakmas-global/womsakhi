import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHandoff } from "@/components/ux/kit";

/**
 * This route is a `redirect()` and nothing else.
 *
 * It was loading behind a full list skeleton, which promised a list this route
 * never renders — and the destination then showed its own skeleton, so one tap
 * produced two unrelated loading screens. The shell stays because the
 * destination has the same shell; only the middle says what is actually
 * happening.
 */
export default function Loading() {
  return (
    <HomeShell>
      <ScreenHandoff to="her page" />
    </HomeShell>
  );
}

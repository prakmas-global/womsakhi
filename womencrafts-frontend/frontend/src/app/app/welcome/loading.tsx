import { OnboardSkeleton } from "@/components/ux/kit";

/**
 * Welcome runs outside the shell, so it needs its own loading state. See the
 * note in `verify/loading.tsx` — without this file it inherited the whole app
 * shell and then discarded it.
 */
export default function Loading() {
  return <OnboardSkeleton />;
}

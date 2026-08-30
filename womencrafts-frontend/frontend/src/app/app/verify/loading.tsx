import { OnboardSkeleton } from "@/components/ux/kit";

/**
 * Verify runs outside the shell, so it needs its own loading state.
 *
 * Without this file it inherited `/app/loading.tsx` — the whole app, sidebar
 * and all — and painted a product she cannot reach yet before replacing it
 * with a bare onboarding page.
 */
export default function Loading() {
  return <OnboardSkeleton />;
}

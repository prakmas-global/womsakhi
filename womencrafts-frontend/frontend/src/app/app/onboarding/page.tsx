"use client";

import { OnboardingFlow } from "@/components/onboarding-flow/OnboardingFlow";
import { PreviewPillFromUrl } from "@/components/auth-shell/PreviewPill";
import { ONBOARDING_FLOW_PREVIEWS } from "@/lib/auth-preview";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * /app/onboarding — the Post-Auth Flow. Open while she waits for approval
 * (answers only) and after it (setting up, review). The member gate sends an
 * approved member here until she has finished or said "Not now".
 */
export default function OnboardingPage() {
  return (
    <>
      <OnboardingFlow />
      {AUTH_PREVIEW && <PreviewPillFromUrl allowed={ONBOARDING_FLOW_PREVIEWS} />}
    </>
  );
}

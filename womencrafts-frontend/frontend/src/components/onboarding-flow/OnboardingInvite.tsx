"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { apiOnboarding } from "@/lib/onboarding-api";
import { Art } from "./art";
import { SakhiAvatar } from "./primitives";
import "./tokens.css";
import "./onboarding.css";
import "./invite.css";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * M0 · "While you wait, tell me about you" — the invitation on her In review
 * screen. It uses the waiting day instead of adding a step after approval.
 * Hidden once she has finished the questions or said "Not now" to them.
 */
export function OnboardingInvite({ preview = false }: { preview?: boolean }) {
  const [show, setShow] = useState<null | { resume: boolean }>(null);

  useEffect(() => {
    if (AUTH_PREVIEW && preview) {
      const t = window.setTimeout(() => setShow({ resume: false }));
      return () => window.clearTimeout(t);
    }
    let alive = true;
    apiOnboarding()
      .then((s) => {
        if (!alive || s.completed || s.skipped_at) return;
        setShow({ resume: s.answered.length > 0 || s.consents.setup.granted === true });
      })
      .catch(() => { /* the invitation is optional; her status screen stands without it */ });
    return () => { alive = false; };
  }, [preview]);

  if (!show) return null;
  return (
    <section className="wso wso-invite" aria-labelledby="wso-invite-t">
      <div className="wso-invite-hero">
        <Art name="wait" sizes="(min-width: 1024px) 420px, 100vw" className="wso-invite-img" decorative />
        <div className="wso-invite-in">
          <div className="wso-invite-row">
            <SakhiAvatar />
            <h2 id="wso-invite-t">While you wait, tell me about you</h2>
          </div>
          <p>1 minute. When you&apos;re approved, your home will be ready for you.</p>
          <Link className="wso-invite-go" href="/app/onboarding">
            {show.resume ? "Carry on · about 1 minute" : "Start · about 1 minute"}<ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
      <p className="wso-invite-later">You can also do this later.</p>
    </section>
  );
}

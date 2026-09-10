"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { WaitPage } from "@/components/ux/WaitScreen";
import "../ux/tokens.css";

/**
 * The migrated Learning module.
 *
 * A top-level segment rather than a child of /app, because Next layouts nest
 * and this needs its own shell — rendering the new sidebar inside the old one
 * would give every screen two of everything. /app keeps working untouched
 * while the rest of the modules are migrated.
 *
 * The auth guard is the same one the old shell uses: nothing about the
 * redesign changes who is allowed to see her records.
 */
export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isMember } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [loading, user, router]);

  if (loading || !user) {
    // Was a bare `<Spinner />` on an empty page — see WaitPage for why that is
    // not feedback to somebody who does not already trust that the app works.
    return <WaitPage title="Opening your learning…" line="Please wait. We are checking you are signed in." />;
  }
  if (!isMember) {
    return (
      <div className="ux grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--ux-ink)" }}>
            This part of WomSakhi is for members.
          </h1>
          <p className="mt-2 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Your account is signed in as staff.
          </p>
        </div>
      </div>
    );
  }
  return <div className="ux min-h-screen">{children}</div>;
}

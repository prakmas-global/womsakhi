"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { apiHandoffRedeem, homeFor } from "@/lib/auth-api";
import { AuthShell } from "@/components/auth-shell";
import "@/components/auth-cards";

/**
 * "Open on web" — the app hands her over to the website already signed in.
 *
 * The app opens `/h#<code>`. The code is in the fragment so it never reaches
 * a server log or a Referer header; it is read once, wiped from the address
 * bar at once (so it is not left in history or a screenshot), and spent.
 *
 * Redeeming is one-time, and React runs effects twice in development, so the
 * attempt is kept at module level: the second run joins the first instead of
 * finding an empty hash and reporting a failure that did not happen.
 */

let attempt: Promise<string> | null = null;

function redeemOnce(): Promise<string> {
  if (attempt) return attempt;
  const code = window.location.hash.replace(/^#/, "").trim();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  attempt = code
    ? apiHandoffRedeem(code).then((payload) => homeFor(payload.user))
    : Promise.reject(new Error("no code"));
  return attempt;
}

export default function HandoffPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    redeemOnce().then(
      (home) => window.location.assign(home),
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, []);

  return (
    <AuthShell photo="plain" caption={{ title: "Opening WomSakhi", text: "You are being signed in on this browser, straight from the app." }}>
      <div className="ac">
        {failed ? (
          <>
            <h1 className="ac-t">Link expired</h1>
            <p className="ac-s">This link has expired. Open it from the WomSakhi app again.</p>
            <Link href="/signin" className="ac-btn ac-go">Sign in <ArrowRight aria-hidden /></Link>
          </>
        ) : (
          <div role="status" className="ac-wait">
            <Loader2 className="ac-spin" aria-hidden />
            <p>Opening WomSakhi…</p>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

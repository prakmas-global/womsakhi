"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { apiClient, expected } from "@/lib/api";
import { apiHandoffRedeem, homeFor } from "@/lib/auth-api";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/auth-shell";
import "@/components/auth-cards";
import { PREVIEW_STATES, readPreview, type HandoffPreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * "Open on web" — the app hands her over to the website.
 *
 * The app opens `/h#<code>`. The code is in the fragment so it never reaches
 * a server log or a Referer header; it is read once and wiped from the address
 * bar at once (so it is not left in history or a screenshot).
 *
 * ── Never on its own ────────────────────────────────────────────────────────
 * This page used to redeem the code the moment it loaded. That made it a
 * login-CSRF: anyone could mint a link for their OWN account, send it to her,
 * and her browser would silently become theirs, so whatever she typed next
 * landed in a stranger's account. Now the page only PEEKS (the API names the
 * account without spending the link), shows "Continue as <name>?", and waits
 * for her tap. If this browser is already signed in as somebody else, it says
 * so and asks before switching.
 *
 * React runs effects twice in development, so the code and the peek are kept
 * at module level: the second run joins the first instead of finding an empty
 * hash and reporting a failure that did not happen.
 */

interface Peek {
  user_id: string;
  name: string;
}

let code = "";
let peekAttempt: Promise<Peek> | null = null;

function peekOnce(): Promise<Peek> {
  if (peekAttempt) return peekAttempt;
  code = window.location.hash.replace(/^#/, "").trim();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  peekAttempt = code
    ? apiClient.post<Peek>("/auth/handoff/peek", { code }, expected()).then((r) => r.data)
    : Promise.reject(new Error("no code"));
  return peekAttempt;
}

type Stage = "opening" | "confirm" | "going" | "expired";

export default function HandoffPage() {
  const { user, loading } = useAuth();
  const [stage, setStage] = useState<Stage>("opening");
  const [peek, setPeek] = useState<Peek | null>(null);
  /** Local-only `?preview=`: no code is read or redeemed (see lib/auth-preview). */
  const [preview, setPreview] = useState<HandoffPreview | null>(null);

  useEffect(() => {
    if (AUTH_PREVIEW) {
      const p = readPreview(PREVIEW_STATES.handoff);
      if (p) {
        const t = window.setTimeout(() => { setPreview(p); setStage(p === "expired" ? "expired" : "opening"); });
        return () => window.clearTimeout(t);
      }
    }
    let alive = true;
    peekOnce().then(
      (who) => { if (alive) { setPeek(who); setStage("confirm"); } },
      () => { if (alive) setStage("expired"); },
    );
    return () => { alive = false; };
  }, []);

  const go = () => {
    if (!code || stage !== "confirm") return;
    setStage("going");
    const spent = code;
    code = "";
    apiHandoffRedeem(spent).then(
      (payload) => window.location.assign(homeFor(payload.user)),
      () => setStage("expired"),
    );
  };

  const name = peek?.name?.trim() || "your account";
  const firstName = name.split(/\s+/)[0];
  /** This browser is already someone else's: say so before replacing it. */
  const other = !loading && user && peek && user.id !== peek.user_id ? user : null;

  return (
    <AuthShell photo="plain" caption={{ title: "Opening WomSakhi", text: "The WomSakhi app on your phone sent you here." }}>
      <div className="ac">
        {stage === "expired" ? (
          <>
            <h1 className="ac-t">Link expired</h1>
            <p className="ac-s">This link has expired. Open it from the WomSakhi app again.</p>
            <Link href="/signin" className="ac-btn ac-go">Sign in <ArrowRight aria-hidden /></Link>
          </>
        ) : stage === "confirm" || (stage === "going" && peek) ? (
          <>
            <h1 className="ac-t">{other ? `Switch to ${firstName}?` : `Continue as ${name}?`}</h1>
            <p className="ac-s">
              {other
                ? `This browser is signed in as ${other.full_name || other.email}. Continuing signs this browser in as ${name} instead.`
                : "This signs this browser in to WomSakhi. Only continue if this is you and you opened the link from your own phone."}
            </p>
            <button type="button" className="ac-btn ac-go" onClick={go} disabled={stage === "going"}>
              {stage === "going"
                ? <><Loader2 className="ac-spin" aria-hidden /> Opening…</>
                : <>{other ? `Switch to ${firstName}` : `Continue as ${firstName}`} <ArrowRight aria-hidden /></>}
            </button>
            <p className="ac-link">
              <a href={user ? homeFor(user) : "/signin"}>{other ? "Not now, keep this browser as it is" : "This isn't me"}</a>
            </p>
          </>
        ) : (
          <div role="status" className="ac-wait">
            <Loader2 className="ac-spin" aria-hidden />
            <p>Opening WomSakhi…</p>
          </div>
        )}
      </div>
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </AuthShell>
  );
}

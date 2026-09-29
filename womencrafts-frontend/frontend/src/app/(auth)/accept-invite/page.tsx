"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { apiAcceptInvite } from "@/lib/staff-accounts-api";
import { memberError } from "@/lib/member-api";
import { AuthIcon, AuthShell, STAFF_CAPTION, Spinner, StaffAside } from "@/components/auth-shell";
import { PREVIEW_EMAIL, PREVIEW_STATES, readPreview, type InvitePreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Where a staff invitation lands.
 *
 * She has no account to sign in with yet — the token in the URL is the
 * credential — so this page is deliberately public.
 *
 * ── Nothing to choose ───────────────────────────────────────────────────────
 * There are no passwords. Accepting only spends the token; she then signs in
 * with a code sent to her email and sets up an authenticator app on that
 * first sign-in. One button rather than accept-on-load: a link preview or a
 * mail scanner fetching the URL must not be able to spend it for her.
 *
 * ── One message for every bad token ─────────────────────────────────────────
 * Wrong, already used and expired all say the same thing. Distinguishing them
 * tells a stranger holding a stale link that it was once real.
 */

/** The staff panel: the plain logo side with the same three rows as staff sign-in. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell photo="plain" tag="Staff" caption={STAFF_CAPTION} aside={<StaffAside />}>
      {children}
    </AuthShell>
  );
}

function Accept() {
  const realToken = (useSearchParams().get("token") ?? "").trim();

  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** Local-only `?preview=`: fixtures instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  useEffect(() => {
    if (!AUTH_PREVIEW) return;
    const p = readPreview(PREVIEW_STATES.invite);
    if (!p) return;
    const t = window.setTimeout(() => {
      setPreview(p);
      if (p === "invalid") setError("This invitation is no longer valid");
      if (p === "accepted") { setEmail(PREVIEW_EMAIL); setDone(true); }
    });
    return () => window.clearTimeout(t);
  }, []);
  const token = AUTH_PREVIEW && preview ? (preview === "incomplete" ? "" : "preview-token") : realToken;
  const pill = AUTH_PREVIEW ? <PreviewPill state={preview} /> : null;

  const accept = async () => {
    if (AUTH_PREVIEW && preview) { setEmail(PREVIEW_EMAIL); setDone(true); return; }
    setError("");
    setLoading(true);
    try {
      const res = await apiAcceptInvite({ token });
      setEmail(res.email);
      setDone(true);
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── No token at all ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <Shell>
        <div className="wsa-okhero is-soft"><span><AuthIcon name="alert" /></span></div>
        <h1 className="wsa-t wsa-center">That link is incomplete</h1>
        <p className="wsa-s wsa-center">
          It is missing its invitation code — usually because it was copied without the whole
          address. Ask whoever invited you to send a fresh one.
        </p>
        <Link href="/signin" className="wsa-btn wsa-go">Go to sign in <AuthIcon name="arrow" /></Link>
        {pill}
      </Shell>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Shell>
        <div className="wsa-okhero is-ok"><span><AuthIcon name="check" /></span></div>
        <h1 className="wsa-t wsa-center">Invitation accepted</h1>
        <p className="wsa-s wsa-center">
          Sign in with a code sent to {email ? <b>{email}</b> : "your work email"}.
          You&apos;ll set up an authenticator app on your first sign-in.
        </p>
        <Link href={email ? `/signin?email=${encodeURIComponent(email)}` : "/signin"} className="wsa-btn wsa-go">
          Sign in <AuthIcon name="arrow" />
        </Link>
        {pill}
      </Shell>
    );
  }

  // ── One button ────────────────────────────────────────────────────────────
  return (
    <Shell>
      <h1 className="wsa-t">Join the WomSakhi dashboard</h1>
      <p className="wsa-s">You have been invited to help run WomSakhi. Accept to activate your staff account.</p>
      <div className="wsa-row"><span><AuthIcon name="mail" /></span><div>Sign in with a six-digit code sent to your work email.</div></div>
      <div className="wsa-row"><span><AuthIcon name="phone" /></span><div>Set up an authenticator app on your phone the first time.</div></div>
      <div className="wsa-row"><span><AuthIcon name="key" /></span><div>No password — nobody here can know or reset one for you.</div></div>
      {error && <p role="alert" className="wsa-err">{error}</p>}
      <button type="button" onClick={() => void accept()} disabled={loading} className="wsa-btn wsa-go">
        {loading ? <><Spinner /> Accepting…</> : <>Accept invitation <AuthIcon name="arrow" /></>}
      </button>
      <p className="wsa-link">Already accepted? <Link href="/signin">Sign in</Link></p>
      {pill}
    </Shell>
  );
}

export default function AcceptInvitePage() {
  return (
    // `useSearchParams` needs a Suspense boundary so the page can prerender.
    <Suspense
      fallback={
        <Shell>
          <p className="wsa-muted" role="status" style={{ padding: "2rem 0" }}>Opening your invitation…</p>
        </Shell>
      }
    >
      <Accept />
    </Suspense>
  );
}

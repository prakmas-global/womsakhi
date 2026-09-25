"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { apiAcceptInvite } from "@/lib/staff-accounts-api";
import { memberError } from "@/lib/member-api";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useT } from "@/i18n";

/**
 * Where a staff invitation lands.
 *
 * She has no account to sign in with yet — the token in the URL is the
 * credential — so this page is deliberately public, like the password reset
 * beside it.
 *
 * ── She chooses the password, not the admin ─────────────────────────────────
 * The invitation creates the login with no password at all; this is where one
 * is set. An admin who types a colleague's first password knows that password,
 * and on a platform holding women's ID documents and their money that is not a
 * footnote.
 *
 * ── One message for every bad token ─────────────────────────────────────────
 * Wrong, already used and expired all say the same thing. Distinguishing them
 * tells a stranger holding a stale link that it was once real, and which staff
 * email it belonged to.
 */

function Brand() {
  const tr = useT();
  return (
    <div className="auth-brand">
      <BrandLockup
        alt={tr("waitScreen.womsakhiStrongerWomenBrighterTomorrows")}
        className="auth-main-lockup object-contain"
      />
    </div>
  );
}

function Accept() {
  const token = (useSearchParams().get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The same honest meter as the reset page: length plus variety, nothing
  // pretending to be an entropy calculation.
  const strength = Math.min(
    100,
    (password.length >= 8 ? 40 : password.length * 5) +
      (/[A-Z]/.test(password) ? 20 : 0) +
      (/[0-9]/.test(password) ? 20 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 20 : 0),
  );
  const label = password.length === 0 ? "" : strength >= 70 ? "Strong" : strength >= 40 ? "Getting there" : "Too weak";
  const ink = strength >= 70 ? "var(--a-ok)" : strength >= 40 ? "var(--a-warn)" : "var(--a-bad)";
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Checked here rather than by the server: the server cannot see the second
    // box, and a mismatch reported after a round trip would already have spent
    // the single-use token.
    if (password !== confirm) {
      setError("Those two passwords are not the same.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await apiAcceptInvite({ token, password });
      setEmail(res.email);
      setDone(true);
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  };

  const field = "auth-field min-h-[46px] w-full rounded-[12px] pe-12 ps-11 text-sm";
  const pad = { paddingBlock: "clamp(0.5625rem,1.5vh,0.875rem)" } as const;

  // ── No token at all ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <div>
        <Brand />
        <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--a-tint-rose)", color: "var(--a-rose)" }}>
          <CircleAlert className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-bold leading-tight tracking-tight"
            style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
          That link is <span className="auth-shine">incomplete</span>
        </h1>
        <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--a-muted)" }}>
          It is missing its invitation code — usually because it was copied without the whole
          address. Ask whoever invited you to send a fresh one.
        </p>
        <Link href="/signin"
              className="auth-go mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold">
          Go to sign in
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div>
        <Brand />
        <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--a-tint-violet-2)", color: "var(--a-lilac)" }}>
          <CircleCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-bold leading-tight tracking-tight"
            style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
          Your account is <span className="auth-shine">ready</span>
        </h1>
        <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--a-muted)" }}>
          Sign in with {email ? <b style={{ color: "var(--a-ink-2)" }}>{email}</b> : "your work email"} and
          the password you just chose. That invitation link has been used up, so it will not work
          again — which is what stops anyone else using it.
        </p>
        <Link href="/signin"
              className="auth-go mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold">
          Sign in
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    );
  }

  // ── The form ──────────────────────────────────────────────────────────────
  return (
    <div>
      <Brand />

      <h1 className="font-bold leading-tight tracking-tight"
          style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)", marginTop: "clamp(0.875rem,3.4vh,1.875rem)" }}>
        Choose your <span className="auth-shine">password</span>
      </h1>
      <p className="auth-sub text-xsm leading-relaxed" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
        You have been invited to the WomSakhi dashboard. Pick a password only you know — nobody
        here has set one for you, and nobody can see it.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
           style={{ background: "var(--a-tint-rose-2)", border: "1px solid var(--a-edge-rose)", color: "var(--a-danger-ink)" }}>
          {error}
        </p>
      )}

      <form onSubmit={submit} style={{ marginTop: "clamp(0.875rem,2.6vh,1.5rem)" }} className="space-y-[clamp(0.5625rem,1.5vh,0.875rem)]">
        <div>
          <label htmlFor="ai-password" className="mb-1.5 block text-xsm font-medium" style={{ color: "var(--a-ink-2)" }}>
            Your password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                  style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="ai-password" type={show ? "text" : "password"} required minLength={8}
              autoComplete="new-password" autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters" className={field} style={pad}
            />
            <button
              type="button" onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute end-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[12px]"
              style={{ color: "var(--a-muted)" }}
            >
              {show ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
            </button>
          </div>
          {label && (
            <div className="mt-2 flex items-center gap-2.5">
              <span className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--a-track)" }}>
                <span className="block h-full rounded-full transition-all duration-300"
                      style={{ width: `${strength}%`, background: ink }} />
              </span>
              <span className="text-2xs font-medium" style={{ color: ink }}>{label}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="ai-confirm" className="mb-1.5 block text-xsm font-medium" style={{ color: "var(--a-ink-2)" }}>
            Type it again
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                  style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="ai-confirm" type={show ? "text" : "password"} required autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="The same password" className={field} style={pad}
              aria-invalid={mismatch || undefined}
            />
          </div>
          {mismatch && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--a-bad)" }}>
              These two do not match yet.
            </p>
          )}
        </div>

        <button
          type="submit" disabled={loading || mismatch || password.length < 8}
          className="auth-go flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold"
          style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
        >
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
          {loading ? "Setting it…" : "Set my password"}
          {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </form>

      <p className="text-center text-xsm" style={{ color: "var(--a-muted)", marginTop: "clamp(0.625rem,2vh,1.375rem)" }}>
        Already set one? <Link href="/signin" className="auth-link font-semibold">Sign in</Link>
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    // `useSearchParams` needs a Suspense boundary so the page can prerender.
    <Suspense
      fallback={
        <div>
          <Brand />
          <p className="mt-8 flex items-center gap-2.5 text-xsm" style={{ color: "var(--a-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening your invitation…
          </p>
        </div>
      }
    >
      <Accept />
    </Suspense>
  );
}

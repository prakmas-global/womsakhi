"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { apiResetPassword, verificationErrorMessage } from "@/lib/verification-api";

/**
 * Where the reset link lands.
 *
 * **This page did not exist.** `members.py::start_password_reset` has emailed
 * `{APP_BASE_URL}/reset-password?token=…` for as long as staff have been able
 * to start a reset — and that URL was a 404. A woman locked out, who found a
 * human, who was sent a link, clicked it and got nothing. Now it is real, and
 * `POST /auth/forgot-password` lets her start one herself.
 *
 * Deliberately public: she may open the link on a different device, or in a
 * browser where she is signed out. That is the whole point of a reset.
 */

function Brand() {
  return (
    <div className="auth-brand flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/ux/brand/womsakhi-mark.webp" alt="" aria-hidden className="object-contain"
           style={{ width: "clamp(2.125rem,5vh,2.5rem)", height: "clamp(2.125rem,5vh,2.5rem)" }} />
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/ux/brand/womsakhi-wordmark.webp" alt="WomSakhi" className="object-contain"
             style={{ height: "clamp(1.25rem,3vh,1.5rem)" }} />
        <p className="auth-tagline mt-1 text-[0.6875rem] font-semibold tracking-[0.19em]" style={{ color: "var(--a-muted)" }}>
          EMPOWERING HER JOURNEY
        </p>
      </div>
    </div>
  );
}

function Reset() {
  const token = (useSearchParams().get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Same honest meter as signing up: length plus variety, nothing pretending
  // to be an entropy calculation.
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
    // Caught here rather than by the server, because the server cannot see the
    // second box — and being told "they do not match" after a round trip that
    // may have already spent the single-use token would be unrecoverable.
    if (password !== confirm) {
      setError("Those two passwords are not the same.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiResetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const field = "auth-field min-h-[46px] w-full rounded-[12px] pe-12 ps-11 text-[0.875rem]";
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
        <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: "var(--a-muted)" }}>
          It is missing its reset code — usually because it was copied without the
          whole address. Ask for a fresh one and open it straight from the email.
        </p>
        <Link href="/forgot-password"
              className="auth-go mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-[0.875rem] font-semibold">
          Send me a new link
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
          Password <span className="auth-shine">changed</span>
        </h1>
        <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: "var(--a-muted)" }}>
          You can sign in with it now. That link has been used up, so it will not
          work again — which is what stops anyone else using it.
        </p>
        <Link href="/signin"
              className="auth-go mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-[0.875rem] font-semibold">
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
        Choose a new <span className="auth-shine">password</span>
      </h1>
      <p className="auth-sub text-[0.8125rem] leading-relaxed" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
        At least 8 characters. Pick something you have not used anywhere else.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-[12px] px-3.5 py-3 text-[0.8125rem] leading-relaxed"
           style={{ background: "var(--a-tint-rose-2)", border: "1px solid var(--a-edge-rose)", color: "var(--a-danger-ink)" }}>
          {error}
        </p>
      )}

      <form onSubmit={submit} style={{ marginTop: "clamp(0.875rem,2.6vh,1.5rem)" }} className="space-y-[clamp(0.5625rem,1.5vh,0.875rem)]">
        <div>
          <label htmlFor="rp-password" className="mb-1.5 block text-[0.8125rem] font-medium" style={{ color: "var(--a-ink-2)" }}>
            New password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                  style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="rp-password" type={show ? "text" : "password"} required minLength={8}
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
              <span className="text-[0.6875rem] font-medium" style={{ color: ink }}>{label}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="rp-confirm" className="mb-1.5 block text-[0.8125rem] font-medium" style={{ color: "var(--a-ink-2)" }}>
            Type it again
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                  style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="rp-confirm" type={show ? "text" : "password"} required autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="The same password" className={field} style={pad}
              aria-invalid={mismatch || undefined}
            />
          </div>
          {mismatch && (
            <p className="mt-1.5 text-[0.75rem]" style={{ color: "var(--a-bad)" }}>
              These two do not match yet.
            </p>
          )}
        </div>

        <button
          type="submit" disabled={loading || mismatch || password.length < 8}
          className="auth-go flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-[0.875rem] font-semibold"
          style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
        >
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
          {loading ? "Saving…" : "Save my new password"}
          {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </form>

      <p className="text-center text-[0.8125rem]" style={{ color: "var(--a-muted)", marginTop: "clamp(0.625rem,2vh,1.375rem)" }}>
        Remembered it? <Link href="/signin" className="auth-link font-semibold">Sign in</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense
      fallback={
        <div>
          <Brand />
          <p className="mt-8 flex items-center gap-2.5 text-[0.8125rem]" style={{ color: "var(--a-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening your link…
          </p>
        </div>
      }
    >
      <Reset />
    </Suspense>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Loader2, Mail } from "lucide-react";

import { apiForgotPassword, verificationErrorMessage } from "@/lib/verification-api";

/** Where a woman who cannot get in can still reach a person. */
const HELP_EMAIL = "hello@womsakhi.in";

/**
 * Getting back in.
 *
 * ── This screen has now been wrong in two opposite directions ───────────────
 * It first *lied*: it took her email, waited 600ms and said "check your inbox",
 * having sent nothing. Then it told the truth — that no reset existed — which
 * was honest but left a woman locked out of her own account with nowhere to go
 * but a support address.
 *
 * Both are fixed at the root: `POST /auth/forgot-password` now issues a real
 * single-use, 24-hour link, and `/reset-password` spends it. So this is a form
 * again, and this time the email is actually sent.
 *
 * The confirmation deliberately does not say whether the address had an
 * account. Same words either way — anything else answers "is she a member
 * here?" for anyone who cares to ask, which on a women-only platform is not an
 * abstract risk.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiForgotPassword(email.trim());
      setMessage(res.message);
      setSent(true);
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ── Brand ── */}
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

      <Link href="/signin" className="auth-link mt-6 inline-flex min-h-[36px] items-center gap-1.5 text-[0.8125rem] font-medium">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to sign in
      </Link>

      {sent ? (
        <>
          <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "var(--a-tint-violet-2)", color: "var(--a-lilac)" }}>
            <CircleCheck className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 font-bold leading-tight tracking-tight"
              style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
            Check your <span className="auth-shine">inbox</span>
          </h1>
          <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: "var(--a-muted)" }}>
            {message}
          </p>
          <p className="mt-3 text-[0.75rem] leading-relaxed" style={{ color: "var(--a-faint)" }}>
            Nothing after a few minutes? Look in spam, then write to{" "}
            <a href={`mailto:${HELP_EMAIL}`} className="auth-link font-semibold">{HELP_EMAIL}</a>{" "}
            and a person will get you back in.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setMessage(""); }}
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[0.8125rem] font-semibold"
            style={{ background: "var(--a-well-2)", border: "1px solid var(--a-edge)", color: "var(--a-ink-2)" }}
          >
            Use a different address
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-bold leading-tight tracking-tight"
              style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
            Locked <span className="auth-shine">out?</span>
          </h1>
          <p className="auth-sub text-[0.8125rem] leading-relaxed" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
            Give us the address you joined with and we will send you a link to set
            a new password. It lasts 24 hours.
          </p>

          {error && (
            <p role="alert" className="mt-5 rounded-[12px] px-3.5 py-3 text-[0.8125rem] leading-relaxed"
               style={{ background: "var(--a-tint-rose-2)", border: "1px solid var(--a-edge-rose)", color: "var(--a-danger-ink)" }}>
              {error}
            </p>
          )}

          <form onSubmit={submit} style={{ marginTop: "clamp(0.875rem,2.8vh,1.625rem)" }}>
            <label htmlFor="fp-email" className="mb-1.5 block text-[0.8125rem] font-medium" style={{ color: "var(--a-ink-2)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                    style={{ color: "var(--a-faint)" }} aria-hidden />
              <input
                id="fp-email" type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-field min-h-[46px] w-full rounded-[12px] pe-4 ps-11 text-[0.875rem]"
                style={{ paddingBlock: "clamp(0.5625rem,1.5vh,0.875rem)" }}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="auth-go mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-[0.875rem] font-semibold"
              style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
              {loading ? "Sending…" : "Send me a link"}
              {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
            </button>
          </form>
        </>
      )}

      <p className="text-center text-[0.8125rem]" style={{ color: "var(--a-muted)", marginTop: "clamp(0.75rem,2.4vh,1.625rem)" }}>
        Remembered it? <Link href="/signin" className="auth-link font-semibold">Sign in</Link>
      </p>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Info, Loader2, Mail } from "lucide-react";

import { apiForgotPassword, verificationErrorMessage } from "@/lib/verification-api";
import { BrandLockup } from "@/components/brand/BrandLockup";

/** Where a woman who cannot get in can still reach a person. */
// Must match what the backend sends FROM and what staff monitor.
// This read `hello@womsakhi.com` while every backend address is `.com`,
// so a woman following it wrote into nothing.
const HELP_EMAIL = "support@womsakhi.com";

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
  const tr = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  // Whether a link is genuinely coming. The server knows; the screen used
  // to assume yes and say so over a mailer that delivers nothing.
  const [canEmail, setCanEmail] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiForgotPassword(email.trim());
      setMessage(res.message);
      setCanEmail(res.can_email !== false);
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
      <div className="auth-brand">
        <BrandLockup
          alt={tr("waitScreen.womsakhiStrongerWomenBrighterTomorrows")}
          className="auth-main-lockup object-contain"
        />
      </div>

      <Link href="/signin" className="auth-link mt-6 inline-flex min-h-[36px] items-center gap-1.5 text-xsm font-medium">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tr("page.backToSignIn")}
      </Link>

      {sent ? (
        <>
          <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "var(--a-tint-violet-2)", color: "var(--a-lilac)" }}>
            {canEmail ? <CircleCheck className="h-7 w-7" aria-hidden /> : <Info className="h-7 w-7" aria-hidden />}
          </span>
          <h1 className="mt-4 font-bold leading-tight tracking-tight"
              style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
            {canEmail
              ? <>{tr("page.checkYour")} <span className="auth-shine">{tr("page.inbox2")}</span></>
              : tr("forgot.noEmailTitle")}
          </h1>
          <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--a-muted)" }}>
            {message}
          </p>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--a-faint)" }}>
            {canEmail ? <>{tr("forgot.nothingAfterAFewMinutes")}{" "}</> : null}
            <a href={`mailto:${HELP_EMAIL}`} className="auth-link font-semibold">{HELP_EMAIL}</a>{" "}
            {tr("forgot.andAPersonWillGetYouBackIn")}
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setMessage(""); }}
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xsm font-semibold"
            style={{ background: "var(--a-well-2)", border: "1px solid var(--a-edge)", color: "var(--a-ink-2)" }}
          >
            {tr("page.useADifferentAddress")}
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-bold leading-tight tracking-tight"
              style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)" }}>
            {tr("page.locked1")} <span className="auth-shine">{tr("page.locked2")}</span>
          </h1>
          <p className="auth-sub text-xsm leading-relaxed" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
            Give us the address you joined with and we will send you a link to set
            a new password. It lasts 24 hours.
          </p>

          {error && (
            <p role="alert" className="mt-5 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: "var(--a-tint-rose-2)", border: "1px solid var(--a-edge-rose)", color: "var(--a-danger-ink)" }}>
              {error}
            </p>
          )}

          <form onSubmit={submit} style={{ marginTop: "clamp(0.875rem,2.8vh,1.625rem)" }}>
            <label htmlFor="fp-email" className="mb-1.5 block text-xsm font-medium" style={{ color: "var(--a-ink-2)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2"
                    style={{ color: "var(--a-faint)" }} aria-hidden />
              <input
                id="fp-email" type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={tr("page.youExampleCom")}
                className="auth-field min-h-[46px] w-full rounded-[12px] pe-4 ps-11 text-sm"
                style={{ paddingBlock: "clamp(0.5625rem,1.5vh,0.875rem)" }}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="auth-go mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold"
              style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
              {loading ? "Sending…" : "Send me a link"}
              {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
            </button>
          </form>
        </>
      )}

      <p className="text-center text-xsm" style={{ color: "var(--a-muted)", marginTop: "clamp(0.75rem,2.4vh,1.625rem)" }}>
        {tr("page.rememberedIt")} <Link href="/signin" className="auth-link font-semibold">{tr("page.signIn")}</Link>
      </p>
    </div>
  );
}

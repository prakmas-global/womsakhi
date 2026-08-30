"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Headset, Info, Mail, Send, Sparkles } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // NOTE: no password-reset endpoint exists on the backend yet — this shows the
    // success state without sending a real email. Wire to a real service later.
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setSent(true);
  };

  return (
    <div>
      <div className="rounded-3xl bg-surface p-6 shadow-[var(--wc-shadow-raised)] ring-1 ring-line sm:p-6">
        <Link
          href="/signin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-ink hover:text-violet-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>

        {/* badge */}
        <div className="mb-3.5 flex justify-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-violet-200/70">
            <Sparkles className="pointer-events-none absolute -left-3 top-3 h-4 w-4 text-violet-300" aria-hidden />
            <Sparkles className="pointer-events-none absolute -right-3 top-3 h-4 w-4 -scale-x-100 text-violet-300" aria-hidden />
            {sent ? (
              <CheckCircle2 className="h-6 w-6 text-violet-ink" strokeWidth={2.2} />
            ) : (
              <Mail className="h-6 w-6 text-violet-ink" strokeWidth={2.2} />
            )}
          </span>
        </div>

        <h1 className="text-center font-display text-2xl font-bold text-ink">
          {sent ? "Check your inbox" : "Forgot Password?"}
        </h1>
        <p className="mx-auto mt-1 max-w-sm text-center text-sm text-ink-subtle">
          {sent
            ? `If an account exists for ${email || "that address"}, we've sent a link to reset your password.`
            : "No worries! Enter your registered email address and we'll send you a link to reset your password."}
        </p>

        {!sent && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-muted">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email address"
                  className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder-ink-subtle outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Send className="h-4.5 w-4.5" />
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* divider */}
        <div className="my-4 flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-subtle">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* resend box */}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-violet-tint/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-violet-ink" />
            <div>
              <p className="text-sm font-semibold text-ink">
                Didn&apos;t receive the email?
              </p>
              <p className="text-xsm text-ink-subtle">
                Check your spam folder or resend the link.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="shrink-0 rounded-lg border border-violet-200 bg-surface px-4 py-2 text-sm font-semibold text-violet-ink transition hover:bg-violet-tint"
          >
            Resend Email
          </button>
        </div>
      </div>

      {/* help box */}
      <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/70 px-5 py-3">
        <div className="flex items-center gap-3">
          <Headset className="h-6 w-6 text-violet-ink" />
          <div>
            <p className="text-sm font-semibold text-ink">Need help?</p>
            <p className="text-xsm text-ink-subtle">
              Contact our support team and we&apos;ll help you recover your account.
            </p>
          </div>
        </div>
        <button className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-violet-ink hover:text-violet-ink">
          Contact Support
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

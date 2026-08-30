"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, LogIn, HelpCircle } from "lucide-react";
import { useAuth, getAuthError } from "@/context/AuthContext";
import { GoogleIcon, MicrosoftIcon, AppleIcon } from "@/components/auth/SocialIcons";

export default function SignInPage() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(getAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-[var(--wc-shadow-raised)] ring-1 ring-line sm:p-6">
      {/* brand mark — the logo carries the screen on small viewports, where the
          showcase panel beside it is hidden */}
      {/* the community, not the logo — the brand is already carried by the
          panel on the left, so this space belongs to the women themselves */}
      <div className="mb-5 overflow-hidden rounded-2xl ring-1 ring-line dark:ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/login-hero.png"
          alt="Women of the WomSakhi community"
          className="h-32 w-full object-cover object-top"
          draggable={false}
        />
      </div>

      <h1 className="text-center font-display text-2xl font-bold text-ink">
        Welcome back
      </h1>
      <p className="mt-1 text-center text-sm text-ink-subtle">
        Sign in to your WomSakhi account
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* email */}
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
              placeholder="admin@womsakhi.com"
              className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder-ink-subtle outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>
        </div>

        {/* password */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-semibold text-ink-muted">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-violet-ink hover:text-violet-ink"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-11 pr-11 text-sm text-ink placeholder-ink-subtle outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-subtle hover:text-ink-muted"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
          </div>
        </div>

        {/* remember + help */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2.5">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4.5 w-4.5 rounded-md border-line-strong text-violet-ink accent-violet-600"
            />
            <span className="text-sm text-ink-muted">Remember me</span>
          </label>
          <span className="flex items-center gap-1.5 text-sm text-ink-subtle">
            Need help?
            <HelpCircle className="h-4 w-4 text-ink-subtle" />
          </span>
        </div>

        {/* submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing in…" : "Sign In"}
          {!loading && <LogIn className="h-4.5 w-4.5" />}
        </button>
      </form>

      {/* divider */}
      <div className="my-4 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-subtle">or continue with</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* social */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Google", icon: <GoogleIcon /> },
          { label: "Microsoft", icon: <MicrosoftIcon /> },
          { label: "Apple", icon: <AppleIcon /> },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setError("Social sign-in isn't wired up yet.")}
            className="flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface py-2.5 text-sm font-medium text-ink-muted transition hover:bg-surface-hover"
          >
            {s.icon}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-sm text-ink-subtle">
        Don&apos;t have an account?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-violet-ink hover:text-violet-ink"
        >
          Contact Support
        </Link>
      </p>
    </div>
  );
}

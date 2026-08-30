"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, UserPlus, UserRound } from "lucide-react";

import { useAuth, getAuthError } from "@/context/AuthContext";

/**
 * Sign up.
 *
 * Deliberately the same shape as the sign-in screen beside it — same card, same
 * hero, same brand colours. It previously used raw `gray`/`rose` utilities and
 * bare inputs, which made the first screen a new member ever sees the one that
 * looked least like the product.
 */
export default function SignUpPage() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Cheap, honest strength meter — length plus variety, nothing pretending to
  // be an entropy calculation.
  const strength = Math.min(
    100,
    (password.length >= 8 ? 40 : password.length * 5) +
      (/[A-Z]/.test(password) ? 20 : 0) +
      (/[0-9]/.test(password) ? 20 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 20 : 0),
  );
  const strengthLabel =
    password.length === 0
      ? ""
      : strength >= 70
        ? "Strong"
        : strength >= 40
          ? "Getting there"
          : "Too weak";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp(fullName, email, password);
    } catch (err) {
      setError(getAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-xl border border-line-strong bg-surface py-2.5 pe-4 ps-10 text-sm text-ink placeholder:text-ink-subtle transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50 dark:border-white/10 dark:bg-white/5";

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-[var(--wc-shadow-raised)] ring-1 ring-line dark:bg-transparent dark:ring-white/10 sm:p-6">
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
        Join us
      </h1>
      <p className="mt-1 text-center text-sm text-ink-subtle">
        WomSakhi is women only. Every account is checked by a person.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="su-name" className="mb-1.5 block text-sm font-medium text-ink-muted">
            Your name
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="su-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ananya Sharma"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="su-email" className="mb-1.5 block text-sm font-medium text-ink-muted">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="su-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="su-phone" className="mb-1.5 block text-sm font-medium text-ink-muted">
            Phone <span className="font-normal text-ink-subtle">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="su-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="su-password" className="mb-1.5 block text-sm font-medium text-ink-muted">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="su-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={`${field} pe-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-subtle transition hover:text-ink-muted"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    strength >= 70 ? "bg-status-ok-solid" : strength >= 40 ? "bg-status-warn-solid" : "bg-status-danger-solid"
                  }`}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <p
                className={`mt-1 text-xs font-medium ${
                  strength >= 70
                    ? "text-status-ok-ink"
                    : strength >= 40
                      ? "text-status-warn-ink"
                      : "text-status-danger-ink"
                }`}
              >
                {strengthLabel}
              </p>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          <UserPlus className="h-4 w-4" />
          {loading ? "Creating your account…" : "Create my account"}
        </button>
      </form>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-status-ok-bg/70 px-3.5 py-3 text-xs leading-relaxed text-status-ok-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        After you sign up we&apos;ll ask for one photo ID. It&apos;s stored privately, only our
        review team can open it, and it&apos;s how we keep this space women only.
      </p>

      <p className="mt-5 text-center text-sm text-ink-subtle">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

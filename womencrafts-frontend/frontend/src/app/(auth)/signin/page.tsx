"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { useAuth, getAuthError } from "@/context/AuthContext";
import { fetchAuthProviders } from "@/lib/public-api";

/**
 * Google and Apple marks. lucide dropped third-party brand icons, and these
 * two need their real colours anyway.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020/api/v1";

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
  </svg>
);
const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
    <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9s-2.1-.9-3.4-.9c-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8 2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.6-1-2.6-4.3zM14 4.6c.7-.9 1.2-2.1 1-3.3-1 .1-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3.1-1.5z" />
  </svg>
);

/**
 * Signing in.
 *
 * Short on purpose. Everything that argues for WomSakhi is on the panel beside
 * this one — a woman here has already decided, and the job is to get out of
 * her way.
 *
 * **No "Continue with Google / Apple" row.** The mock has one; this backend has
 * no OAuth of any kind (`app/routes/auth.py` knows only email and password), so
 * those buttons could only ever have answered a press by doing nothing — on the
 * one screen where "nothing happened" reads as "this app is broken" and she
 * leaves. The row goes back the day a provider is wired up.
 */
export default function SignInPage() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Which social sign-ins actually work. Empty today — this backend knows only
  // email and password — so the row below does not render at all.
  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchAuthProviders().then((p) => { if (!cancelled) setProviders(p); });
    return () => { cancelled = true; };
  }, []);

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

  const field = "auth-field min-h-[46px] w-full rounded-[12px] pe-4 ps-11 text-[0.875rem]";
  const fieldPad = { paddingBlock: "clamp(0.5625rem,1.5vh,0.875rem)" } as const;

  return (
    <div>
      {/* ── Brand ── */}
      <div className="auth-brand flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/brand/womsakhi-mark.webp" alt="" aria-hidden className="object-contain"
          style={{ width: "clamp(2.125rem,5vh,2.5rem)", height: "clamp(2.125rem,5vh,2.5rem)" }} />
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/brand/womsakhi-wordmark.webp" alt="WomSakhi" className="object-contain"
            style={{ height: "clamp(1.25rem,3vh,1.5rem)" }} />
          <p className="auth-tagline mt-1 text-[0.6875rem] font-semibold tracking-[0.19em]" style={{ color: "var(--a-muted)" }}>
            EMPOWERING HER JOURNEY
          </p>
        </div>
      </div>

      <h1 className="font-bold leading-tight tracking-tight" style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)", marginTop: "clamp(0.875rem,3.4vh,2rem)" }}>
        Welcome <span className="auth-shine">back</span>
      </h1>
      <p className="auth-sub text-[0.8125rem]" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
        Sign in to pick up where you left off.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-[12px] px-3.5 py-3 text-[0.8125rem] leading-relaxed"
          style={{
            background: "var(--a-tint-rose-2)",
            border: "1px solid var(--a-edge-rose)",
            color: "var(--a-danger-ink)",
          }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "clamp(0.875rem,2.8vh,1.75rem)" }} className="space-y-[clamp(0.625rem,1.8vh,1rem)]">
        <div>
          <label htmlFor="si-email" className="mb-1.5 block text-[0.8125rem] font-medium" style={{ color: "var(--a-ink-2)" }}>
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2" style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="si-email" type="email" required autoComplete="email" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className={field} style={fieldPad}
            />
          </div>
        </div>

        <div>
          <label htmlFor="si-password" className="mb-1.5 block text-[0.8125rem] font-medium" style={{ color: "var(--a-ink-2)" }}>
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2" style={{ color: "var(--a-faint)" }} aria-hidden />
            <input
              id="si-password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password" className={`${field} pe-12`} style={fieldPad}
            />
            {/* Offered, not buried. A woman typing on a borrowed phone keyboard
                needs to be able to see what she typed. */}
            <button
              type="button" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute end-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[12px]"
              style={{ color: "var(--a-muted)" }}
            >
              {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* The row is the target, not the box — a 17px checkbox is under the
              24px minimum on a phone. */}
          <label className="-my-2 flex min-h-[44px] cursor-pointer select-none items-center gap-2.5 py-2">
            <input
              type="checkbox" checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-[18px] w-[18px] rounded-[8px]"
              style={{ accentColor: "var(--a-magenta)" }}
            />
            <span className="text-[0.8125rem]" style={{ color: "var(--a-ink-2)" }}>Keep me signed in</span>
          </label>
          <Link href="/forgot-password" className="auth-link -my-2 flex min-h-[44px] items-center text-[0.8125rem] font-medium">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-go flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-[0.875rem] font-semibold"
          style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
        >
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
          {loading ? "Signing in…" : "Sign in"}
          {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </form>

      {/* ── Another way in ──────────────────────────────────────────────────
          Rendered ONLY for providers the server says are configured. The comp
          has Google and Apple; this backend has no OAuth of any kind, so they
          used to be buttons that could answer a press with nothing at all — on
          the one screen where "nothing happened" reads as "this app is broken"
          and she leaves. Today `/public/auth-providers` returns an empty list
          and none of this renders. Wire a provider up and the button returns by
          itself, with no change here. */}
      {providers.length > 0 && (
        <>
          <div className="flex items-center gap-3" style={{ marginTop: "clamp(0.5625rem,1.7vh,1.25rem)" }}>
            <span className="h-px flex-1" style={{ background: "var(--a-edge)" }} aria-hidden />
            <span className="text-[0.6875rem] font-medium tracking-wide" style={{ color: "var(--a-faint)" }}>OR</span>
            <span className="h-px flex-1" style={{ background: "var(--a-edge)" }} aria-hidden />
          </div>

          <div className={`mt-2.5 grid gap-2.5 ${providers.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {providers.includes("google") && (
              <a
                href={`${API_BASE}/auth/google/start`}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] text-[0.75rem] font-semibold"
                style={{ background: "var(--a-well-2)", border: "1px solid var(--a-edge)", color: "var(--a-ink)" }}
              >
                <GoogleMark />
                Continue with Google
              </a>
            )}
            {providers.includes("apple") && (
              <a
                href={`${API_BASE}/auth/apple/start`}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] text-[0.75rem] font-semibold"
                style={{ background: "var(--a-well-2)", border: "1px solid var(--a-edge)", color: "var(--a-ink)" }}
              >
                <AppleMark />
                Continue with Apple
              </a>
            )}
          </div>
        </>
      )}

      <p className="text-center text-[0.8125rem]" style={{ color: "var(--a-muted)", marginTop: "clamp(0.625rem,1.9vh,1.5rem)" }}>
        New to WomSakhi?{" "}
        <Link href="/signup" className="auth-link inline-flex items-center gap-1 font-semibold">
          Create your account
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </p>
    </div>
  );
}

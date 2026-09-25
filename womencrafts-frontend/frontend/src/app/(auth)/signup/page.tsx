"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";

import { useAuth, getAuthError } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import { BrandLockup } from "@/components/brand/BrandLockup";

/**
 * Joining.
 *
 * Ordered by her trust. Name and email are what she expects to be asked. The
 * password comes with a meter that measures rather than flatters. The photo ID
 * — the part a woman is entitled to hesitate over — is explained above the
 * button, before she commits, not sprung on her on the next screen.
 *
 * **Her phone number used to be discarded.** The field was here and labelled
 * optional, and `signUp(fullName, email, password)` dropped it — though
 * `signUp` takes a phone and `POST /auth/signup` accepts one. She typed it and
 * it went nowhere. For a woman whose phone is how she is reached, that is not
 * a small thing to lose in silence.
 */
export default function SignUpPage() {
  const tr = useT();
  const { signUp } = useAuth();

  const { locale } = useI18n();
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
    password.length === 0 ? ""
      : strength >= 70 ? "Strong"
      : strength >= 40 ? "Getting there"
      : "Too weak";
  const strengthInk =
    strength >= 70 ? "var(--a-ok)" : strength >= 40 ? "var(--a-warn)" : "var(--a-bad)";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // The phone goes with it. It used to be collected here and dropped.
      // The language she chose on this screen, saved with the account rather
      // than left in a cookie — `apiSignUp` defaulted it to "en", so a woman
      // who set Telugu before filling the form had an English account from the
      // moment she created it, and got English on every other device.
      await signUp(fullName, email, password, { phone: phone.trim() || undefined, locale });
    } catch (err) {
      setError(getAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const field = "auth-field min-h-[46px] w-full rounded-[12px] pe-4 ps-11 text-sm";
  const fieldPad = { paddingBlock: "clamp(0.5625rem,1.5vh,0.875rem)" } as const;
  const labelCls = "mb-1.5 block text-xsm font-medium";
  const labelStyle = { color: "var(--a-ink-2)" } as const;
  const iconCls = "pointer-events-none absolute start-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2";
  const iconStyle = { color: "var(--a-faint)" } as const;

  return (
    <div>
      {/* ── Brand ── */}
      <div className="auth-brand">
        <BrandLockup
          alt={tr("waitScreen.womsakhiStrongerWomenBrighterTomorrows")}
          className="auth-main-lockup object-contain"
        />
      </div>

      <h1 className="font-bold leading-tight tracking-tight" style={{ color: "var(--a-ink)", fontSize: "clamp(1.35rem, 3.4vh, 2.1rem)", marginTop: "clamp(0.625rem,2.2vh,1.75rem)" }}>
        {tr("page.join1")} <span className="auth-shine">{tr("page.join2")}</span>
      </h1>
      <p className="auth-sub text-xsm" style={{ color: "var(--a-muted)", marginTop: "clamp(0.25rem,0.8vh,0.375rem)" }}>
        {tr("page.womenOnlyAndFreeNobodyHere")}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
          style={{
            background: "var(--a-tint-rose-2)",
            border: "1px solid var(--a-edge-rose)",
            color: "var(--a-danger-ink)",
          }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "clamp(0.625rem,2vh,1.5rem)" }} className="space-y-[clamp(0.4375rem,1.2vh,0.875rem)]">
        <div>
          <label htmlFor="su-name" className={labelCls} style={labelStyle}>{tr("settingsAccount.yourName")}</label>
          <div className="relative">
            <UserRound className={iconCls} style={iconStyle} aria-hidden />
            <input
              id="su-name" type="text" required autoComplete="name" autoFocus
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder={tr("page.theNameYouWantToBe")} className={field} style={fieldPad}
            />
          </div>
        </div>

        <div>
          <label htmlFor="su-email" className={labelCls} style={labelStyle}>Email</label>
          <div className="relative">
            <Mail className={iconCls} style={iconStyle} aria-hidden />
            <input
              id="su-email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={tr("page.youExampleCom")} className={field} style={fieldPad}
            />
          </div>
        </div>

        <div>
          <label htmlFor="su-phone" className={labelCls} style={labelStyle}>
            Phone <span style={{ color: "var(--a-faint)" }}>— optional</span>
          </label>
          <div className="relative">
            <Phone className={iconCls} style={iconStyle} aria-hidden />
            <input
              id="su-phone" type="tel" autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210" className={field} style={fieldPad}
            />
          </div>
          <p className="mt-1 text-2xs leading-snug" style={{ color: "var(--a-faint)" }}>
            {tr("page.onlyToReachYouAboutYour")}
          </p>
        </div>

        <div>
          <label htmlFor="su-password" className={labelCls} style={labelStyle}>Password</label>
          <div className="relative">
            <Lock className={iconCls} style={iconStyle} aria-hidden />
            <input
              id="su-password" type={showPassword ? "text" : "password"} required
              autoComplete="new-password" minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("page.atLeast8Characters")} className={`${field} pe-12`} style={fieldPad}
            />
            <button
              type="button" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute end-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[12px]"
              style={{ color: "var(--a-muted)" }}
            >
              {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
            </button>
          </div>
          {strengthLabel && (
            <div className="mt-2 flex items-center gap-2.5">
              <span className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--a-track)" }}>
                <span
                  className="block h-full rounded-full transition-all duration-300"
                  style={{ width: `${strength}%`, background: strengthInk }}
                />
              </span>
              <span className="text-2xs font-medium" style={{ color: strengthInk }}>{strengthLabel}</span>
            </div>
          )}
        </div>

        {/* Said before she commits, not sprung on her on the next screen. */}
        <div
          className="flex items-start gap-2.5 rounded-[12px]"
          style={{
            padding: "clamp(0.625rem,1.6vh,0.875rem)",
            background: "var(--a-tint-violet)", border: "1px solid var(--a-edge-violet)",
          }}
        >
          <ShieldCheck className="mt-[1px] h-[17px] w-[17px] shrink-0" style={{ color: "var(--a-lilac)" }} aria-hidden />
          <p className="text-2xs leading-snug" style={{ color: "var(--a-ink-2)" }}>
            Next we ask for one photo ID. Only our review team can open it, and it
            is how this stays a space for women.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-go flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold"
          style={{ paddingBlock: "clamp(0.6875rem,1.8vh,1rem)" }}
        >
          {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : null}
          {loading ? "Creating your account…" : "Create my account"}
          {loading ? null : <ArrowRight className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </form>

      <p className="text-center text-xsm" style={{ color: "var(--a-muted)", marginTop: "clamp(0.625rem,2vh,1.5rem)" }}>
        Already have an account?{" "}
        <Link href="/signin" className="auth-link font-semibold">{tr("page.signIn")}</Link>
      </p>
    </div>
  );
}

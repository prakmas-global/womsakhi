"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";

import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import { AuthIcon, AuthResend, AuthShell, AuthStepsBar, MEMBER_CAPTION, Spinner, formatMobile, useStepHistory } from "@/components/auth-shell";
import { apiSignupComplete, apiSignupStart, apiSignupVerify, authError, type CodeSent } from "@/lib/auth-api";

/**
 * Joining WomSakhi — three short screens, no password. The approved screens:
 *
 *   B1  mobile + email          →  a code goes to her email
 *   B2  the 6-digit code        →  proves the email is hers
 *   B3  name + "woman, 18+"     →  the account exists
 *
 * Her selfie and ID come NEXT, on /app/verify, once the account exists: the ID
 * upload is where most sign-ups are abandoned, and a woman who stops there now
 * comes back to a half-finished application instead of an empty form.
 *
 * The mobile number is required and Indian (+91) for now. It is saved
 * unconfirmed; she confirms it by SMS after this.
 */

type Step = "contact" | "code" | "about";

const TEN_DIGITS = /^[6-9]\d{9}$/;

export default function SignUpPage() {
  const { locale } = useI18n();
  const { completeSignIn } = useAuth();

  const [step, setStep] = useState<Step>("contact");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [fullName, setFullName] = useState("");
  const [declared, setDeclared] = useState(false);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; mobile?: string; name?: string; declared?: string }>({});
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();

  const stepNumber = step === "contact" ? 1 : step === "code" ? 2 : 3;

  // Browser/phone Back walks the steps. Step 3 replaces the spent code, so
  // Back from it goes to step 1 (and drops the ticket); what she typed stays.
  const back = useStepHistory<Step>(step, (to) => {
    if (to === "about" && !ticket) to = "contact";
    if (to === "contact") setTicket("");
    setStep(to);
    setCode("");
    setError("");
    setInvalid(false);
  }, { replace: (to) => to === "about" });

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    const problems: typeof fieldErrors = {};
    if (!TEN_DIGITS.test(mobile)) problems.mobile = "Enter your 10-digit mobile number";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = "Enter your email address, like name@gmail.com";
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      document.getElementById(problems.mobile ? "su-mobile" : "su-email")?.focus();
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await apiSignupStart(email.trim(), `+91${mobile}`, locale || "en");
      setSent(result);
      setResendIn(result.resend_in);
      setCode("");
      setInvalid(false);
      setStep("code");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "resend_too_soon") setResendIn(Number(problem.extra.retry_after) || 30);
      if (step === "contact" && problem.status === 422 && /mobile|number/i.test(problem.message)) {
        setFieldErrors({ mobile: problem.message });
      } else if (step === "contact" && problem.status === 422 && /email/i.test(problem.message)) {
        setFieldErrors({ email: "Enter a real email address you can open" });
      } else {
        setError(problem.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        const result = await apiSignupVerify(email.trim(), value);
        if (result.signed_in) {
          // She already had an account; the code she was sent signs her in.
          completeSignIn(result);
          return;
        }
        setTicket(result.ticket);
        setStep("about");
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "phone_taken") {
          back("contact");
          setFieldErrors({ mobile: problem.message });
        } else if (problem.code === "email_taken") {
          setError(problem.message);
        } else {
          setInvalid(true);
          setError(problem.message);
          if (problem.code === "code_voided" || problem.code === "code_expired") setCode("");
        }
      } finally {
        setBusy(false);
      }
    },
    [back, busy, email, completeSignIn],
  );

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const problems: typeof fieldErrors = {};
    if (fullName.trim().replace(/\s+/g, " ").length < 2) problems.name = "Enter your full name";
    if (!declared) problems.declared = "Please confirm to continue";
    setFieldErrors(problems);
    if (Object.keys(problems).length) return;
    setError("");
    setBusy(true);
    try {
      const payload = await apiSignupComplete({ ticket, full_name: fullName.trim(), is_woman_18_plus: true, locale: locale || "en" });
      completeSignIn(payload);
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "ticket_expired") {
        back("contact");
        setError("That took a little too long. Please ask for a new code.");
      } else {
        setError(problem.message);
      }
      setBusy(false);
    }
  };

  return (
    <AuthShell
      photo={step === "code" ? "email" : "join"}
      caption={MEMBER_CAPTION}
      showTrust={step === "contact"}
      screen={`b${stepNumber}`}
      flow="member-join"
    >
      {/* B1 · mobile first, then email */}
      {step === "contact" && (
        <>
          <Link href="/signin" className="wsa-back"><AuthIcon name="back" /> Back to sign in</Link>
          <span className="wsa-join-eyebrow">Become a member</span>
          <h1 className="wsa-t">Join WomSakhi</h1>
          <p className="wsa-s wsa-join-intro">Create your secure account with a mobile number and an email you can open.</p>
          <AuthStepsBar step={stepNumber} total={3} />
          {error && <p role="alert" className="wsa-err">{error}</p>}
          <form onSubmit={sendCode} noValidate className="wsa-field">
            <label htmlFor="su-mobile" className="wsa-lbl">Mobile number</label>
            <div className={`wsa-phone${fieldErrors.mobile ? " is-bad" : ""}`}>
              <span className="wsa-cc" aria-hidden><span className="wsa-flag" />+91</span>
              <input id="su-mobile" type="tel" enterKeyHint="next" inputMode="numeric" autoComplete="tel-national" maxLength={11} autoFocus
                value={formatMobile(mobile)} placeholder="98765 43210" aria-invalid={!!fieldErrors.mobile}
                aria-describedby={fieldErrors.mobile ? "su-mobile-error" : undefined}
                onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10)); setFieldErrors((f) => ({ ...f, mobile: undefined })); setError(""); }} />
            </div>
            {fieldErrors.mobile && <p id="su-mobile-error" role="alert" className="wsa-ferr">{fieldErrors.mobile}</p>}

            <label htmlFor="su-email" className="wsa-lbl">Email</label>
            <div className={`wsa-in${fieldErrors.email ? " is-bad" : ""}`}>
              <AuthIcon name="mail" />
              <input id="su-email" type="email" enterKeyHint="go" autoComplete="email" inputMode="email"
                value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); setError(""); }}
                placeholder="name@gmail.com" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "su-email-error" : undefined} />
            </div>
            {fieldErrors.email && <p id="su-email-error" role="alert" className="wsa-ferr">{fieldErrors.email}</p>}

            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Sending your code…</> : <>Continue <AuthIcon name="arrow" /></>}
            </button>
          </form>
          <p className="wsa-link">Already a member? <Link href="/signin">Sign in</Link></p>
        </>
      )}

      {/* B2 · the email code */}
      {step === "code" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("contact")}>
            <AuthIcon name="back" /> Change email or number
          </button>
          <AuthStepsBar step={stepNumber} total={3} />
          <h1 className="wsa-t">Check your email</h1>
          <p className="wsa-s" id="su-code-help">We sent a 6-digit code to <b>{sent?.destination ?? email}</b></p>
          <CodeInput id="su-code" value={code} onChange={(v) => { setCode(v); setInvalid(false); setError(""); }}
            onComplete={verify} disabled={busy} invalid={invalid} describedBy="su-code-help" label="6-digit code from your email" />
          {error && <p role="alert" className="wsa-err">{error}</p>}
          {busy && <p className="wsa-muted" role="status">Checking…</p>}
          <AuthResend seconds={resendIn} onResend={() => void sendCode()} busy={busy} />
          <p className="wsa-note"><AuthIcon name="mail" /><span>Already have an account? The code we sent signs you in.</span></p>
        </>
      )}

      {/* B3 · name + declaration */}
      {step === "about" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("contact")}><AuthIcon name="back" /> Start again</button>
          <AuthStepsBar step={stepNumber} total={3} />
          <h1 className="wsa-t">Almost done</h1>
          {error && <p role="alert" className="wsa-err">{error}</p>}
          <form onSubmit={create} noValidate className="wsa-field">
            <label htmlFor="su-name" className="wsa-lbl">Full name</label>
            <div className={`wsa-in${fieldErrors.name ? " is-bad" : ""}`}>
              <AuthIcon name="user" />
              <input id="su-name" enterKeyHint="done" autoComplete="name" autoFocus autoCapitalize="words" maxLength={80}
                value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldErrors((f) => ({ ...f, name: undefined })); }}
                placeholder="As on your ID card" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "su-name-error" : undefined} />
            </div>
            {fieldErrors.name && <p id="su-name-error" role="alert" className="wsa-ferr">{fieldErrors.name}</p>}

            <button type="button" role="checkbox" aria-checked={declared} aria-describedby={fieldErrors.declared ? "su-declare-error" : undefined}
              className={`wsa-check${declared ? " is-on" : ""}${fieldErrors.declared ? " is-bad" : ""}`}
              onClick={() => { setDeclared((v) => !v); setFieldErrors((f) => ({ ...f, declared: undefined })); }}>
              <span className="wsa-bx">{declared && <AuthIcon name="check" />}</span>
              <span>
                <b>I am a woman, aged 18 or older</b>
                <small>By continuing you agree to the Terms and Privacy policy.</small>
              </span>
            </button>
            {fieldErrors.declared && <p id="su-declare-error" role="alert" className="wsa-ferr">{fieldErrors.declared}</p>}

            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Creating your account…</> : <>Create my account <AuthIcon name="arrow" /></>}
            </button>
          </form>
          <p className="wsa-note"><AuthIcon name="shield" /><span><b>Next:</b> confirm your mobile, then a selfie and ID photo.</span></p>
        </>
      )}
    </AuthShell>
  );
}

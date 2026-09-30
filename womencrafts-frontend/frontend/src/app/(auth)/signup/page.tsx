"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import { AuthIcon, AuthResend, AuthShell, AuthStepsBar, EmailTypoHint, MEMBER_CAPTION, Spinner, formatMobile, useStepHistory } from "@/components/auth-shell";
import { apiSignupComplete, apiSignupStart, apiSignupVerify, authError, type CodeSent } from "@/lib/auth-api";
import { PREVIEW_EMAIL, PREVIEW_MOBILE, PREVIEW_NAME, PREVIEW_SENT_EMAIL, PREVIEW_STATES, readPreview, type SignupPreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";
import { joinAboutSchema, joinContactSchema } from "@/lib/validation";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

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

/**
 * The invite code from `/signup?ref=CODE` (Refer a friend). It is kept in
 * sessionStorage so it survives the code step, the browser's Back button and a
 * reload of this tab, and is sent once with `signup/complete`. The server
 * checks it; here it is only shape-checked so a mangled link shows nothing.
 */
const REF_KEY = "ws.signup.ref";
const REF_SHAPE = /^[A-Za-z0-9-]{3,20}$/;

function readRef(params: URLSearchParams): string {
  const fromLink = (params.get("ref") || "").trim();
  try {
    if (REF_SHAPE.test(fromLink)) {
      window.sessionStorage.setItem(REF_KEY, fromLink.toUpperCase());
      return fromLink.toUpperCase();
    }
    const kept = window.sessionStorage.getItem(REF_KEY) || "";
    return REF_SHAPE.test(kept) ? kept : "";
  } catch {
    // Storage blocked (private mode): the link itself still carries it.
    return REF_SHAPE.test(fromLink) ? fromLink.toUpperCase() : "";
  }
}

function forgetRef() {
  try { window.sessionStorage.removeItem(REF_KEY); } catch { /* storage blocked */ }
}

/** Mobile as she types it: digits only, a pasted +91 / 0 dropped, at most 10. */
const typedMobile = (raw: string) => raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10);

export default function SignUpPage() {
  const { locale } = useI18n();
  const { completeSignIn } = useAuth();

  const [step, setStep] = useState<Step>("contact");
  /** The email and mobile the code went to (set once step 1 passes its checks). */
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");

  // Errors show when she leaves a field or presses submit, and clear as soon
  // as the value is right (lib/validation).
  const contactForm = useForm({
    resolver: zodResolver(joinContactSchema), mode: "onTouched", reValidateMode: "onChange",
    defaultValues: { mobile: "", email: "" },
  });
  const aboutForm = useForm({
    resolver: zodResolver(joinAboutSchema), mode: "onTouched", reValidateMode: "onChange",
    defaultValues: { fullName: "", declaration: false },
  });
  const contactErrors = contactForm.formState.errors;
  const aboutErrors = aboutForm.formState.errors;
  const typedEmail = useWatch({ control: contactForm.control, name: "email" });

  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  /** Local-only `?preview=`: fixtures instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<SignupPreview | null>(null);
  /** The friend's invite code, if she came from a referral link. */
  const [invitedBy, setInvitedBy] = useState("");

  // `?ref=` (kept for the whole join) and `?email=` (from sign-in's "Join
  // WomSakhi" link). Read after mount, like the preview switch below: the
  // server render has no URL to read.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => {
      setInvitedBy(readRef(params));
      const preset = (params.get("email") || "").trim();
      if (preset && !contactForm.getValues("email")) contactForm.setValue("email", preset);
    });
    return () => window.clearTimeout(t);
  }, [contactForm]);

  useEffect(() => {
    if (!AUTH_PREVIEW) return;
    const p = readPreview(PREVIEW_STATES.signup);
    if (!p) return;
    const t = window.setTimeout(() => {
      setPreview(p);
      if (p === "contact") return;
      setMobile(PREVIEW_MOBILE);
      setEmail(PREVIEW_EMAIL);
      contactForm.reset({ mobile: PREVIEW_MOBILE, email: PREVIEW_EMAIL });
      setSent(PREVIEW_SENT_EMAIL);
      setTicket("preview-ticket");
      if (p === "about") aboutForm.setValue("fullName", PREVIEW_NAME);
      else setResendIn(30);
      setStep(p);
    });
    return () => window.clearTimeout(t);
  }, [setResendIn, contactForm, aboutForm]);

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

  /** Send the code — step 1's submit (values already checked), and "Send a new code". */
  const sendCode = async (to: { email: string; mobile: string }) => {
    setEmail(to.email);
    setMobile(to.mobile);
    if (AUTH_PREVIEW && preview) { setSent(PREVIEW_SENT_EMAIL); setResendIn(30); setStep("code"); return; }
    setError("");
    setBusy(true);
    try {
      const result = await apiSignupStart(to.email, `+91${to.mobile}`, locale || "en");
      setSent(result);
      setResendIn(result.resend_in);
      setCode("");
      setInvalid(false);
      setStep("code");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "resend_too_soon") setResendIn(Number(problem.extra.retry_after) || 30);
      if (step === "contact" && problem.status === 422 && /mobile|number/i.test(problem.message)) {
        contactForm.setError("mobile", { type: "server", message: problem.message }, { shouldFocus: true });
      } else if (step === "contact" && problem.status === 422 && /email/i.test(problem.message)) {
        contactForm.setError("email", { type: "server", message: "Enter a real email address you can open" }, { shouldFocus: true });
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
      if (AUTH_PREVIEW && preview) { setTicket("preview-ticket"); setStep("about"); return; }
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        const result = await apiSignupVerify(email.trim(), value);
        if (result.signed_in) {
          // She already had an account; the code she was sent signs her in.
          forgetRef();
          completeSignIn(result);
          return;
        }
        setTicket(result.ticket);
        setStep("about");
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "phone_taken") {
          back("contact");
          contactForm.setError("mobile", { type: "server", message: problem.message });
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
    [back, busy, email, completeSignIn, preview, contactForm],
  );

  const create = async ({ fullName }: { fullName: string }) => {
    if (AUTH_PREVIEW && preview) return;
    setError("");
    setBusy(true);
    try {
      const payload = await apiSignupComplete({
        ticket, full_name: fullName, is_woman_18_plus: true, locale: locale || "en", ...(invitedBy ? { ref: invitedBy } : {}),
      });
      forgetRef();
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
          <form onSubmit={(e) => void contactForm.handleSubmit(sendCode)(e)} noValidate className="wsa-field">
            <label htmlFor="su-mobile" className="wsa-lbl">Mobile number</label>
            <div className={`wsa-phone${contactErrors.mobile ? " is-bad" : ""}`}>
              <span className="wsa-cc" aria-hidden><span className="wsa-flag" />+91</span>
              <Controller name="mobile" control={contactForm.control} render={({ field }) => (
                <input id="su-mobile" type="tel" enterKeyHint="next" inputMode="numeric" autoComplete="tel-national" maxLength={11} autoFocus
                  ref={field.ref} name={field.name} onBlur={field.onBlur}
                  value={formatMobile(field.value)} placeholder="98765 43210" aria-invalid={!!contactErrors.mobile}
                  aria-describedby={contactErrors.mobile ? "su-mobile-error" : undefined}
                  onChange={(e) => { field.onChange(typedMobile(e.target.value)); setError(""); }} />
              )} />
            </div>
            {contactErrors.mobile && <p id="su-mobile-error" role="alert" className="wsa-ferr">{contactErrors.mobile.message}</p>}

            <label htmlFor="su-email" className="wsa-lbl">Email</label>
            <div className={`wsa-in${contactErrors.email ? " is-bad" : ""}`}>
              <AuthIcon name="mail" />
              {/* A Controller like the mobile above, so the fields register in screen order and a failed submit focuses the first bad one. */}
              <Controller name="email" control={contactForm.control} render={({ field }) => (
                <input id="su-email" type="email" enterKeyHint="go" autoComplete="email" inputMode="email"
                  ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value}
                  onChange={(e) => { field.onChange(e.target.value); setError(""); }}
                  placeholder="name@gmail.com" aria-invalid={!!contactErrors.email} aria-describedby={contactErrors.email ? "su-email-error" : undefined} />
              )} />
            </div>
            {contactErrors.email ? (
              <p id="su-email-error" role="alert" className="wsa-ferr">{contactErrors.email.message}</p>
            ) : (
              <EmailTypoHint value={typedEmail} onPick={(fixed) => contactForm.setValue("email", fixed, { shouldValidate: true })} />
            )}

            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Sending your code…</> : <>Continue <AuthIcon name="arrow" /></>}
            </button>
          </form>
          {invitedBy && (
            <p className="wsa-note" data-testid="invited-note">
              <AuthIcon name="user" /><span><b>Invited by a friend</b> · <span style={{ whiteSpace: "nowrap" }}>code {invitedBy}</span></span>
            </p>
          )}
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
          <AuthResend seconds={resendIn} onResend={() => void sendCode({ email, mobile })} busy={busy} />
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
          <form onSubmit={(e) => void aboutForm.handleSubmit(create)(e)} noValidate className="wsa-field">
            <label htmlFor="su-name" className="wsa-lbl">Full name</label>
            <div className={`wsa-in${aboutErrors.fullName ? " is-bad" : ""}`}>
              <AuthIcon name="user" />
              <input id="su-name" enterKeyHint="done" autoComplete="name" autoFocus autoCapitalize="words" maxLength={80}
                {...aboutForm.register("fullName")}
                placeholder="As on your ID card" aria-invalid={!!aboutErrors.fullName} aria-describedby={aboutErrors.fullName ? "su-name-error" : undefined} />
            </div>
            {aboutErrors.fullName && <p id="su-name-error" role="alert" className="wsa-ferr">{aboutErrors.fullName.message}</p>}

            <Controller name="declaration" control={aboutForm.control} render={({ field }) => (
              <button type="button" role="checkbox" aria-checked={field.value} ref={field.ref} onBlur={field.onBlur}
                aria-invalid={!!aboutErrors.declaration} aria-describedby={aboutErrors.declaration ? "su-declare-error" : undefined}
                className={`wsa-check${field.value ? " is-on" : ""}${aboutErrors.declaration ? " is-bad" : ""}`}
                onClick={() => field.onChange(!field.value)}>
                <span className="wsa-bx">{field.value && <AuthIcon name="check" />}</span>
                <span>
                  <b>I am a woman, aged 18 or older</b>
                  <small>By continuing you agree to the Terms and Privacy policy.</small>
                </span>
              </button>
            )} />
            {aboutErrors.declaration && <p id="su-declare-error" role="alert" className="wsa-ferr">{aboutErrors.declaration.message}</p>}

            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Creating your account…</> : <>Create my account <AuthIcon name="arrow" /></>}
            </button>
          </form>
          <p className="wsa-note"><AuthIcon name="shield" /><span><b>Next:</b> confirm your mobile, then a selfie and ID photo.</span></p>
        </>
      )}
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </AuthShell>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import {
  AuthIcon, AuthResend, AuthShell, EmailTypoHint, MEMBER_CAPTION, STAFF_CAPTION, Spinner, StaffAside, formatMobile, useStepHistory, type AuthPhoto,
} from "@/components/auth-shell";
import {
  apiAuthOptions, apiSigninFirebase, apiSigninStart, apiSmsAllowance, apiSigninVerify, apiTwoFactorEnroll, apiTwoFactorVerify, authError,
  type AuthOptions, type CodeSent,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import type { AuthPayload } from "@/lib/api";
import {
  PREVIEW_MOBILE, PREVIEW_OPTIONS, PREVIEW_RECOVERY_CODES, PREVIEW_SENT_EMAIL, PREVIEW_SETUP, PREVIEW_STAFF_PAYLOAD, PREVIEW_STATES, PREVIEW_WRONG_CODE, readPreview, type SigninPreview,
} from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";
import { codeSchema, recoveryCode, signinEmailSchema, signinMobileSchema } from "@/lib/validation";
import { safeNext } from "@/lib/safe-next";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Signing in — with a code, never a password. The approved screens:
 *
 *   A1 mobile  →  A2 SMS code (A3 wrong code)  →  in
 *   A4 email   →  A5 email code                →  in
 *   A6 today's SMS allowance is used up → email, with the reason
 *
 * Mobile comes first whenever SMS codes are switched on (`options.phone_codes`);
 * otherwise the screen opens on email. Staff go one step further, to their
 * authenticator app (D3); the first time, the same screen sets it up (D1) and
 * hands over the recovery codes (D2).
 *
 * `?email=` pre-fills the address (links from invitation and "you already have
 * an account" emails) and opens on email; `?next=` is where to land afterwards.
 */

type Step = "phone" | "sms" | "email" | "code" | "mfa" | "setup" | "recovery";

const RECAPTCHA_ID = "signin-recaptcha";

interface SetupInfo {
  ticket: string;
  secret: string;
  provisioning_uri: string;
  qr_svg: string;
}


const recoverySchema = z.object({ recovery: recoveryCode });

/** Mobile as she types it: digits only, a pasted +91 / 0 dropped, at most 10. */
const typedMobile = (raw: string) => raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10);

/** "Enter all 6 digits" when a code is sent short; "" when it is whole. */
const codeProblem = (value: string) => codeSchema.safeParse({ code: value }).error?.issues[0]?.message ?? "";

const PHOTO: Record<Step, AuthPhoto> = {
  phone: "signin", sms: "signin", email: "signin", code: "email", mfa: "plain", setup: "plain", recovery: "plain",
};

export default function SignInPage() {
  const { completeSignIn } = useAuth();

  const [step, setStep] = useState<Step | null>(null);
  const [email, setEmail] = useState("");
  const [next, setNext] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  const [smsLimited, setSmsLimited] = useState(false);

  const [mfaTicket, setMfaTicket] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  /** The client-side check on a code sent short (Enter / Verify before 6 digits). */
  const [codeError, setCodeError] = useState("");
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [recovery, setRecovery] = useState<{ codes: string[]; payload: AuthPayload } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

  // Phone sign-in, offered only once SMS codes are switched on.
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [mobile, setMobile] = useState("");
  const smsConfirmation = useRef<SmsConfirmation | null>(null);
  /** Local-only `?preview=`: fixtures instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<SigninPreview | null>(null);
  const smsOn = !!options?.phone_codes;
  const viaFirebase = smsOn && !!options?.firebase;

  // One form per field set. Errors show when she leaves a field or presses
  // submit, and clear as soon as the value is right (lib/validation).
  const mobileForm = useForm({ resolver: zodResolver(signinMobileSchema), mode: "onTouched", reValidateMode: "onChange", defaultValues: { mobile: "" } });
  const emailForm = useForm({ resolver: zodResolver(signinEmailSchema), mode: "onTouched", reValidateMode: "onChange", defaultValues: { email: "" } });
  const recoveryForm = useForm({ resolver: zodResolver(recoverySchema), mode: "onTouched", reValidateMode: "onChange", defaultValues: { recovery: "" } });
  const mobileError = mobileForm.formState.errors.mobile?.message;
  const emailError = emailForm.formState.errors.email?.message;
  const recoveryError = recoveryForm.formState.errors.recovery?.message;
  const typedEmail = useWatch({ control: emailForm.control, name: "email" });

  const goTo = (s: Step) => {
    setStep(s);
    setCode("");
    setCodeError("");
    setError("");
    setInvalid(false);
    setUseRecovery(false);
  };

  // Browser/phone Back walks the steps. The code she just used is replaced by
  // what it unlocked (so Back from the authenticator lands on email sign-in),
  // and the once-only recovery codes hold their ground.
  const back = useStepHistory<Step>(step, (to) => {
    if ((to === "setup" && !setup) || (to === "recovery" && !recovery) || (to === "mfa" && !mfaTicket)) to = "email";
    if (to === "phone") setSmsLimited(false);
    goTo(to);
  }, {
    replace: (to) => to === "mfa" || to === "setup" || to === "recovery",
    lock: (at) => at === "recovery",
  });

  // Read the URL after mount (the server render has no URL), then ask the API
  // whether SMS codes are on: that decides which screen she lands on.
  useEffect(() => {
    if (AUTH_PREVIEW) {
      const p = readPreview(PREVIEW_STATES.signin);
      if (p) {
        const t = window.setTimeout(() => {
          setPreview(p);
          setOptions(PREVIEW_OPTIONS);
          setMobile(PREVIEW_MOBILE);
          mobileForm.setValue("mobile", PREVIEW_MOBILE);
          setSent(PREVIEW_SENT_EMAIL);
          setMfaTicket(PREVIEW_SETUP.ticket);
          setSetup(PREVIEW_SETUP);
          setRecovery({ codes: PREVIEW_RECOVERY_CODES, payload: PREVIEW_STAFF_PAYLOAD });
          setSmsLimited(p === "sms-busy");
          if (p === "sms" || p === "code") setResendIn(30);
          if (p === "sms-wrong") { setCode("123456"); setInvalid(true); setError(PREVIEW_WRONG_CODE); }
          setStep(p === "sms-busy" ? "email" : p === "sms-wrong" ? "sms" : p);
        });
        return () => window.clearTimeout(t);
      }
    }
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("email");
    const t = window.setTimeout(() => {
      if (preset) { setEmail(preset); emailForm.setValue("email", preset); }
      setNext(safeNext(params.get("next")));
    });
    apiAuthOptions()
      .then((o) => {
        if (!alive) return;
        setOptions(o);
        setStep((s) => s ?? (o.phone_codes && !preset ? "phone" : "email"));
      })
      .catch(() => {
        if (!alive) return;
        setOptions(null);
        setStep((s) => s ?? "email");
      });
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [setResendIn, mobileForm, emailForm]);

  const finish = useCallback(
    (payload: AuthPayload) => {
      if (AUTH_PREVIEW && preview) return;
      completeSignIn(payload, next || undefined);
    },
    [completeSignIn, next, preview],
  );

  /** Send a code to `address` (already checked) — the email step's submit, and "Send a new code". */
  const sendCode = async (address: string) => {
    if (AUTH_PREVIEW && preview) { setSent(PREVIEW_SENT_EMAIL); setResendIn(30); setStep("code"); return; }
    setError("");
    setBusy(true);
    try {
      const result = await apiSigninStart({ email: address });
      setEmail(address);
      setSent(result);
      setResendIn(result.resend_in);
      setCode("");
      setInvalid(false);
      setStep("code");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "resend_too_soon" && step === "code") {
        setResendIn(Number(problem.extra.retry_after) || 30);
      }
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy || (AUTH_PREVIEW && preview)) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        finish(await apiSigninVerify({ email: email.trim(), code: value }));
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "two_factor_required") {
          setMfaTicket(String(problem.extra.ticket ?? ""));
          setCode("");
          setStep("mfa");
        } else if (problem.code === "two_factor_setup_required") {
          setSetup({
            ticket: String(problem.extra.ticket ?? ""),
            secret: String(problem.extra.secret ?? ""),
            provisioning_uri: String(problem.extra.provisioning_uri ?? ""),
            qr_svg: String(problem.extra.qr_svg ?? ""),
          });
          setCode("");
          setStep("setup");
        } else {
          setInvalid(true);
          setError(problem.message);
          if (problem.code === "code_voided" || problem.code === "code_expired") setCode("");
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, email, finish, preview],
  );

  const verifyAuthenticator = useCallback(
    async (value: string) => {
      if (busy || (AUTH_PREVIEW && preview)) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        finish(await apiTwoFactorVerify(mfaTicket, value));
      } catch (err) {
        const problem = authError(err);
        setInvalid(true);
        setError(problem.message);
        if (problem.code === "ticket_expired") back("email");
      } finally {
        setBusy(false);
      }
    },
    [back, busy, finish, mfaTicket, preview],
  );

  const enroll = useCallback(
    async (value: string) => {
      if (!setup || value.length !== 6 || busy) return;
      if (AUTH_PREVIEW && preview) { setStep("recovery"); return; }
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        const result = await apiTwoFactorEnroll(setup.ticket, value);
        setRecovery({ codes: result.recovery_codes, payload: result });
        setStep("recovery");
      } catch (err) {
        const problem = authError(err);
        setInvalid(true);
        setError(problem.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, setup, preview],
  );

  /** Send an SMS code to `digits` (10 digits, already checked) — the mobile step's submit, and "Send a new code". */
  const sendSms = async (digits: string) => {
    if (!options?.phone_codes) {
      setError("Sign in with a mobile number isn't available right now. Please use email.");
      return;
    }
    setMobile(digits);
    if (AUTH_PREVIEW && preview) { setResendIn(30); setCode(""); setInvalid(false); setStep("sms"); return; }
    setError("");
    setBusy(true);
    try {
      if (options.firebase) {
        await apiSmsAllowance(`+91${digits}`, "signin");
        smsConfirmation.current = await sendSmsCode(options.firebase, `+91${digits}`, RECAPTCHA_ID);
        setResendIn(options.resend_seconds || 90);
      } else {
        const sentTo = await apiSigninStart({ phone: `+91${digits}` });
        setResendIn(sentTo.resend_in);
      }
      setCode("");
      setInvalid(false);
      setStep("sms");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "sms_limit") {
        // Out of SMS for today: over to email, with the reason (A6).
        setSmsLimited(true);
        setCode("");
        setInvalid(false);
        setStep("email");
        return;
      }
      setError(problem.status ? problem.message : smsErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verifySms = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy || (AUTH_PREVIEW && preview) || (viaFirebase && !smsConfirmation.current)) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        if (viaFirebase && smsConfirmation.current) {
          finish(await apiSigninFirebase(await confirmSmsCode(smsConfirmation.current, value)));
        } else {
          finish(await apiSigninVerify({ phone: `+91${mobile}`, code: value }));
        }
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "sms_limit") {
          setSmsLimited(true);
          setStep("email");
        } else {
          setInvalid(true);
          setError(problem.status ? problem.message : smsErrorMessage(err));
        }
        setBusy(false);
      }
    },
    [busy, finish, mobile, viaFirebase, preview],
  );

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  const onCode = (v: string) => {
    setCode(v);
    setInvalid(false);
    setError("");
    if (codeError && !codeProblem(v)) setCodeError("");
  };
  /** A submit before all six digits are in: say so under the boxes. Returns whether the code is whole. */
  const checkCode = (value: string) => {
    const problem = codeProblem(value);
    setCodeError(problem);
    if (problem) document.getElementById(step === "sms" ? "si-sms" : step === "mfa" ? "si-mfa" : "si-code")?.focus();
    return !problem;
  };
  const submitCode = (e: FormEvent, run: (value: string) => unknown) => {
    e.preventDefault();
    if (checkCode(code)) void run(code);
  };
  const staff = step === "mfa" || step === "setup" || step === "recovery";
  const screen = step === "phone" ? "a1"
    : step === "sms" ? (invalid ? "a3" : "a2")
      : step === "email" ? (smsLimited ? "a6" : "a4")
        : step === "code" ? "a5"
          : step === "setup" ? "d1"
            : step === "recovery" ? "d2"
              : step === "mfa" ? "d3"
                : undefined;

  return (
    <AuthShell
      photo={step ? PHOTO[step] : "signin"}
      caption={staff ? STAFF_CAPTION : MEMBER_CAPTION}
      tag={staff ? "Staff" : undefined}
      aside={staff ? <StaffAside /> : undefined}
      showTrust={step === "phone"}
      screen={screen}
      flow={staff ? "staff-signin" : "member-signin"}
      // Google's invisible robot check attaches here before each SMS.
      footer={<div id={RECAPTCHA_ID} style={{ position: "absolute" }} />}
    >
      {step === null && (
        <p className="wsa-muted" role="status" style={{ padding: "2rem 0" }}>Opening sign in…</p>
      )}

      {/* A1 · mobile first */}
      {step === "phone" && (
        <>
          <div className="wsa-methods" role="tablist" aria-label="Choose how to sign in">
            <button type="button" role="tab" aria-selected="true"><AuthIcon name="phone" /> Mobile</button>
            <button type="button" role="tab" aria-selected="false" onClick={() => { setSmsLimited(false); goTo("email"); }}><AuthIcon name="mail" /> Email</button>
          </div>
          <p className="wsa-eyebrow">Welcome back</p>
          <h1 className="wsa-t">Sign in with your mobile</h1>
          <p className="wsa-s">We&apos;ll send a 6-digit code by SMS. No password needed.</p>
          <form onSubmit={(e) => void mobileForm.handleSubmit(({ mobile: digits }) => sendSms(digits))(e)} noValidate className="wsa-field">
            <label htmlFor="si-mobile" className="wsa-lbl">Mobile number</label>
            <div className={`wsa-phone${error || mobileError ? " is-bad" : ""}`}>
              <span className="wsa-cc" aria-hidden><span className="wsa-flag" />+91</span>
              <Controller name="mobile" control={mobileForm.control} render={({ field }) => (
                <input id="si-mobile" type="tel" enterKeyHint="send" inputMode="numeric" autoComplete="tel-national" maxLength={11} autoFocus
                  ref={field.ref} name={field.name} onBlur={field.onBlur}
                  value={formatMobile(field.value)} placeholder="98765 43210" aria-invalid={!!(error || mobileError) || undefined}
                  aria-describedby={[mobileError && "si-mobile-error", error && "si-mobile-server-error"].filter(Boolean).join(" ") || undefined}
                  onChange={(e) => { field.onChange(typedMobile(e.target.value)); setError(""); }} />
              )} />
            </div>
            {mobileError && <p id="si-mobile-error" role="alert" className="wsa-ferr">{mobileError}</p>}
            {error && <p id="si-mobile-server-error" role="alert" className="wsa-err">{error}</p>}
            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Sending your code…</> : <>Send code <AuthIcon name="arrow" /></>}
            </button>
          </form>
          <div className="wsa-or wsa-member-alt">or</div>
          <button type="button" className="wsa-btn wsa-line wsa-member-alt" onClick={() => { setSmsLimited(false); goTo("email"); }}>
            <AuthIcon name="mail" /> Sign in with email
          </button>
          <p className="wsa-link">New to WomSakhi? <Link href="/signup">Join now</Link></p>
        </>
      )}

      {/* A2 · SMS code, A3 · wrong code */}
      {step === "sms" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("phone")}><AuthIcon name="back" /> Change number</button>
          <p className="wsa-eyebrow">{invalid ? "Check your code" : "SMS verification"}</p>
          <h1 className="wsa-t">Enter the code</h1>
          {!invalid && <p className="wsa-s" id="si-sms-help">Sent by SMS to <b>+91 {formatMobile(mobile)}</b></p>}
          <form onSubmit={(e) => submitCode(e, verifySms)} noValidate style={{ display: "contents" }}>
            <CodeInput id="si-sms" value={code} onChange={onCode} onComplete={verifySms} disabled={busy} invalid={invalid || !!codeError}
              describedBy={codeError ? "si-sms-field-error" : invalid ? "si-sms-error" : "si-sms-help"} label="6-digit code from the SMS" />
          </form>
          {codeError && <p id="si-sms-field-error" role="alert" className="wsa-ferr">{codeError}</p>}
          {invalid ? (
            <>
              <p id="si-sms-error" role="alert" className="wsa-err">{error}</p>
              <AuthResend seconds={resendIn} onResend={() => void sendSms(mobile)} busy={busy} />
              <p className="wsa-link">Trouble with SMS?{" "}
                <button type="button" className="wsa-inline" onClick={() => { setSmsLimited(false); goTo("email"); }}>Use email instead</button>
              </p>
            </>
          ) : (
            <>
              {error && <p role="alert" className="wsa-err">{error}</p>}
              <AuthResend seconds={resendIn} onResend={() => void sendSms(mobile)} busy={busy} />
              <p className="wsa-note"><AuthIcon name="msg" /><span>On Android the code fills in by itself when the SMS arrives.</span></p>
              <button type="button" className="wsa-btn wsa-go" disabled={busy} onClick={() => { if (checkCode(code)) void verifySms(code); }}>
                {busy ? <><Spinner /> Checking…</> : "Verify"}
              </button>
            </>
          )}
        </>
      )}

      {/* A4 · email, A6 · SMS allowance used up */}
      {step === "email" && (
        <>
          {smsOn && (
            <button type="button" className={`wsa-back${smsLimited ? "" : " wsa-method-back"}`} onClick={() => back("phone")}>
              <AuthIcon name="back" /> {smsLimited ? "Change number" : "Use mobile instead"}
            </button>
          )}
          {!smsLimited && smsOn && (
            <div className="wsa-methods" role="tablist" aria-label="Choose how to sign in">
              <button type="button" role="tab" aria-selected="false" onClick={() => back("phone")}><AuthIcon name="phone" /> Mobile</button>
              <button type="button" role="tab" aria-selected="true"><AuthIcon name="mail" /> Email</button>
            </div>
          )}
          <p className="wsa-eyebrow">{smsLimited ? "Secure email fallback" : "Passwordless access"}</p>
          {smsLimited && (
            <p className="wsa-warn" role="status"><b>SMS is busy right now.</b> We&apos;ll send your code by email instead. It&apos;s just as safe.</p>
          )}
          <h1 className="wsa-t">Sign in with email</h1>
          {!smsLimited && <p className="wsa-s">We&apos;ll send a 6-digit code to your inbox.</p>}
          <form onSubmit={(e) => void emailForm.handleSubmit(({ email: address }) => sendCode(address))(e)} noValidate className="wsa-field">
            {!smsLimited && <label htmlFor="si-email" className="wsa-lbl">Email</label>}
            <div className={`wsa-in${error || emailError ? " is-bad" : ""}`}>
              <AuthIcon name="mail" />
              <input id="si-email" type="email" enterKeyHint="send" autoComplete="email" autoFocus inputMode="email"
                aria-label={smsLimited ? "Email" : undefined} aria-invalid={!!(error || emailError) || undefined}
                aria-describedby={[emailError && "si-email-error", error && "si-email-server-error"].filter(Boolean).join(" ") || undefined}
                {...emailForm.register("email", { onChange: () => setError("") })} placeholder="name@gmail.com" />
            </div>
            {emailError && <p id="si-email-error" role="alert" className="wsa-ferr">{emailError}</p>}
            {!emailError && (
              <EmailTypoHint value={typedEmail} onPick={(fixed) => emailForm.setValue("email", fixed, { shouldValidate: true })} />
            )}
            {error && <p id="si-email-server-error" role="alert" className="wsa-err">{error}</p>}
            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Sending your code…</> : <>Send code <AuthIcon name="arrow" /></>}
            </button>
          </form>
          {!smsLimited && <p className="wsa-note"><AuthIcon name="lock" /><span>Staff always sign in with email and their authenticator app.</span></p>}
          <p className="wsa-link">New to WomSakhi? <Link href="/signup">Join now</Link></p>
        </>
      )}

      {/* A5 · email code */}
      {step === "code" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("email")}><AuthIcon name="back" /> Use a different email</button>
          <p className="wsa-eyebrow">Email verification</p>
          <h1 className="wsa-t">Check your email</h1>
          <p className="wsa-s" id="si-code-help">If <b>{sent?.destination ?? email}</b> has an account, a code is on its way.</p>
          <form onSubmit={(e) => submitCode(e, verify)} noValidate style={{ display: "contents" }}>
            <CodeInput id="si-code" value={code} onChange={onCode} onComplete={verify} disabled={busy} invalid={invalid || !!codeError}
              describedBy={codeError ? "si-code-help si-code-error" : "si-code-help"} label="6-digit code from your email" />
          </form>
          {codeError && <p id="si-code-error" role="alert" className="wsa-ferr">{codeError}</p>}
          {error && <p role="alert" className="wsa-err">{error}</p>}
          {busy && <p className="wsa-muted" role="status">Checking…</p>}
          {/* The server answers "if it has an account" for every address, so a
              stranger cannot learn who is a member. This line is how a woman
              who never joined finds out what to do instead of waiting. */}
          <p className="wsa-link" data-testid="no-account-hint">
            No code after a minute? You may not have an account yet —{" "}
            <Link href={`/signup${email ? `?email=${encodeURIComponent(email)}` : ""}`}>Join WomSakhi</Link>
          </p>
          <AuthResend seconds={resendIn} onResend={() => void sendCode(email)} busy={busy} />
          <p className="wsa-note"><AuthIcon name="mail" /><span>Can&apos;t find it? Look in Spam or Promotions. The code expires in 5 minutes.</span></p>
        </>
      )}

      {/* D3 · authenticator code */}
      {step === "mfa" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("email")}><AuthIcon name="back" /> Back to sign in</button>
          <div className="wsa-okhero"><span><AuthIcon name="shield" /></span></div>
          <h1 className="wsa-t wsa-center">One more step</h1>
          <p className="wsa-s wsa-center" id="si-mfa-help">
            {useRecovery ? "Enter one of the recovery codes you saved." : "Enter the 6-digit code from your authenticator app."}
          </p>
          {!useRecovery ? (
            <>
              <form onSubmit={(e) => submitCode(e, verifyAuthenticator)} noValidate style={{ display: "contents" }}>
                <CodeInput id="si-mfa" value={code} onChange={onCode} onComplete={verifyAuthenticator} disabled={busy} invalid={invalid || !!codeError}
                  describedBy={codeError ? "si-mfa-help si-mfa-error" : "si-mfa-help"} label="Authenticator code" />
              </form>
              {codeError && <p id="si-mfa-error" role="alert" className="wsa-ferr">{codeError}</p>}
            </>
          ) : (
            <form className="wsa-field" noValidate onSubmit={(e) => void recoveryForm.handleSubmit(({ recovery: value }) => verifyAuthenticator(value))(e)}>
              <label htmlFor="si-recovery" className="wsa-lbl">Recovery code</label>
              <div className={`wsa-in${error || recoveryError ? " is-bad" : ""}`}>
                <AuthIcon name="key" />
                <Controller name="recovery" control={recoveryForm.control} render={({ field }) => (
                  <input id="si-recovery" enterKeyHint="go" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    ref={field.ref} name={field.name} onBlur={field.onBlur} value={field.value}
                    onChange={(e) => { field.onChange(e.target.value.toUpperCase()); setError(""); }}
                    aria-invalid={!!(error || recoveryError) || undefined}
                    aria-describedby={recoveryError ? "si-recovery-error" : "si-mfa-help"}
                    placeholder="ABCD-1234" />
                )} />
              </div>
              {recoveryError && <p id="si-recovery-error" role="alert" className="wsa-ferr">{recoveryError}</p>}
              <button type="submit" disabled={busy} className="wsa-btn wsa-go">
                {busy ? <><Spinner /> Checking…</> : "Sign in"}
              </button>
            </form>
          )}
          {error && <p role="alert" className="wsa-err">{error}</p>}
          <p className="wsa-link">
            {useRecovery ? "Found your phone? " : "Lost your phone? "}
            <button type="button" className="wsa-inline" onClick={() => { setUseRecovery((v) => !v); setError(""); setInvalid(false); setCodeError(""); recoveryForm.clearErrors(); }}>
              {useRecovery ? "Use the authenticator app" : "Use a recovery code"}
            </button>
          </p>
        </>
      )}

      {/* D1 · authenticator setup, the first staff sign-in */}
      {step === "setup" && setup && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("email")}><AuthIcon name="back" /> Back to sign in</button>
          <h1 className="wsa-t">Protect your staff account</h1>
          <p className="wsa-s wsa-steps-line"><span>1 · Install Google Authenticator</span> <span>2 · Scan</span> <span>3 · Enter the code</span></p>
          {setup.qr_svg && (
            <div className="wsa-qr" role="img" aria-label="QR code for your authenticator app"
              dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
          )}
          <button type="button" className="wsa-key" onClick={() => void copy(setup.secret, "secret")}
            aria-label={`Setup key ${setup.secret}. Copy`}>
            {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
            <small>{copied === "secret" ? "Copied" : "Copy"}</small>
          </button>
          {setup.provisioning_uri && (
            <p className="wsa-link wsa-only-phone"><a href={setup.provisioning_uri}>On this phone? Open in your authenticator app</a></p>
          )}
          <CodeInput id="si-setup" value={code} onChange={onCode} onComplete={enroll} disabled={busy} invalid={invalid}
            autoFocus={false} label="Code from your authenticator app" />
          {error && <p role="alert" className="wsa-err">{error}</p>}
        </>
      )}

      {/* D2 · recovery codes */}
      {step === "recovery" && recovery && (
        <>
          <h1 className="wsa-t">Save your recovery codes</h1>
          <p className="wsa-s">Each one signs you in once if you lose your phone.</p>
          <div className="wsa-codes">{recovery.codes.map((c) => <code key={c}>{c}</code>)}</div>
          <button type="button" className={`wsa-check${saved ? " is-on" : ""}`} role="checkbox" aria-checked={saved} onClick={() => setSaved((v) => !v)}>
            <span className="wsa-bx">{saved && <AuthIcon name="check" />}</span>
            <span><b>I&apos;ve saved my recovery codes</b></span>
          </button>
          <button type="button" disabled={!saved} onClick={() => finish(recovery.payload)} className="wsa-btn wsa-go">
            Continue to dashboard
          </button>
        </>
      )}
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </AuthShell>
  );
}

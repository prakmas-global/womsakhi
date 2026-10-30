"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import {
  AuthIcon, AuthResend, AuthShell, EmailTypoHint, MEMBER_CAPTION, STAFF_CAPTION, Spinner, StaffAside, formatMobile, useStepHistory,
  type AuthPhoto,
} from "@/components/auth-shell";
import {
  apiAuthOptions, apiAuthStart, apiAuthVerify, apiAuthVerifyFirebase, apiTwoFactorEnroll, apiTwoFactorVerify, authError,
  type AuthOptions, type AuthStarted,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import type { AuthPayload } from "@/lib/api";
import {
  PREVIEW_EMAIL, PREVIEW_MOBILE, PREVIEW_OPTIONS, PREVIEW_RECOVERY_CODES, PREVIEW_SETUP, PREVIEW_STAFF_PAYLOAD, PREVIEW_STATES,
  PREVIEW_WRONG_CODE, readPreview, type SigninPreview,
} from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";
// `.ac-recaptcha`: Google's badge inline and hidden, its notice shown instead (as on /app/phone).
import "@/components/auth-cards/auth-cards.css";
import { codeSchema, email as emailField, indianMobile, recoveryCode } from "@/lib/validation";
import { websiteUrl } from "@/lib/site";
import { safeNext } from "@/lib/safe-next";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * The one way in — for a woman who is new AND for one who is coming back.
 *
 *   1  one field: her mobile number or her email. Digits turn it into a mobile
 *      field (+91, Indian flag, 10 digits); letters turn it into an email field.
 *   2  the 6-digit code, sent by SMS or email
 *
 * That is all. She never picks between "Sign in" and "Join": the code decides.
 * A known member is signed in and sent where her status says (`homeFor`):
 * home, the selfie-and-ID step, the waiting screen or the rejected screen. A
 * NEW address is made into an account by that same code and goes straight to
 * the selfie-and-ID step. Nothing else is asked at the door: her name is
 * entered by the verification team from her ID card, and the other contact is
 * asked later by the "complete your profile" reminder. "I am a woman, 18 or
 * older" is the line under Send code — continuing is agreeing. Staff go on to
 * their authenticator app (setup, codes, recovery codes) as before.
 *
 * `?email=` / `?phone=` pre-fill the field, `?next=` is where to land after,
 * and `?ref=` (a friend's invite code) is kept for the whole visit.
 */

type Step = "enter" | "code" | "mfa" | "setup" | "recovery";

const RECAPTCHA_ID = "signin-recaptcha";

interface SetupInfo {
  ticket: string;
  secret: string;
  provisioning_uri: string;
  qr_svg: string;
}

const recoverySchema = z.object({ recovery: recoveryCode });

/** The photo beside each step. Staff steps get the logo's gradient. */
const PHOTO: Record<Step, AuthPhoto> = { enter: "signin", code: "email", mfa: "plain", setup: "plain", recovery: "plain" };

/** Mobile as she types it: digits only, a pasted +91 / 0 dropped, at most 10. */
const typedMobile = (raw: string) => raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10);

/** Digits, spaces, dashes, brackets and a leading + — a phone number being typed. */
const looksLikePhone = (raw: string) => /\d/.test(raw) && /^\+?[\d\s()-]*$/.test(raw.trim());

/** "Enter all 6 digits" when a code is sent short; "" when it is whole. */
const codeProblem = (value: string) => codeSchema.safeParse({ code: value }).error?.issues[0]?.message ?? "";

/**
 * The friend's invite code from `?ref=` (Refer a friend), kept in
 * sessionStorage so it survives the code step, Back and a reload, and sent once
 * when a new account is created. The server checks it; here it is only shape-checked.
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
    return REF_SHAPE.test(fromLink) ? fromLink.toUpperCase() : "";
  }
}

function forgetRef() {
  try { window.sessionStorage.removeItem(REF_KEY); } catch { /* storage blocked */ }
}

export default function SignInPage() {
  const { locale } = useI18n();
  const { completeSignIn } = useAuth();

  const [step, setStep] = useState<Step>("enter");
  /** What she typed: digits for a mobile, the text for an email. */
  const [entry, setEntry] = useState("");
  const [entryTouched, setEntryTouched] = useState(false);
  const [next, setNext] = useState("");
  const [invitedBy, setInvitedBy] = useState("");
  const [sent, setSent] = useState<AuthStarted | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();

  const [mfaTicket, setMfaTicket] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  /** The client-side check on a code sent short (Enter / Verify before 6 digits). */
  const [codeError, setCodeError] = useState("");
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [recovery, setRecovery] = useState<{ codes: string[]; payload: AuthPayload } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

  const [options, setOptions] = useState<AuthOptions | null>(null);
  const smsConfirmation = useRef<SmsConfirmation | null>(null);
  /** Local-only `?preview=`: fixtures instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<SigninPreview | null>(null);
  const viaFirebase = !!options?.phone_codes && !!options?.firebase;

  const isPhone = looksLikePhone(entry);
  const kind: "phone" | "email" | "empty" = !entry.trim() ? "empty" : isPhone ? "phone" : "email";
  const digits = isPhone ? typedMobile(entry) : "";
  const entryProblem = kind === "empty" ? "Enter your mobile number or email"
    : kind === "phone" ? (indianMobile.safeParse(digits).error?.issues[0]?.message ?? "")
      : (emailField.safeParse(entry).error?.issues[0]?.message ?? "");
  const showEntryProblem = entryTouched && !!entryProblem;

  const recoveryForm = useForm({ resolver: zodResolver(recoverySchema), mode: "onTouched", reValidateMode: "onChange", defaultValues: { recovery: "" } });
  const recoveryError = recoveryForm.formState.errors.recovery?.message;

  const goTo = (s: Step) => {
    setStep(s);
    setCode("");
    setCodeError("");
    setError("");
    setInvalid(false);
    setUseRecovery(false);
  };

  // Browser/phone Back walks the steps. A spent code is replaced by what it
  // unlocked, so Back from the authenticator lands on the field;
  // the once-only recovery codes hold their ground.
  const back = useStepHistory<Step>(step, (to) => {
    if ((to === "setup" && !setup) || (to === "recovery" && !recovery) || (to === "mfa" && !mfaTicket)
      || (to === "code" && !sent)) to = "enter";
    goTo(to);
  }, {
    replace: (to) => to === "mfa" || to === "setup" || to === "recovery",
    lock: (at) => at === "recovery",
  });

  // Read the URL after mount (the server render has no URL), and ask the API
  // whether SMS codes are on and who sends them.
  useEffect(() => {
    if (AUTH_PREVIEW) {
      const p = readPreview(PREVIEW_STATES.signin);
      if (p) {
        const t = window.setTimeout(() => {
          setPreview(p);
          setOptions(PREVIEW_OPTIONS);
          const phoneFirst = p !== "enter-email";
          setEntry(p === "enter" ? "" : phoneFirst ? PREVIEW_MOBILE : PREVIEW_EMAIL);
          setSent({
            mode: p === "code-new" ? "signup" : "signin", provider: "server",
            channel: phoneFirst ? "sms" : "email", destination: phoneFirst ? "+91 ******3210" : "p****@gmail.com",
            message: "", expires_in: 300, resend_in: 30,
          });
          setMfaTicket(PREVIEW_SETUP.ticket);
          setSetup(PREVIEW_SETUP);
          setRecovery({ codes: PREVIEW_RECOVERY_CODES, payload: PREVIEW_STAFF_PAYLOAD });
          if (p === "code" || p === "code-new") setResendIn(30);
          if (p === "code-wrong") { setCode("123456"); setInvalid(true); setError(PREVIEW_WRONG_CODE); }
          setStep(p.startsWith("enter") ? "enter" : p.startsWith("code") ? "code" : (p as Step));
        });
        return () => window.clearTimeout(t);
      }
    }
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const presetEmail = (params.get("email") || "").trim();
    const presetPhone = typedMobile(params.get("phone") ?? "");
    const t = window.setTimeout(() => {
      if (presetPhone.length === 10) setEntry(presetPhone);
      else if (presetEmail) setEntry(presetEmail);
      setNext(safeNext(params.get("next")));
      setInvitedBy(readRef(params));
    });
    apiAuthOptions()
      .then((o) => { if (alive) setOptions(o); })
      .catch(() => { if (alive) setOptions(null); });
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [setResendIn]);

  const finish = useCallback(
    (payload: AuthPayload) => {
      if (AUTH_PREVIEW && preview) return;
      forgetRef();
      completeSignIn(payload, next || undefined);
    },
    [completeSignIn, next, preview],
  );

  /** The address the code goes to, in the shape the API takes. */
  const target = (): { email?: string; phone?: string } =>
    kind === "phone" ? { phone: `+91${digits}` } : { email: entry.trim().toLowerCase() };

  /** Step 1's submit (already checked), and "Send a new code". */
  const sendCode = async () => {
    if (AUTH_PREVIEW && preview) { setResendIn(30); goTo("code"); return; }
    if (kind === "phone" && !options?.phone_codes) {
      setError("Mobile codes are off right now. Please use your email.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await apiAuthStart({ ...target(), locale: locale || "en" });
      if (result.provider === "firebase") {
        if (!options?.firebase) throw new Error("firebase-off");
        smsConfirmation.current = await sendSmsCode(options.firebase, `+91${digits}`, RECAPTCHA_ID, locale || "en", { badge: "inline" });
      }
      setSent(result);
      setResendIn(result.resend_in);
      if (step !== "code") goTo("code");
      else { setCode(""); setInvalid(false); }
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "resend_too_soon") setResendIn(Number(problem.extra.retry_after) || 30);
      if (problem.code === "sms_limit") {
        setError("We can't send SMS codes right now. Please type your email instead.");
        if (step !== "enter") back("enter");
      } else {
        setError(problem.status ? problem.message : smsErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitEntry = (e: FormEvent) => {
    e.preventDefault();
    setEntryTouched(true);
    if (entryProblem) {
      document.getElementById("si-id")?.focus();
      return;
    }
    void sendCode();
  };

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy || (AUTH_PREVIEW && preview) || !sent) return;
      if (sent.provider === "firebase" && !smsConfirmation.current) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        // `agreed`: the line under Send code. Only a code that creates an account reads it.
        const terms = { agreed: true, ...(invitedBy ? { ref: invitedBy } : {}) };
        const result = sent.provider === "firebase" && smsConfirmation.current
          ? await apiAuthVerifyFirebase(await confirmSmsCode(smsConfirmation.current, value), locale || "en", terms)
          : await apiAuthVerify({ ...target(), code: value, locale: locale || "en", ...terms });
        finish(result);
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "two_factor_required") {
          setMfaTicket(String(problem.extra.ticket ?? ""));
          goTo("mfa");
        } else if (problem.code === "two_factor_setup_required") {
          setSetup({
            ticket: String(problem.extra.ticket ?? ""),
            secret: String(problem.extra.secret ?? ""),
            provisioning_uri: String(problem.extra.provisioning_uri ?? ""),
            qr_svg: String(problem.extra.qr_svg ?? ""),
          });
          goTo("setup");
        } else {
          setInvalid(true);
          setError(problem.status ? problem.message : smsErrorMessage(err));
          if (problem.code === "code_voided" || problem.code === "code_expired") setCode("");
        }
        setBusy(false);
      }
    },
    // `target` reads `kind`, `digits` and `entry`, all fixed while the code step is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, finish, locale, preview, sent, entry, invitedBy],
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
        if (problem.code === "ticket_expired") back("enter");
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

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
      setError("Could not copy the key. Select it and copy it manually, or scan the QR code.");
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
    if (problem) document.getElementById(step === "mfa" ? "si-mfa" : "si-code")?.focus();
    return !problem;
  };
  const submitCode = (e: FormEvent, run: (value: string) => unknown) => {
    e.preventDefault();
    if (checkCode(code)) void run(code);
  };

  const staff = step === "mfa" || step === "setup" || step === "recovery";
  const isNew = sent?.mode === "signup";
  const bySms = sent?.channel === "sms";
  const screen = step === "enter" ? "a1" : step === "code" ? (invalid ? "a3" : "a2")
    : step === "setup" ? "d1" : step === "recovery" ? "d2" : step === "mfa" ? "d3" : undefined;

  return (
    <AuthShell
      photo={PHOTO[step]}
      caption={staff ? STAFF_CAPTION : MEMBER_CAPTION}
      aside={staff ? <StaffAside /> : undefined}
      stepKey={step}
      tag={staff ? "Staff" : undefined}
      showTrust={step === "enter"}
      screen={screen}
      flow={staff ? "staff-signin" : "member-signin"}
      // Google's invisible robot check attaches here before each SMS.
      footer={
        <div className="ac-recaptcha">
          <div id={RECAPTCHA_ID} />
          {viaFirebase && (
            <p>
              This site is protected by reCAPTCHA and the Google{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
            </p>
          )}
        </div>
      }
    >
      {/* 1 · her mobile or her email, in one field */}
      {step === "enter" && (
        <>
          <h1 className="wsa-t">Sign in or <span className="wsa-grad">join</span></h1>
          <p className="wsa-s">Enter your mobile number or email. We&apos;ll send you a 6-digit code. No password needed.</p>
          <form onSubmit={submitEntry} noValidate className="wsa-field">
            <label htmlFor="si-id" className="wsa-lbl">Mobile number or email</label>
            <div className={`${kind === "phone" ? "wsa-phone" : "wsa-in"}${error || showEntryProblem ? " is-bad" : ""}`} data-kind={kind}>
              {kind === "phone"
                ? <span className="wsa-cc" aria-hidden><AuthIcon name="phone" /><span className="wsa-flag" />+91</span>
                : <AuthIcon name={kind === "email" ? "mail" : "user"} />}
              <input id="si-id" key="si-id" type="text" enterKeyHint="send" autoFocus spellCheck={false} autoCapitalize="none"
                inputMode={kind === "phone" ? "numeric" : kind === "email" ? "email" : "text"}
                autoComplete={kind === "phone" ? "tel-national" : "username"}
                maxLength={kind === "phone" ? 13 : 254}
                value={kind === "phone" ? formatMobile(digits) : entry}
                placeholder="98765 43210 or name@gmail.com"
                aria-invalid={!!(error || showEntryProblem) || undefined}
                aria-describedby={[showEntryProblem && "si-id-error", error && "si-id-server-error", kind === "phone" && "si-id-kind"].filter(Boolean).join(" ") || undefined}
                onBlur={() => { if (entry.trim()) setEntryTouched(true); }}
                onChange={(e) => {
                  const raw = e.target.value;
                  setEntry(looksLikePhone(raw) ? typedMobile(raw) : raw);
                  setError("");
                }} />
            </div>
            {kind === "phone" && <span id="si-id-kind" className="sr-only">Indian mobile number, +91</span>}
            {showEntryProblem && <p id="si-id-error" role="alert" className="wsa-ferr">{entryProblem}</p>}
            {kind === "email" && !showEntryProblem && (
              <EmailTypoHint value={entry} onPick={(fixed) => setEntry(fixed)} />
            )}
            {error && <p id="si-id-server-error" role="alert" className="wsa-err">{error}</p>}
            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Sending your code…</> : <>Send code <AuthIcon name="arrow" /></>}
            </button>
            <p className="wsa-agree" id="si-agree">
              By continuing you confirm you are a woman, 18 or older, and agree to the{" "}
              <a href={websiteUrl("/terms")} target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
              <a href={websiteUrl("/privacy")} target="_blank" rel="noopener noreferrer">Privacy policy</a>.
            </p>
          </form>
          {invitedBy && (
            <p className="wsa-note" data-testid="invited-note">
              <AuthIcon name="user" /><span><b>Invited by a friend</b> · <span style={{ whiteSpace: "nowrap" }}>code {invitedBy}</span></span>
            </p>
          )}
          <p className="wsa-note"><AuthIcon name="lock" /><span>New to WomSakhi? The same code creates your account. Staff sign in with email and their authenticator app.</span></p>
        </>
      )}

      {/* 2 · the code */}
      {step === "code" && sent && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("enter")}>
            <AuthIcon name="back" /> {bySms ? "Change number" : "Change email"}
          </button>
          <p className="wsa-eyebrow">{invalid ? "Check your code" : isNew ? "Welcome to WomSakhi" : "Welcome back"}</p>
          <h1 className="wsa-t">Enter the <span className="wsa-grad">code</span></h1>
          <p className="wsa-s" id="si-code-help">
            {bySms ? <>Sent by SMS to <b>+91 {formatMobile(digits) || sent.destination}</b></> : <>Sent to <b>{sent.destination}</b></>}
          </p>
          <form onSubmit={(e) => submitCode(e, verify)} noValidate style={{ display: "contents" }}>
            <CodeInput id="si-code" value={code} onChange={onCode} onComplete={verify} disabled={busy} invalid={invalid || !!codeError}
              describedBy={codeError ? "si-code-help si-code-field-error" : invalid ? "si-code-help si-code-error" : "si-code-help"}
              label={bySms ? "6-digit code from the SMS" : "6-digit code from your email"} />
          </form>
          {codeError && <p id="si-code-field-error" role="alert" className="wsa-ferr">{codeError}</p>}
          {error && <p id="si-code-error" role="alert" className="wsa-err">{error}</p>}
          <AuthResend seconds={resendIn} onResend={() => void sendCode()} busy={busy} />
          <p className="wsa-note">
            {bySms
              ? <><AuthIcon name="msg" /><span>On Android the code fills in by itself when the SMS arrives.</span></>
              : <><AuthIcon name="mail" /><span>Can&apos;t find it? Look in Spam or Promotions. The code expires in 5 minutes.</span></>}
          </p>
          <button type="button" className="wsa-btn wsa-go" disabled={busy} onClick={() => { if (checkCode(code)) void verify(code); }}>
            {busy ? <><Spinner /> Checking…</> : isNew ? "Continue" : "Sign in"}
          </button>
        </>
      )}

      {/* D3 · authenticator code */}
      {step === "mfa" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("enter")}><AuthIcon name="back" /> Back to sign in</button>
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
          <button type="button" className="wsa-back" onClick={() => back("enter")}><AuthIcon name="back" /> Back to sign in</button>
          <h1 className="wsa-t">Protect your staff account</h1>
          <p className="wsa-s wsa-steps-line"><span>1 · Install Google Authenticator</span> <span>2 · Scan</span> <span>3 · Enter the code</span></p>
          {setup.qr_svg && (
            <div className="wsa-qr" role="img" aria-label="QR code for your authenticator app"
              dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
          )}
          <button type="button" className="wsa-key" onClick={() => void copy(setup.secret, "secret")}
            aria-label={`Setup key ${setup.secret}. Copy`}>
            {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
            <small role="status" aria-live="polite">{copied === "secret" ? "Copied" : "Copy"}</small>
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

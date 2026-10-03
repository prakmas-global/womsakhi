"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useI18n } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import { AuthIcon, AuthResend, AuthShell, AuthStepsBar, EmailTypoHint, MEMBER_CAPTION, Spinner, formatMobile, useStepHistory } from "@/components/auth-shell";
import {
  apiAuthOptions, apiSignupCheck, apiSignupComplete, apiSignupFirebase, apiSignupStart, apiSignupVerify, apiSmsAllowance, authError,
  type AuthOptions, type CodeSent,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import { PREVIEW_EMAIL, PREVIEW_MOBILE, PREVIEW_NAME, PREVIEW_SENT_EMAIL, PREVIEW_STATES, readPreview, type SignupPreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";
// `.ac-recaptcha`: Google's badge inline and hidden, its notice shown instead (as on /app/phone).
import "@/components/auth-cards/auth-cards.css";
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
 *   B1  mobile + email          →  checked: neither already has an account
 *   B2  where should the code go? "Send code to my email (a***@gmail.com)"
 *       or "Send code by SMS (+91 ••••• 43210)" — HER choice, one of them.
 *       SMS is offered only when phone codes are live (Firebase); if today's
 *       SMS allowance is used up, the code goes to her email, and she is told.
 *       Then the 6-digit code proves that one channel.
 *   B3  name + "woman, 18+"     →  the account exists
 *
 * Her selfie and ID come NEXT, on /app/verify, once the account exists: the ID
 * upload is where most sign-ups are abandoned, and a woman who stops there now
 * comes back to a half-finished application instead of an empty form.
 *
 * The mobile number is required and Indian (+91) for now. ONE proved channel
 * is enough to join: with the email code the number is saved unconfirmed and
 * she is not stopped to confirm it; with the SMS code the email is saved
 * unconfirmed and she is not stopped to confirm that.
 *
 * An email (or confirmed number) that already has an account is told so at
 * B1 — "You already have an account" with a Sign in button — and sent
 * nothing. `?email=` / `?phone=` pre-fill B1 (from sign-in's "Join WomSakhi").
 */

type Step = "contact" | "choose" | "code" | "sms" | "about";

/** `a***@gmail.com` — she typed it; this is only so the choice reads cleanly. */
const maskEmail = (address: string) => {
  const [local, domain] = address.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : address;
};
/** `+91 ••••• 43210` */
const maskMobile = (digits: string) => `+91 ••••• ${digits.slice(-5)}`;

/* The two choices: a label and, under it, where the code would go — two short
   lines instead of one long line that wraps mid-number on a phone. */
const CHOICE = { height: "auto", minHeight: 56, padding: "10px 18px", gap: 12 } as const;
const CHOICE_TEXT = { display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25, textAlign: "left" } as const;
const CHOICE_SUB = { fontWeight: 500, opacity: 0.85, fontSize: "0.86em", whiteSpace: "nowrap" } as const;

const RECAPTCHA_ID = "signup-recaptcha";

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
  /** The API said this email / number already has an account: offer Sign in. */
  const [known, setKnown] = useState<null | { kind: "email" | "phone"; value: string; message: string }>(null);
  /** Whether SMS codes (through Firebase) are on — decides "Send the code by SMS instead". */
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const smsConfirmation = useRef<SmsConfirmation | null>(null);
  const [smsResendIn, setSmsResendIn] = useCountdown();
  const smsInstead = !!options?.phone_codes && !!options.firebase;
  /** The API's word on B1: may the code go by SMS for this join? */
  const [smsOffered, setSmsOffered] = useState(false);
  /** Set when SMS was chosen but today's allowance is used up and email took over. */
  const [smsFellBack, setSmsFellBack] = useState(false);

  // `?ref=` (kept for the whole join) and `?email=` (from sign-in's "Join
  // WomSakhi" link). Read after mount, like the preview switch below: the
  // server render has no URL to read.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => {
      setInvitedBy(readRef(params));
      const preset = (params.get("email") || "").trim();
      if (preset && !contactForm.getValues("email")) contactForm.setValue("email", preset);
      const presetPhone = typedMobile(params.get("phone") || "");
      if (presetPhone.length === 10 && !contactForm.getValues("mobile")) contactForm.setValue("mobile", presetPhone);
    });
    let alive = true;
    apiAuthOptions().then((o) => { if (alive) setOptions(o); }).catch(() => { /* email code only */ });
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
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

  const stepNumber = step === "contact" ? 1 : step === "about" ? 3 : 2;

  // Browser/phone Back walks the steps. Step 3 replaces the spent code, so
  // Back from it goes to step 1 (and drops the ticket); what she typed stays.
  const back = useStepHistory<Step>(step, (to) => {
    if (to === "about" && !ticket) to = "contact";
    if (to === "sms" && !smsConfirmation.current) to = smsOffered ? "choose" : "contact";
    if (to === "code" && !sent) to = smsOffered ? "choose" : "contact";
    if (to === "contact") setTicket("");
    setStep(to);
    setCode("");
    setError("");
    setInvalid(false);
  }, { replace: (to) => to === "about" });

  /**
   * Step 1's submit: is this email and number free, and may the code go by
   * SMS? Then she chooses (B2) — or, with only email possible, it just goes.
   */
  const checkContact = async (to: { email: string; mobile: string }) => {
    setEmail(to.email);
    setMobile(to.mobile);
    if (AUTH_PREVIEW && preview) { await sendCode(to); return; }
    setError("");
    setKnown(null);
    setSmsFellBack(false);
    setBusy(true);
    let channels: ("email" | "sms")[] = ["email"];
    try {
      channels = (await apiSignupCheck(to.email, `+91${to.mobile}`)).channels;
    } catch (err) {
      const problem = authError(err);
      setBusy(false);
      if (problem.code === "already_registered" || problem.code === "phone_taken") {
        const kind = problem.code === "phone_taken" ? "phone" : "email";
        setKnown({ kind, value: kind === "phone" ? to.mobile : to.email, message: problem.message });
      } else if (problem.status === 422 && /mobile|number/i.test(problem.message)) {
        contactForm.setError("mobile", { type: "server", message: problem.message }, { shouldFocus: true });
      } else if (problem.status === 422 && /email/i.test(problem.message)) {
        contactForm.setError("email", { type: "server", message: "Enter a real email address you can open" }, { shouldFocus: true });
      } else {
        setError(problem.message);
      }
      return;
    }
    setBusy(false);
    const sms = channels.includes("sms") && smsInstead;
    setSmsOffered(sms);
    if (sms) setStep("choose");
    else await sendCode(to);
  };

  /** Send the code — step 1's submit (values already checked), and "Send a new code". */
  const sendCode = async (to: { email: string; mobile: string }) => {
    setEmail(to.email);
    setMobile(to.mobile);
    if (AUTH_PREVIEW && preview) { setSent(PREVIEW_SENT_EMAIL); setResendIn(30); setStep("code"); return; }
    setError("");
    setKnown(null);
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
      if (problem.code === "already_registered" || problem.code === "phone_taken") {
        // She already has an account: say so on B1, with a way to sign in.
        const kind = problem.code === "phone_taken" ? "phone" : "email";
        setKnown({ kind, value: kind === "phone" ? to.mobile : to.email, message: problem.message });
        if (step !== "contact") back("contact");
      } else if (step === "contact" && problem.status === 422 && /mobile|number/i.test(problem.message)) {
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

  /** "Send the code by SMS instead": Firebase sends it to the number from B1. */
  const sendSms = async () => {
    if (!options?.firebase) return;
    setError("");
    setInvalid(false);
    setBusy(true);
    try {
      // Asked first: today's allowance, and whether the number already has an
      // account (then she should sign in, and no SMS is sent).
      await apiSmsAllowance(`+91${mobile}`, "signup");
      smsConfirmation.current = await sendSmsCode(options.firebase, `+91${mobile}`, RECAPTCHA_ID, locale || "en", { badge: "inline" });
      setSmsResendIn(options.resend_seconds || 90);
      setCode("");
      setStep("sms");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "phone_taken") {
        setKnown({ kind: "phone", value: mobile, message: problem.message });
        back("contact");
      } else if (problem.code === "sms_limit") {
        // Out of SMS for today: the code goes to her email instead, and she is told why.
        setBusy(false);
        setSmsFellBack(true);
        await sendCode({ email, mobile });
        return;
      } else {
        setError(problem.status ? problem.message : smsErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifySms = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy || !smsConfirmation.current) return;
      setError("");
      setInvalid(false);
      setBusy(true);
      try {
        const idToken = await confirmSmsCode(smsConfirmation.current, value);
        const result = await apiSignupFirebase({ email: email.trim(), phone: `+91${mobile}`, idToken, locale: locale || "en" });
        setTicket(result.ticket);
        setStep("about");
      } catch (err) {
        const problem = authError(err);
        if (problem.code === "already_registered" || problem.code === "phone_taken") {
          const kind = problem.code === "phone_taken" ? "phone" : "email";
          setKnown({ kind, value: kind === "phone" ? mobile : email, message: problem.message });
          back("contact");
        } else {
          setInvalid(true);
          setError(problem.status ? problem.message : smsErrorMessage(err));
        }
      } finally {
        setBusy(false);
      }
    },
    [back, busy, email, mobile, locale],
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
      // Google's invisible robot check attaches here before "SMS instead"
      // sends — outside the card, like sign-in's.
      footer={
        <div className="ac-recaptcha">
          <div id={RECAPTCHA_ID} />
          {smsInstead && (
            <p>
          This site is protected by reCAPTCHA and the Google{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
        </p>
          )}
        </div>
      }
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
          {known && (
            <div className="wsa-field" data-testid="already-member">
              <p role="alert" className="wsa-err">{known.message}</p>
              <Link className="wsa-btn wsa-go" href={`/signin?${known.kind}=${encodeURIComponent(known.value)}`}>
                Sign in <AuthIcon name="arrow" />
              </Link>
            </div>
          )}
          <form onSubmit={(e) => void contactForm.handleSubmit(checkContact)(e)} noValidate className="wsa-field">
            <label htmlFor="su-mobile" className="wsa-lbl">Mobile number</label>
            <div className={`wsa-phone${contactErrors.mobile ? " is-bad" : ""}`}>
              <span className="wsa-cc" aria-hidden><span className="wsa-flag" />+91</span>
              <Controller name="mobile" control={contactForm.control} render={({ field }) => (
                <input id="su-mobile" type="tel" enterKeyHint="next" inputMode="numeric" autoComplete="tel-national" maxLength={11} autoFocus
                  ref={field.ref} name={field.name} onBlur={field.onBlur}
                  value={formatMobile(field.value)} placeholder="98765 43210" aria-invalid={!!contactErrors.mobile}
                  aria-describedby={contactErrors.mobile ? "su-mobile-error" : undefined}
                  onChange={(e) => { field.onChange(typedMobile(e.target.value)); setError(""); setKnown(null); }} />
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
                  onChange={(e) => { field.onChange(e.target.value); setError(""); setKnown(null); }}
                  placeholder="name@gmail.com" aria-invalid={!!contactErrors.email} aria-describedby={contactErrors.email ? "su-email-error" : undefined} />
              )} />
            </div>
            {contactErrors.email ? (
              <p id="su-email-error" role="alert" className="wsa-ferr">{contactErrors.email.message}</p>
            ) : (
              <EmailTypoHint value={typedEmail} onPick={(fixed) => contactForm.setValue("email", fixed, { shouldValidate: true })} />
            )}

            <button type="submit" disabled={busy} className="wsa-btn wsa-go">
              {busy ? <><Spinner /> Checking…</> : <>Continue <AuthIcon name="arrow" /></>}
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

      {/* B2 · where the code goes — her choice */}
      {step === "choose" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("contact")}>
            <AuthIcon name="back" /> Change email or number
          </button>
          <AuthStepsBar step={stepNumber} total={3} />
          <h1 className="wsa-t">Where should we send your code?</h1>
          <p className="wsa-s">Choose one. You only need to confirm one of them to join.</p>
          {error && <p role="alert" className="wsa-err">{error}</p>}
          <div className="wsa-field" role="group" aria-label="Where to send the code">
            <button type="button" className="wsa-btn wsa-go" data-testid="choose-email" disabled={busy} style={CHOICE}
              onClick={() => void sendCode({ email, mobile })}>
              <AuthIcon name="mail" />
              <span style={CHOICE_TEXT}>Send code to my email<small style={CHOICE_SUB}>{maskEmail(email)}</small></span>
            </button>
            <button type="button" className="wsa-btn wsa-line" data-testid="choose-sms" disabled={busy} style={CHOICE}
              onClick={() => void sendSms()}>
              <AuthIcon name="phone" />
              <span style={CHOICE_TEXT}>Send code by SMS<small style={CHOICE_SUB}>{maskMobile(mobile)}</small></span>
            </button>
          </div>
        </>
      )}

      {/* B2 · the email code */}
      {step === "code" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back(smsOffered ? "choose" : "contact")}>
            <AuthIcon name="back" /> {smsOffered ? "Choose another way" : "Change email or number"}
          </button>
          <AuthStepsBar step={stepNumber} total={3} />
          {smsFellBack && (
            <p className="wsa-warn" role="status"><b>SMS is busy right now.</b> We&apos;ve sent your code by email instead. It&apos;s just as safe.</p>
          )}
          <h1 className="wsa-t">Check your email</h1>
          <p className="wsa-s" id="su-code-help">We sent a 6-digit code to <b>{sent?.destination ?? email}</b></p>
          <CodeInput id="su-code" value={code} onChange={(v) => { setCode(v); setInvalid(false); setError(""); }}
            onComplete={verify} disabled={busy} invalid={invalid} describedBy="su-code-help" label="6-digit code from your email" />
          {error && <p role="alert" className="wsa-err">{error}</p>}
          {busy && <p className="wsa-muted" role="status">Checking…</p>}
          <AuthResend seconds={resendIn} onResend={() => void sendCode({ email, mobile })} busy={busy} />
          <p className="wsa-note"><AuthIcon name="mail" /><span>Can&apos;t find it? Look in Spam or Promotions.</span></p>
        </>
      )}

      {/* B2 · the SMS code instead (Firebase sends and checks it) */}
      {step === "sms" && (
        <>
          <button type="button" className="wsa-back" onClick={() => back("choose")}>
            <AuthIcon name="back" /> Choose another way
          </button>
          <AuthStepsBar step={stepNumber} total={3} />
          <h1 className="wsa-t">Enter the SMS code</h1>
          <p className="wsa-s" id="su-sms-help">Sent by SMS to <b>+91 {formatMobile(mobile)}</b></p>
          <CodeInput id="su-sms" value={code} onChange={(v) => { setCode(v); setInvalid(false); setError(""); }}
            onComplete={verifySms} disabled={busy} invalid={invalid} describedBy="su-sms-help" label="6-digit code from the SMS" />
          {error && <p role="alert" className="wsa-err">{error}</p>}
          {busy && <p className="wsa-muted" role="status">Checking…</p>}
          <AuthResend seconds={smsResendIn} onResend={() => void sendSms()} busy={busy} />
          <p className="wsa-note"><AuthIcon name="msg" /><span>On Android the code fills in by itself when the SMS arrives.</span></p>
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
          <p className="wsa-note"><AuthIcon name="shield" /><span><b>Next:</b> a selfie and an ID photo.</span></p>
        </>
      )}
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </AuthShell>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import {
  AuthIcon, AuthResend, AuthShell, MEMBER_CAPTION, STAFF_CAPTION, Spinner, StaffAside, formatMobile, useStepHistory, type AuthPhoto,
} from "@/components/auth-shell";
import {
  apiAuthOptions, apiSigninFirebase, apiSigninStart, apiSmsAllowance, apiSigninVerify, apiTwoFactorEnroll, apiTwoFactorVerify, authError,
  type AuthOptions, type CodeSent,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import type { AuthPayload } from "@/lib/api";

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

/** Only same-site paths: `?next=` must never be a way to send her elsewhere. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "";
  return raw;
}

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
  const [recoveryInput, setRecoveryInput] = useState("");
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [recovery, setRecovery] = useState<{ codes: string[]; payload: AuthPayload } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

  // Phone sign-in, offered only once SMS codes are switched on.
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [mobile, setMobile] = useState("");
  const smsConfirmation = useRef<SmsConfirmation | null>(null);
  const smsOn = !!options?.phone_codes;
  const viaFirebase = smsOn && !!options?.firebase;

  const goTo = (s: Step) => {
    setStep(s);
    setCode("");
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
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("email");
    const t = window.setTimeout(() => {
      if (preset) setEmail(preset);
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
  }, []);

  const finish = useCallback(
    (payload: AuthPayload) => completeSignIn(payload, next || undefined),
    [completeSignIn, next],
  );

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiSigninStart({ email: email.trim() });
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
      if (value.length !== 6 || busy) return;
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
    [busy, email, finish],
  );

  const verifyAuthenticator = useCallback(
    async (value: string) => {
      if (busy) return;
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
    [back, busy, finish, mfaTicket],
  );

  const enroll = useCallback(
    async (value: string) => {
      if (!setup || value.length !== 6 || busy) return;
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
    [busy, setup],
  );

  const sendSms = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!options?.phone_codes || !/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter your 10-digit mobile number");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (options.firebase) {
        await apiSmsAllowance(`+91${mobile}`, "signin");
        smsConfirmation.current = await sendSmsCode(options.firebase, `+91${mobile}`, RECAPTCHA_ID);
        setResendIn(options.resend_seconds || 90);
      } else {
        const sentTo = await apiSigninStart({ phone: `+91${mobile}` });
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
      if (value.length !== 6 || busy || (viaFirebase && !smsConfirmation.current)) return;
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
    [busy, finish, mobile, viaFirebase],
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

  const onCode = (v: string) => { setCode(v); setInvalid(false); setError(""); };
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
          <form onSubmit={sendSms} noValidate className="wsa-field">
            <label htmlFor="si-mobile" className="wsa-lbl">Mobile number</label>
            <div className={`wsa-phone${error ? " is-bad" : ""}`}>
              <span className="wsa-cc" aria-hidden><span className="wsa-flag" />+91</span>
              <input id="si-mobile" type="tel" enterKeyHint="send" inputMode="numeric" autoComplete="tel-national" maxLength={11} autoFocus
                value={formatMobile(mobile)} placeholder="98765 43210" aria-invalid={!!error || undefined}
                aria-describedby={error ? "si-mobile-error" : undefined}
                onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10)); setError(""); }} />
            </div>
            {error && <p id="si-mobile-error" role="alert" className="wsa-err">{error}</p>}
            <button type="submit" disabled={busy || mobile.length !== 10} className="wsa-btn wsa-go">
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
          <CodeInput id="si-sms" value={code} onChange={onCode} onComplete={verifySms} disabled={busy} invalid={invalid}
            describedBy={invalid ? "si-sms-error" : "si-sms-help"} label="6-digit code from the SMS" />
          {invalid ? (
            <>
              <p id="si-sms-error" role="alert" className="wsa-err">{error}</p>
              <AuthResend seconds={resendIn} onResend={() => void sendSms()} busy={busy} />
              <p className="wsa-link">Trouble with SMS?{" "}
                <button type="button" className="wsa-inline" onClick={() => { setSmsLimited(false); goTo("email"); }}>Use email instead</button>
              </p>
            </>
          ) : (
            <>
              {error && <p role="alert" className="wsa-err">{error}</p>}
              <AuthResend seconds={resendIn} onResend={() => void sendSms()} busy={busy} />
              <p className="wsa-note"><AuthIcon name="msg" /><span>On Android the code fills in by itself when the SMS arrives.</span></p>
              <button type="button" className="wsa-btn wsa-go" disabled={busy || code.length !== 6} onClick={() => void verifySms(code)}>
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
          <form onSubmit={sendCode} className="wsa-field">
            {!smsLimited && <label htmlFor="si-email" className="wsa-lbl">Email</label>}
            <div className={`wsa-in${error ? " is-bad" : ""}`}>
              <AuthIcon name="mail" />
              <input id="si-email" type="email" enterKeyHint="send" required autoComplete="email" autoFocus inputMode="email"
                aria-label={smsLimited ? "Email" : undefined} aria-invalid={!!error || undefined}
                value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@gmail.com" />
            </div>
            {error && <p role="alert" className="wsa-err">{error}</p>}
            <button type="submit" disabled={busy || !email.trim()} className="wsa-btn wsa-go">
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
          <CodeInput id="si-code" value={code} onChange={onCode} onComplete={verify} disabled={busy} invalid={invalid}
            describedBy="si-code-help" label="6-digit code from your email" />
          {error && <p role="alert" className="wsa-err">{error}</p>}
          {busy && <p className="wsa-muted" role="status">Checking…</p>}
          <AuthResend seconds={resendIn} onResend={() => void sendCode()} busy={busy} />
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
            <CodeInput id="si-mfa" value={code} onChange={onCode} onComplete={verifyAuthenticator} disabled={busy} invalid={invalid}
              describedBy="si-mfa-help" label="Authenticator code" />
          ) : (
            <form className="wsa-field" onSubmit={(e) => { e.preventDefault(); void verifyAuthenticator(recoveryInput.trim()); }}>
              <label htmlFor="si-recovery" className="wsa-lbl">Recovery code</label>
              <div className={`wsa-in${error ? " is-bad" : ""}`}>
                <AuthIcon name="key" />
                <input id="si-recovery" enterKeyHint="go" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  value={recoveryInput} onChange={(e) => { setRecoveryInput(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="ABCD-1234" />
              </div>
              <button type="submit" disabled={busy || recoveryInput.trim().length < 8} className="wsa-btn wsa-go">
                {busy ? <><Spinner /> Checking…</> : "Sign in"}
              </button>
            </form>
          )}
          {error && <p role="alert" className="wsa-err">{error}</p>}
          <p className="wsa-link">
            {useRecovery ? "Found your phone? " : "Lost your phone? "}
            <button type="button" className="wsa-inline" onClick={() => { setUseRecovery((v) => !v); setError(""); setInvalid(false); }}>
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
    </AuthShell>
  );
}

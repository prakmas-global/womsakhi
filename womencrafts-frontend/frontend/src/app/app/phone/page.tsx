"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader, Smartphone } from "lucide-react";

import { apiGetMe } from "@/lib/api";
import {
  apiAuthOptions, apiPhoneFirebase, apiPhoneLater, apiPhoneStart, apiSmsAllowance, apiPhoneVerify, apiSetPhone, authError, homeFor, type AuthOptions,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import { AuthShell } from "@/components/auth-shell";
import { BackLink, useBackStep } from "@/components/auth-cards";

/**
 * Her mobile number: add it, and — once SMS codes are switched on — confirm it.
 *
 *   enter    +91 and ten digits → saved (unconfirmed)
 *   confirm  a 6-digit SMS code (sent by Firebase) → confirmed
 *
 * Every member needs a number. Before SMS is switched on the confirm step is
 * skipped and an admin checks the number during review; after, each member
 * confirms hers once and can then sign in with it.
 *
 * Drawn as the approved screen B4 (Version 11) on AuthShell's "join" photo.
 */
type Step = "enter" | "confirm";

const RECAPTCHA_ID = "phone-recaptcha";

const CAPTION = {
  title: "A safe space for women to learn, work and grow",
  text: "Women only. Every member is checked by a real person.",
};

export default function PhonePage() {
  const { user, signOut, updateUser } = useAuth();
  const router = useRouter();
  /** undefined while loading, null when the settings could not be fetched. */
  const [options, setOptions] = useState<AuthOptions | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("enter");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [smsOut, setSmsOut] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  const confirmation = useRef<SmsConfirmation | null>(null);
  /** The number the last code went to — back on the number step, the same number goes straight back to its code. */
  const sentTo = useRef("");

  // Firebase sends and checks its own SMS in the browser; the other providers
  // (Brevo, MSG91) are sent and checked by our server.
  const viaFirebase = !!options?.phone_codes && !!options.firebase;
  const smsOn = !!options?.phone_codes;
  const locale = user?.locale || "en";
  const ready = digits.length === 10;

  useEffect(() => {
    apiAuthOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  const finish = useCallback(async () => {
    const fresh = await apiGetMe();
    updateUser(fresh);
    router.replace(homeFor(fresh));
  }, [router, updateUser]);

  const sendSms = useCallback(async (phoneE164: string) => {
    if (!options?.phone_codes) return;
    setError("");
    setBusy(true);
    try {
      if (options.firebase) {
        await apiSmsAllowance(phoneE164, "phone_verify");
        confirmation.current = await sendSmsCode(options.firebase, phoneE164, RECAPTCHA_ID, locale);
      } else {
        await apiPhoneStart();
      }
      sentTo.current = phoneE164;
      setResendIn(options.resend_seconds || 90);
      setCode("");
      setInvalid(false);
      setStep("confirm");
    } catch (err) {
      const problem = authError(err);
      if (problem.code === "sms_limit") {
        setSmsOut(true);
        setError("We can't send SMS codes right now. You can carry on and confirm your number tomorrow.");
      } else {
        setError(problem.status ? problem.message : smsErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }, [options, setResendIn, locale]);

  // Already has a number but it isn't confirmed, and SMS is on: go straight to confirming it.
  useEffect(() => {
    if (!smsOn || !user?.phone || user.phone_verified || step !== "enter" || busy) return;
    // Only into an empty field: coming back from the code step keeps what she typed.
    const t = window.setTimeout(() => { setDigits((d) => d || user.phone.replace(/^\+91/, "")); });
    return () => window.clearTimeout(t);
  }, [smsOn, user, step, busy]);

  /*
    The code step is its own history entry: the phone's back button — and
    "← Change number" — return to the number step with her number still in it.
  */
  const backToNumber = useBackStep(step === "confirm", () => { setStep("enter"); setError(""); setCode(""); }, "step", "code");

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ready || busy || options === undefined) return;
    // Without the settings we cannot tell whether to send an SMS; saving blind
    // would bounce her straight back here with no word why.
    if (options === null) {
      setError("We couldn't reach WomSakhi just now. Check your connection and try again.");
      apiAuthOptions().then(setOptions).catch(() => setOptions(null));
      return;
    }
    setError("");
    const phone = `+91${digits}`;
    // She went back, left the number as it was, and the code already sent is still good.
    if (smsOn && sentTo.current === phone && resendIn > 0) { setStep("confirm"); return; }
    setBusy(true);
    try {
      if (phone !== user?.phone) await apiSetPhone(phone);
      if (smsOn) {
        setBusy(false);
        await sendSms(phone);
        return;
      }
      await finish();
    } catch (err) {
      const problem = authError(err, "Could not save your number. Please try again.");
      setError(problem.code === "phone_taken"
        ? "This number is already used by another account. Please use a different number."
        : problem.message);
      setBusy(false);
    }
  }

  const confirm = useCallback(async (value: string) => {
    if (busy || value.length !== 6 || (viaFirebase && !confirmation.current)) return;
    setError("");
    setInvalid(false);
    setBusy(true);
    try {
      if (viaFirebase && confirmation.current) {
        await apiPhoneFirebase(await confirmSmsCode(confirmation.current, value));
      } else {
        await apiPhoneVerify(value);
      }
      await finish();
    } catch (err) {
      const problem = authError(err);
      setInvalid(true);
      setError(problem.status ? problem.message : smsErrorMessage(err));
      setBusy(false);
    }
  }, [busy, finish, viaFirebase]);

  const shown = `+91 ${digits.replace(/(\d{5})(\d{5})/, "$1 $2")}`;
  const m = Math.floor(resendIn / 60);
  const sec = String(resendIn % 60).padStart(2, "0");

  return (
    <AuthShell photo="join" caption={CAPTION} screen="b4" flow="member-join">
      {step === "enter" ? (
        <form onSubmit={save} noValidate className="ac">
          <h1 className="ac-t">{user?.phone && smsOn ? "Confirm your mobile" : "Add your mobile number"}</h1>
          <p className="ac-s">
            We use it to keep your account safe. We never share it.
            {smsOn && " We'll send a code by SMS to confirm it."}
          </p>

          <label className="ac-lbl" htmlFor="phone-number">Mobile number</label>
          <div className={`ac-phone${error ? " bad" : ""}`}>
            <span className="cc"><span className="ac-flag" aria-hidden />+91</span>
            <input
              id="phone-number"
              value={digits.replace(/^(\d{5})(\d)/, "$1 $2")}
              onChange={(e) => { setDigits(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
              type="tel" inputMode="numeric" autoComplete="tel-national" enterKeyHint="send" maxLength={11}
              placeholder="98765 43210"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "phone-error" : undefined}
            />
          </div>
          {error && <p id="phone-error" role="alert" className="ac-err">{error}</p>}

          <button type="submit" className="ac-btn ac-go" disabled={!ready || smsOut || busy || options === undefined}>
            {busy ? <Loader className="ac-spin" aria-hidden /> : null}
            {smsOn ? "Send code by SMS" : "Save and continue"}
            {!busy && <ArrowRight aria-hidden />}
          </button>
          {smsOut && (
            <button type="button" className="ac-btn ac-soft"
              onClick={() => { void apiPhoneLater().then(finish).catch(() => setError("Please try again in a moment.")); }}>
              Carry on — confirm tomorrow <ArrowRight aria-hidden />
            </button>
          )}
          {smsOn && !smsOut && <p className="ac-note"><Smartphone aria-hidden /><span>Once confirmed, you can sign in with just your mobile.</span></p>}
          <p className="ac-link">{user?.email && <>Signed in as <span className="ac-email">{user.email}</span> </>}<span className="ac-nw">{user?.email && "· "}<button type="button" onClick={() => void signOut()}>Sign out</button></span></p>
          {/* Google's invisible robot check attaches here before each SMS. */}
          <div id={RECAPTCHA_ID} />
        </form>
      ) : (
        <div className="ac">
          <BackLink onClick={backToNumber}>Change number</BackLink>
          <h1 className="ac-t">Confirm your mobile</h1>
          <p className="ac-s">Code sent by SMS to <b>{shown}</b></p>
          <CodeInput id="phone-code" value={code} onChange={(v) => { setCode(v); setInvalid(false); setError(""); }}
            onComplete={confirm} disabled={busy} invalid={invalid} label="6-digit code from the SMS" />
          {error && <p role="alert" className="ac-err">{error}</p>}
          <p className="ac-timer" aria-live="polite">
            {resendIn > 0 ? <>New code in <b>{m}:{sec}</b></> : (
              <button type="button" onClick={() => void sendSms(`+91${digits}`)} disabled={busy}>{busy ? "Sending…" : "Send a new code"}</button>
            )}
          </p>
          <p className="ac-note"><Smartphone aria-hidden /><span>Once confirmed, you can sign in with just your mobile.</span></p>
          <div id={RECAPTCHA_ID} />
        </div>
      )}
    </AuthShell>
  );
}

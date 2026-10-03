"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader, Smartphone } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { apiGetMe } from "@/lib/api";
import {
  apiAuthOptions, apiPhoneFirebase, apiPhoneLater, apiPhoneStart, apiSmsAllowance, apiPhoneVerify, apiSetPhone, authError, homeFor, type AuthOptions,
} from "@/lib/auth-api";
import { confirmSmsCode, sendSmsCode, smsErrorMessage, type SmsConfirmation } from "@/lib/firebase-phone";
import { useAuth } from "@/context/AuthContext";
import { CodeInput, useCountdown } from "@/components/auth/CodeInput";
import { AuthShell } from "@/components/auth-shell";
import { BackLink, useBackStep } from "@/components/auth-cards";
import { PREVIEW_MOBILE, PREVIEW_OPTIONS, PREVIEW_STATES, readPreview, type PhonePreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";
import { phoneSchema } from "@/lib/validation";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Her mobile number: add it, and — once SMS codes are switched on — confirm it.
 *
 *   enter    +91 and ten digits → saved (unconfirmed)
 *   confirm  a 6-digit SMS code (sent by Firebase) → confirmed
 *
 * Optional: one confirmed way in (her email) is enough, so "Skip for now" is
 * always there. A confirmed number lets her sign in with an SMS code.
 *
 * The reCAPTCHA host lives in AuthShell's footer slot, OUTSIDE the card: the
 * card has `backdrop-filter`, which makes it the containing block for
 * `position: fixed`, and Google's badge ended up pinned over the card. The
 * badge is hidden (auth-cards.css) and Google's required notice is shown in
 * its place, under the card.
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
  const { user, updateUser } = useAuth();
  const router = useRouter();
  /** undefined while loading, null when the settings could not be fetched. */
  const [options, setOptions] = useState<AuthOptions | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("enter");
  /** The number last saved / sent a code (the field itself lives in `form`). */
  const [digits, setDigits] = useState("");
  // The error shows when she leaves the field or presses submit, and clears as
  // soon as the number is right (lib/validation).
  const form = useForm({ resolver: zodResolver(phoneSchema), mode: "onTouched", reValidateMode: "onChange", defaultValues: { mobile: "" } });
  const fieldError = form.formState.errors.mobile?.message;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [smsOut, setSmsOut] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  const confirmation = useRef<SmsConfirmation | null>(null);
  /** The number the last code went to — back on the number step, the same number goes straight back to its code. */
  const sentTo = useRef("");
  /** Local-only `?preview=`: fixtures instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<PhonePreview | null>(null);

  // Firebase sends and checks its own SMS in the browser; the other providers
  // (Brevo, MSG91) are sent and checked by our server.
  const viaFirebase = !!options?.phone_codes && !!options.firebase;
  const smsOn = !!options?.phone_codes;
  const locale = user?.locale || "en";

  useEffect(() => {
    if (AUTH_PREVIEW) {
      const p = readPreview(PREVIEW_STATES.phone);
      if (p) {
        const t = window.setTimeout(() => {
          setPreview(p);
          setOptions(PREVIEW_OPTIONS);
          if (p === "enter") return;
          setDigits(PREVIEW_MOBILE);
          form.setValue("mobile", PREVIEW_MOBILE);
          if (p === "confirm") { setResendIn(90); setStep("confirm"); }
          else { setSmsOut(true); setError("We can't send SMS codes right now. You can carry on and confirm your number tomorrow."); }
        });
        return () => window.clearTimeout(t);
      }
    }
    apiAuthOptions().then(setOptions).catch(() => setOptions(null));
  }, [setResendIn, form]);

  /**
   * "Skip for now". The mobile is optional; `/auth/phone/later` records that
   * she postponed it (the server may refuse when it has nothing to postpone —
   * that is fine, the fresh account below decides where she goes).
   */
  const [skipping, setSkipping] = useState(false);
  async function skip() {
    if (skipping) return;
    if (AUTH_PREVIEW && preview) return;
    setError("");
    setSkipping(true);
    try {
      await apiPhoneLater().catch(() => undefined);
      const fresh = await apiGetMe();
      updateUser(fresh);
      const next = homeFor(fresh);
      if (next === "/app/phone") {
        setError("We still need your mobile number to go on. Please add it above.");
        setSkipping(false);
        return;
      }
      router.replace(next);
    } catch {
      setError("Please try again in a moment.");
      setSkipping(false);
    }
  }

  const finish = useCallback(async () => {
    if (AUTH_PREVIEW && preview) return;
    const fresh = await apiGetMe();
    updateUser(fresh);
    router.replace(homeFor(fresh));
  }, [router, updateUser, preview]);

  const sendSms = useCallback(async (phoneE164: string) => {
    if (!options?.phone_codes) return;
    if (AUTH_PREVIEW && preview) { setResendIn(options.resend_seconds || 90); setCode(""); setInvalid(false); setStep("confirm"); return; }
    setError("");
    setBusy(true);
    try {
      if (options.firebase) {
        await apiSmsAllowance(phoneE164, "phone_verify");
        confirmation.current = await sendSmsCode(options.firebase, phoneE164, RECAPTCHA_ID, locale, { badge: "inline" });
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
  }, [options, setResendIn, locale, preview]);

  // Already has a number but it isn't confirmed, and SMS is on: go straight to confirming it.
  useEffect(() => {
    if (!smsOn || !user?.phone || user.phone_verified || step !== "enter" || busy) return;
    // Only into an empty field: coming back from the code step keeps what she typed.
    const t = window.setTimeout(() => {
      if (!form.getValues("mobile")) form.setValue("mobile", user.phone.replace(/^\+91/, ""));
    });
    return () => window.clearTimeout(t);
  }, [smsOn, user, step, busy, form]);

  /*
    The code step is its own history entry: the phone's back button — and
    "← Change number" — return to the number step with her number still in it.
  */
  const backToNumber = useBackStep(step === "confirm", () => { setStep("enter"); setError(""); setCode(""); }, "step", "code");

  async function save({ mobile }: { mobile: string }) {
    if (busy || options === undefined) return;
    // Without the settings we cannot tell whether to send an SMS; saving blind
    // would bounce her straight back here with no word why.
    if (options === null) {
      setError("We couldn't reach WomSakhi just now. Check your connection and try again.");
      apiAuthOptions().then(setOptions).catch(() => setOptions(null));
      return;
    }
    setError("");
    setDigits(mobile);
    const phone = `+91${mobile}`;
    if (AUTH_PREVIEW && preview) { await sendSms(phone); return; }
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
      if (problem.code === "phone_taken") {
        form.setError("mobile", { type: "server", message: "This number is already used by another account. Please use a different number." }, { shouldFocus: true });
      } else {
        setError(problem.message);
      }
      setBusy(false);
    }
  }

  const confirm = useCallback(async (value: string) => {
    if (busy || value.length !== 6 || (AUTH_PREVIEW && preview) || (viaFirebase && !confirmation.current)) return;
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
  }, [busy, finish, viaFirebase, preview]);

  /*
    Google's invisible robot check attaches to this element before each SMS —
    outside the card, so nothing on the card can trap its badge. One element
    for both steps: firebase-phone gives each attempt a fresh child.
  */
  const recaptcha = (
    <div className="ac-recaptcha">
      <div id={RECAPTCHA_ID} />
      {(viaFirebase || (AUTH_PREVIEW && preview)) && (
        <p>
          This site is protected by reCAPTCHA and the Google{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
        </p>
      )}
    </div>
  );

  const shown = `+91 ${digits.replace(/(\d{5})(\d{5})/, "$1 $2")}`;
  const m = Math.floor(resendIn / 60);
  const sec = String(resendIn % 60).padStart(2, "0");

  return (
    <AuthShell photo="join" caption={CAPTION} screen="b4" flow="member-join" footer={recaptcha}>
      {step === "enter" ? (
        <form onSubmit={(e) => void form.handleSubmit(save)(e)} noValidate className="ac">
          <h1 className="ac-t">{user?.phone && smsOn ? "Confirm your mobile" : "Add your mobile number"}</h1>
          <p className="ac-s">
            Add your mobile to sign in with SMS — optional. We never share it.
            {smsOn && " We'll send a code by SMS to confirm it."}
          </p>

          <label className="ac-lbl" htmlFor="phone-number">Mobile number</label>
          <div className={`ac-phone${error || fieldError ? " bad" : ""}`}>
            <span className="cc"><span className="ac-flag" aria-hidden />+91</span>
            <Controller name="mobile" control={form.control} render={({ field }) => (
              <input
                id="phone-number"
                ref={field.ref} name={field.name} onBlur={field.onBlur}
                value={field.value.replace(/^(\d{5})(\d)/, "$1 $2")}
                onChange={(e) => { field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                type="tel" inputMode="numeric" autoComplete="tel-national" enterKeyHint="send" maxLength={11}
                placeholder="98765 43210"
                aria-invalid={Boolean(error || fieldError)}
                aria-describedby={[fieldError && "phone-number-error", error && "phone-error"].filter(Boolean).join(" ") || undefined}
              />
            )} />
          </div>
          {fieldError && <p id="phone-number-error" role="alert" className="ac-err">{fieldError}</p>}
          {error && <p id="phone-error" role="alert" className="ac-err">{error}</p>}

          <button type="submit" className="ac-btn ac-go" disabled={smsOut || busy || options === undefined}>
            {busy ? <Loader className="ac-spin" aria-hidden /> : null}
            {smsOn ? "Send code by SMS" : "Save and continue"}
            {!busy && <ArrowRight aria-hidden />}
          </button>
          <button type="button" className="ac-btn ac-line ac-skip" onClick={() => void skip()} disabled={skipping || busy}>
            {skipping ? <Loader className="ac-spin" aria-hidden /> : null}
            Skip for now
          </button>
          {smsOn && !smsOut && <p className="ac-note"><Smartphone aria-hidden /><span>Once confirmed, you can sign in with just your mobile.</span></p>}
          {user?.email && <p className="ac-link">Signed in as <span className="ac-email">{user.email}</span></p>}
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
        </div>
      )}
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </AuthShell>
  );
}

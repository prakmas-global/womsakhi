"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { apiGetMe } from "@/lib/api";
import { apiEmailAddStart, apiEmailAddVerify, authError } from "@/lib/auth-api";
import { email as emailRule } from "@/lib/validation";
import { CodeInput } from "@/components/auth/CodeInput";
import { Btn } from "@/components/ux/kit";
import { Label, Text } from "@/components/ux/kit/form";
import { Sheet } from "@/components/ux/kit/sheet";

/**
 * "Complete your profile" — the other contact, asked later.
 *
 * Joining asks for ONE thing: the mobile number or the email she typed, proved
 * by its code. The other one is asked here, once she is inside the app:
 *
 *   joined with her email   → "Add your mobile number" (the /app/phone screen,
 *                             which sends and checks the SMS code)
 *   joined with her mobile  → "Add your email", done right in this sheet: the
 *                             address, then the code sent to it
 *
 * "Later" hides it for three days on this device. It never shows on the
 * screens that already ask (the phone screen, settings).
 */

const LATER_DAYS = 3;
// Never on the help screens: nothing may stand between a woman in trouble and
// a helpline number — least of all a request to add her phone number.
const QUIET_ON = ["/app/phone", "/app/settings", "/app/verify", "/app/welcome", "/app/onboarding",
                  "/app/safety", "/app/helpdesk", "/app/help"];

const laterKey = (id: string) => `ws.complete-profile.later.${id}`;

function snoozed(id: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(laterKey(id)) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function snooze(id: string) {
  try {
    window.localStorage.setItem(laterKey(id), String(Date.now() + LATER_DAYS * 86_400_000));
  } catch {
    /* storage blocked: it simply asks again next visit */
  }
}

export function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "email" | "code" | "done">("ask");
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isMember = user?.role === "Member";
  const needsEmail = isMember && !user?.email;
  const needsPhone = isMember && !user?.phone;
  const quiet = QUIET_ON.some((p) => pathname.startsWith(p));
  const userId = user?.id ?? "";

  // A moment after she lands, never on top of the screen loading.
  useEffect(() => {
    if (!userId || quiet || !(needsEmail || needsPhone) || snoozed(userId)) return;
    const t = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(t);
  }, [userId, quiet, needsEmail, needsPhone]);

  if (!user || !(needsEmail || needsPhone || step === "done")) return null;

  const later = () => {
    snooze(user.id);
    setOpen(false);
  };
  const problem = emailRule.safeParse(address).error?.issues[0]?.message ?? "";

  const send = async () => {
    setTouched(true);
    if (problem) return;
    setError("");
    setBusy(true);
    try {
      await apiEmailAddStart(address.trim().toLowerCase());
      setCode("");
      setStep("code");
    } catch (err) {
      setError(authError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setError("");
    setBusy(true);
    try {
      await apiEmailAddVerify(address.trim().toLowerCase(), value);
      updateUser(await apiGetMe());
      setStep("done");
    } catch (err) {
      setError(authError(err).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const title = step === "done" ? "Your email is added"
    : step === "code" ? "Check your email"
      : step === "email" ? "Add your email"
        : "Complete your profile";
  const description = step === "done" ? "You'll get receipts there, and can sign in with it too."
    : step === "code" ? `We sent a 6-digit code to ${address.trim()}.`
      : step === "email" ? "For receipts, certificates and getting back into your account."
        : "One more way to reach you keeps your account safe if you lose your phone or your inbox.";

  return (
    <Sheet open={open && !quiet} onClose={step === "done" ? () => setOpen(false) : later} title={title} description={description}
      icon={step === "done" ? "CircleCheck" : "UserRound"}
      footer={
        step === "ask" ? (
          <div className="flex w-full gap-2">
            <Btn variant="outline" onClick={later} className="flex-1">Later</Btn>
            {needsPhone
              ? <Btn href="/app/phone" iconEnd="ArrowRight" className="flex-1" onClick={() => setOpen(false)}>Add mobile</Btn>
              : <Btn iconEnd="ArrowRight" className="flex-1" onClick={() => setStep("email")}>Add email</Btn>}
          </div>
        ) : step === "email" ? (
          <div className="flex w-full gap-2">
            <Btn variant="outline" onClick={() => setStep("ask")} className="flex-1">Back</Btn>
            <Btn onClick={send} loading={busy} className="flex-1">Send code</Btn>
          </div>
        ) : step === "code" ? (
          <div className="flex w-full gap-2">
            <Btn variant="outline" onClick={() => { setStep("email"); setError(""); }} className="flex-1">Change email</Btn>
            <Btn onClick={() => confirm(code)} loading={busy} disabled={code.length !== 6} className="flex-1">Confirm</Btn>
          </div>
        ) : (
          <Btn full onClick={() => setOpen(false)}>Done</Btn>
        )
      }
    >
      {step === "ask" && (
        <ul className="space-y-3">
          <Row done label={user.email ? "Email" : "Mobile number"} value={user.email || user.phone} />
          {needsPhone && <Row label="Mobile number" value="Not added yet" />}
          {needsEmail && <Row label="Email" value="Not added yet" />}
          <Row done label="Your name" value={user.full_name || "Added by our team from your ID card"} />
        </ul>
      )}
      {step === "email" && (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
          <Label need>Email</Label>
          <Text value={address} onChange={(v) => { setAddress(v); setError(""); }} type="email" label="Email"
            placeholder="name@gmail.com" max={254} />
          {touched && problem && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{problem}</p>}
          {error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{error}</p>}
        </form>
      )}
      {step === "code" && (
        <div className="space-y-3">
          <CodeInput id="cp-code" value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={(v) => void confirm(v)}
            disabled={busy} invalid={!!error} label="6-digit code from your email" />
          {error && <p role="alert" className="text-center text-xs" style={{ color: "var(--ux-danger-ink)" }}>{error}</p>}
          <p className="text-center text-xs" style={{ color: "var(--ux-muted)" }}>Can&apos;t find it? Look in Spam or Promotions.</p>
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value, done = false }: { label: string; value: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-[12px] border px-3.5 py-3" style={{ borderColor: "var(--ux-line)" }}>
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
        style={done
          ? { background: "var(--ux-ok-soft, #e8f4ec)", color: "var(--ux-ok-ink, #007d38)" }
          : { background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
        {done ? "✓" : "+"}
      </span>
      <span className="min-w-0">
        <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>{label}</span>
        <span className="block truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{value}</span>
      </span>
    </li>
  );
}

import { AuthIcon } from "./icons";

/** Small pieces the auth screens share, drawn the approved way. */

/** "New code in 1:12" → "Didn't get it? Send a new code" once the wait is over. */
export function AuthResend({ seconds, onResend, busy = false }: { seconds: number; onResend: () => void; busy?: boolean }) {
  if (seconds > 0) {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return <p className="wsa-timer" aria-live="polite">New code in <b>{m}:{s}</b></p>;
  }
  return (
    <p className="wsa-timer">
      Didn&apos;t get it?{" "}
      <button type="button" className="wsa-inline" onClick={onResend} disabled={busy}>
        {busy ? "Sending…" : "Send a new code"}
      </button>
    </p>
  );
}

/** Three bars and "Step 2 of 3". */
export function AuthStepsBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="wsa-steps" role="img" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? "on" : ""} />)}
      <em aria-hidden>Step {step} of {total}</em>
    </div>
  );
}

/** "9876543210" → "98765 43210" for display; digits stay the value. */
export function formatMobile(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** The staff panel's three rows (web, `photo="plain"`), as approved in D1–D3. */
export function StaffAside() {
  return (
    <>
      <div className="wsa-row"><span><AuthIcon name="mail" /></span><div><b>A code by email</b>Sent to your work email.</div></div>
      <div className="wsa-row"><span><AuthIcon name="key" /></span><div><b>Your authenticator app</b>A new 6-digit code every 30 seconds.</div></div>
      <div className="wsa-row"><span><AuthIcon name="shield" /></span><div><b>Every document view is logged</b>Who opened what, and when.</div></div>
    </>
  );
}

export const STAFF_CAPTION = {
  title: "Staff sign-in is protected",
  text: "Staff can open members' identity documents, so every sign-in needs two things.",
};

export const MEMBER_CAPTION = {
  title: "A safe space for women to learn, work and grow",
  text: "Women only. Every member is checked by a real person.",
};

/** A small spinner for busy buttons. */
export function Spinner() {
  return <span className="wsa-spin" aria-hidden />;
}

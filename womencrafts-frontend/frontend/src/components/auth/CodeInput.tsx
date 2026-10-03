"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

import "./code-input.css";

/**
 * The code inside whatever she pasted: "390123", "3 9 0 1 2 3", "390-123",
 * "Your WomSakhi code is 390123", a line break or two. A run of exactly
 * `length` digits wins (so "390123, expires in 10 minutes" is not "390123" +
 * "10"); otherwise the digits once spaces, dashes and dots are gone.
 */
export function codeFromText(text: string, length = 6): string {
  const whole = text.match(new RegExp(`(?<!\\d)\\d{${length}}(?!\\d)`));
  if (whole) return whole[0];
  const spread = text.match(new RegExp(`(?<!\\d)\\d(?:[\\s.\\-\u2013\u2014]*\\d){${length - 1}}(?!\\d)`));
  if (spread) return spread[0].replace(/\D/g, "");
  return text.replace(/\D/g, "").slice(0, length);
}

/**
 * The next value from what is now in the field, given what was there.
 *
 * There is deliberately no `maxLength` on the input: it cut a pasted
 * "3 9 0 1 2 3" to "3 9 0" BEFORE any of this ran, which kept "390". So the
 * whole new text arrives here and is read for what she meant:
 *   · something inserted with six digits in it (autofill, a keyboard's
 *     clipboard chip that bypasses `paste`)  → that code;
 *   · one digit typed into a full field       → a fresh start with that digit;
 *   · anything else                            → the digits, at most `length`.
 */
function nextValue(raw: string, previous: string, length: number): string {
  if (raw.startsWith(previous) && raw.length > previous.length) {
    const inserted = raw.slice(previous.length);
    const fromInsert = codeFromText(inserted, length);
    if (fromInsert.length === length) return fromInsert;
    const digits = inserted.replace(/\D/g, "");
    if (previous.length >= length) return digits.slice(0, length);
    return (previous + digits).slice(0, length);
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length > length) return codeFromText(raw, length);
  return digits;
}

/**
 * Six boxes for a one-time code — backed by ONE real input.
 *
 * Six separate inputs look the same and break everything that matters here:
 * the phone's "paste code from Messages / Gmail" chip, `autocomplete=
 * "one-time-code"` autofill, a pasted code landing in the first box only,
 * and backspace across boxes on Android keyboards. So the real input covers
 * the boxes, transparent, and the boxes only draw what it holds.
 *
 * Calls `onComplete` once the sixth digit arrives, so she never has to find a
 * button after typing a code.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = true,
  id = "one-time-code",
  label = "6-digit code",
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
  label?: string;
  describedBy?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const fired = useRef("");

  useEffect(() => {
    if (value.length === length && value !== fired.current) {
      fired.current = value;
      onComplete?.(value);
    }
    if (value.length < length) fired.current = "";
  }, [value, length, onComplete]);

  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  const active = Math.min(value.length, length - 1);

  return (
    <div className={`auth-code${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}>
      <input
        ref={ref}
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="auth-code-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="done"
        disabled={disabled}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(nextValue(e.target.value, value, length))}
        onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
          const text = e.clipboardData?.getData("text") ?? "";
          const code = codeFromText(text, length);
          if (!code) return; // nothing numeric: let the browser do nothing useful either
          e.preventDefault();
          // A whole code replaces what is there; a part of one carries on from it.
          onChange(code.length === length || value.length >= length ? code : (value + code).slice(0, length));
        }}
      />
      <div className="auth-code-cells" aria-hidden>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`auth-code-cell${i === active && !disabled ? " is-active" : ""}${value[i] ? " is-filled" : ""}`}>
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Resend code in 0:24" → a button once the wait is over. */
export function ResendCode({
  seconds,
  onResend,
  busy = false,
}: {
  /** Seconds left before a new code may be sent. */
  seconds: number;
  onResend: () => void;
  busy?: boolean;
}) {
  if (seconds > 0) {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return (
      <p className="auth-resend" aria-live="polite">
        Didn&apos;t get it? You can ask for a new code in <strong>{m}:{s}</strong>
      </p>
    );
  }
  return (
    <p className="auth-resend">
      Didn&apos;t get it?{" "}
      <button type="button" className="auth-link font-semibold" onClick={onResend} disabled={busy}>
        {busy ? "Sending…" : "Send a new code"}
      </button>
    </p>
  );
}

/** A countdown that ticks down to zero once a second. */
export function useCountdown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

/** "Step 2 of 3" as three short bars — she can see how close she is. */
export function AuthSteps({ step, total, label }: { step: number; total: number; label?: string }) {
  return (
    <div className="auth-steps" aria-label={label ?? `Step ${step} of ${total}`}>
      <div className="auth-steps-bars" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < step ? "is-done" : ""} />
        ))}
      </div>
      <span className="auth-steps-text">Step {step} of {total}</span>
    </div>
  );
}

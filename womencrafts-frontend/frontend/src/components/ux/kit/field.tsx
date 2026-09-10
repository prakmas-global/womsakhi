"use client";

import { useId } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * A labelled field, with every state §37 asks for.
 *
 * ── Why this exists when the design system already has `Input` ──────────────
 * It does, and it is good — but it is styled from the `--wc-*` staff tokens and
 * is used in **zero** member-app files. Every member screen wrote its own
 * `<input>` instead, so error styling, `aria-invalid` and the describedby wiring
 * were present on some and absent on others. One field, on the `--ux-*` tokens
 * the member app actually uses, is the fix.
 *
 * ── The label is never the placeholder ──────────────────────────────────────
 * A placeholder disappears the moment she types, which means the one person who
 * most needs to be reminded what a box is for — someone interrupted mid-form,
 * on a shared phone — is the one who cannot get it back. §37 says use real
 * labels; this makes it structural rather than a rule to remember.
 *
 * ── The error says how to fix it ────────────────────────────────────────────
 * Not "invalid" or "required". `aria-invalid` plus `aria-describedby` means a
 * screen reader announces the field, then what is wrong with it, in one breath
 * — which is the only way an error is useful to someone who cannot see the red.
 */
export function Field({
  label, hint, error, success, disabled, loading, required, children, id: idProp,
}: {
  label: string;
  /** Shown when there is no error. Say what a good answer looks like. */
  hint?: string;
  /** What is wrong AND how to fix it. Never just "invalid". */
  error?: string;
  /** Confirmation for something worth confirming — an available handle, say. */
  success?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  /** Receives id, aria-invalid and aria-describedby. */
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    disabled?: boolean;
  }) => React.ReactNode;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const noteId = error ? `${id}-error` : success ? `${id}-ok` : hint ? `${id}-hint` : undefined;

  return (
    <div className="block" style={disabled ? { opacity: 0.6 } : undefined}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xsm font-bold"
             style={{ color: "var(--ux-ink)" }}>
        {label}
        {/* Marked optional rather than required: on a form where most fields
            are needed, flagging the exceptions is less visual noise than an
            asterisk on every line. */}
        {required === false && (
          <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span>
        )}
        {loading && <Icons.Loader className="ux-spin h-[0.8125rem] w-[0.8125rem]"
                                 style={{ color: "var(--ux-muted)" }} />}
      </label>

      {children({
        id,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(noteId ? { "aria-describedby": noteId } : {}),
        ...(disabled || loading ? { disabled: true } : {}),
      })}

      {error ? (
        <p id={noteId} role="alert"
           className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold"
           style={{ color: "var(--ux-danger-ink)" }}>
          <Icons.AlertCircle className="mt-[2px] h-[0.8125rem] w-[0.8125rem] shrink-0" />
          {error}
        </p>
      ) : success ? (
        <p id={noteId} className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold"
           style={{ color: "var(--ux-green-ink)" }}>
          <Icons.Check className="mt-[2px] h-[0.8125rem] w-[0.8125rem] shrink-0" strokeWidth={3} />
          {success}
        </p>
      ) : hint ? (
        <p id={noteId} className="mt-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The input itself, so every field in the member app has one border and one focus ring. */
export function TextInput({
  value, onChange, placeholder, inputMode, type = "text", invalid, ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  type?: string;
  invalid?: boolean;
} & Record<string, unknown>) {
  return (
    <input
      {...rest}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="ux-sq w-full rounded-[12px] border px-3.5 py-3 text-smd outline-none"
      style={{
        borderColor: invalid ? "var(--ux-danger-solid)" : "var(--ux-line-strong)",
        background: "var(--ux-surface)",
        color: "var(--ux-ink)",
      }}
    />
  );
}

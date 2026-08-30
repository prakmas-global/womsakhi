"use client";

import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Shared control chrome — every text-like control in the app uses these. */
export const labelClass = "mb-1.5 block text-sm font-semibold text-ink-muted";
export const controlClass =
  "wc-inset w-full rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-subtle outline-none transition focus:ring-2 focus:ring-brand-500/40";
export const errorClass = "mt-1 text-xs font-medium text-status-danger-ink";
export const hintClass = "mt-1 text-xs text-ink-subtle";

/** Label + required marker, shared by every field so the marker never drifts. */
export function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {required && <span className="text-brand-ink"> *</span>}
    </label>
  );
}

/** Labelled text input with optional leading icon, hint and error. */
export default function Input({
  label,
  icon: Icon,
  required,
  hint,
  error,
  className = "",
  ...props
}: {
  label?: string;
  icon?: React.ElementType;
  required?: boolean;
  hint?: string;
  /** Validation message — replaces the hint and reddens the control. */
  error?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  /**
   * The label used to be tied to the input with `htmlFor={props.id}` — and of
   * 112 usages across the app, NOT ONE passed an id. So every field rendered a
   * label that looked correct, sat in the right place, and was associated with
   * nothing: a screen reader reached the input and announced "edit text, blank".
   *
   * The failure is invisible on screen, which is why it survived this long. An
   * id generated here cannot be forgotten by a caller.
   */
  const autoId = useId();
  const id = props.id ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <FieldLabel required={required} htmlFor={id}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        )}
        <input
          aria-invalid={error ? true : undefined}
          // Ties the hint or error to the control, so it is read out as part of
          // the field rather than being loose text nearby that never gets read.
          aria-describedby={describedBy}
          {...props}
          id={id}
          className={`${controlClass} ${Icon ? "pl-11" : ""} ${
            error ? "ring-2 ring-rose-400/50" : ""
          }`}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className={errorClass}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Labelled multiline input. */
export function Textarea({
  label,
  required,
  hint,
  error,
  className = "",
  rows = 3,
  ...props
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <FieldLabel required={required} htmlFor={id}>
          {label}
        </FieldLabel>
      )}
      <textarea
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
        id={id}
        className={`${controlClass} resize-none ${error ? "ring-2 ring-rose-400/50" : ""}`}
      />
      {error ? (
        <p id={`${id}-error`} className={errorClass}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

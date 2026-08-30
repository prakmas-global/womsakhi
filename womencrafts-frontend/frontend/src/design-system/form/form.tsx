"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import Input, { Textarea } from "../primitives/Input";
import Select from "../primitives/Select";
import Switch from "../primitives/Switch";
import ImageUpload from "../primitives/ImageUpload";
import Button from "../primitives/Button";

/**
 * The app's form layer: TanStack Form v1 bound to the design-system controls.
 *
 * TanStack Form is headless — it owns values, validation and submission state
 * but renders nothing. These bindings marry it to our inputs once, so a screen
 * writes `<form.AppField name="email">{(f) => <f.Text label="Email" />}</…>`
 * and gets consistent styling, error display and a11y for free.
 *
 * Usage:
 *   const form = useAppForm({
 *     defaultValues: { full_name: "", email: "" },
 *     validators: {
 *       onSubmit: ({ value }) =>
 *         value.full_name.trim() ? undefined : { fields: { full_name: "Name is required" } },
 *     },
 *     onSubmit: async ({ value }) => { await apiCreateMember(value); },
 *   });
 */
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

/** Collapse TanStack's error array into the single message a field shows. */
function firstError(errors: unknown[]): string | undefined {
  const e = errors?.find(Boolean);
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

/** Only surface a validation error once the user has actually touched the field. */
function useFieldError() {
  const field = useFieldContext<unknown>();
  const { isTouched, errors } = field.state.meta;
  return isTouched ? firstError(errors as unknown[]) : undefined;
}

/* ---------------------------------------------------------------- */
/* Bound controls                                                     */
/* ---------------------------------------------------------------- */

function TextField({
  label,
  icon,
  required,
  hint,
  placeholder,
  type = "text",
  className,
}: {
  label?: string;
  icon?: React.ElementType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const field = useFieldContext<string>();
  return (
    <Input
      label={label}
      icon={icon}
      required={required}
      hint={hint}
      type={type}
      className={className}
      placeholder={placeholder}
      name={field.name}
      value={field.state.value ?? ""}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
      error={useFieldError()}
    />
  );
}

function TextareaField({
  label,
  required,
  hint,
  placeholder,
  rows,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const field = useFieldContext<string>();
  return (
    <Textarea
      label={label}
      required={required}
      hint={hint}
      rows={rows}
      className={className}
      placeholder={placeholder}
      name={field.name}
      value={field.state.value ?? ""}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
      error={useFieldError()}
    />
  );
}

function SelectField({
  label,
  icon,
  required,
  options,
  placeholder,
  className,
}: {
  label?: string;
  icon?: React.ElementType;
  required?: boolean;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  className?: string;
}) {
  const field = useFieldContext<string>();
  return (
    <Select
      label={label}
      icon={icon}
      required={required}
      options={options}
      placeholder={placeholder}
      className={className}
      value={field.state.value ?? ""}
      onChange={(e) => field.handleChange(e.target.value)}
    />
  );
}

function SwitchField({ label, description }: { label: string; description?: string }) {
  const field = useFieldContext<boolean>();
  return (
    <Switch
      label={label}
      description={description}
      checked={Boolean(field.state.value)}
      onChange={(v) => field.handleChange(v)}
    />
  );
}

function ImageField({
  label,
  hint,
  kind = "attachment",
  variant = "cover",
  name,
  className,
}: {
  label?: string;
  hint?: string;
  kind?: "avatar" | "cover" | "attachment";
  variant?: "avatar" | "cover";
  /** Display name used for avatar initials. */
  name?: string;
  className?: string;
}) {
  const field = useFieldContext<string>();
  return (
    <ImageUpload
      label={label}
      hint={hint}
      kind={kind}
      variant={variant}
      name={name}
      className={className}
      value={field.state.value || null}
      onChange={(url) => field.handleChange(url ?? "")}
    />
  );
}

/* ---------------------------------------------------------------- */
/* Bound form-level components                                        */
/* ---------------------------------------------------------------- */

/**
 * Submit button wired to the form's own state: disabled while invalid or
 * submitting, and shows a spinner mid-flight. No per-screen boilerplate.
 */
function SubmitButton({
  children = "Save",
  icon,
  variant = "primary",
  className,
}: {
  children?: React.ReactNode;
  icon?: React.ElementType;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          variant={variant}
          icon={icon}
          className={className}
          disabled={!canSubmit}
          loading={isSubmitting}
          onClick={() => form.handleSubmit()}
        >
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Text: TextField,
    Textarea: TextareaField,
    Select: SelectField,
    Switch: SwitchField,
    Image: ImageField,
  },
  formComponents: {
    SubmitButton,
  },
});

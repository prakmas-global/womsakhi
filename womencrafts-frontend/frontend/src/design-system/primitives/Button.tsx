"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

import Spinner from "./Spinner";

/**
 * The one button in the system.
 *
 * Variants map to the `.btn-*` classes in the design system stylesheet, so a
 * colour change happens in tokens.css and nowhere else:
 *   primary   — magenta, the main action on a screen (use one per view)
 *   secondary — purple, an equally weighted alternative action
 *   outline   — neutral utility action (Cancel, filters, toolbars)
 *   danger    — destructive action (Delete, Revoke)
 *   ghost     — inline text link that behaves like a button
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction while an action is in flight. */
  loading?: boolean;
  /** Stretches the button to the width of its container. */
  block?: boolean;
  icon?: React.ElementType;
  /** Puts the icon after the label instead of before it. */
  iconRight?: boolean;
  children?: React.ReactNode;
  className?: string;
};

function classesFor({ variant = "primary", size = "md", block }: CommonProps) {
  return [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Button rendered as a real <button>. */
const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button(
    { variant, size, loading, block, icon: Icon, iconRight, children, className = "", disabled, ...props },
    ref
  ) {
    const iconEl = loading ? (
      <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    ) : Icon ? (
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    ) : null;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${classesFor({ variant, size, block })} ${className}`}
        {...props}
      >
        {!iconRight && iconEl}
        {children}
        {iconRight && iconEl}
      </button>
    );
  }
);

export default Button;

/** Same look, but navigates — use for links that should read as buttons. */
export function ButtonLink({
  href,
  variant,
  size,
  block,
  icon: Icon,
  iconRight,
  children,
  className = "",
}: CommonProps & { href: string }) {
  const iconEl = Icon ? <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null;
  return (
    <Link href={href} className={`${classesFor({ variant, size, block })} ${className}`}>
      {!iconRight && iconEl}
      {children}
      {iconRight && iconEl}
    </Link>
  );
}

/** Square icon-only button, for toolbars and table row actions. */
export function IconButton({
  icon: Icon,
  label,
  variant = "outline",
  size = "md",
  className = "",
  ...props
}: {
  icon: React.ElementType;
  /** Accessible name — icon-only controls must still be announceable. */
  label: string;
} & Omit<CommonProps, "icon" | "children"> &
  ButtonHTMLAttributes<HTMLButtonElement>) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      aria-label={label}
      title={label}
      className={`btn btn-${variant} ${box} shrink-0 !px-0 ${className}`}
      {...props}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

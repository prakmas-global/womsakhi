"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Lightweight dropdown menu: renders a trigger and a floating panel that closes
 * on outside-click or item selection. Used for row action menus and filters.
 */
export default function Menu({
  trigger,
  children,
  align = "right",
  width = "min-w-[13rem]",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* span (not a button) so callers can pass a <button> trigger without
          nesting <button> inside <button> — which is an HTML/hydration error */}
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </span>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`wc-page-enter absolute z-40 mt-2 ${
            align === "right" ? "right-0" : "left-0"
          } ${width} overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_44px_-14px_rgba(80,40,120,0.4)] ring-1 ring-black/5 dark:border-white/10 dark:ring-white/10`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  href,
  danger = false,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const base =
    "group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xsm font-semibold transition";
  const tone = danger
    ? "text-status-danger-ink hover:bg-status-danger-bg dark:hover:bg-rose-500/10"
    : "text-ink-muted hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/5";
  const chip = danger
    ? "bg-status-danger-bg text-status-danger-ink group-hover/mi:bg-status-danger-bg"
    : "bg-surface-inset text-ink-subtle group-hover/mi:bg-brand-100 group-hover/mi:text-brand-ink dark:bg-white/10";

  const inner = (
    <>
      {Icon && (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${chip}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${base} ${tone}`}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`}>
      {inner}
    </button>
  );
}

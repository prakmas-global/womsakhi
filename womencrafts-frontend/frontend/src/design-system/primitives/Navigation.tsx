"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { controlClass } from "./Input";

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

/**
 * Underlined tab bar. Controlled — the page owns which tab is active, so the
 * choice can live in the URL or in query state.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: (string | { value: string; label: ReactNode; count?: number })[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const norm = tabs.map((t) => (typeof t === "string" ? { value: t, label: t, count: undefined } : t));
  return (
    <div className={`flex flex-wrap items-center gap-1 border-b border-line ${className}`} role="tablist">
      {norm.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`relative -mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-brand-600 text-brand-ink"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-2xs font-bold ${
                  active ? "bg-brand-tint text-brand-ink" : "bg-surface-inset text-ink-subtle"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

/** Build a compact page list: 1 … 4 5 6 … 20 */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

/**
 * Page navigation. Fully wired — give it the current page and the total, and it
 * calls back with the page to show.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  showing,
  className = "",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** e.g. "Showing 1 to 8 of 34 items" */
  showing?: string;
  className?: string;
}) {
  const pages = pageWindow(page, Math.max(1, pageCount));
  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition disabled:opacity-40";

  return (
    <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-sm ${className}`}>
      <p className="text-ink-subtle">{showing}</p>
      <div className="flex items-center gap-1">
        <button
          className={`${btn} border border-line-strong text-ink-subtle hover:bg-surface-hover`}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-ink-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${
                p === page
                  ? "bg-brand-600 text-white"
                  : "border border-line-strong text-ink-subtle hover:bg-surface-hover"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          className={`${btn} border border-line-strong text-ink-subtle hover:bg-surface-hover`}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SearchInput                                                         */
/* ------------------------------------------------------------------ */

/** Search box with a leading magnifier. Controlled. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`${controlClass} pl-11`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SelectButton                                                        */
/* ------------------------------------------------------------------ */

/**
 * Filter button that looks like a closed dropdown. Purely a trigger — pair it
 * with <Menu> for the panel, or use <Select> when it should edit a value.
 */
export function SelectButton({
  label,
  className = "",
  onClick,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition hover:bg-surface-hover ${className}`}
    >
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */

/** Checkbox with the brand tick. Supports the indeterminate "some selected" state. */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className = "",
  ...props
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked" | "type">) {
  const id = useId();
  const on = checked || indeterminate;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <label
          htmlFor={id}
          className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-[0.3rem] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 ${
            on ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-transparent"
          }`}
        >
          {indeterminate ? (
            <span className="h-0.5 w-2 rounded bg-surface" />
          ) : checked ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : null}
        </label>
      </span>
      {label && (
        <label htmlFor={id} className="cursor-pointer text-sm text-ink-muted">
          {label}
        </label>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

/** Hover/focus tooltip. CSS-positioned — no portal, so keep it near the edge-safe middle of a layout. */
export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pos = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ${pos}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressBar                                                         */
/* ------------------------------------------------------------------ */

/** Horizontal progress / capacity bar. */
export function ProgressBar({
  value,
  color = "var(--color-brand-600)",
  className = "",
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-inset ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

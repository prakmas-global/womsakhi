"use client";

/**
 * Toggle row — label, optional description and a switch, in one pressed well.
 * Used for every on/off setting in the app.
 */

/** Neumorphic toggle row (label + optional description + switch). */
export default function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      // Without these it announces as "Email notifications, button" — the name
      // is there but the STATE is not, so the one thing a toggle exists to tell
      // you is the one thing it does not say. `role="switch"` plus
      // `aria-checked` makes it "Email notifications, switch, on".
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="wc-inset flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-muted">{label}</span>
        {description && <span className="block text-xs text-ink-subtle">{description}</span>}
      </span>
      <span
        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Card, SectionHead } from "../kit";
import { HomeShell } from "../home/HomeShell";

/**
 * The frame the five settings sub-pages share.
 *
 * Each one is a single subject, so it gets a back link to the hub, one heading
 * and one column — no tabs, no rail full of unrelated things. A settings page
 * that offers four other settings alongside the one she came for is how people
 * end up changing the wrong thing.
 */
export function SettingsPage({
  title, sub, children, footer,
}: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <HomeShell active="/app/settings">
      <Link
        href="/app/settings"
        className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
        style={{ color: "var(--ux-brand)" }}
      >
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> More
      </Link>

      <div className="max-w-[720px]">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{title}</h1>
        {sub && (
          <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{sub}</p>
        )}
        <div className="mt-[20px] space-y-[16px]">{children}</div>
        {footer && <div className="mt-[20px]">{footer}</div>}
      </div>
    </HomeShell>
  );
}

/** A labelled row inside a settings card. */
export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{label}</span>
      {hint && <span className="mt-1 block text-xs" style={{ color: "var(--ux-muted)" }}>{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

/**
 * A settings text field.
 *
 * Every caller passes `id` and pairs it with a `<Field label>`, so the label is
 * real — but nothing made that a requirement, and a caller that forgot would
 * ship a box a screen reader announces as nothing at all. `aria-label` is
 * derived from the placeholder when no other name is given, so the failure mode
 * is a slightly worse name rather than no name.
 */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const named = props.id || props["aria-label"] || props["aria-labelledby"];
  return (
    <input
      aria-label={named ? undefined : (props.placeholder || "Text field")}
      {...props}
      className="ux-sq h-[44px] w-full rounded-[12px] border px-3.5 text-sm outline-none"
      style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
    />
  );
}

/**
 * A switch that says what it does when it is OFF, not only when it is on.
 *
 * "Order updates" beside a toggle tells her nothing about what silence would
 * mean. The line underneath changes with the state, so the consequence of the
 * setting is always on screen.
 */
export function Toggle({
  on, onChange, label, whenOn, whenOff,
}: { on: boolean; onChange: (v: boolean) => void; label: string; whenOn: string; whenOff: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--ux-ink)" }}>{label}</p>
        <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
          {on ? whenOn : whenOff}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="ux-press relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--ux-fill)" : "var(--ux-track)" }}
      >
        <span
          className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white"
          style={{
            insetInlineStart: on ? 23 : 3,
            transition: "inset-inline-start var(--ux-t) var(--ux-ease-spring)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        />
      </button>
    </div>
  );
}

export { Card, SectionHead };

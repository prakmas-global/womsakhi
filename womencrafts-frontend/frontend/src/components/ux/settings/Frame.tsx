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
      {/*
        The way back was a 24px text link with a 16px arrow — under half the
        44px floor, at the very top of a screen a thumb reaches last. On a phone
        it is a real target with a real chevron, which is also the shape every
        phone settings screen uses for "back to the list".
      */}
      <Link
        href="/app/settings"
        className="ux-hov -ms-2 -my-1 mb-2 inline-flex min-h-[44px] items-center gap-1 py-1 pe-3 ps-2 text-[15px] font-semibold
                   lg:-ms-0 lg:mb-3.5 lg:min-h-0 lg:gap-1.5 lg:p-0 lg:py-1 lg:text-xsm lg:font-medium"
        style={{ color: "var(--ux-brand)" }}
      >
        <Icons.ChevronLeft className="ux-ico h-[20px] w-[20px] rtl:rotate-180 lg:hidden" />
        <Icons.ArrowLeft className="ux-ico hidden h-4 w-4 lg:block" /> More
      </Link>

      <div className="max-w-[720px]">
        <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{title}</h1>
        {sub && (
          <p className="mt-1.5 text-[15px] leading-relaxed lg:text-xsm" style={{ color: "var(--ux-muted)" }}>{sub}</p>
        )}
        <div className="mt-[20px] space-y-[20px] lg:space-y-[16px]">{children}</div>
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
      <span className="block text-[15px] font-semibold lg:text-xsm" style={{ color: "var(--ux-ink)" }}>{label}</span>
      {hint && <span className="mt-1 block text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>{hint}</span>}
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
      className="ux-sq h-[48px] w-full rounded-[12px] border px-3.5 text-[16px] outline-none lg:h-[44px] lg:text-sm"
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
    <div className="flex min-h-[52px] items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold lg:text-sm lg:font-medium" style={{ color: "var(--ux-ink)" }}>{label}</p>
        <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
          {on ? whenOn : whenOff}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        /*
          The track stays 26px and the TARGET becomes 44. A transparent 9px
          border on each edge grows the hit area without growing the switch,
          which is how a 26px control clears the 44px floor without looking
          like a toy. `bg-clip-padding` keeps the colour off the border — and
          the style below sets `backgroundColor`, not `background`: the
          shorthand would reset `background-clip` back to `border-box` and the
          track would paint the full 44px after all.
        */
        className="ux-press ux-tap-exempt relative mt-0.5 box-content h-[26px] w-[46px] shrink-0 rounded-full border-y-[9px] border-solid border-transparent bg-clip-padding transition-colors lg:border-y-0"
        style={{ backgroundColor: on ? "var(--ux-fill)" : "var(--ux-track)" }}
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

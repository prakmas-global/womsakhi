import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, KeyRound, Mail, ShieldAlert, Scale } from "lucide-react";

import { DocHeader } from "../_DocHeader";

export const metadata: Metadata = {
  title: "Contact — WomSakhi",
  description: "How to reach WomSakhi, and where to go if you are in danger right now.",
};

/**
 * How to reach us.
 *
 * Sorted by urgency rather than by department, because the woman in the worst
 * situation should not have to read past three support addresses to find the
 * one line that helps her.
 *
 * The emergency numbers at the top are India's national helplines — 112 and 181
 * — and they are deliberately the first thing on the page, above anything about
 * WomSakhi at all. Nothing here should ever be the reason somebody in danger
 * waits for an email.
 */

const INBOXES = [
  {
    icon: Mail,
    address: "hello@womsakhi.com",
    title: "Anything at all",
    body: "Questions, problems, ideas, or something on the app that is plainly wrong.",
  },
  {
    icon: KeyRound,
    address: "hello@womsakhi.com",
    title: "Cannot get into your account",
    body: "Say which email or phone number you joined with. A person will get you back in.",
    cta: { label: "Or reset it yourself", href: "/forgot-password" },
  },
  {
    icon: ShieldAlert,
    address: "safety@womsakhi.com",
    title: "Report a member",
    body: "Harassment, a fake account, or somebody asking you for money to find work. Read by the safety team only.",
  },
  {
    icon: Scale,
    address: "privacy@womsakhi.com",
    title: "Your data",
    body: "To see what we hold about you, correct it, or have it deleted. We answer within 30 days.",
  },
] as const;

export default function ContactPage() {
  return (
    <article className="doc">
      <DocHeader
        title="Contact"
        updated="30 August 2026"
        lede="Write to us about anything. If you are in danger right now, do not write — call."
      />

      {/* Above everything, deliberately. */}
      <div
        className="not-prose my-6 rounded-[16px] p-5"
        style={{ background: "var(--ux-tint-orange)", border: "1px solid var(--ux-orange)" }}
      >
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ux-orange-ink)" }}>
          <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
          If you are in danger right now
        </p>
        <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
          Do not wait for an email from us. Call one of these — they answer 24 hours a day,
          and they are free from any phone.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {[
            ["112", "Emergency — police, fire, ambulance"],
            ["181", "Women’s helpline"],
            ["1098", "Childline"],
          ].map(([number, what]) => (
            <a
              key={number}
              href={`tel:${number}`}
              className="ux-sq flex-1 rounded-[12px] px-4 py-3 text-center"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-orange)", minWidth: 148 }}
            >
              <span className="block text-xl font-bold leading-none" style={{ color: "var(--ux-orange-ink)" }}>
                {number}
              </span>
              <span className="mt-1.5 block text-2xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                {what}
              </span>
            </a>
          ))}
        </div>
      </div>

      <h2>Writing to us</h2>
      <p>
        We read everything and answer within two working days. Please say what you were
        doing when it went wrong — it is usually enough for us to find the problem.
      </p>

      <div className="not-prose my-4 grid gap-3">
        {INBOXES.map(({ icon: Icon, address, title, body, ...rest }) => {
          const cta = "cta" in rest ? rest.cta : undefined;
          return (
            <div
              key={title}
              className="flex items-start gap-3.5 rounded-[12px] p-4"
              style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                  {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  {body}
                </p>
                {/* A flex row, not two inline-blocks: the margin between them
                    collapsed and the address ran straight into the link —
                    "hello@womsakhi.inOr reset it yourself". */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <a
                    href={`mailto:${address}?subject=${encodeURIComponent(title)}`}
                    className="text-xsm font-semibold"
                    style={{ color: "var(--ux-brand)" }}
                  >
                    {address}
                  </a>
                  {cta && (
                    <Link href={cta.href} className="text-xsm font-medium" style={{ color: "var(--ux-muted)" }}>
                      {cta.label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2>Who you are writing to</h2>
      <p>
        WomSakhi is operated by PRAKMAS GLOBAL, Hyderabad, Telangana, India.
      </p>

      <h2>One thing we will never do</h2>
      <p>
        <strong>Nobody from WomSakhi will ever ask you for your password, or ask you to pay
        to find work.</strong> If a message claims to be from us and does either, it is not
        from us — forward it to{" "}
        <a href="mailto:safety@womsakhi.com">safety@womsakhi.com</a> and we will act on it.
      </p>
    </article>
  );
}

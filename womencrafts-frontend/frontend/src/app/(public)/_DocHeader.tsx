import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Shared head for the long-form pages: where you are, and when it last changed. */
export function DocHeader({ title, updated, lede }: { title: string; updated: string; lede: string }) {
  return (
    <>
      <Link
        href="/signin"
        className="ux-hov mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
        style={{ color: "var(--ux-brand)" }}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to sign in
      </Link>
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight" style={{ color: "var(--ux-ink)" }}>
        {title}
      </h1>
      <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--ux-faint)" }}>
        Last updated {updated}
      </p>
      <p className="mt-5 text-[1rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
        {lede}
      </p>
      <hr className="mt-7" style={{ borderColor: "var(--ux-line)" }} />
    </>
  );
}

/**
 * Says out loud that a lawyer has not read this yet.
 *
 * Removing this notice is a decision, not a tidy-up: these pages are accurate
 * about what the software does — every claim was read off the code — but
 * accuracy is not the same as legal sufficiency under the DPDP Act, and a
 * payment provider or app store reviewer is entitled to know which one they
 * are looking at.
 */
export function ReviewNotice() {
  return (
    <div
      className="mt-10 rounded-[12px] p-4"
      style={{ background: "var(--ux-tint-orange)", border: "1px solid var(--ux-orange)" }}
    >
      <p className="text-[0.8125rem] font-semibold" style={{ color: "var(--ux-orange-ink)" }}>
        Draft — not yet reviewed by a lawyer
      </p>
      <p className="mt-1.5 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
        Every statement here describes what the WomSakhi software actually does today,
        checked against the source. It has not been reviewed by a legal professional
        and should be before WomSakhi takes real money or opens to the public.
      </p>
    </div>
  );
}

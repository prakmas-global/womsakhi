"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

/**
 * The screens that belong to this one.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The navigation used to offer thirty destinations as equal choices. Cutting it
 * to nineteen was the right call, but it moved eleven screens out of the rails
 * — and five of them promptly had no way in at all: "Buy together", "Insurance
 * & pension", "Test your skills", "Phone basics" and "Ask for help" existed and
 * nothing pointed at them.
 *
 * That is the real cost of a smaller navigation, and this is the price paid
 * properly: a screen that leaves the rail has to be OFFERED by the screen it
 * belongs to, at the moment it makes sense. "Buy together" belongs under Your
 * shop, because a woman looking at her orders is the woman who needs cheaper
 * materials. "Test your skills" belongs under Courses.
 *
 * Deliberately not a footer of grey links. Each one says what it is for, in the
 * same voice as the rail note it replaced.
 */
export function AlsoHere({
  title = "Also here",
  items,
}: {
  title?: string;
  items: ReadonlyArray<{ href: string; label: string; note: string; icon: string }>;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-[24px]">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xsm font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ux-faint)" }}>
          {title}
        </h2>
        <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
      </div>
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, label, note, icon }) => {
          const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[icon]
            ?? Icons.Circle;
          return (
            <Link
              key={href}
              href={href}
              className="ux-i ux-sq flex items-start gap-3 rounded-[12px] p-3.5"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}
            >
              <span
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
              >
                <I className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                  {label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                  {note}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

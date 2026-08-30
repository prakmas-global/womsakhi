"use client";

import { Shell } from "../Shell";
import { LEARN_NAV } from "../nav";
import { LearningRail } from "./parts";
import { Btn } from "../kit";

/**
 * Every Learning screen sits in the same frame.
 *
 * Screen #6 shows a learning-section sidebar rather than the product-wide one
 * from screen #1, so that is what this uses. Both are kept in nav.ts — the
 * difference may be deliberate, and reconciling it is the user's call.
 */
export function LearningShell({
  active, children, rail = true,
}: { active: string; children: React.ReactNode; rail?: boolean }) {
  return (
    <Shell
      nav={LEARN_NAV}
      active={active}
      user={{ name: "Sakhi", avatar: "/ux/art/avatar-woman-purple-kurta.webp", unread: 3 }}
      sidebarFooter={
        <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--ux-line)", background: "var(--ux-brand-tint)" }}>
          <h3 className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ux-brand)" }}>
            <span aria-hidden>👑</span> Upgrade Your Learning
          </h3>
          <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--ux-muted)" }}>
            Unlock premium courses and exclusive benefits.
          </p>
          <div className="mt-3"><Btn variant="primary" size="sm" full iconEnd="ArrowRight">Go Premium</Btn></div>
        </div>
      }
      rail={rail ? <LearningRail /> : undefined}
    >
      {children}
    </Shell>
  );
}

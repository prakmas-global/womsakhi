"use client";

import { useCallback } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, IconTile, Pill, ScreenSkeleton } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { apiMyServices, type MyServices, type Service } from "@/lib/mentoring-api";
import { rupees } from "@/lib/teach-api";
import { useResource } from "@/lib/use-resource";

/**
 * Your services — the three ways she can offer what she knows.
 *
 * Seller, teacher, mentor. Each is switched on by HER, with a short checklist
 * of what it needs; there is no form to send and no one to approve it. Once on,
 * the card shows what is waiting on her and what it earned this month.
 */

const ROLES = [
  {
    key: "seller" as const, title: "Become a seller", on: "You are a seller", icon: "Store",
    tint: "--ux-tint-pink", ink: "--ux-pink", art: "/ux/art/course-handmade-market-stall.webp",
    what: "Sell what you make or the services you offer — stitching, food, beauty, tuition. Buyers pay you directly.",
    open: "/app/documents", openLabel: "Open my shop", todo: (n: number) => `${n} order${n === 1 ? "" : "s"} to make`,
  },
  {
    key: "teacher" as const, title: "Become a teacher", on: "You are a teacher", icon: "GraduationCap",
    tint: "--ux-tint-violet", ink: "--ux-violet", art: "/ux/art/course-teaching-another-woman.webp",
    what: "Turn what you know into a course with lessons. Free, or set a price — learners pay you by UPI.",
    open: "/app/teach", openLabel: "My courses", todo: (n: number) => `${n} payment${n === 1 ? "" : "s"} to confirm`,
  },
  {
    key: "mentor" as const, title: "Become a mentor", on: "You are a mentor", icon: "HeartHandshake",
    tint: "--ux-tint-orange", ink: "--ux-orange", art: "/ux/art/course-video-call-mentor.webp",
    what: "Guide women one to one — by video, phone or in person. Free sessions, or a price per session.",
    open: "/app/mentoring", openLabel: "My mentoring", todo: (n: number) => `${n} request${n === 1 ? "" : "s"} waiting`,
  },
];

function RoleCard({ role, s }: { role: (typeof ROLES)[number]; s: Service }) {
  const next = s.steps.find((st) => !st.done);
  const done = s.steps.filter((st) => st.done).length;
  return (
    <Card pad={0} className="flex flex-col overflow-hidden">
      <div className="relative aspect-[2/1] overflow-hidden" style={{ background: `var(${role.tint})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={role.art} alt="" className="h-full w-full object-cover" />
        <span className="absolute start-3 top-3">
          {s.active ? <Pill tone="green" size="sm">On</Pill> : <Pill tone="neutral" size="sm">Not set up</Pill>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-[18px]">
        <div className="flex items-center gap-2.5">
          <IconTile icon={role.icon} tint={role.tint} ink={role.ink} size={34} radius={10} />
          <div className="min-w-0">
            <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>{s.active ? role.on : role.title}</h2>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{s.headline}</p>
          </div>
        </div>
        <p className="mt-3 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{role.what}</p>

        <ol className="mt-3.5 space-y-2">
          {s.steps.map((st) => (
            <li key={st.label}>
              <a href={st.href} className="ux-hov flex items-center gap-2.5 text-xsm" style={{ color: st.done ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                      style={{ background: st.done ? "var(--ux-green-ink)" : "var(--ux-track)" }}>
                  {st.done ? <Icons.Check className="h-[11px] w-[11px] text-white" strokeWidth={3} /> : null}
                </span>
                <span className={st.done ? "line-through" : "font-medium"}>{st.label}</span>
              </a>
            </li>
          ))}
        </ol>

        {(s.to_do > 0 || s.earned_minor > 0) && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {s.to_do > 0 && <Pill tone="orange" size="sm">{role.todo(s.to_do)}</Pill>}
            {s.earned_minor > 0 && <Pill tone="green" size="sm">{rupees(s.earned_minor)} this month</Pill>}
          </div>
        )}

        <div className="mt-auto pt-4">
          {next && !s.active
            ? <Btn href={next.href} variant="primary" full iconEnd="ArrowRight">{done ? "Next: " : "Start: "}{next.label.toLowerCase()}</Btn>
            : <Btn href={role.open} variant={s.to_do ? "primary" : "soft"} full iconEnd="ArrowRight">{role.openLabel}</Btn>}
        </div>
      </div>
    </Card>
  );
}

export default function ServicesPage() {
  const { data, source } = useResource(
    useCallback((s: AbortSignal) => apiMyServices(s).catch(() => null), []),
    null as MyServices | null,
  );
  if (!data && source === "loading") return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;
  if (!data) {
    return (
      <HomeShell>
        <ScreenHead title="My services" sub="Seller, teacher, mentor — once your account is verified." />
        <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>You can offer services as soon as our team has verified your account.</p></Card>
      </HomeShell>
    );
  }
  const on = ROLES.filter((r) => data[r.key].active).length;
  return (
    <HomeShell>
      <ScreenHead title="My services"
                  sub={on ? `You offer ${on} of 3. Switch on another whenever you are ready — no approval needed.`
                    : "Three ways to earn from what you know. Switch any of them on yourself — no approval needed."} />
      <div className="grid gap-[16px] lg:grid-cols-3">
        {ROLES.map((r) => <RoleCard key={r.key} role={r} s={data[r.key]} />)}
      </div>
      <p className="mt-[16px] flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        <Icons.ShieldCheck className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "var(--ux-green-ink)" }} />
        Every payment goes straight to you, by UPI — WomSakhi never holds your money and takes no fee. Confirmed
        payments are added to your income book, so they count as proof of what you earn.
      </p>
    </HomeShell>
  );
}

"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Btn, Card, IconTile, Pill, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMe } from "@/components/ux/me";

/**
 * More — the hub behind the last item in the nav.
 *
 * This route did not exist. "More" pointed at it from every screen in the app,
 * and every member who tapped it reached a 404 — the sidebar was the only way
 * to find Settings, Safety, Help and Refer, and it led nowhere.
 */

const GROUPS = [
  {
    title: "Your account",
    items: [
      { href: "/app/settings/account", label: "Your details", note: "Name, photo, phone and address",
        icon: "User", tint: "--ux-tint-violet", ink: "--ux-violet" },
      { href: "/app/profile", label: "Your public profile", note: "What employers and buyers see",
        icon: "IdCard", tint: "--ux-tint-blue", ink: "--ux-blue" },
      { href: "/app/documents", label: "Documents", note: "Aadhaar, PAN, bank and registrations",
        icon: "FileText", tint: "--ux-tint-orange", ink: "--ux-orange" },
      { href: "/app/certificates", label: "Certificates", note: "Everything you have earned",
        icon: "Award", tint: "--ux-tint-green", ink: "--ux-green" },
    ],
  },
  {
    title: "How the app behaves",
    items: [
      { href: "/app/settings/language", label: "Language", note: "For the whole app, and for Sakhi",
        icon: "Languages", tint: "--ux-tint-blue", ink: "--ux-blue" },
      { href: "/app/settings/appearance", label: "Appearance", note: "Light, dark or follow your phone",
        icon: "Palette", tint: "--ux-tint-violet", ink: "--ux-violet" },
      { href: "/app/settings/notifications", label: "Notifications", note: "What reaches you, and how",
        icon: "Bell", tint: "--ux-tint-pink", ink: "--ux-pink" },
      { href: "/app/voice", label: "Reading it out to you", note: "Any screen read aloud, in your language",
        icon: "Volume2", tint: "--ux-tint-violet", ink: "--ux-violet" },
      { href: "/app/settings/voice", label: "Talking to Sakhi", note: "Speak to the assistant instead of typing",
        icon: "Mic", tint: "--ux-tint-orange", ink: "--ux-orange" },
      { href: "/app/settings/offline", label: "Working without signal", note: "What stays on your phone",
        icon: "WifiOff", tint: "--ux-tint-green", ink: "--ux-green" },
      { href: "/app/settings/security", label: "Password and sign-in", note: "Change your password, see your sessions",
        icon: "Lock", tint: "--ux-tint-green", ink: "--ux-green" },
    ],
  },
  {
    title: "Help and safety",
    items: [
      { href: "/app/help", label: "Help", note: "Answers, and a person if you need one",
        icon: "LifeBuoy", tint: "--ux-tint-violet", ink: "--ux-violet" },
      { href: "/app/safety", label: "Safety", note: "Alerts, helplines and known tricks",
        icon: "ShieldCheck", tint: "--ux-tint-orange", ink: "--ux-orange" },
      { href: "/app/feedback", label: "Tell us what you think", note: "We read every message ourselves",
        icon: "MessageSquare", tint: "--ux-tint-blue", ink: "--ux-blue" },
      { href: "/app/refer", label: "Refer a friend", note: "₹250 when she finishes her first course",
        icon: "Gift", tint: "--ux-tint-pink", ink: "--ux-pink" },
    ],
  },
];

export default function MorePage() {
  const ME = useMe();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const name = (user?.full_name || ME.name).trim();

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Appearance" sub="Changes straight away" />
            <div className="ux-sq flex gap-1 rounded-[12px] p-1" style={{ background: "var(--ux-surface-2)" }}>
              {([["light", "Sun", "Light"], ["dark", "Moon", "Dark"], ["system", "Monitor", "Auto"]] as const).map(([t, ic, label]) => {
                const on = theme === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    aria-pressed={on}
                    className="ux-press ux-hov ux-sq flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2.5 text-xs font-medium transition-colors"
                    style={{
                      background: on ? "var(--ux-surface)" : "transparent",
                      color: on ? "var(--ux-brand)" : "var(--ux-muted)",
                      boxShadow: on ? "var(--ux-shadow-card)" : "none",
                    }}
                  >
                    <Icons.Sun className="hidden" />
                    {ic === "Sun" && <Icons.Sun className="ux-ico h-[15px] w-[15px]" />}
                    {ic === "Moon" && <Icons.Moon className="ux-ico h-[15px] w-[15px]" />}
                    {ic === "Monitor" && <Icons.Monitor className="ux-ico h-[15px] w-[15px]" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="About" />
            <div className="space-y-3 text-xsm">
              {[["Version", "1.0.0"], ["Member since", "March 2025"], ["Your ID", "WS-4471"]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span style={{ color: "var(--ux-muted)" }}>{k}</span>
                  <span className="font-medium" style={{ color: "var(--ux-ink)" }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
              <Btn href="/app/help?topic=terms" variant="ghost" size="sm">Terms</Btn>
              <Btn href="/app/help?topic=privacy" variant="ghost" size="sm">Privacy</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>More</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        Your account, how the app behaves, and where to get help.
      </p>

      <Card className="ux-onscroll mb-[24px]">
        <div className="flex items-center gap-4">
          <span className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-full"
                style={{ background: "var(--ux-brand-tint)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={ME.avatar} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--ux-ink)" }}>
              {name}
              <Icons.BadgeCheck className="h-[17px] w-[17px]" style={{ color: "var(--ux-blue)" }} />
            </h2>
            <p className="mt-0.5 truncate text-xsm" style={{ color: "var(--ux-muted)" }}>
              {user?.email ?? "priya.sharma@example.com"}
            </p>
            <div className="mt-2"><Pill tone="green" size="sm">Verified member</Pill></div>
          </div>
          <Btn href="/app/settings/account" variant="outline" size="sm" icon="Pencil">Edit</Btn>
        </div>
      </Card>

      <div className="space-y-[24px]">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <SectionHead title={g.title} />
            <div className="ux-deck grid grid-cols-2 gap-[12px]">
              {g.items.map((it, i) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="ux-i ux-sq ux-onscroll flex items-center gap-3.5 rounded-[12px] border p-3.5"
                  style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
                >
                  <IconTile icon={it.icon} tint={it.tint} ink={it.ink} size={42} radius={11} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {it.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                      {it.note}
                    </span>
                  </span>
                  <Icons.ChevronRight className="ux-arrow h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card className="ux-onscroll mt-[24px]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Sign out</h3>
            <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
              You will need your password to come back in.
            </p>
          </div>
          <Btn variant="outline" icon="LogOut" onClick={() => void signOut()}>Sign out</Btn>
        </div>
      </Card>
    </HomeShell>
  );
}

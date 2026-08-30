"use client";

import {
  LogOut,
  Users,
  Monitor,
  Clock,
  ShieldCheck,
  FileText,
  Download,
  Bell,
  CircleCheck,
  Lock,
  Heart,
  Leaf,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/design-system";
import { useAuth } from "@/context/AuthContext";

const INFO = [
  { icon: Users, tone: "violet", label: "Logged in as", value: "Admin User", note: "Super Admin" },
  { icon: Monitor, tone: "emerald", label: "Current Session", value: "Chrome on Windows", note: "Mumbai, India" },
  { icon: Clock, tone: "sky", label: "Login Time", value: "May 20, 2024", note: "09:30 AM IST" },
  { icon: ShieldCheck, tone: "amber", label: "Security Status", value: "All good", note: "No active alerts", valueTone: "text-status-ok-ink" },
];

const BEFORE = [
  { icon: FileText, title: "Make sure you've saved all important data", desc: "Any unsaved changes will be lost." },
  { icon: Download, title: "Download important reports or data", desc: "You can always generate them again later." },
  { icon: Bell, title: "Set your notifications", desc: "Stay updated even when you're offline." },
];

const AFTER = [
  "You will be securely logged out from this device.",
  "You will be redirected to the login page.",
  "To access your account, you'll need to sign in again.",
  "All active sessions on other devices will remain active.",
];

const TONE_BG: Record<string, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
};

export default function LogoutPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <LogOut className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Logout Confirmation</h1>
          <p className="mt-1 text-sm text-ink-subtle">You&apos;re about to log out of your WomSakhi admin account.</p>
        </div>
      </div>

      <Card>
        {/* hero */}
        <div className="flex flex-col items-center pt-4 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-brand-tint to-violet-tint">
            <LogOut className="h-11 w-11 text-violet-ink" />
            <Leaf className="absolute -bottom-1 left-2 h-6 w-6 -rotate-12 text-brand-ink" />
            <Sparkles className="absolute right-1 top-3 h-4 w-4 text-violet-300" />
            <Sparkles className="absolute bottom-4 left-0 h-3 w-3 text-brand-ink" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold text-ink">Are you sure you want to log out?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-subtle">
            For your security, we recommend logging out when you&apos;re done accessing your account.
          </p>
        </div>

        {/* info strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-inset/60 p-5 lg:grid-cols-4">
          {INFO.map((it) => (
            <div key={it.label} className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONE_BG[it.tone]}`}>
                <it.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-subtle">{it.label}</p>
                <p className={`truncate text-sm font-semibold ${it.valueTone ?? "text-ink"}`}>{it.value}</p>
                <p className="truncate text-xs text-ink-subtle">{it.note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* two columns */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-line p-5">
            <h3 className="font-display text-base font-semibold text-ink">Before you go...</h3>
            <ul className="mt-4 space-y-4">
              {BEFORE.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <b.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{b.title}</p>
                    <p className="text-xs text-ink-subtle">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-status-ok-border bg-status-ok-bg/40 p-5">
            <h3 className="font-display text-base font-semibold text-ink">After logout</h3>
            <ul className="mt-4 space-y-4">
              {AFTER.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-ok-ink" />
                  <p className="text-sm text-ink-muted">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* action bar */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line p-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-outline"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
          <button
            onClick={signOut}
            className="btn btn-danger"
          >
            <LogOut className="h-4 w-4" /> Yes, Logout
          </button>
        </div>
      </Card>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-subtle">
        <Lock className="h-4 w-4 text-ink-subtle" />
        Your security is our priority. Thank you for helping us keep WomSakhi secure.
        <Heart className="h-4 w-4 fill-brand-500 text-brand-500" />
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleCheck, Clock, Heart, KeyRound, Leaf, Lock, LogOut, ShieldCheck, Sparkles, User, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, useConfirm, useToast } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiMyAccount, apiSignOutEverywhere, formatWhen, type MyAccount } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";

/**
 * Log out.
 *
 * The strip across the top used to say "Admin User · Chrome on Windows ·
 * May 20, 2024" to whoever was signed in. It now says who is actually
 * signed in, when this session began, and when she last signed in — and the
 * list of consequences is true: a plain log-out ends THIS session only, and
 * the button that ends the others is here too.
 */

const TONE_BG: Record<string, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
};

const AFTER = [
  "This device is signed out and taken to the sign-in screen.",
  "To get back in, you sign in again.",
  "Any other device signed in to this account stays signed in — use “Sign out everywhere” to end those too.",
];

export default function LogoutPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [busy, setBusy] = useState<"out" | "everywhere" | null>(null);

  useEffect(() => {
    let alive = true;
    apiMyAccount().then((a) => { if (alive) setAccount(a); }).catch(() => { /* the strip falls back to the session user */ });
    return () => { alive = false; };
  }, []);

  const logOut = useCallback(async () => {
    setBusy("out");
    await signOut();
  }, [signOut]);

  const endEverywhere = useCallback(async () => {
    const ok = await confirm({
      title: "End every session, including this one?",
      description: "Every device signed in to this account is signed out on its next request.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (!ok) return;
    setBusy("everywhere");
    try {
      await apiSignOutEverywhere();
      toast.success("Every session was ended");
      await signOut();
    } catch (e) {
      toast.error("Could not end the sessions", { description: memberError(e) });
      setBusy(null);
    }
  }, [confirm, signOut, toast]);

  const name = account?.full_name || user?.full_name || "";
  const role = account?.role || user?.role || "";
  const started = formatWhen(account?.this_session.started_at ?? "");
  const lastLogin = formatWhen(account?.last_login_at ?? "");

  const info = [
    { icon: User, tone: "violet", label: "Signed in as", value: name || "—", note: role },
    { icon: Clock, tone: "emerald", label: "This session started", value: started || "Unknown", note: account?.this_session.expires_at ? `Lapses ${formatWhen(account.this_session.expires_at)} if idle` : "" },
    { icon: KeyRound, tone: "sky", label: "Last signed in", value: lastLogin || "Not recorded", note: "Most recent successful sign-in" },
    { icon: ShieldCheck, tone: "amber", label: "Sessions ended everywhere", value: account ? String(account.token_version) : "—", note: account?.sessions_ended_at ? `Last ${formatWhen(account.sessions_ended_at)}` : "Never, on this account" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <LogOut className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Log out</h1>
          <p className="mt-1 text-sm text-ink-subtle">You are about to leave the WomSakhi dashboard on this device.</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col items-center pt-4 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-brand-tint to-violet-tint">
            <LogOut className="h-11 w-11 text-violet-ink" />
            <Leaf className="absolute -bottom-1 left-2 h-6 w-6 -rotate-12 text-brand-ink" />
            <Sparkles className="absolute right-1 top-3 h-4 w-4 text-violet-300" />
            <Sparkles className="absolute bottom-4 left-0 h-3 w-3 text-brand-ink" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold text-ink">Log out of this device?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-subtle">
            On a shared computer, log out when you are done. If this account was opened on a device you do not control,
            sign out everywhere instead.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-inset/60 p-5 lg:grid-cols-4">
          {info.map((it) => (
            <div key={it.label} className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONE_BG[it.tone]}`}>
                <it.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-subtle">{it.label}</p>
                <p className="truncate text-sm font-semibold text-ink" title={it.value}>{it.value}</p>
                {it.note && <p className="truncate text-xs text-ink-subtle">{it.note}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-status-ok-border bg-status-ok-bg/40 p-5">
          <h3 className="font-display text-base font-semibold text-ink">What happens</h3>
          <ul className="mt-4 space-y-3">
            {AFTER.map((a) => (
              <li key={a} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-ok-ink" />
                <p className="text-sm text-ink-muted">{a}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line p-5">
          <button onClick={() => router.push("/dashboard")} className="btn btn-outline" disabled={busy !== null}>
            <X className="h-4 w-4" /> Stay signed in
          </button>
          <button onClick={() => void endEverywhere()} className="btn btn-secondary" disabled={busy !== null}>
            <ShieldCheck className="h-4 w-4" /> {busy === "everywhere" ? "Ending…" : "Sign out everywhere"}
          </button>
          <button onClick={() => void logOut()} className="btn btn-danger" disabled={busy !== null}>
            <LogOut className="h-4 w-4" /> {busy === "out" ? "Logging out…" : "Log out"}
          </button>
        </div>
      </Card>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-subtle">
        <Lock className="h-4 w-4 text-ink-subtle" />
        Thank you for helping keep WomSakhi safe.
        <Heart className="h-4 w-4 fill-brand-500 text-brand-500" />
      </p>
    </div>
  );
}

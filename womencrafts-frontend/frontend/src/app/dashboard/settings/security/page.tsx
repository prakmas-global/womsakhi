"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Check, Copy, KeyRound, LogOut, Mail, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { Alert, Badge, Card, Spinner, useToast } from "@/design-system";
import {
  apiEnableTwoFactor, apiMyAccount, apiStaffActivity, apiStartTwoFactor, formatWhen,
  type ActivityItem, type MyAccount, type TwoFactorSetup,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";
import MyDevicesCard, { useSignOutEverywhere } from "@/components/admin/MyDevicesCard";

/**
 * Security — the controls that exist, and only those.
 *
 * There are no passwords. Staff sign in with a code sent to their email AND a
 * code from an authenticator app; the authenticator is required, so there is
 * no "turn it off". What she can do here is move it to a new phone, see every
 * device signed in to the account, sign any of them out, or sign out
 * everywhere at once.
 */

function Fact({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-status-danger-ink" : tone === "warn" ? "text-status-warn-ink" : "text-ink";
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className={`text-right font-medium ${cls}`}>{value}</span>
    </div>
  );
}

type Step = "idle" | "current" | "scan" | "codes";

function CodeInput({ value, onChange, id, allowRecovery = false }: {
  value: string; onChange: (v: string) => void; id: string; allowRecovery?: boolean;
}) {
  return (
    <input
      id={id} value={value} autoFocus autoComplete="one-time-code"
      inputMode={allowRecovery ? "text" : "numeric"}
      placeholder={allowRecovery ? "123456 or a recovery code" : "123456"}
      onChange={(e) => onChange(allowRecovery
        ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20)
        : e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="min-w-48 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2.5 font-mono text-sm tracking-[0.2em] text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
    />
  );
}

export default function SecuritySettingsPage() {
  const toast = useToast();
  const everywhere = useSignOutEverywhere();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tfError, setTfError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    const [acc, acts] = await Promise.all([
      apiMyAccount(),
      apiStaffActivity({ mine: true, limit: 5 }).catch(() => [] as ActivityItem[]),
    ]);
    return { acc, acts };
  }, []);

  const load = useCallback(async () => {
    try {
      const { acc, acts } = await fetchAll();
      setAccount(acc); setRecent(acts); setLoadError("");
    } catch (e) { setLoadError(memberError(e)); }
  }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { acc, acts } = await fetchAll();
        if (!alive) return;
        setAccount(acc); setRecent(acts); setLoadError("");
      } catch (e) {
        if (alive) setLoadError(memberError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchAll]);

  const cancel = () => { setStep("idle"); setCode(""); setSetup(null); setTfError(""); };

  const start = useCallback(async () => {
    if (!code.trim()) { setTfError("Enter the code your current authenticator shows."); return; }
    setBusy(true); setTfError("");
    try {
      setSetup(await apiStartTwoFactor(code.trim()));
      setCode(""); setStep("scan");
    } catch (e) { setTfError(memberError(e)); }
    finally { setBusy(false); }
  }, [code]);

  const confirmNew = useCallback(async () => {
    if (code.length !== 6) { setTfError("Enter the six-digit code the new phone shows."); return; }
    setBusy(true); setTfError("");
    try {
      const res = await apiEnableTwoFactor(code);
      setRecoveryCodes(res.recovery_codes);
      setSetup(null); setCode(""); setCopied(false); setStep("codes");
      toast.success("Authenticator moved", { description: "The old phone's codes no longer work." });
      await load();
    } catch (e) { setTfError(memberError(e)); }
    finally { setBusy(false); }
  }, [code, load, toast]);

  const copyCodes = () => {
    navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(
      () => { setCopied(true); toast.success("Recovery codes copied"); },
      () => toast.error("Could not copy — write them down by hand"),
    );
  };

  const enabled = !!account?.two_factor.enabled;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Security</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            How you sign in, the devices signed in to this account, and the switch that ends them all.
          </p>
        </div>
      </div>

      {loadError && <Alert variant="danger" className="mb-4">{loadError}</Alert>}

      <ResizableColumns id="settings-security" defaultSize={0.66} className="gap-6">
        <div className="space-y-6">
          {/* how she signs in */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Authenticator app</h2>
                  <p className="mt-0.5 text-sm text-ink-subtle">
                    Every staff sign-in needs a code sent to your email and a code from this app.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge tone="slate">Required</Badge>
                {account && <Badge tone={enabled ? "emerald" : "amber"}>{enabled ? "Enabled" : "Not set up"}</Badge>}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-violet-ink" />
                <p className="text-xs leading-relaxed text-ink-muted">
                  <b className="text-ink">No password.</b> A six-digit code is sent to {account?.email || "your work email"} each time you sign in.
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-ink" />
                <p className="text-xs leading-relaxed text-ink-muted">
                  <b className="text-ink">Lost your phone?</b> Use a recovery code, or ask another Super Admin to reset your authenticator.
                </p>
              </div>
            </div>

            {step === "idle" && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-sm text-ink-muted">Got a new phone? Move the authenticator before you wipe the old one.</p>
                <button className="btn btn-outline" onClick={() => { setStep("current"); setTfError(""); }}>
                  <Smartphone className="h-4 w-4" /> Move to a new phone
                </button>
              </div>
            )}

            {step === "current" && (
              <div className="mt-5 space-y-3 rounded-xl border border-line bg-surface-2 p-4">
                <p className="text-sm font-semibold text-ink">Step 1 of 3 · Prove it is you</p>
                <label htmlFor="tf-current" className="block text-xs text-ink-subtle">
                  Enter the code your <b>current</b> authenticator shows, or one of your recovery codes.
                </label>
                <div className="flex flex-wrap gap-2">
                  <CodeInput id="tf-current" value={code} onChange={setCode} allowRecovery />
                  <button className="btn btn-primary" disabled={busy || code.length < 6} onClick={() => void start()}>
                    {busy ? "Checking…" : "Continue"}
                  </button>
                  <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
                </div>
              </div>
            )}

            {step === "scan" && setup && (
              <div className="mt-5 space-y-4 rounded-xl border border-line bg-surface-2 p-4">
                <p className="text-sm font-semibold text-ink">Step 2 of 3 · Scan with the new phone</p>
                <div className="flex flex-wrap items-start gap-5">
                  <div
                    aria-label="QR code for your authenticator app" role="img"
                    className="h-56 w-56 max-w-full shrink-0 rounded-2xl border border-line bg-white p-1 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                    // Generated by our own server from the provisioning URI.
                    dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
                  />
                  <div className="min-w-60 flex-1 space-y-2">
                    <p className="text-xs text-ink-subtle">
                      Open your authenticator app on the new phone and scan this code. Cannot scan? Choose
                      “enter a setup key” and type this:
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface p-2.5">
                      <code className="min-w-0 flex-1 break-all text-sm font-semibold tracking-wider text-ink">{setup.secret}</code>
                      <button aria-label="Copy setup key" className="btn btn-sm btn-ghost"
                              onClick={() => void navigator.clipboard?.writeText(setup.secret)}>
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <label htmlFor="tf-new" className="block pt-2 text-sm font-semibold text-ink">
                      Step 3 of 3 · Enter the code the new phone shows
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <CodeInput id="tf-new" value={code} onChange={setCode} />
                      <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={() => void confirmNew()}>
                        {busy ? "Checking…" : "Confirm new phone"}
                      </button>
                      <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
                    </div>
                    <p className="text-xs text-ink-subtle">Your old phone keeps working until this step succeeds.</p>
                  </div>
                </div>
              </div>
            )}

            {step === "codes" && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Check className="h-4 w-4" /> Authenticator moved. Save these recovery codes now.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Each code works once, in place of the app, if you lose your phone. They will not be shown again,
                  and your old codes have stopped working.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-amber-950 sm:grid-cols-4">
                  {recoveryCodes.map((c) => <span key={c} className="rounded-md bg-white/70 px-2 py-1 text-center">{c}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-sm btn-outline" onClick={copyCodes}>
                    {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy codes</>}
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => { setRecoveryCodes([]); setStep("idle"); }}>
                    I have saved them
                  </button>
                </div>
              </div>
            )}

            {tfError && <p role="alert" className="mt-3 text-sm font-medium text-status-danger-ink">{tfError}</p>}
          </Card>

          <MyDevicesCard compact />

          {/* sign out everywhere */}
          <Card className="border-status-danger-border">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-status-danger-bg text-status-danger-ink">
                  <LogOut className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Sign out everywhere</h2>
                  <p className="mt-0.5 text-sm text-ink-subtle">
                    Ends every session on every device, including this one. For when this account was opened somewhere you do not control.
                  </p>
                </div>
              </div>
              <button className="btn btn-danger shrink-0" onClick={() => void everywhere.run()} disabled={everywhere.ending}>
                <LogOut className="h-4 w-4" /> {everywhere.ending ? "Ending…" : "Sign out everywhere"}
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-subtle">
              To close this account altogether, ask another Super Admin to suspend it from Staff. There is no self-service deletion,
              because a staff account is also the record of what that person did here.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-ink">What the account records</h2>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : account && (
              <div className="space-y-2.5">
                <Fact label="Last signed in" value={formatWhen(account.last_login_at) || "Not recorded"} />
                <Fact label="Sign-in method" value="Email code + authenticator" />
                <Fact label="Authenticator" value={enabled ? "Enabled" : "Not set up"} tone={enabled ? undefined : "warn"} />
                <Fact label="Signed out everywhere" value={account.sessions_ended_at ? formatWhen(account.sessions_ended_at) : "Never"} />
                <Fact label="This session started" value={formatWhen(account.this_session.started_at) || "Unknown"} />
              </div>
            )}
            <Link href="/dashboard/settings/sessions" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-ink hover:underline">
              <KeyRound className="h-3.5 w-3.5" /> Sessions and where this account has acted from
            </Link>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Your last actions</h2>
              <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-violet-ink hover:underline">
                Full log
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-subtle">Nothing audited on this account in the last 30 days.</p>
            ) : (
              <ul className="space-y-3.5">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-muted">{a.detail || a.action}</p>
                      <p className="text-xs text-ink-subtle">{a.when}{a.ip ? ` · from ${a.ip}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}

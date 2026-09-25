"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  Activity, Check, Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck, ShieldOff,
} from "lucide-react";
import Link from "next/link";
import { Alert, Badge, Card, ProgressBar, Spinner, useConfirm, useToast } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import {
  apiChangeMyPassword, apiMyAccount, apiSignOutEverywhere, apiStaffActivity, formatWhen,
  type ActivityItem, type MyAccount,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Security — the controls that exist, and only those.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * A 2FA switch with nothing behind it, a "Login alerts" toggle nothing read,
 * "3 trusted devices", "Account recovery: configured", a Delete Account
 * button that toasted "Account deleted" and deleted nothing, two fixed
 * sessions, five fixed login-history rows, and a checklist that said
 * "Two-factor authentication is enabled" to every account.
 *
 * ── What is here now ────────────────────────────────────────────────────────
 * A password change that also ends every other session; the honest statement
 * that two-factor sign-in is not available yet (there is no authenticator
 * library on the server, so a switch would be a lie); "sign out everywhere",
 * which is real; and the facts the account actually carries — last sign-in,
 * when the password was last changed, failed attempts, lock state — plus the
 * last few audited actions with the address they came from.
 */

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score += 40;
  if (pw.length >= 12) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  return Math.min(score, 100);
}

function PasswordField({
  label, value, onChange, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-3 pr-10 text-sm tracking-widest text-ink-muted outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-muted"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-status-danger-ink" : tone === "warn" ? "text-status-warn-ink" : "text-ink";
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className={`text-right font-medium ${cls}`}>{value}</span>
    </div>
  );
}

export default function SecuritySettingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { signOut } = useAuth();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** When the facts were fetched — the clock the lock state is judged against. */
  const [loadedAt, setLoadedAt] = useState(0);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [changing, setChanging] = useState(false);
  const [ending, setEnding] = useState(false);

  const fetchAll = useCallback(async () => {
    const [acc, acts] = await Promise.all([
      apiMyAccount(),
      apiStaffActivity({ mine: true, limit: 5 }).catch(() => [] as ActivityItem[]),
    ]);
    return { acc, acts, at: Date.now() };
  }, []);

  const load = useCallback(async () => {
    try {
      const { acc, acts, at } = await fetchAll();
      setAccount(acc);
      setRecent(acts);
      setLoadedAt(at);
      setLoadError("");
    } catch (e) {
      setLoadError(memberError(e));
    }
  }, [fetchAll]);

  // One wave on mount, the way the reference screen does it: state is set only
  // after the request answers, never synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { acc, acts, at } = await fetchAll();
        if (!alive) return;
        setAccount(acc);
        setRecent(acts);
        setLoadedAt(at);
        setLoadError("");
      } catch (e) {
        if (alive) setLoadError(memberError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchAll]);

  const strength = scorePassword(newPw);
  const strengthColor = strength >= 70 ? "var(--status-ok-solid)" : strength >= 40 ? "var(--status-warn-solid)" : "var(--status-danger-solid)";
  const strengthLabel = strength >= 70 ? "Strong password" : strength >= 40 ? "Medium strength" : "Weak password";
  const strengthTextClass = strength >= 70 ? "text-status-ok-ink" : strength >= 40 ? "text-status-warn-ink" : "text-status-danger-ink";

  const changePassword = useCallback(async () => {
    if (!currentPw || !newPw || !confirmPw) { setPwError("All three fields are needed."); return; }
    if (newPw.length < 8) { setPwError("Use at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("The new password and its confirmation do not match."); return; }
    setPwError("");
    setChanging(true);
    try {
      const res = await apiChangeMyPassword(currentPw, newPw);
      toast.success("Password changed", {
        description: res.other_sessions_ended
          ? "Every other session on this account was signed out. This one carries on."
          : res.message,
      });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      await load();
    } catch (err) {
      setPwError(memberError(err));
    } finally {
      setChanging(false);
    }
  }, [confirmPw, currentPw, load, newPw, toast]);

  const endEverywhere = useCallback(async () => {
    const ok = await confirm({
      title: "End every session, including this one?",
      description: "Every device signed in to this account is signed out on its next request, and so is this one. You will be taken to the sign-in screen.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (!ok) return;
    setEnding(true);
    try {
      await apiSignOutEverywhere();
      toast.success("Every session was ended", { description: "Sign in again to carry on." });
      await signOut();
    } catch (e) {
      toast.error("Could not end the sessions", { description: memberError(e) });
      setEnding(false);
    }
  }, [confirm, signOut, toast]);

  const lockedUntil = account?.locked_until ? new Date(account.locked_until) : null;
  const isLocked = !!lockedUntil && lockedUntil.getTime() > loadedAt;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Security</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Your password, your sessions, and what the account actually records about them.
          </p>
        </div>
      </div>

      {loadError && <Alert variant="danger" className="mb-4">{loadError}</Alert>}

      <ResizableColumns id="settings-security" defaultSize={0.66} className="gap-6">
        <div className="space-y-6">
          {/* change password */}
          <Card>
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink">Change password</h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Changing it ends every other session on this account. The one you change it from carries on.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <PasswordField label="Current password" value={currentPw} onChange={setCurrentPw} autoComplete="current-password" />
              <div>
                <PasswordField label="New password" value={newPw} onChange={setNewPw} autoComplete="new-password" />
                {newPw && (
                  <div className="mt-2">
                    <ProgressBar value={strength} color={strengthColor} />
                    <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${strengthTextClass}`}>
                      <Check className="h-3.5 w-3.5" /> {strengthLabel}
                    </p>
                  </div>
                )}
              </div>
              <PasswordField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {pwError && <span className="text-sm font-medium text-status-danger-ink">{pwError}</span>}
              <button className="btn btn-primary" onClick={() => void changePassword()} disabled={changing}>
                {changing ? "Changing…" : "Change password"}
              </button>
            </div>
          </Card>

          {/* two-factor */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-inset text-ink-subtle">
                  <ShieldOff className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">Two-factor sign-in</h2>
                  <p className="mt-0.5 text-sm text-ink-subtle">A code from an authenticator app at sign-in.</p>
                </div>
              </div>
              <Badge tone="slate">Not available yet</Badge>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              {account?.two_factor.note ?? "Two-factor sign-in is not available yet."}
            </p>
          </Card>

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
              <button className="btn btn-danger shrink-0" onClick={() => void endEverywhere()} disabled={ending}>
                <LogOut className="h-4 w-4" /> {ending ? "Ending…" : "Sign out everywhere"}
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-subtle">
              To close this account altogether, ask another Super Admin to suspend it from Staff. There is no self-service deletion,
              because a staff account is also the record of what that person did here.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          {/* status facts */}
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-ink">What the account records</h2>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : account && (
              <div className="space-y-2.5">
                <Fact label="Last signed in" value={formatWhen(account.last_login_at) || "Not recorded"} />
                <Fact label="Password last changed" value={formatWhen(account.password_changed_at) || "Not recorded"} />
                <Fact label="Failed sign-in attempts" value={String(account.failed_logins)} tone={account.failed_logins > 0 ? "warn" : undefined} />
                <Fact label="Sign-in lock" value={isLocked ? `Locked until ${formatWhen(account.locked_until)}` : "None"} tone={isLocked ? "danger" : undefined} />
                <Fact label="Sessions ended everywhere" value={account.sessions_ended_at ? `${account.token_version} · last ${formatWhen(account.sessions_ended_at)}` : String(account.token_version)} />
                <Fact label="This session started" value={formatWhen(account.this_session.started_at) || "Unknown"} />
                <Fact label="Two-factor sign-in" value="Not available" />
              </div>
            )}
            {!loading && account && !account.password_changed_at && (
              <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
                A password change made before this was tracked has no date. The next one will.
              </p>
            )}
            <Link href="/dashboard/settings/sessions" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-ink hover:underline">
              <KeyRound className="h-3.5 w-3.5" /> Sessions and where this account has acted from
            </Link>
          </Card>

          {/* recent actions */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Your last actions</h2>
              <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-violet-ink hover:underline">
                Full log
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-subtle">Nothing audited on this account yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-muted">{a.detail || a.action}</p>
                      <p className="text-xs text-ink-subtle">
                        {a.when}{a.ip ? ` · from ${a.ip}` : ""}
                      </p>
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

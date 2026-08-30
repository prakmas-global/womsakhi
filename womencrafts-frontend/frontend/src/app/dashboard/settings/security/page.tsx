"use client";

import { useId, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Bell,
  MailCheck,
  Monitor,
  KeyRound,
  Trash2,
  ChevronRight,
  Check,
  Globe,
  Smartphone,
  LogOut,
  MoreVertical,
  Download,
  X,
} from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, ProgressBar, Switch, NoResults, useToast } from "@/design-system";
import Link from "next/link";
import { apiStaffChangePassword } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

type SecurityOption = {
  icon: React.ElementType;
  key: string;
  title: string;
  desc: string;
  value: string;
  valueClass: string;
  toggle?: boolean;
};

const SECURITY_OPTIONS: SecurityOption[] = [
  {
    icon: Bell,
    key: "loginAlerts",
    title: "Login Alerts",
    desc: "Get notified when someone logs in to your account.",
    value: "Enabled",
    valueClass: "text-status-ok-ink",
    toggle: true,
  },
  {
    icon: MailCheck,
    key: "emailVerification",
    title: "Email Verification",
    desc: "Verify your email address to ensure account security.",
    value: "Verified",
    valueClass: "text-status-ok-ink",
  },
  {
    icon: Monitor,
    key: "trustedDevices",
    title: "Trusted Devices",
    desc: "Manage devices that can access your account.",
    value: "3 Devices",
    valueClass: "text-violet-ink",
  },
  {
    icon: KeyRound,
    key: "accountRecovery",
    title: "Account Recovery",
    desc: "Set up recovery options to restore access to your account.",
    value: "Configured",
    valueClass: "text-status-ok-ink",
  },
  {
    icon: Trash2,
    key: "deleteAccount",
    title: "Delete Account",
    desc: "Permanently delete your account and all data.",
    value: "Delete",
    valueClass: "text-status-danger-ink",
  },
];

const CHECKLIST = [
  "Password is strong",
  "Two-factor authentication is enabled",
  "No suspicious login activity",
  "All security settings are up to date",
];

type Session = {
  icon: React.ElementType;
  device: string;
  current: boolean;
  location: string;
  ip: string;
  date: string;
  time: string;
};

const INITIAL_SESSIONS: Session[] = [
  {
    icon: Globe,
    device: "Chrome on Windows",
    current: true,
    location: "Mumbai, India",
    ip: "103.21.244.18",
    date: "May 20, 2024",
    time: "10:15 AM",
  },
  {
    icon: Smartphone,
    device: "Safari on iPhone",
    current: false,
    location: "Mumbai, India",
    ip: "103.21.244.18",
    date: "May 19, 2024",
    time: "08:45 PM",
  },
];

type LoginEntry = { date: string; city: string; ip: string };

const LOGIN_HISTORY: LoginEntry[] = [
  { date: "May 20, 2024 10:15 AM", city: "Mumbai, India", ip: "103.21.244.18" },
  { date: "May 19, 2024 08:45 PM", city: "Mumbai, India", ip: "103.21.244.18" },
  { date: "May 19, 2024 09:10 AM", city: "Pune, India", ip: "103.21.244.18" },
  { date: "May 18, 2024 07:30 PM", city: "Mumbai, India", ip: "103.21.244.18" },
  { date: "May 18, 2024 09:05 AM", city: "Mumbai, India", ip: "103.21.244.18" },
];

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score += 40;
  if (pw.length >= 12) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  return Math.min(score, 100);
}

function ControlledPasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  // The label rendered correctly but pointed at nothing, so all three password
  // boxes announced as "edit text, blank" — on the one form where knowing which
  // field you are in matters most, since you cannot read back what you typed.
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line-strong py-2.5 pl-3 pr-10 text-sm tracking-widest text-ink-muted outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
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

export default function SecuritySettingsPage() {
  const toast = useToast();
  // Change password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  const strength = scorePassword(newPw);
  const strengthColor = strength >= 70 ? "var(--status-ok-solid)" : strength >= 40 ? "var(--status-warn-solid)" : "var(--status-danger-solid)";
  const strengthLabel =
    strength >= 70 ? "Strong password" : strength >= 40 ? "Medium strength" : "Weak password";
  const strengthTextClass =
    strength >= 70 ? "text-status-ok-ink" : strength >= 40 ? "text-status-warn-ink" : "text-status-danger-ink";

  async function handleUpdatePassword() {
    if (!currentPw || !newPw || !confirmPw) {
      setPwError("All password fields are required.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwError("");
    try {
      // The server re-checks the current password and the length rule; the
      // checks above are only there to save a round trip.
      await apiStaffChangePassword(currentPw, newPw);
      toast.success("Password changed");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwError(memberError(err));
    }
  }

  // Two-factor authentication
  const [twoFactor, setTwoFactor] = useState(true);
  const [manage2faOpen, setManage2faOpen] = useState(false);

  // Security options toggles / modals
  const [optionState, setOptionState] = useState<Record<string, boolean>>({
    loginAlerts: true,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  function revokeSession(device: string) {
    setSessions((prev) => prev.filter((s) => s.device !== device));
  }

  function logoutAllOthers() {
    setSessions((prev) => prev.filter((s) => s.current));
    setLogoutAllOpen(false);
  }

  // Login history export
  function exportLoginHistory() {
    const header = "Date,Location,IP Address";
    const rows = LOGIN_HISTORY.map((l) => `"${l.date}","${l.city}","${l.ip}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "login-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Security Settings
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Manage your password, two-factor authentication and account security.
          </p>
        </div>
      </div>

      <ResizableColumns id="settings-security" defaultSize={0.73} className="gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Change Password */}
          <Card>
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink">Change Password</h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Update your password regularly to keep your account secure.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div>
                <ControlledPasswordField
                  label="Current Password"
                  value={currentPw}
                  onChange={setCurrentPw}
                />
              </div>
              <div>
                <ControlledPasswordField
                  label="New Password"
                  value={newPw}
                  onChange={setNewPw}
                />
                {newPw ? (
                  <div className="mt-2">
                    <ProgressBar value={strength} color={strengthColor} />
                    <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${strengthTextClass}`}>
                      <Check className="h-3.5 w-3.5" /> {strengthLabel}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <ProgressBar value={85} color="var(--status-ok-solid)" />
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-status-ok-ink">
                      <Check className="h-3.5 w-3.5" /> Strong password
                    </p>
                  </div>
                )}
              </div>
              <div>
                <ControlledPasswordField
                  label="Confirm New Password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              {pwError && <span className="text-sm font-medium text-status-danger-ink">{pwError}</span>}
              <button className="btn btn-primary" onClick={handleUpdatePassword}>
                Update Password
              </button>
            </div>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">
                    Two-Factor Authentication (2FA)
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-subtle">
                    Add an extra layer of security to your account.
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary shrink-0" onClick={() => setManage2faOpen(true)}>
                Manage 2FA
              </button>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm font-medium text-ink-muted">Status</span>
              {twoFactor ? (
                <Badge tone="emerald">Enabled</Badge>
              ) : (
                <Badge tone="rose">Disabled</Badge>
              )}
            </div>
            <p className="mt-4 text-sm text-ink-subtle">
              {twoFactor
                ? "Your account is protected with Two-Factor Authentication."
                : "Two-Factor Authentication is currently turned off."}
            </p>
          </Card>

          {/* Security Options */}
          <Card>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink">Security Options</h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Additional security features to protect your account.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {SECURITY_OPTIONS.map((o) => {
                const isDelete = o.key === "deleteAccount";
                const toggled = o.toggle ? optionState[o.key] : undefined;
                const displayValue =
                  o.toggle && toggled === false ? "Disabled" : o.value;
                const displayClass =
                  o.toggle && toggled === false ? "text-ink-subtle" : o.valueClass;
                return (
                  <li key={o.title} className="flex items-center gap-3 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                      <o.icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{o.title}</p>
                      <p className="text-xs text-ink-subtle">{o.desc}</p>
                    </div>
                    {o.toggle ? (
                      <>
                        <span className={`text-sm font-semibold ${displayClass}`}>
                          {displayValue}
                        </span>
                        <button aria-label={o.title}
                          type="button"
                          role="switch"
                          aria-checked={!!toggled}
                          onClick={() =>
                            setOptionState((prev) => ({ ...prev, [o.key]: !prev[o.key] }))
                          }
                          className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                            toggled ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                              toggled ? "translate-x-4" : ""
                            }`}
                          />
                        </button>
                      </>
                    ) : isDelete ? (
                      <button
                        type="button"
                        onClick={() => setDeleteOpen(true)}
                        className={`text-sm font-semibold ${o.valueClass} hover:underline`}
                      >
                        {o.value}
                      </button>
                    ) : (
                      <span className={`text-sm font-semibold ${o.valueClass}`}>{o.value}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Security Status */}
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-ink">Security Status</h2>
            <div className="mb-4 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-status-ok-bg text-status-ok-ink">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-status-ok-ink">
                  Your account is secure
                </p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  Last security check: May 20, 2024 10:15 AM
                </p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex items-center gap-2.5 text-sm text-ink-muted">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-status-ok-solid text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </Card>

          {/* Active Sessions */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">
                Active Sessions ({sessions.length})
              </h2>
              <Link
                href="/dashboard/settings/sessions"
                className="text-xs font-semibold text-violet-ink transition hover:underline"
              >
                View All
              </Link>
            </div>
            {sessions.length === 0 ? (
              <NoResults icon={Monitor} thing="active sessions" compact
                description="Sessions appear here when you sign in on a device." />
            ) : (
              <ul className="space-y-4">
                {sessions.map((s) => (
                  <li key={s.device} className="flex gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                      <s.icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{s.device}</p>
                        {s.current && <Badge tone="violet">Current Session</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-subtle">{s.location}</p>
                      <p className="text-xs text-ink-subtle">{s.ip}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right text-xs text-ink-subtle">
                        <p>{s.date}</p>
                        <p className="text-ink-subtle">{s.time}</p>
                      </div>
                      {!s.current && (
                        <Menu
                          align="right"
                          width="min-w-[11rem]"
                          trigger={
                            <button
                              type="button"
                              aria-label={`Actions for ${s.device}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-hover hover:text-ink-muted"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          }
                        >
                          <MenuItem icon={LogOut} danger onClick={() => revokeSession(s.device)}>
                            Revoke Session
                          </MenuItem>
                        </Menu>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn btn-danger btn-block mt-4"
              onClick={() => setLogoutAllOpen(true)}
            >
              <LogOut className="h-4 w-4" /> Logout All Sessions
            </button>
          </Card>

          {/* Login History */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Login History</h2>
              <button
                className="text-xs font-semibold text-violet-ink transition hover:underline"
                onClick={exportLoginHistory}
              >
                View All
              </button>
            </div>
            <ul className="space-y-3.5">
              {LOGIN_HISTORY.map((l, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-status-ok-solid" />
                  <span className="w-36 shrink-0 font-medium text-ink-muted">{l.date}</span>
                  <span className="flex-1 text-ink-subtle">{l.city}</span>
                  <span className="text-ink-subtle">{l.ip}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={exportLoginHistory}
              className="mt-4 flex w-full items-center justify-center gap-1.5 border-t border-line pt-4 text-center text-sm font-semibold text-violet-ink hover:text-violet-ink"
            >
              <Download className="h-4 w-4" /> View Full Login History
            </button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Manage 2FA Modal */}
      <Modal
        open={manage2faOpen}
        onClose={() => setManage2faOpen(false)}
        title="Manage Two-Factor Authentication"
        description="Control the extra layer of security on your account."
        icon={ShieldCheck}
        iconTone="emerald"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setManage2faOpen(false)}>
              Close
            </button>
            <button className="btn btn-primary" onClick={() => setManage2faOpen(false)}>
              Done
            </button>
          </>
        }
      >
        <Switch
          label="Two-Factor Authentication"
          description="Require a verification code at sign-in."
          checked={twoFactor}
          onChange={setTwoFactor}
        />
        <p className="mt-4 text-sm text-ink-subtle">
          {twoFactor
            ? "2FA is enabled. You will be asked for a code from your authenticator app when signing in."
            : "2FA is disabled. We strongly recommend enabling it to protect your account."}
        </p>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Account"
        description="This action is permanent and cannot be undone."
        icon={Trash2}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                toast.success("Account deleted");
                setDeleteOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete Account
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Deleting your account will permanently remove all your data, orders, and settings. This
          cannot be reversed.
        </p>
      </Modal>

      {/* Logout All Sessions Modal */}
      <Modal
        open={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        title="Logout All Sessions"
        description="Sign out from every device except this one."
        icon={LogOut}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setLogoutAllOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={logoutAllOthers}>
              <LogOut className="h-4 w-4" /> Logout All
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          This will revoke all other active sessions. You will remain signed in on this device.
        </p>
      </Modal>

      {/* Account deletion confirmation toast */}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Crown,
  ShieldCheck,
  UserCog,
  Users,
  FileText,
  Headset,
  Info,
  CheckCircle2,
  MinusCircle,
  XCircle,
  LayoutDashboard,
  UserCheck,
  CalendarClock,
  Briefcase,
  FileEdit,
  BarChart3,
  Settings,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Card, Modal, useToast } from "@/design-system";
type Access = "F" | "L" | "N";
type Tone = "brand" | "violet" | "emerald" | "amber" | "sky" | "rose";

type Role = {
  key: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  ring: string;
  tone: Tone;
};

const SUPER_ADMIN: Role = {
  key: "super-admin",
  name: "Super Admin",
  icon: ShieldCheck,
  desc: "Full platform access with all permissions and capabilities.",
  ring: "bg-violet-tint text-violet-ink",
  tone: "violet",
};

const ROLES: Role[] = [
  { key: "admin", name: "Admin", icon: UserCog, desc: "Manage users, content and daily operations.", ring: "bg-violet-tint text-violet-ink", tone: "violet" },
  { key: "supervisor", name: "Supervisor", icon: Users, desc: "Oversee teams, appointments and reports.", ring: "bg-status-ok-bg text-status-ok-ink", tone: "emerald" },
  { key: "content", name: "Content Manager", icon: FileText, desc: "Manage content, programs and resources.", ring: "bg-status-warn-bg text-status-warn-ink", tone: "amber" },
  { key: "support", name: "Support Agent", icon: Headset, desc: "Handle customer queries and provide support.", ring: "bg-status-danger-bg text-status-danger-ink", tone: "rose" },
];

const COLUMNS: { name: string; icon: LucideIcon; ring: string }[] = [
  { name: "Super Admin", icon: Crown, ring: "bg-violet-tint text-violet-ink" },
  { name: "Admin", icon: UserCog, ring: "bg-violet-tint text-violet-ink" },
  { name: "Supervisor", icon: Users, ring: "bg-status-ok-bg text-status-ok-ink" },
  { name: "Content Manager", icon: FileText, ring: "bg-status-warn-bg text-status-warn-ink" },
  { name: "Support Agent", icon: Headset, ring: "bg-status-danger-bg text-status-danger-ink" },
];

const MATRIX: { module: string; icon: LucideIcon; cells: Access[] }[] = [
  { module: "Dashboard & Analytics", icon: LayoutDashboard, cells: ["F", "F", "L", "L", "L"] },
  { module: "User Management", icon: UserCheck, cells: ["F", "F", "L", "N", "N"] },
  { module: "Appointments Management", icon: CalendarClock, cells: ["F", "F", "F", "L", "L"] },
  { module: "Programs & Services", icon: Briefcase, cells: ["F", "F", "F", "F", "L"] },
  { module: "Content Management", icon: FileEdit, cells: ["F", "F", "L", "F", "N"] },
  { module: "Reports & Export", icon: BarChart3, cells: ["F", "F", "L", "L", "N"] },
  { module: "Settings & Configuration", icon: Settings, cells: ["F", "F", "L", "N", "N"] },
  { module: "Billing & Subscription", icon: CreditCard, cells: ["F", "F", "N", "N", "N"] },
  { module: "Support & Messages", icon: MessageSquare, cells: ["F", "F", "L", "L", "F"] },
];

function AccessCell({ access }: { access: Access }) {
  if (access === "F") return <CheckCircle2 className="mx-auto h-5 w-5 text-status-ok-ink" />;
  if (access === "L") return <MinusCircle className="mx-auto h-5 w-5 text-violet-ink" />;
  return <XCircle className="mx-auto h-5 w-5 text-status-danger-ink" />;
}

export default function SwitchRolePage() {
  const toast = useToast();
  const [currentRole, setCurrentRole] = useState<Role>(SUPER_ADMIN);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const CurrentIcon = currentRole.icon;

  const confirmSwitch = () => {
    if (!pendingRole) return;
    const name = pendingRole.name;
    setCurrentRole(pendingRole);
    setPendingRole(null);
    toast.success(`Switched to ${name}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Switch Role</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Switch between different roles to view the platform from various perspectives.
          </p>
        </div>
      </div>

      {/* Current Role + Available Roles */}
      <Card>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* Current Role */}
          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Current Role</h2>
            <div className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-white p-6 text-center dark:from-[var(--surface-hover)] dark:to-[var(--surface-inset)]">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-200">
                <CurrentIcon className="h-8 w-8" />
              </span>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="font-display text-lg font-bold text-ink">{currentRole.name}</span>
                <Badge tone="violet">Current</Badge>
              </div>
              <p className="mx-auto mt-2 max-w-[15rem] text-sm text-ink-subtle">
                {currentRole.desc}
              </p>
            </div>
          </div>

          {/* Available Roles */}
          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Available Roles</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {ROLES.map((r) => {
                const isActive = currentRole.key === r.key;
                return (
                  <div
                    key={r.key}
                    className={`flex flex-col items-center rounded-2xl border p-5 text-center transition ${
                      isActive
                        ? "border-violet-300 bg-violet-tint/60 ring-1 ring-violet-200 dark:bg-white/5"
                        : "border-line-strong/70"
                    }`}
                  >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full ${r.ring}`}>
                      <r.icon className="h-7 w-7" />
                    </span>
                    <p className="mt-3 font-display text-sm font-bold text-ink">{r.name}</p>
                    <p className="mt-1.5 flex-1 text-xs text-ink-subtle">{r.desc}</p>
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => setPendingRole(r)}
                      className={`btn btn-block mt-4 ${isActive ? "btn-outline cursor-default" : "btn-secondary"}`}
                    >
                      {isActive ? "Active Role" : "Switch to Role"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-violet-tint px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-ink" />
          <p className="text-sm text-ink-muted">
            Switching roles allows you to experience the platform from different perspectives. Your data and settings
            remain unchanged.
          </p>
        </div>
      </Card>

      {/* Role Permissions Overview */}
      <Card className="mt-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Role Permissions Overview</h2>
            <p className="mt-1 text-sm text-ink-subtle">Compare permissions across different roles.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-ink-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-status-ok-ink" /> Full Access
            </span>
            <span className="flex items-center gap-1.5">
              <MinusCircle className="h-4 w-4 text-violet-ink" /> Limited Access
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-status-danger-ink" /> No Access
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-3 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Module / Feature
                </th>
                {COLUMNS.map((c) => (
                  <th scope="col" key={c.name} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${c.ring}`}>
                        <c.icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold text-ink-muted">{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MATRIX.map((row) => (
                <tr key={row.module} className="text-sm hover:bg-surface-hover/60">
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2.5 font-medium text-ink-muted">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <row.icon className="h-4 w-4" />
                      </span>
                      {row.module}
                    </span>
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      <AccessCell access={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom banner */}
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-violet-tint px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-ink" />
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-violet-ink">Secure Role Switching</span> &mdash; All actions are logged
            and monitored. Switch back anytime using the role selector in the top-right corner.
          </p>
        </div>
      </Card>

      {/* Confirm switch modal */}
      <Modal
        open={pendingRole !== null}
        onClose={() => setPendingRole(null)}
        title="Switch Role"
        description="Confirm switching to a different role."
        icon={pendingRole?.icon ?? ShieldCheck}
        iconTone={pendingRole?.tone ?? "violet"}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPendingRole(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmSwitch}>
              Switch Role
            </button>
          </>
        }
      >
        {pendingRole && (
          <div className="text-sm text-ink-muted">
            <div className="flex items-center gap-3 rounded-2xl border border-line-strong/70 p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${pendingRole.ring}`}>
                <pendingRole.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-ink">{pendingRole.name}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{pendingRole.desc}</p>
              </div>
            </div>
            <p className="mt-4">
              You are about to switch from <span className="font-semibold text-ink">{currentRole.name}</span> to{" "}
              <span className="font-semibold text-ink">{pendingRole.name}</span>. Your data and settings remain
              unchanged, and you can switch back anytime.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

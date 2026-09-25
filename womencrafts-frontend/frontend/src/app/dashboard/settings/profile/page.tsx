"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCircle, Pencil, Camera, Mail, Phone, CheckCircle2, Settings, ShieldCheck, Bell, History, MonitorSmartphone, ChevronRight, LogIn, Settings2, UserPlus, FileSearch, Activity, ListChecks, Users, FileText, BarChart3, Monitor, Smartphone, Lock, UploadCloud, Trash2 } from "lucide-react";
import { Avatar, Badge, Card, Input, Modal, Select, Switch, Textarea, ThemeSelect, useToast, Alert } from "@/design-system";
import Link from "next/link";
import { apiStaffProfile } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

const QUICK_LINKS: { icon: React.ElementType; label: string; href: string }[] = [
  { icon: Settings, label: "Account Settings", href: "/dashboard/settings" },
  { icon: ShieldCheck, label: "Security Settings", href: "/dashboard/settings/security" },
  { icon: Bell, label: "Notification Preferences", href: "/dashboard/settings/notifications" },
  { icon: History, label: "Activity Log", href: "/dashboard/settings/activity" },
  { icon: MonitorSmartphone, label: "Sessions", href: "/dashboard/settings/sessions" },
];

const TABS = [
  "Overview",
  "Profile Information",
  "Security",
  "Preferences",
  "Sessions",
  "Activity Log",
];

const SUMMARY = [
  { icon: LogIn, tone: "violet", label: "Logins (This Month)", value: "28" },
  { icon: Activity, tone: "brand", label: "Actions Performed", value: "142" },
  { icon: Users, tone: "amber", label: "Users Managed", value: "1,248" },
  { icon: FileText, tone: "emerald", label: "Content Published", value: "32" },
  { icon: BarChart3, tone: "sky", label: "Reports Generated", value: "18" },
];

const ACTIVITY = [
  { icon: LogIn, tone: "sky", title: "Logged in to the system", when: "May 20, 2024 10:15 AM", ip: "103.21.244.18" },
  { icon: Settings2, tone: "violet", title: "Updated system settings", when: "May 19, 2024 06:45 PM", ip: "103.21.244.18" },
  { icon: UserPlus, tone: "brand", title: "Created new admin user", when: "May 18, 2024 02:30 PM", ip: "103.21.244.18" },
  { icon: FileSearch, tone: "amber", title: "Reviewed user report", when: "May 17, 2024 11:20 AM", ip: "103.21.244.18" },
  { icon: LogIn, tone: "emerald", title: "Logged in to the system", when: "May 17, 2024 09:05 AM", ip: "103.21.244.18" },
];

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-ink-subtle">{label}</span>
      <span className="text-ink-subtle">:</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

type Profile = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  userId: string;
  username: string;
  joinedOn: string;
  lastLogin: string;
  ipAddress: string;
  location: string;
  department: string;
  designation: string;
  experience: string;
  languages: string;
  timeZone: string;
};

type SessionRow = {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  title: string;
  badge?: string;
  meta: string;
  ip: string;
  when: string;
  removable: boolean;
};

const INITIAL_PROFILE: Profile = {
  name: "Admin User",
  email: "admin@womsakhi.com",
  phone: "+91 98765 43210",
  bio: "I am the top administrator of the WomSakhi platform. I manage all the operations, users, and system settings to ensure everything runs smoothly.",
  userId: "AD-0001",
  username: "adminuser",
  joinedOn: "Jan 10, 2023 10:30 AM",
  lastLogin: "May 20, 2024 10:15 AM",
  ipAddress: "103.21.244.18",
  location: "Mumbai, Maharashtra, India",
  department: "Administration",
  designation: "Super Administrator",
  experience: "6+ Years",
  languages: "English, Hindi, Marathi",
  timeZone: "(GMT+05:30) Asia/Kolkata",
};

const TIME_ZONES = [
  "(GMT+05:30) Asia/Kolkata",
  "(GMT+00:00) UTC",
  "(GMT-05:00) America/New_York",
  "(GMT-08:00) America/Los_Angeles",
  "(GMT+01:00) Europe/London",
  "(GMT+04:00) Asia/Dubai",
  "(GMT+08:00) Asia/Singapore",
];

export default function ProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile>(INITIAL_PROFILE);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  // Fill the screen from the signed-in account rather than a fixed object.
  const loadProfile = useCallback(async () => {
    try {
      const p = await apiStaffProfile();
      setProfile((cur) => ({
        ...cur,
        name: p.full_name || cur.name,
        email: p.email || cur.email,
        phone: p.phone || cur.phone,
      }));
      if (p.avatar) setAvatarSrc(p.avatar);
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const [activeTab, setActiveTab] = useState(0);

  // Edit-profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Profile>(INITIAL_PROFILE);

  // Change-photo modal
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  // Change-password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  // Sessions
  const [sessions, setSessions] = useState<SessionRow[]>([
    {
      id: "s1",
      icon: Monitor,
      iconBg: "bg-violet-tint text-violet-ink",
      title: "Current Session",
      badge: "This Device",
      meta: "Chrome on Windows • Mumbai, India",
      ip: "103.21.244.18",
      when: "May 20, 2024 10:15 AM",
      removable: false,
    },
    {
      id: "s2",
      icon: Smartphone,
      iconBg: "bg-surface-inset text-ink-subtle",
      title: "Mobile Session",
      meta: "Safari on iPhone • Mumbai, India",
      ip: "103.21.244.18",
      when: "May 19, 2024 08:45 PM",
      removable: true,
    },
  ]);

  // Security + preferences (tab-driven)
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [prefs, setPrefs] = useState({ email: true, sms: false, updates: true, digest: true });

  const infoLeft = [
    { label: "User ID", value: profile.userId },
    { label: "Username", value: profile.username },
    { label: "Joined On", value: profile.joinedOn },
    { label: "Last Login", value: profile.lastLogin },
    { label: "IP Address", value: profile.ipAddress },
    { label: "Location", value: profile.location },
  ];

  const aboutInfo = [
    { label: "Department", value: profile.department },
    { label: "Designation", value: profile.designation },
    { label: "Experience", value: profile.experience },
    { label: "Languages", value: profile.languages },
    { label: "Time Zone", value: profile.timeZone },
  ];

  function openEdit() {
    setDraft(profile);
    setEditOpen(true);
  }

  function saveEdit() {
    if (!draft.name.trim() || !draft.email.trim()) return;
    setProfile(draft);
    setEditOpen(false);
    toast.success("Profile saved");
  }

  function savePhoto() {
    if (!photoUrl.trim()) return;
    setAvatarSrc(photoUrl.trim());
    setPhotoOpen(false);
    setPhotoUrl("");
    toast.success("Profile saved");
  }

  function removePhoto() {
    setAvatarSrc(null);
    setPhotoOpen(false);
    setPhotoUrl("");
  }

  function savePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      setPwError("All fields are required.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwError("");
    setPwOpen(false);
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    toast.success("Password changed");
  }

  function logoutSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      {/*
        A failed LOAD is a state, not an event: the data is still missing after
        a toast would have faded. This message was being assigned to a variable
        that no JSX ever read, so the screen simply rendered empty fields and
        said nothing — indistinguishable from settings that have never been
        filled in.
      */}
      {loadError && (
        <Alert variant="danger" className="mb-4">
          {loadError}
        </Alert>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <UserCircle className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">My Profile</h1>
            <p className="mt-1 text-sm text-ink-subtle">View and manage your personal information and preferences.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit Profile
          </button>
        </div>
      </div>

      {/* Profile header card */}
      <Card>
        <ResizableColumns id="settings-profile" defaultSize={0.75} className="gap-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Avatar column */}
            <div className="flex shrink-0 flex-col items-center gap-3">
              <Avatar name={profile.name} src={avatarSrc} size="xl" className="!h-28 !w-28 !text-3xl" ring />
              <button className="btn btn-secondary btn-sm" onClick={() => setPhotoOpen(true)}>
                <Camera className="h-3.5 w-3.5" /> Change Photo
              </button>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-bold text-ink">{profile.name}</h2>
                <Badge tone="violet">Super Admin</Badge>
                <Badge tone="emerald">Active</Badge>
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Mail className="h-4 w-4 text-ink-subtle" /> {profile.email}
                </p>
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Phone className="h-4 w-4 text-ink-subtle" /> {profile.phone}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
                <div className="space-y-2.5">
                  {infoLeft.map((i) => (
                    <InfoRow key={i.label} label={i.label} value={i.value} />
                  ))}
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Email Verified</span>
                    <CheckCircle2 className="h-4 w-4 text-status-ok-ink" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Phone Verified</span>
                    <CheckCircle2 className="h-4 w-4 text-status-ok-ink" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Two-Factor Auth</span>
                    <CheckCircle2 className="h-4 w-4 text-status-ok-ink" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Status</span>
                    <Badge tone="emerald">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">User Type</span>
                    <span className="font-medium text-ink">Top Admin</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-subtle">Role</span>
                    <span className="font-medium text-ink">Super Admin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-xl border border-line p-4">
            <h3 className="mb-3 font-display text-base font-semibold text-ink">Quick Links</h3>
            <ul className="space-y-1">
              {QUICK_LINKS.map((q) => (
                <li key={q.label}>
                  <Link
                    href={q.href}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                      <q.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-ink-muted">{q.label}</span>
                    <ChevronRight className="h-4 w-4 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </ResizableColumns>
      </Card>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-6 border-b border-line-strong">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${
              i === activeTab
                ? "border-brand-600 text-brand-ink"
                : "border-transparent text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab content (switches with the active tab) ── */}

      {/* Overview */}
      {activeTab === 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">About Me</h2>
            <p className="text-sm leading-relaxed text-ink-subtle">{profile.bio}</p>
            <div className="mt-4 space-y-2.5 border-t border-line pt-4">
              {aboutInfo.map((i) => (
                <InfoRow key={i.label} label={i.label} value={i.value} />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Account Summary</h2>
            <ul className="space-y-4">
              {SUMMARY.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[s.tone]}`}>
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="flex-1 text-sm text-ink-muted">{s.label}</span>
                  <span className="font-display text-base font-bold text-ink">{s.value}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recent Activity</h2>
              <button onClick={() => setActiveTab(5)} className="text-xs font-semibold text-brand-ink hover:underline">
                View All
              </button>
            </div>
            <ul className="space-y-4">
              {ACTIVITY.slice(0, 4).map((a, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone]}`}>
                    <a.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-muted">{a.title}</p>
                    <p className="text-xs text-ink-subtle">{a.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Profile Information */}
      {activeTab === 1 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Personal Information</h2>
              <button className="btn btn-sm btn-secondary" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ["Full Name", profile.name],
                ["Username", profile.username],
                ["Email", profile.email],
                ["Phone", profile.phone],
                ["User ID", profile.userId],
                ["Location", profile.location],
                ["Department", profile.department],
                ["Designation", profile.designation],
                ["Experience", profile.experience],
                ["Languages", profile.languages],
                ["Time Zone", profile.timeZone],
                ["Joined On", profile.joinedOn],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-ink-subtle">{k}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">About Me</h2>
            <p className="text-sm leading-relaxed text-ink-subtle">{profile.bio}</p>
            <div className="mt-4 space-y-2.5 border-t border-line pt-4">
              {aboutInfo.map((i) => (
                <InfoRow key={i.label} label={i.label} value={i.value} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Security */}
      {activeTab === 2 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Security</h2>
            <div className="space-y-3">
              <Switch
                label="Two-Factor Authentication"
                description="Require a verification code when signing in."
                checked={twoFactor}
                onChange={setTwoFactor}
              />
              <Switch
                label="Login Alerts"
                description="Email me whenever a new device signs in."
                checked={loginAlerts}
                onChange={setLoginAlerts}
              />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
              {[
                ["Email Verified", true],
                ["Phone Verified", true],
                ["Two-Factor Auth", twoFactor],
                ["Last Login", null],
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between gap-2">
                  <span className="text-ink-subtle">{label}</span>
                  {label === "Last Login" ? (
                    <span className="font-medium text-ink">{profile.lastLogin}</span>
                  ) : ok ? (
                    <Badge tone="emerald">Enabled</Badge>
                  ) : (
                    <Badge tone="rose">Disabled</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Change Password</h2>
            <p className="text-sm leading-relaxed text-ink-subtle">
              For your account security, we recommend changing your password regularly.
            </p>
            <button className="btn btn-secondary btn-block mt-4" onClick={() => setPwOpen(true)}>
              <Lock className="h-4 w-4" /> Change Password
            </button>
          </Card>
        </div>
      )}

      {/* Preferences */}
      {activeTab === 3 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Notification Preferences</h2>
            <div className="space-y-3">
              <Switch label="Email Notifications" description="Receive updates and alerts by email." checked={prefs.email} onChange={(v) => setPrefs({ ...prefs, email: v })} />
              <Switch label="SMS Notifications" description="Receive important alerts by SMS." checked={prefs.sms} onChange={(v) => setPrefs({ ...prefs, sms: v })} />
              <Switch label="Product Updates" description="News about new features and releases." checked={prefs.updates} onChange={(v) => setPrefs({ ...prefs, updates: v })} />
              <Switch label="Weekly Digest" description="A summary of platform activity every week." checked={prefs.digest} onChange={(v) => setPrefs({ ...prefs, digest: v })} />
            </div>
            <Link href="/dashboard/settings/notifications" className="btn btn-outline btn-block mt-4">
              <Bell className="h-4 w-4" /> Manage all notifications
            </Link>
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">Appearance</h2>
            <p className="mb-3 text-xs text-ink-subtle">Choose how WomSakhi looks to you.</p>
            <ThemeSelect />
            <div className="mt-5 space-y-2.5 border-t border-line pt-4">
              <InfoRow label="Language" value={profile.languages.split(",")[0].trim()} />
              <InfoRow label="Time Zone" value={profile.timeZone} />
            </div>
          </Card>
        </div>
      )}

      {/* Sessions */}
      {activeTab === 4 && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Active Sessions</h2>
            <Link
              href="/dashboard/settings/sessions"
              className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover"
            >
              View All Sessions
            </Link>
          </div>
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.iconBg}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  {s.badge ? (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{s.title}</p>
                      <Badge tone="emerald">{s.badge}</Badge>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-ink">{s.title}</p>
                  )}
                  <p className="text-xs text-ink-subtle">{s.meta}</p>
                </div>
                <span className="text-sm text-ink-subtle">{s.ip}</span>
                <span className="text-sm text-ink-subtle">{s.when}</span>
                {s.removable && (
                  <button className="btn btn-danger btn-sm" onClick={() => logoutSession(s.id)}>
                    <ListChecks className="h-3.5 w-3.5" /> Logout
                  </button>
                )}
              </li>
            ))}
            {sessions.length === 1 && (
              <li className="rounded-xl border border-dashed border-line-strong p-4 text-center text-xs text-ink-subtle">
                No other active sessions.
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* Activity Log */}
      {activeTab === 5 && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Activity Log</h2>
            <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-brand-ink hover:underline">
              Full Activity Log
            </Link>
          </div>
          <ul className="space-y-4">
            {ACTIVITY.map((a, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone]}`}>
                  <a.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-muted">{a.title}</p>
                  <p className="text-xs text-ink-subtle">{a.when}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-subtle">{a.ip}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Edit Profile modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profile"
        description="Update your personal information and preferences."
        icon={Pencil}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveEdit}>
              Save Changes
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            required
            icon={UserCircle}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Username"
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          />
          <Input
            label="Email"
            required
            type="email"
            icon={Mail}
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <Input
            label="Phone"
            icon={Phone}
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
          <Input
            label="Department"
            value={draft.department}
            onChange={(e) => setDraft({ ...draft, department: e.target.value })}
          />
          <Input
            label="Designation"
            value={draft.designation}
            onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
          />
          <Input
            label="Experience"
            value={draft.experience}
            onChange={(e) => setDraft({ ...draft, experience: e.target.value })}
          />
          <Input
            label="Languages"
            value={draft.languages}
            onChange={(e) => setDraft({ ...draft, languages: e.target.value })}
          />
          <Input
            label="Location"
            className="sm:col-span-2"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
          <Select
            label="Time Zone"
            className="sm:col-span-2"
            options={TIME_ZONES}
            value={draft.timeZone}
            onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
          />
          <Textarea
            label="About Me"
            className="sm:col-span-2"
            rows={4}
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          />
        </div>
      </Modal>

      {/* Change Photo modal */}
      <Modal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        title="Change Photo"
        description="Update the profile picture shown across your account."
        icon={Camera}
        iconTone="violet"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setPhotoOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={savePhoto}>
              <UploadCloud className="h-4 w-4" /> Save Photo
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} src={photoUrl.trim() || avatarSrc} size="xl" className="!h-20 !w-20 !text-2xl" ring />
            <div className="min-w-0 flex-1 text-sm text-ink-subtle">
              Paste an image URL to preview it, then save to apply the new photo.
            </div>
          </div>
          <Input
            label="Image URL"
            icon={UploadCloud}
            placeholder="https://example.com/photo.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
          {avatarSrc && (
            <button className="btn btn-danger btn-sm" onClick={removePhoto}>
              <Trash2 className="h-3.5 w-3.5" /> Remove current photo
            </button>
          )}
        </div>
      </Modal>

      {/* Change Password modal */}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change Password"
        description="For your account security, choose a strong, unique password."
        icon={Lock}
        iconTone="amber"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setPwOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={savePassword}>
              Update Password
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            required
            type="password"
            icon={Lock}
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
          />
          <Input
            label="New Password"
            required
            type="password"
            icon={Lock}
            hint="At least 8 characters."
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
          />
          <Input
            label="Confirm New Password"
            required
            type="password"
            icon={Lock}
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
          />
          {pwError && <p className="text-sm font-medium text-status-danger-ink">{pwError}</p>}
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, CalendarDays, ChevronRight, FileText, Globe, GraduationCap, Headset, HeartHandshake,
  LifeBuoy, Mail, MonitorSmartphone, Palette, Phone, Search, ShieldCheck, Ticket, UserCircle,
  UserCog, Users, X,
} from "lucide-react";
import Link from "next/link";
import { Badge, Card, NoResults } from "@/design-system";
import { apiPlatformSettings, apiStaffTickets, type Ticket as TicketRow } from "@/lib/staff-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Help.
 *
 * There is no article database and no video library, so this screen no
 * longer claims "12 articles" and "4:12 walkthroughs" that open a modal of
 * three generic bullet points. It is a set of short, real "how do I" notes,
 * each pointing at the screen where the thing is done, plus the real ways to
 * reach a person: the support address the platform is configured with, and
 * the ticket screen — with your own open tickets shown from the server.
 */

type Guide = {
  title: string;
  group: "Your account" | "People and access" | "Day to day";
  icon: React.ElementType;
  tone: string;
  href: string;
  steps: string[];
};

const GUIDES: Guide[] = [
  { title: "Change my password", group: "Your account", icon: ShieldCheck, tone: "violet", href: "/dashboard/settings/security",
    steps: ["Open Security.", "Enter your current password and the new one twice.", "Every other session on your account is signed out; this one carries on."] },
  { title: "Sign out of every device", group: "Your account", icon: MonitorSmartphone, tone: "rose", href: "/dashboard/settings/sessions",
    steps: ["Open Sessions.", "Choose Sign out everywhere.", "Every device, including this one, is signed out on its next request."] },
  { title: "Change my name, phone or photo", group: "Your account", icon: UserCircle, tone: "brand", href: "/dashboard/settings/profile",
    steps: ["Open My profile.", "Click the photo to upload a new one, or Edit profile for name and phone.", "Your email is how you sign in, so a Super Admin changes that."] },
  { title: "Choose my colours and language", group: "Your account", icon: Palette, tone: "amber", href: "/dashboard/settings/appearance",
    steps: ["Open Appearance.", "Pick a palette — it is saved to your account.", "Light or dark is remembered on this device only."] },
  { title: "Decide what I am notified about", group: "Your account", icon: Bell, tone: "sky", href: "/dashboard/settings/notifications",
    steps: ["Open Notifications.", "Switch channels per event and save.", "Choices are stored now and applied once staff notifications are sent by channel."] },
  { title: "Invite a colleague to the dashboard", group: "People and access", icon: UserCog, tone: "violet", href: "/dashboard/staff",
    steps: ["Open Staff (Super Admin only).", "Invite someone and choose a role.", "Send her the one-time link; she sets her own password."] },
  { title: "Change what a role can do", group: "People and access", icon: ShieldCheck, tone: "emerald", href: "/dashboard/users/roles",
    steps: ["Open Roles & Permissions.", "Pick the role and tick the actions per section.", "Anyone holding the role gets the change on her next request."] },
  { title: "Admit a woman who has signed up", group: "People and access", icon: Users, tone: "brand", href: "/dashboard/applications",
    steps: ["Open Applications.", "Check her email confirmation and her document.", "Approve, or reject with a reason she will see."] },
  { title: "See what staff have changed", group: "People and access", icon: FileText, tone: "slate", href: "/dashboard/settings/activity",
    steps: ["Open My activity.", "Untick 'only mine' to see everyone.", "Every audited action names who, what, and the address it came from."] },
  { title: "Handle an appointment", group: "Day to day", icon: CalendarDays, tone: "amber", href: "/dashboard/appointments",
    steps: ["Open Appointments.", "Approve, reschedule or cancel from the row menu.", "The member is notified in-app."] },
  { title: "Run a programme", group: "Day to day", icon: GraduationCap, tone: "emerald", href: "/dashboard/programs",
    steps: ["Open Programmes.", "Create it, set it Running, and enrolments are counted from real sign-ups."] },
  { title: "Respond to a safety report", group: "Day to day", icon: HeartHandshake, tone: "rose", href: "/dashboard/safety",
    steps: ["Open Safety.", "Assign the report to yourself and record what was done.", "Helplines are curated there too."] },
];

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  slate: "bg-surface-inset text-ink-subtle",
};

const GROUPS: Guide["group"][] = ["Your account", "People and access", "Day to day"];

const TICKET_TONE: Record<string, "amber" | "sky" | "emerald" | "slate"> = {
  open: "amber", in_progress: "sky", resolved: "emerald",
};

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [contact, setContact] = useState<{ email: string; phone: string; website: string } | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    // The support address is platform configuration, which not every staff
    // role may read. If it is refused the card simply offers the ticket path.
    apiPlatformSettings()
      .then((s) => { if (alive) setContact({ email: s.support_email, phone: s.support_phone, website: s.website }); })
      .catch(() => {});
    apiStaffTickets()
      .then((t) => { if (alive) setTickets(t); })
      .catch(() => { if (alive) setTickets([]); });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => GUIDES.filter((g) => !q || `${g.title} ${g.group} ${g.steps.join(" ")}`.toLowerCase().includes(q)),
    [q],
  );
  const openTickets = (tickets ?? []).filter((t) => t.status !== "resolved");

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <LifeBuoy className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Help</h1>
          <p className="mt-1 text-sm text-ink-subtle">Short notes on how things are done here, and how to reach a person.</p>
        </div>
      </div>

      <Card className="bg-linear-to-br from-violet-50 to-brand-50">
        <div className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">What do you need to do?</h2>
          <div className="relative mt-5 w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the notes — password, invite, appointment…"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-9 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-hover hover:text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      <ResizableColumns id="settings-help" defaultSize={0.7} className="mt-6 gap-6">
        <div className="space-y-6">
          {shown.length === 0 ? (
            <Card><NoResults icon={Search} thing="notes" filtered onClear={() => setQuery("")} /></Card>
          ) : GROUPS.map((group) => {
            const items = shown.filter((g) => g.group === group);
            if (items.length === 0) return null;
            return (
              <Card key={group}>
                <h2 className="mb-3 font-display text-base font-semibold text-ink">{group}</h2>
                <ul className="divide-y divide-line">
                  {items.map((g) => (
                    <li key={g.title} className="py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[g.tone]}`}>
                          <g.icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={g.href} className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:text-brand-ink">
                            {g.title} <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" />
                          </Link>
                          <ol className="mt-1 list-inside list-decimal space-y-0.5 text-xs text-ink-subtle">
                            {g.steps.map((s) => <li key={s}>{s}</li>)}
                          </ol>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card className="bg-violet-tint">
            <div className="flex flex-col items-center py-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-violet-ink">
                <Headset className="h-6 w-6" />
              </span>
              <h2 className="mt-3 font-display text-base font-semibold text-ink">Reach a person</h2>
              <p className="mt-1 text-sm text-ink-subtle">Raise a ticket and the platform team answers on it.</p>
              <Link href="/dashboard/settings/support" className="btn btn-secondary btn-block mt-4">
                <Ticket className="h-4 w-4" /> Contact support
              </Link>
            </div>
            {contact && (contact.email || contact.phone || contact.website) && (
              <ul className="mt-4 space-y-2 border-t border-violet-100 pt-4 text-sm">
                {contact.email && (
                  <li className="flex items-center gap-2 text-ink-muted">
                    <Mail className="h-4 w-4 text-violet-ink" />
                    <a className="hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>
                  </li>
                )}
                {contact.phone && (
                  <li className="flex items-center gap-2 text-ink-muted">
                    <Phone className="h-4 w-4 text-violet-ink" />
                    <a className="hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a>
                  </li>
                )}
                {contact.website && (
                  <li className="flex items-center gap-2 text-ink-muted">
                    <Globe className="h-4 w-4 text-violet-ink" />
                    <a className="hover:underline" href={contact.website} target="_blank" rel="noreferrer">{contact.website.replace(/^https?:\/\//, "")}</a>
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Your tickets</h2>
              {tickets && <Badge tone={openTickets.length > 0 ? "amber" : "slate"}>{openTickets.length} open</Badge>}
            </div>
            {tickets === null ? (
              <p className="text-sm text-ink-subtle">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-ink-subtle">You have not raised a ticket yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {tickets.slice(0, 4).map((t) => (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{t.subject}</p>
                      <Badge tone={TICKET_TONE[t.status] ?? "slate"}>{t.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-ink-subtle">{t.reference} · {t.raised_on}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/settings/support" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-ink hover:underline">
              All tickets <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}

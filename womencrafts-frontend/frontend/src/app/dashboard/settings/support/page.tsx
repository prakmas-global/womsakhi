"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Headset,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Ticket as TicketIcon,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Input, Select, Textarea } from "@/design-system";
import {
  apiRaiseTicket,
  apiStaffTickets,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type Ticket,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Contact support.
 *
 * Every ticket gets a reference the moment it's raised, and it appears in the
 * list below straight away. Previously this form threw its contents away.
 */

const STATUS_TONE: Record<string, "amber" | "sky" | "emerald" | "slate"> = {
  open: "amber",
  in_progress: "sky",
  resolved: "emerald",
};

const PRIORITY_TONE: Record<string, "slate" | "brand" | "amber" | "rose"> = {
  Low: "slate",
  Normal: "brand",
  High: "amber",
  Urgent: "rose",
};

export default function ContactSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<string>("Normal");

  const load = useCallback(async () => {
    try {
      setTickets(await apiStaffTickets());
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setWorking(true);
    setError("");
    try {
      const t = await apiRaiseTicket({
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority,
      });
      setSent(t.reference);
      setSubject("");
      setMessage("");
      setPriority("Normal");
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  const open = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <AdminPage
      title="Contact support"
      subtitle="Tell us what's wrong and we'll come back to you. Everything you raise is tracked below."
      error={error}
      stats={[
        { label: "Your tickets", value: tickets.length },
        { label: "Still open", value: open, tone: "text-status-warn-ink" },
        {
          label: "Resolved",
          value: tickets.filter((t) => t.status === "resolved").length,
          tone: "text-status-ok-ink",
        },
        { label: "Typical reply", value: "< 1 day", tone: "text-ink-subtle" },
      ]}
    >
      <ResizableColumns id="settings-support" defaultSize={0.74} className="gap-4">
        <div className="min-w-0 space-y-4">
          <Card>
            <h2 className="font-display text-base font-bold text-ink">Raise a ticket</h2>
            <div className="mt-4 space-y-3">
              <Input
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Members aren't receiving verification emails"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="What's it about?"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={[...TICKET_CATEGORIES]}
                />
                <Select
                  label="How urgent?"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  options={[...TICKET_PRIORITIES]}
                />
              </div>
              <Textarea
                label="What's happening?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What you expected, what happened instead, and how to see it. Screenshots help — reply to the confirmation email with them."
              />
            </div>

            {sent && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-status-ok-bg px-3.5 py-3 text-sm text-status-ok-ink">
                <Check className="h-4 w-4 shrink-0" />
                <span>
                  Raised as <strong>{sent}</strong>. We&apos;ll reply by email.
                </span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={working || subject.trim().length < 3 || message.trim().length < 15}
              className="btn btn-primary mt-4"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send ticket
            </button>
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-4 py-3.5 dark:border-white/10">
              <h2 className="font-display text-base font-bold text-ink">Your tickets</h2>
            </div>
            {loading ? (
              <div className="p-4">
                <AdminLoading rows={2} />
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={TicketIcon}
                title="No tickets yet"
                description="Anything you raise will be listed here with its reference and status."
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/5">
                {tickets.map((t) => (
                  <li key={t.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{t.subject}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {t.reference} · {t.category} · {t.raised_on}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={PRIORITY_TONE[t.priority] ?? "slate"}>{t.priority}</Badge>
                        <Badge tone={STATUS_TONE[t.status] ?? "slate"}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-2.5 text-sm text-ink-muted dark:bg-white/5">
                      {t.message}
                    </p>
                    {t.replies.map((r, i) => (
                      <p
                        key={i}
                        className="mt-2 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink"
                      >
                        <span className="font-semibold">{r.by}</span> · {r.when}
                        <br />
                        {r.body}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <Headset className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Other ways to reach us</p>
                <p className="text-xs text-ink-subtle">Monday to Saturday, 9am – 7pm IST</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="mailto:support@womsakhi.com"
                  className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition hover:bg-surface-hover"
                >
                  <Mail className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <span className="min-w-0 flex-1 truncate text-ink-muted">
                    support@womsakhi.com
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+911800000000"
                  className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition hover:bg-surface-hover"
                >
                  <Phone className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <span className="text-ink-muted">1800 000 000</span>
                </a>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">Before you write</p>
                <p className="text-xs text-ink-subtle">These answer most questions</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Link
                href="/dashboard/settings/help"
                className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-muted transition hover:bg-surface-hover"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-ink-subtle" /> Help centre
              </Link>
              <Link
                href="/dashboard/settings/logs"
                className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-muted transition hover:bg-surface-hover"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-ink-subtle" /> System logs
              </Link>
            </div>
          </Card>
        </div>
      </ResizableColumns>
    </AdminPage>
  );
}

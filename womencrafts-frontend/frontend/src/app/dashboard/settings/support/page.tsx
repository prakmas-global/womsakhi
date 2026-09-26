"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Check, Headset, Inbox, LifeBuoy, Loader2, Mail, MessageSquareReply, MoreHorizontal,
  Phone, ScrollText, Search, Send, Ticket as TicketIcon,
} from "lucide-react";

import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner, StatCard, Tabs, Textarea, useToast,
} from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import {
  apiRaiseTicket, apiStaffTickets, TICKET_CATEGORIES, TICKET_PRIORITIES, type Ticket,
} from "@/lib/staff-api";
import {
  apiSupportContact, apiSupportInbox, apiSupportReply, apiSupportSetStatus, apiSupportSummary,
  type SupportContact, type TicketAdmin, type TicketPage, type TicketSummary,
} from "@/lib/settings-platform-api";
import { memberError } from "@/lib/member-api";

/**
 * Support.
 *
 * Two halves of one path. Any staff member raises a ticket and sees the
 * replies under it. Anyone who can edit Settings sees every ticket in the
 * inbox, answers it, and moves it along. The reply is stored on the ticket;
 * it is also emailed only when a real provider is configured, and the screen
 * says which of those happened.
 *
 * There is no "typical reply < 1 day" here. The median first-reply time is
 * measured from the tickets that were actually answered, and reads "no
 * replies yet" until there are some.
 */

const STATUS_TONE: Record<string, "amber" | "sky" | "emerald" | "slate"> = {
  open: "amber", in_progress: "sky", resolved: "emerald",
};
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };
const PRIORITY_TONE: Record<string, "slate" | "brand" | "amber" | "rose"> = {
  Low: "slate", Normal: "brand", High: "amber", Urgent: "rose",
};

const PAGE_SIZE = 20;
const EMPTY_PAGE: TicketPage = { items: [], total: 0, page: 1, page_size: PAGE_SIZE, pages: 0 };

function hoursLabel(h: number | null | undefined) {
  if (h === null || h === undefined) return "No replies yet";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

export default function SupportPage() {
  const toast = useToast();

  // --- mine ---------------------------------------------------------------
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [contact, setContact] = useState<SupportContact | null>(null);
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<string>("Normal");

  // --- inbox (only for those who may edit Settings) ----------------------
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"mine" | "inbox">("mine");
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [inbox, setInbox] = useState<TicketPage>(EMPTY_PAGE);
  const [inboxStatus, setInboxStatus] = useState("");
  const [inboxQ, setInboxQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [inboxPage, setInboxPage] = useState(1);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [replying, setReplying] = useState<TicketAdmin | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMine = useCallback(async () => {
    try {
      setTickets(await apiStaffTickets());
    } catch (e) {
      toast.error("Could not load your tickets", { description: memberError(e) });
    } finally {
      setLoadingMine(false);
    }
  }, [toast]);

  // One wave on mount: my tickets, the contact card, and — if the server lets
  // this account in — the inbox summary. A 403 on the summary is the answer to
  // "may I manage tickets?", so no permission is guessed client-side.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [mine, c, sm] = await Promise.all([
        apiStaffTickets().catch(() => null),
        apiSupportContact().catch(() => null),
        apiSupportSummary().catch(() => null),
      ]);
      if (!alive) return;
      if (mine) setTickets(mine);
      setContact(c);
      setSummary(sm);
      setCanManage(!!sm);
      setLoadingMine(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setInboxQ(draftQ); setInboxPage(1); }, 300);
    return () => clearTimeout(t);
  }, [draftQ]);

  // After a reply or a status change, from a click.
  const loadInbox = useCallback(async () => {
    if (!canManage) return;
    try {
      const [pg, sm] = await Promise.all([
        apiSupportInbox({ status: inboxStatus, q: inboxQ, page: inboxPage, page_size: PAGE_SIZE }),
        apiSupportSummary(),
      ]);
      setInbox(pg);
      setSummary(sm);
    } catch (e) {
      toast.error("Could not load the inbox", { description: memberError(e) });
    }
  }, [canManage, inboxStatus, inboxQ, inboxPage, toast]);

  // On a filter or page change. Inline so every setState provably follows an
  // await; a reply arriving after the filters have moved on is dropped.
  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    void (async () => {
      try {
        const [pg, sm] = await Promise.all([
          apiSupportInbox({ status: inboxStatus, q: inboxQ, page: inboxPage, page_size: PAGE_SIZE }),
          apiSupportSummary(),
        ]);
        if (!alive) return;
        setInbox(pg);
        setSummary(sm);
      } catch (e) {
        if (alive) toast.error("Could not load the inbox", { description: memberError(e) });
      } finally {
        if (alive) setLoadingInbox(false);
      }
    })();
    return () => { alive = false; };
  }, [canManage, inboxStatus, inboxQ, inboxPage, toast]);

  async function submit() {
    setWorking(true);
    try {
      const t = await apiRaiseTicket({ subject: subject.trim(), message: message.trim(), category, priority });
      setSent(t.reference);
      setSubject(""); setMessage(""); setPriority("Normal");
      await loadMine();
      if (canManage) await loadInbox();
    } catch (e) {
      toast.error("Could not raise the ticket", { description: memberError(e) });
    } finally {
      setWorking(false);
    }
  }

  async function sendReply() {
    if (!replying) return;
    setBusy(true);
    try {
      const res = await apiSupportReply(replying.id, replyBody.trim());
      toast.success(`Replied to ${res.ticket.reference}`, { description: res.email_note });
      setReplying(null);
      setReplyBody("");
      await Promise.all([loadInbox(), loadMine()]);
    } catch (e) {
      toast.error("Could not send the reply", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t: TicketAdmin, status: string) {
    try {
      await apiSupportSetStatus(t.id, status);
      toast.success(`${t.reference} is now ${STATUS_LABEL[status].toLowerCase()}`);
      await Promise.all([loadInbox(), loadMine()]);
    } catch (e) {
      toast.error("Could not change the status", { description: memberError(e) });
    }
  }

  const openMine = tickets.filter((t) => t.status !== "resolved").length;
  const resolvedMine = tickets.filter((t) => t.status === "resolved").length;
  const showingFrom = inbox.total === 0 ? 0 : (inbox.page - 1) * inbox.page_size + 1;
  const showingTo = Math.min(inbox.total, inbox.page * inbox.page_size);

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <Headset className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Support</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Raise a ticket and follow it here. {canManage ? "You can also answer everyone's tickets from the inbox." : "Whoever manages Settings answers it here."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Your tickets" value={String(tickets.length)} icon={TicketIcon} tone="brand" deltaNote="Raised by you" />
        <StatCard label="Still open" value={String(openMine)} icon={Inbox} tone="amber" deltaNote="Not yet resolved" />
        <StatCard label="Resolved" value={String(resolvedMine)} icon={Check} tone="emerald" deltaNote="Closed with an answer" />
        {canManage ? (
          <StatCard label="Median first reply" value={hoursLabel(summary?.median_first_reply_hours)} icon={MessageSquareReply}
                    tone="violet" valueClassName="text-lg"
                    deltaNote={summary ? `Measured over ${summary.replied} answered ticket${summary.replied === 1 ? "" : "s"}` : "…"} />
        ) : (
          <StatCard label="Replies reach you" value={contact?.email_delivery ? "Here and by email" : "On this screen"} icon={Mail}
                    tone="sky" valueClassName="text-lg" deltaNote={contact?.email_delivery ? "Email is configured" : "Email is not configured"} />
        )}
      </div>

      {canManage && (
        <Tabs className="mt-6" value={tab} onChange={(v) => setTab(v as "mine" | "inbox")}
              tabs={[
                { value: "mine", label: "Your tickets", count: tickets.length },
                { value: "inbox", label: "Inbox", count: summary ? summary.open + summary.in_progress : undefined },
              ]} />
      )}

      {tab === "mine" ? (
        <ResizableColumns id="settings-support" defaultSize={0.72} className="mt-6 gap-4">
          <div className="min-w-0 space-y-4">
            <Card>
              <h2 className="font-display text-base font-semibold text-ink">Raise a ticket</h2>
              <div className="mt-4 space-y-3">
                <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                       placeholder="Members aren't receiving verification emails" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="What's it about?" value={category} onChange={(e) => setCategory(e.target.value)} options={[...TICKET_CATEGORIES]} />
                  <Select label="How urgent?" value={priority} onChange={(e) => setPriority(e.target.value)} options={[...TICKET_PRIORITIES]} />
                </div>
                <Textarea label="What's happening?" value={message} onChange={(e) => setMessage(e.target.value)}
                          placeholder="What you expected, what happened instead, and how to see it." />
              </div>
              {sent && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-status-ok-bg px-3.5 py-3 text-sm text-status-ok-ink">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Raised as <strong>{sent}</strong>. {contact?.email_note ?? "The answer appears under it below."}</span>
                </div>
              )}
              <button onClick={() => void submit()} disabled={working || subject.trim().length < 3 || message.trim().length < 15}
                      className="btn btn-primary mt-4">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send ticket
              </button>
            </Card>

            <Card className="p-0">
              <div className="border-b border-line px-4 py-3.5"><h2 className="font-display text-base font-semibold text-ink">Your tickets</h2></div>
              {loadingMine ? (
                <div className="flex items-center justify-center py-12"><Spinner /></div>
              ) : tickets.length === 0 ? (
                <EmptyState icon={TicketIcon} title="No tickets yet" description="Anything you raise is listed here with its reference and status." />
              ) : (
                <ul className="divide-y divide-line">
                  {tickets.map((t) => (
                    <li key={t.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{t.subject}</p>
                          <p className="mt-0.5 text-xs text-ink-subtle">{t.reference} · {t.category} · {t.raised_on}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Badge tone={PRIORITY_TONE[t.priority] ?? "slate"}>{t.priority}</Badge>
                          <Badge tone={STATUS_TONE[t.status] ?? "slate"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-2.5 text-sm text-ink-muted">{t.message}</p>
                      {t.replies.map((r, i) => (
                        <p key={i} className="mt-2 whitespace-pre-line rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                          <span className="font-semibold">{r.by}</span> · {r.when}<br />{r.body}
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink"><Headset className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-ink">Other ways to reach the team</p>
                  <p className="text-xs text-ink-subtle">{contact?.source ?? "Set on Settings › General"}</p>
                </div>
              </div>
              {contact && (contact.email || contact.phone) ? (
                <ul className="mt-4 space-y-2">
                  {contact.email && (
                    <li><a href={`mailto:${contact.email}`} className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition hover:bg-surface-hover">
                      <Mail className="h-4 w-4 shrink-0 text-ink-subtle" /><span className="min-w-0 flex-1 truncate text-ink-muted">{contact.email}</span></a></li>
                  )}
                  {contact.phone && (
                    <li><a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition hover:bg-surface-hover">
                      <Phone className="h-4 w-4 shrink-0 text-ink-subtle" /><span className="text-ink-muted">{contact.phone}</span></a></li>
                  )}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-subtle">No contact details are set. A Super Admin can add an email and phone on Settings › General.</p>
              )}
              {contact && <p className="mt-3 text-2xs text-ink-subtle">{contact.email_note}</p>}
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><LifeBuoy className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-ink">Before you write</p>
                  <p className="text-xs text-ink-subtle">Worth a look first</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Link href="/dashboard/settings/help" className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-muted transition hover:bg-surface-hover">
                  <BookOpen className="h-4 w-4 shrink-0 text-ink-subtle" /> Help centre
                </Link>
                <Link href="/dashboard/settings/activity" className="wc-inset flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-muted transition hover:bg-surface-hover">
                  <ScrollText className="h-4 w-4 shrink-0 text-ink-subtle" /> Platform events
                </Link>
              </div>
            </Card>
          </div>
        </ResizableColumns>
      ) : (
        <Card className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Inbox</h2>
              <p className="text-xs text-ink-subtle">
                {summary ? `${summary.open} open · ${summary.in_progress} in progress · ${summary.resolved} resolved · from ${summary.raisers} ${summary.raisers === 1 ? "person" : "people"}` : "…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Search tickets…"
                       className="wc-inset w-56 rounded-xl py-2 pl-9 pr-3 text-sm text-ink placeholder-ink-subtle outline-none focus:ring-2 focus:ring-brand-500/40" />
              </div>
              {[["", "All"], ["open", "Open"], ["in_progress", "In progress"], ["resolved", "Resolved"]].map(([v, l]) => (
                <button key={v} onClick={() => { setInboxStatus(v); setInboxPage(1); }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${inboxStatus === v ? "bg-brand-600 text-white" : "wc-inset text-ink-muted"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loadingInbox && inbox.items.length === 0 ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : inbox.items.length === 0 ? (
            <EmptyState icon={Inbox} title={inboxStatus || inboxQ ? "Nothing matches" : "No tickets yet"}
                        description={inboxStatus || inboxQ ? "Clear the filter or search for something else." : "Tickets staff raise appear here for you to answer."} />
          ) : (
            <ul className="divide-y divide-line">
              {inbox.items.map((t) => (
                <li key={t.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {t.reference} · {t.category} · {t.raised_on} · <span className="font-medium text-ink-muted">{t.user_name}</span>{t.user_email ? ` (${t.user_email})` : ""}
                        {t.first_reply_hours !== null && ` · first reply in ${hoursLabel(t.first_reply_hours)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={PRIORITY_TONE[t.priority] ?? "slate"}>{t.priority}</Badge>
                      <Badge tone={STATUS_TONE[t.status] ?? "slate"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setReplying(t); setReplyBody(""); }}>
                        <MessageSquareReply className="h-3.5 w-3.5" /> Reply
                      </button>
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        {t.status !== "in_progress" && <MenuItem onClick={() => void setStatus(t, "in_progress")}>Mark in progress</MenuItem>}
                        {t.status !== "resolved" && <MenuItem onClick={() => void setStatus(t, "resolved")}>Mark resolved</MenuItem>}
                        {t.status !== "open" && <MenuItem onClick={() => void setStatus(t, "open")}>Reopen</MenuItem>}
                      </Menu>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-2.5 text-sm text-ink-muted">{t.message}</p>
                  {t.replies.map((r, i) => (
                    <p key={i} className="mt-2 whitespace-pre-line rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                      <span className="font-semibold">{r.by}</span> · {r.when}<br />{r.body}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {inbox.pages > 1 && (
            <Pagination className="mt-4" page={inbox.page} pageCount={inbox.pages} onPageChange={setInboxPage}
                        showing={`Showing ${showingFrom} to ${showingTo} of ${inbox.total}`} />
          )}
        </Card>
      )}

      <Modal open={!!replying} onClose={() => setReplying(null)} title={replying ? `Reply to ${replying.reference}` : "Reply"}
             description={replying ? `${replying.user_name} · ${replying.subject}` : undefined} icon={MessageSquareReply}
             footer={<>
               <button className="btn btn-outline" onClick={() => setReplying(null)}>Cancel</button>
               <button className="btn btn-primary" disabled={busy || replyBody.trim().length < 2} onClick={() => void sendReply()}>
                 {busy ? "Sending…" : "Send reply"}
               </button>
             </>}>
        {replying && (
          <div className="space-y-3">
            <p className="whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-2.5 text-sm text-ink-muted">{replying.message}</p>
            <Textarea label="Your reply" rows={5} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="What you found, and what happens next." />
            <p className="text-xs text-ink-subtle">
              {contact?.email_delivery
                ? `Stored on the ticket and emailed to ${replying.user_email || "her address"}.`
                : "Stored on the ticket. Email is not configured on this installation, so she sees it on this screen."}
              {replying.status === "open" && " The ticket moves to in progress."}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

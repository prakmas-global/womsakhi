"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck, CircleCheck, Clock, Inbox, Loader2, Mail, MailOpen, MessageSquare,
  MessageSquarePlus, MessagesSquare, MoreHorizontal, RotateCcw, Search, Send,
  ShieldCheck, Timer, UserRound, UserRoundCheck,
} from "lucide-react";
import {
  Avatar, Badge, Card, EmptyState, Menu, MenuItem, Modal, NoResults, Select, Spinner,
  StatCard, Textarea, useToast,
} from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  apiAssignThread, apiFindMembers, apiMarkThreadRead, apiMarkThreadUnread, apiMessageStats,
  apiReopenThread, apiReply, apiResolveThread, apiStaffOptions, apiStartThread, apiThread,
  apiThreads,
  type MemberHit, type MessageStats, type StaffOption, type ThreadCounts, type ThreadDetail,
  type ThreadFilter, type ThreadMessage, type ThreadRow,
} from "@/lib/messages-api";

/**
 * The staff inbox.
 *
 * Every member has one thread with the team. This screen lists those threads
 * — whoever has waited longest first — opens one, replies into it, hands it
 * to a colleague and closes it when it is done.
 *
 * What a reply is: a row in her thread and a notification in her app. It is
 * not an SMS, a WhatsApp or an email, and the composer says so. Every number
 * on the page is computed on the server from stored timestamps and flags:
 * "unread" is the team's read flag, "seen" is hers, the reply time is the
 * median gap between her message and the team's next one. Nothing here is
 * presence, typing, or an estimate.
 */

const FILTERS: { key: ThreadFilter; label: string; count: (c: ThreadCounts) => number }[] = [
  { key: "all", label: "All", count: (c) => c.all },
  { key: "awaiting", label: "Waiting", count: (c) => c.awaiting },
  { key: "unread", label: "Unread", count: (c) => c.unread },
  { key: "mine", label: "Mine", count: (c) => c.mine },
  { key: "unassigned", label: "Unassigned", count: (c) => c.unassigned },
  { key: "resolved", label: "Resolved", count: (c) => c.resolved },
];

const EMPTY_COUNTS: ThreadCounts = { all: 0, awaiting: 0, unread: 0, mine: 0, unassigned: 0, resolved: 0 };

function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function minutesLabel(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  const days = Math.floor(min / (24 * 60));
  return `${days}d ${Math.floor((min % (24 * 60)) / 60)}h`;
}

function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toDateString();
}

export default function MessagesPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [rows, setRows] = useState<ThreadRow[]>([]);
  const [counts, setCounts] = useState<ThreadCounts>(EMPTY_COUNTS);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  const [activeId, setActiveId] = useState("");
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignChoice, setAssignChoice] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<MemberHit | null>(null);
  const [newBody, setNewBody] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const refresh = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        apiThreads({ filter, q: debounced || undefined, page_size: 200 }),
        apiMessageStats(),
      ]);
      setRows(list.items);
      setCounts(list.counts);
      setStats(s);
    } catch (e) {
      toast.error("Could not load the inbox", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [filter, debounced, toast]);

  useEffect(() => {
    let alive = true;
    void (async () => { if (alive) await refresh(); })();
    return () => { alive = false; };
  }, [refresh]);

  // Someone is waiting on the other end — keep the list current while it is open.
  useEffect(() => {
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    apiStaffOptions().then(setStaff).catch(() => setStaff([]));
  }, []);

  const open = useCallback(async (userId: string) => {
    setActiveId(userId);
    setDetailLoading(true);
    try {
      const d = await apiThread(userId);
      setDetail(d);
      if (d.unread > 0) {
        // Opening it is reading it. The server records the read.
        setDetail(await apiMarkThreadRead(userId));
        void refresh();
      }
    } catch (e) {
      toast.error("Could not open the thread", { description: memberError(e) });
    } finally {
      setDetailLoading(false);
    }
  }, [refresh, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [detail?.messages.length, activeId]);

  const send = useCallback(async () => {
    const body = reply.trim();
    if (!body || !detail) return;
    setSending(true);
    try {
      setDetail(await apiReply(detail.user_id, body));
      setReply("");
      toast.success("Sent", { description: "Stored in her thread. She has been notified in the app." });
      void refresh();
    } catch (e) {
      toast.error("Could not send the reply", { description: memberError(e) });
    } finally {
      setSending(false);
    }
  }, [detail, reply, refresh, toast]);

  const act = useCallback(async (
    fn: () => Promise<ThreadDetail>, done: string, failed: string,
  ) => {
    setActing(true);
    try {
      setDetail(await fn());
      toast.success(done);
      void refresh();
    } catch (e) {
      toast.error(failed, { description: memberError(e) });
    } finally {
      setActing(false);
    }
  }, [refresh, toast]);

  const resolve = () => detail && act(() => apiResolveThread(detail.user_id), "Marked resolved", "Could not resolve it");
  const reopen = () => detail && act(() => apiReopenThread(detail.user_id), "Reopened", "Could not reopen it");
  const markUnread = () => detail && act(() => apiMarkThreadUnread(detail.user_id), "Back in the unread pile", "Could not mark it unread");

  const openAssign = () => {
    setAssignChoice(detail?.assigned_to?.id ?? "");
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!detail) return;
    const who = staff.find((s) => s.id === assignChoice);
    setAssignOpen(false);
    await act(
      () => apiAssignThread(detail.user_id, assignChoice || null),
      who ? `Handed to ${who.full_name}` : "Unassigned",
      "Could not change the assignment",
    );
  };

  // Member search for a new conversation.
  useEffect(() => {
    if (!newOpen) return;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        setHits(await apiFindMembers(memberQuery.trim()));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [memberQuery, newOpen]);

  const openNew = () => {
    setChosen(null);
    setMemberQuery("");
    setNewBody("");
    setNewOpen(true);
  };

  const submitNew = async () => {
    const body = newBody.trim();
    if (!chosen || !body) return;
    setStarting(true);
    try {
      const d = await apiStartThread(chosen.id, body);
      setNewOpen(false);
      setActiveId(d.user_id);
      setDetail(d);
      toast.success(chosen.has_thread ? "Sent" : "Conversation started", {
        description: "Stored in her thread. She has been notified in the app.",
      });
      void refresh();
    } catch (e) {
      toast.error("Could not send it", { description: memberError(e) });
    } finally {
      setStarting(false);
    }
  };

  const filtered = filter !== "all" || debounced !== "";

  // Date separators from the real timestamps, and the last team message she has seen.
  const thread = useMemo(() => {
    const msgs = detail?.messages ?? [];
    let lastSeen = -1;
    msgs.forEach((m, i) => { if (m.sender === "team" && m.read_by_member) lastSeen = i; });
    const out: { day: string | null; m: ThreadMessage; seen: boolean }[] = [];
    let prev = "";
    msgs.forEach((m, i) => {
      const key = dayKey(m.sent_at);
      out.push({ day: key && key !== prev ? dateOnly(m.sent_at) : null, m, seen: i === lastSeen });
      prev = key || prev;
    });
    return out;
  }, [detail]);

  const measured = stats?.replies_measured ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <MessageSquare className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Messages</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every member has one thread with the team. Read it, reply, hand it to a colleague, close it when it is done.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <MessageSquarePlus className="h-4 w-4" /> New conversation
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Open threads" value={String(stats?.open ?? 0)} icon={MessagesSquare} tone="brand"
                  deltaNote={`${stats?.threads ?? 0} threads in all`} />
        <StatCard label="Waiting for a reply" value={String(stats?.awaiting_reply ?? 0)} icon={Clock}
                  tone={(stats?.awaiting_reply ?? 0) > 0 ? "amber" : "slate"} deltaNote="Her last message is unanswered" />
        <StatCard label="Unread messages" value={String(stats?.unread_messages ?? 0)} icon={Mail} tone="violet"
                  deltaNote={`${stats?.received_this_week ?? 0} received this week`} />
        <StatCard label="Resolved" value={String(stats?.resolved ?? 0)} icon={CircleCheck} tone="emerald"
                  deltaNote={`${stats?.sent_this_week ?? 0} replies sent this week`} />
        <StatCard label="Median first reply" value={minutesLabel(stats?.median_first_reply_minutes)} icon={Timer} tone="sky"
                  deltaNote={measured > 0
                    ? `${measured} measured · ${stats?.replied_within_24h_pct ?? 0}% within 24h`
                    : "No replies measured yet"} />
      </div>

      <ResizableColumns id="messages-inbox" defaultSizes={[0.26, 0.5, 0.24]} className="mt-6 gap-6">
        {/* ── threads ─────────────────────────────────────────────────────── */}
        <Card padded={false} className="flex min-h-[640px] flex-col">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      on ? "bg-brand-600 text-white" : "bg-surface-inset text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    {f.label}
                    <span className={`rounded-full px-1.5 text-2xs ${on ? "bg-white/20" : "bg-surface text-ink-subtle"}`}>
                      {f.count(counts)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Spinner /></div>
            ) : rows.length === 0 ? (
              filtered ? (
                <NoResults icon={Inbox} thing="threads" filtered compact
                           onClear={() => { setFilter("all"); setQuery(""); }} />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="No conversations yet"
                  description="When a member writes to the team, her thread appears here. You can also start one."
                  action={<button className="btn btn-sm btn-primary" onClick={openNew}>Start a conversation</button>}
                />
              )
            ) : (
              rows.map((t) => {
                const on = t.user_id === activeId;
                return (
                  <button
                    key={t.user_id}
                    onClick={() => void open(t.user_id)}
                    className={`flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left transition ${
                      on ? "bg-brand-tint/70" : "hover:bg-surface-hover"
                    }`}
                  >
                    <Avatar name={t.full_name} src={t.avatar} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm font-semibold ${on ? "text-brand-ink" : "text-ink"}`}>
                          {t.full_name}
                        </span>
                        <span className="shrink-0 text-2xs text-ink-subtle">{ago(t.last_at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                        {t.last_sender === "team" && <span className="text-ink-faint">Team: </span>}
                        {t.last_message || "—"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {t.status === "resolved" && <Badge tone="emerald">Resolved</Badge>}
                        {t.reopened && <Badge tone="amber">Wrote again</Badge>}
                        {t.status === "open" && t.waiting_since && !t.reopened && (
                          <Badge tone="amber">Waiting {ago(t.waiting_since)}</Badge>
                        )}
                        {t.assigned_to && (
                          <span className="text-2xs text-ink-subtle">
                            {t.assigned_to.id === user?.id ? "You" : t.assigned_to.name}
                          </span>
                        )}
                      </span>
                    </span>
                    {t.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-2xs font-bold text-white">
                        {t.unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {!loading && rows.length > 0 && (
            <p className="border-t border-line px-3 py-2 text-2xs text-ink-subtle">
              {rows.length} of {counts.all} thread{counts.all === 1 ? "" : "s"} · whoever has waited longest is first
            </p>
          )}
        </Card>

        {/* ── the thread ──────────────────────────────────────────────────── */}
        <Card padded={false} className="flex min-h-[640px] flex-col">
          {!activeId ? (
            <EmptyState
              icon={MessageSquare}
              title="Pick a thread"
              description="Choose someone on the left to read what she wrote and reply."
              className="my-auto"
            />
          ) : detailLoading && !detail ? (
            <div className="flex flex-1 items-center justify-center"><Spinner /></div>
          ) : detail ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={detail.full_name} src={detail.avatar} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-ink">{detail.full_name}</p>
                    <p className="truncate text-xs text-ink-subtle">{detail.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {detail.status === "resolved"
                    ? <Badge tone="emerald">Resolved</Badge>
                    : detail.reopened
                      ? <Badge tone="amber">Wrote again</Badge>
                      : detail.waiting_since
                        ? <Badge tone="amber">Waiting {ago(detail.waiting_since)}</Badge>
                        : <Badge tone="slate">Open</Badge>}
                  <Menu align="right" trigger={
                    <span className="btn btn-sm btn-outline" aria-label="Thread actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  }>
                    <MenuItem icon={UserRoundCheck} onClick={openAssign}>
                      {detail.assigned_to ? "Reassign…" : "Assign to someone…"}
                    </MenuItem>
                    <MenuItem icon={MailOpen} onClick={() => void markUnread()}>Mark as unread</MenuItem>
                    {detail.status === "resolved"
                      ? <MenuItem icon={RotateCcw} onClick={() => void reopen()}>Reopen</MenuItem>
                      : <MenuItem icon={CircleCheck} onClick={() => void resolve()}>Mark resolved</MenuItem>}
                  </Menu>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {thread.map(({ day, m, seen }) => {
                  const fromTeam = m.sender === "team";
                  return (
                    <div key={m.id}>
                      {day && (
                        <div className="mb-3 flex justify-center">
                          <span className="rounded-full bg-surface-inset px-3 py-1 text-2xs font-medium text-ink-subtle">{day}</span>
                        </div>
                      )}
                      <div className={`flex ${fromTeam ? "justify-end" : "items-end gap-2.5"}`}>
                        {!fromTeam && <Avatar name={detail.full_name} src={detail.avatar} size="sm" />}
                        <div className="max-w-[76%]">
                          {fromTeam && (
                            <p className="mb-1 flex items-center justify-end gap-1.5 text-2xs font-semibold text-violet-ink">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {m.sender_name || "Team"}
                            </p>
                          )}
                          <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            fromTeam ? "rounded-br-md bg-violet-tint text-ink-muted" : "rounded-bl-md bg-surface-inset text-ink-muted"
                          }`}>
                            {m.body}
                          </div>
                          <p className={`mt-1 flex items-center gap-1 text-2xs text-ink-subtle ${fromTeam ? "justify-end" : ""}`}>
                            {timeOnly(m.sent_at)}
                            {seen && (
                              <span className="flex items-center gap-0.5 text-violet-ink" title="She has opened her thread since this was sent">
                                <CheckCheck className="h-3.5 w-3.5" /> Seen
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t border-line p-3">
                {detail.status === "resolved" && (
                  <p className="mb-2 rounded-lg bg-status-ok-bg px-3 py-2 text-xs text-status-ok-ink">
                    Resolved by {detail.resolved_by_name || "staff"} on {dateOnly(detail.resolved_at)}. Replying does not reopen it; use Reopen if she needs more.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    placeholder={`Reply to ${detail.full_name.split(" ")[0] || "her"}…`}
                    className="max-h-40 min-h-[3rem] flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink-muted outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                  />
                  <button onClick={() => void send()} disabled={!reply.trim() || sending} className="btn btn-primary h-11 shrink-0">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
                <p className="mt-1.5 text-2xs text-ink-subtle">
                  Stored in her thread and she is notified in the app. No SMS, WhatsApp or email is sent.
                </p>
              </div>
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="Could not open that thread" className="my-auto" />
          )}
        </Card>

        {/* ── about this thread ───────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Member</h2>
            {detail ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={detail.member.full_name} src={detail.member.avatar} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{detail.member.full_name}</p>
                    <p className="truncate text-xs text-ink-subtle">{detail.member.email}</p>
                  </div>
                </div>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">Joined</dt>
                    <dd className="text-ink-muted">{dateOnly(detail.member.joined_at) || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">Account</dt>
                    <dd>
                      <Badge tone={detail.member.is_active ? "emerald" : "rose"}>
                        {detail.member.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </dd>
                  </div>
                  {detail.member.verification_status && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-subtle">Verification</dt>
                      <dd className="text-ink-muted">{detail.member.verification_status.replace(/_/g, " ")}</dd>
                    </div>
                  )}
                </dl>
                <p className="text-2xs text-ink-faint">
                  Her private vault and in-case-of-emergency details are never shown here.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">Open a thread to see who you are talking to.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">This thread</h2>
            {detail ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-subtle">Looked after by</span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-ink-muted">
                      {detail.assigned_to
                        ? (detail.assigned_to.id === user?.id ? "You" : detail.assigned_to.name)
                        : "Nobody yet"}
                    </span>
                    <button className="btn btn-sm btn-outline" onClick={openAssign} disabled={acting}>
                      {detail.assigned_to ? "Change" : "Assign"}
                    </button>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-subtle">Status</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={detail.status === "resolved" ? "emerald" : "slate"}>
                      {detail.status === "resolved" ? "Resolved" : "Open"}
                    </Badge>
                    {detail.status === "resolved"
                      ? <button className="btn btn-sm btn-outline" onClick={() => void reopen()} disabled={acting}>Reopen</button>
                      : <button className="btn btn-sm btn-outline" onClick={() => void resolve()} disabled={acting}>Resolve</button>}
                  </span>
                </div>
                <dl className="space-y-1.5 border-t border-line pt-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">Messages</dt>
                    <dd className="text-ink-muted">{detail.message_count}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">First message</dt>
                    <dd className="text-ink-muted">{dateOnly(detail.first_at) || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">Her last message</dt>
                    <dd className="text-ink-muted">{detail.last_member_at ? ago(detail.last_member_at) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">Team&apos;s last reply</dt>
                    <dd className="text-ink-muted">{detail.last_team_at ? ago(detail.last_team_at) : "Never"}</dd>
                  </div>
                  {detail.waiting_since && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-subtle">Waiting since</dt>
                      <dd className="font-medium text-status-warn-ink">{ago(detail.waiting_since)}</dd>
                    </div>
                  )}
                  {detail.assigned_at && detail.assigned_to && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-subtle">Assigned</dt>
                      <dd className="text-ink-muted">{ago(detail.assigned_at)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">Assignment, status and timing appear here once a thread is open.</p>
            )}
          </Card>
        </div>
      </ResizableColumns>

      {/* ── assign ──────────────────────────────────────────────────────────── */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Who looks after this thread?"
        description={detail ? `${detail.full_name}'s thread with the team.` : undefined}
        icon={UserRoundCheck}
        iconTone="violet"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAssignOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void submitAssign()} disabled={acting}>
              {assignChoice ? "Assign" : "Leave unassigned"}
            </button>
          </>
        }
      >
        {staff.length === 0 ? (
          <p className="text-sm text-ink-subtle">No active staff accounts to choose from.</p>
        ) : (
          <Select
            label="Staff account"
            value={assignChoice}
            onChange={(e) => setAssignChoice(e.target.value)}
            placeholder="Nobody"
            options={[
              { value: "", label: "Nobody" },
              ...staff.map((s) => ({ value: s.id, label: `${s.full_name}${s.id === user?.id ? " (you)" : ""} · ${s.role}` })),
            ]}
          />
        )}
      </Modal>

      {/* ── new conversation ────────────────────────────────────────────────── */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New conversation"
        description="Write to a member. It lands in her thread with the team and she is notified in the app."
        icon={MessageSquarePlus}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setNewOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void submitNew()} disabled={!chosen || !newBody.trim() || starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {chosen ? (
            <div className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Avatar name={chosen.full_name} src={chosen.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{chosen.full_name}</p>
                <p className="truncate text-xs text-ink-subtle">
                  {chosen.email}{chosen.has_thread ? " · already has a thread" : ""}
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setChosen(null)}>Change</button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  autoFocus
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Find a member by name or email…"
                  className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
                {searching && hits.length === 0 ? (
                  <div className="flex items-center justify-center py-6"><Spinner /></div>
                ) : hits.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-ink-subtle">
                    {memberQuery.trim() ? "No member matches that." : "No members yet."}
                  </p>
                ) : (
                  hits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setChosen(h)}
                      className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-surface-hover"
                    >
                      <Avatar name={h.full_name} src={h.avatar} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{h.full_name}</span>
                        <span className="block truncate text-xs text-ink-subtle">{h.email}</span>
                      </span>
                      {h.has_thread && <UserRound className="h-4 w-4 shrink-0 text-ink-faint" aria-label="Has a thread" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <Textarea
            label="Message"
            rows={4}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Write to her…"
          />
        </div>
      </Modal>
    </div>
  );
}

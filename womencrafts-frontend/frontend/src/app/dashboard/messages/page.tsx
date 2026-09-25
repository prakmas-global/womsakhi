"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, MessagesSquare, Send, Mail, Clock, CircleCheck, SquarePen, Filter, Star, User, MoreVertical, CheckCheck, Smile, Paperclip, FileText, Download, Search, ChevronRight, MessageSquarePlus, Megaphone, LayoutTemplate, Bot, MailOpen, Archive, Trash2, Phone, ListFilter } from "lucide-react";
import { Avatar, Badge, Card, Menu, MenuItem, Modal, Select, StatCard, Textarea, NoResults, useToast, useConfirm } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_BG } from "@/lib/tones";
import { apiListConversations, apiMessageStats, apiMessageContacts, apiMessageTemplates, apiMessageAutomations, apiCreateConversation, apiSendMessage, apiUpdateConversation, apiDeleteConversation, apiBroadcast, type ApiConversation, type ApiMessageBubble, type ApiMessageStats, type BroadcastAudience } from "@/lib/messages-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

type Convo = {
  _id: string; // mongo id — used for flag/send/delete calls
  name: string;
  preview: string;
  time: string;
  unread?: number;
  starred?: boolean;
  active?: boolean;
};

type Bubble =
  | { dir: "in"; text: string; time: string }
  | { dir: "out"; text: string; time: string }
  | { dir: "out"; file: { name: string; size: string }; time: string };

function toConvo(c: ApiConversation): Convo {
  return {
    _id: c.id,
    name: c.name,
    preview: c.preview,
    time: c.time,
    unread: c.unread,
    starred: c.starred,
    active: c.active,
  };
}

function toBubble(m: ApiMessageBubble): Bubble {
  if (m.file) {
    return { dir: "out", file: { name: m.file.name, size: m.file.size }, time: m.time };
  }
  if (m.dir === "in") {
    return { dir: "in", text: m.text ?? "", time: m.time };
  }
  return { dir: "out", text: m.text ?? "", time: m.time };
}

const QUICK = [
  { icon: MessageSquarePlus, tone: "violet", title: "New Message", desc: "Send a message to a user" },
  { icon: Megaphone, tone: "brand", title: "Broadcast Message", desc: "Send message to multiple users" },
  { icon: LayoutTemplate, tone: "emerald", title: "Message Templates", desc: "Manage your message templates" },
  { icon: Bot, tone: "amber", title: "Automated Messages", desc: "Configure auto-replies and notifications" },
];

type ListFilterKind = "all" | "unread" | "starred" | "attachments";

const FILTER_LABEL: Record<ListFilterKind, string> = {
  all: "All",
  unread: "Unread",
  starred: "Starred",
  attachments: "With attachments",
};

export default function MessagesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [threads, setThreads] = useState<Record<string, Bubble[]>>({});
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ApiMessageStats | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [automations, setAutomations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeName, setActiveName] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilterKind>("all");
  const [composer, setComposer] = useState("");

  const [overviewRange, setOverviewRange] = useState("This Month");

  // modals
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [newBody, setNewBody] = useState("");

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastRecipients, setBroadcastRecipients] = useState("All users");
  const [broadcastBody, setBroadcastBody] = useState("");

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Load conversations (with embedded threads) + stats + lookups from the backend.
  const refresh = useCallback(async () => {
    try {
      const [list, s, cts, tpls, autos] = await Promise.all([
        apiListConversations({ page_size: 100 }),
        apiMessageStats(),
        apiMessageContacts(),
        apiMessageTemplates(),
        apiMessageAutomations(),
      ]);
      const mapped = list.items.map(toConvo);
      const threadMap: Record<string, Bubble[]> = {};
      for (const c of list.items) threadMap[c.name] = c.messages.map(toBubble);
      setConvos(mapped);
      setThreads(threadMap);
      setTotal(list.total);
      setStats(s);
      setContacts(cts);
      setTemplates(tpls);
      setAutomations(autos);
      setActiveName((cur) => (cur && mapped.some((c) => c.name === cur) ? cur : mapped[0]?.name ?? ""));
    } catch {
      /* leave current state; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeConvo = convos.find((c) => c.name === activeName) ?? null;
  const activeThread = threads[activeName] ?? [];

  const hasAttachment = (name: string) => (threads[name] ?? []).some((b) => "file" in b);

  const filteredConvos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return convos.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))) return false;
      if (filter === "unread") return (c.unread ?? 0) > 0;
      if (filter === "starred") return !!c.starred;
      if (filter === "attachments") return hasAttachment(c.name);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convos, search, filter, threads]);

  const unreadCount = convos.reduce((n, c) => n + (c.unread ?? 0), 0);

  const overview = stats?.overview ?? [];
  const overviewTotal = stats?.overview_total ?? 0;
  const topContacts = stats?.top_contacts ?? [];

  const findConvo = (name: string) => convos.find((c) => c.name === name);

  const appendBubble = (name: string, bubble: Bubble, preview: string) => {
    setThreads((prev) => ({ ...prev, [name]: [...(prev[name] ?? []), bubble] }));
    setConvos((prev) => prev.map((c) => (c.name === name ? { ...c, preview, time: "Now" } : c)));
  };

  const selectConvo = async (name: string) => {
    setActiveName(name);
    const convo = findConvo(name);
    setConvos((prev) => prev.map((c) => ({ ...c, active: c.name === name, unread: c.name === name ? 0 : c.unread })));
    if (convo && (convo.unread ?? 0) > 0) {
      try {
        await apiUpdateConversation(convo._id, { action: "read" });
        await refresh();
      } catch (err) {
        toast.error("Could not open the conversation", { description: memberError(err) });
      }
    }
  };

  const sendComposer = async () => {
    const text = composer.trim();
    if (!text) return;
    const convo = findConvo(activeName);
    if (!convo) return;
    setComposer("");
    appendBubble(activeName, { dir: "out", text, time: "Now" }, text);
    try {
      await apiSendMessage(convo._id, { dir: "out", text, time: "Now" });
      await refresh();
    } catch (err) {
      toast.error("Could not send the message", { description: memberError(err) });
    }
  };

  const attachFile = async () => {
    const convo = findConvo(activeName);
    if (!convo) return;
    const file = { name: "Attachment.pdf", size: "0.9 MB" };
    appendBubble(activeName, { dir: "out", file, time: "Now" }, file.name);
    try {
      await apiSendMessage(convo._id, { dir: "out", file, time: "Now" });
      await refresh();
    } catch (err) {
      toast.error("Could not attach the file", { description: memberError(err) });
    }
  };

  const toggleStar = async (name: string) => {
    const convo = findConvo(name);
    if (!convo) return;
    setConvos((prev) => prev.map((c) => (c.name === name ? { ...c, starred: !c.starred } : c)));
    try {
      await apiUpdateConversation(convo._id, { action: "toggle_star" });
      await refresh();
    } catch (err) {
      toast.error("Could not update the star", { description: memberError(err) });
    }
  };

  const markUnread = async (name: string) => {
    const convo = findConvo(name);
    if (!convo) return;
    setConvos((prev) => prev.map((c) => (c.name === name ? { ...c, unread: (c.unread ?? 0) || 1 } : c)));
    try {
      await apiUpdateConversation(convo._id, { action: "mark_unread" });
      await refresh();
    } catch (err) {
      toast.error("Could not mark it unread", { description: memberError(err) });
    }
  };

  const archiveConvo = async (name: string) => {
    const convo = findConvo(name);
    if (!convo) return;
    // harmless: mark read + unstar (keeps it in the list)
    setConvos((prev) => prev.map((c) => (c.name === name ? { ...c, unread: 0, starred: false } : c)));
    try {
      await apiUpdateConversation(convo._id, { action: "archive" });
      await refresh();
    } catch (err) {
      toast.error("Could not archive the conversation", { description: memberError(err) });
    }
  };

  const deleteConvo = async (name: string) => {
    if (!(await confirm({
      title: `Delete the conversation with ${name}?`,
      description: "The whole thread goes. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    const convo = findConvo(name);
    setConvos((prev) => {
      const idx = prev.findIndex((c) => c.name === name);
      const next = prev.filter((c) => c.name !== name);
      if (next.length === 0) {
        setActiveName("");
        return next;
      }
      const nextActive = next[Math.min(idx, next.length - 1)].name;
      setActiveName(nextActive);
      return next.map((c) => ({ ...c, active: c.name === nextActive }));
    });
    setThreads((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
    if (convo) {
      try {
        await apiDeleteConversation(convo._id);
        await refresh();
      } catch (err) {
        toast.error("Could not delete the conversation", { description: memberError(err) });
      }
    }
  };

  const submitNewMessage = async () => {
    const name = newRecipient.trim();
    const body = newBody.trim();
    if (!name) return;
    setNewMsgOpen(false);
    setNewRecipient("");
    setNewBody("");
    try {
      await apiCreateConversation({ name, body });
      await refresh();
      setActiveName(name);
    } catch (err) {
      toast.error("Could not start the conversation", { description: memberError(err) });
    }
  };

  const submitBroadcast = async () => {
    const body = broadcastBody.trim();
    if (!body) return;
    setBroadcastOpen(false);
    setBroadcastBody("");
    try {
      await apiBroadcast({ recipients: broadcastRecipients as BroadcastAudience, body });
    } catch (err) {
      toast.error("Could not send the broadcast", { description: memberError(err) });
    }
  };

  const openQuick = (title: string) => {
    if (title === "New Message") setNewMsgOpen(true);
    else if (title === "Broadcast Message") setBroadcastOpen(true);
    else if (title === "Message Templates") setTemplatesOpen(true);
    else if (title === "Automated Messages") setAutoOpen(true);
  };

  const contactOptions = contacts;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <MessageSquare className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Messages</h1>
          <p className="mt-1 text-sm text-ink-subtle">Communicate with your users, manage conversations and notifications.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Conversations" value={(stats?.total_conversations ?? 0).toLocaleString()} icon={MessagesSquare} tone="violet" deltaNote="All time" />
        <StatCard label="Messages Sent" value={(stats?.messages_sent ?? 0).toLocaleString()} icon={Send} tone="emerald" deltaNote="All time" />
        <StatCard label="Messages Received" value={(stats?.messages_received ?? 0).toLocaleString()} icon={Mail} tone="sky" deltaNote="All time" />
        <StatCard label="Avg. Response Time" value={stats?.avg_response_time ?? "—"} icon={Clock} tone="amber" deltaNote="This month" valueClassName="text-lg" />
        <StatCard label="Resolved Conversations" value={(stats?.resolved_conversations ?? 0).toLocaleString()} icon={CircleCheck} tone="brand" deltaNote="This month" />
      </div>

      <ResizableColumns id="messages" defaultSizes={[0.22, 0.56, 0.22]} className="mt-6 gap-6">
        {/* LEFT — conversations */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Conversations</h2>
            <button aria-label="New message"
              onClick={() => setNewMsgOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              align="right"
              trigger={
                <button aria-label="Filter conversations" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover">
                  <Filter className="h-4 w-4" />
                </button>
              }
            >
              <MenuItem icon={ListFilter} onClick={() => setFilter("all")}>{FILTER_LABEL.all}</MenuItem>
              <MenuItem icon={Mail} onClick={() => setFilter("unread")}>{FILTER_LABEL.unread}</MenuItem>
              <MenuItem icon={Star} onClick={() => setFilter("starred")}>{FILTER_LABEL.starred}</MenuItem>
              <MenuItem icon={Paperclip} onClick={() => setFilter("attachments")}>{FILTER_LABEL.attachments}</MenuItem>
            </Menu>
          </div>

          <div className="mb-3 flex items-center gap-5 border-b border-line text-sm">
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-1.5 pb-2 ${
                filter === "all"
                  ? "border-b-2 border-violet-600 font-semibold text-violet-ink"
                  : "font-medium text-ink-subtle"
              }`}
            >
              All <Badge tone="violet">{total}</Badge>
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`flex items-center gap-1.5 pb-2 ${
                filter === "unread"
                  ? "border-b-2 border-violet-600 font-semibold text-violet-ink"
                  : "font-medium text-ink-subtle"
              }`}
            >
              Unread <Badge tone="slate">{unreadCount}</Badge>
            </button>
            <button
              onClick={() => setFilter("starred")}
              className={`pb-2 ${
                filter === "starred"
                  ? "border-b-2 border-violet-600 font-semibold text-violet-ink"
                  : "font-medium text-ink-subtle"
              }`}
            >
              Starred
            </button>
          </div>

          <ul className="-mx-1 space-y-0.5">
            {filteredConvos.map((c) => (
              <li
                key={c.name}
                onClick={() => selectConvo(c.name)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 ${
                  c.name === activeName ? "bg-brand-tint" : "hover:bg-surface-hover"
                }`}
              >
                <Avatar name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <span className="shrink-0 text-2xs text-ink-subtle">{c.time}</span>
                  </div>
                  <p className="truncate text-xs text-ink-subtle">{c.preview}</p>
                </div>
                {c.unread ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-2xs font-bold text-white">
                    {c.unread}
                  </span>
                ) : c.starred ? (
                  <Star className="h-4 w-4 shrink-0 fill-rating text-rating" />
                ) : null}
              </li>
            ))}
            {loading && convos.length === 0 && (
              <li className="px-2.5 py-6 text-center text-xs text-ink-subtle">Loading conversations…</li>
            )}
            {!loading && filteredConvos.length === 0 && (
              <li><NoResults icon={MessageSquare} thing="conversations" filtered compact /></li>
            )}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
            <p className="text-ink-subtle">{filteredConvos.length} of {total} conversations</p>
          </div>
        </Card>

        {/* CENTER — chat */}
        <Card padded={false} className="flex min-h-[600px] flex-col">
          <div className="flex items-center justify-between border-b border-line p-4">
            <div className="flex items-center gap-3">
              <Avatar name={activeConvo?.name ?? "WomSakhi"} size="md" />
              <div>
                <p className="text-sm font-semibold text-ink">{activeConvo?.name ?? "No conversation"}</p>
                <p className="text-xs text-ink-subtle">User</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-ink-subtle">
              <button aria-label={activeConvo?.starred ? "Remove star" : "Star this conversation"} aria-pressed={!!activeConvo?.starred}
                onClick={() => activeConvo && toggleStar(activeConvo.name)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong hover:bg-surface-hover"
              >
                <Star className={`h-4 w-4 ${activeConvo?.starred ? "fill-rating text-rating" : ""}`} />
              </button>
              <Menu
                align="right"
                trigger={
                  <button aria-label="Contact details" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong hover:bg-surface-hover">
                    <User className="h-4 w-4" />
                  </button>
                }
              >
                <MenuItem icon={User} onClick={() => setContactOpen(true)}>View contact info</MenuItem>
                <MenuItem icon={Phone} onClick={() => setContactOpen(true)}>Contact details</MenuItem>
              </Menu>
              <Menu
                align="right"
                trigger={
                  <button aria-label="More actions for this conversation" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong hover:bg-surface-hover">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                }
              >
                <MenuItem icon={MailOpen} onClick={() => activeConvo && markUnread(activeConvo.name)}>
                  Mark as unread
                </MenuItem>
                <MenuItem icon={Archive} onClick={() => activeConvo && archiveConvo(activeConvo.name)}>
                  Archive
                </MenuItem>
                <MenuItem icon={Trash2} danger onClick={() => activeConvo && deleteConvo(activeConvo.name)}>
                  Delete conversation
                </MenuItem>
              </Menu>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex justify-center">
              <span className="rounded-full bg-surface-inset px-3 py-1 text-2xs font-medium text-ink-subtle">May 20, 2024</span>
            </div>

            {activeThread.map((b, i) =>
              b.dir === "in" ? (
                <div key={i} className="flex items-end gap-2.5">
                  <Avatar name={activeConvo?.name ?? "WomSakhi"} size="sm" />
                  <div className="max-w-[78%]">
                    <div className="rounded-2xl rounded-bl-md bg-surface-inset px-4 py-2.5 text-sm text-ink-muted">{b.text}</div>
                    <p className="mt-1 text-2xs text-ink-subtle">{b.time}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-end">
                  <div className="max-w-[78%]">
                    {"file" in b ? (
                      <div className="flex items-center gap-3 rounded-2xl rounded-br-md bg-violet-tint px-4 py-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-status-danger-ink shadow-sm">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{b.file.name}</p>
                          <p className="text-xs text-ink-subtle">{b.file.size}</p>
                        </div>
                        <button aria-label={`Download ${b.file.name}`} className="ml-1 text-ink-subtle hover:text-ink-muted">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-br-md bg-violet-tint px-4 py-2.5 text-sm text-ink-muted">{b.text}</div>
                    )}
                    <p className="mt-1 flex items-center justify-end gap-1 text-2xs text-ink-subtle">
                      {b.time}
                      <CheckCheck className="h-3.5 w-3.5 text-violet-ink" />
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="border-t border-line p-4">
            <div className="flex min-w-0 items-center gap-2">
              <input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendComposer();
                  }
                }}
                placeholder="Type your message..."
                className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface py-2.5 px-4 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
              <button aria-label="Add an emoji" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-hover">
                <Smile className="h-5 w-5" />
              </button>
              <button aria-label="Attach a file"
                onClick={attachFile}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-hover"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button onClick={sendComposer} className="btn btn-primary">
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          </div>
        </Card>

        {/* RIGHT — overview / actions / contacts */}
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Messages Overview</h2>
              <Menu
                align="right"
                trigger={
                  <button className="flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-muted">
                    {overviewRange}
                    <ChevronRight className="h-3.5 w-3.5 rotate-90 text-ink-subtle" />
                  </button>
                }
              >
                <MenuItem onClick={() => setOverviewRange("This Week")}>This Week</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Month")}>This Month</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Quarter")}>This Quarter</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Year")}>This Year</MenuItem>
              </Menu>
            </div>
            <div className="flex flex-col items-center gap-4">
              <DonutChart data={overview.map((o) => ({ name: o.name, value: o.value, color: o.color }))} centerValue={overviewTotal.toLocaleString()} centerLabel="Total" size={150} thickness={18} />
              <ul className="w-full space-y-2.5">
                {overview.map((o) => (
                  <li key={o.name} className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: o.color }} /> {o.name}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-medium text-ink-subtle">
                      {o.value} ({o.pct})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Quick Actions</h2>
            <div className="space-y-2">
              {QUICK.map((q) => (
                <button
                  key={q.title}
                  onClick={() => openQuick(q.title)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[q.tone]}`}>
                    <q.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{q.title}</span>
                    <span className="block text-xs text-ink-subtle">{q.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Top Contacts</h2>
              <Menu
                align="right"
                trigger={<button className="text-xs font-semibold text-brand-ink transition hover:underline">View All</button>}
              >
                {topContacts.map((c) => (
                  <MenuItem key={c.name} icon={User} onClick={() => selectConvo(c.name)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Menu>
            </div>
            <ul className="space-y-3">
              {topContacts.map((c) => (
                <li
                  key={c.name}
                  onClick={() => selectConvo(c.name)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg hover:bg-surface-hover"
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-subtle">{c.count} conversations</p>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-tint text-xs font-bold text-violet-ink">
                    {c.badge}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      {/* New Message modal */}
      <Modal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        title="New Message"
        description="Start a new conversation with a user."
        icon={MessageSquarePlus}
        iconTone="violet"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setNewMsgOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitNewMessage}>
              <Send className="h-4 w-4" /> Send
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Recipient"
            required
            className="col-span-2"
            options={contactOptions}
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            placeholder="Select a contact…"
          />
          <Textarea
            label="Message"
            className="col-span-2"
            rows={4}
            placeholder="Type your message…"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
        </div>
      </Modal>

      {/* Broadcast modal */}
      <Modal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        title="Broadcast Message"
        description="Send a single message to multiple users at once."
        icon={Megaphone}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setBroadcastOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitBroadcast}>
              <Megaphone className="h-4 w-4" /> Broadcast
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Recipients"
            className="col-span-2"
            options={["All users", "Active users", "Workshop enrollees", "Starred contacts"]}
            value={broadcastRecipients}
            onChange={(e) => setBroadcastRecipients(e.target.value)}
          />
          <Textarea
            label="Message"
            className="col-span-2"
            rows={4}
            placeholder="Write your broadcast message…"
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
          />
        </div>
      </Modal>

      {/* Templates modal */}
      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="Message Templates"
        description="Reuse saved templates for common replies."
        icon={LayoutTemplate}
        iconTone="emerald"
        footer={<button className="btn btn-primary" onClick={() => setTemplatesOpen(false)}>Done</button>}
      >
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-ok-bg text-status-ok-ink">
                <LayoutTemplate className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-semibold text-ink">{t}</span>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Automated messages modal */}
      <Modal
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        title="Automated Messages"
        description="Configure auto-replies and notifications."
        icon={Bot}
        iconTone="amber"
        footer={<button className="btn btn-primary" onClick={() => setAutoOpen(false)}>Done</button>}
      >
        <ul className="space-y-2">
          {automations.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-warn-bg text-status-warn-ink">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-semibold text-ink">{t}</span>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Contact info modal */}
      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title={activeConvo?.name ?? "Contact"}
        description="Contact information"
        icon={User}
        iconTone="sky"
        footer={<button className="btn btn-primary" onClick={() => setContactOpen(false)}>Close</button>}
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar name={activeConvo?.name ?? "WomSakhi"} size="md" />
          <p className="text-sm font-semibold text-ink">{activeConvo?.name ?? "Contact"}</p>
          <p className="text-xs text-ink-subtle">User · WomSakhi community member</p>
        </div>
      </Modal>
    </div>
  );
}

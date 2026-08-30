"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import { Alert, Avatar, Card, EmptyState, Skeleton } from "@/design-system";
import { SplitPane } from "@/layout-engine";
import {
  apiReplyToThread,
  apiSupportThreads,
  verificationErrorMessage,
  type SupportThread,
} from "@/lib/verification-api";

/**
 * Member support inbox.
 *
 * Members have exactly one thread each (see models/conversation.py), so this is
 * a list of people rather than a list of topics — pick a woman, read what she
 * said, reply. Unread threads sort to the top because someone is waiting.
 *
 * NOTE: this is separate from /dashboard/messages, which is the older
 * campaign/contacts system on the `conversations` collection. Consolidating the
 * two is worth doing, but not by quietly breaking a screen that works.
 */
export default function MemberSupportPage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (keepActive = true) => {
    try {
      const data = await apiSupportThreads();
      setThreads(data);
      setActiveId((cur) => (keepActive && cur ? cur : data[0]?.user_id ?? ""));
      setError("");
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Someone is waiting on the other end — refresh while the screen is open.
  useEffect(() => {
    const id = setInterval(() => void load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  const active = threads.find((t) => t.user_id === activeId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, activeId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.full_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [threads, query]);

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  async function send() {
    const body = reply.trim();
    if (!body || !active) return;
    setSending(true);
    try {
      await apiReplyToThread(active.user_id, body);
      setReply("");
      await load(true);
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Member support"
        subtitle={
          totalUnread > 0
            ? `${totalUnread} message${totalUnread === 1 ? "" : "s"} waiting for a reply`
            : "Every member has one thread with the team."
        }
        icon={MessageCircle}
      />

      <Link
        href="/dashboard/messages"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-subtle hover:text-ink-muted"
      >
        <ArrowLeft className="h-4 w-4" /> Campaigns &amp; contacts
      </Link>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/*
        First screen to opt into the layout engine's split pane. The divider is
        draggable and keyboard-operable, and where she leaves it is remembered
        per breakpoint. Below the tablet breakpoint the primitive stacks the two
        panels on its own — two 180px columns on a phone are unreadable.
      */}
      <SplitPane
        id="member-support"
        className="gap-1"
        defaultSize={0.28}
        list={
        <Card className="p-0">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : visible.length ? (
              visible.map((t) => {
                const on = t.user_id === activeId;
                return (
                  <button
                    key={t.user_id}
                    onClick={() => setActiveId(t.user_id)}
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
                        {t.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-2xs font-bold text-white">
                            {t.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                        {t.last_message}
                      </span>
                      <span className="mt-0.5 block text-2xs text-ink-subtle">{t.last_at}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon={Inbox}
                title="No member threads yet"
                description="When a member writes in, her thread appears here."
              />
            )}
          </div>
        </Card>
        }
        detail={
        <Card className="flex min-h-[60vh] flex-col p-0">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Avatar name={active.full_name} src={active.avatar} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-ink">{active.full_name}</p>
                  <p className="truncate text-xs text-ink-subtle">{active.email}</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {active.messages.map((m) => {
                  const fromTeam = m.sender === "team";
                  return (
                    <div key={m.id} className={`flex ${fromTeam ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[76%]">
                        {fromTeam && (
                          <p className="mb-1 flex items-center justify-end gap-1.5 text-xs font-semibold text-violet-ink">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {m.sender_name || "Team"}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            fromTeam
                              ? "bg-linear-to-br from-violet-600 to-violet-500 text-white"
                              : "wc-soft text-ink-muted"
                          }`}
                        >
                          {m.body}
                        </div>
                        <p className={`mt-1 text-2xs text-ink-subtle ${fromTeam ? "text-right" : ""}`}>
                          {m.sent_label}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t border-line p-3">
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
                    placeholder={`Reply to ${active.full_name.split(" ")[0]}…`}
                    className="max-h-40 min-h-[3rem] flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                  />
                  <button
                    onClick={send}
                    disabled={!reply.trim() || sending}
                    className="btn btn-secondary h-11 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink-subtle">
                  She&apos;ll get a notification in her app straight away.
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Pick a member"
              description="Choose someone on the left to read and reply to her thread."
              className="my-auto"
            />
          )}
        </Card>
        }
      />
    </div>
  );
}

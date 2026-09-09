"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { About, EmptyThread, Header, Inbox, Thread } from "./views";
import { formatMoney } from "@/components/ux/kit/money";
import Link from "next/link";
import {
  apiConversation,
  apiConversations,
  apiDeleteConversation,
  apiMarkUnread,
  apiStarConversation,
  apiInboxSummary,
  apiSendToConversation,
  type ConvBubble,
  type ConvDetail,
  type ConvRow,
  type InboxSummary,
  type PartyKind,
} from "@/lib/me-messages-api";

/**
 * Messages.
 *
 * ── Why the inbox is not sorted by recency ──────────────────────────────────
 * Every chat app sorts newest-first, and for a chat app that is right. This is
 * not a chat app — it is the place a woman runs her shop from. A buyer who
 * asked a question two days ago matters more than a circle that chatted a
 * minute ago, so conversations *waiting for her reply* come first, longest wait
 * at the top, and everything else follows by recency.
 *
 * Only buyers and mentors can be "waiting": a circle chatting among itself and
 * a team announcement are unanswered too, but nobody is sitting there wondering
 * why she has not replied. Counting them is how that section stops meaning
 * anything. The rule lives on the server — `MemberConversationModel.awaits_reply`.
 *
 * ── The thread carries what it is about ─────────────────────────────────────
 * A message here is about work, not chat, so the order sits in the header strip
 * and again in the thread at the moment it was created. She never has to
 * remember which order "is it ready?" refers to.
 */






/* ── the shell ──────────────────────────────────────────────────────────── */

export default function MessagesPage() {
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConvDetail | null>(null);
  const [filter, setFilter] = useState<PartyKind | "all">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  /**
   * On a phone, one panel at a time.
   *
   * Three columns stacked into a 844px screen gave each of them a couple of
   * hundred pixels — the conversation list was sliced through the middle of a
   * row and the thread had no room to be a thread. Below `lg` this shows the
   * inbox *or* the conversation, with a back arrow, which is what every
   * messaging app on a phone does and for this reason.
   */
  const [onThread, setOnThread] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiConversations();
      setRows(list);
      setOpenId((id) => id ?? list[0]?.id ?? null);
      // Cleared on success. A message that stays after the problem is gone is
      // the app lying about its own state.
      setError("");
    } catch { setError("Your messages could not be loaded."); }
    try { setSummary(await apiInboxSummary()); } catch { /* the strip simply stays empty */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!openId) { setThread(null); return; }
    let alive = true;
    apiConversation(openId)
      .then((d) => { if (alive) { setThread(d); setError(""); } })
      .catch(() => { if (alive) setError(COPY.threadFailed); });
    return () => { alive = false; };
  }, [openId]);

  async function send() {
    const text = draft.trim();
    if (!text || !openId || sending) return;
    setSending(true);
    setDraft("");
    try {
      setThread(await apiSendToConversation(openId, text));
      void load();
    } catch { setError("That did not send. Try again."); }
    finally { setSending(false); }
  }

  async function toggleStar() {
    if (!thread) return;
    try { setThread(await apiStarConversation(thread.id, !thread.starred)); void load(); }
    catch { setError("That could not be saved."); }
  }

  async function markUnread() {
    if (!thread) return;
    try { await apiMarkUnread(thread.id); setOpenId(null); void load(); }
    catch { setError("That could not be marked unread."); }
  }

  async function removeConversation() {
    if (!thread) return;
    if (!window.confirm(`Delete your conversation with ${thread.name}? This cannot be undone.`)) return;
    try { await apiDeleteConversation(thread.id); setOpenId(null); setThread(null); void load(); }
    catch { setError("That could not be deleted."); }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === "all" || r.kind === filter)
      && (!q || r.name.toLowerCase().includes(q) || (r.preview || "").toLowerCase().includes(q)));
  }, [rows, filter, search]);

  const waitingRows = shown.filter((r) => r.waiting_since);
  const restRows = shown.filter((r) => !r.waiting_since);

  /**
   * Keep the open conversation inside the filter.
   *
   * Filtering to Mentors while a buyer was open left her reading Fatima's
   * thread beside a list that did not contain Fatima — the panels disagreed
   * about what she was looking at. Narrowing the list now moves the selection
   * to the first thing in it, and clears it when the filter matches nothing.
   */
  useEffect(() => {
    if (rows.length === 0) return;
    if (openId && shown.some((r) => r.id === openId)) return;
    setOpenId(shown[0]?.id ?? null);
  }, [shown, openId, rows.length]);

  return (
    <HomeShell active="/app/messages" bare wide>
      {/*
        An inbox is an app, not a page.

        This used to scroll as one long column, so the moment a member scrolled
        the thread, the title, her three figures and the whole conversation list
        went off the top — she could no longer see who she was even talking to.
        The screen is now exactly the height of what is left of the viewport,
        and each of the three panels scrolls inside itself. Nothing that tells
        her where she is can leave the screen.

        The height subtracts the topbar, the scroller's own top padding, and the
        space the shell keeps clear for the floating assistant and the phone's
        bottom bar.
      */}
      <div className="flex flex-col gap-4"
           style={{ height: "calc(100dvh - var(--ux-topbar-h) - 36px)", minHeight: 560 }}>
        {/* The page header costs ~250px, which on a phone is most of the
            conversation. Reading a thread, she does not need her inbox
            statistics — she needs the messages. */}
        <Header summary={summary} className={onThread ? "hidden lg:flex" : "flex"}
                rows={rows} onPick={(id) => { setOpenId(id); setOnThread(true); }} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[322px_minmax(0,1fr)] xl:grid-cols-[322px_minmax(0,1fr)_272px]">
          <Inbox
            waiting={waitingRows} rest={restRows} counts={summary?.counts ?? {}}
            filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
            openId={openId} onOpen={(id) => { setOpenId(id); setOnThread(true); }} total={rows.length}
            className={onThread ? "hidden lg:flex" : "flex"}
          />
          {thread
            ? <Thread conv={thread} draft={draft} setDraft={setDraft} onSend={send} sending={sending}
                      className={onThread ? "flex" : "hidden lg:flex"} onBack={() => setOnThread(false)}
                      onStar={toggleStar} onUnread={markUnread} onDelete={removeConversation} />
            : <EmptyThread className={onThread ? "grid" : "hidden lg:grid"} />}
          {thread && <About conv={thread} onStar={toggleStar} onDraft={setDraft} />}
        </div>

        {error && (
          <p className="flex items-center gap-2 text-xsm" style={{ color: "var(--ux-pink-ink)" }}>
            <Icons.TriangleAlert className="h-4 w-4" /> {error}
          </p>
        )}
      </div>
    </HomeShell>
  );
}

/* ── header ─────────────────────────────────────────────────────────────── */

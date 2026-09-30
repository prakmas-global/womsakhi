"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n";
import { COPY } from "@/components/ux/copy";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { EmptyThread, Header, Inbox, Thread } from "./views";
import { apiConversation, apiConversations, apiDeleteConversation, apiMarkUnread, apiStarConversation, apiInboxSummary, apiSendToConversation, MESSAGE_MAX, type ConvDetail, type ConvRow, type InboxSummary, type PartyKind } from "@/lib/me-messages-api";

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
  const tr = useT();
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConvDetail | null>(null);
  const [filter, setFilter] = useState<PartyKind | "all">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const toast = useToast();
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

  /**
   * `load()` asks for a fresh list; the effect below is what fetches it. The
   * setters run in the promise callbacks, never synchronously in the effect.
   */
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    apiConversations()
      .then((list) => {
        if (!alive) return;
        setRows(list);
        // Cleared on success. A message that stays after the problem is gone is
        // the app lying about its own state.
        setError("");
      })
      .catch(() => { if (alive) setError("Your messages could not be loaded."); });
    apiInboxSummary()
      .then((s) => { if (alive) setSummary(s); })
      .catch(() => { /* the strip simply stays empty */ });
    return () => { alive = false; };
  }, [tick]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === "all" || r.kind === filter)
      && (!q || r.name.toLowerCase().includes(q) || (r.preview || "").toLowerCase().includes(q)));
  }, [rows, filter, search]);

  /**
   * The open conversation always sits inside the filter.
   *
   * Filtering to Mentors while a buyer was open left her reading Fatima's
   * thread beside a list that did not contain Fatima. The selection is now
   * derived: what she picked if the list still shows it, else the first row.
   */
  const activeId = openId && shown.some((r) => r.id === openId) ? openId : (shown[0]?.id ?? null);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    apiConversation(activeId)
      .then((d) => { if (alive) { setThread(d); setError(""); } })
      .catch(() => { if (alive) setError(COPY.threadFailed); });
    return () => { alive = false; };
  }, [activeId]);

  // Only the thread that is actually selected — never a stale one from before a filter change.
  const current = thread && thread.id === activeId ? thread : null;

  async function send() {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    if (text.length > MESSAGE_MAX) { setError(`A message can be up to ${MESSAGE_MAX} characters.`); return; }
    setSending(true);
    setDraft("");
    try {
      setThread(await apiSendToConversation(activeId, text));
      void load();
    } catch {
      // Her words come back: a failed send must not cost her what she wrote.
      setDraft((d) => d || text);
      setError("That did not send. Try again.");
    }
    finally { setSending(false); }
  }

  async function toggleStar() {
    if (!current) return;
    try { setThread(await apiStarConversation(current.id, !current.starred)); void load(); }
    catch { setError("That could not be saved."); }
  }

  async function markUnread() {
    if (!current) return;
    try { await apiMarkUnread(current.id); setOpenId(null); void load(); }
    catch { setError("That could not be marked unread."); }
  }

  async function removeConversation() {
    const thread = current;
    if (!thread) return;
    /**
     * The app's dialog, not the browser's.
     *
     * `window.confirm()` blocks the main thread, cannot be styled, and — the
     * part that matters here — renders in the BROWSER's language. A woman
     * reading WomSakhi in Hindi got an English "OK / Cancel" over a permanent
     * deletion, from what looks to her like a different program entirely.
     */
    const sure = await confirm({
      title: `Delete your conversation with ${thread.name}?`,
      description: tr("messages.everyMessageInItGoesOn"),
      confirmLabel: tr("messages.deleteIt"),
      cancelLabel: tr("bookings.cancelKeep"),
      danger: true,
    });
    if (!sure) return;
    try {
      await apiDeleteConversation(thread.id);
      setOpenId(null);
      setThread(null);
      void load();
      // The thread simply vanishing from the list is not, on its own, a
      // confirmation that anything reached the server.
      toast.success("Conversation deleted");
    } catch { setError("That could not be deleted."); }
  }

  const waitingRows = shown.filter((r) => r.waiting_since);
  const restRows = shown.filter((r) => !r.waiting_since);

  return (
    <HomeShell active="/app/messages" bare>
      {/*
        An inbox is an app, not a page.

        This used to scroll as one long column, so the moment a member scrolled
        the thread, the title, her three figures and the whole conversation list
        went off the top — she could no longer see who she was even talking to.
        The screen is now exactly the height of what is left of the viewport,
        and each panel scrolls inside itself. Nothing that tells
        her where she is can leave the screen.

        The height subtracts the topbar, the scroller's own top padding, and the
        space the shell keeps clear for the floating assistant and the phone's
        bottom bar.
      */}
      {/*
        `minHeight: 560` was unconditional, so on a 390x844 phone the column was
        taller than the space it had and the last conversation row sat under the
        tab bar. A phone gets the height it actually has; the floor stays from
        `lg` up, where it is protecting a three-column layout that genuinely
        cannot work any shorter.
      */}
      <div className="ux-inbox-frame flex flex-col gap-3 lg:gap-4"
           style={{ height: "calc(100dvh - var(--ux-topbar-h) - 36px)" }}>
        {/* The page header costs ~250px, which on a phone is most of the
            conversation. Reading a thread, she does not need her inbox
            statistics — she needs the messages. */}
        <Header summary={summary} className={onThread ? "hidden lg:flex" : "flex"}
                rows={rows} onPick={(id) => { setOpenId(id); setOnThread(true); }} />

        <div className="ux-inbox-grid grid min-h-0 flex-1 gap-4">
          <Inbox
            waiting={waitingRows} rest={restRows} counts={summary?.counts ?? {}}
            filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
            openId={activeId} onOpen={(id) => { setOpenId(id); setOnThread(true); }} total={rows.length}
            rows={rows} onPick={(id) => { setOpenId(id); setOnThread(true); }} onThread={onThread}
          />
          {current
            ? <Thread conv={current} draft={draft} setDraft={setDraft} onSend={send} sending={sending}
                      className={onThread ? "flex" : "hidden lg:flex"} onBack={() => setOnThread(false)}
                      onStar={toggleStar} onUnread={markUnread} onDelete={removeConversation}
                      onChanged={(d) => { setThread(d); void load(); }} />
            : <EmptyThread className={onThread ? "grid" : "hidden lg:grid"} />}
        </div>

        {/*
          The floating "Ask Sakhi" button sits bottom-right at 80px, which —
          now that the conversation runs to the right edge instead of a third
          column — is exactly where the Send button is. Measured: a click on
          Send landed on Sakhi's face. On a phone the chat frame already sits
          above her (z 45 over 40); on a desktop inbox she steps aside too.
        */}
        <style href="ux-inbox-float" precedence="ux-mobile">
          {`.ux:has(.ux-inbox-grid) [data-float="sakhi"] { display: none !important; }`}
        </style>

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

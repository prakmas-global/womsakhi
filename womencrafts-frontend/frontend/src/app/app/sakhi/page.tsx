"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useI18n, LOCALES } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CAN, FOLLOW_UPS, MODE_PREFIX, STARTERS, WONT } from "@/components/ux/sakhi/prompts";
import { ConvBar, Disclosure, SakhiRail, Thread, Voice, Welcome, type Bubble } from "./views";
import { Actions, Answer, Cites, Composer, DraftCard, Ico, ModeSwitch, Picker, StopPill, Typing } from "@/components/ux/sakhi/parts";
import {
  apiSakhiConversation,
  apiSakhiConversations,
  apiSakhiDelete,
  apiSakhiPin,
  apiSakhiRate,
  apiSakhiRename,
  apiSakhiSave,
  apiSakhiSaved,
  apiSakhiStatus,
  apiSakhiUnsave,
  sakhiChat,
  type SakhiSaved,
  sakhiConfirm,
  type Helpline,
  type SakhiConversation,
  type SakhiEvent,
} from "@/lib/sakhi-api";

/**
 * Ask Sakhi.
 *
 * ── Three things here are deliberate and worth not undoing ──────────────────
 *
 * **The confirmation is a card in the thread, not a dialog.** A dialog on a
 * phone covers the conversation it is asking about, so she has to remember what
 * she asked while deciding whether to allow it. The card sits inline with the
 * sentence the *server* built from the database, and both buttons are the same
 * size — "no" is not a smaller, greyer afterthought.
 *
 * **A safety reply looks nothing like Sakhi.** When the gate fires the answer
 * renders as a bordered panel with tappable phone numbers, never as a chat
 * bubble. She should be able to tell at a glance that this is not the assistant
 * talking.
 *
 * **The disclosure is always visible**, under the composer where she is
 * typing — not behind an info icon that gets read once and never again.
 *
 * ── What is wired, and what is not ──────────────────────────────────────────
 * Streaming, conversations, history, delete, the pending-action confirm and
 * stop all go to the real API. Mode is a real instruction prepended to the
 * message. Language really switches the app's locale. Voice really uses the
 * browser's recogniser where it exists, and hides itself where it does not.
 *
 * Naming, pinning, thumbs and saved answers all go to the server too. They
 * lived in `localStorage` first, which made them per-device — a member who
 * pinned a conversation on a borrowed phone found it unpinned on her own. They
 * are hers, so they live with her account.
 */



export default function SakhiPage() {
  const { locale, setLocale } = useI18n();
  const { user } = useAuth();
  const first = (user?.full_name || "").trim().split(" ")[0];

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [toolRunning, setToolRunning] = useState(false);
  const [pending, setPending] = useState<{ id: string; sentence: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<SakhiConversation[]>([]);
  const [available, setAvailable] = useState(true);
  const [disclosure, setDisclosure] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("quick");
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [heard, setHeard] = useState("");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<SakhiSaved[]>([]);
  const [votes, setVotes] = useState<Record<number, "up" | "down">>({});
  const [file, setFile] = useState<File | null>(null);
  const [showWords, setShowWords] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastAsk = useRef("");
  const convRef = useRef<string | null>(null);

  const loadSaved = useCallback(async () => {
    try { setSaved(await apiSakhiSaved()); } catch { /* the list refreshes next turn */ }
  }, []);
  useEffect(() => { void loadSaved(); }, [loadSaved]);

  useEffect(() => {
    apiSakhiStatus()
      .then((s) => { setAvailable(s.enabled && !s.budget.exhausted); setDisclosure(s.disclosure || ""); })
      .catch(() => setAvailable(false));
  }, []);

  const loadHistory = useCallback(async () => {
    try { setHistory(await apiSakhiConversations()); } catch { /* the list refreshes next turn */ }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles.length, streaming, pending]);

  /** One place that turns a stream of events into what she sees. */
  const consume = useCallback((event: SakhiEvent, buffer: { text: string; tools: string[] }) => {
    switch (event.type) {
      case "text": buffer.text += event.text; setStreaming(buffer.text); break;
      case "tool":
        setToolRunning(true);
        // Collected on the buffer, never in state. React invokes an updater
        // more than once in development, so calling `setBubbles` from inside
        // `setTools` appended the finished answer twice — the duplicate reply
        // that showed up in testing.
        if (!buffer.tools.includes(event.name)) buffer.tools.push(event.name);
        break;
      case "safety":
        setBubbles((p) => [...p, { kind: "safety", text: event.text, helplines: event.helplines }]);
        break;
      case "confirm":
        setConversationId(event.conversation_id);
        setPending({ id: event.action_id, sentence: event.sentence });
        break;
      case "action":
        setBubbles((p) => [...p, { kind: "action", text: event.text, ok: event.ok }]);
        break;
      case "error": setError(event.message); break;
      case "done": {
        if (event.conversation_id) { setConversationId(event.conversation_id); convRef.current = event.conversation_id; }
        // Read the buffer into a local BEFORE clearing it. A state updater is a
        // closure React runs at render time, so `{ text: buffer.text }` written
        // inside it would read the buffer *after* the reset below — which showed
        // the answer while it streamed then blanked it as the stream closed.
        const finished = buffer.text;
        buffer.text = "";
        const ran = buffer.tools.slice();
        buffer.tools.length = 0;
        if (finished.trim()) setBubbles((p) => [...p, { kind: "assistant", text: finished, tools: ran }]);
        setStreaming("");
        setToolRunning(false);
        break;
      }
    }
  }, []);

  /**
   * Give the streamed bubbles their real message ids.
   *
   * A streamed answer has no id until the server has written it, and thumbs
   * have to name a message. Rather than inventing a client id and reconciling
   * later, the transcript is re-read once the stream closes and its assistant
   * ids are laid onto the assistant bubbles in order — they are the same
   * messages in the same sequence.
   */
  const adoptIds = useCallback(async () => {
    const id = convRef.current ?? conversationId;
    if (!id) return;
    try {
      const detail = await apiSakhiConversation(id);
      const ids = detail.messages.filter((m) => m.kind === "assistant").map((m) => m.id);
      setBubbles((prev) => {
        let n = 0;
        return prev.map((b) => (b.kind === "assistant" ? { ...b, id: ids[n++] ?? b.id } : b));
      });
    } catch { /* ratings stay unavailable for this turn, nothing else breaks */ }
  }, [conversationId]);

  const ask = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    lastAsk.current = message;

    const attached = file?.name;
    setBubbles((p) => [...p, { kind: "user", text: message, file: attached }]);
    setDraft("");
    setFile(null);
    setError("");
    setBusy(true);

    const buffer = { text: "", tools: [] as string[] };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sakhiChat(
        MODE_PREFIX[mode] + message + (attached ? `\n(I have attached a file named "${attached}".)` : ""),
        conversationId, (e) => consume(e, buffer), controller.signal);
    } catch (err) {
      // An abort is her pressing stop, not a failure.
      if (!controller.signal.aborted) setError(String(err));
    } finally {
      setBusy(false);
      setStreaming("");
      setToolRunning(false);
      abortRef.current = null;
      void loadHistory();
      void adoptIds();
    }
  }, [busy, conversationId, consume, file, loadHistory, mode, adoptIds]);

  async function answer(approve: boolean) {
    if (!pending || !conversationId) return;
    const action = pending;
    setPending(null);
    setBusy(true);
    const buffer = { text: "", tools: [] as string[] };
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await sakhiConfirm(conversationId, action.id, approve, (e) => consume(e, buffer), controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err));
    } finally { setBusy(false); abortRef.current = null; }
  }

  function stop() { abortRef.current?.abort(); }

  async function openConversation(id: string) {
    try {
      const detail = await apiSakhiConversation(id);
      setConversationId(detail.id);
      setVoiceMode(false);
      setBubbles(detail.messages.map((m) =>
        m.kind === "safety"
          ? { kind: "safety" as const, text: m.text, helplines: (m.meta?.helplines as Helpline[]) ?? [] }
          : m.kind === "action"
            ? { kind: "action" as const, text: m.text, ok: m.meta?.ok !== false }
            : m.kind === "assistant"
              ? { kind: "assistant" as const, text: m.text, id: m.id }
              : { kind: "user" as const, text: m.text }));
      setPending(detail.pending_action
        ? { id: detail.pending_action.id, sentence: detail.pending_action.sentence } : null);
      // Thumbs she gave before, read back so the button shows what she chose.
      const back: Record<number, "up" | "down"> = {};
      detail.messages.forEach((m, i) => {
        const h = (m.meta as { helpful?: boolean | null } | undefined)?.helpful;
        if (h === true) back[i] = "up";
        else if (h === false) back[i] = "down";
      });
      setVotes(back);
    } catch { setError("That conversation could not be opened."); }
  }

  async function remove(id: string) {
    try {
      await apiSakhiDelete(id);
      if (id === conversationId) startNew();
      void loadHistory();
    } catch { /* ignored — the list refreshes on the next turn anyway */ }
  }

  function startNew() {
    setConversationId(null); setBubbles([]); setPending(null);
    setStreaming(""); setError(""); setVoiceMode(false); setVotes({});
  }

  async function togglePin(id: string) {
    const now = history.find((c) => c.id === id)?.pinned ?? false;
    // Optimistic, then reconciled by `loadHistory` — a pin that waits on a
    // round trip feels broken on a slow connection.
    setHistory((p) => p.map((c) => (c.id === id ? { ...c, pinned: !now } : c)));
    try { await apiSakhiPin(id, !now); } finally { void loadHistory(); }
  }

  async function rate(messageId: string | undefined, helpful: boolean | null) {
    if (!messageId) return;
    try { await apiSakhiRate(messageId, helpful); } catch { setError("That could not be recorded."); }
  }

  async function rename() {
    if (!conversationId) return;
    const now = history.find((c) => c.id === conversationId)?.title ?? "";
    const next = window.prompt("Name this conversation", now);
    if (next === null) return;
    const title = next.trim();
    if (!title) return;
    try { await apiSakhiRename(conversationId, title); } catch { setError("That could not be renamed."); }
    void loadHistory();
  }

  async function share() {
    const url = `${window.location.origin}/app/sakhi`;
    try {
      if (navigator.share) await navigator.share({ title: "Ask Sakhi", url });
      else await navigator.clipboard?.writeText(url);
    } catch { /* she cancelled the sheet, or there is no clipboard */ }
  }

  async function toggleSave(text: string) {
    const existing = saved.find((row) => row.text === text);
    try {
      if (existing) await apiSakhiUnsave(existing.id);
      else await apiSakhiSave(text, conversationId ?? "");
    } catch { setError("That could not be saved just now."); }
    void loadSaved();
  }

  /* ── voice ─────────────────────────────────────────────────────────────
     The browser's own recogniser. `canVoice` is false where it does not
     exist, and the microphone is then not drawn at all — a button that
     cannot work is worse than no button. */
  const canVoice = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
  }, []);

  const listen = useCallback((intoVoiceMode: boolean) => {
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const W = window as unknown as Record<string, new () => never>;
    const Ctor = (W.SpeechRecognition || W.webkitSpeechRecognition) as unknown as
      (new () => {
        lang: string; interimResults: boolean; continuous: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void; onerror: () => void; start: () => void; stop: () => void;
      }) | undefined;
    if (!Ctor) return;

    const r = new Ctor();
    r.lang = locale === "en" ? "en-IN" : locale;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      if (intoVoiceMode) setHeard(said); else setDraft(said);
    };
    r.onend = () => {
      setListening(false);
      recogRef.current = null;
      if (intoVoiceMode) {
        // Read from the setter rather than a stale closure over `heard`.
        setHeard((said) => { if (said.trim()) void ask(said); return said; });
      }
    };
    r.onerror = () => { setListening(false); recogRef.current = null; };
    recogRef.current = r;
    setListening(true);
    r.start();
  }, [ask, listening, locale]);

  useEffect(() => () => recogRef.current?.stop(), []);

  const localeItems = LOCALES.map((l) => ({
    value: l.code, label: l.nativeName, note: l.nativeName === l.name ? undefined : l.name,
  }));

  /* ── history, grouped the way she thinks about it ─────────────────────── */
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = history.filter((c) => !q || c.title.toLowerCase().includes(q));
    const day = 86_400_000;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const buckets: { label: string; rows: SakhiConversation[] }[] = [
      { label: "Pinned", rows: [] }, { label: "Today", rows: [] },
      { label: "Yesterday", rows: [] }, { label: "Earlier", rows: [] },
    ];
    for (const c of rows) {
      if (c.pinned) { buckets[0].rows.push(c); continue; }
      const at = c.updated_at ? new Date(c.updated_at).getTime() : 0;
      if (at >= midnight.getTime()) buckets[1].rows.push(c);
      else if (at >= midnight.getTime() - day) buckets[2].rows.push(c);
      else buckets[3].rows.push(c);
    }
    return buckets.filter((b) => b.rows.length > 0);
  }, [history, search]);

  const empty = bubbles.length === 0 && !streaming && !pending;
  const view: "welcome" | "talk" | "voice" = voiceMode ? "voice" : empty ? "welcome" : "talk";

  /** Each segment goes somewhere real — see `ModeSwitch`. */
  function goTo(v: "welcome" | "talk" | "voice") {
    if (v === "welcome") { startNew(); return; }
    if (v === "voice") { setVoiceMode(true); listen(true); return; }
    setVoiceMode(false);
    // Starting cold, "In conversation" reopens the most recent thread rather
    // than showing an empty one.
    if (bubbles.length === 0 && history[0]) void openConversation(history[0].id);
  }

  const switcher = (
    <ModeSwitch value={view} onPick={goTo}
                canTalk={bubbles.length > 0 || history.length > 0}
                canVoice={canVoice} />
  );

  return (
    <HomeShell active="/app/sakhi" bare rail={
      <SakhiRail
        grouped={grouped} search={search} setSearch={setSearch}
        openConversation={openConversation} remove={remove}
        togglePin={togglePin} current={conversationId} total={history.length}
      />
    }>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt="" className="h-[42px] w-[42px] rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.25rem] font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>Ask Sakhi</h1>
            <p className="text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
              Tell her what you need, in your own words.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/saved"
                  className="ux-press flex min-h-[40px] items-center gap-2 rounded-[12px] px-3.5 text-[0.8125rem] font-bold"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
              <Icons.BookmarkCheck className="h-4 w-4" />
              Saved {saved.length > 0 && `(${saved.length})`}
            </Link>
            <button type="button" onClick={startNew}
                    className="ux-press flex min-h-[40px] items-center gap-2 rounded-[12px] px-3.5 text-[0.8125rem] font-bold"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
              <Icons.Plus className="h-4 w-4" /> New conversation
            </button>
          </div>
        </header>

        {!available && (
          <p className="rounded-[12px] p-3.5 text-[0.8125rem]"
             style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
            Sakhi is resting right now. Everything else in the app still works.
          </p>
        )}

        {voiceMode ? (
          <Voice
            heard={heard} listening={listening}
            onToggle={() => listen(true)} onEnd={() => { recogRef.current?.stop(); setVoiceMode(false); setHeard(""); }}
            locale={locale} setLocale={setLocale} localeItems={localeItems}
            showWords={showWords} onToggleWords={() => setShowWords((v) => !v)}
            switcher={switcher}
          />
        ) : empty ? (
          <Welcome first={first} onPick={ask} canVoice={canVoice} switcher={switcher}>
            <Composer
              value={draft} onChange={setDraft} onSend={() => ask(draft)}
              onMic={() => listen(false)} listening={listening} busy={busy}
              mode={mode} setMode={setMode} locale={locale} setLocale={setLocale} locales={localeItems}
              placeholder="Ask anything, or say what you need help with" canVoice={canVoice}
              file={file} onFile={setFile} onClearFile={() => setFile(null)}
            />
            <Disclosure text={disclosure} />
          </Welcome>
        ) : (
          <>
            <div className="pb-1">{switcher}</div>
            <ConvBar
              title={history.find((c) => c.id === conversationId)?.title || "New conversation"}
              mode={mode === "steps" ? "Step by step" : "Quick answer"}
              locale={localeItems.find((l) => l.value === locale)?.label ?? "English"}
              pinned={!!history.find((c) => c.id === conversationId)?.pinned}
              onRename={rename} onPin={() => conversationId && togglePin(conversationId)} onShare={share}
            />
            <Thread
              bubbles={bubbles} streaming={streaming} toolRunning={toolRunning}
              onStop={stop} onChangeDraft={(t) => setDraft(t)}
              pending={pending} onAnswer={answer} busy={busy}
              saved={saved} toggleSave={toggleSave}
              votes={votes}
              setVote={(i, v, id) => {
                // Tapping the same thumb again clears it, both here and on the server.
                const next = votes[i] === v ? null : v;
                setVotes((p) => ({ ...p, [i]: next as "up" | "down" }));
                void rate(id, next === null ? null : next === "up");
              }}
              onRetry={() => lastAsk.current && ask(lastAsk.current)}
              onFollowUp={ask}
            />
            {/* Not sticky. The app scrolls an inner container, and a
                `sticky bottom-0` child of it pinned the composer to the
                scrollport while `scrollIntoView` sent the thread above the
                fold — the messages were in the DOM and off screen. In normal
                flow the composer follows the last message, which is where a
                thread wants it anyway. */}
            <div ref={endRef} />
            <div>
              <Composer
                value={draft} onChange={setDraft} onSend={() => ask(draft)}
                onMic={() => listen(false)} listening={listening} busy={busy}
                mode={mode} setMode={setMode} locale={locale} setLocale={setLocale} locales={localeItems}
                placeholder="Ask a follow-up" canVoice={canVoice}
                file={file} onFile={setFile} onClearFile={() => setFile(null)}
              />
              <Disclosure text={disclosure} />
            </div>
          </>
        )}

        {error && (
          <p className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--ux-pink-ink)" }}>
            <Icons.TriangleAlert className="h-4 w-4" /> {error}
          </p>
        )}
      </div>
    </HomeShell>
  );
}

/* ── the conversation bar ───────────────────────────────────────────────── */

/**
 * What this thread is, and how it is being answered.
 *
 * The two chips repeat the composer's mode and language on purpose: down there
 * they are controls she is about to use, up here they are a statement about
 * every answer already on the screen. Scrolled halfway through a long thread,
 * the composer is off screen and the question "why is this in English?" has
 * nowhere to be answered.
 */

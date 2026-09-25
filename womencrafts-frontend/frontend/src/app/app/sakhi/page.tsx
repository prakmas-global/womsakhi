"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/components/ux/copy";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useI18n, LOCALES, useT } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { MODE_PREFIX } from "@/components/ux/sakhi/prompts";
import { ConvBar, Disclosure, SakhiRail, Thread, Voice, Welcome, type Bubble } from "./views";
import { Composer, ModeSwitch } from "@/components/ux/sakhi/parts";
import { ChatDock, ChatFrame, ChatLog, JumpToLatest, useChatScroll } from "@/components/ux/sakhi/chat";
import { PhoneComposer } from "@/components/ux/sakhi/parts";
import { Sheet } from "@/components/ux/kit/sheet";
import { Btn } from "@/components/ux/kit";
import { useToast } from "@/design-system/feedback/ToastProvider";
import styles from "./sakhi.module.css";
import { SPEECH_UNSUPPORTED, speechFailure, speechSupported, type SpeechFailure } from "@/lib/speech";
import { apiSakhiConversation, apiSakhiConversations, apiSakhiDelete, apiSakhiPin, apiSakhiRate, apiSakhiRename, apiSakhiSave, apiSakhiSaved, apiSakhiStatus, apiSakhiUnsave, sakhiChat, type SakhiSaved, sakhiConfirm, type Helpline, type SakhiConversation, type SakhiEvent } from "@/lib/sakhi-api";

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
  const tr = useT();
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
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [renameTo, setRenameTo] = useState("");
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
    } catch { setError(COPY.threadFailed); }
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

  /**
   * Naming a conversation, in the app rather than in the browser.
   *
   * This was `window.prompt()`. Three things were wrong with that and only one
   * of them is cosmetic: it blocks the main thread, it appears in the browser's
   * language rather than the one she chose, and on most Android browsers it
   * renders as a system dialog with the URL bar's origin at the top — which
   * looks, to a woman new to a smartphone, like a different program asking her
   * for something.
   */
  function rename() {
    if (!conversationId) return;
    setRenameTo(history.find((c) => c.id === conversationId)?.title ?? "");
    setRenaming(true);
  }

  async function saveRename() {
    const title = renameTo.trim();
    if (!conversationId || !title) return;
    setRenaming(false);
    try {
      await apiSakhiRename(conversationId, title);
      toast.success("Conversation renamed");
    } catch { setError("That could not be renamed."); }
    void loadHistory();
  }

  async function share() {
    const url = `${window.location.origin}/app/sakhi`;
    try {
      if (navigator.share) await navigator.share({ title: tr("nav.sakhi"), url });
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
  /*
    Read in an EFFECT, not during render.

    `typeof window === "undefined"` is the exact server/client branch React
    warns about: the server answers false, Chrome answers true, and the two
    renders disagree over one word — the sentence says "ask." on the server and
    "ask or speak." on the client. React logged a hydration mismatch on every
    visit to this screen because of it.

    `useState(false)` plus an effect means the first client render matches the
    server by construction, and the microphone appears on the render after,
    which nobody can perceive.
  */
  const [canVoice, setCanVoice] = useState(false);
  useEffect(() => { setCanVoice(speechSupported()); }, []);

  /**
   * Say why the microphone stopped.
   *
   * `onerror` used to be `() => setListening(false)` — the mic lit up, went
   * dark, and she was told nothing at all. On this screen above all others
   * that is the wrong silence: a woman pressing the mic is frequently doing it
   * because typing is the hard part, so "nothing happened" reads as "this app
   * is broken" and she stops. The overwhelmingly common cause is a permission
   * she could grant in two taps if anyone told her it was the problem.
   */
  const sayWhy = useCallback((f: SpeechFailure | null) => {
    if (!f) return;   // `aborted` — she pressed stop. Nothing to report.
    const opts = { description: f.description };
    if (f.tone === "danger") toast.error(f.title, opts);
    else if (f.tone === "warn") toast.warn(f.title, opts);
    else toast.info(f.title, opts);
  }, [toast]);

  const listen = useCallback((intoVoiceMode: boolean) => {
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const W = window as unknown as Record<string, new () => never>;
    const Ctor = (W.SpeechRecognition || W.webkitSpeechRecognition) as unknown as
      (new () => {
        lang: string; interimResults: boolean; continuous: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void; onerror: (e: { error?: string }) => void;
        start: () => void; stop: () => void;
      }) | undefined;
    // The mic is not drawn where `canVoice` is false, so this is the backstop
    // for anything that reaches here anyway rather than the path she takes.
    if (!Ctor) { sayWhy(SPEECH_UNSUPPORTED); return; }

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
    r.onerror = (e) => { setListening(false); recogRef.current = null; sayWhy(speechFailure(e?.error)); };
    recogRef.current = r;
    setListening(true);
    /*
      `start()` throws, and throwing here left her with a mic stuck lit.
      Chrome raises InvalidStateError when a recognition is already running —
      which happens on a double tap, and after an `onend` that never arrived
      because the tab was backgrounded mid-sentence. It also throws outright on
      an insecure origin, where no `onerror` is ever delivered to explain it.
    */
    try {
      r.start();
    } catch {
      setListening(false);
      recogRef.current = null;
      sayWhy(speechFailure("unknown"));
    }
  }, [ask, listening, locale, sayWhy]);

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

  /**
   * The thread follows the newest answer, and stops following the moment she
   * scrolls up to read an older one. The signal changes on every streamed
   * token, which is what keeps a long answer scrolling into view as it is
   * written rather than growing quietly below the fold.
   */
  const scroll = useChatScroll(`${conversationId ?? "new"}:${bubbles.length}:${streaming.length}:${busy ? 1 : 0}`);

  const switcher = (
    <ModeSwitch value={view} onPick={goTo}
                canTalk={bubbles.length > 0 || history.length > 0}
                canVoice={canVoice} />
  );

  return (
    <HomeShell active="/app/sakhi" bare rail={
      <div className={styles.railScope}><SakhiRail
          grouped={grouped} search={search} setSearch={setSearch}
          openConversation={openConversation} remove={remove}
          togglePin={togglePin} current={conversationId} total={history.length}
        /></div>
    }>
      {/*
        `ChatFrame` is a plain `flex flex-col` above `lg` — the div that used to
        be here — and below it a fixed panel that ends where the on-screen
        keyboard begins. That is the whole point: this screen used to scroll as
        one long page with the composer at the end of it, so tapping the field
        put the keyboard over the thing she had just tapped.
      */}
      <ChatFrame label={tr("nav.sakhi")} className={`${styles.page} flex flex-col gap-3 lg:gap-4`}>
        <header data-sakhi-header className="flex shrink-0 items-center gap-2.5 border-b pb-2.5 lg:flex-wrap lg:gap-3 lg:border-0 lg:pb-0"
                style={{ borderColor: "var(--ux-line)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/sakhi-face.webp" alt=""
               className="h-[38px] w-[38px] shrink-0 rounded-full object-cover lg:h-[42px] lg:w-[42px]" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-bold tracking-tight lg:text-xl" style={{ color: "var(--ux-ink)" }}>{tr("sakhi.askSakhi")}</h1>
            <p className="truncate text-[13px] lg:text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("sakhi.tellHerWhatYouNeedIn")}</p>
          </div>
          {/*
            Two icon buttons on a phone, two labelled buttons from `lg`. A
            390px header cannot carry "Saved (2)" and "New conversation" as
            words without wrapping onto a second row — which it did.
          */}
          <div className="flex shrink-0 gap-1 lg:gap-2">
            {/* The bordered pill is a desktop shape: at 390px two of them with
                their words wrapped the header onto a second row. Below `lg` they
                are 44px icon buttons; from `lg` they are exactly the buttons
                that were here before, chrome included. */}
            <Link href="/app/saved" aria-label={`Saved${saved.length > 0 ? ` (${saved.length})` : ""}`}
                  className="ux-press flex h-[44px] w-[44px] items-center justify-center gap-2 rounded-full text-xsm font-bold
                             lg:h-auto lg:min-h-[40px] lg:w-auto lg:rounded-[12px] lg:border lg:border-[var(--ux-line-strong)]
                             lg:bg-[var(--ux-surface)] lg:px-3.5"
                  style={{ color: "var(--ux-ink)" }}>
              <Icons.BookmarkCheck className="h-[20px] w-[20px] lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">Saved {saved.length > 0 && `(${saved.length})`}</span>
            </Link>
            <button type="button" onClick={startNew} aria-label={tr("sakhi.newConversation")}
                    className="ux-press flex h-[44px] w-[44px] items-center justify-center gap-2 rounded-full text-xsm font-bold
                               lg:h-auto lg:min-h-[40px] lg:w-auto lg:rounded-[12px] lg:border lg:border-[var(--ux-line-strong)]
                               lg:bg-[var(--ux-surface)] lg:px-3.5"
                    style={{ color: "var(--ux-ink)" }}>
              <Icons.Plus className="h-[22px] w-[22px] lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">{tr("sakhi.newConversation")}</span>
            </button>
          </div>
        </header>

        {!available && (
          <p className="shrink-0 rounded-[12px] p-3.5 text-[15px] leading-snug lg:text-xsm"
             style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>{tr("sakhi.sakhiIsRestingRightNowEverything")}</p>
        )}

        {/*
          The thread is its own scrollport on a phone and a plain block on
          desktop, so the desktop page keeps scrolling exactly as it did while
          the phone keeps its header and its composer nailed down.
        */}
        <ChatLog scroll={scroll} label={tr("sakhi.yourConversationWithSakhi")}
                 className={`${styles.chatLog} flex flex-col gap-4 lg:contents`}>
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
                placeholder={tr("sakhi.askAnythingOrSayWhatYou")} canVoice={canVoice}
                file={file} onFile={setFile} onClearFile={() => setFile(null)}
              />
              <Disclosure text={disclosure} />
            </Welcome>
          ) : (
            <>
              <div className="pb-1">{switcher}</div>
              <ConvBar
                title={history.find((c) => c.id === conversationId)?.title || "New conversation"}
                mode={mode === "steps" ? tr("sakhi.stepByStep")
                : tr("sakhi.quickAnswer")}
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
            </>
          )}
        </ChatLog>

        {/*
          The dock. On a phone it holds the composer for every view except
          voice, which has a microphone of its own; on desktop it holds the
          talk-mode composer in the same place it has always been — after the
          thread — and nothing at all in welcome mode, where the composer is
          inside the welcome card.
        */}
        {!voiceMode && (
          <ChatDock>
            <JumpToLatest scroll={scroll} label="Latest" />
            <div className="lg:hidden">
              <PhoneComposer
                value={draft} onChange={setDraft} onSend={() => ask(draft)}
                onMic={() => listen(false)} listening={listening} busy={busy}
                mode={mode} setMode={setMode} locale={locale} setLocale={setLocale} locales={localeItems}
                /* Short enough to sit on one line. Chrome sizes a textarea's
                   `scrollHeight` around its placeholder, so the long desktop
                   string made the empty field render three rows tall. */
                placeholder={empty ? "Ask anything…" : "Ask a follow-up…"}
                canVoice={canVoice}
                file={file} onFile={setFile} onClearFile={() => setFile(null)}
              />
              <div className="ux-chat-tip pb-1"><Disclosure text={disclosure} /></div>
            </div>
            {!empty && (
              <div className="hidden lg:block">
                <Composer
                  value={draft} onChange={setDraft} onSend={() => ask(draft)}
                  onMic={() => listen(false)} listening={listening} busy={busy}
                  mode={mode} setMode={setMode} locale={locale} setLocale={setLocale} locales={localeItems}
                  placeholder={tr("sakhi.askAFollowUp")} canVoice={canVoice}
                  file={file} onFile={setFile} onClearFile={() => setFile(null)}
                />
                <Disclosure text={disclosure} />
              </div>
            )}
          </ChatDock>
        )}

        {error && (
          <p className="flex shrink-0 items-center gap-2 pb-1 text-[13px] lg:text-xsm" style={{ color: "var(--ux-pink-ink)" }}>
            <Icons.TriangleAlert className="h-4 w-4" /> {error}
          </p>
        )}

        <Sheet
          open={renaming}
          onClose={() => setRenaming(false)}
          title={tr("sakhi.nameThisConversation")}
          description={tr("sakhi.soYouCanFindItAgain")}
          icon="Pencil"
          footer={
            <div className="flex gap-2.5">
              <Btn variant="outline" full onClick={() => setRenaming(false)}>Cancel</Btn>
              <Btn full disabled={!renameTo.trim()} onClick={saveRename}>{tr("sakhi.saveTheName")}</Btn>
            </div>
          }
        >
          <label className="block text-xsm font-semibold" htmlFor="sakhi-rename"
                 style={{ color: "var(--ux-ink)" }}>
            Name
          </label>
          <input
            id="sakhi-rename"
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && renameTo.trim()) void saveRename(); }}
            maxLength={80}
            autoComplete="off"
            className="mt-2 w-full rounded-[12px] px-3.5 py-3 text-[17px] lg:text-sm"
            style={{
              background: "var(--ux-surface-2)",
              color: "var(--ux-ink)",
              border: "1px solid var(--ux-line-strong)",
            }}
          />
        </Sheet>
      </ChatFrame>
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

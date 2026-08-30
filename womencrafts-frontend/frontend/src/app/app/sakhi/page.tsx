"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";

import { useT } from "@/i18n";
import { Btn, Card, Chip, I, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  apiSakhiConversation,
  apiSakhiConversations,
  apiSakhiDelete,
  apiSakhiStatus,
  sakhiChat,
  sakhiConfirm,
  type Helpline,
  type SakhiConversation,
  type SakhiEvent,
} from "@/lib/sakhi-api";

/**
 * Sakhi, on her phone.
 *
 * Three things on this screen are deliberate and worth not undoing.
 *
 * **The confirmation is a card, not a dialog.** A dialog on a phone covers the
 * conversation it is asking about, so she has to remember what she asked while
 * deciding whether to allow it. The card sits in the thread with the sentence
 * the server built from the database, and both buttons are the same size —
 * "no" is not a smaller, greyer afterthought.
 *
 * **The safety reply looks nothing like Sakhi.** When the gate fires, the
 * answer renders as a bordered panel with tappable phone numbers, not as a chat
 * bubble. She should be able to tell at a glance that this is not the assistant
 * talking.
 *
 * **The disclosure is always visible**, not behind an info icon.
 */

type Bubble =
  | { kind: "user" | "assistant"; text: string }
  | { kind: "action"; text: string; ok: boolean }
  | { kind: "safety"; text: string; helplines: Helpline[] };

export default function SakhiPage() {
  const t = useT();

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [toolRunning, setToolRunning] = useState(false);
  const [pending, setPending] = useState<{ id: string; sentence: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<SakhiConversation[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const status = await apiSakhiStatus();
        setAvailable(status.enabled);
      } catch {
        setAvailable(false);
      }
    })();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await apiSakhiConversations());
    } catch {
      /* the list is a convenience; a failure here must not block the chat */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles.length, streaming, pending]);

  /** One place that turns a stream of events into what she sees. */
  const consume = useCallback(
    (event: SakhiEvent, buffer: { text: string }) => {
      switch (event.type) {
        case "text":
          buffer.text += event.text;
          setStreaming(buffer.text);
          break;
        case "tool":
          setToolRunning(true);
          break;
        case "safety":
          setBubbles((prev) => [
            ...prev,
            { kind: "safety", text: event.text, helplines: event.helplines },
          ]);
          break;
        case "confirm":
          setConversationId(event.conversation_id);
          setPending({ id: event.action_id, sentence: event.sentence });
          break;
        case "action":
          setBubbles((prev) => [...prev, { kind: "action", text: event.text, ok: event.ok }]);
          break;
        case "error":
          setError(event.message);
          break;
        case "done": {
          if (event.conversation_id) setConversationId(event.conversation_id);
          // Read the buffer into a local BEFORE clearing it. A state updater is
          // a closure React runs at render time, so `{ text: buffer.text }`
          // written inside it would read the buffer *after* the reset below —
          // which showed the answer while it streamed and then blanked the
          // bubble the moment the stream closed.
          const finished = buffer.text;
          buffer.text = "";
          if (finished.trim()) {
            setBubbles((prev) => [...prev, { kind: "assistant", text: finished }]);
          }
          setStreaming("");
          setToolRunning(false);
          break;
        }
      }
    },
    [],
  );

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setBubbles((prev) => [...prev, { kind: "user", text: message }]);
    setDraft("");
    setError("");
    setBusy(true);

    const buffer = { text: "" };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sakhiChat(message, conversationId, (e) => consume(e, buffer), controller.signal);
    } catch (err) {
      // An abort is her pressing stop, not a failure.
      if (!controller.signal.aborted) setError(String(err));
    } finally {
      setBusy(false);
      setStreaming("");
      setToolRunning(false);
      abortRef.current = null;
      void loadHistory();
    }
  }

  async function answer(approve: boolean) {
    if (!pending || !conversationId) return;
    const action = pending;
    setPending(null);
    setBusy(true);

    const buffer = { text: "" };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sakhiConfirm(
        conversationId,
        action.id,
        approve,
        (e) => consume(e, buffer),
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function openConversation(id: string) {
    try {
      const detail = await apiSakhiConversation(id);
      setConversationId(detail.id);
      setBubbles(
        detail.messages.map((m) =>
          m.kind === "safety"
            ? {
                kind: "safety" as const,
                text: m.text,
                helplines: (m.meta?.helplines as Helpline[]) ?? [],
              }
            : m.kind === "action"
              ? { kind: "action" as const, text: m.text, ok: m.meta?.ok !== false }
              : { kind: m.kind as "user" | "assistant", text: m.text },
        ),
      );
      setPending(
        detail.pending_action
          ? { id: detail.pending_action.id, sentence: detail.pending_action.sentence }
          : null,
      );
    } catch {
      setError(t("common.retry"));
    }
  }

  async function remove(id: string) {
    try {
      await apiSakhiDelete(id);
      if (id === conversationId) startNew();
      void loadHistory();
    } catch {
      /* ignored — the list refreshes on the next turn anyway */
    }
  }

  function startNew() {
    setConversationId(null);
    setBubbles([]);
    setPending(null);
    setStreaming("");
    setError("");
  }

  const suggestions = [t("sakhi.suggest1"), t("sakhi.suggest2"), t("sakhi.suggest3")];

  return (
    <HomeShell
      skeleton="detail"
      loadFailed="Sakhi"
      bare
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="What she can do" icon="Sparkles" />
            <ul className="space-y-2.5">
              {[
                ["Search", "Find a course, a scheme or work in your own words"],
                ["Wallet", "Tell you what you have earned and what is still coming"],
                ["CalendarDays", "Remind you what is booked this week"],
                ["FileText", "Explain a form before you sign it"],
              ].map(([icon, what]) => (
                <li key={what} className="flex items-start gap-2.5">
                  <I name={icon} className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                  <span className="text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{what}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title="What she will not do" icon="Lock" />
            {/* The limits, before she finds them by being disappointed. */}
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              She never moves money, never applies for anything and never sends a message as you — not
              without asking you first, in a sentence you can read, with the same-sized button for no.
            </p>
          </Card>

          {history.length > 0 && (
            <Card>
              <SectionHead title={t("sakhi.history")} />
              <ul className="ux-deck space-y-2">
                {history.slice(0, 8).map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openConversation(c.id)}
                      className="ux-i ux-sq min-w-0 flex-1 truncate rounded-[11px] border px-3 py-2 text-start text-[12.5px]"
                      style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink-2)", ["--i" as string]: i }}
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      aria-label={t("sakhi.deleteChat")}
                      className="ux-press ux-sq grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border"
                      style={{ borderColor: "var(--ux-line)" }}
                    >
                      <Icons.Trash2 className="h-[14px] w-[14px]" style={{ color: "var(--ux-muted)" }} strokeWidth={1.9} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="ux-sq grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px]"
                style={{ background: "var(--ux-brand-tint)" }}>
            <Icons.Sparkles className="h-[24px] w-[24px]" style={{ color: "var(--ux-brand)" }} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>{t("sakhi.title")}</h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>{t("sakhi.subtitle")}</p>
          </div>
        </div>
        <Btn variant="outline" size="sm" icon="Plus" onClick={startNew}>{t("sakhi.newChat")}</Btn>
      </div>

      {/* Always on screen, never behind an icon. */}
      <p className="ux-sq mt-4 rounded-[12px] px-3.5 py-2.5 text-[12px] leading-relaxed"
         style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
        {t("sakhi.disclosure")}
      </p>

      {!available && (
        <Card className="mt-3">
          <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{t("sakhi.unavailable")}</p>
        </Card>
      )}

      <div className="mt-[18px] flex-1 space-y-3" aria-live="polite">
        {bubbles.length === 0 && !streaming && (
          <Card>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{t("sakhi.empty")}</p>
            <ul className="mt-3.5 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <Chip onClick={() => void ask(s)} icon="MessageCircle">{s}</Chip>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {bubbles.map((bubble, i) => (
          <BubbleView key={i} bubble={bubble} callLabel={(n) => t("sakhi.callNow", { number: n })}
                      safetyTitle={t("sakhi.safetyTitle")} />
        ))}

        {toolRunning && !streaming && (
          <p className="flex items-center gap-2 px-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
            <Icons.Search className="h-[14px] w-[14px] animate-pulse" />
            {t("sakhi.working")}
          </p>
        )}

        {streaming && <BubbleView bubble={{ kind: "assistant", text: streaming }}
                                  callLabel={(n) => n} safetyTitle="" />}

        {busy && !streaming && !toolRunning && (
          <p className="flex items-center gap-2 px-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
            <Icons.Loader2 className="h-[14px] w-[14px] animate-spin" />
            {t("sakhi.thinking")}
          </p>
        )}

        {pending && (
          <div data-sakhi="confirm" className="ux-slide-up">
            <Card style={{ borderColor: "var(--ux-brand)", borderWidth: 2 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--ux-muted)" }}>
                {t("sakhi.confirmTitle")}
              </p>
              <p className="mt-2 text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                {pending.sentence}
              </p>
              {/* Same size, same weight. Declining is not the lesser option. */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <Btn variant="primary" full onClick={() => void answer(true)}>{t("sakhi.confirmYes")}</Btn>
                <Btn variant="outline" full onClick={() => void answer(false)}>{t("sakhi.confirmNo")}</Btn>
              </div>
            </Card>
          </div>
        )}

        {error && (
          <p className="ux-sq rounded-[12px] px-3.5 py-2.5 text-[13px]"
             style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
            {error}
          </p>
        )}

        <div ref={endRef} />
      </div>

      {/* The composer. Sticky so it stays reachable with one thumb. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        data-sakhi={busy ? "composer-busy" : "composer-idle"}
        className="ux-sheet ux-sq sticky bottom-4 mt-4 flex items-end gap-2 rounded-[16px] p-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line. On a phone the button
            // is the real control, so this only helps a keyboard user.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          rows={1}
          disabled={!available || !!pending}
          placeholder={t("sakhi.placeholder")}
          className="ux-sq max-h-32 min-h-[44px] flex-1 resize-y rounded-[12px] border px-3.5 py-2.5 text-[13.5px] outline-none disabled:opacity-60"
          style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
        />
        {busy ? (
          <Btn variant="outline" onClick={stop} ariaLabel={t("sakhi.stop")} className="h-[44px] w-[44px] !p-0">
            <Icons.Square className="h-[15px] w-[15px]" />
          </Btn>
        ) : (
          <Btn
            variant="primary"
            type="submit"
            ariaLabel={t("sakhi.send")}
            className={`h-[44px] w-[44px] !p-0 ${!draft.trim() || !available || !!pending ? "pointer-events-none opacity-50" : ""}`}
          >
            <Icons.Send className="h-[15px] w-[15px] rtl:rotate-180" />
          </Btn>
        )}
      </form>
    </HomeShell>
  );
}

function BubbleView({
  bubble,
  callLabel,
  safetyTitle,
}: {
  bubble: Bubble;
  callLabel: (n: string) => string;
  safetyTitle: string;
}) {
  if (bubble.kind === "user") {
    return (
      <div className="flex justify-end" data-sakhi="user">
        {/* --ux-fill, not the brand accent: white on the accent is 3.89:1 in
            dark mode, and this bubble is nothing but white text. */}
        <p className="ux-sq max-w-[85%] whitespace-pre-wrap rounded-[16px] rounded-br-[6px] px-4 py-2.5 text-[13.5px] leading-relaxed"
           style={{ background: "var(--ux-fill)", color: "#fff" }}>
          {bubble.text}
        </p>
      </div>
    );
  }

  if (bubble.kind === "safety") {
    // Deliberately unlike a chat bubble — this is the app speaking, not Sakhi.
    return (
      <div data-sakhi="safety" className="ux-slide-up">
        <Card style={{ borderColor: "var(--ux-orange)", borderWidth: 2 }}>
          <p className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: "var(--ux-orange-ink)" }}>
            <Icons.ShieldAlert className="h-[16px] w-[16px]" />
            {safetyTitle}
          </p>
          <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: "var(--ux-ink)" }}>
            {bubble.text}
          </p>
          <ul className="mt-3.5 space-y-2">
            {bubble.helplines.map((h) => (
              <li key={h.number}>
                {/* A real tel: link. On a phone this dials. */}
                <a href={`tel:${h.number}`}
                   className="ux-press ux-sq flex w-full items-center gap-2.5 rounded-[12px] px-3.5 py-3 text-[13.5px] font-semibold"
                   style={{ background: "var(--ux-fill)", color: "#fff" }}>
                  <Icons.Phone className="h-[16px] w-[16px]" />
                  {callLabel(h.number)} · {h.name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  if (bubble.kind === "action") {
    return (
      <p
        data-sakhi="action"
        className="ux-sq ux-slide-up rounded-[12px] px-3.5 py-2.5 text-[13px]"
        style={{
          background: bubble.ok ? "var(--ux-tint-green)" : "var(--ux-tint-orange)",
          color: bubble.ok ? "var(--ux-green-ink)" : "var(--ux-orange-ink)",
        }}
      >
        {bubble.text}
      </p>
    );
  }

  return (
    <div className="flex justify-start" data-sakhi="assistant">
      <p className="ux-sq max-w-[85%] whitespace-pre-wrap rounded-[16px] rounded-bl-[6px] border px-4 py-2.5 text-[13.5px] leading-relaxed"
         style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)", color: "var(--ux-ink)" }}>
        {bubble.text}
      </p>
    </div>
  );
}

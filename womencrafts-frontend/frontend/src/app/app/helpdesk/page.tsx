"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Headphones, MessageCircle, RotateCw, ShieldAlert } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  bubbleRadius, ChatDock, ChatFrame, ChatInput, ChatLog, DayMark, JumpToLatest, Says, SendButton, Stamp, useChatScroll,
} from "@/components/ux/sakhi/chat";
import { apiMyMessages, apiSendMessage, type MemberMessage } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useToast } from "@/design-system";

/**
 * Help desk — her one thread with the WomSakhi team, as a conversation.
 *
 * It was two cards: a list of bubbles, and under it a separate form with a
 * textarea and a "Send to support" button. That reads as filing a ticket, not
 * talking to someone, and the reply she was waiting for sat in a different box
 * from the place she wrote. Now it is the same chat panel Messages uses: the
 * team on the left with the WomSakhi mark, her on the right, days marked, and
 * the composer docked at the bottom.
 *
 * ── The limit is 2,000, not 4,000 ───────────────────────────────────────────
 * `SendMessageRequest` in the API's `schemas/me.py` cuts a help-desk message
 * at 2,000 characters without saying so. A counter that allowed 4,000 would
 * let her write words the team never receives, so the composer stops at what
 * the server keeps.
 */

const HELP_MAX = 4000;
const COUNT_FROM = 1500;

/** The server's time is naive UTC; read it as UTC, not local. */
function when(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

function dayLabel(iso: string): string {
  const d = when(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((mid(new Date()) - mid(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" }).format(d);
}

function clock(iso: string): string {
  const d = when(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function TeamFace({ size = 26 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/womsakhi-emblem.webp" alt="" width={size} height={size}
         className="block shrink-0 rounded-full object-contain"
         style={{ width: size, height: size, padding: 3, background: "var(--ux-surface)", boxShadow: "0 0 0 1px var(--ux-line-strong)" }} />
  );
}

export default function HelpdeskPage() {
  const toast = useToast();
  const { data: messages, source, error, refetch } = useResource(
    useCallback(() => apiMyMessages(), []), [] as MemberMessage[],
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scroll = useChatScroll(`help:${messages.length}`);

  async function send() {
    const words = body.trim();
    if (!words || sending) return;
    if (words.length > HELP_MAX) { toast.error(`A message can be up to ${HELP_MAX} characters`); return; }
    setSending(true);
    try {
      await apiSendMessage(words);
      setBody("");
      await refetch();
    } catch {
      toast.error("Your message was not sent", { description: "Your words are still here. Check your connection and try again." });
    } finally { setSending(false); }
  }

  const count = body.length;

  return (
    <HomeShell active="/app/helpdesk" bare>
      {/* The floating "Ask Sakhi" button sits bottom-right, where a narrower
          window puts this panel's Send button. A conversation screen does
          not need a second assistant floating over its composer. */}
      <style href="ux-helpdesk-float" precedence="ux-mobile">
        {`.ux:has([data-helpdesk]) [data-float="sakhi"] { display: none !important; }`}
      </style>
      <div data-helpdesk className="mx-auto flex w-full max-w-[880px] flex-col"
           style={{ height: "calc(100dvh - var(--ux-topbar-h) - 36px)" }}>
        <ChatFrame label="Your conversation with the WomSakhi team"
                   className="ux-sq flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--ux-surface)]
                              lg:rounded-[20px] lg:border lg:border-[var(--ux-line-strong)] lg:shadow-[var(--ux-shadow-card)]">
          <header className="flex shrink-0 items-center gap-3 border-b px-3 py-2.5 lg:px-5 lg:py-4"
                  style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
            <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full lg:h-[44px] lg:w-[44px]"
                  style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
              <Headphones className="h-[20px] w-[20px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="ux-screen-title truncate text-[17px] font-bold leading-tight lg:text-xl" style={{ color: "var(--ux-ink)" }}>
                Help desk
              </h1>
              <p className="mt-0.5 truncate text-[13px] lg:text-xsm" style={{ color: "var(--ux-muted)" }}>
                The WomSakhi team · a person replies here
              </p>
            </div>
            <Link href="/app/safety" title="In danger? Open the Safety centre"
                  aria-label="In danger? Open the Safety centre"
                  className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full lg:h-[38px] lg:w-[38px] lg:rounded-[12px]"
                  style={{ color: "var(--ux-pink-ink)" }}>
              <ShieldAlert className="h-[19px] w-[19px]" />
            </Link>
          </header>

          <ChatLog scroll={scroll} label="Messages with the WomSakhi team"
                   className="min-h-0 flex-1 overflow-y-auto bg-[var(--ux-surface-2)] px-3 py-2 lg:px-5 lg:py-4">
            <div className="flex min-h-full flex-col justify-end">
              {source === "loading" ? (
                <p role="status" className="py-8 text-center text-sm" style={{ color: "var(--ux-muted)" }}>Opening your support thread…</p>
              ) : error ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Your support thread did not load</p>
                  <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>Check your connection and try again.</p>
                  <button type="button" onClick={() => void refetch()} title="Try again"
                          className="ux-press mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[14px] font-bold"
                          style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                    <RotateCw className="h-4 w-4" /> Try again
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-end gap-2 py-4">
                  <TeamFace />
                  <div className="max-w-[82%] px-3.5 py-2.5 text-[15px] leading-[1.45] lg:max-w-[70%] lg:text-sm"
                       style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)",
                                borderRadius: bubbleRadius("in", true) }}>
                    <MessageCircle className="mb-1 h-4 w-4" style={{ color: "var(--ux-brand)" }} aria-hidden />
                    Namaste. Tell us what you need — money, work, safety, the app, or anything else.
                    You do not need to choose a category. A person from the team replies in this thread.
                  </div>
                </div>
              ) : (
                <ol aria-label="Support messages">
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const mine = m.sender === "member";
                    const day = dayLabel(m.sent_at);
                    const newDay = !prev || dayLabel(prev.sent_at) !== day;
                    const first = newDay || prev?.sender !== m.sender;
                    return (
                      <li key={m.id}>
                        {newDay && day && <DayMark>{day}</DayMark>}
                        <div className={`flex items-end gap-2 ${first ? "mt-2" : "mt-[3px]"} ${mine ? "flex-row-reverse" : ""}`}>
                          <span className="w-[26px] shrink-0" style={{ visibility: first && !mine ? "visible" : "hidden" }}>
                            <TeamFace />
                          </span>
                          <div className="max-w-[82%] px-3.5 py-2.5 text-[15px] leading-[1.45] lg:max-w-[70%] lg:text-sm"
                               style={mine
                                 ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)",
                                     borderRadius: bubbleRadius("out", first) }
                                 : { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)",
                                     borderRadius: bubbleRadius("in", first) }}>
                            <Says who={mine ? "You" : m.sender_name || "WomSakhi team"} />
                            {!mine && first && (
                              <span className="mb-0.5 block text-[12px] font-bold" style={{ color: "var(--ux-brand)" }}>
                                {m.sender_name || "WomSakhi team"}
                              </span>
                            )}
                            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</span>
                            <span className={`mt-1 flex ${mine ? "justify-end" : ""}`}>
                              <Stamp tone={mine ? "on-brand" : "muted"}>{clock(m.sent_at) || m.sent_label}</Stamp>
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </ChatLog>

          <ChatDock className="lg:border-t lg:border-[var(--ux-line-strong)] lg:px-5 lg:pb-4 lg:pt-3">
            <JumpToLatest scroll={scroll} label="Latest" />
            {count >= COUNT_FROM && (
              <p className="px-1 pt-1.5 text-end text-[12px] font-semibold tabular-nums lg:px-0" aria-live="polite" data-char-count
                 style={{ color: count >= HELP_MAX ? "var(--ux-pink-ink)" : "var(--ux-muted)" }}>
                {count.toLocaleString("en-IN")} / {HELP_MAX.toLocaleString("en-IN")}
              </p>
            )}
            <div className="flex items-end gap-1.5 pb-2 pt-2 lg:gap-2 lg:pb-0 lg:pt-0">
              <div className="ux-comp min-w-0 flex-1 rounded-[24px] px-3.5 py-2.5"
                   style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
                <ChatInput value={body} onChange={(v) => setBody(v.slice(0, HELP_MAX))} onSend={() => void send()}
                           placeholder="Tell us what happened and what would help…"
                           label="Write to the WomSakhi team" maxLength={HELP_MAX} />
              </div>
              <span title="Send to the team" className="inline-flex shrink-0">
                <SendButton onClick={() => void send()} disabled={!body.trim() || sending} busy={sending} label="Send to the team" />
              </span>
            </div>
            <p className="ux-chat-tip pb-2 text-[12px] leading-snug lg:pb-0 lg:pt-2.5" style={{ color: "var(--ux-muted)" }}>
              For immediate danger, call 112 or open the Safety centre.
            </p>
          </ChatDock>
        </ChatFrame>
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

import { apiMyMessages, apiSendMessage, type MemberMessage } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "lucide-react";

import { Btn, Card, EmptyState, Pill, plural } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";


type Thread = {
  id: string; who: string; role: string; avatar: string; last: string;
  when: string; unread: number; kind: "Buyer" | "Mentor" | "Circle" | "Employer";
  messages: { id: string; from: "them" | "me"; text: string; at: string }[];
};

/**
 * Messages — buyers, mentors, circles and employers, in one place.
 *
 * The role beside a name is not decoration. "Anjali Mehta" alone tells her
 * nothing about whether this is a customer waiting on an order or a stranger,
 * and the answer changes how fast she needs to reply.
 */

const TONE: Record<Thread["kind"], "brand" | "orange" | "green" | "blue"> = {
  Buyer: "green", Mentor: "orange", Circle: "brand", Employer: "blue",
};

export default function MessagesPage() {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Her conversation with WomSakhi.
   *
   * **There was an inbox here with four threads in it**, all invented: a buyer
   * called Anjali Mehta asking for two inches at the back of a kurta she never
   * ordered, a mentor, a savings circle, and an employer. Typing a reply
   * appended it to a local array. A woman answering "Anjali" was writing to
   * nobody.
   *
   * The server has one member conversation — hers with us — and that is what
   * this shows. Talk in a circle lives on the circle, and a mentor
   * conversation follows a request, so this screen points at both rather than
   * pretending to contain them.
   */
  const { data: msgs, refetch } = useResource(
    useCallback(() => apiMyMessages(), []),
    [] as MemberMessage[],
  );

  const THREADS: Thread[] = [{
    id: "womsakhi",
    who: "WomSakhi",
    role: "The people who build this",
    avatar: "",
    last: msgs.length ? msgs[msgs.length - 1].body : "Ask us anything — somebody reads every message.",
    when: msgs.length ? msgs[msgs.length - 1].sent_label : "",
    unread: 0,
    kind: "Mentor",
    messages: msgs.map((m) => ({
      id: m.id,
      from: m.sender === "member" ? ("me" as const) : ("them" as const),
      text: m.body,
      at: m.sent_label,
    })),
  }];

  const shown = THREADS;
  const open = THREADS[0];
  const totalUnread = 0;
  const messages = open.messages;

  const send = useAction(
    async () => {
      const text = draft.trim();
      if (!text) return;
      await apiSendMessage(text);
      setDraft("");
    },
    {
      onDone: () => { refetch(); inputRef.current?.focus(); },
      fallbackError: "That did not send. Your words are still in the box — try again in a moment.",
    },
  );

  return (
    <HomeShell active="/app/messages">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Messages</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {totalUnread
              ? `${totalUnread} unread ${plural("message", totalUnread)}`
              : "You are up to date."}
          </p>
        </div>
        {/* Tabs for Buyer and Mentor filtered a list of invented threads.
            With one real conversation there is nothing to filter, so they are
            gone rather than sitting there doing nothing. */}
      </div>

      {/* Two columns: the list stays put while a conversation is read, so she
          never loses her place going back and forth. */}
      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-[15px]">
        <Card pad={0} className="overflow-hidden">
          {shown.length ? (
            <ul className="ux-stagger">
              {shown.map((t, i) => {
                const on = t.id === open.id;
                const un = t.unread;
                return (
                  <li key={t.id}>
                    <button
                      // One conversation for now, so this is a no-op rather
                      // than a selector over threads that do not exist.
                      onClick={() => inputRef.current?.focus()}
                      className="ux-hov flex w-full items-start gap-3 px-3.5 py-3 text-start transition-colors"
                      style={{
                        background: on ? "var(--ux-brand-tint)" : un ? "var(--ux-surface-2)" : "transparent",
                        borderTop: i ? "1px solid var(--ux-line)" : "none",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.avatar} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover"
                           style={{ background: "var(--ux-brand-tint)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                                style={{ color: "var(--ux-ink)" }}>{t.who}</span>
                          {!!un && (
                            <span className="ux-ping relative grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold text-white"
                                  style={{ background: "var(--ux-brand-600)" }}>
                              <span className="relative">{un}</span>
                            </span>
                          )}
                        </span>
                        {/* The role, not just the name: it decides how fast she
                            needs to reply. */}
                        <span className="mt-0.5 block truncate text-[11px]" style={{ color: "var(--ux-brand)" }}>
                          {t.role}
                        </span>
                        <span className="mt-1 block truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                          {t.last}
                        </span>
                        <span className="mt-1 block text-[10.5px]" style={{ color: "var(--ux-faint)" }}>{t.when}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState icon="Inbox" title="Nothing here yet"
                          body="Talk in a circle happens on the circle, and a mentor writes back on her request."
                          action={<Btn href="/app/circles" variant="soft">Your circles</Btn>} />
            </div>
          )}
        </Card>

        <Card pad={0} className="flex flex-col overflow-hidden" style={{ minHeight: 520 }}>
          <div className="flex items-center gap-3 border-b px-[18px] py-3.5" style={{ borderColor: "var(--ux-line)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.avatar} alt="" className="h-[42px] w-[42px] shrink-0 rounded-full object-cover"
                 style={{ background: "var(--ux-brand-tint)" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{open.who}</p>
              <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{open.role}</p>
            </div>
            <Pill tone={TONE[open.kind]} size="sm">{open.kind}</Pill>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-[18px]">
            {messages.map((m) => {
              const me = m.from === "me";
              return (
                <div key={m.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                  <div className="ux-sq ux-rise max-w-[76%] rounded-[14px] px-3.5 py-2.5"
                       style={{
                         background: me ? "var(--ux-fill)" : "var(--ux-surface-2)",
                         color: me ? "#fff" : "var(--ux-ink)",
                       }}>
                    <p className="text-[13px] leading-relaxed">{m.text}</p>
                    <p className="mt-1 text-[10.5px]"
                       style={{ color: me ? "rgba(255,255,255,0.75)" : "var(--ux-faint)" }}>{m.at}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 border-t p-3.5" style={{ borderColor: "var(--ux-line)" }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send.run(); } }}
              placeholder={`Reply to ${open.who.split(" ")[0]}…`}
              aria-label="Write a reply"
              className="ux-sq h-[44px] min-w-0 flex-1 rounded-[11px] border px-4 text-[13px] outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            />
            <button
              onClick={() => void send.run()}
              disabled={!draft.trim() || send.busy}
              aria-label="Send"
              className="ux-press ux-hov ux-clay grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: draft.trim() ? "var(--ux-fill)" : "var(--ux-track)" }}
            >
              <Icons.Send className="ux-ico h-[18px] w-[18px]"
                          style={{ color: draft.trim() ? "#fff" : "var(--ux-faint)" }} strokeWidth={1.9} />
            </button>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

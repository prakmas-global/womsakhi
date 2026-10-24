"use client";

import { Fragment, use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Avatar, Btn, Card, EmptyState, Sheet, Skeleton } from "@/components/ux/kit";
import { useConfirm, useToast } from "@/design-system";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { apiCircle, type ApiCircleDetail } from "@/lib/growth-api";
import { apiJoinCircle } from "@/lib/community-api";
import {
  apiCircleMessages, apiDeleteCircleMessage, apiGroupInfo, apiMarkCircleRead, apiSendCircleMessage, chatDay,
  type ChatMessage, type GroupInfo,
} from "@/lib/circle-chat-api";
import { Composer, EarlierPosts, GroupInfoPanel, MessageItem } from "./chat-views";
import s from "./chat.module.css";

/**
 * One circle — its group chat.
 *
 * ── How it stays current ────────────────────────────────────────────────────
 * Polled, not pushed: every 4 seconds while the tab is visible it asks for
 * messages newer than the last one it has (`?after=`), and every 30 seconds it
 * re-reads the latest page so a message someone deleted shows as deleted.
 * New messages scroll into view only if she was already at the bottom;
 * otherwise a "new messages" pill waits for her.
 *
 * ── What moved where ────────────────────────────────────────────────────────
 * The Discussion tab is gone. The old posts are under group info → "Earlier
 * posts", read only. Members, the invite link, the savings pot, files and
 * leaving all live in group info — a side column on a wide screen, a sheet
 * everywhere else — the way WhatsApp keeps them one tap behind the header.
 */

const POLL_MS = 4000;
const REFRESH_EVERY = 8; // polls → a full re-read of the latest page every ~30s

export default function CircleChat({ params }: { params: Promise<{ id: string }> }) {
  const toast = useToast();
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();

  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastRead, setLastRead] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "outside" | "gone">("loading");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [waiting, setWaiting] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);

  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastId = useRef("");
  const polls = useRef(0);
  const keepOffset = useRef<number | null>(null);
  const stick = useRef(true);

  const info = useResource(
    useCallback((sig?: AbortSignal) => apiGroupInfo(id, sig).catch(() => null), [id]),
    null as GroupInfo | null);
  const outside = useResource(
    useCallback((sig?: AbortSignal) => state === "outside" ? apiCircle(id, sig).catch(() => null) : Promise.resolve(null), [id, state]),
    null as ApiCircleDetail | null);
  const [infoOverride, setInfoOverride] = useState<GroupInfo | null>(null);
  const group = infoOverride && infoOverride.id === id ? infoOverride : info.data;
  const refreshInfo = useCallback((next?: GroupInfo) => {
    if (next) setInfoOverride(next); else { setInfoOverride(null); info.refetch(); }
  }, [info]);

  const markRead = useCallback(() => { apiMarkCircleRead(id).catch(() => {}); }, [id]);

  /* ── loading ───────────────────────────────────────────────────────────── */

  const loadLatest = useCallback(async (first: boolean) => {
    try {
      const page = await apiCircleMessages(id);
      setCanSend(page.can_send); setIsAdmin(page.is_admin);
      if (first) {
        setLastRead(page.last_read_at);
        setMsgs(page.messages);
        setHasMore(page.has_more);
        stick.current = true;
      } else {
        // Re-read: replace what changed (deletions), keep older pages she loaded.
        const byId = new Map(page.messages.map((m) => [m.id, m]));
        setMsgs((cur) => {
          const kept = cur.map((m) => byId.get(m.id) ?? m);
          const have = new Set(kept.map((m) => m.id));
          return [...kept, ...page.messages.filter((m) => !have.has(m.id))];
        });
      }
      const tail = page.messages[page.messages.length - 1];
      if (tail && (!lastId.current || tail.id > lastId.current)) lastId.current = tail.id;
      setState("ready");
      if (first) markRead();
    } catch (e) {
      const code = (e as { response?: { status?: number } })?.response?.status;
      if (code === 403) setState("outside");
      else if (code === 404) setState("gone");
      else if (first) { setState("ready"); toast.error(apiErrorMessage(e)); }
    }
  }, [id, markRead, toast]);

  useEffect(() => {
    lastId.current = "";
    const t = window.setTimeout(() => { void loadLatest(true); }, 0);
    return () => window.clearTimeout(t);
  }, [loadLatest]);

  const poll = useCallback(async () => {
    if (state !== "ready" || document.visibilityState !== "visible") return;
    polls.current += 1;
    if (polls.current % REFRESH_EVERY === 0) { await loadLatest(false); return; }
    try {
      const page = await apiCircleMessages(id, lastId.current ? { after: lastId.current } : {});
      setCanSend(page.can_send); setIsAdmin(page.is_admin);
      if (!page.messages.length) return;
      lastId.current = page.messages[page.messages.length - 1].id;
      setMsgs((cur) => {
        const have = new Set(cur.map((m) => m.id));
        return [...cur, ...page.messages.filter((m) => !have.has(m.id))];
      });
      setFreshIds(new Set(page.messages.map((m) => m.id)));
      if (atBottom.current) { stick.current = true; markRead(); }
      else setWaiting((n) => n + page.messages.filter((m) => !m.mine).length);
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 403) setState("outside");
    }
  }, [id, state, loadLatest, markRead]);

  useEffect(() => {
    const t = window.setInterval(() => { void poll(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [poll]);

  const loadOlder = async () => {
    const first = msgs[0];
    if (!first || olderBusy) return;
    setOlderBusy(true);
    try {
      const page = await apiCircleMessages(id, { before: first.id });
      keepOffset.current = (list.current?.scrollHeight ?? 0) - (list.current?.scrollTop ?? 0);
      setMsgs((cur) => [...page.messages, ...cur]);
      setHasMore(page.has_more);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setOlderBusy(false); }
  };

  // Scroll: to the bottom when asked to stick, or hold her place after older messages load.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
      stick.current = false;
    }
  }, [msgs]);

  const onScroll = () => {
    const el = list.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (near && !atBottom.current && waiting) { setWaiting(0); markRead(); }
    atBottom.current = near;
  };
  const toBottom = () => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setWaiting(0); markRead();
  };

  /* ── doing things ──────────────────────────────────────────────────────── */

  const send = async (text: string, photo?: string) => {
    setSending(true);
    try {
      const m = await apiSendCircleMessage(id, { text, photo, reply_to: replyTo?.id });
      setMsgs((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
      if (!lastId.current || m.id > lastId.current) lastId.current = m.id;
      setFreshIds(new Set([m.id]));
      setReplyTo(null);
      stick.current = true;
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e));
      return false;
    } finally { setSending(false); }
  };

  const remove = async (m: ChatMessage) => {
    const yes = await confirm({
      title: "Delete this message?", confirmLabel: "Delete", danger: true,
      description: m.mine ? "Everyone in the group will see “This message was deleted”." : "You are deleting it as a group admin. Everyone will see that it was deleted.",
    });
    if (!yes) return;
    try {
      const d = await apiDeleteCircleMessage(id, m.id);
      setMsgs((cur) => cur.map((x) => (x.id === d.id ? d : x)));
      setSelected(null);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  };

  const jump = (target: string) => {
    const el = document.getElementById(`m-${target}`);
    if (!el) { toast.info("That message is further up — tap “Earlier messages” to load it"); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(target);
    window.setTimeout(() => setFlash((f) => (f === target ? null : f)), 1400);
  };

  const join = async () => {
    try { await apiJoinCircle(id); setState("loading"); await loadLatest(true); info.refetch(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  };

  /* ── drawing ───────────────────────────────────────────────────────────── */

  if (state === "gone") {
    return (
      <HomeShell active="/app/circles">
        <Card>
          <EmptyState icon="SearchX" title="That circle is not here" body="It may have closed, or the link is wrong."
                      action={<Btn href="/app/circles" iconEnd="ArrowRight">All circles</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  if (state === "outside") {
    const c = outside.data;
    return (
      <HomeShell active="/app/circles">
        <Link href="/app/circles" className="mb-3 inline-flex items-center gap-1 text-xsm font-bold" style={{ color: "var(--ux-brand)" }}>
          <Icons.ArrowLeft className="h-4 w-4" /> Circles
        </Link>
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <Avatar src={c?.cover} name={c?.name || "Circle"} size={84} />
            <h1 className="mt-3 text-xl font-extrabold" style={{ color: "var(--ux-ink)" }}>{c?.name || "A circle"}</h1>
            {c && <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{c.member_count} {c.member_count === 1 ? "member" : "members"}{c.topic ? ` · ${c.topic}` : ""}</p>}
            {c?.desc && <p className="mt-3 max-w-[460px] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{c.desc}</p>}
            <div className="mt-5">
              {c && !c.is_private
                ? <Btn icon="LogIn" onClick={join}>Join this circle</Btn>
                : <p className="max-w-[360px] text-xsm" style={{ color: "var(--ux-muted)" }}>This group is private. Ask someone in it for the invite link, or for an invite to your username.</p>}
            </div>
          </div>
        </Card>
      </HomeShell>
    );
  }

  const name = group?.name || "Circle";
  const firstUnread = lastRead ? msgs.find((m) => !m.mine && m.kind === "text" && m.at > lastRead)?.id : undefined;

  return (
    <HomeShell active="/app/circles" bare immersive>
      <style href="ux-circle-chat-float" precedence="ux-mobile">
        {`.ux:has([data-circle-chat]) [data-float="sakhi"] { display: none !important; }`}
      </style>
      <div className={`${s.frame} ${s.withInfo}`} data-circle-chat>
        <section className={s.chat} aria-label={`${name} chat`}>
          <header className={s.head}>
            <button type="button" aria-label="Back to circles" onClick={() => router.push("/app/circles")}
                    className="ux-press grid h-10 w-10 shrink-0 place-items-center rounded-full">
              <Icons.ArrowLeft className="h-5 w-5" style={{ color: "var(--ux-ink)" }} />
            </button>
            <button type="button" onClick={() => setInfoOpen(true)} data-open-info
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
              <Avatar src={group?.cover || group?.icon} name={name} size={40} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-[15px] font-extrabold" style={{ color: "var(--ux-ink)" }}>
                  <span className="truncate">{name}</span>
                  {group?.is_savings && <Icons.Coins className="h-4 w-4 shrink-0" style={{ color: "var(--ux-amber-ink)" }} />}
                </span>
                <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                  {group ? group.members.slice(0, 4).map((m) => (m.you ? "You" : m.name)).join(", ") + (group.member_count > 4 ? ` +${group.member_count - 4}` : "") : "Tap for group info"}
                </span>
              </span>
            </button>
            <button type="button" aria-label="Group info" onClick={() => setInfoOpen(true)}
                    className="ux-press grid h-10 w-10 shrink-0 place-items-center rounded-full xl:hidden">
              <Icons.Info className="h-5 w-5" style={{ color: "var(--ux-ink-2)" }} />
            </button>
          </header>

          <div ref={list} className={s.list} onScroll={onScroll} data-chat-scroll
               onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
            {state === "loading" ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}><Skeleton className="h-[44px] w-[55%] rounded-[16px]" /></div>
                ))}
              </div>
            ) : (
              <>
                {hasMore && (
                  <div className="mb-2 flex justify-center">
                    <Btn size="sm" variant="outline" icon="ChevronUp" loading={olderBusy} onClick={loadOlder}>Earlier messages</Btn>
                  </div>
                )}
                {!msgs.length && (
                  <div className="grid place-items-center py-16 text-center">
                    <Icons.MessagesSquare className="h-10 w-10" style={{ color: "var(--ux-brand)" }} />
                    <p className="mt-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Say hello to the group</p>
                    <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Tap a quick reply below to start.</p>
                  </div>
                )}
                <ul>
                  {msgs.map((m, i) => {
                    const prev = msgs[i - 1];
                    const dayHere = chatDay(m.at);
                    const newDay = !prev || chatDay(prev.at) !== dayHere;
                    const first = newDay || !prev || prev.kind === "system" || prev.user_id !== m.user_id;
                    return (
                      <Fragment key={m.id}>
                        {newDay && <li className={s.day}>{dayHere}</li>}
                        {m.id === firstUnread && <li className={s.newLine} data-new-line>New messages</li>}
                        <MessageItem m={m} first={first} selected={selected === m.id} flash={flash === m.id}
                                     fresh={freshIds.has(m.id)} canDelete={m.mine || isAdmin}
                                     onSelect={() => setSelected(selected === m.id ? null : m.id)}
                                     onReply={() => { setReplyTo(m); setSelected(null); }}
                                     onDelete={() => remove(m)} onJump={jump} />
                      </Fragment>
                    );
                  })}
                </ul>
              </>
            )}
            {waiting > 0 && (
              <div className="sticky bottom-2 z-[2] flex justify-center">
                <Btn size="sm" icon="ArrowDown" onClick={toBottom}>{waiting} new {waiting === 1 ? "message" : "messages"}</Btn>
              </div>
            )}
          </div>

          <Composer canSend={canSend} sending={sending} replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)} onSend={send} />
        </section>

        <aside className={s.info} aria-label="Group info">
          {group ? <GroupInfoPanel key={`${group.id}-${group.name}-${group.desc}`} info={group} onChanged={refreshInfo} onEarlier={() => setEarlierOpen(true)} />
                 : <div className="space-y-3 p-4"><Skeleton className="mx-auto h-[88px] w-[88px] rounded-full" /><Skeleton className="h-6 w-full" /></div>}
        </aside>
      </div>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="Group info" icon="Info" width={420}>
        {group && <div className="-m-4"><GroupInfoPanel key={`s-${group.id}-${group.name}-${group.desc}`} info={group} onChanged={refreshInfo} onEarlier={() => { setInfoOpen(false); setEarlierOpen(true); }} /></div>}
      </Sheet>
      <EarlierPosts open={earlierOpen} onClose={() => setEarlierOpen(false)} circleId={id} />
    </HomeShell>
  );
}

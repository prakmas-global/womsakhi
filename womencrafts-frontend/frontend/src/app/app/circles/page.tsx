"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Avatar, Btn, Card, EmptyState, Pill, Sheet, Skeleton } from "@/components/ux/kit";
import { Picks, Text } from "@/components/ux/kit/form";
import { topicOf } from "@/components/ux/circle/data";
import { topicPicture, useCircleTopics } from "@/components/ux/circle/topics";
import { useToast } from "@/design-system";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { apiCircles, apiJoinCircle, type Circle } from "@/lib/community-api";
import {
  apiAcceptCircleInvite, apiChats, apiDeclineCircleInvite, apiMyCircleInvites, chatTime,
  type ChatRow, type IncomingInvite,
} from "@/lib/circle-chat-api";

/**
 * Circles — her group chats, the way WhatsApp lists them.
 *
 * Newest activity first, the last line said, and a count of what she has not
 * read. Invites somebody sent her by username sit on top until she says Join
 * or Decline: nobody is put into a group she did not choose. Below the list,
 * open circles she can join with one tap; a private one needs its invite link.
 *
 * The list refreshes itself every 15 seconds while the tab is visible, so an
 * unread badge turns up without her pulling.
 */

const FILTERS = ["All", "Unread", "Savings", "I run"] as const;
type Filter = (typeof FILTERS)[number];

function useVisibleInterval(fn: () => void, ms: number) {
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === "visible") fn(); }, ms);
    return () => window.clearInterval(t);
  }, [fn, ms]);
}

export default function CirclesPage() {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const chats = useResource(useCallback((s?: AbortSignal) => apiChats(s), []), [] as ChatRow[]);
  const invites = useResource(useCallback((s?: AbortSignal) => apiMyCircleInvites(s).catch(() => []), []), [] as IncomingInvite[]);
  const refresh = useCallback(() => { chats.refetch(); invites.refetch(); }, [chats, invites]);
  useVisibleInterval(refresh, 15000);

  // Open circles: the popular ones she is not in, or the ones matching her search.
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  const open = useResource(
    useCallback(() => apiCircles(term ? { q: term } : {}).then((rows) => rows.filter((c) => !c.joined && !c.is_private)).catch(() => []), [term]),
    [] as Circle[]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.data.filter((c) =>
      (!q || `${c.name} ${c.topic} ${c.last_text}`.toLowerCase().includes(q))
      && (filter === "All" || (filter === "Unread" && c.unread > 0) || (filter === "Savings" && c.is_savings)
          || (filter === "I run" && c.is_admin)));
  }, [chats.data, query, filter]);
  const unreadTotal = chats.data.reduce((a, c) => a + (c.unread > 0 ? 1 : 0), 0);

  const accept = async (inv: IncomingInvite) => {
    setBusy(inv.id);
    try {
      const r = await apiAcceptCircleInvite(inv.id);
      toast.success(`You joined ${r.name}`);
      router.push(`/app/circles/${r.circle_id}`);
    } catch (e) { toast.error(apiErrorMessage(e)); refresh(); }
    finally { setBusy(null); }
  };
  const decline = async (inv: IncomingInvite) => {
    setBusy(inv.id);
    try { await apiDeclineCircleInvite(inv.id); toast.info("Invite declined"); refresh(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(null); }
  };
  const join = async (c: Circle) => {
    setBusy(c.id);
    try { await apiJoinCircle(c.id); router.push(`/app/circles/${c.id}`); }
    catch (e) { toast.error(apiErrorMessage(e)); setBusy(null); }
  };

  const rail = (
    <div className="space-y-4">
      <OpenCircles rows={open.data.slice(0, 6)} busy={busy} onJoin={join} searching={!!term} />
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
          <Icons.ShieldCheck className="h-4 w-4" style={{ color: "var(--ux-brand)" }} /> Your groups, your choice
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          <li>Nobody can add you to a group — you get an invite and choose.</li>
          <li>Leave any group from its info, any time.</li>
          <li>Your phone number is never shown in a group.</li>
        </ul>
      </Card>
    </div>
  );

  return (
    <HomeShell active="/app/circles" rail={rail} loadFailed="your circles">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-2xl font-extrabold min-w-0" style={{ color: "var(--ux-ink)" }}>Circles</h1>
          </div>
          <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>
            {chats.data.length
              ? `${chats.data.length} ${chats.data.length === 1 ? "group" : "groups"}${unreadTotal ? ` · ${unreadTotal} with new messages` : ""}`
              : "Group chats with women who share your work and plans"}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" icon="Link" onClick={() => setJoinOpen(true)}>Join with a link</Btn>
          <Btn icon="Plus" href="/app/circles/create">New circle</Btn>
        </div>
      </header>

      {invites.data.length > 0 && (
        <section aria-label="Invites for you" className="mb-4" data-invites>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
            <Icons.Mail className="h-4 w-4" style={{ color: "var(--ux-brand)" }} /> Invites for you
            <span className="rounded-full px-2 text-2xs font-bold" style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>{invites.data.length}</span>
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {invites.data.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-[16px] p-3"
                   style={{ background: "var(--ux-tint-pink)", border: "1px solid var(--ux-line)" }}>
                <Avatar src={inv.cover || inv.icon} name={inv.circle_name} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{inv.circle_name}</p>
                  <p className="truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                    {inv.from_name} invited you · {inv.member_count} {inv.member_count === 1 ? "member" : "members"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Btn size="sm" icon="Check" loading={busy === inv.id} onClick={() => accept(inv)}>Join</Btn>
                    <Btn size="sm" variant="outline" disabled={busy === inv.id} onClick={() => decline(inv)}>Decline</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-3 space-y-2.5">
        <label className="flex items-center gap-2 rounded-full px-4" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <Icons.Search className="h-4 w-4 shrink-0" style={{ color: "var(--ux-muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search circles"
                 placeholder="Search your circles, or find new ones"
                 className="min-h-[44px] w-full bg-transparent text-sm outline-none" style={{ color: "var(--ux-ink)" }} />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="ux-press grid h-8 w-8 place-items-center rounded-full">
              <Icons.X className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
            </button>
          )}
        </label>
        <Picks options={[...FILTERS]} value={filter} onPick={(f) => setFilter(f as Filter)} label="Show" />
      </div>

      <Card pad={0} className="overflow-hidden">
        {chats.source === "loading" && !chats.data.length ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[56px] w-full" />)}</div>
        ) : rows.length ? (
          <ul data-chat-list>
            {rows.map((c, i) => <ChatListRow key={c.id} c={c} last={i === rows.length - 1} />)}
          </ul>
        ) : chats.data.length ? (
          <EmptyState icon="SearchX" title="No circle matches" body="Try another word, or clear the filter."
                      action={<Btn variant="outline" size="sm" onClick={() => { setQuery(""); setFilter("All"); }}>Show all</Btn>} />
        ) : (
          <EmptyState icon="MessagesSquare" title="You are not in a circle yet"
                      body="Start one for your group, open an invite link, or join an open circle below."
                      action={<Btn href="/app/circles/create" icon="Plus">Start a circle</Btn>} />
        )}
      </Card>

      {/* On a phone the rail sits far below; the open circles are worth seeing here. */}
      <div className="mt-4 xl:hidden">
        <OpenCircles rows={open.data.slice(0, 4)} busy={busy} onJoin={join} searching={!!term} />
      </div>

      <JoinWithLink open={joinOpen} onClose={() => setJoinOpen(false)} />
    </HomeShell>
  );
}

function ChatListRow({ c, last }: { c: ChatRow; last: boolean }) {
  const unread = c.unread > 0;
  return (
    <li>
      <Link href={`/app/circles/${c.id}`} data-chat-row={c.id}
            className="ux-hov flex items-center gap-3 px-4 py-3 transition-colors"
            style={{ borderBottom: last ? undefined : "1px solid var(--ux-line)" }}>
        <span className="relative shrink-0">
          <Avatar src={c.cover || c.icon} name={c.name} size={50} />
          {c.is_savings && (
            <span className="absolute -bottom-1 -end-1 grid h-[20px] w-[20px] place-items-center rounded-full"
                  style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)", border: "2px solid var(--ux-surface)" }}>
              <Icons.Coins className="h-[11px] w-[11px]" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold lg:text-sm" style={{ color: "var(--ux-ink)" }}>{c.name}</span>
            {c.is_private && <Icons.Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-muted)" }} />}
            {c.is_savings && <span className="hidden sm:inline"><Pill tone="orange" size="sm">Savings</Pill></span>}
            <span className="ms-auto shrink-0 text-2xs tabular-nums"
                  style={{ color: unread ? "var(--ux-brand)" : "var(--ux-muted)", fontWeight: unread ? 700 : 500 }}>
              {chatTime(c.last_at)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-xsm" style={{ color: unread ? "var(--ux-ink-2)" : "var(--ux-muted)", fontWeight: unread ? 600 : 400 }}>
              {c.last_text || `${c.member_count} ${c.member_count === 1 ? "member" : "members"} · say hello`}
            </span>
            {c.muted && <Icons.BellOff className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-muted)" }} />}
            {unread && (
              <span data-unread className="ms-auto grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full px-1.5 text-2xs font-bold tabular-nums"
                    style={{ background: c.muted ? "var(--ux-muted)" : "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>
                {c.unread > 98 ? "99+" : c.unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

function OpenCircles({ rows, busy, onJoin, searching }: {
  rows: Circle[]; busy: string | null; onJoin: (c: Circle) => void; searching: boolean;
}) {
  const live = useCircleTopics();
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.Compass className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
        {searching ? "Open circles that match" : "Open circles to join"}
      </h2>
      {rows.length ? (
        <ul className="mt-3 space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              {/* No cover: the picture of what it is about. */}
              <Avatar src={c.cover || topicPicture(topicOf(c.topic, live))} name={c.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{c.name}</span>
                <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                  {[c.topic, `${c.member_count} ${c.member_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Btn size="sm" variant="soft" loading={busy === c.id} onClick={() => onJoin(c)}>Join</Btn>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>
          {searching ? "No open circle by that name. A private one needs its invite link." : "You are in every open circle already."}
        </p>
      )}
    </Card>
  );
}

/** Paste the link she was sent (or just its code) and go. */
function JoinWithLink({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState("");
  const code = useMemo(() => {
    const v = value.trim();
    const m = v.match(/(?:join|invite)\/([A-Za-z0-9_-]{4,})/);
    return m ? m[1] : /^[A-Za-z0-9_-]{4,}$/.test(v) ? v : "";
  }, [value]);
  const paste = async () => {
    try { setValue(await navigator.clipboard.readText()); }
    catch { toast.info("Long-press the box and choose Paste"); }
  };
  return (
    <Sheet open={open} onClose={onClose} icon="Link" title="Join with a link"
           description="Open the invite link someone sent you, or paste it here."
           footer={<Btn full icon="LogIn" disabled={!code} onClick={() => router.push(`/app/circles/join/${code}`)}>Join this circle</Btn>}>
      <Text label="Invite link" value={value} onChange={setValue} placeholder="https://…/join/AbC123" />
      <div className="mt-3">
        <Btn variant="soft" size="sm" icon="ClipboardPaste" onClick={paste}>Paste from clipboard</Btn>
      </div>
      {value && !code && (
        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>That does not look like an invite link.</p>
      )}
    </Sheet>
  );
}

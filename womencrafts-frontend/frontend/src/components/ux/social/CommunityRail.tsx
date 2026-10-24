"use client";

import { useCallback } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Avatar, Card } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { apiFriendRequests, apiFriendSuggestions, profileHref, type RequestRow, type Suggestion } from "@/lib/social-api";
import { FriendButton } from "./FriendButton";
import { PeopleSearch } from "./PeopleSearch";

function Person({ p, sub, onDone }: { p: RequestRow | Suggestion; sub: string; onDone?: () => void }) {
  return (
    <li className="flex items-center gap-3">
      <Link href={profileHref(p)} className="shrink-0"><Avatar src={p.avatar} name={p.name} size={44} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={profileHref(p)} className="flex items-center gap-1 truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
          <span className="truncate">{p.name}</span>
          {p.verified && <Icons.BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-blue)" }} />}
        </Link>
        <p className="truncate text-2xs" style={{ color: "var(--ux-muted)" }}>{sub}</p>
        <div className="mt-1.5">
          <FriendButton key={p.relation} userId={p.id} relation={p.relation} name={p.name} onChange={() => onDone?.()} />
        </div>
      </div>
    </li>
  );
}

/**
 * The column beside the feed: find someone, answer requests, meet women she
 * may know, and the way into her circles. On a phone it sits under the feed;
 * the feed page also carries a short strip at the top for requests.
 */
export function CommunityRail({ onFriendsChanged }: { onFriendsChanged?: () => void }) {
  const { data: reqs, refetch: refetchReqs } = useResource(
    useCallback((s: AbortSignal) => apiFriendRequests(s), []), { incoming: [], sent: [] });
  const { data: sugg } = useResource(useCallback((s: AbortSignal) => apiFriendSuggestions(s, 6), []), [] as Suggestion[]);
  const changed = () => { refetchReqs(); onFriendsChanged?.(); };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2.5 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>Find a friend</h2>
        <PeopleSearch compact />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
            Friend requests{reqs.incoming.length ? ` (${reqs.incoming.length})` : ""}
          </h2>
          <Link href="/app/community/friends" className="text-xs font-bold" style={{ color: "var(--ux-brand)" }}>See all</Link>
        </div>
        {reqs.incoming.length ? (
          <ul className="space-y-3.5">
            {reqs.incoming.slice(0, 4).map((p) => (
              <Person key={p.id} p={p} onDone={changed}
                      sub={p.mutual ? `${p.mutual} mutual friend${p.mutual > 1 ? "s" : ""} · ${p.when}` : p.when} />
            ))}
          </ul>
        ) : (
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>No new requests. Women you add will show up here when they add you back.</p>
        )}
      </Card>

      {sugg.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>People you may know</h2>
          <ul className="space-y-3.5">
            {sugg.map((p) => <Person key={p.id} p={p} sub={p.reason || (p.location ? `Lives in ${p.location}` : "On WomSakhi")} />)}
          </ul>
        </Card>
      )}

      <Link href="/app/circles" className="ux-card ux-hov flex items-center gap-3" style={{ padding: 16 }}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet-ink)" }}>
          <Icons.MessagesSquare className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>My circles</span>
          <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>Group chats with the women in your circles</span>
        </span>
        <Icons.ArrowRight className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
      </Link>
    </div>
  );
}

"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Avatar, Card, EmptyState, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { FriendButton } from "@/components/ux/social/FriendButton";
import { PeopleSearch } from "@/components/ux/social/PeopleSearch";
import { useResource } from "@/lib/use-resource";
import type { PersonRow } from "@/lib/people-api";
import {
  apiFriendRequests, apiFriendSuggestions, apiFriends, profileHref, type RequestRow, type Suggestion,
} from "@/lib/social-api";

/**
 * Friends — requests to answer, the women she is friends with, requests she
 * sent, and finding someone by username (with people she may know underneath).
 */
function Row({ p, sub, onChange }: { p: PersonRow; sub: string; onChange?: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <Link href={profileHref(p)} className="shrink-0"><Avatar src={p.avatar} name={p.name} size={52} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={profileHref(p)} className="flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
          <span className="truncate">{p.name}</span>
          {p.verified && <Icons.BadgeCheck className="h-4 w-4 shrink-0" style={{ color: "var(--ux-blue)" }} />}
        </Link>
        <p className="truncate text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</p>
      </div>
      {/* Beside her name on a wide screen; under it on a phone, so the name is not squeezed to "neha…". */}
      <div className="w-full ps-[64px] sm:w-auto sm:shrink-0 sm:ps-0"><FriendButton key={p.relation} userId={p.id} relation={p.relation} name={p.name} onChange={onChange} /></div>
    </li>
  );
}

const handle = (p: PersonRow) =>
  [p.username && p.username !== p.name ? `@${p.username}` : "", p.location].filter(Boolean).join(" · ") || "WomSakhi member";

export default function FriendsPage() {
  const [tab, setTab] = useState("Requests");
  const reqs = useResource(useCallback((s: AbortSignal) => apiFriendRequests(s), []), { incoming: [] as RequestRow[], sent: [] as RequestRow[] });
  const friends = useResource(useCallback((s: AbortSignal) => apiFriends(s), []), [] as PersonRow[]);
  const sugg = useResource(useCallback((s: AbortSignal) => apiFriendSuggestions(s, 12), []), [] as Suggestion[]);
  const refresh = () => { reqs.refetch(); friends.refetch(); };

  const tabs = [
    `Requests${reqs.data.incoming.length ? ` (${reqs.data.incoming.length})` : ""}`,
    `Friends${friends.data.length ? ` (${friends.data.length})` : ""}`,
    "Sent",
    "Find people",
  ];
  const active = tabs.find((t) => t.startsWith(tab)) ?? tabs[0];

  return (
    <HomeShell active="/app/community/friends">
      <div className="mb-4">
        <div className="flex min-w-0 items-center gap-3">
          <PlaceMark size={44} />
          <h1 className="ux-screen-title text-2xl font-extrabold min-w-0" style={{ color: "var(--ux-ink)" }}>Friends</h1>
        </div>
        <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>Friends see each other&apos;s friends-only posts</p>
      </div>
      <div className="mb-4"><Tabs items={tabs} active={active} onChange={(t) => setTab(t.split(" (")[0])} /></div>

      {tab === "Requests" && (
        <Card>
          {reqs.data.incoming.length ? (
            <ul className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
              {reqs.data.incoming.map((p) => (
                <Row key={p.id} p={p} onChange={refresh}
                     sub={[p.mutual ? `${p.mutual} mutual friend${p.mutual > 1 ? "s" : ""}` : handle(p), p.when].filter(Boolean).join(" · ")} />
              ))}
            </ul>
          ) : (
            <EmptyState icon="UserPlus" title="No requests right now"
                        body="When a woman asks to be your friend, she shows up here." />
          )}
        </Card>
      )}

      {tab === "Friends" && (
        <Card>
          {friends.data.length ? (
            <ul className="divide-y">
              {friends.data.map((p) => <Row key={p.id} p={p} sub={handle(p)} onChange={refresh} />)}
            </ul>
          ) : (
            <EmptyState icon="Users" title="No friends yet" body="Find women by their username, or start with the people you may know." />
          )}
        </Card>
      )}

      {tab === "Sent" && (
        <Card>
          {reqs.data.sent.length ? (
            <ul className="divide-y">
              {reqs.data.sent.map((p) => <Row key={p.id} p={p} sub={`Sent ${p.when}`} onChange={refresh} />)}
            </ul>
          ) : (
            <EmptyState icon="Send" title="No requests waiting" body="Requests you send stay here until she answers." />
          )}
        </Card>
      )}

      {tab === "Find people" && (
        <div className="space-y-4">
          <Card><PeopleSearch autoFocus /></Card>
        </div>
      )}

      {(tab === "Find people" || tab === "Requests") && sugg.data.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>People you may know</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sugg.data.map((p) => (
              <div key={p.id} className="ux-card flex flex-col items-center text-center" style={{ padding: 14 }}>
                <Link href={profileHref(p)}><Avatar src={p.avatar} name={p.name} size={72} /></Link>
                <Link href={profileHref(p)} className="mt-2 flex w-full items-center justify-center gap-1 text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
                  <span className="truncate">{p.name}</span>
                  {p.verified && <Icons.BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-blue)" }} />}
                </Link>
                <p className="mb-2.5 mt-0.5 line-clamp-1 min-h-[16px] text-2xs" style={{ color: "var(--ux-muted)" }}>{p.reason}</p>
                <div className="mt-auto w-full"><FriendButton key={p.relation} userId={p.id} relation={p.relation} name={p.name} full onChange={refresh} /></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </HomeShell>
  );
}

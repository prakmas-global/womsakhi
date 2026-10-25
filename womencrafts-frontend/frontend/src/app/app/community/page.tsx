"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { EmptyState, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Composer } from "@/components/ux/social/Composer";
import { CommunityRail } from "@/components/ux/social/CommunityRail";
import { FeedList } from "@/components/ux/social/FeedList";
import { useAuth } from "@/context/AuthContext";
import { useResource } from "@/lib/use-resource";
import { apiFeed, apiFriendRequests, type FeedPost, type FeedTab } from "@/lib/social-api";

/**
 * Community — the feed.
 *
 * Posts from her friends and posts any woman shared with everyone, newest
 * first. She writes at the top; "Friends" and "My posts" narrow it. The side
 * column holds requests, people she may know and the way into her circles.
 */
const TABS: { label: string; tab: FeedTab }[] = [
  { label: "All posts", tab: "all" },
  { label: "Friends", tab: "friends" },
  { label: "My posts", tab: "mine" },
];

const EMPTY: Record<FeedTab, { title: string; body: string }> = {
  all: { title: "Nothing here yet", body: "Write the first post, or add a few friends to see what they share." },
  friends: { title: "No posts from friends yet", body: "Add women you know — their posts will show here." },
  mine: { title: "You have not posted yet", body: "Share a win, ask a question, or thank someone. One line is enough." },
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [label, setLabel] = useState(TABS[0].label);
  const [fresh, setFresh] = useState<FeedPost[]>([]);
  const tab = TABS.find((t) => t.label === label)?.tab ?? "all";
  const load = useCallback((before: string, s?: AbortSignal) => apiFeed(tab, before, s), [tab]);
  const { data: reqs } = useResource(useCallback((s: AbortSignal) => apiFriendRequests(s), []), { incoming: [], sent: [] });
  const name = user?.display_name || user?.full_name || "";

  return (
    <HomeShell active="/app/community" rail={<CommunityRail />}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ux-screen-title text-2xl font-extrabold" style={{ color: "var(--ux-ink)" }}>Community</h1>
          <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>What the women around you are sharing</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/community/friends" data-friends-link
                className="ux-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
            <Icons.UserPlus className="h-4 w-4" /> Friends
            {reqs.incoming.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-2xs"
                    style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>{reqs.incoming.length}</span>
            )}
          </Link>
          <Link href="/app/circles"
                className="ux-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold"
                style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet-ink)" }}>
            <Icons.MessagesSquare className="h-4 w-4" /> Circles
          </Link>
        </div>
      </div>

      {/* On a phone the side column falls below an endless feed, so the
          requests waiting for her get a line up here. */}
      {reqs.incoming.length > 0 && (
        <Link href="/app/community/friends" className="ux-card ux-hov mb-4 flex items-center gap-3 xl:hidden" style={{ padding: 14 }}>
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
            <Icons.UserPlus className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
            {reqs.incoming.length === 1 ? `${reqs.incoming[0].name} wants to be friends` : `${reqs.incoming.length} friend requests`}
          </span>
          <Icons.ArrowRight className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
        </Link>
      )}

      <Composer name={user?.full_name || name} greet={user?.full_name || ""} avatar={user?.avatar || ""} onPosted={(p) => { setFresh((f) => [p, ...f]); if (tab === "friends") setLabel("All posts"); }} />

      <div className="my-4">
        <Tabs items={TABS.map((t) => t.label)} active={label} onChange={setLabel} />
      </div>

      <FeedList load={load} fresh={tab === "friends" ? [] : fresh}
                empty={<div className="ux-card"><EmptyState icon="MessagesSquare" title={EMPTY[tab].title} body={EMPTY[tab].body} /></div>} />
    </HomeShell>
  );
}

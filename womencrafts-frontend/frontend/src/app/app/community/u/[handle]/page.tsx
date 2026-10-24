"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Avatar, Btn, EmptyState } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { MessageHer } from "@/components/ux/MessageHer";
import { FeedList } from "@/components/ux/social/FeedList";
import { FriendButton } from "@/components/ux/social/FriendButton";
import { useResource } from "@/lib/use-resource";
import { apiPerson, type PersonProfile } from "@/lib/people-api";
import { apiUserFeed } from "@/lib/social-api";

/**
 * A member's page: who she is (name, @username, verified, place, a line about
 * herself), the friend button in its real state, a way to message her, and
 * the posts she shared that this viewer is allowed to see.
 */
export default function PersonPage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(params?.handle ?? "");
  const { data: p, source, refetch } = useResource(
    useCallback((s: AbortSignal) => apiPerson(handle, s), [handle]), null as PersonProfile | null);
  const load = useCallback((before: string, s?: AbortSignal) => apiUserFeed(p?.id ?? "", before, s), [p?.id]);

  if (!p) {
    return (
      <HomeShell active="/app/community/u" skeleton="detail" loadFailed={source === "error" ? "this member" : undefined}>
        {source === "error" ? (
          <div className="ux-card"><EmptyState icon="UserX" title="We could not find her"
               body="The username may have changed, or her account is not open yet."
               action={<Btn href="/app/community/friends" variant="soft" icon="Search">Find people</Btn>} /></div>
        ) : <div className="h-[320px] animate-pulse rounded-[18px]" style={{ background: "var(--ux-surface-2)" }} />}
      </HomeShell>
    );
  }

  const self = p.relation === "self";
  const facts = [
    p.location && { icon: Icons.MapPin, text: p.location },
    p.member_since && { icon: Icons.CalendarDays, text: `Member since ${p.member_since}` },
  ].filter(Boolean) as { icon: typeof Icons.MapPin; text: string }[];

  return (
    <HomeShell active="/app/community/u">
      <section className="ux-card mb-4 overflow-hidden" style={{ padding: 0 }}>
        <div className="h-[120px] sm:h-[160px]"
             style={{ background: "linear-gradient(120deg, var(--ux-brand) 0%, var(--ux-fill-2, #d14a8b) 55%, var(--ux-violet, #7440a6) 100%)" }} />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
            <span className="rounded-full p-1" style={{ background: "var(--ux-surface)" }}>
              <Avatar src={p.avatar} name={p.name} size={104} className="h-[96px] w-[96px] sm:h-[104px] sm:w-[104px]" />
            </span>
            <div className="flex flex-wrap gap-2 pb-1">
              {self ? (
                <Btn href="/app/profile" variant="soft" icon="Pencil" size="sm">Edit my profile</Btn>
              ) : (
                <>
                  <FriendButton key={p.relation} userId={p.id} relation={p.relation} name={p.name} onChange={refetch} />
                  <MessageHer userId={p.id} name={p.name} label="Message" about="Community"
                              phrases={["Hi! I saw your post 😊", "Can we talk about your work?", "Would love to be friends"]} />
                </>
              )}
            </div>
          </div>
          <h1 className="mt-3 flex items-center gap-1.5 text-xl font-extrabold" style={{ color: "var(--ux-ink)" }}>
            {p.name}{p.verified && <Icons.BadgeCheck className="h-5 w-5" style={{ color: "var(--ux-blue)" }} />}
          </h1>
          {p.username && p.username !== p.name && <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>@{p.username}</p>}
          {p.bio && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed lg:text-sm" style={{ color: "var(--ux-ink-2)" }}>{p.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>
            {facts.map((f) => <span key={f.text} className="inline-flex items-center gap-1"><f.icon className="h-3.5 w-3.5" />{f.text}</span>)}
          </div>
          <div className="mt-4 flex gap-6">
            <p><b className="text-lg" style={{ color: "var(--ux-ink)" }}>{p.friends}</b> <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{p.friends === 1 ? "friend" : "friends"}</span></p>
            <p><b className="text-lg" style={{ color: "var(--ux-ink)" }}>{p.posts}</b> <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{p.posts === 1 ? "post" : "posts"}</span></p>
          </div>
        </div>
      </section>

      <h2 className="mb-3 text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{self ? "My posts" : "Posts"}</h2>
      <FeedList load={load}
                empty={<div className="ux-card"><EmptyState icon="MessagesSquare" title="No posts to show"
                       body={p.relation === "friends" || self ? "Nothing shared yet." : "She may share some posts only with friends."} /></div>} />
    </HomeShell>
  );
}

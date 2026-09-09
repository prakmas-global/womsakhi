"use client";

import { use, useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  Back, Btn, Card, EmptyState, RailSkeleton, ScreenSkeleton, Tabs, v,
} from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { useMe } from "@/components/ux/me";
import {
  apiCircle, apiCirclePosts, apiCircleSavings,
  type ApiCircleDetail, type ApiCircleSavings, type CirclePost,
} from "@/lib/growth-api";
import { apiCreatePost, apiJoinCircle, apiLeaveCircle, apiLikePost } from "@/lib/community-api";
import { formatMoney } from "@/components/ux/kit/money";
import {
  AboutCircle, CircleActions, CircleBanner, CircleEventsRail, CirclePostCard,
  Composer, MembersCard, NotBuiltYet, PotCard,
  type CircleFeedPost,
} from "./detail-views";

/**
 * One circle, opened.
 *
 * ── What is real ────────────────────────────────────────────────────────────
 * The banner, the About card, the member count, the feed, writing a post,
 * liking one, joining and leaving are all live against `/community/circles`
 * and `/community/posts`. So is the pot, for a circle that is a savings
 * circle — and the pot is the reason a woman opens one of those, so it leads
 * the rail there.
 *
 * ── What the server has no field for ────────────────────────────────────────
 * A post has no category, so the filter chips read the author's own hashtags
 * (`#question`, `#tips`, …) rather than a column that does not exist — the
 * same trick the home feed uses for titles. There is no member list for a
 * circle that is not a savings one, no per-circle events, no files, and no
 * curriculum: those tabs say so in words instead of showing invented rows.
 *
 * ── Why leaving is behind a menu ────────────────────────────────────────────
 * Join and Leave were the same button in the same place. In a private circle
 * that mis-tap costs her the room and everything said in it.
 */

/* ── Saved posts, in her own browser — shared with the Circle home ───────── */

const SAVED_KEY = "womsakhi.circle.saved";
const readSaved = (): string => {
  try { return localStorage.getItem(SAVED_KEY) ?? ""; } catch { return ""; }
};
let bump: (() => void) | null = null;
const onSaved = (cb: () => void) => { bump = cb; return () => { bump = null; }; };

const TABS = ["Discussion", "Members", "Events", "Files", "About"] as const;
type Tab = (typeof TABS)[number];

/**
 * The chips, and the hashtag each one looks for.
 *
 * Author-driven, not guessed: a post is under "Tips & tutorials" because its
 * writer put `#tips` in it, which is a thing she chose to say. Classifying by
 * keyword would file other women's posts under headings they never picked.
 */
const KINDS = [
  { label: "All posts",        tag: null },
  { label: "Questions",        tag: "question" },
  { label: "Tips & tutorials", tag: "tips" },
  { label: "Business ideas",   tag: "idea" },
  { label: "Showcase",         tag: "showcase" },
  { label: "Announcements",    tag: "announcement" },
] as const;

const tagsOf = (body: string) =>
  (body.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase());

export default function CircleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();

  const [tab, setTab] = useState<Tab>("Discussion");
  const [kind, setKind] = useState<string>(KINDS[0].label);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedRaw = useSyncExternalStore(onSaved, readSaved, () => "");
  const saved = useMemo(() => new Set(savedRaw.split(",").filter(Boolean)), [savedRaw]);

  const { data: circle, source, refetch } = useResource(
    useCallback((s?: AbortSignal) => apiCircle(id, s).catch(() => null), [id]),
    null as ApiCircleDetail | null);
  const { data: posts, refetch: rePosts } = useResource(
    useCallback((s?: AbortSignal) => apiCirclePosts(id, s).catch(() => []), [id]),
    [] as CirclePost[]);
  const { data: savings } = useResource(
    useCallback((s?: AbortSignal) => apiCircleSavings(id, s).catch(() => null), [id]),
    null as ApiCircleSavings | null);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 3200);
  }, []);

  /* ── The feed ─────────────────────────────────────────────────────────── */

  const feed: CircleFeedPost[] = useMemo(() => posts.map((p) => {
    const tags = tagsOf(p.body);
    const hit = KINDS.find((k) => k.tag && tags.includes(k.tag));
    return {
      id: p.id, author: p.author_name, avatar: p.author_avatar, when: p.when,
      body: p.body, image: p.image, likes: p.likes, liked: p.liked_by_me,
      replies: p.reply_count, mine: p.mine, pinned: p.pinned,
      kind: hit?.label ?? null,
    };
  }), [posts]);

  const shown = useMemo(() => {
    const chosen = KINDS.find((k) => k.label === kind);
    const rows = !chosen?.tag ? feed : feed.filter((p) => tagsOf(p.body).includes(chosen.tag!));
    // Pinned first, always — it is pinned because somebody needs it read.
    return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [feed, kind]);

  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [
    k.label,
    k.tag ? feed.filter((p) => tagsOf(p.body).includes(k.tag!)).length : feed.length,
  ])), [feed]);

  /* ── What she can do ──────────────────────────────────────────────────── */

  const joined = circle?.joined ?? false;

  const membership = useCallback(async (want: "join" | "leave") => {
    setBusy("membership"); setError(null); setMenuOpen(false);
    try {
      if (want === "join") { await apiJoinCircle(id); say("You are in — say hello."); }
      else { await apiLeaveCircle(id); say("You have left this circle."); }
      refetch();
    } catch { setError("Could not change that just now. Nothing has changed."); }
    finally { setBusy(null); }
  }, [id, refetch, say]);

  const post = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy("post"); setError(null);
    try {
      await apiCreatePost(id, body);
      setDraft("");
      rePosts(); refetch();
      say("Posted — the circle can see it");
    } catch { setError("That did not post. Nothing you wrote is lost — try again."); }
    finally { setBusy(null); }
  }, [draft, id, rePosts, refetch, say]);

  const like = useCallback(async (p: CircleFeedPost) => {
    setBusy(p.id); setError(null);
    try { await apiLikePost(p.id); rePosts(); }
    catch { setError("Could not like that just now."); }
    finally { setBusy(null); }
  }, [rePosts]);

  const save = useCallback((p: CircleFeedPost) => {
    const next = new Set(saved);
    if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
    try { localStorage.setItem(SAVED_KEY, [...next].join(",")); } catch { /* private window */ }
    bump?.();
    say(next.has(p.id) ? "Saved — it is under Saved in Circle" : "Removed from saved");
  }, [saved, say]);

  const copyLink = useCallback(async (url: string, msg: string) => {
    try { await navigator.clipboard.writeText(url); say(msg); }
    catch { say(url); }
  }, [say]);

  const invite = useCallback(
    () => copyLink(`${window.location.origin}/app/circles/${id}`,
                   "Circle link copied — send it on WhatsApp"),
    [copyLink, id]);

  const share = useCallback((p: CircleFeedPost) =>
    copyLink(`${window.location.origin}/app/circles/${id}#${p.id}`, "Link copied"),
    [copyLink, id]);

  /* ── Still on its way, or not there at all ────────────────────────────── */

  if (!circle && source === "loading") {
    return (
      <HomeShell active="/app/circles" skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!circle) {
    return (
      <HomeShell active="/app/circles">
        <Back to="/app/circles" label="Circle" />
        <Card>
          <EmptyState
            icon="SearchX"
            title="That circle is not here"
            body="It may have closed, or the link may be old."
            action={<Btn href="/app/circles" iconEnd="ArrowRight">All circles</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const rail = (
    <div className="space-y-4">
      {savings?.is_savings && (
        <PotCard id={id} monthlyLabel={formatMoney(savings.monthly_minor)}
                 round={savings.round} paid={savings.members_paid}
                 total={savings.members_total} youPaid={savings.you_paid}
                 whoseTurn={savings.whose_turn} />
      )}
      <AboutCircle c={circle} posts={posts.length} />
      <MembersCard count={circle.member_count} people={savings?.members ?? []} />
      <CircleEventsRail />
    </div>
  );

  return (
    <HomeShell active="/app/circles" rail={rail} loadFailed="this circle">
      <div className="flex flex-col">
        <Back to="/app/circles" label="Circle" />

        <CircleBanner c={circle} posts={posts.length} onInvite={invite} />

        <CircleActions joined={joined} busy={busy === "membership"} menuOpen={menuOpen}
                       onMenu={setMenuOpen} onInvite={invite}
                       onJoin={() => membership("join")} onLeave={() => membership("leave")} />

        <div className="mb-4">
          <Tabs items={TABS as unknown as string[]} active={tab} onChange={(t) => setTab(t as Tab)} />
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            {error}
          </p>
        )}

        {tab === "Discussion" && (
          <>
            <Composer value={draft} onChange={setDraft} onPost={post} busy={busy === "post"}
                      avatar={me.avatar} name={me.first} joined={joined} onSoon={say} />

            <div className="ux-noscroll mb-4 flex items-center gap-2 overflow-x-auto pb-1">
              {KINDS.map((k) => {
                const on = kind === k.label;
                return (
                  <button key={k.label} type="button" onClick={() => setKind(k.label)} aria-pressed={on}
                          className="ux-press ux-sq flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold"
                          style={{ background: v(on ? "--ux-fill" : "--ux-surface"),
                                   color: v(on ? "--ux-on-brand" : "--ux-ink-2"),
                                   border: `1px solid ${v(on ? "--ux-fill" : "--ux-line")}` }}>
                    {k.label}
                    <span className="text-3xs font-extrabold"
                          style={{ opacity: 0.7 }}>{counts[k.label] ?? 0}</span>
                  </button>
                );
              })}
            </div>

            {shown.length > 0 ? (
              shown.map((p) => (
                <CirclePostCard key={p.id} p={p} saved={saved.has(p.id)} busy={busy === p.id}
                                onLike={like} onSave={save} onShare={share} />
              ))
            ) : (
              <NotBuiltYet
                icon="MessagesSquare"
                title={kind === KINDS[0].label ? "Nothing said here yet" : `Nothing under ${kind.toLowerCase()} yet`}
                body={kind === KINDS[0].label
                  ? "Be the first. A question with a real detail in it gets more answers than a general one."
                  : `Posts land here when someone writes #${KINDS.find((k) => k.label === kind)?.tag} in them.`}
                action={joined
                  ? <Btn size="sm" icon="Plus" onClick={() => setTab("Discussion")}>Write something</Btn>
                  : <Btn size="sm" icon="Plus" onClick={() => membership("join")}>Join first</Btn>}
              />
            )}
          </>
        )}

        {tab === "Members" && (
          savings?.members?.length ? (
            <Card>
              <h2 className="mb-3 text-lg font-extrabold" style={{ color: v("--ux-ink") }}>
                Who is in this circle
              </h2>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {savings.members.map((m) => (
                  <li key={m.name} className="flex items-center gap-3 py-3">
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold"
                          style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.avatar ? <img src={m.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                                       className="h-full w-full object-cover" />
                                : m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                        {m.name}{m.you ? " (you)" : ""}
                      </span>
                      <span className="mt-0.5 block text-2xs" style={{ color: v("--ux-muted") }}>
                        Turn {m.turn} · {m.paid ? "paid this round" : "not paid yet"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <NotBuiltYet
              icon="Users"
              title={`${circle.member_count} women are in this circle`}
              body="The server sends the count but not the list, so there is nobody here to name yet. You will meet them as they post."
              action={<Btn size="sm" onClick={() => setTab("Discussion")}>Read the discussion</Btn>}
            />
          )
        )}

        {tab === "Events" && (
          <NotBuiltYet
            icon="CalendarDays"
            title="This circle has no meets of its own yet"
            body="Circles cannot hold their own events yet. Workshops and melas open to every woman on WomSakhi are under Events."
            action={<Btn size="sm" href="/app/events" iconEnd="ArrowRight">See all events</Btn>}
          />
        )}

        {tab === "Files" && (
          <NotBuiltYet
            icon="FileText"
            title="No shared files yet"
            body="Patterns, price lists and templates will live here. Until then, put a link in a post — everyone in the circle can open it."
            action={<Btn size="sm" onClick={() => setTab("Discussion")}>Write a post</Btn>}
          />
        )}

        {tab === "About" && (
          <Card>
            <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>About this circle</h2>
            <p className="mt-2.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {circle.desc || "Nobody has written a description yet."}
            </p>
            {circle.guidelines && (
              <>
                <h3 className="mt-5 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
                  How women here treat each other
                </h3>
                <p className="mt-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {circle.guidelines}
                </p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Btn variant="outline" icon="UserPlus" onClick={invite}>Invite someone</Btn>
              {joined && (
                <Btn variant="ghost" icon="LogOut" disabled={busy === "membership"}
                     onClick={() => membership("leave")}>
                  Leave this circle
                </Btn>
              )}
            </div>
          </Card>
        )}

        <div className="ux-toast rounded-[12px] px-5 py-3.5 text-xsm font-bold"
             data-on={note ? "true" : "false"} role="status" aria-live="polite"
             style={{ background: v("--ux-ink"), color: v("--ux-canvas"),
                      boxShadow: "0 20px 44px -18px rgba(0,0,0,.6)",
                      pointerEvents: note ? undefined : "none" }}>
          {note}
        </div>
      </div>
    </HomeShell>
  );
}

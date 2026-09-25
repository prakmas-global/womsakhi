"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { Btn, Card, EmptyState, I, Tabs, v } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiCircles, apiCommunityOverview, apiJoinCircle, apiLikePost,
  type Circle, type CommunityOverview,
} from "@/lib/community-api";
import { apiRegisterForEvent } from "@/lib/growth-api";
import {
  loadSavedPosts, savedPostsServerSnapshot, savedPostsSnapshot,
  subscribeSavedPosts, toggleSavedPost,
} from "@/lib/saved-posts";
import { useEvents } from "@/components/ux/growth";
import { ALL_TOPICS as RAW_ALL_TOPICS, topicOf, type Topic } from "@/components/ux/circle/data";
import {
  CircleHero, CircleQuote, MyCircle, PopularGroups, PostCard, TopicChips,
  Trending, UpcomingEvents,
  type FeedPost, type RailEvent, type Trend,
} from "./circle-views";
import { useTranslated } from "@/i18n/data";

/**
 * Circle — where women talk to each other.
 *
 * ── Everything on this screen is somebody's real words ──────────────────────
 * The feed, the trending three, the topic counts, the popular circles and her
 * own three numbers all come from `/community/overview` and
 * `/community/circles`. A post's heading and its hashtags are read out of the
 * body its author typed (see `readPost`) rather than invented, and a post's
 * category is its circle's topic — so nothing here says a woman wrote
 * something she did not.
 *
 * ── Saving, and sharing ─────────────────────────────────────────────────────
 * Saving a post goes to `POST /saved` under the `post` kind, so it follows her
 * to the next phone she signs in on — see `@/lib/saved-posts`. It used to be
 * `localStorage`, and the note here used to explain that as a limit.
 *
 * Sharing does NOT pretend. A circle is behind the sign-in, so there is no URL
 * a friend who is not a member can open; the button therefore copies a link to
 * the post for someone who IS one, and says exactly that. It used to say "send
 * it on WhatsApp" while copying the same circle address for all 26 posts.
 *
 * ── Why the savings pot is still here ───────────────────────────────────────
 * This screen used to be four views, one of which was the pot she pays into
 * every month. The discussion design replaces the other three; dropping the
 * pot with them would take a woman's live financial commitment off the only
 * screen that led to it. It sits at the top of the rail instead.
 */

const EMPTY: CommunityOverview = { circles: [], circle_id: null, savings: null, posts: [] };
const TABS = ["Latest", "Following", "My posts", "Saved"] as const;
type Tab = (typeof TABS)[number];

export default function CirclePage() {
  const ALL_TOPICS = useTranslated(RAW_ALL_TOPICS);
  const tr = useT();
  const router = useRouter();
  const [ask, setAsk] = useState("");
  const [topic, setTopic] = useState(ALL_TOPICS);
  const [tab, setTab] = useState<Tab>("Latest");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedRaw = useSyncExternalStore(
    subscribeSavedPosts, savedPostsSnapshot, savedPostsServerSnapshot);
  const saved = useMemo(() => new Set(savedRaw.split(",").filter(Boolean)), [savedRaw]);
  useEffect(() => { loadSavedPosts().catch(() => {}); }, []);

  const { data: overview, refetch } = useResource(
    useCallback((s?: AbortSignal) => apiCommunityOverview(s), []), EMPTY);
  const { data: allCircles, refetch: reCircles } = useResource(
    useCallback(() => apiCircles({}), []), [] as Circle[]);
  const events = useEvents();

  /** id → circle, so a post can name the room it was said in. */
  const byId = useMemo(
    () => new Map(allCircles.concat(overview.circles).map((c) => [c.id, c])),
    [allCircles, overview.circles]);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 2600);
  }, []);

  /* ── The feed ─────────────────────────────────────────────────────────── */

  const feed: FeedPost[] = useMemo(() => overview.posts.map((p) => {
    const c = byId.get(p.circle_id);
    return {
      id: p.id,
      author: p.author_name,
      avatar: p.author_avatar,
      when: p.when,
      body: p.body,
      topic: topicOf(c?.topic),
      likes: p.likes,
      liked: p.liked_by_me,
      replies: p.reply_count,
      mine: p.mine,
      href: c ? `/app/circles/${c.id}` : "/app/circles",
    };
  }), [overview.posts, byId]);

  const shown = useMemo(() => {
    const byTopic = topic === ALL_TOPICS ? feed : feed.filter((p) => p.topic.label === topic);
    if (tab === "Following") return byTopic.filter((p) => byId.get(overview.posts.find((q) => q.id === p.id)?.circle_id ?? "")?.joined);
    if (tab === "My posts") return byTopic.filter((p) => p.mine);
    if (tab === "Saved") return byTopic.filter((p) => saved.has(p.id));
    return byTopic;
  }, [feed, topic, tab, saved, byId, overview.posts]);

  /** The three most talked about — likes and replies together, because a post
   *  with forty replies and two likes is the busier conversation. */
  const trending: Trend[] = useMemo(() => {
    const seen = new Set<string>();
    return [...feed]
    .sort((a, b) => (b.likes + b.replies * 2) - (a.likes + a.replies * 2))
    .filter((p) => {
      // One row per distinct question. Three cards saying the same sentence
      // is not a trend, it is a bug the reader has to work out for herself.
      const k = p.body.trim().toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.body.split(/\n/)[0].replace(/#[\p{L}\p{N}_]+/gu, "").trim().slice(0, 88) || p.body.slice(0, 88),
      topic: p.topic,
      replies: p.replies,
      likes: p.likes,
      faces: [p.avatar, "", ""],
      href: p.href,
    }));
  }, [feed]);

  /* ── The rail ─────────────────────────────────────────────────────────── */

  const { chipTopics, counts } = useMemo(() => {
    const n: Record<string, number> = { [ALL_TOPICS]: allCircles.length };
    const seen = new Map<string, Topic>();
    for (const c of allCircles) {
      const t = topicOf(c.topic);
      n[t.label] = (n[t.label] ?? 0) + 1;
      if (!seen.has(t.label)) seen.set(t.label, t);
    }
    // Busiest first, and the seven named categories ahead of a one-off word
    // somebody typed once. A chip for a topic with nothing under it is a
    // dead end she has to back out of.
    const chips = [...seen.values()].sort((a, b) =>
      (b.id.startsWith("other:") ? 0 : 1) - (a.id.startsWith("other:") ? 0 : 1) ||
      (n[b.label] ?? 0) - (n[a.label] ?? 0));
    return { chipTopics: chips, counts: n };
  }, [allCircles]);

  const popular = useMemo(() => [...allCircles]
    .sort((a, b) => Number(a.joined) - Number(b.joined) || b.member_count - a.member_count)
    .slice(0, 5), [allCircles]);

  const railEvents: RailEvent[] = useMemo(() => (events.data?.upcoming ?? [])
    .slice(0, 2)
    .map((e) => ({
      id: e.id, title: e.title, day: e.day, month: e.month,
      when: `${e.when} · ${e.time}`, going: e.going, taken: e.taken,
      href: `/app/events/${e.id}`,
    })), [events.data]);

  const mine = useMemo(() => feed.filter((p) => p.mine), [feed]);
  const likesReceived = useMemo(() => mine.reduce((n, p) => n + p.likes, 0), [mine]);

  /* ── What she can do ──────────────────────────────────────────────────── */

  const like = useCallback(async (p: FeedPost) => {
    setBusy(p.id); setError(null);
    try { await apiLikePost(p.id); refetch(); }
    catch { setError("Could not like that just now."); }
    finally { setBusy(null); }
  }, [refetch]);

  const save = useCallback(async (p: FeedPost) => {
    setError(null);
    try {
      const on = await toggleSavedPost(p.id);
      say(on ? "Saved — find it under Saved, on any phone you sign in on"
             : "Removed from saved");
    } catch {
      // The store has already put the bookmark back, so this describes what
      // she can see rather than contradicting it.
      setError("That did not save. Nothing has changed — try again in a moment.");
    }
  }, [say]);

  /**
   * The post, and only for someone who can open it.
   *
   * This built `${origin}${p.href}` where `p.href` was the post's *circle* — so
   * all 26 buttons copied the same address, and it went to the room rather than
   * the thing she meant to pass on. The fragment names the post, and the
   * circle page scrolls to it.
   *
   * The sentence is the other half of the fix. A circle sits behind the
   * sign-in; there is no public address for a post, and "send it on WhatsApp"
   * promised a friend could open it. She can still send it — to another woman
   * on WomSakhi — and now the toast says which.
   */
  const share = useCallback(async (p: FeedPost) => {
    const url = `${window.location.origin}${p.href}#${p.id}`;
    try {
      await navigator.clipboard.writeText(url);
      say("Link to this post copied — it opens for women signed in to WomSakhi");
    } catch { say(url); }
  }, [say]);

  const join = useCallback(async (c: Circle) => {
    if (c.joined) { router.push(`/app/circles/${c.id}`); return; }
    setBusy(c.id); setError(null);
    try { await apiJoinCircle(c.id); reCircles(); refetch(); say(`You are in ${c.name}`); }
    catch { setError("Could not join that circle just now."); }
    finally { setBusy(null); }
  }, [router, reCircles, refetch, say]);

  const register = useCallback(async (e: RailEvent) => {
    if (e.going) { router.push(e.href); return; }
    setBusy(e.id); setError(null);
    try { await apiRegisterForEvent(e.id); events.refetch(); say(`You are going to ${e.title}`); }
    catch { setError("Could not register for that just now."); }
    finally { setBusy(null); }
  }, [router, events, say]);

  /** The ask box and the rail button land in the same place. */
  const start = useCallback(() => {
    const q = ask.trim();
    const first = overview.circles.find((c) => c.joined) ?? overview.circles[0] ?? popular[0];
    router.push(first
      ? `/app/circles/${first.id}${q ? `?ask=${encodeURIComponent(q)}` : ""}`
      : "/app/circles/create");
  }, [ask, overview.circles, popular, router]);

  const savingsCircle = overview.circles.find((c) => c.id === overview.circle_id) ?? null;

  const rail = (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <Btn full icon="Plus" onClick={start}>{tr("circles.startADiscussion")}</Btn>
        <Btn full variant="soft" icon="UsersRound" href="/app/circles/create">
          {tr("circles.createACircle")}
        </Btn>
      </div>

      {/* Her live financial commitment, kept in reach. */}
      {savingsCircle && overview.savings && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                  style={{ background: v("--ux-tint-amber"), color: v("--ux-amber-ink") }}>
              <Icons.Coins className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{tr("circles.yourSavingsPot")}</p>
              <p className="mt-0.5 text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>
                {savingsCircle.name} · {overview.savings.members_paid} of {overview.savings.members.length} paid
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Btn size="sm" full variant={overview.savings.you_paid ? "outline" : "primary"}
                 href={`/app/circles/${savingsCircle.id}${overview.savings.you_paid ? "" : "/pay"}`}>
              {overview.savings.you_paid ? "See the pot" : "Pay this month"}
            </Btn>
          </div>
        </Card>
      )}

      <MyCircle posts={mine.length} likes={likesReceived} saved={saved.size} />
      <PopularGroups rows={popular} busy={busy} onJoin={join} />
      {railEvents.length > 0 && <UpcomingEvents rows={railEvents} busy={busy} onGo={register} />}
      <CircleQuote />
    </div>
  );

  return (
    <HomeShell active="/app/circles" rail={rail} loadFailed="the circle">
      <div className="flex flex-col">
        <CircleHero ask={ask} onAsk={setAsk} onStart={start} />

        <TopicChips active={topic} onPick={setTopic} topics={chipTopics} counts={counts} />

        {error && (
          <p role="alert" className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            {error}
          </p>
        )}

        {trending.length > 0 && <Trending rows={trending} />}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* `Tabs` is an `inline-flex` with no wrap and no scroller, so four
              tabs at 390px pushed the page sideways. `.ux-scroll-x` gives it
              somewhere to go and hides the bar. */}
          {/* Four ways to read the feed: on a phone, a segmented control. */}
          <SegmentedControl<Tab> className="lg:hidden" label="Show" value={tab} onChange={setTab}
            options={TABS.map((t) => ({ value: t, label: t }))} />
          <div className="ux-scroll-x -mx-[20px] hidden max-w-[calc(100%+40px)] overflow-x-auto px-[20px] lg:mx-0 lg:block lg:max-w-none lg:overflow-visible lg:px-0">
            {/* `w-max` — see the note on the same wrapper in `profile/page.tsx`. */}
            <div className="w-max">
              <Tabs items={TABS as unknown as string[]} active={tab}
                    onChange={(t) => setTab(t as Tab)} />
            </div>
          </div>
          {topic !== ALL_TOPICS && (
            <button type="button" onClick={() => setTopic(ALL_TOPICS)}
                    className="ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-3 text-xs font-bold"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              {topic}
              <Icons.X className="h-[13px] w-[13px]" />
            </button>
          )}
        </div>

        {shown.length > 0 ? (
          shown.map((p) => (
            <PostCard key={p.id} p={p} saved={saved.has(p.id)} busy={busy === p.id}
                      onLike={like} onSave={save} onShare={share} />
          ))
        ) : (
          <Card>
            <EmptyState
              icon={tab === "Saved" ? "Bookmark" : "MessagesSquare"}
              title={tab === "Saved" ? "Nothing saved yet"
                   : tab === "My posts" ? "You have not written anything yet"
                   : tab === "Following" ? "Join a circle and its posts land here"
                   : "No discussions here yet"}
              body={tab === "Saved"
                ? "The bookmark on any post keeps it here — on this phone and on any other you sign in on."
                : "Ask the first question. Somebody who has been where you are will answer it."}
              action={<Btn size="sm" icon="Plus" onClick={start}>{tr("circles.startADiscussion")}</Btn>}
            />
          </Card>
        )}

        <div className="mt-5">
          <Link href="/app/circles/create"
                /* The phone's primary action: 50px, radius 14, 17px bold. Not
                   `.ux-action-primary`, whose unlayered 16px beat the 17 here. */
                className="ux-press ux-sq flex items-center justify-center gap-2 rounded-[16px] px-5 py-4 text-[17px] font-bold lg:text-xsm max-lg:min-h-[50px] max-lg:rounded-[14px] max-lg:px-4 max-lg:py-3"
                style={{ background: v("--ux-brand-tint"), border: `1px solid ${v("--ux-brand")}`,
                         color: v("--ux-brand") }}>
            <I name="UsersRound" className="h-[16px] w-[16px]" />
            {tr("circles.startACircleOfYourOwn")}
          </Link>
        </div>

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

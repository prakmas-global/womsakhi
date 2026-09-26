"use client";

import { use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  Back, Btn, Card, EmptyState, RailSkeleton, ScreenSkeleton, v,
} from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { useMe } from "@/components/ux/me";
import {
  apiCircle, apiCirclePosts, apiCircleSavings,
  apiCircleMembers, apiSetCircleMuted, apiUpdateCircle,
  type ApiCircleDetail, type ApiCircleMember, type ApiCircleSavings, type CirclePost,
} from "@/lib/growth-api";
import { apiFileReport } from "@/lib/safety-api";
import { apiCreatePost, apiDeletePost, apiJoinCircle, apiLeaveCircle, apiLikePost } from "@/lib/community-api";
import {
  loadSavedPosts, savedPostsServerSnapshot, savedPostsSnapshot,
  subscribeSavedPosts, toggleSavedPost,
} from "@/lib/saved-posts";
import { formatMoney } from "@/components/ux/kit/money";
import { apiRegisterForEvent } from "@/lib/growth-api";
import { useConfirm } from "@/design-system";
import { useEvents, useLearning } from "@/components/ux/growth";
import {
  AboutCircle, CircleActions, CircleBanner, CirclePostCard, Composer,
  EventsRail, MembersCard, NotBuiltYet, PotCard, ResourcesRail, UnderTabs,
  type CircleFeedPost, type RailEvent,
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

const TABS = ["Discussion", "Learning", "Events", "Files", "Members", "About"] as const;
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

const SORTS = ["Latest", "Most liked", "Most replies"] as const;
type Sort = (typeof SORTS)[number];

export default function CircleDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ask?: string | string[] }>;
}) {
  const tr = useT();
  const confirm = useConfirm();
  const { id } = use(params);
  const me = useMe();

  /**
   * The question she typed on the Circle home, carried the rest of the way.
   *
   * "Ask the circle…" sends her here as `?ask=<her text>`, and this screen used
   * to ignore the parameter completely: the composer loaded empty and the
   * sentence she had written was gone. Nothing said so — the navigation looked
   * like it had worked, which is the worst way to lose somebody's words.
   *
   * Read off the page's own `searchParams` prop, which a client page may take
   * through `use()`. Not `useSearchParams` — that forces every route above into
   * a Suspense boundary (see the note in `HomeShell`, where skipping it blanked
   * thirty-eight screens) — and not `window.location` in an effect, which is
   * either a hydration mismatch on a controlled textarea or a `setState` inside
   * an effect. This is the same value on the server and on the client.
   *
   * `?ask=` is deliberately left in the address bar. Taking it out means
   * writing the text into state first, and the moment the parameter and the
   * state disagree her sentence is one stray re-render from vanishing.
   */
  const asked = use(searchParams).ask;
  const carried = (Array.isArray(asked) ? asked[0] ?? "" : asked ?? "").trim();

  const [tab, setTab] = useState<Tab>("Discussion");
  const [kind, setKind] = useState<string>(KINDS[0].label);
  const [sort, setSort] = useState<Sort>("Latest");
  const [postMenu, setPostMenu] = useState<string | null>(null);
  // `null` until she touches the box, so the carried question shows through.
  // `""` once she has cleared it — nullish coalescing keeps an empty box empty.
  const [typed, setTyped] = useState<string | null>(null);
  const [postImage, setPostImage] = useState("");
  const draft = typed ?? carried;
  const [menu, setMenu] = useState<"joined" | "more" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  /**
   * A shared "#<post>" link, landed on.
   *
   * The browser scrolls to a fragment while the page is loading, which is
   * before the posts exist — so the link opened the circle at the top and the
   * post it named was somewhere below, unremarked. This waits for the post to
   * be in the document and then goes to it.
   */
  useEffect(() => {
    const want = window.location.hash.slice(1);
    if (!want) return;
    let tries = 0;
    const tick = window.setInterval(() => {
      const el = document.getElementById(want);
      if (el) { el.scrollIntoView({ block: "start" }); window.clearInterval(tick); }
      else if (++tries > 40) window.clearInterval(tick);   // ~8s, then give up
    }, 200);
    return () => window.clearInterval(tick);
  }, []);

  const savedRaw = useSyncExternalStore(
    subscribeSavedPosts, savedPostsSnapshot, savedPostsServerSnapshot);
  const saved = useMemo(() => new Set(savedRaw.split(",").filter(Boolean)), [savedRaw]);
  useEffect(() => { loadSavedPosts().catch(() => {}); }, []);

  const { data: circle, source, refetch } = useResource(
    useCallback((s?: AbortSignal) => apiCircle(id, s).catch(() => null), [id]),
    null as ApiCircleDetail | null);
  const { data: posts, refetch: rePosts } = useResource(
    useCallback((s?: AbortSignal) => apiCirclePosts(id, s).catch(() => []), [id]),
    [] as CirclePost[]);
  const { data: savings } = useResource(
    useCallback((s?: AbortSignal) => apiCircleSavings(id, s).catch(() => null), [id]),
    null as ApiCircleSavings | null);
  const { data: members } = useResource(
    useCallback((s?: AbortSignal) => apiCircleMembers(id, s).catch(() => []), [id]),
    [] as ApiCircleMember[]);

  const events = useEvents();
  const learning = useLearning();
  const railEvents: RailEvent[] = useMemo(() => (events.data?.upcoming ?? [])
    .slice(0, 2)
    .map((e) => ({
      id: e.id, title: e.title, day: e.day, month: e.month,
      when: `${e.when} · ${e.time}`, going: e.going, taken: e.taken,
      href: `/app/events/${e.id}`,
    })), [events.data]);
  const circleCourses = useMemo(() => {
    const words = `${circle?.topic ?? ""} ${(circle?.tags ?? []).join(" ")}`.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = [...learning.data.continuing, ...learning.data.picks];
    const scored = rows.map((course) => ({ course, score: words.filter((word) =>
      `${course.title} ${course.category}`.toLowerCase().includes(word)).length }));
    return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((row) => row.course);
  }, [circle?.tags, circle?.topic, learning.data]);

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
    const by = sort === "Most liked" ? (a: CircleFeedPost, b: CircleFeedPost) => b.likes - a.likes
             : sort === "Most replies" ? (a: CircleFeedPost, b: CircleFeedPost) => b.replies - a.replies
             : () => 0;   // "Latest" is the order the server sent
    // Pinned first, whatever the sort — it is pinned because somebody needs it read.
    return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by(a, b));
  }, [feed, kind, sort]);

  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [
    k.label,
    k.tag ? feed.filter((p) => tagsOf(p.body).includes(k.tag!)).length : feed.length,
  ])), [feed]);

  /* ── What she can do ──────────────────────────────────────────────────── */

  const joined = circle?.joined ?? false;

  const membership = useCallback(async (want: "join" | "leave") => {
    setBusy("membership"); setError(null); setMenu(null);
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
      await apiCreatePost(id, body, postImage);
      setTyped("");
      setPostImage("");
      rePosts(); refetch();
      say("Posted — the circle can see it");
    } catch { setError("That did not post. Nothing you wrote is lost — try again."); }
    finally { setBusy(null); }
  }, [draft, id, postImage, rePosts, refetch, say]);

  const like = useCallback(async (p: CircleFeedPost) => {
    setBusy(p.id); setError(null);
    try { await apiLikePost(p.id); rePosts(); }
    catch { setError("Could not like that just now."); }
    finally { setBusy(null); }
  }, [rePosts]);

  const removePost = useCallback(async (p: CircleFeedPost) => {
    if (!p.mine) return;
    setBusy(p.id); setError(null); setPostMenu(null);
    try {
      await apiDeletePost(p.id);
      rePosts(); refetch();
      say("Your post was deleted");
    } catch { setError("That post could not be deleted. Nothing has changed."); }
    finally { setBusy(null); }
  }, [rePosts, refetch, say]);

  const report = useCallback(async (kind: "circle" | "post", post?: CircleFeedPost) => {
    const target = kind === "circle" ? circle?.name ?? id : `${post?.author ?? "Member"}'s post`;
    const approved = await confirm({
      title: `Report ${target}?`,
      description: "This sends it privately to the WomSakhi safety team for review. The circle or post author is not told who reported it.",
      confirmLabel: "Send report",
      danger: true,
    });
    if (!approved) return;
    setBusy(`report-${post?.id ?? id}`); setError(null); setPostMenu(null); setMenu(null);
    try {
      await apiFileReport({
        category: "Something in a circle or post",
        details: kind === "circle"
          ? `Please review the circle “${circle?.name ?? id}” and its recent activity.`
          : `Please review the selected post by ${post?.author ?? "a member"} in “${circle?.name ?? id}”.`,
        about: kind === "circle" ? `circle:${id}` : `post:${post?.id ?? ""}`,
      });
      say("Report sent privately to the safety team");
    } catch { setError("The report could not be sent. Please try again."); }
    finally { setBusy(null); }
  }, [circle?.name, confirm, id, say]);

  const toggleMute = useCallback(async () => {
    if (!circle) return;
    setBusy("mute"); setError(null); setMenu(null);
    try {
      await apiSetCircleMuted(id, !circle.muted);
      refetch();
      say(circle.muted ? "Circle notifications are on" : "Circle notifications are muted");
    } catch { setError("Notification settings could not be changed."); }
    finally { setBusy(null); }
  }, [circle, id, refetch, say]);

  const saveCircle = useCallback(async (body: Parameters<typeof apiUpdateCircle>[1]) => {
    setBusy("edit"); setError(null);
    try {
      await apiUpdateCircle(id, body);
      setEditing(false); refetch(); say("Circle details updated");
    } catch { setError("Circle details could not be saved. Nothing has changed."); }
    finally { setBusy(null); }
  }, [id, refetch, say]);

  /** On the server under the `post` kind — see `@/lib/saved-posts`. It was
   *  `localStorage`, which meant her bookmarks lived on one handset. */
  const save = useCallback(async (p: CircleFeedPost) => {
    setError(null);
    try {
      const on = await toggleSavedPost(p.id);
      say(on ? "Saved — it is under Saved in Circle, on any phone you sign in on"
             : "Removed from saved");
    } catch {
      setError("That did not save. Nothing has changed — try again in a moment.");
    }
  }, [say]);

  const register = useCallback(async (e: RailEvent) => {
    setBusy(e.id); setError(null);
    try { await apiRegisterForEvent(e.id); events.refetch(); say(`You are going to ${e.title}`); }
    catch { setError("Could not register for that just now."); }
    finally { setBusy(null); }
  }, [events, say]);

  const copyLink = useCallback(async (url: string, msg: string) => {
    try { await navigator.clipboard.writeText(url); say(msg); }
    catch { say(url); }
  }, [say]);

  const invite = useCallback(
    () => copyLink(`${window.location.origin}/app/circles/${id}`,
                   "Circle link copied — send it on WhatsApp"),
    [copyLink, id]);

  /** Says who the copied address opens for. A circle is behind the sign-in. */
  const share = useCallback((p: CircleFeedPost) =>
    copyLink(`${window.location.origin}/app/circles/${id}#${p.id}`,
             "Link to this post copied — it opens for women signed in to WomSakhi"),
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
            title={tr("circles.thatCircleIsNotHere")}
            body={tr("circles.itMayHaveClosedOrThe")}
            action={<Btn href="/app/circles" iconEnd="ArrowRight">{tr("circles.all")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const rail = (
    <div className="space-y-4">
      <CircleActions joined={joined} muted={circle.muted} busy={busy === "membership" || busy === "mute"} menu={menu} onMenu={setMenu}
                     onInvite={invite} onMute={toggleMute} onReport={() => report("circle")}
                     onJoin={() => membership("join")} onLeave={() => membership("leave")} />

      {savings?.is_savings && (
        <PotCard id={id} monthlyLabel={formatMoney(savings.monthly_minor)}
                 round={savings.round} paid={savings.members_paid}
                 total={savings.members_total} youPaid={savings.you_paid}
                 whoseTurn={savings.whose_turn} />
      )}
      <AboutCircle c={circle} posts={posts.length}
                   onEdit={() => circle.owner ? setEditing(true) : say("Only this circle's host can change its details.")} />
      <MembersCard count={circle.member_count} people={members}
                   onAll={() => setTab("Members")} />
      <EventsRail rows={railEvents} busy={busy} onGo={register} />
      <ResourcesRail circleId={id} />
    </div>
  );

  return (
    <HomeShell active="/app/circles" rail={rail} loadFailed="this circle">
      <div className="flex flex-col">
        <Back to="/app/circles" label="Circle" />

        <CircleBanner c={circle} posts={posts.length} events={railEvents.length} />

        <UnderTabs items={TABS} active={tab} onChange={(t) => setTab(t as Tab)} />

        {editing && (
          <CircleEditPanel circle={circle} saving={busy === "edit"}
                           onCancel={() => setEditing(false)} onSave={saveCircle} />
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            {error}
          </p>
        )}

        {tab === "Discussion" && (
          <>
            <Composer value={draft} onChange={setTyped} onPost={post} busy={busy === "post"}
                      avatar={me.avatar} name={me.first} joined={joined && circle.can_post}
                      image={postImage} onImage={setPostImage}
                      onEvent={() => setTab("Events")} onFile={() => setTab("Files")}
                      blockedReason={joined ? "Only this circle's hosts can post" : undefined} />

            <div className="mb-4 flex items-start gap-3">
              <div className="ux-noscroll flex flex-1 items-center gap-2 overflow-x-auto pb-1">
                {KINDS.map((k) => {
                  const on = kind === k.label;
                  const n = counts[k.label] ?? 0;
                  return (
                    <button key={k.label} type="button" onClick={() => setKind(k.label)} aria-pressed={on}
                            className="ux-press ux-sq flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold"
                            style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"),
                                     color: v(on ? "--ux-on-brand" : "--ux-ink-2"),
                                     border: `1px solid ${v(on ? "--ux-fill" : "--ux-line")}` }}>
                      {k.label}
                      {/* The count only earns its place once there is one to
                          show — six chips all reading 0 is noise. */}
                      {n > 0 && k.tag && (
                        <span className="text-[12px] lg:text-3xs font-extrabold" style={{ opacity: 0.72 }}>{n}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <select value={sort} aria-label={tr("circles.sortTheDiscussion")}
                      onChange={(e) => setSort(e.target.value as Sort)}
                      className="ux-sq min-h-[38px] shrink-0 rounded-[10px] border px-3 text-xs font-semibold outline-none"
                      style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink-2") }}>
                {SORTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {shown.length > 0 ? (
              shown.map((p) => (
                <CirclePostCard key={p.id} p={p} saved={saved.has(p.id)} busy={busy === p.id}
                                menu={postMenu === p.id}
                                onMenu={(open) => setPostMenu(open ? p.id : null)}
                                onLike={like} onSave={save} onShare={share} onDelete={removePost}
                                onReport={(row) => report("post", row)} />
              ))
            ) : (
              <NotBuiltYet
                icon="MessagesSquare"
                title={kind === KINDS[0].label ? "Nothing said here yet" : `Nothing under ${kind.toLowerCase()} yet`}
                body={kind === KINDS[0].label
                  ? "Be the first. A question with a real detail in it gets more answers than a general one."
                  : `Posts land here when someone writes #${KINDS.find((k) => k.label === kind)?.tag} in them.`}
                action={joined
                  ? <Btn size="sm" icon="Plus" onClick={() => setTab("Discussion")}>{tr("circles.writeSomething")}</Btn>
                  : <Btn size="sm" icon="Plus" onClick={() => membership("join")}>{tr("circles.joinFirst")}</Btn>}
              />
            )}
          </>
        )}

        {tab === "Members" && (
          members.length ? (
            <Card>
              <h2 className="mb-3 text-lg font-extrabold" style={{ color: v("--ux-ink") }}>
                {tr("circles.whoIsInThisCircle")}
              </h2>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {members.map((m) => (
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
                      {savings?.is_savings && <span className="mt-0.5 block text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>
                        Turn {m.turn} · {m.paid ? "paid this round" : "not paid yet"}
                      </span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <NotBuiltYet
              icon="Users"
              title={`${circle.member_count} women are in this circle`}
              body={tr("circles.theServerSendsTheCountBut")}
              action={<Btn size="sm" onClick={() => setTab("Discussion")}>{tr("circles.readTheDiscussion")}</Btn>}
            />
          )
        )}

        {tab === "Learning" && (
          <Card>
            <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>Learning for this topic</h2>
            <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Courses are selected from the live catalogue using this circle&apos;s topic and tags.</p>
            {circleCourses.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {circleCourses.map((course) => <div key={course.id} className="rounded-xl border p-3" style={{ borderColor: v("--ux-line") }}>
                <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{course.title}</p>
                <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{course.category} · {course.hours || course.level}</p>
                <Btn size="sm" variant="soft" className="mt-3" href={`/app/programs/${course.id}`}>Open course</Btn>
              </div>)}
            </div> : <EmptyState icon="GraduationCap" title="No matching courses yet" body="New reviewed courses will appear here automatically." />}
            <div className="mt-4"><Btn size="sm" href="/app/programs" iconEnd="ArrowRight">{tr("circles.seeTheCourses")}</Btn></div>
          </Card>
        )}

        {tab === "Events" && (
          <Card>
            <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>Events open to this circle</h2>
            <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>These are live WomSakhi events. Registration is saved to your account.</p>
            <div className="mt-4"><EventsRail rows={(events.data?.upcoming ?? []).map((e) => ({
              id: e.id, title: e.title, day: e.day, month: e.month, when: `${e.when} · ${e.time}`,
              going: e.going, taken: e.taken, href: `/app/events/${e.id}`,
            }))} busy={busy} onGo={register} /></div>
            <div className="mt-4"><Btn size="sm" href="/app/events" iconEnd="ArrowRight">{tr("circles.seeAllEvents")}</Btn></div>
          </Card>
        )}

        {tab === "Files" && (
          <ResourcesRail circleId={id} />
        )}

        {tab === "About" && (
          <Card>
            <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>{tr("circles.aboutThisCircle")}</h2>
            <p className="mt-2.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {circle.desc || "Nobody has written a description yet."}
            </p>
            {circle.guidelines && (
              <>
                <h3 className="mt-5 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
                  {tr("circles.howWomenHereTreatEachOther")}
                </h3>
                <p className="mt-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {circle.guidelines}
                </p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Btn variant="outline" icon="UserPlus" onClick={invite}>{tr("circles.inviteSomeone")}</Btn>
              {joined && (
                <Btn variant="ghost" icon="LogOut" disabled={busy === "membership"}
                     onClick={() => membership("leave")}>
                  {tr("circles.leave")}
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

function CircleEditPanel({ circle, saving, onCancel, onSave }: {
  circle: ApiCircleDetail; saving: boolean; onCancel: () => void;
  onSave: (body: Parameters<typeof apiUpdateCircle>[1]) => void;
}) {
  const [name, setName] = useState(circle.name);
  const [topic, setTopic] = useState(circle.topic);
  const [desc, setDesc] = useState(circle.desc);
  const [guidelines, setGuidelines] = useState(circle.guidelines);
  const [tags, setTags] = useState(circle.tags.join(", "));
  const [whoPosts, setWhoPosts] = useState<"all" | "hosts">(circle.who_posts);
  return (
    <Card className="mb-4">
      <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>Edit circle details</h2>
      <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Keep the name clear and use tags women can search.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                 className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }} />
        </label>
        <label className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>Topic
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80}
                 className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }} />
        </label>
        <label className="text-xs font-bold sm:col-span-2" style={{ color: v("--ux-ink-2") }}>Description
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={600} rows={3}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }} />
        </label>
        <label className="text-xs font-bold sm:col-span-2" style={{ color: v("--ux-ink-2") }}>Guidelines
          <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} maxLength={300} rows={2}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }} />
        </label>
        <label className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>Tags, separated by commas
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="business, tailoring"
                 className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }} />
        </label>
        <label className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>Who can post
          <select value={whoPosts} onChange={(e) => setWhoPosts(e.target.value as "all" | "hosts")}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: v("--ux-line") }}>
            <option value="all">Every member</option><option value="hosts">Hosts only</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <Btn disabled={saving || name.trim().length < 2} onClick={() => onSave({
          name: name.trim(), topic: topic.trim(), desc: desc.trim(), guidelines: guidelines.trim(),
          tags: tags.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5), who_posts: whoPosts,
          review_first: circle.review_first, tell_me: circle.tell_me,
        })}>{saving ? "Saving…" : "Save changes"}</Btn>
        <Btn variant="outline" disabled={saving} onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}

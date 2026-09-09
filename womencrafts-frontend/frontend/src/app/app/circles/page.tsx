"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useResource } from "@/lib/use-resource";
import { apiCommunityOverview, apiLikePost,
         type CommunityOverview } from "@/lib/community-api";
import { apiContribute } from "@/lib/growth-api";
import { Near, Pot, Rooms, Wall,
         type CommunityActs, type CommunityData } from "./community-views";

/**
 * Community — one screen, four ways of seeing the same women.
 *
 * "Community" means four different things depending on why she opened it: the
 * pot she is paying into, the room she wants to talk in, the woman two streets
 * away with a spare stall, or simply what other women made this week. All four
 * read the same data, so none can show a different truth than its neighbour,
 * and her choice is remembered.
 */

const VIEWS = [
  { id: "pot",   label: "The pot",  icon: "Coins" },
  { id: "rooms", label: "Rooms",    icon: "MessagesSquare" },
  { id: "near",  label: "Near you", icon: "MapPin" },
  { id: "wall",  label: "The wall", icon: "LayoutGrid" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];
const KEY = "womsakhi.community.view";

/**
 * The shape of "nothing yet", as one module constant.
 *
 * `useResource` holds its fallback across renders and deliberately does not
 * list it as a dependency, so building this inline would hand it a new object
 * every render — and a memoised child a new `d` to fail to match on.
 */
const EMPTY_OVERVIEW: CommunityOverview = {
  circles: [], circle_id: null, savings: null, posts: [],
};

export default function CommunityPage() {
  const [view, setView] = useState<ViewId>("pot");
  const [km, setKm] = useState(6);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ViewId | null;
      if (saved && VIEWS.some((v) => v.id === saved)) setView(saved);
    } catch { /* private mode — the default is fine */ }
  }, []);

  const choose = (v: ViewId) => {
    setView(v);
    try { localStorage.setItem(KEY, v); } catch { /* nothing to recover */ }
  };

  /**
   * One request, not three.
   *
   * This screen used to fetch her circles, wait, work out which of them the
   * pot is about, and only then ask for that circle's savings and its wall —
   * two round trips from her phone in a fixed order, because the second pair
   * genuinely could not be sent until the first had answered. The dependency
   * is real; resolving it on the server costs a query rather than a journey to
   * her handset and back, and she is not watching a half-drawn screen while it
   * happens. See `GET /community/overview`.
   */
  const { data: overview, refetch } = useResource(
    useCallback((s?: AbortSignal) => apiCommunityOverview(s), []),
    EMPTY_OVERVIEW);

  const { circles, savings, posts } = overview;

  // The server already chose which circle the pot is about; this only finds the
  // row it named, so the two can never disagree about which one that is.
  const savingsCircle = useMemo(
    () => circles.find((c) => c.id === overview.circle_id) ?? null,
    [circles, overview.circle_id]);

  /**
   * `d` and `act` are objects the views hold on to.
   *
   * Built inline they were a new object on every keystroke of the distance
   * slider and every press of Pay, so a memoised child could never match on
   * them. `like` is deliberately its own callback rather than a method rebuilt
   * with the rest of `act`: a post card only needs that one, and keeping it
   * stable across the `paying` flip is what lets `PostCard` skip.
   */
  const d: CommunityData = useMemo(
    () => ({ circles, savings, savingsCircle, posts }),
    [circles, savings, savingsCircle, posts]);

  const pay = useCallback(async () => {
    if (!savingsCircle || savings?.you_paid) return;
    setPaying(true); setError(null);
    try {
      // One key per press and its retries — a lost reply must not become a
      // second payment out of her wallet.
      await apiContribute(savingsCircle.id, `${savingsCircle.id}:${savings?.round ?? 0}`);
      refetch();
    } catch {
      setError("That payment did not go through. Nothing has left your wallet — try again.");
    } finally { setPaying(false); }
  }, [savingsCircle, savings, refetch]);

  const like = useCallback(async (postId: string) => {
    try { await apiLikePost(postId); refetch(); }
    catch { setError("Could not like that just now."); }
  }, [refetch]);

  const act: CommunityActs = useMemo(
    () => ({ paying, pay, like }), [paying, pay, like]);

  const paid = savings ? `${savings.members_paid} of ${savings.members.length} paid` : "";

  return (
    <HomeShell active="/app/circles">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: "var(--ux-brand)" }}>
              Your circle
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: "var(--ux-ink)" }}>
              {circles.length} {circles.length === 1 ? "circle" : "circles"}
              {paid && <span style={{ color: "var(--ux-amber-ink)" }}> · {paid} this round</span>}
            </h1>
          </div>

          <div className="ux-tabs flex gap-1.5 rounded-full p-1"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            {VIEWS.map((v) => {
              const on = view === v.id;
              const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[v.icon]
                ?? Icons.Circle;
              return (
                <button key={v.id} type="button" onClick={() => choose(v.id)} aria-pressed={on}
                        className="ux-press flex min-h-[38px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-xsm font-bold"
                        style={on
                          ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                              color: "var(--ux-on-brand)" }
                          : { color: "var(--ux-muted)" }}>
                  <I className="h-[15px] w-[15px]" /> {v.label}
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <p className="rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}

        {/* keyed on the view so each one plays its entrance rather than
            appearing part-way through somebody else's */}
        <div key={view}>
          {view === "pot"   && <Pot d={d} act={act} />}
          {view === "rooms" && <Rooms d={d} act={act} />}
          {view === "near"  && <Near d={d} km={km} setKm={setKm} />}
          {view === "wall"  && <Wall d={d} act={act} />}
        </div>
      </div>
    </HomeShell>
  );
}

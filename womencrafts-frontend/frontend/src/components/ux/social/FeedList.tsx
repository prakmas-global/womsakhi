"use client";

import { useEffect, useRef, useState } from "react";

import { Btn, Skeleton } from "@/components/ux/kit";
import type { FeedPage, FeedPost } from "@/lib/social-api";
import { PostCard } from "./PostCard";

/**
 * A page of posts, and the next page when she scrolls to the end (or taps
 * "Show more" — the button is there for when the scroll trigger does not
 * fire). `fresh` are posts she has just written, shown first.
 */
export function FeedList({ load, fresh = [], empty }: {
  /** Must keep its identity (useCallback); a new one starts the list again. */
  load: (before: string, signal?: AbortSignal) => Promise<FeedPage>;
  fresh?: FeedPost[];
  empty: React.ReactNode;
}) {
  const [state, setState] = useState<{ load: typeof load; posts: FeedPost[]; next: string; done: boolean; error: boolean }>(
    { load, posts: [], next: "", done: false, error: false });
  const [more, setMore] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);

  // A new `load` (another tab) starts over: reset during render, not in an effect.
  if (state.load !== load) setState({ load, posts: [], next: "", done: false, error: false });

  useEffect(() => {
    const ctl = new AbortController();
    load("", ctl.signal)
      .then((p) => setState((s) => (s.load === load ? { ...s, posts: p.posts, next: p.next, done: true, error: false } : s)))
      .catch(() => { if (!ctl.signal.aborted) setState((s) => ({ ...s, done: true, error: true })); });
    return () => ctl.abort();
  }, [load]);

  const loadMore = async () => {
    if (!state.next || more) return;
    setMore(true);
    try {
      const p = await load(state.next);
      setState((s) => ({ ...s, posts: [...s.posts, ...p.posts.filter((x) => !s.posts.some((y) => y.id === x.id))], next: p.next }));
    } finally {
      setMore(false);
    }
  };

  const nextRef = useRef(loadMore);
  useEffect(() => { nextRef.current = loadMore; });
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) nextRef.current(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [state.done]);

  const all = [...fresh.filter((f) => !state.posts.some((p) => p.id === f.id)), ...state.posts].filter((p) => !gone.has(p.id));
  const drop = (id: string) => setGone((g) => new Set(g).add(id));

  if (!state.done) {
    return <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} h={220} r={18} />)}</div>;
  }
  if (state.error && !all.length) {
    return <p className="ux-card p-5 text-xsm" style={{ color: "var(--ux-muted)" }}>The feed did not load. Pull down or try again in a moment.</p>;
  }
  if (!all.length) return <>{empty}</>;

  return (
    <div className="space-y-4">
      {all.map((p) => <PostCard key={p.id} post={p} onRemoved={drop} />)}
      <div ref={end} />
      {state.next && (
        <div className="flex justify-center"><Btn variant="outline" loading={more} onClick={loadMore}>Show more posts</Btn></div>
      )}
      {!state.next && all.length > 3 && (
        <p className="py-2 text-center text-xs" style={{ color: "var(--ux-muted)" }}>You are all caught up.</p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";

import { apiCircles, apiJoinCircle, type Circle } from "@/lib/community-api";
import { useResource } from "@/lib/use-resource";

/**
 * A real circle for a health topic — "the room" a screen offers to join.
 *
 * Screens here used to say "You are in. Nine women…" and join nothing. This
 * finds an actual circle whose name, topic or description matches `match`
 * (one she is already in first, then the biggest public one), and `join`
 * calls the real join endpoint. When no such circle exists it says so, and
 * the screen offers to start one.
 */
export function useCircleRoom(match: RegExp) {
  const res = useResource(useCallback((s: AbortSignal) => {
    void s;
    return apiCircles().catch(() => [] as Circle[]);
  }, []), [] as Circle[]);
  const [joinedNow, setJoinedNow] = useState<Circle | null>(null);
  const [busy, setBusy] = useState(false);

  const fits = res.data.filter((c) => match.test(`${c.name} ${c.topic} ${c.desc}`));
  const room = joinedNow ?? fits.find((c) => c.joined) ?? [...fits].sort((a, b) => b.member_count - a.member_count)[0] ?? null;

  const join = async () => {
    if (!room || room.joined) return true;
    setBusy(true);
    try {
      setJoinedNow(await apiJoinCircle(room.id));
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { room, joined: Boolean(room?.joined), join, busy, loading: res.source === "loading", others: fits };
}

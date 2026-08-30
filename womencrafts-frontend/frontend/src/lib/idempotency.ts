"use client";

import axios from "axios";
import { useCallback, useRef } from "react";

/**
 * An idempotency key for one attempt — deliberately not one per intent.
 *
 * **Why the distinction matters more than it sounds.** The obvious key is
 * derived from what she is doing: `withdraw:200:primary`, or `confirm:<order>`.
 * That is stable, which looks like the point, and it is wrong in both
 * directions:
 *
 *  - Withdrawing ₹200 twice in one day is an ordinary thing to do. A derived
 *    key makes the second one return the first one's stored answer: she sees
 *    "sent", and no money moves. Silent, and hers to discover at the bank.
 *  - A declined payment is *stored as a successful response*, because the
 *    server answers a decline with a FAILED order rather than an error. Keyed
 *    on the order, her genuine retry gets "declined" handed back for 24 hours
 *    and she can never pay for the thing.
 *
 * So the key identifies one press and the retries of that press. It is minted
 * on first use and burned by `settle()` once the server has actually answered
 * — success or refusal, both are answers. It is *kept* when the request never
 * reached an answer, which is the only case a retry might duplicate work:
 * she is on 2G, the request landed, the response did not, and she presses
 * again not knowing. That press must carry the same key.
 *
 * `settled(err)` is that test. With axios, `err.response` exists only if the
 * server replied; a timeout or a dropped connection has none.
 */
export function useAttemptKey(scope: string) {
  const held = useRef<string | null>(null);

  /** The key for this attempt, minting one if the last was burned. */
  const current = useCallback(() => {
    if (!held.current) held.current = `${scope}:${fresh()}`;
    return held.current;
  }, [scope]);

  /** The server answered. The next press is a new attempt, not a retry. */
  const settle = useCallback(() => {
    held.current = null;
  }, []);

  return { current, settle };
}

/**
 * Did the server answer at all?
 *
 * A 400 is an answer — she asked for something it refused, and pressing again
 * is a new attempt. A timeout is not: the work may well have happened.
 */
export function settled(err: unknown): boolean {
  if (axios.isAxiosError(err)) return err.response !== undefined;
  return true;
}

function fresh(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  // Older WebViews reach this. Uniqueness per user per 24h is all that is
  // needed — the key is scoped by user and endpoint on the server.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

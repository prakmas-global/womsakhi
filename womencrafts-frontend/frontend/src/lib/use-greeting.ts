"use client";

import { useEffect, useState } from "react";

/**
 * "Good morning" — without a hydration mismatch.
 *
 * ── Why this cannot just be a function ──────────────────────────────────────
 * Reading the clock during render gives one answer on the server and possibly
 * another in the browser: the server may be in a different timezone, and even
 * on the same machine a request at 11:59 can hydrate at 12:00. React then
 * throws away the whole subtree and re-renders it on the client, which is a
 * real cost on the exact screens this appears on — Home and Sakhi, both of
 * which a woman opens first and on a slow phone.
 *
 * ── Why the neutral first pass ──────────────────────────────────────────────
 * The server and the first client render must agree, so both produce "Hello".
 * The real greeting arrives immediately afterwards in an effect, which the
 * server never runs. The swap is one word and happens before paint in practice.
 */
export function useGreeting(): string {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  return greeting;
}

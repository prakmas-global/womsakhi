"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiCycle, type CycleRead, type CycleState } from "@/lib/cycle-api";
import { messageFrom } from "@/lib/use-action";

/**
 * Her cycle, for every cycle screen.
 *
 * ── No stand-in data ─────────────────────────────────────────────────────────
 * The rest of the app falls back to a fixture when a request fails, so a
 * screen is never blank. That is the wrong trade here. "Day 18 of 28" drawn
 * from a fixture is a statement about HER body that is false, and she may act
 * on it. So this hook returns `null` until the real answer arrives, and an
 * error she can read if it does not.
 *
 * ── Kept between screens ────────────────────────────────────────────────────
 * Moving from the calendar to the mood screen and back should not flash a
 * skeleton each time. The last answer is kept in the module and shown at once
 * while the fresh one loads — the same thing a native app's store does.
 */

let last: CycleRead | null = null;

export function useCycle(month?: string) {
  const [data, setData] = useState<CycleRead | null>(last);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(last === null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const monthRef = useRef(month);
  useEffect(() => { monthRef.current = month; }, [month]);

  useEffect(() => {
    const ctl = new AbortController();
    apiCycle(ctl.signal, month)
      .then((d) => {
        if (ctl.signal.aborted) return;
        last = d;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setError(messageFrom(e, "We could not load your cycle. Pull down or try again."));
        setLoading(false);
      });
    return () => ctl.abort();
  }, [month, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * Run a write and take its answer as the new state. Every cycle write
   * returns the whole state, so there is nothing to re-fetch — except when
   * she is looking at another month, which the write does not know about.
   */
  const act = useCallback(async (fn: () => Promise<CycleState>): Promise<CycleState | null> => {
    setBusy(true);
    try {
      const s = await fn();
      last = s;
      setData(s);
      setError(null);
      if (monthRef.current && s.calendar.month !== monthRef.current) setNonce((n) => n + 1);
      return s;
    } catch (e) {
      setError(messageFrom(e, "That did not save. Check your connection and try again."));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  /** After "delete everything", nothing about her may linger in memory either. */
  const forget = useCallback(() => {
    last = null;
    setData(null);
    setNonce((n) => n + 1);
  }, []);

  const state = data && data.setup ? (data as CycleState) : null;
  return { data, state, loading, error, busy, act, reload, forget, setError };
}

/* ── Dates, in her words ─────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-19" → a Date at local noon, so no zone can move it a day. */
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
};
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (iso: string, n: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
export const shortDate = (iso: string) => {
  const d = parseDay(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
export const dow = (iso: string) => DOW[parseDay(iso).getDay()];
export const dayNum = (iso: string) => parseDay(iso).getDate();
export const monthTitle = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
};
export const monthShort = (iso: string) => `${MONTHS[parseDay(iso).getMonth()]} ${parseDay(iso).getFullYear()}`;
export const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

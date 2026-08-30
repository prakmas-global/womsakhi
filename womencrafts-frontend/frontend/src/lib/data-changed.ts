"use client";

import { useEffect } from "react";

/**
 * "Something Sakhi did has changed what is on screen."
 *
 * She can book a session, cancel one, join a programme or leave one. Each of
 * those writes to the database through the same endpoint the buttons use — so
 * the record is correct the moment she confirms. What was missing is that
 * nobody told the screen.
 *
 * Every list in the app loads itself once, in an effect, into local state.
 * That is fine when the woman herself is the one pressing the button, because
 * the page that owns the data also owns the refresh. It falls apart when the
 * change comes from somewhere else entirely: she asks Sakhi to leave a
 * programme, Sakhi does it, and the programme is still sitting on her screen
 * until she reloads. The app looked broken and the write looked lost, when in
 * fact only the telling was missing.
 *
 * So a write announces itself, and any screen showing that kind of record
 * reloads. A browser event rather than a store, because the alternative is
 * threading a provider through 39 pages to solve a problem four tools have.
 */

const EVENT = "womsakhi:data-changed";

/** What a write touched, so a screen can decide whether it cares. */
export type DataKind = "bookings" | "programs";

/** Which records each of Sakhi's write tools affects. */
const TOUCHES: Record<string, DataKind[]> = {
  book_session: ["bookings"],
  cancel_booking: ["bookings"],
  join_program: ["programs"],
  leave_program: ["programs"],
};

/** Announce that a write landed. Called when Sakhi reports a completed action. */
export function dataChanged(tool: string | undefined) {
  if (typeof window === "undefined") return;
  // An unrecognised tool is treated as touching everything rather than nothing:
  // a new write tool added later should refresh too much, never too little.
  const kinds = (tool && TOUCHES[tool]) ?? (["bookings", "programs"] as DataKind[]);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { tool, kinds } }));
}

/**
 * Reload when a write touches one of `kinds`.
 *
 * Pass the same loader the page already uses on mount, so there is one way to
 * fetch and one way to refresh.
 */
export function useDataChanged(kinds: DataKind[], reload: () => void | Promise<void>) {
  useEffect(() => {
    const onChange = (e: Event) => {
      const touched = (e as CustomEvent<{ kinds: DataKind[] }>).detail?.kinds ?? [];
      if (touched.some((k) => kinds.includes(k))) void reload();
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
    // `kinds` is a literal at every call site, so listing it as a dependency
    // would rebind the listener on every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";

import "./auth-cards.css";

/**
 * Small pieces shared by the approved auth screens that live inside the member
 * area (/app/verify, /app/phone) and the handoff page (/h). The layout around
 * them is `AuthShell`; these are only the card contents.
 */

/** The selfie card's picture: the "camera" photo, cropped to the woman on the left. */
export const CAMERA_PHOTO = "/ux/auth/camera.webp";

/** A quiet way out — the old onboarding frame's exit, kept on every waiting screen. */
export function SignOutLink({ onClick, label = "Sign out" }: { onClick: () => void; label?: string }) {
  return (
    <p className="ac-link"><button type="button" onClick={onClick}>{label}</button></p>
  );
}

/** "← Back" — top-left of the card, the approved back-link style, a 44 px target. */
export function BackLink({ onClick, children = "Back" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" className="ac-back" onClick={onClick}>
      <ArrowLeft aria-hidden /> {children}
    </button>
  );
}

/**
 * A sub-step of a screen (the code step, a restarted application, the camera)
 * that the phone's or browser's back button closes.
 *
 * Opening it pushes one history entry (`?<param>=<value>` on the same page, so
 * Next's router keeps the screen mounted); the back button pops it and
 * `onClose` runs. The on-screen "← Back" calls the returned `back()`, which
 * goes through history too, so the two can never disagree. If the sub-step is
 * closed any other way, its entry is replaced rather than left behind for the
 * back button to land on.
 */
export function useBackStep(open: boolean, onClose: () => void, param = "step", value = "1"): () => void {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  const pushed = useRef(false);

  const inUrl = useCallback(() => new URL(window.location.href).searchParams.get(param) === value, [param, value]);
  const without = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete(param);
    return u.pathname + (u.search || "") + u.hash;
  }, [param]);

  useEffect(() => {
    if (open && !inUrl()) {
      const u = new URL(window.location.href);
      u.searchParams.set(param, value);
      window.history.pushState(null, "", u.pathname + u.search + u.hash);
      pushed.current = true;
    } else if (!open && inUrl()) {
      // Closed some other way (or a reload landed here): drop the stale entry.
      window.history.replaceState(null, "", without());
      pushed.current = false;
    }
  }, [open, param, value, inUrl, without]);

  useEffect(() => {
    if (!open) return;
    const onPop = () => { if (!inUrl()) { pushed.current = false; close.current(); } };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, inUrl]);

  return useCallback(() => {
    if (pushed.current && inUrl()) window.history.back();
    else close.current();
  }, [inUrl]);
}

"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A proper dialog: focus moves in (to its heading, so a screen reader reads
 * the title first), Tab and Shift+Tab stay inside, Escape calls `onEscape`,
 * and focus goes back to whatever opened it when it closes.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escRef = useRef(onEscape);
  useEffect(() => { escRef.current = onEscape; });

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = el.querySelector<HTMLElement>("[tabindex='-1'][id]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escRef.current) {
        e.stopPropagation();
        e.preventDefault();
        escRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const head = items[0];
      const tail = items[items.length - 1];
      const now = document.activeElement;
      if (e.shiftKey && (now === head || !el.contains(now))) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && (now === tail || !el.contains(now))) { e.preventDefault(); head.focus(); }
    };
    // Overlays are siblings of the flow frame, so their keys never reach its trap.
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

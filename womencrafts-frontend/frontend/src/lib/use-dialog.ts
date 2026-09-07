"use client";

import { useEffect, type RefObject } from "react";

/**
 * Everything a dialog has to do besides look right.
 *
 * ── Why this is a hook and not copied twice ─────────────────────────────────
 * The design-system `Modal` had all of this written out inline, correctly and
 * carefully. A drawer and a bottom sheet need exactly the same behaviour, and
 * the version that gets copied is the version that drifts — one of them ends up
 * without the Tab wrap, and nobody notices because it only fails for keyboard
 * users. So it lives once, and both call it.
 *
 * ── What it actually handles ────────────────────────────────────────────────
 * **The Tab key.** `aria-modal="true"` tells a screen reader to ignore the page
 * behind the dialog. It does NOT stop Tab: focus walks straight out and into the
 * page underneath, which is still there and still operable. The user ends up
 * filling in a form they cannot see, behind a dim overlay. So Tab is wrapped by
 * hand — past the last control it returns to the first, and Shift+Tab from the
 * first goes to the last.
 *
 * **Where focus came from.** Closing returns focus to the control that opened
 * the dialog. Without that, focus falls to `<body>` and the next Tab restarts
 * from the top of the page, losing the reader's place every single time.
 *
 * **Scroll.** The page behind is locked, and its previous value restored — not
 * set to `""`, which would discard a lock some other component was holding.
 */
export function useDialogBehaviour(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const focusable = () =>
      [
        ...(panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const list = focusable();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const returnTo = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const list = focusable();
      (list[0] ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnTo?.focus?.();
    };
  }, [open, panelRef, onClose]);
}

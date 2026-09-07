"use client";

import { useEffect } from "react";

/**
 * ⌘K, Ctrl+K, or "/" when she is not already typing.
 *
 * The "/" shortcut has to check the target: without that, pressing "/" inside
 * the message box opened search instead of typing a slash.
 *
 * ── Why this is not in SearchPalette.tsx ────────────────────────────────────
 * The palette itself is loaded lazily — it is a ⌘K-only surface, so its ~57 KB
 * has no business sitting in the first bundle of every signed-in screen. But
 * the key that opens it has to be listened for from the moment the page is
 * interactive, which means the listener cannot live inside the chunk it is
 * supposed to fetch: putting it there would make ⌘K do nothing until something
 * else had already pulled the palette in. So the hook lives here, in a file
 * that costs a few hundred bytes and always loads, and the panel it opens is
 * fetched the first time she asks for it.
 */
export function useSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpen(); }
      else if (e.key === "/" && !isTyping(e.target)) { e.preventDefault(); onOpen(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen]);
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Her own text size, applied at the root.
 *
 * The design size is 14px body. That is right for most people and too small for
 * some — older eyes, a cracked screen, a woman reading in the dark after the
 * children are asleep. The "Bigger text" control existed in Reading and
 * speaking and did nothing, which is worse than not offering it.
 *
 * ── Why the root font-size and not a second set of tokens ───────────────────
 * Everything in the type scale is px, so a second "large" scale would mean
 * maintaining eleven more values and would drift the moment anyone added a
 * screen. Scaling `<html>` moves rem-based layout with the text, and the px
 * type scale is deliberately re-expressed against it here so the whole system
 * moves together rather than text growing inside boxes that do not.
 *
 * Persisted to localStorage like the theme, and applied before paint by the
 * same mechanism, so the page does not visibly resize after loading.
 */
export const TEXT_SIZES = {
  normal: 1,
  large: 1.15,
  larger: 1.3,
} as const;

export type TextSize = keyof typeof TEXT_SIZES;

export const TEXT_SIZE_COOKIE = "text-size";

/** 16px is the browser default the rem scale is drawn against. */
export const rootPx = (size: TextSize) => 16 * (TEXT_SIZES[size] ?? 1);

export function readTextSize(): TextSize {
  if (typeof document === "undefined") return "normal";
  const m = document.cookie.match(/(?:^|;\s*)text-size=([^;]+)/);
  const v = m?.[1];
  return v && v in TEXT_SIZES ? (v as TextSize) : "normal";
}

export function applyTextSize(size: TextSize) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--ux-fs-scale", String(TEXT_SIZES[size] ?? 1));
  root.style.fontSize = `${rootPx(size)}px`;
  root.dataset.textSize = size;
  // A cookie, not localStorage, so the server can set the root size in the
  // first byte of HTML — the same mechanism the colour theme uses, and the
  // reason neither one flashes.
  document.cookie = `${TEXT_SIZE_COOKIE}=${size};path=/;max-age=31536000;samesite=lax`;
}

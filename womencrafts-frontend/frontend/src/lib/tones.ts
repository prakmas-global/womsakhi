/**
 * Shared tone → Tailwind class maps, centralised to remove the copies that were
 * duplicated across dashboard pages. Values are theme-safe (globals.css remaps
 * the -50/-100 tints and brightens the accent text in dark mode).
 *
 * NOTE: `rose` intentionally uses text-status-danger-ink (not -600) — matches the
 * original per-page definitions; keep it that way.
 */
export const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
};

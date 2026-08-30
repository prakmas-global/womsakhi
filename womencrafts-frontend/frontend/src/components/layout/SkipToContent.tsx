/**
 * "Skip to content" — the first thing keyboard focus reaches on every screen.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * The admin rail carries twenty-odd links and the member shell has its own nav,
 * and both repeat identically on all 76 screens. Without this, reaching the
 * first thing on the page means tabbing past that entire list — on every single
 * navigation, forever. It is the difference between the app being usable by
 * keyboard and being merely operable by keyboard.
 *
 * ── Why it looks like it is missing ─────────────────────────────────────────
 * It is off-screen until focused, then it drops into view. That is deliberate:
 * it is a control for people who need it, and invisible to everyone else. Note
 * it is positioned off-screen rather than `display: none` — a hidden element is
 * not focusable at all, so the usual way of hiding it would also disable it.
 */
export default function SkipToContent({ targetId = "content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200]"
    >
      Skip to content
    </a>
  );
}

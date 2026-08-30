"use client";

/**
 * The label that appears beside a collapsed navigation rail.
 *
 * When the rail is dragged narrow the labels stop fitting, so items become
 * icons — and an icon on its own is a guessing game. Hovering or focusing one
 * shows its name, and its sub-items if it has any, so a narrow rail loses
 * nothing but width.
 *
 * ── Why this is CSS hover and not a JS tooltip ──────────────────────────────
 * A tooltip library would need mount, position, portal and timer logic on every
 * nav item, and it would lag behind the pointer on a rail you can sweep down in
 * one motion. `group-hover` costs nothing and appears instantly.
 *
 * It fades via `.wc-flyout` rather than `hidden`/`block`, because a label that
 * pops in and out reads as a glitch when you sweep the pointer down a rail.
 *
 * `focus-within` is there too, so the flyout appears for a keyboard user
 * tabbing the rail — otherwise collapsing it would make the app unnavigable
 * without a mouse.
 */
export default function NavFlyout({
  label,
  children,
}: {
  label: string;
  /** Sub-items, shown under the label. */
  children?: React.ReactNode;
}) {
  return (
    <span
      // Purely visual. The item itself already carries the same text as an
      // `aria-label`, so exposing this too would make a screen reader announce
      // every nav item twice. It is also why the collapsed rail's DOM still
      // contains label text — hidden by opacity, not removed.
      aria-hidden="true"
      // `left-full` puts it just outside the rail; the small offset closes the
      // gap so the pointer can travel into the flyout without it vanishing.
      className="wc-flyout absolute left-full top-0 z-50 ml-1 min-w-[11rem] rounded-xl border border-[color:var(--wc-border-subtle)] bg-[color:var(--surface)] px-3 py-2 shadow-lg"
    >
      <span className="block whitespace-nowrap text-sm font-semibold text-ink">{label}</span>
      {children}
    </span>
  );
}

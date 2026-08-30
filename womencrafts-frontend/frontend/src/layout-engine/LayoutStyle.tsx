import { cookies } from "next/headers";

import { LAYOUT_COOKIE } from "./storage";
import { clamp, LIMITS } from "./types";

/**
 * Server-rendered sidebar width.
 *
 * Same problem the theme engine solves, and the same solution. Without this the
 * page arrives with the default 248px rail, the client reads the saved 320px a
 * moment later, and the whole layout jumps. Users read that as the app being
 * broken, even though it settles on the right answer.
 *
 * Only the sidebar is emitted. Panes and widgets live below the fold or inside
 * client components that mount with their values already in hand, so they never
 * visibly move. The rail is the one thing that is on screen at the first pixel.
 *
 * The width becomes a CSS variable rather than a class, so the client can
 * animate a drag by writing the same property.
 */

const VAR = "--wc-sidebar-width";

export default async function LayoutStyle() {
  const store = await cookies();
  const raw = store.get(LAYOUT_COOKIE)?.value;
  if (!raw) return null;

  let width: number | null = null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));

    // A collapsed rail wins over any stored width — it is what the user will
    // see, so it is what must be painted.
    const collapsed = Boolean(parsed?.nav?.staff?.collapsed || parsed?.nav?.member?.collapsed);

    const stored = Number(parsed?.sidebar?.desktop);
    if (collapsed) width = LIMITS.sidebar.min;
    else if (Number.isFinite(stored)) {
      width = Math.round(clamp(stored, LIMITS.sidebar.min, LIMITS.sidebar.max));
    }
  } catch {
    // A corrupt cookie must never break the page. Emitting nothing means the
    // stylesheet's own default applies.
    return null;
  }

  if (width === null) return null;

  return (
    <style
      // Not user input in the injection sense: `width` is a number that has
      // been through Number.isFinite and a clamp.
      dangerouslySetInnerHTML={{ __html: `:root{${VAR}:${width}px}` }}
    />
  );
}

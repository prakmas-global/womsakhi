"use client";

import { forwardRef } from "react";
import Link from "next/link";

/**
 * A link. It used to be more than that, and the "more" was doing real harm.
 *
 * **What it was.** Every navigation was wrapped in
 * `document.startViewTransition()`, so the browser snapshotted the old screen,
 * ran the route change, snapshotted the new one, and cross-faded. The update
 * callback held the transition open until `window.location.pathname` matched
 * the destination, polled with `requestAnimationFrame`, because a
 * fire-and-forget callback finished the cross-fade before the new screen
 * existed and the real content then hard-cut in.
 *
 * **Why that was a deadlock.** The document is render-blocked between the two
 * snapshots, and `requestAnimationFrame` does not fire while it is. So the
 * poll never ticked, the promise never resolved, and the transition ran until
 * the browser's own timeout. Traced on the rail at 1440x900: the URL became
 * `/app/learn` at 165ms and the screen did not change until **4,263ms**. Every
 * click, every screen. That is the lag.
 *
 * **Why it is not coming back in another form.** Even written correctly, a
 * view transition that spans a navigation freezes the entire document for the
 * length of it — the sidebar included. The rail's accordion could never
 * animate its close, because during the only moment it had to animate, the
 * rail was a still image. Continuity now comes from the shell genuinely
 * staying mounted (`checks/nav-persist.mjs`) rather than from a picture of it,
 * and the middle fades itself in with a plain CSS animation that costs the
 * browser nothing and blocks nothing (`.ux-swap` in `ux/tokens.css`).
 *
 * The name and props are unchanged because a hundred and eight screens import
 * it, and none of them needed to know either way.
 */
type Props = React.ComponentProps<typeof Link>;

export const TransitionLink = forwardRef<HTMLAnchorElement, Props>(
  function TransitionLink(props, ref) {
    return <Link ref={ref} {...props} />;
  },
);

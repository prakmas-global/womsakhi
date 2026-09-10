"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A link that navigates inside a View Transition.
 *
 * The browser snapshots the old page, runs the navigation, snapshots the new
 * one, and cross-fades between them — so moving between screens stops being a
 * hard cut. It is worth doing here specifically because the shell stays put:
 * the sidebar and topbar are named in CSS, so they hold still while only the
 * content changes, which is what makes the app feel like one place rather than
 * a series of pages.
 *
 * Everything degrades to a plain <Link>: no API, modified click, external
 * href, or reduced motion, and it is just a navigation.
 */
type Props = React.ComponentProps<typeof Link>;

export const TransitionLink = forwardRef<HTMLAnchorElement, Props>(
  function TransitionLink({ href, onClick, ...rest }, ref) {
    const router = useRouter();

    return (
      <Link
        ref={ref}
        href={href}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;

          // Let the browser handle anything that is not a plain left click on a
          // same-tab, same-origin destination.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          const to = typeof href === "string" ? href : href.pathname ?? "";
          if (!to.startsWith("/")) return;

          const d = document as Document & {
            startViewTransition?: (cb: () => void) => unknown;
          };
          if (!d.startViewTransition) return;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

          e.preventDefault();
          /**
           * Hold the transition open until the destination has actually
           * rendered.
           *
           * `router.push` returns immediately, so a fire-and-forget callback
           * finished the cross-fade before the new screen existed. Measured on
           * a production build at 4x CPU: the animation reported `finished` at
           * 251-331ms while the destination's text only reached the DOM at
           * 427-535ms — a 100-250ms window where the browser cross-faded the
           * old screen into ITSELF and the real content then hard-cut in. That
           * flash is what reads as the whole page reloading.
           *
           * The promise resolves when the path has changed or after a short
           * ceiling, so a slow route can never leave her looking at a frozen
           * snapshot.
           */
          d.startViewTransition(async () => {
            router.push(to);
            await new Promise<void>((done) => {
              const started = Date.now();
              const tick = () => {
                if (window.location.pathname === to.split("?")[0] || Date.now() - started > 600) {
                  done();
                  return;
                }
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
          });
        }}
        {...rest}
      />
    );
  },
);

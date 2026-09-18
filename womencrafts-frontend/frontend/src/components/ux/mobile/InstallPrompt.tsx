"use client";

import { useCallback, useEffect, useState } from "react";

import { Btn, I } from "@/components/ux/kit";
import {
  canAddToHomeScreenOnIos,
  isPhoneLike,
  isSnoozed,
  isStandalone,
  rememberDismissal,
  rememberInstalled,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";

/**
 * Twelve seconds.
 *
 * An install banner on arrival is the pattern everybody has learned to swat
 * away without reading. Waiting until she has actually looked at something
 * means the offer arrives after the app has given her a reason to keep it,
 * which is the only moment the answer can be an honest yes. The timer starts
 * once per session — this component is mounted by the member layout, so it
 * survives every navigation inside the app and is not restarted by them.
 */
/*
  Not on her first visit, and not twelve seconds in.

  It used to appear 12s into the very first visit, which is the wrong ask at
  the wrong moment twice over. A woman who has just arrived does not yet know
  whether she wants this on her home screen, and being asked implies the thing
  she is already using is somehow not the real app. It is — the site IS the
  app; installing only removes the browser chrome.

  So the ask has to be earned: she has to come back, more than once, and still
  be here a minute later. Someone on her third visit has decided something.
*/
const SHOW_AFTER_MS = 60_000;
const MIN_VISITS = 3;
const VISITS_KEY = "womsakhi.visits";

/**
 * Sessions that reached the member app, counted once per browser session.
 *
 * `sessionStorage` marks the session so a woman who opens six screens in one
 * sitting counts once — otherwise "three visits" means "three taps" and the
 * card is back to arriving on day one. Both reads are wrapped: storage throws
 * outright in some private modes, and a crash here would take the shell with
 * it for the sake of a promotional card.
 */
function countVisit(): number {
  try {
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, "1");
      const n = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1;
      localStorage.setItem(VISITS_KEY, String(n));
      return n;
    }
    return Number(localStorage.getItem(VISITS_KEY) ?? "0");
  } catch {
    /* Storage unavailable: never nag. Silence is the safe direction. */
    return 0;
  }
}

type Mode =
  /** Chromium fired `beforeinstallprompt`; the browser will do the install. */
  | { kind: "prompt"; event: BeforeInstallPromptEvent }
  /** iOS, which has no such event — she has to be told where the button is. */
  | { kind: "ios" }
  | null;

/**
 * "Keep WomSakhi on your phone" — the one card that turns this into an app.
 *
 * ── The four ways this must stay quiet ──────────────────────────────────────
 *   • On a desktop. An install banner on a laptop is noise; this app's install
 *     is a home-screen icon, and laptops do not have one.
 *   • When she is already inside the installed app. `display-mode: standalone`
 *     and iOS's `navigator.standalone` both answer that, and either is enough.
 *   • After she has said no. Sixty days, in `localStorage`, in a try/catch —
 *     storage throws outright in Safari private mode, and a prompt that takes
 *     the screen down with it is worse than a prompt that repeats.
 *   • When the browser has not offered. No `beforeinstallprompt`, no card —
 *     except on iOS, which never fires it and never will.
 *
 * ── Why iOS gets words instead of a button ──────────────────────────────────
 * Safari has no programmatic install. The only route is Share → Add to Home
 * Screen, and a woman who has never done it will not find it by being told
 * "install". So iOS gets the actual gesture, with the actual glyph she is
 * looking for, and no button that pretends to do it for her.
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Every one of these is a reason to render nothing at all, forever, for
    // this session. Checked before a single listener is attached.
    if (!isPhoneLike() || isStandalone() || isSnoozed()) return;
    // She has to have come back. See MIN_VISITS.
    if (countVisit() < MIN_VISITS) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    /*
      The install event is held in a plain local, not in state, and the state
      is written only from inside the timer. Two reasons, and the second is the
      one that matters: nothing should re-render until there is something to
      show, and `react-hooks/set-state-in-effect` correctly rejects a setState
      in the body of an effect. A timer callback is not the effect body.
    */
    let pending: BeforeInstallPromptEvent | null = null;
    const iosCapable = canAddToHomeScreenOnIos();

    const schedule = () => {
      if (timer) return; // Whichever signal arrives first starts the clock.
      timer = setTimeout(() => {
        setMode(pending ? { kind: "prompt", event: pending } : { kind: "ios" });
        setVisible(true);
      }, SHOW_AFTER_MS);
    };

    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      // Without `preventDefault` Chrome shows its own mini-infobar and the
      // saved event can no longer be used later.
      e.preventDefault();
      pending = e;
      schedule();
    };

    const onInstalled = () => {
      rememberInstalled();
      setVisible(false);
      setMode(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires the event, so nothing else will ever start the clock.
    if (iosCapable) schedule();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!mode || mode.kind !== "prompt") return;
    try {
      await mode.event.prompt();
      const { outcome } = await mode.event.userChoice;
      // "dismissed" is a no for now, not a no forever — the same sixty-day
      // snooze as the card's own dismiss, so the two cannot disagree.
      if (outcome === "accepted") rememberInstalled();
      else rememberDismissal();
    } catch {
      // The event can only be used once, and a second `prompt()` throws. Treat
      // any failure as "asked, and done".
      rememberDismissal();
    }
    setVisible(false);
  }, [mode]);

  if (!visible || !mode) return null;

  const ios = mode.kind === "ios";

  return (
    /*
      The `ux` class is on this element, not assumed from an ancestor.
      The colour tokens are defined on `.ux`, never on `:root`, so a component
      that ends up mounted outside that subtree — or moved into a portal later
      — renders with every `var(--ux-*)` unresolved and comes out unstyled.
      Re-declaring it here costs nothing and cannot break: `.dark .ux` still
      matches a nested one, so dark mode follows.
    */
    // `region`, not `dialog`: nothing is blocked behind it and focus is not
    // trapped, and announcing a dialog that behaves like neither is a lie to
    // a screen-reader user.
    <div data-install-prompt
      className="ux" role="region" aria-label="Add WomSakhi to your home screen">
      <div
        className="ux-sheet"
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          // Above the bottom tab bar rather than behind it. `--tabbar-h`
          // already includes the home-indicator inset.
          bottom: "calc(var(--tabbar-h, 58px) + 12px)",
          // The tab bar is 60 and toasts are 70. This belongs between them:
          // over the navigation, under a confirmation of something she just
          // did. There is no token for that layer yet — see the report.
          zIndex: 65,
          borderRadius: 18,
          padding: 16,
          // `.ux .ux-sheet` adds the safe-area inset at the foot, which this
          // card does not need — it is not against the bottom edge.
          paddingBottom: 16,
          display: "flex",
          gap: 13,
          alignItems: "flex-start",
        }}
      >
        <div
          aria-hidden
          style={{
            flex: "0 0 auto",
            width: 44,
            height: 44,
            borderRadius: 13,
            overflow: "hidden",
            border: "1px solid var(--ux-line)",
            background: "var(--ux-surface-2)",
          }}
        >
          {/* A plain <img>: next/image would optimise a 44px icon through the
              image route for no gain, and this must render on a connection bad
              enough that she is being asked to keep the app locally. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            style={{ display: "block", width: "100%", height: "100%" }}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ux-ink)",
              lineHeight: 1.3,
            }}
          >
            Keep WomSakhi on your phone
          </p>

          {ios ? (
            <p
              style={{
                margin: "5px 0 0",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ux-muted)",
              }}
            >
              Tap{" "}
              <I
                name="Share"
                className="inline-block h-[15px] w-[15px] align-[-2px]"
                style={{ color: "var(--ux-brand)" }}
              />{" "}
              Share below, then{" "}
              <span style={{ color: "var(--ux-ink)", fontWeight: 600 }}>
                Add to Home Screen
              </span>
              . It opens full screen, with no browser around it.
            </p>
          ) : (
            <p
              style={{
                margin: "5px 0 0",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ux-muted)",
              }}
            >
              Opens full screen from your home screen, like any other app. No
              download, no extra data.
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {!ios && (
              <Btn size="sm" icon="ArrowDownToLine" onClick={install}>
                Add it
              </Btn>
            )}
            <Btn size="sm" variant="ghost" onClick={dismiss}>
              {ios ? "Got it" : "Not now"}
            </Btn>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            // 44px, and deliberately not exempted from `mobile.css`'s minimum.
            // A 30px X is the control people miss and hit the card behind.
            flex: "0 0 auto",
            display: "grid",
            placeItems: "center",
            width: 44,
            height: 44,
            marginTop: -10,
            marginRight: -10,
            borderRadius: 12,
            color: "var(--ux-muted)",
            background: "transparent",
          }}
        >
          <I name="X" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

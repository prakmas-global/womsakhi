"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n";
import { createPortal } from "react-dom";
import { RefreshCw, WifiOff } from "@/components/ux/icons";

import { useWaitState } from "@/lib/wait";
/**
 * The tokens come with the component, deliberately.
 *
 * `ux/tokens.css` is imported by the member layout, the public layout and the
 * open layout — but NOT by the root layout, and not by `(auth)`. This screen is
 * rendered from `AuthProvider`, which lives in the root layout, and it has to
 * be correct on the sign-in scene as well as inside the app. Importing it here
 * puts it in the graph wherever this component is, which is everywhere.
 *
 * It is safe to make global: apart from the `--ux-z-*` scale on `:root`, every
 * rule in that file is scoped to a `.ux` ancestor, and nothing outside the
 * member app carries that class.
 */
import "@/app/ux/tokens.css";
import { BrandLockup } from "@/components/brand/BrandLockup";

/** A stable subscribe, so React never resubscribes. Same shape as `Sheet`. */
const NEVER_CHANGES = () => () => {};

const readTheme = () => document.documentElement.classList.contains("dark");
const watchTheme = (onChange: () => void) => {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
};

/**
 * What she sees while the app is being handed over to her, or taken away.
 *
 * ── The screen this replaces ────────────────────────────────────────────────
 * Signing out put a single 20px spinner in the middle of an empty violet page.
 * No logo. No words. Nothing to say whether the app was working, whether the
 * connection had died, or whether pressing something had broken it. On the
 * phones and connections this app is actually used on that screen could last
 * five or ten seconds.
 *
 * A spinner is a reasonable answer to "how long" for somebody who already
 * knows what a spinner means and already trusts that the app is fine. It is
 * not an answer to "is this working?", and that is the question a woman who is
 * new to a smartphone is actually asking. So this screen answers it in words:
 * what is happening, that she should wait, and — if it takes long enough to be
 * worrying — that the app knows it is slow and has not forgotten her.
 *
 * ── Three things it does that a spinner cannot ─────────────────────────────
 * **It says the name.** The mark and the wordmark are the one thing on screen
 * that is unmistakably still WomSakhi. A blank page is indistinguishable from
 * a browser that has lost the site.
 *
 * **It escalates.** At six seconds it says the connection may be slow; at
 * fifteen it offers a way out. Both come from `useWaitState`, which holds the
 * numbers and the reasoning for them.
 *
 * **It does not lie about progress.** The bar moves, because a bar that moves
 * is read as faster than one that sits still (Harrison et al., CHI 2007) — but
 * it is `aria-hidden`, and there is no `aria-valuenow` anywhere on this screen.
 * Nothing here knows what fraction of a request has completed, and announcing
 * "43 percent" when the true answer is unknown is worse than announcing
 * nothing. The words in the live region are what a screen reader gets, and
 * they are all true.
 */
export function WaitScreen({
  open,
  title,
  line,
  slowLine,
  stuckLabel,
  onStuck,
  /**
   * Skip the 400ms grace before appearing. For the moment the app behind this
   * has already been torn down — the sign-out hand-off — where waiting buys a
   * flash of the blank page this exists to prevent.
   */
  now = false,
}: {
  open: boolean;
  /** "Signing you out…" — the thing that is happening, in her language. */
  title: string;
  /** One plain sentence under it. What to do: usually nothing but wait. */
  line: string;
  /** Shown after six seconds. Say that it is slow; do not apologise twice. */
  slowLine: string;
  /** The way out, offered after fifteen. */
  stuckLabel?: string;
  onStuck?: () => void;
  now?: boolean;
}) {
  const { shown, slow, stuck, pct } = useWaitState(open, { showAfter: now ? 0 : undefined });

  // `document` does not exist during SSR and a portal needs a real node, so the
  // first render on the server and the first render in the browser both answer
  // "not yet" and agree.
  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);
  // The theme class lives on <html>, which is outside every React-managed
  // wrapper — and it changes under this screen, because the sign-in scene sets
  // dark as it mounts. Subscribed rather than read once, or the curtain would
  // hand off from a dark app to a light sheet.
  const dark = useSyncExternalStore(watchTheme, readTheme, () => false);

  if (!shown || !onClient) return null;

  return createPortal(
    <div
      /**
       * `ux` and `dark` on the portal root, not inherited.
       *
       * Every colour token in this app is declared on `.ux`, and the dark
       * values on `.ux.dark`. A portal into <body> has neither ancestor, so
       * without these two class names the whole screen resolves `var(--ux-*)`
       * to nothing: transparent text on a transparent sheet over whatever was
       * behind it. This is the one line that makes the rest of the file work.
       */
      className={`ux-wait ux${dark ? " dark" : ""}`}
      aria-busy="true"
    >
      <WaitBody
        title={title}
        line={line}
        slowLine={slow ? slowLine : undefined}
        pct={pct}
        stuckLabel={stuck ? stuckLabel : undefined}
        onStuck={onStuck}
      />
    </div>,
    document.body,
  );
}

/**
 * The composition itself: the mark, the words, the bar.
 *
 * Shared by the curtain above and by `WaitPage` below, because a member should
 * meet the same screen whether the app is being handed to her or is deciding
 * whether she is allowed in. Two versions of "please wait" is how one of them
 * ends up being a bare spinner again.
 */
function WaitBody({
  title, line, slowLine, pct, stuckLabel, onStuck,
}: {
  title: string;
  line: string;
  /** Present only once it has been slow long enough to be worth saying. */
  slowLine?: string;
  pct: number;
  stuckLabel?: string;
  onStuck?: () => void;
}) {
  const tr = useT();
  return (
    <div className="flex w-full max-w-[360px] flex-col items-center text-center">
      <BrandLockup
        alt={tr("waitScreen.womsakhiStrongerWomenBrighterTomorrows")}
        className="h-auto w-[min(230px,68vw)] object-contain"
      />

      {/*
        One live region holding every word on the screen, `atomic` so it is read
        as a whole sentence rather than as three fragments arriving separately.
        `polite`, not `assertive`: she asked for this and is watching it happen —
        interrupting her own screen reader to tell her what she just pressed is
        rude, and `assertive` is for things that go wrong without warning.

        It is deliberately NOT `role="alert"` and it does not take focus. Moving
        focus into a screen that is about to be replaced sends the cursor
        somewhere that will not exist in a second.
      */}
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-8 w-full">
        <p className="text-lg font-bold" style={{ color: "var(--ux-ink)" }}>{title}</p>
        <p className="mx-auto mt-2 max-w-[300px] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          {line}
        </p>

        {slowLine && (
          <p
            className="mx-auto mt-4 flex max-w-[320px] items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-start text-xs leading-relaxed"
            style={{ background: "var(--ux-tint-amber)", color: "var(--ux-ink-2)" }}
          >
            <WifiOff className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <span>{slowLine}</span>
          </p>
        )}
      </div>

      {/* The bar. Decoration, and labelled as such — the words above are the
          accessible status. */}
      <div className="ux-wait-track mt-6" aria-hidden>
        <div className="ux-wait-fill relative" style={{ width: `${pct}%` }}>
          <span className="ux-wait-sheen" />
        </div>
      </div>

      {stuckLabel && onStuck && (
        <button
          type="button"
          onClick={onStuck}
          className="ux-press mt-6 inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-xsm font-semibold"
          style={{
            background: "var(--ux-surface)",
            color: "var(--ux-ink)",
            border: "1px solid var(--ux-line-strong)",
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {stuckLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The same screen, rendered in the page rather than over it.
 *
 * For a route gate that has nothing to show yet — `learning/layout` waits on
 * the session before it knows whether this is even a member's screen. Those
 * gates all shipped as `<div className="ux grid min-h-screen place-items-center">
 * <Spinner /></div>`: a 20px ring in the middle of an empty page, which is the
 * exact screen this whole file exists to remove.
 */
export function WaitPage({ title, line }: { title: string; line: string }) {
  const { pct } = useWaitState(true, { showAfter: 0 });
  return (
    <div className="ux grid min-h-screen place-items-center px-6" aria-busy="true">
      <WaitBody title={title} line={line} pct={pct} />
    </div>
  );
}

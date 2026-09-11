"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import * as Icons from "@/components/ux/icons";

/**
 * The chat scaffold — what makes a conversation feel like an app.
 *
 * ── Why this file lives under `sakhi/` ──────────────────────────────────────
 * Both conversation screens use it: `/app/sakhi` (the assistant) and
 * `/app/messages` (buyers, mentors, circles). It is not assistant-specific, and
 * a folder called `chat/` would be the honest home — but this pass owns
 * `ux/sakhi/**` and not a new top-level folder, and a shared scaffold is worth
 * more than a tidy path. Nothing in here knows what Sakhi is.
 *
 * ── The one thing a web chat always gets wrong ──────────────────────────────
 * `100vh` — and `100dvh`, and `position: fixed; bottom: 0` — do not shrink when
 * the on-screen keyboard opens. The keyboard is drawn over the top of the
 * layout viewport, not inside it, so a composer pinned to the bottom of the
 * page ends up UNDERNEATH the keys the moment she taps it. She types blind.
 * That single failure is the loudest "this is a web page" signal a chat can
 * emit, and no amount of styling covers it.
 *
 * The only thing that knows the keyboard is there is the **VisualViewport API**:
 * `window.visualViewport.height` is what she can actually see, while
 * `window.innerHeight` stays at the full layout height. The difference is the
 * keyboard. `useKeyboardInset` publishes it as `--ux-kb` and the frame below
 * ends there instead of at the bottom of the page.
 *
 *   layout viewport ─┬─ visualViewport.offsetTop   (iOS may scroll the visual
 *                    │                              viewport inside the layout
 *                    ├─ visualViewport.height       one; the frame's top moves
 *                    │                              with it)
 *                    └─ --ux-kb  ← the keyboard
 *
 * ── The frame is `fixed`, and only below `lg` ───────────────────────────────
 * The app shell scrolls an inner column (`#ux-scroll`) that keeps a fixed
 * bottom padding for the tab bar. A chat cannot live inside that: its message
 * list has to be its own scrollport so the header and composer stay put, and
 * its composer has to be able to leave the tab bar's reserved strip when the
 * keyboard takes it. So on a phone the chat is lifted out as a fixed panel
 * between the top bar and the keyboard. Above `lg` every rule here is inert —
 * `.ux-chat` is `display: contents`, so the desktop three-column inbox and the
 * desktop assistant render exactly as they did.
 *
 * ── Why the tab bar stays ───────────────────────────────────────────────────
 * The brief allowed either "composer above the tab bar" or "hide the bar while
 * composing". The bar stays, because it is the only navigation a phone has here
 * and a woman arriving from a notification would otherwise be stranded in a
 * thread with no way out but the browser's back gesture. It costs nothing: with
 * the keyboard closed the composer sits on top of the bar (which already
 * clears the home indicator — `--tabbar-h` includes `--sa-bottom`), and with
 * the keyboard open the system has covered the bar anyway, so the composer
 * takes the space back. The arithmetic is one line:
 *
 *     padding-bottom: max(0px, calc(var(--tabbar-h) - var(--ux-kb)))
 *
 * which is the bar's height when there is no keyboard, zero when there is, and
 * a smooth interpolation through every frame of the keyboard animation.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   The keyboard
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Publish the on-screen keyboard's height as `--ux-kb`.
 *
 * Set on `documentElement` rather than on the frame, because custom properties
 * inherit and the value is wanted by anything that has to end above the keys.
 * `data-ux-kb` goes on with it, so a check can assert on the state rather than
 * having to parse a length.
 *
 * Both `resize` and `scroll` are listened to: iOS fires `scroll` (not `resize`)
 * when it slides the visual viewport up to reveal a focused field, and a
 * handler on `resize` alone leaves the frame's top edge above the screen.
 *
 * Coalesced into one `requestAnimationFrame`: the keyboard animation fires
 * these events at frame rate, and writing a custom property on every one of
 * them restyles the whole subtree for the same value twice.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    const root = document.documentElement;
    if (!vv) {
      // No VisualViewport (old Android WebViews). Nothing is worse than before:
      // `--ux-kb` stays unset, the CSS falls back to 0px, and the composer sits
      // above the tab bar exactly as a static layout would put it.
      return;
    }

    let raf = 0;
    const apply = () => {
      raf = 0;
      // What the layout viewport has that the visible one does not. Rounded
      // down by a pixel of tolerance so sub-pixel viewport heights (very common
      // on Android at odd device pixel ratios) do not read as a 0.5px keyboard.
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const kb = inset > 1 ? inset : 0;
      root.style.setProperty("--ux-kb", `${kb}px`);
      root.style.setProperty("--ux-vv-top", `${Math.round(vv.offsetTop)}px`);
      if (kb > 0) root.setAttribute("data-ux-kb", "1");
      else root.removeAttribute("data-ux-kb");
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (raf) cancelAnimationFrame(raf);
      // Left behind, these would keep every other screen's docked bars lifted
      // by a keyboard that closed when the chat unmounted.
      root.style.removeProperty("--ux-kb");
      root.style.removeProperty("--ux-vv-top");
      root.removeAttribute("data-ux-kb");
    };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sticking to the bottom — without stealing her place in the history
   ═══════════════════════════════════════════════════════════════════════════ */

/** How close to the end still counts as "at the end". One short bubble. */
const AT_END = 56;
/** How far up she has to be before the jump button is worth offering. */
const FAR_UP = 220;

export type ChatScroll = {
  ref: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  /** She has scrolled up far enough that new messages should not yank her. */
  away: boolean;
  toEnd: (smooth?: boolean) => void;
};

/**
 * Keep the newest message in view — unless she is reading older ones.
 *
 * Scrolling a thread to the bottom on every update is the single most
 * infuriating bug a chat can have: she scrolls up to check a price, a message
 * lands, and the screen throws her back to the end mid-sentence. So the
 * scroller remembers whether she was AT the end when the change arrived, and
 * only re-pins if she was. If she was not, a button appears instead and the
 * decision stays hers.
 *
 * `signal` is a string the caller changes whenever the content changes — the
 * conversation id, the message count, the length of a streaming reply. A string
 * rather than a dependency array because a hook cannot take a spread array
 * without defeating the exhaustive-deps lint that keeps the rest of this file
 * honest.
 *
 * A `ResizeObserver` on the content covers what the signal cannot see: a photo
 * that finishes decoding, or a bubble that reflows when the keyboard changes
 * the width. Both grow the thread after React has finished, and without this
 * the newest message slides quietly back under the fold.
 */
export function useChatScroll(signal: string): ChatScroll {
  const ref = useRef<HTMLDivElement | null>(null);
  const stuck = useRef(true);
  const [away, setAway] = useState(false);

  const toEnd = useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    stuck.current = true;
    setAway(false);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stuck.current = gap <= AT_END;
    setAway(gap > FAR_UP);
  }, []);

  // The content changed. Re-pin only if she was already at the end.
  useEffect(() => {
    if (stuck.current) {
      const el = ref.current;
      if (el) el.scrollTo({ top: el.scrollHeight });
    }
  }, [signal]);

  // …and again when the content's own height changes under React's feet.
  useEffect(() => {
    const el = ref.current;
    const inner = el?.firstElementChild;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stuck.current) el.scrollTo({ top: el.scrollHeight });
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return { ref, onScroll, away, toEnd };
}

/* ═══════════════════════════════════════════════════════════════════════════
   The frame
   ═══════════════════════════════════════════════════════════════════════════ */

const CSS = `
/*
  Above lg there is not one rule in this file. Every selector below sits inside
  the phone media query, so the desktop three-column inbox and the desktop
  assistant render byte-for-byte as they did.

  And note what is NOT set below: \`display\`. These rules are unlayered, so a
  \`display\` here would beat Tailwind's \`.hidden\` — which lives in
  \`@layer utilities\` and always loses to unlayered CSS — and the inbox's
  \`hidden lg:flex\` would stop hiding the thread. That is the exact trap
  \`mobile.css\` documents at the top of the file. The caller supplies \`flex\`.
*/
@media (max-width: 1023px) {
  .ux .ux-chat {
    flex-direction: column;
    position: fixed;
    inset-inline: 0;
    /* Below the top bar, and moving with the visual viewport if iOS slides it
       up to reveal the focused composer. */
    top: calc(var(--ux-topbar-h) + var(--ux-vv-top, 0px));
    /* THE line. The panel ends where the keyboard begins. */
    bottom: var(--ux-kb, 0px);
    background: var(--ux-surface);
    /* Above the floating assistant (40) and the help pill (30), below the tab
       bar (60) and every sheet. The two floaters are decoration on a screen
       that is already a conversation; the bar is how she leaves it. */
    z-index: 45;
    overscroll-behavior: contain;
    /* The desktop card's chrome, off. A panel that fills the screen has no
       outside for a shadow to fall on. */
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .ux .ux-chat-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 4px;
    background: var(--ux-surface);
    border-bottom: 1px solid var(--ux-line);
  }

  .ux .ux-chat-log {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    /* A new bubble must push the view, not silently absorb the growth — with
       scroll anchoring on, Chrome holds the scroll position and the thread
       appears not to have received the message. */
    overflow-anchor: none;
  }

  .ux .ux-chat-dock {
    flex: 0 0 auto;
    background: var(--ux-surface);
    border-top: 1px solid var(--ux-line);
    /* The tab bar's height when there is no keyboard; zero when there is one,
       because the system has already covered the bar. Interpolates smoothly
       through the keyboard's own animation. */
    padding-bottom: max(0px, calc(var(--tabbar-h) - var(--ux-kb, 0px)));
    padding-inline: max(10px, var(--sa-left)) max(10px, var(--sa-right));
  }

  /*
    What the keyboard is allowed to push off the screen.

    With ~300px of keys up, the dock has to hold the composer and nothing else
    that can wait. The safety line and the suggestion chips are worth their
    space while she is reading and are worth less than two lines of thread
    while she is typing, so data-ux-kb — set by useKeyboardInset — takes
    them away and gives them back when the keyboard closes.
  */
  html[data-ux-kb] .ux .ux-chat-tip { display: none; }
}
`;

/**
 * The phone-shaped chat panel. Renders its children unwrapped on desktop.
 *
 * `aria-label` names the whole conversation region for a screen reader, which
 * on a phone is the entire screen.
 */
export function ChatFrame({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  useKeyboardInset();
  return (
    <section className={`ux-chat ${className}`} aria-label={label}>
      {children}
      <style href="ux-chat" precedence="ux-mobile">
        {CSS}
      </style>
    </section>
  );
}

/**
 * The list of messages.
 *
 * `role="log"` with `aria-live="polite"` is the WAI-ARIA pattern for a
 * conversation: additions are announced, the rest is not re-read, and the
 * reading order stays chronological. `aria-relevant="additions"` matters —
 * without it a screen reader re-announces the whole thread every time a
 * streaming reply grows by a word.
 */
export function ChatLog({
  scroll,
  children,
  className = "",
  label = "Messages",
}: {
  scroll: ChatScroll;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  /*
    Destructured, not read as `scroll.ref` on the JSX line.

    `react-hooks/refs` reads a member expression ending in `.ref` inside JSX as
    a ref being dereferenced during render and errors on it. Pulling both out
    first is the same code and says what is actually happening: a ref object and
    an event handler are being handed to a DOM node, which is what refs are for.
  */
  const { ref: logRef, onScroll } = scroll;

  return (
    <div
      ref={logRef}
      onScroll={onScroll}
      className={`ux-chat-log ${className}`}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

/**
 * "New messages" — the way back down, offered only when she has left.
 *
 * Sits inside the dock so it rides above the keyboard with the composer rather
 * than being stranded behind it.
 */
export function JumpToLatest({ scroll, label = "Latest" }: { scroll: ChatScroll; label?: string }) {
  if (!scroll.away) return null;
  return (
    <div className="pointer-events-none relative lg:hidden">
      <button
        type="button"
        onClick={() => scroll.toEnd(true)}
        className="ux-press pointer-events-auto absolute -top-[52px] left-1/2 flex min-h-[36px] -translate-x-1/2
                   items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold"
        style={{
          background: "var(--ux-surface)",
          border: "1px solid var(--ux-line-strong)",
          boxShadow: "var(--ux-shadow-card)",
          color: "var(--ux-ink-2)",
          // 36px is under the 44px floor and deliberately so: this is a
          // transient shortcut floating over the thread, not a control, and a
          // 44px disc here covers the message it is telling her about. The
          // destination is always reachable by scrolling.
        }}
      >
        <Icons.ChevronDown className="h-[14px] w-[14px]" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Bubbles
   ═══════════════════════════════════════════════════════════════════════════ */

export type Side = "in" | "out";

/**
 * The shape of a bubble.
 *
 * Sender and receiver differ by four things, three of which survive greyscale
 * and a cheap screen in sunlight: which side of the screen it is on, which
 * corner has the tail, whether it carries an avatar, and — last and least —
 * colour. A chat that separates them by colour alone is unreadable to the
 * roughly one in twelve men who cannot tell these two hues apart, and to
 * anybody outdoors.
 *
 * `tail` is true only on the last bubble of a run, which is how a real chat
 * groups: one tail per turn, not one per message.
 */
export function bubbleRadius(side: Side, tail: boolean): string {
  const R = 18;
  const T = 5;
  if (side === "out") return `${R}px ${R}px ${tail ? T : R}px ${R}px`;
  return `${R}px ${R}px ${R}px ${tail ? T : R}px`;
}

/**
 * A message's timestamp.
 *
 * 12px, not 10 or 11: below 12 nothing on a phone is legible to a reader who
 * needs glasses she may not have, and the app's own floor is 12. Quiet is done
 * with colour and weight instead of by shrinking it out of existence.
 */
export function Stamp({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "on-brand" }) {
  return (
    <span
      className="text-[12px] font-medium tabular-nums"
      style={{ color: tone === "on-brand" ? "var(--ux-on-brand-2)" : "var(--ux-faint)" }}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   The composer
   ═══════════════════════════════════════════════════════════════════════════ */

/** Roughly five lines. Past that the field scrolls rather than eating the thread. */
const MAX_INPUT_H = 132;

/**
 * The field she types in.
 *
 * ── Every attribute here is load-bearing ────────────────────────────────────
 * `enterKeyHint="send"` labels the phone's return key "Send" instead of
 * "return", which is the difference between a form and a conversation.
 * `autoComplete="off"` because there is no autofill token for "a message" and
 * offering her saved addresses over the keyboard is noise. `inputMode="text"`
 * keeps the plain keyboard rather than the URL or numeric one a browser
 * sometimes guesses at. `autoCapitalize="sentences"` and `autoCorrect="on"` are
 * what a message field should do and what a `<textarea>` does not do by
 * default on every engine.
 *
 * `text-[16px]` is not a style choice. iOS Safari zooms the whole page in when
 * a field under 16px takes focus and **does not zoom back out**; the app is
 * then permanently 1.3x too wide. `mobile.css` enforces this for
 * `pointer: coarse`, and it is written here as well so the rule survives a
 * device that reports a fine pointer and a check that does not emulate one.
 *
 * It grows to `MAX_INPUT_H` and then scrolls inside itself — a field that grows
 * without limit pushes the thread off the top of the screen while she is still
 * writing the first message.
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder,
  label,
  disabled = false,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  /** The accessible name. A composer with no label is a box that says nothing. */
  label: string;
  disabled?: boolean;
  className?: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "placeholder" | "aria-label" | "className" | "disabled"
>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Fit the field to what is in it.
   *
   * Two traps, both of which this has already fallen into:
   *
   * 1. `scrollHeight` on an element that has already been given a height
   *    reports that height back, so without resetting to `auto` first the
   *    field can only ever grow.
   * 2. `scrollHeight` of an element inside a `display: none` subtree is **0** —
   *    and the inbox mounts the thread hidden (`hidden lg:flex`) on a phone,
   *    so the very first measurement ran on a hidden field, wrote
   *    `height: 0px`, and nothing re-ran it when she opened the conversation.
   *    Measured: a composer 0 pixels tall, with the placeholder invisible and
   *    nothing to tap. Hence the `> 0` guard, and the observer below.
   */
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const full = el.scrollHeight;
    if (full <= 0) {
      // Not laid out yet. Leave it at its natural one-row height rather than
      // pinning it to nothing.
      el.style.height = "";
      return;
    }
    el.style.height = `${Math.min(full, MAX_INPUT_H)}px`;
    el.style.overflowY = full > MAX_INPUT_H ? "auto" : "hidden";
  }, []);

  useEffect(fit, [value, fit]);

  // The field becoming visible, or the panel changing width when the keyboard
  // opens, both change what it should be — and neither changes `value`.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Width only. `fit` changes the HEIGHT, so re-fitting on a height change is
    // a loop that feeds itself — the browser's own
    // "ResizeObserver loop completed with undelivered notifications".
    let lastW = -1;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w === lastW) return;
      lastW = w;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Enter sends, Shift+Enter breaks the line — the convention every
        // messaging app has taught, and it matches the "Send" the return key
        // is now labelled with.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSend();
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      enterKeyHint="send"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="sentences"
      autoCorrect="on"
      spellCheck
      className={`w-full resize-none bg-transparent text-[16px] leading-[1.45] outline-none lg:text-sm ${className}`}
      style={{ color: "var(--ux-ink)", maxHeight: MAX_INPUT_H }}
      {...rest}
    />
  );
}

/**
 * The bar the composer lives in.
 *
 * On a phone it is the dock — the thing that has to clear the keyboard and the
 * home indicator. On desktop it is a plain block and the surrounding card does
 * the work, so every rule that matters is in the `max-width: 1023px` block of
 * `CSS` above.
 */
export function ChatDock({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ux-chat-dock ${className}`}>{children}</div>;
}

/**
 * A round send button that is a real target.
 *
 * 44px because that is the floor, and because the send button is the control a
 * thumb hits most often and at the most awkward angle — bottom corner, one
 * hand, walking.
 */
export function SendButton({
  onClick,
  disabled,
  label = "Send",
  busy = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="ux-press grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full disabled:opacity-40
                 lg:h-[38px] lg:w-[38px] lg:rounded-[12px]"
      style={{
        background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
        color: "var(--ux-on-brand)",
      }}
    >
      {busy ? (
        <Icons.Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
      ) : (
        <Icons.Send className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * The screen title bar of a conversation: back, who, and what you can do.
 *
 * Phone-only. Above `lg` the desktop panels keep their own headers, which are
 * shaped for a three-column inbox and a rail.
 */
export function ChatHeader({
  onBack,
  backLabel,
  avatar,
  title,
  subtitle,
  actions,
}: {
  onBack?: () => void;
  backLabel: string;
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ux-chat-head lg:hidden">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
          style={{ color: "var(--ux-ink)" }}
        >
          <Icons.ChevronLeft className="h-[24px] w-[24px] rtl:rotate-180" aria-hidden="true" />
        </button>
      )}
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[13px] leading-tight" style={{ color: "var(--ux-muted)" }}>
            {subtitle}
          </span>
        )}
      </span>
      {actions}
    </header>
  );
}

/**
 * A day divider — "Today", "Yesterday", "12 August".
 *
 * A centred pill rather than a rule with text through it. The rule is a web
 * table's idiom; every phone chat draws a small floating label.
 */
export function DayMark({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 flex justify-center">
      <span
        className="rounded-full px-3 py-1 text-[12px] font-semibold"
        style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Reads out who is speaking, for a screen reader only.
 *
 * A thread of bare sentences with no attribution is unusable without sight:
 * the alignment and the tail carry the speaker visually and carry nothing at
 * all to a screen reader. This is what puts the name back.
 */
export function Says({ who }: { who: string }) {
  return <span className="sr-only">{who}: </span>;
}

/** A stable id for pairing a composer with its own label or hint. */
export function useChatId(): string {
  return useId();
}

/**
 * What the browser will tell us about being installed, and what it will not.
 *
 * Everything here is a *question*, never an action. The prompt component and
 * the service-worker registrar both need the same answers — is this a phone,
 * is the app already on her home screen, did she say no last month — and both
 * run in browsers that may not implement any of it. So every function in this
 * file has to answer on a desktop Firefox, an iOS 15 Safari, a Chrome in
 * private mode with storage throwing, and a server render with no `window` at
 * all. None of them may throw; each returns the conservative answer instead.
 *
 * The conservative answer is almost always "no, do not show anything". A
 * missed install prompt costs nothing. A prompt shown to a woman who already
 * installed the app, or a `localStorage` write that throws and blanks the
 * screen, costs her the session.
 */

/**
 * `beforeinstallprompt` is Chromium-only and is not in `lib.dom.d.ts`, so
 * without this the event arrives as a bare `Event` and every call site has to
 * cast. Declaring it once here is what keeps `any` out of the components.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
  interface Navigator {
    /**
     * iOS only, and iOS only. Safari has never implemented
     * `display-mode: standalone` in `matchMedia` reliably on older versions,
     * and this legacy boolean is the one thing that has always been true when
     * launched from the home screen.
     */
    standalone?: boolean;
  }
}

/** Where the browser's own install machinery points her first. */
export const START_URL = "/app";

const DISMISS_KEY = "womsakhi.install.dismissed";
const INSTALLED_KEY = "womsakhi.install.done";

/**
 * Sixty days.
 *
 * A woman who dismisses the card has answered the question. Asking again next
 * week is the behaviour that makes people distrust an app, and the install
 * banner is the single most-abused pattern on the mobile web. Two months is
 * long enough that the next showing reads as a fresh offer rather than
 * nagging, and short enough that someone who dismissed it on a borrowed phone
 * still sees it on her own.
 */
export const SNOOZE_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * `localStorage` throws — it is not merely empty — in Safari private mode and
 * when a browser is configured to block site data. Both reads and writes go
 * through these two so a storage policy can never take the app down with it.
 */
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage is blocked. She simply gets asked again next session. */
  }
}

/** True when the app is running from the home screen, with no browser chrome. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // `display-mode: standalone` is the standard; `minimal-ui` and
    // `fullscreen` are the other two chrome-less modes a launcher may pick,
    // and `navigator.standalone` is iOS's own answer. Any one of them means
    // she is already inside the installed app.
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      navigator.standalone === true
    );
  } catch {
    return false;
  }
}

/** iPhone or iPad — including iPadOS, which lies and claims to be a Mac. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports "Macintosh". A Mac with a touchscreen does not exist,
  // so a touch-capable "Mac" is an iPad.
  return ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
}

/**
 * The in-app browsers that cannot install anything.
 *
 * A link opened from WhatsApp, Instagram or Facebook renders in an embedded
 * webview with no Share → Add to Home Screen. Telling a woman to tap a button
 * that is not on her screen is worse than saying nothing, and this app is
 * shared over exactly those apps.
 */
function isEmbeddedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|MicroMessenger|GSA\//i.test(
    navigator.userAgent,
  );
}

/**
 * An iOS browser that really can add to the home screen.
 *
 * Chrome and Firefox on iOS are Safari underneath and have offered Add to Home
 * Screen through the system share sheet since iOS 16.4, so they are included.
 * Embedded webviews are not — see above.
 */
export function canAddToHomeScreenOnIos(): boolean {
  return isIos() && !isEmbeddedBrowser();
}

/**
 * A touch device, not a laptop.
 *
 * Width alone is wrong: a narrow desktop window is not a phone, and an
 * installed desktop PWA is not what this prompt is for. `pointer: coarse` plus
 * a phone-ish width is the pair that actually separates them.
 */
export function isPhoneLike(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(max-width: 1023px)").matches
    );
  } catch {
    return false;
  }
}

/** Has she already been asked, and said no, recently enough to still count? */
export function isSnoozed(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return true;
  if (readStore(INSTALLED_KEY)) return true;
  const at = Number(readStore(DISMISS_KEY));
  if (!Number.isFinite(at) || at <= 0) return false;
  // A clock that has moved backwards (a phone whose date was wrong and then
  // corrected) would otherwise snooze her for the next sixty years.
  if (at > now) return false;
  return now - at < SNOOZE_MS;
}

export function rememberDismissal(now: number = Date.now()): void {
  writeStore(DISMISS_KEY, String(now));
}

/** Installed once is installed forever — never offer it again on this device. */
export function rememberInstalled(): void {
  writeStore(INSTALLED_KEY, "1");
}

/** Service workers are absent in old browsers and disabled in private mode. */
export function swSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    // A service worker only registers on a secure origin. localhost counts,
    // which is why this is not a bare `https:` check.
    (window.isSecureContext ?? false)
  );
}

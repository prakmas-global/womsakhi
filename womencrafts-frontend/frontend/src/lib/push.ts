"use client";

import { apiPushKey, apiSubscribePush, apiUnsubscribePush } from "./engines-api";

/**
 * Turning on notifications, from the browser's side.
 *
 * ── Why this is more than one call ──────────────────────────────────────────
 * Web push needs four things to line up: a service worker registered, a VAPID
 * key from the server, the browser's own permission, and a subscription saved
 * back. Any one of them can fail quietly, and the failure a woman sees is the
 * same in every case — nothing arrives. So each step returns a named reason
 * instead of a boolean, and the screen says which one stopped.
 *
 * ── The permission rule ─────────────────────────────────────────────────────
 * `Notification.requestPermission()` is asked **only** from a real tap. Chrome
 * and Safari both refuse it otherwise, and a "denied" recorded that way is
 * sticky: she cannot be asked again without going into browser settings. That
 * is why nothing here runs on mount.
 */

export type PushState =
  | "ready"            // subscribed, and the server has it
  | "off"              // supported and permitted, just not subscribed
  | "denied"           // she said no, or the browser decided for her
  | "unsupported"      // no service worker or no PushManager
  | "not-configured";  // the server has no VAPID key

export type PushResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: PushState | "failed" };

function supported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

/**
 * Base64url → the Uint8Array `subscribe()` wants.
 *
 * VAPID keys are published base64url; `atob` only reads standard base64, so
 * the padding and the two substituted characters have to be put back first.
 * Skipping this produces an `InvalidCharacterError` deep inside `subscribe()`
 * that reads like a browser bug rather than a string problem.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  // An ArrayBuffer, not a Uint8Array: `applicationServerKey` is typed
  // `BufferSource`, and a `Uint8Array` backed by a possibly-shared buffer does
  // not satisfy it under this TypeScript's lib. The bytes are identical; this
  // just hands over the buffer itself.
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** What the screen shows before she has tapped anything. */
export async function pushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "ready" : "off";
  } catch {
    return "off";
  }
}

/**
 * Register this browser. Call it from a tap, never on mount.
 *
 * The subscription is sent to the server before this resolves, so a "ready"
 * on screen means the server can actually reach her — not merely that the
 * browser agreed.
 */
export async function enablePush(): Promise<PushResult> {
  if (!supported()) return { ok: false, reason: "unsupported" };

  const { key, enabled } = await apiPushKey();
  if (!enabled || !key) return { ok: false, reason: "not-configured" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than creating a second one: a
    // browser can only hold one per registration, and `subscribe()` on top of
    // one that already exists throws instead of replacing it.
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "failed" };
    }
    await apiSubscribePush({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return { ok: true, endpoint: json.endpoint };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Stop this browser receiving.
 *
 * The server row goes first. If the order were reversed and the second call
 * failed, the browser would be unsubscribed while the server still believed
 * it could reach her — every future send counted as delivered, to nobody.
 */
export async function disablePush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;
    await apiUnsubscribePush(sub.endpoint);
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/**
 * SMS codes through Firebase — used only to PROVE a mobile number.
 *
 * Firebase sends the SMS and checks the code; we then hand the ID token it
 * gives back to our own API (`/auth/phone/firebase` to confirm her number,
 * `/auth/signin/firebase` to sign in with it), which checks Google's signature
 * and owns the session. Firebase never becomes the login: we sign out of it
 * straight after taking the token.
 *
 * Loaded from Google's CDN (the "compat" builds, which expose one global) on
 * first use rather than bundled, so nobody who never sees a phone-code screen
 * downloads it, and the app needs no Firebase npm dependency.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const VERSION = "12.9.0";
const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
type FirebaseGlobal = any;
export type SmsConfirmation = { confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }> };

declare global {
  interface Window {
    firebase?: FirebaseGlobal;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the SMS service. Check your connection."));
    document.head.appendChild(script);
  });
}

async function auth(config: FirebaseWebConfig): Promise<FirebaseGlobal> {
  await loadScript(`${BASE}/firebase-app-compat.js`);
  await loadScript(`${BASE}/firebase-auth-compat.js`);
  const fb = window.firebase;
  if (!fb) throw new Error("Could not load the SMS service.");
  if (!fb.apps.length) fb.initializeApp(config);
  return fb.auth();
}

let verifier: FirebaseGlobal = null;

function isLocalhost(): boolean {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

/**
 * Send an SMS code to `phoneE164` (e.g. +919876543210). `containerId` is an
 * empty element the invisible reCAPTCHA can attach to — Google uses it to
 * stop robots sending SMS on our bill.
 */
export async function sendSmsCode(
  config: FirebaseWebConfig,
  phoneE164: string,
  containerId: string,
  languageCode = "en",
  /**
   * Where Google draws its badge. "bottomright" (the default) is
   * `position: fixed` — and any ancestor with `transform`/`filter`/
   * `backdrop-filter` turns that into "the corner of that ancestor", which is
   * how it ended up over the phone card. "inline" keeps it in the container's
   * own flow, so the page decides where it goes (and may hide it, provided
   * Google's notice is shown instead).
   */
  options: { badge?: "bottomright" | "bottomleft" | "inline" } = {},
): Promise<SmsConfirmation> {
  const a = await auth(config);
  a.languageCode = languageCode;
  // A reCAPTCHA can only ever render into an element once — even after
  // `clear()`. So every attempt gets a brand-new child element; reusing the
  // old one made every retry on the same page fail.
  if (verifier) {
    try { verifier.clear(); } catch { /* already gone */ }
    verifier = null;
  }
  const host = document.getElementById(containerId);
  if (!host) throw new Error("The SMS check could not start. Reload the page and try again.");
  host.innerHTML = "";
  const slot = document.createElement("div");
  host.appendChild(slot);
  // Firebase's robot check rejects every token on `localhost`
  // (firebase-js-sdk #8387 / #10336) even when the project is set up
  // correctly — the same code works on a real domain. So on a developer
  // machine ONLY, use Firebase's official testing mode: it skips the robot
  // check and accepts the TEST numbers listed in the Firebase console
  // (Authentication → Phone → "Phone numbers for testing") with their fixed
  // codes. On app.womsakhi.com the full check runs and real SMS goes out.
  const local = isLocalhost();
  a.settings.appVerificationDisabledForTesting = local;
  verifier = new window.firebase.auth.RecaptchaVerifier(slot, { size: "invisible", badge: options.badge ?? "bottomright" });
  try {
    return await a.signInWithPhoneNumber(phoneE164, verifier);
  } catch (err) {
    // Log the real reason — the screen shows a sentence, the console the code.
    console.error("[sms] Firebase could not send the code:", err);
    try { verifier.clear(); } catch { /* ignore */ }
    verifier = null;
    if (local) throw Object.assign(new Error("localhost"), { code: "local/real-number-on-localhost" });
    throw err;
  }
}

/** Check the code she typed; returns the ID token our API verifies. */
export async function confirmSmsCode(confirmation: SmsConfirmation, code: string): Promise<string> {
  const credential = await confirmation.confirm(code);
  const token = await credential.user.getIdToken();
  // Firebase was only a witness. Our API owns the session.
  try { await window.firebase?.auth().signOut(); } catch { /* nothing to undo */ }
  return token;
}

/** A sentence for her, from Firebase's error codes. */
export function smsErrorMessage(err: unknown): string {
  const code = String((err as { code?: string })?.code ?? "");
  switch (code) {
    case "auth/invalid-verification-code":
      return "That code isn't right. Check the SMS and try again.";
    case "auth/code-expired":
      return "That code has expired. Ask for a new one.";
    case "auth/too-many-requests":
      return "Too many tries from this phone. Please wait a while and try again.";
    case "auth/invalid-phone-number":
      return "That mobile number doesn't look right.";
    case "auth/quota-exceeded":
      return "We can't send SMS just now. Please sign in with your email instead.";
    case "auth/network-request-failed":
      return "No internet connection. Check your connection and try again.";
    case "auth/billing-not-enabled":
      return "SMS isn't enabled for this project's billing yet (auth/billing-not-enabled).";
    case "auth/operation-not-allowed":
      return "Phone sign-in isn't switched on in Firebase (auth/operation-not-allowed).";
    case "auth/captcha-check-failed":
    case "auth/invalid-app-credential":
      return "The robot check failed. Reload the page and try again.";
    case "local/real-number-on-localhost":
      return "On this test computer (localhost), Google only sends codes to the TEST numbers set in Firebase. Use your test number and its fixed code — real SMS works on the live website.";
    case "auth/unauthorized-domain":
      return "This website isn't allowed to send SMS yet (auth/unauthorized-domain).";
    default: {
      // Keep the code visible: it is the only thing that says what went wrong.
      const detail = code || (err instanceof Error ? err.message : "");
      return `We couldn't send or check the SMS. Please try again.${detail ? ` (${detail})` : ""}`;
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

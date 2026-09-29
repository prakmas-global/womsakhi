/**
 * Local-only auth screen previews.
 *
 * `?preview=<state>` on an auth screen draws that screen in that state from the
 * fixtures below: no API calls, no redirects, no real sign-in. The gallery at
 * `/dev/auth-screens` links every one of them.
 *
 * Everything here is guarded by `AUTH_PREVIEW`, which is `false` in a
 * production build. Each file that uses it declares its own copy,
 * `const AUTH_PREVIEW = process.env.NODE_ENV !== "production"`, rather than
 * importing this one: the build replaces NODE_ENV inside each file, so a local
 * copy makes every `if (AUTH_PREVIEW && …)` branch dead code that the minifier
 * removes, while an imported constant is only `false` at run time and ships.
 * Keep it that way: never read `?preview=` without going through it.
 *
 * Plain module (no "use client", no React): `proxy.ts` imports it too.
 */
import type { AuthPayload } from "./api";
import type { AuthOptions, CodeSent, SignedInDevice } from "./auth-api";
import type { ApiDocument, VerificationStatus } from "./verification-api";

export const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/** Every previewable state, by screen. The gallery is built from this list. */
export const PREVIEW_STATES = {
  signin: ["phone", "sms", "sms-wrong", "email", "code", "mfa", "setup", "recovery", "sms-busy"],
  signup: ["contact", "code", "about"],
  phone: ["enter", "confirm", "sms-out"],
  verify: ["upload", "picked", "in-review", "in-review-24h", "needs-info", "rejected-locked", "rejected-can-reapply", "approved"],
  invite: ["valid", "invalid", "accepted", "incomplete"],
  security: ["devices"],
  handoff: ["opening", "expired"],
} as const;

export type SigninPreview = (typeof PREVIEW_STATES.signin)[number];
export type SignupPreview = (typeof PREVIEW_STATES.signup)[number];
export type PhonePreview = (typeof PREVIEW_STATES.phone)[number];
export type VerifyPreview = (typeof PREVIEW_STATES.verify)[number];
export type InvitePreview = (typeof PREVIEW_STATES.invite)[number];
export type HandoffPreview = (typeof PREVIEW_STATES.handoff)[number];

/** The /app screens the route guard lets through with `?preview=` and no session. */
export const PREVIEW_APP_ROUTES = ["/app/verify", "/app/phone", "/app/settings/security"] as const;

/** The preview states each guarded route accepts (the route guard checks the value too). */
export const PREVIEW_ROUTE_STATES: Record<string, readonly string[]> = {
  "/signin": PREVIEW_STATES.signin,
  "/signup": PREVIEW_STATES.signup,
  "/app/verify": PREVIEW_STATES.verify,
  "/app/phone": PREVIEW_STATES.phone,
  "/app/settings/security": PREVIEW_STATES.security,
};

/** The raw `?preview=` value, or null (always null in production and on the server). */
export function previewParam(): string | null {
  if (!AUTH_PREVIEW || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("preview");
}

/** `?preview=` when it is one of `allowed`, else null. Client only. */
export function readPreview<T extends string>(allowed: readonly T[]): T | null {
  if (!AUTH_PREVIEW) return null;
  const v = previewParam();
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * A gallery thumbnail (a frame whose parent is a /dev page) never takes focus
 * or scrolls anything: a screen focusing its first field would otherwise pull
 * the gallery to that thumbnail and swallow the keyboard. (The browser's own
 * autofocus is kept off by the gallery's #gallery address.) Local only; it
 * never runs outside such a frame.
 */
function inGalleryFrame(): boolean {
  try {
    return window.parent !== window && window.parent.location.pathname.startsWith("/dev/");
  } catch {
    return false;
  }
}
if (AUTH_PREVIEW && typeof window !== "undefined" && inGalleryFrame()) {
  HTMLElement.prototype.focus = function noFocus() {};
  Element.prototype.scrollIntoView = function noScrollIntoView() {};
}

// ── fixtures ────────────────────────────────────────────────────────────────

export const PREVIEW_NAME = "Lakshmi Devi";
export const PREVIEW_EMAIL = "anita@example.com";
export const PREVIEW_EMAIL_MASKED = "a****@example.com";
/** Ten digits, shown by the screens as "98765 43210". */
export const PREVIEW_MOBILE = "9876543210";
export const PREVIEW_MOBILE_SHOWN = "98765 43210";

export const PREVIEW_SENT_EMAIL: CodeSent = {
  message: "Code sent", channel: "email", destination: PREVIEW_EMAIL_MASKED, expires_in: 300, resend_in: 30,
};

export const PREVIEW_OPTIONS: AuthOptions = {
  phone_codes: true,
  phone_provider: "preview",
  firebase_project_id: "",
  code_length: 6,
  code_ttl_seconds: 300,
  resend_seconds: 90,
  phone_regions: ["IN"],
  firebase: null,
};

export const PREVIEW_RECOVERY_CODES = [
  "K7QD-4M2X", "P9LA-8VTE", "W3NC-6RHB", "Z5GF-2YJK", "M8TU-7QPD", "B4XS-9LEA", "H6RW-3CNV", "T2KE-5ZMG",
];

/**
 * A QR-shaped placeholder: three finder squares and a deterministic scatter.
 * It is not a scannable code — only the size and look of the real one.
 */
function sampleQrSvg(): string {
  const n = 25;
  const cells: string[] = [];
  // The corner a cell's 8×8 finder zone belongs to (finder + its blank border), if any.
  const zone = (x: number, y: number): [number, number] | null => {
    if (x < 8 && y < 8) return [x, y];
    if (x >= n - 8 && y < 8) return [x - (n - 7), y];
    if (x < 8 && y >= n - 8) return [x, y - (n - 7)];
    return null;
  };
  const finderOn = ([fx, fy]: [number, number]) => {
    if (fx < 0 || fy < 0 || fx > 6 || fy > 6) return false; // the blank border
    const edge = fx === 0 || fx === 6 || fy === 0 || fy === 6;
    const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
    return edge || core;
  };
  let seed = 20260930;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const z = zone(x, y);
      const on = z ? finderOn(z) : (seed >> 8) % 7 < 3;
      if (on) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path fill="#141427" d="${cells.join("")}"/></svg>`;
}

export const PREVIEW_SETUP = {
  ticket: "preview-ticket",
  secret: "JBSWY3DPEHPK3PXPJBSWY3DP",
  provisioning_uri: "otpauth://totp/WomSakhi:a****%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=WomSakhi",
  qr_svg: sampleQrSvg(),
};

type User = AuthPayload["user"];

export const PREVIEW_USER_ID = "preview-user";

/** The fixture user of a local preview: nothing should ask the API on her behalf. */
export function isPreviewUser(u: { id?: string } | null | undefined): boolean {
  return AUTH_PREVIEW && u?.id === PREVIEW_USER_ID;
}

function user(overrides: Partial<User>): User {
  return {
    id: PREVIEW_USER_ID,
    full_name: PREVIEW_NAME,
    email: PREVIEW_EMAIL,
    role: "Member",
    is_active: true,
    created_at: "2026-09-01T09:00:00Z",
    modules: [],
    audience: "member",
    member_id: "preview-member",
    locale: "en",
    phone: `+91${PREVIEW_MOBILE}`,
    phone_verified: true,
    phone_action_required: false,
    email_verified: true,
    reapply_after: "",
    two_factor_enabled: false,
    avatar: "",
    theme_id: "",
    theme_primary: "",
    theme_secondary: "",
    onboarding_done: [],
    onboarding_complete: true,
    verification_status: "active",
    rejection_reason: "",
    ...overrides,
  };
}

/** What a finished staff sign-in hands back; only the recovery screen holds one. */
export const PREVIEW_STAFF_PAYLOAD: AuthPayload = {
  access_token: "",
  token_type: "bearer",
  user: user({ role: "Admin", audience: "staff", member_id: "", two_factor_enabled: true }),
};

/** The message the API gives for a wrong code, near enough. */
export const PREVIEW_WRONG_CODE = "That code is not right. Check it and try again.";

const VERIFY_USER_STATUS: Record<VerifyPreview, User["verification_status"]> = {
  upload: "pending_documents",
  picked: "pending_documents",
  "in-review": "in_review",
  "in-review-24h": "in_review",
  "needs-info": "pending_documents",
  "rejected-locked": "rejected",
  "rejected-can-reapply": "rejected",
  approved: "active",
};

/**
 * The signed-in user an /app preview pretends to be, or null when this is not
 * a preview. Read by AuthContext; the real session is never touched.
 */
export function previewUser(pathname: string): User | null {
  if (!AUTH_PREVIEW) return null;
  const route = PREVIEW_APP_ROUTES.find((r) => pathname === r);
  if (!route) return null;
  if (route === "/app/verify") {
    const s = readPreview(PREVIEW_STATES.verify);
    return s ? user({ verification_status: VERIFY_USER_STATUS[s], onboarding_complete: s !== "approved" }) : null;
  }
  if (route === "/app/phone") {
    const s = readPreview(PREVIEW_STATES.phone);
    return s ? user({ phone: "", phone_verified: false, phone_action_required: true, verification_status: "pending_documents" }) : null;
  }
  return readPreview(PREVIEW_STATES.security) ? user({}) : null;
}

/** True on an /app screen showing a local preview. Client only. */
export function previewActive(pathname: string): boolean {
  return AUTH_PREVIEW && previewUser(pathname) !== null;
}

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const HOUR = 3_600_000;

/** Sample images from the auth photo set stand in for her own photos. */
export const PREVIEW_THUMBS: Record<string, string> = {
  "preview-selfie": "/ux/auth/camera.webp",
  "preview-id": "/ux/auth/upload.webp",
};

function doc(id: "preview-selfie" | "preview-id", status: ApiDocument["status"], note = ""): ApiDocument {
  const selfie = id === "preview-selfie";
  return {
    id,
    user_id: "preview-user",
    member_id: "preview-member",
    doc_type: selfie ? "selfie" : "aadhaar",
    doc_type_label: selfie ? "Selfie" : "Aadhaar",
    original_name: selfie ? "selfie.jpg" : "aadhaar.jpg",
    content_type: "image/webp",
    size: 184_000,
    status,
    review_note: note,
    reviewed_by_name: note ? "Reviewer" : "",
    submitted: iso(-2 * HOUR),
    created_at: iso(-2 * HOUR),
    reviewed_at: note ? iso(-HOUR) : "",
  };
}

/** `/verification/status` as the API would answer it, for each verify state. */
export function previewVerification(state: VerifyPreview): VerificationStatus {
  const base: VerificationStatus = {
    status: VERIFY_USER_STATUS[state],
    label: "",
    email: PREVIEW_EMAIL,
    rejection_reason: "",
    can_use_app: false,
    review_request_count: 0,
    review_requested_at: "",
    next_review_request_at: "",
    submitted_at: "",
    expected_by: "",
    needs_info: false,
    reapply_after: "",
    can_reapply: false,
    documents: [],
  };
  switch (state) {
    case "upload":
      return base;
    case "picked":
      return { ...base, documents: [doc("preview-selfie", "pending"), doc("preview-id", "pending")] };
    case "in-review":
      return {
        ...base, label: "In review", submitted_at: iso(-2 * HOUR), expected_by: iso(22 * HOUR),
        next_review_request_at: iso(22 * HOUR), documents: [doc("preview-selfie", "pending"), doc("preview-id", "pending")],
      };
    case "in-review-24h":
      return {
        ...base, label: "In review", submitted_at: iso(-26 * HOUR), expected_by: iso(-2 * HOUR),
        next_review_request_at: "", documents: [doc("preview-selfie", "pending"), doc("preview-id", "pending")],
      };
    case "needs-info":
      return {
        ...base, needs_info: true,
        rejection_reason: "Your ID photo is blurry. Please take it again in good light, with all 4 corners showing.",
        documents: [doc("preview-selfie", "pending"), doc("preview-id", "rejected", "The photo is blurry.")],
      };
    case "rejected-locked":
      return {
        ...base, rejection_reason: "The name on your ID does not match the name on your account.",
        reapply_after: iso(14 * 24 * HOUR), can_reapply: false,
      };
    case "rejected-can-reapply":
      return {
        ...base, rejection_reason: "The name on your ID does not match the name on your account.",
        reapply_after: iso(-24 * HOUR), can_reapply: true,
      };
    case "approved":
      return { ...base, label: "Active", can_use_app: true };
  }
}

export function previewDevices(): SignedInDevice[] {
  return [
    { id: "preview-d1", label: "Chrome on Android", kind: "web", ip: "", created_at: iso(-3 * 24 * HOUR), last_used_at: iso(0), expires_at: iso(27 * 24 * HOUR), current: true },
    { id: "preview-d2", label: "WomSakhi app · Redmi Note 12", kind: "app", ip: "", created_at: iso(-9 * 24 * HOUR), last_used_at: iso(-3 * HOUR), expires_at: iso(21 * 24 * HOUR), current: false },
    { id: "preview-d3", label: "Safari on Mac", kind: "web", ip: "", created_at: iso(-12 * 24 * HOUR), last_used_at: iso(-5 * 24 * HOUR), expires_at: iso(18 * 24 * HOUR), current: false },
  ];
}

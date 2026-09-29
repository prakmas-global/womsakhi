/**
 * Sign-up and sign-in with one-time codes. There are no passwords.
 *
 *   Join     email + mobile → code to email → name + "I am a woman, 18+"
 *   Sign in  email → code → in (members); staff then add their authenticator
 *
 * Every error the API raises here carries a machine `code` alongside the
 * sentence (`code_wrong`, `resend_too_soon`, `two_factor_required`…), because
 * these screens genuinely branch on it. `authError` reads both.
 */
import axios from "axios";

import { apiClient, apiErrorMessage, expected, type AuthPayload } from "./api";

export type AuthUser = AuthPayload["user"];

export interface AuthOptions {
  phone_codes: boolean;
  phone_provider: string;
  firebase_project_id: string;
  code_length: number;
  code_ttl_seconds: number;
  resend_seconds: number;
  phone_regions: string[];
  /** Public Firebase web config when Firebase sends the SMS codes, else null. */
  firebase: import("./firebase-phone").FirebaseWebConfig | null;
}

export interface CodeSent {
  message: string;
  channel: "email" | "sms";
  destination: string;
  expires_in: number;
  resend_in: number;
}

export interface AuthError {
  message: string;
  code: string;
  status: number;
  /** Extra fields the API attached (ticket, secret, attempts_left, retry_after…). */
  extra: Record<string, unknown>;
}

/** The sentence to show, the code to branch on, and anything else the API sent. */
export function authError(err: unknown, fallback = "Something went wrong. Please try again."): AuthError {
  const message = apiErrorMessage(err, fallback);
  if (!axios.isAxiosError(err) || !err.response) {
    return { message, code: err && axios.isAxiosError(err) ? "network" : "", status: 0, extra: {} };
  }
  const body = (err.response.data as { error?: Record<string, unknown> } | undefined)?.error ?? {};
  const extra: Record<string, unknown> = { ...body };
  const code = extra.code;
  delete extra.code;
  delete extra.message;
  delete extra.request_id;
  return { message, code: typeof code === "string" ? code : "", status: err.response.status, extra };
}

/**
 * A wrong code, a "wait 30 seconds" or "authenticator needed" is an ANSWER the
 * screen handles, not a failed request — so these calls do not raise the
 * app-wide "Some information didn't load" banner.
 */
const ANSWER = expected();

export async function apiAuthOptions(): Promise<AuthOptions> {
  const { data } = await apiClient.get<AuthOptions>("/auth/options");
  return data;
}

// ── join ────────────────────────────────────────────────────────────────────

export async function apiSignupStart(email: string, phone: string, locale: string): Promise<CodeSent> {
  const { data } = await apiClient.post<CodeSent>("/auth/signup/start", { email, phone, locale }, ANSWER);
  return data;
}

/**
 * A ticket for the last step — or, when the address already had an account and
 * the code she typed was the sign-in code we sent instead, a signed-in session.
 */
export type SignupVerified =
  | { signed_in?: false; ticket: string; expires_in: number }
  | ({ signed_in: true } & AuthPayload);

export async function apiSignupVerify(email: string, code: string): Promise<SignupVerified> {
  const { data } = await apiClient.post<SignupVerified>("/auth/signup/verify", { email, code }, ANSWER);
  return data;
}

export async function apiSignupComplete(input: {
  ticket: string;
  full_name: string;
  is_woman_18_plus: boolean;
  locale: string;
}): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signup/complete", input, ANSWER);
  return data;
}

// ── sign in ─────────────────────────────────────────────────────────────────

export async function apiSigninStart(input: { email?: string; phone?: string }): Promise<CodeSent> {
  const { data } = await apiClient.post<CodeSent>("/auth/signin/start", input, ANSWER);
  return data;
}

export async function apiSigninVerify(input: { email?: string; phone?: string; code: string }): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signin/verify", input, ANSWER);
  return data;
}

/** Staff: the authenticator step after the email code. */
export async function apiTwoFactorVerify(ticket: string, code: string): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/two-factor/verify", { ticket, code }, ANSWER);
  return data;
}

/** Staff, first sign-in: confirm the new authenticator. Returns recovery codes once. */
export async function apiTwoFactorEnroll(
  ticket: string,
  code: string,
): Promise<AuthPayload & { recovery_codes: string[] }> {
  const { data } = await apiClient.post("/auth/two-factor/enroll", { ticket, code }, ANSWER);
  return data;
}

// ── devices ─────────────────────────────────────────────────────────────────

export interface SignedInDevice {
  id: string;
  label: string;
  kind: "web" | "app";
  ip: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  current: boolean;
}

export async function apiMyDevices(): Promise<SignedInDevice[]> {
  const { data } = await apiClient.get<{ sessions: SignedInDevice[] }>("/auth/sessions");
  return data.sessions;
}

export async function apiRemoveDevice(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete(`/auth/sessions/${encodeURIComponent(id)}`);
  return data;
}

export async function apiSignOutEverywhere(): Promise<{ message: string }> {
  const { data } = await apiClient.post("/auth/signout-everywhere", null, ANSWER);
  return data;
}

// ── her mobile number ───────────────────────────────────────────────────────

export async function apiSetPhone(phone: string): Promise<{ phone: string; phone_verified: boolean }> {
  const { data } = await apiClient.post("/auth/phone", { phone }, ANSWER);
  return data;
}

export async function apiPhoneStart(): Promise<CodeSent> {
  const { data } = await apiClient.post<CodeSent>("/auth/phone/start", null, ANSWER);
  return data;
}

export async function apiPhoneVerify(code: string): Promise<{ phone: string; phone_verified: boolean }> {
  const { data } = await apiClient.post("/auth/phone/verify", { code }, ANSWER);
  return data;
}

/**
 * Ask before Firebase sends an SMS (it sends from the browser, where we can't
 * count it). Refused with code `sms_limit` once today's allowance is used.
 */
export async function apiSmsAllowance(phone: string, purpose: "signin" | "phone_verify"): Promise<void> {
  await apiClient.post("/auth/sms/allowance", { phone, purpose }, ANSWER);
}

/** Today's SMS allowance is used up: confirm the number tomorrow instead. */
export async function apiPhoneLater(): Promise<void> {
  await apiClient.post("/auth/phone/later", null, ANSWER);
}

/** Confirm her number with the Firebase ID token from a checked SMS code. */
export async function apiPhoneFirebase(idToken: string): Promise<{ phone: string; phone_verified: boolean }> {
  const { data } = await apiClient.post("/auth/phone/firebase", { id_token: idToken }, ANSWER);
  return data;
}

/** Sign in with a confirmed mobile number (Firebase checked the SMS code). */
export async function apiSigninFirebase(idToken: string): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signin/firebase", { id_token: idToken }, ANSWER);
  return data;
}

// ── the app as her key (the website half) ───────────────────────────────────

export async function apiHandoffRedeem(code: string): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/handoff/redeem", { code }, ANSWER);
  return data;
}

export async function apiQrStart(): Promise<{ qid: string; nonce: string; qr: string; expires_in: number }> {
  const { data } = await apiClient.post("/auth/qr/start", null, ANSWER);
  return data;
}

export async function apiQrPoll(qid: string, nonce: string): Promise<{ status: string } & Partial<AuthPayload>> {
  const { data } = await apiClient.post(`/auth/qr/${encodeURIComponent(qid)}/poll`, { nonce }, ANSWER);
  return data;
}

export async function apiSigninWithAppCode(email: string, code: string): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signin/app-code", { email, code }, ANSWER);
  return data;
}

/** Where an account belongs the moment it is signed in. */
export function homeFor(user: AuthUser): string {
  if (user.audience !== "member") return "/dashboard";
  if (user.phone_action_required) return "/app/phone";
  if (user.verification_status !== "active") return "/app/verify";
  if (!user.onboarding_complete) return "/app/welcome";
  return "/app";
}

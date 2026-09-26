import axios from "axios";

import { apiClient, apiErrorMessage } from "./api";
import { apiBase } from "./api-base";

const API_URL = apiBase();

/** Multipart needs its own instance — the shared client forces a JSON content type. */
const uploadClient = axios.create({ baseURL: API_URL, withCredentials: true });

export type VerificationState =
  | "pending_email"
  | "pending_documents"
  | "in_review"
  | "active"
  | "rejected"
  | "suspended";

export interface ApiDocument {
  id: string;
  user_id: string;
  member_id: string;
  doc_type: string;
  doc_type_label: string;
  original_name: string;
  content_type: string;
  size: number;
  status: "pending" | "approved" | "rejected";
  review_note: string;
  reviewed_by_name: string;
  submitted: string;
  created_at: string;
  reviewed_at: string;
}

export interface VerificationStatus {
  status: VerificationState;
  label: string;
  email: string;
  rejection_reason: string;
  can_use_app: boolean;
  documents: ApiDocument[];
}

export interface QueueItem {
  user_id: string;
  member_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: VerificationState;
  applied: string;
  documents: ApiDocument[];
}

/** The ID types we accept, in the order they're offered. */
export const DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar card" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_licence", label: "Driving licence" },
  { value: "pan", label: "PAN card" },
  { value: "national_id", label: "National ID" },
  { value: "other", label: "Other government ID" },
] as const;

export const MAX_DOCUMENT_MB = 10;
export const ACCEPTED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

/**
 * Extensions for the same kinds, used only when the browser gives us no type.
 *
 * A file arriving straight from a camera often has a blank `type`: several
 * Android camera apps hand the picture back through a content URI without a
 * MIME type, and the old check read that blank as "not a photo" and refused a
 * picture the woman had just taken. The name is the fallback, never the
 * override — a real `image/*` type is still what decides.
 */
const ACCEPTED_DOCUMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];

export function validateDocument(file: File): string | null {
  const type = file.type.toLowerCase();
  const named = ACCEPTED_DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (type ? !ACCEPTED_DOCUMENT_TYPES.includes(type) : !named) {
    return "Please upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.";
  }
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
    return `That file is larger than the ${MAX_DOCUMENT_MB} MB limit.`;
  }
  return null;
}

export async function apiMyVerification(): Promise<VerificationStatus> {
  const { data } = await apiClient.get<VerificationStatus>("/verification/status");
  return data;
}

export async function apiResendVerificationEmail(): Promise<{ message: string }> {
  const { data } = await apiClient.post("/verification/resend-email");
  return data;
}

/** Public — called from the link in the email, possibly while signed out. */
export async function apiConfirmEmail(token: string): Promise<{ message: string }> {
  const { data } = await axios.post(
    `${API_URL}/verification/confirm-email`,
    null,
    { params: { token } }
  );
  return data;
}

/**
 * Ask for a reset link.
 *
 * Public, and answers identically whether or not the address has an account —
 * telling a stranger which emails are members is an enumeration oracle, and on
 * a women-only platform that answers "is she here?" for anyone who asks.
 */
export async function apiForgotPassword(email: string): Promise<{ message: string; can_email?: boolean }> {
  const { data } = await axios.post(`${API_URL}/auth/forgot-password`, { email });
  return data;
}

/** Spend the token from the emailed link and set the new password. */
export async function apiResetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  const { data } = await axios.post(`${API_URL}/auth/reset-password`, { token, password });
  return data;
}

export async function apiUploadDocument(
  file: File,
  docType: string,
  onProgress?: (percent: number) => void
): Promise<ApiDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  const { data } = await uploadClient.post<ApiDocument>("/verification/documents", form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

// --- staff ---

export async function apiVerificationQueue(state?: VerificationState): Promise<{
  items: QueueItem[];
  total: number;
}> {
  const { data } = await apiClient.get("/verification/queue", { params: { state } });
  return data;
}

export async function apiApproveApplicant(userId: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/verification/${userId}/approve`);
  return data;
}

export async function apiRejectApplicant(
  userId: string,
  reason: string
): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/verification/${userId}/reject`, { reason });
  return data;
}

/**
 * ID documents are never public URLs. Fetch with the auth header and hand back
 * a short-lived object URL for display — revoke it when the viewer closes.
 */
export async function apiDocumentObjectUrl(documentId: string): Promise<string> {
  const { data } = await uploadClient.get(`/verification/documents/${documentId}/file`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

// --- member support threads (staff side) ---

export interface SupportThreadMessage {
  id: string;
  sender: "member" | "team";
  sender_name: string;
  body: string;
  sent_at: string;
  sent_label: string;
}

export interface SupportThread {
  user_id: string;
  full_name: string;
  email: string;
  avatar: string;
  unread: number;
  last_message: string;
  last_at: string;
  messages: SupportThreadMessage[];
}

export async function apiSupportThreads(): Promise<SupportThread[]> {
  const { data } = await apiClient.get<SupportThread[]>("/verification/threads");
  return data;
}

export async function apiReplyToThread(userId: string, body: string): Promise<SupportThreadMessage> {
  const { data } = await apiClient.post<SupportThreadMessage>(
    `/verification/threads/${userId}/reply`,
    { body }
  );
  return data;
}

export function verificationErrorMessage(err: unknown): string {
  // Same fix as `getAuthError`: this API wraps errors as
  // `{ error: { message } }`, not `{ detail }`, so the old reader always
  // missed and every expired reset link said "Something went wrong."
  return apiErrorMessage(err);
}

// --- review desk (admin side) ---
//
// What the queue screen at /dashboard/users/verification reads. The older
// `apiVerificationQueue` above is kept for anything else that calls it; the
// server answers both with the same, wider shape.

export const REVIEW_STATES: VerificationState[] = [
  "in_review",
  "pending_documents",
  "pending_email",
  "active",
  "rejected",
  "suspended",
];

export const REVIEW_STATE_LABEL: Record<VerificationState, string> = {
  in_review: "Awaiting review",
  pending_documents: "No ID yet",
  pending_email: "Unconfirmed email",
  active: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const REVIEW_STATE_TONE: Record<VerificationState, "amber" | "sky" | "slate" | "emerald" | "rose"> = {
  in_review: "amber",
  pending_documents: "sky",
  pending_email: "slate",
  active: "emerald",
  rejected: "rose",
  suspended: "slate",
};

export type QueueCounts = Record<VerificationState, number>;

export interface QueueRow extends QueueItem {
  rejection_reason: string;
  updated: string;
}

export interface ReviewQueue {
  items: QueueRow[];
  total: number;
  counts: QueueCounts;
}

export async function apiReviewQueue(params: {
  state?: VerificationState | "all";
  q?: string;
}): Promise<ReviewQueue> {
  const { data } = await apiClient.get<ReviewQueue>("/verification/queue", {
    params: { state: params.state, q: params.q || undefined },
  });
  return data;
}

/** One staff member opening one document, from the document's own access log. */
export interface DocumentAccess {
  by: string;
  name: string;
  at: string;
}

export interface ReviewedDocument extends ApiDocument {
  access_count: number;
  access_log: DocumentAccess[];
  encrypted: boolean;
}

/** One decision taken about an applicant, read back from the audit log. */
export interface DecisionRecord {
  id: string;
  user_name: string;
  action: string;
  label: string;
  detail: string;
  when: string;
  created_at: string;
}

export interface ApplicantDetail {
  user_id: string;
  member_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: VerificationState;
  status_label: string;
  applied: string;
  applied_at: string;
  email_verified_at: string;
  verified_at: string;
  updated_at: string;
  rejection_reason: string;
  documents: ReviewedDocument[];
  history: DecisionRecord[];
}

export async function apiApplicantDetail(userId: string): Promise<ApplicantDetail> {
  const { data } = await apiClient.get<ApplicantDetail>(`/verification/applicants/${userId}`);
  return data;
}

/** Send her back to the upload step with a note saying what to change. */
export async function apiRequestResubmission(
  userId: string,
  reason: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/verification/${userId}/request-resubmission`, { reason });
  return data;
}

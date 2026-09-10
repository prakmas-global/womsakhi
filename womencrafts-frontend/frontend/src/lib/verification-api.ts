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

export function validateDocument(file: File): string | null {
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type.toLowerCase())) {
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
export async function apiForgotPassword(email: string): Promise<{ message: string }> {
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

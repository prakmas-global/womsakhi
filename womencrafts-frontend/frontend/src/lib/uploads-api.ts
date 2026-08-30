import axios from "axios";

import { type ApiDocument } from "./me-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1";

/**
 * Uploads need their own axios instance: the shared apiClient forces
 * `Content-Type: application/json`, which would stop the browser from adding the
 * multipart boundary a file POST needs. The session rides along in the httpOnly
 * cookie via `withCredentials`.
 */
const uploadClient = axios.create({ baseURL: API_URL, withCredentials: true });

export type UploadKind = "avatar" | "cover" | "attachment";

export interface ApiUpload {
  id: string;
  original_name: string;
  stored_name: string;
  url: string;
  content_type: string;
  size: number;
  size_label: string;
  kind: UploadKind;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded: string;
  created_at: string;
}

export interface UploadStats {
  total: number;
  total_bytes: number;
  total_label: string;
  by_kind: Record<string, number>;
}

/** What the backend accepts — checked here too so we can fail fast, before the request. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
export const MAX_UPLOAD_MB = 5;

/** Human-readable reason this file can't be uploaded, or null if it's fine. */
export function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return "That's not a supported image (use JPG, PNG, WEBP, GIF or AVIF).";
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `That image is larger than the ${MAX_UPLOAD_MB} MB limit.`;
  }
  return null;
}

export async function apiUploadImage(
  file: File,
  kind: UploadKind = "attachment",
  onProgress?: (percent: number) => void
): Promise<ApiUpload> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);

  const { data } = await uploadClient.post<ApiUpload>("/uploads", form, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function apiListUploads(params: {
  kind?: UploadKind;
  q?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<{ items: ApiUpload[]; total: number; page: number; page_size: number; pages: number }> {
  const { data } = await uploadClient.get("/uploads", { params });
  return data;
}

export async function apiUploadStats(): Promise<UploadStats> {
  const { data } = await uploadClient.get<UploadStats>("/uploads/stats");
  return data;
}

export async function apiDeleteUpload(id: string): Promise<void> {
  await uploadClient.delete(`/uploads/${id}`);
}

/** Turn an axios error into the message the API sent, with a sane fallback. */
export function uploadErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (err.response?.status === 413) return `That image is larger than the ${MAX_UPLOAD_MB} MB limit.`;
  }
  return "Upload failed. Please try again.";
}

/* ── Papers, not pictures ─────────────────────────────────────────────── */

/** What the document endpoint accepts. Must match `ALLOWED_DOC_TYPES`. */
export const ACCEPTED_DOC_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "application/pdf",
];
export const MAX_DOCUMENT_MB = 10;

/**
 * Say no here rather than after the upload.
 *
 * A woman on a slow connection who watches a 12 MB photo of her Aadhaar climb
 * for two minutes before the server refuses it has paid for that refusal in
 * data she buys by the megabyte. The same rule runs on the server; this one
 * only saves her the trip.
 */
export function validateDocument(file: File): string | null {
  if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
    return "That has to be a photo or a PDF — JPG, PNG, WEBP, HEIC or PDF.";
  }
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
    return `That file is larger than ${MAX_DOCUMENT_MB} MB. A photo taken on the camera's smaller setting usually fits.`;
  }
  return null;
}

/**
 * Keep one paper in her vault.
 *
 * Not `/verification/documents`, which is the identity check: that endpoint
 * puts the account into review, emails a reviewer, and refuses outright once
 * she is verified — so a vault wired to it could never accept a paper from
 * anyone who had finished signing up.
 */
export async function apiUploadDocument(file: File, docType: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("doc_type", docType);
  const { data } = await uploadClient.post<ApiDocument>("/me/documents", body);
  return data;
}

import axios from "axios";

import { type ApiDocument } from "./me-api";
import { apiBase } from "./api-base";

const API_URL = apiBase();

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
/** What the server takes per file — the size that has to leave the device. */
export const MAX_UPLOAD_MB = 5;
/**
 * What she may pick. A phone camera JPEG or HEIC is routinely 6–12 MB, and it
 * never goes up at that size: `optimiseImage` shrinks it (640px for a photo of
 * her) first, and `apiUploadImage` checks the result against MAX_UPLOAD_MB.
 */
export const MAX_PICK_MB = 25;

/**
 * Formats a phone camera produces that the server does not take as-is. They are
 * accepted here because `optimiseImage` re-encodes them to webp before upload;
 * if this browser cannot decode them, the upload stops with `UNSUPPORTED_PHOTO`.
 */
const REENCODE_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", avif: "image/avif", heic: "image/heic", heif: "image/heif",
};

export const UNSUPPORTED_PHOTO = "This photo format isn't supported — choose a JPG or PNG.";
const TOO_BIG_AFTER_SHRINK = `That image is still larger than ${MAX_UPLOAD_MB} MB after resizing — choose a smaller photo.`;

/**
 * The file's image type, falling back to its extension.
 *
 * Android's camera hands the browser a file with a BLANK `type` (and some
 * gallery apps send `application/octet-stream`), so trusting `file.type` alone
 * refused a photo she had just taken.
 */
export function imageTypeOf(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t && t !== "application/octet-stream") return t === "image/jpg" ? "image/jpeg" : t;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_TYPES[ext] ?? t;
}

/** Human-readable reason this file can't be uploaded, or null if it's fine. */
export function validateImage(file: File): string | null {
  const type = imageTypeOf(file);
  if (!ACCEPTED_IMAGE_TYPES.includes(type) && !REENCODE_TYPES.includes(type)) {
    return type ? UNSUPPORTED_PHOTO : "That's not a photo we can use — choose a JPG or PNG.";
  }
  // Every image is shrunk before upload, so the original's size is not what
  // reaches the server; a 9 MB camera photo is routinely under 200 KB after.
  // GIFs are sent as they are (resizing would drop the animation), so they
  // still have to fit the server's limit as picked.
  const limit = type === "image/gif" ? MAX_UPLOAD_MB : MAX_PICK_MB;
  if (file.size > limit * 1024 * 1024) {
    return `That image is larger than the ${limit} MB limit.`;
  }
  return null;
}

/**
 * Resize camera-sized images before they leave the device. GIFs stay intact so
 * animation is not lost; unsupported browser decoders fall back to the source
 * and the server still applies its normal type and size checks.
 */
async function optimiseImage(file: File, kind: UploadKind): Promise<File> {
  const type = imageTypeOf(file);
  const mustReencode = REENCODE_TYPES.includes(type);
  if (type === "image/gif" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A HEIC this browser cannot decode would only be refused by the server
    // after the whole upload — say so now instead.
    if (mustReencode) throw new Error(UNSUPPORTED_PHOTO);
    return withType(file, type);
  }
  try {
    const limit = kind === "avatar" ? 640 : kind === "cover" ? 1600 : 2000;
    const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (!mustReencode && scale === 1 && type === "image/webp" && file.size < 600 * 1024) {
      return withType(file, type);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      if (mustReencode) throw new Error(UNSUPPORTED_PHOTO);
      return withType(file, type);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob || (!mustReencode && blob.size >= file.size)) {
      if (mustReencode) throw new Error(UNSUPPORTED_PHOTO);
      return withType(file, type);
    }
    const stem = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${stem}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/** A blank-typed camera file, relabelled with the type its extension names so
 *  the server's content-type check sees what it is. */
function withType(file: File, type: string): File {
  if (!type || file.type === type) return file;
  return new File([file], file.name || "photo.jpg", { type, lastModified: file.lastModified });
}

export async function apiUploadImage(
  file: File,
  kind: UploadKind = "attachment",
  onProgress?: (percent: number) => void
): Promise<ApiUpload> {
  const uploadFile = await optimiseImage(file, kind);
  // The shrink is what makes a 25 MB pick acceptable; if it could not happen
  // (a browser that cannot decode the file) say so here rather than sending
  // megabytes the server will refuse.
  if (uploadFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(TOO_BIG_AFTER_SHRINK);
  }
  const form = new FormData();
  form.append("file", uploadFile);
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
  if (err instanceof Error && (err.message === UNSUPPORTED_PHOTO || err.message === TOO_BIG_AFTER_SHRINK)) return err.message;
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

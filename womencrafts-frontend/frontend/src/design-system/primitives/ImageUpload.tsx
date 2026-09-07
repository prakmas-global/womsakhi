"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";

import {
  apiUploadImage,
  uploadErrorMessage,
  validateImage,
  type UploadKind,
} from "@/lib/uploads-api";

/**
 * Picks an image, uploads it, and hands the saved URL back through `onChange`.
 *
 * Two looks:
 *   • variant="avatar" — round photo puck with a camera badge (profiles, members)
 *   • variant="cover"  — wide drop zone with a preview (content covers, banners)
 *
 * Both accept a drag-and-drop, show real upload progress, and can clear the
 * picture again. Passing `value={null}` simply means "nothing uploaded yet".
 */
export default function ImageUpload({
  value,
  onChange,
  kind = "attachment",
  variant = "cover",
  label,
  hint,
  name = "",
  disabled = false,
  compact = false,
  size = "lg",
  className = "",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  kind?: UploadKind;
  variant?: "avatar" | "cover";
  label?: string;
  hint?: string;
  /** Used for the fallback initials on the avatar variant. */
  name?: string;
  disabled?: boolean;
  /** avatar variant only — render just the photo puck, no side text or buttons. */
  compact?: boolean;
  /** avatar variant only — puck size. */
  size?: "md" | "lg";
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (file: File) => {
      const problem = validateImage(file);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      setBusy(true);
      setProgress(0);
      try {
        const saved = await apiUploadImage(file, kind, setProgress);
        onChange(saved.url);
      } catch (err) {
        setError(uploadErrorMessage(err));
      } finally {
        setBusy(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
      }
    },
    [kind, onChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || busy) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void send(file);
    },
    [disabled, busy, send]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !busy) setDragging(true);
    },
    [disabled, busy]
  );

  const fileInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/*"
      className="hidden"
      disabled={disabled || busy}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void send(file);
      }}
    />
  );

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";

  // ---- avatar ---------------------------------------------------------------
  if (variant === "avatar") {
    const puck = size === "md" ? "h-16 w-16" : "h-24 w-24";
    const badge = size === "md" ? "h-6 w-6" : "h-8 w-8";
    const badgeIcon = size === "md" ? "h-3 w-3" : "h-4 w-4";

    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          className={`group relative shrink-0 rounded-full transition ${puck} ${
            dragging ? "scale-105" : ""
          }`}
        >
          <label
            htmlFor={inputId}
            className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full ring-4 transition ${puck} ${
              dragging ? "ring-brand-400" : "ring-white dark:ring-white/10"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            style={{ boxShadow: "var(--wc-shadow-overlay)" }}
          >
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={value} alt={name || "Uploaded image"} className="h-full w-full object-cover" />
            ) : (
              <span
                className={`flex h-full w-full items-center justify-center bg-linear-to-br from-brand-500 to-violet-600 font-display font-bold text-white ${
                  size === "md" ? "text-lg" : "text-2xl"
                }`}
              >
                {initials}
              </span>
            )}

            {/* hover scrim */}
            <span className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 transition group-hover:opacity-100">
              <Camera className={size === "md" ? "h-4 w-4 text-white" : "h-6 w-6 text-white"} />
            </span>

            {busy && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/70 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-2xs font-semibold">{progress}%</span>
              </span>
            )}
          </label>

          <label
            htmlFor={inputId}
            className={`absolute -bottom-0.5 -right-0.5 flex cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-700 ${badge}`}
            aria-label="Upload a photo"
          >
            <Camera className={badgeIcon} />
          </label>
        </div>

        {compact ? (
          <>
            {error && <p className="text-xs font-medium text-status-danger-ink">{error}</p>}
            {fileInput}
          </>
        ) : (
        <div className="min-w-0">
          {label && <p className="font-display text-sm font-semibold text-ink">{label}</p>}
          <p className="mt-0.5 text-xs text-ink-subtle">
            {hint ?? "JPG, PNG or WEBP — up to 5 MB."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="btn btn-outline btn-sm cursor-pointer">
              <UploadCloud className="h-3.5 w-3.5" />
              {value ? "Replace" : "Upload"}
            </label>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
                className="btn btn-danger btn-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-medium text-status-danger-ink">{error}</p>}
        </div>
        )}

        {!compact && fileInput}
      </div>
    );
  }

  // ---- cover ----------------------------------------------------------------
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</label>
      )}

      {value ? (
        <div className="wc-inset group relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={value} alt="Uploaded" className="h-40 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/55 opacity-0 backdrop-blur-[2px] transition group-hover:opacity-100">
            <label htmlFor={inputId} className="btn btn-outline btn-sm cursor-pointer">
              <UploadCloud className="h-3.5 w-3.5" />
              Replace
            </label>
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              className="btn btn-danger btn-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition ${
            dragging
              ? "border-brand-400 bg-brand-tint"
              : "border-line-strong bg-surface-inset/60 hover:border-brand-300 hover:bg-brand-tint/40 dark:bg-white/3"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-brand-ink" />
              <p className="text-xs font-semibold text-ink">Uploading… {progress}%</p>
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-linear-to-r from-brand-500 to-violet-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/25">
                <ImagePlus className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-ink">
                Drop an image here, or <span className="text-brand-ink">browse</span>
              </p>
              <p className="text-xs text-ink-subtle">{hint ?? "JPG, PNG, WEBP or GIF — up to 5 MB."}</p>
            </>
          )}
        </label>
      )}

      {error && <p className="mt-2 text-xs font-medium text-status-danger-ink">{error}</p>}
      {fileInput}
    </div>
  );
}

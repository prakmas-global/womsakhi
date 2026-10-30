"use client";
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";
import * as Icons from "@/components/ux/icons";
import { apiErrorMessage } from "@/lib/api";
import { apiUploadImage, validateImage } from "@/lib/uploads-api";

export const STORE_GALLERY_LIMIT = 8;

export function StoreGalleryEditor({ photos, disabled, onSave, onBusyChange }: {
  photos: string[]; disabled: boolean; onSave: (photos: string[]) => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const hintId = useId();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    if (disabled || locked.current) return;
    locked.current = true;
    onBusyChange(true); setError("");
    try { await action(); }
    catch (e) { setError(apiErrorMessage(e, e instanceof Error ? e.message : undefined)); setStatus(""); }
    finally { locked.current = false; onBusyChange(false); }
  };

  const upload = (files: File[]) => run(async () => {
    if (!files.length) return;
    if (photos.length + files.length > STORE_GALLERY_LIMIT) throw new Error(`Your gallery holds up to ${STORE_GALLERY_LIMIT} photos. You can add ${STORE_GALLERY_LIMIT - photos.length} more.`);
    for (const file of files) { const bad = validateImage(file); if (bad) throw new Error(`${file.name}: ${bad}`); }
    let next = [...photos];
    for (const [index, file] of files.entries()) {
      setStatus(`Uploading photo ${index + 1} of ${files.length}…`);
      const uploaded = await apiUploadImage(file, "cover", (percent) => setStatus(`Uploading photo ${index + 1} of ${files.length} · ${percent}%`));
      next = [...next, uploaded.url];
      // Save each successful photo, so a later connection failure does not lose the batch.
      await onSave(next);
    }
    setStatus(`${files.length} ${files.length === 1 ? "photo added" : "photos added"}. Changes saved.`);
  });

  const change = (next: string[], message: string) => run(async () => { await onSave(next); setStatus(message); });
  const reorder = (index: number, offset: number) => { const next = [...photos]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; void change(next, "Photo order saved."); };

  return (
    <section aria-label="Shop showcase photos" data-store-gallery-editor>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Showcase your shop</h3>
        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{photos.length} of {STORE_GALLERY_LIMIT} photos</span>
      </div>
      <p id={hintId} className="mb-3 mt-1 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>Show your products, workspace or finished work. Choose several photos together. Photos appear publicly on your shop page and save automatically.</p>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => <li key={photo} className="min-w-0 rounded-xl border p-2" style={{ borderColor: "var(--ux-line)" }}>
          <img src={photo} alt={`Shop showcase photo ${index + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
          <div className="mt-1 flex items-center justify-between gap-1">
            <button type="button" disabled={disabled || index === 0} onClick={() => reorder(index, -1)} aria-label={`Move photo ${index + 1} earlier`} className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-40"><Icons.ArrowLeft className="h-4 w-4" /></button>
            <button type="button" disabled={disabled || index === photos.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move photo ${index + 1} later`} className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-40"><Icons.ArrowRight className="h-4 w-4" /></button>
            <button type="button" disabled={disabled} onClick={() => void change(photos.filter((_, at) => at !== index), "Photo removed from your gallery.")} aria-label={`Remove shop photo ${index + 1}`} className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-40" style={{ color: "var(--ux-danger-ink)" }}><Icons.Trash2 className="h-4 w-4" /></button>
          </div>
        </li>)}
      </ol>
      <button type="button" disabled={disabled || photos.length >= STORE_GALLERY_LIMIT} onClick={() => input.current?.click()} aria-describedby={hintId}
        className="ux-press mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-60"
        style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}><Icons.ImagePlus className="h-4 w-4" /> {photos.length ? "Add more photos" : "Add showcase photos"}</button>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" disabled={disabled} aria-label="Choose shop showcase photos"
        onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} />
      <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>JPG, PNG, WebP and other supported photos. Camera photos are resized before upload; up to 25 MB per original (GIF: 5 MB).</p>
      <p role="status" className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>{status}</p>
      {error && <p role="alert" className="mt-2 text-sm" style={{ color: "var(--ux-danger-ink)" }}>{error} Earlier saved photos are kept. Choose the remaining photos to retry.</p>}
    </section>
  );
}

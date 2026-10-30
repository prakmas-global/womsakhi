"use client";
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";
import * as Icons from "@/components/ux/icons";

/** Buyer-facing showcase; native dialog provides Escape, focus trapping and focus return. */
export function StoreGallery({ photos, name }: { photos: string[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selected, setSelected] = useState(0);
  if (!photos.length) return null;
  const move = (offset: number) => setSelected((at) => (at + offset + photos.length) % photos.length);
  return (
    <section aria-label={`${name} photo gallery`} data-store-gallery>
      <h2 className="mb-2 text-base font-bold" style={{ color: "var(--ux-ink)" }}>A look inside the shop</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--ux-muted)" }}>Tap a photo to take a closer look.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <button type="button" key={photo} onClick={() => { setSelected(index); dialog.current?.showModal(); }}
            className="ux-press aspect-[4/3] overflow-hidden rounded-xl border" style={{ borderColor: "var(--ux-line)" }}
            aria-label={`View shop photo ${index + 1} of ${photos.length}`}>
            <img src={photo} alt={`${name}, showcase photo ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[90dvh] w-[min(94vw,960px)] overflow-auto rounded-2xl border p-4 backdrop:bg-black/65"
        style={{ background: "var(--ux-surface, var(--surface))", color: "var(--ux-ink, var(--foreground))", borderColor: "var(--ux-line, var(--field-line))" }}
        onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); move(1); } }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-sm font-bold">{name} · Photo {selected + 1} of {photos.length}</h2>
          <button type="button" onClick={() => dialog.current?.close()} autoFocus aria-label="Close photo" className="grid h-11 w-11 shrink-0 place-items-center rounded-full"><Icons.X className="h-5 w-5" /></button>
        </div>
        <img src={photos[selected]} alt={`${name}, showcase photo ${selected + 1}`} className="max-h-[65dvh] w-full rounded-xl object-contain" />
        {photos.length > 1 && <div className="mt-3 flex justify-between gap-3">
          <button type="button" onClick={() => move(-1)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Previous photo</button>
          <button type="button" onClick={() => move(1)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Next photo</button>
        </div>}
      </dialog>
    </section>
  );
}

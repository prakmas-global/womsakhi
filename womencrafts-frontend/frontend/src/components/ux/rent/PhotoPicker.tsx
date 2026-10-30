"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { v } from "@/components/ux/kit";
import { ACCEPTED_IMAGE_TYPES, apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";

/**
 * Photos, by tapping — for a thing she rents out, and for its condition at
 * handover and return. The camera on a phone; the first photo is the cover.
 * Photos taken at both ends are what settle a disagreement later, so the
 * handover and return screens ask for them too.
 */
export function PhotoPicker({ value, onChange, max = 6, label = "Add a photo", hint }: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    let next = [...value];
    for (const file of Array.from(files).slice(0, max - value.length)) {
      const bad = validateImage(file);
      if (bad) { setError(bad); continue; }
      setBusy(1);
      try {
        const up = await apiUploadImage(file, "attachment", (p) => setBusy(Math.max(1, p)));
        next = [...next, up.url];
        onChange(next);
      } catch (e) {
        setError(uploadErrorMessage(e));
      }
    }
    setBusy(0);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
            <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute start-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: "rgba(16,6,24,.7)" }}>
                Cover
              </span>
            )}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== src))} aria-label={`Remove photo ${i + 1}`}
                    className="ux-press absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow"
                    style={{ color: v("--ux-danger-ink") }}>
              <Icons.X className="h-4 w-4" />
            </button>
            {i > 0 && (
              <button type="button" onClick={() => onChange([src, ...value.filter((x) => x !== src)])} aria-label={`Make photo ${i + 1} the cover`}
                      className="ux-press absolute bottom-1.5 start-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold shadow"
                      style={{ color: v("--ux-ink") }}>
                Make cover
              </button>
            )}
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy > 0}
                  className="ux-press grid aspect-square place-items-center rounded-[14px] border-2 border-dashed text-center"
                  style={{ borderColor: v("--ux-brand"), background: v("--ux-brand-tint"), color: v("--ux-brand") }}
                  aria-label={label}>
            <span className="flex flex-col items-center gap-1 px-2 text-2xs font-bold">
              {busy ? <Icons.Loader2 className="h-6 w-6 animate-spin" /> : <Icons.Camera className="h-7 w-7" />}
              {busy ? `${busy}%` : label}
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple className="hidden"
             onChange={(e) => void add(e.target.files)} />
      {hint && <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>{hint}</p>}
      {error && <p role="alert" className="mt-1.5 text-xs" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
    </div>
  );
}

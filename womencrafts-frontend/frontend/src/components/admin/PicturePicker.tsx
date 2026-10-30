"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, Images, Loader2, RotateCcw, Search, UploadCloud, Wand2 } from "lucide-react";

import { ART_LIBRARY } from "@/components/ux/media/art";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";

/**
 * The picture of a category, sub-category or list item — for staff.
 *
 * Three ways to set it: upload a photo, choose one from the app's own library,
 * or leave it on "Automatic", where members' screens pick the library picture
 * the name points to. `auto` is that automatic picture, so staff always see
 * exactly what members will see before they change anything.
 *
 * `value` is what is stored: an upload's URL, a library path (`/ux/art/…`),
 * or "" for automatic.
 */
export function PicturePicker({ value, onChange, auto, label = "Picture", hint }: {
  value: string;
  onChange: (src: string) => void;
  auto: string;
  label?: string;
  hint?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  const shown = value || auto;
  const isAuto = !value;
  const fromLibrary = value.startsWith("/ux/");
  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ART_LIBRARY.filter((a) => a.name.includes(q)) : ART_LIBRARY;
  }, [query]);

  const upload = async (file?: File | null) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) { setError(problem); return; }
    setError(""); setBusy(1);
    try {
      const saved = await apiUploadImage(file, "cover", (p) => setBusy(Math.max(1, p)));
      onChange(saved.url);
      setLibrary(false);
    } catch (e) {
      setError(uploadErrorMessage(e));
    } finally {
      setBusy(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <p className="font-display text-sm font-semibold text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-surface-hover sm:w-[168px]">
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            {isAuto ? <><Wand2 className="h-3 w-3" /> Automatic</> : fromLibrary ? <><Images className="h-3 w-3" /> Library</> : <><UploadCloud className="h-3 w-3" /> Uploaded</>}
          </span>
          {busy > 0 && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/70 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-2xs font-semibold">{busy}%</span>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">
            {isAuto
              ? "Picked from the name. Members see this until you upload or choose one."
              : "Members see this picture wherever it appears."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label htmlFor={inputId} className="btn btn-outline btn-sm cursor-pointer">
              <UploadCloud className="h-3.5 w-3.5" /> Upload
            </label>
            <input id={inputId} ref={inputRef} type="file" accept="image/*" className="hidden"
                   onChange={(e) => void upload(e.target.files?.[0])} />
            <button type="button" className={`btn btn-sm ${library ? "btn-primary" : "btn-outline"}`}
                    aria-expanded={library} onClick={() => setLibrary((v) => !v)}>
              <Images className="h-3.5 w-3.5" /> Choose from library
            </button>
            {!isAuto && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
                <RotateCcw className="h-3.5 w-3.5" /> Use automatic
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-medium text-status-danger-ink">{error}</p>}
        </div>
      </div>
      {library && (
        <div className="mt-3 rounded-xl border border-line p-2.5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pictures — sewing, kitchen, farm…"
                   aria-label="Search pictures"
                   className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink outline-none focus:border-brand-500" />
          </label>
          <div className="mt-2 grid max-h-[260px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4" role="radiogroup" aria-label="Library pictures">
            {pool.map((a) => {
              const on = value === a.src;
              return (
                <button key={a.src} type="button" role="radio" aria-checked={on} title={a.name}
                        onClick={() => { onChange(a.src); setLibrary(false); }}
                        className={`group relative aspect-[4/3] overflow-hidden rounded-lg ring-offset-2 ring-offset-surface ${on ? "ring-2 ring-brand-500" : "hover:ring-2 hover:ring-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt={a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-ink/80 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] font-semibold capitalize text-white">
                    {a.name}
                  </span>
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
            {!pool.length && <p className="col-span-full py-6 text-center text-xs text-ink-subtle">No pictures match “{query}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** A small square of the picture, for list rows. */
export function PictureThumb({ src, size = "md", dim }: { src: string; size?: "md" | "sm"; dim?: boolean }) {
  const box = size === "md" ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" decoding="async"
         className={`${box} shrink-0 object-cover ${dim ? "opacity-50 grayscale" : ""}`} />
  );
}

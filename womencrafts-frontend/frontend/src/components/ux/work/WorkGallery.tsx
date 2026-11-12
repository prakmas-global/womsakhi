"use client";

import { useConfirm } from "@/design-system/feedback/ConfirmProvider";

import { useCallback, useRef, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, Sheet, v } from "@/components/ux/kit";
import { Label, Picks, Toggle } from "@/components/ux/kit/form";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import {
  PORTFOLIO_MAX, apiAddPortfolio, apiDeletePortfolio, apiEditPortfolio, apiMemberPortfolio, type PortfolioItem,
} from "@/lib/portfolio-api";
import { ACCEPTED_IMAGE_TYPES, apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";
import { useResource } from "@/lib/use-resource";
import type { ProfileSkill } from "@/lib/work-api";

/**
 * The work she has done, as photographs — one gallery for her profile's
 * "What you made" tab and for My work profile (backend: routes/portfolio.py).
 *
 * The pieces she switches to shown also ride on her card in "Find people to
 * hire" (routes/work_talent.py), the matching kind of work first. A photo of
 * a blouse she stitched says more to someone hiring a tailor than anything
 * she could type, so adding one is a photo and three taps: what it is (her
 * own skills offered as names), who it was for, and when.
 */

const MADE_FOR = ["A wedding", "A shop order", "A school", "A neighbour", "My own shop", "A festival"];

export function AddPiece({ skills = [], onAdded, onCancel }: {
  /** Her skills — their names are offered as titles, and a picked one files the piece under its kind of work. */
  skills?: Pick<ProfileSkill, "name" | "category">[];
  onAdded: () => void;
  onCancel: () => void;
}) {
  const now = new Date().getFullYear();
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [madeFor, setMadeFor] = useState("");
  const [year, setYear] = useState<number | null>(now);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const suggestions = skills.slice(0, 6).map((s) => s.name);

  const pick = async (file?: File) => {
    if (!file) return;
    const bad = validateImage(file);
    if (bad) { setError(bad); return; }
    setError(""); setUploading(true);
    try { setPhoto((await apiUploadImage(file)).url); }
    catch (e) { setError(uploadErrorMessage(e)); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      const category = skills.find((s) => s.name === title.trim())?.category ?? "";
      await apiAddPortfolio({ title: title.trim(), photo, category, made_for: madeFor.trim(), year, visible });
      toast("Added to your work", { tone: "success" });
      onAdded();
    } catch (e) {
      setError(apiErrorMessage(e, "That did not save. Try again in a moment."));
    } finally { setBusy(false); }
  };

  return (
    <Card pad={18}>
      <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <button type="button" onClick={() => input.current?.click()}
                className="ux-press grid aspect-square w-full place-items-center overflow-hidden rounded-[16px] border-2 border-dashed"
                style={{ borderColor: v(photo ? "--ux-line" : "--ux-brand"), background: v(photo ? "--ux-surface-2" : "--ux-brand-tint") }}
                aria-label={photo ? "Change the photo" : "Add a photo"}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid justify-items-center gap-2 px-3 text-center text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
              <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: v("--ux-surface"), color: v("--ux-brand") }}>
                {uploading ? <Icons.Loader2 className="h-6 w-6 animate-spin" /> : <Icons.Camera className="h-6 w-6" />}
              </span>
              {uploading ? "Uploading…" : "Take or add a photo"}
              <span className="font-normal" style={{ color: v("--ux-muted") }}>In daylight, near a window</span>
            </span>
          )}
        </button>
        <input ref={input} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden"
               onChange={(e) => void pick(e.target.files?.[0])} />

        <div className="flex flex-col gap-3">
          <div>
            <Label need>What is it?</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="What is it"
                   placeholder="Bridal blouse with mirror work"
                   className="ux-sq min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
            <Picks options={suggestions} value={title} onPick={setTitle} label="Quick names" />
          </div>
          <div>
            <Label hint="optional">Who was it for?</Label>
            <Picks options={MADE_FOR} value={madeFor} onPick={(x) => setMadeFor(madeFor === x ? "" : x)} label="Made for" />
          </div>
          <div>
            <Label>When?</Label>
            <Picks options={[String(now), String(now - 1), String(now - 2), "Earlier"]} label="Year"
                   value={year ? String(year) : "Earlier"} onPick={(x) => setYear(x === "Earlier" ? null : Number(x))} />
          </div>
          <Toggle on={visible} onChange={setVisible} label="Show it to people hiring and on my profile"
                  sub={visible ? "It appears on your card in Find people and on your profile." : "Only you can see it."} />
          {error && <p role="alert" className="text-xs" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" icon="Check" loading={busy} disabled={!photo || title.trim().length < 2 || uploading}
                 onClick={() => void save()}>Add it</Btn>
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Her pieces, to manage: add, show or hide, remove. */
export function WorkGallery({ items, loading, onChanged, skills, title = "Work you have done", sub }: {
  items: PortfolioItem[];
  loading?: boolean;
  onChanged: () => void;
  skills?: Pick<ProfileSkill, "name" | "category">[];
  title?: string;
  sub?: string;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const full = items.length >= PORTFOLIO_MAX;
  const shown = items.filter((p) => p.visible).length;

  const act = async (id: string, run: () => Promise<unknown>, msg: string) => {
    setBusy(id);
    try { await run(); onChanged(); toast(msg, { tone: "success" }); }
    catch (e) { toast(apiErrorMessage(e, "That did not work. Try again."), { tone: "error" }); }
    finally { setBusy(""); }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold" style={{ color: v("--ux-ink") }}>{title}</h2>
          <p className="text-xs" style={{ color: v("--ux-muted") }}>
            {sub ?? (items.length
              ? `${shown} of ${items.length} shown to people hiring · up to ${PORTFOLIO_MAX}`
              : "Photos of what you made. The first thing someone hiring looks at.")}
          </p>
        </div>
        {!adding && items.length > 0 && (
          <Btn size="sm" icon="Camera" disabled={full} onClick={() => setAdding(true)}>Add a piece</Btn>
        )}
      </div>

      {adding && <AddPiece skills={skills} onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); onChanged(); }} />}

      {loading && !items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <span key={i} className="ux-skeleton aspect-square rounded-[16px]" />)}
        </div>
      ) : items.length === 0 && !adding ? (
        <button type="button" onClick={() => setAdding(true)}
                className="ux-press flex flex-col items-center gap-2 rounded-[18px] border-2 border-dashed px-5 py-8 text-center"
                style={{ borderColor: v("--ux-brand"), background: v("--ux-brand-tint") }}>
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: v("--ux-surface"), color: v("--ux-brand") }}>
            <Icons.Camera className="h-7 w-7" />
          </span>
          <span className="text-sm font-bold" style={{ color: v("--ux-ink") }}>Add your first piece of work</span>
          <span className="max-w-[340px] text-xs" style={{ color: v("--ux-muted") }}>
            Photograph the next thing you finish — in daylight, near a window. People hiring believe a photo.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((p, i) => (
            <figure key={p.id}
                    className={`ux-rise group relative m-0 overflow-hidden rounded-[16px] ${i === 0 && items.length >= 3 ? "col-span-2 row-span-2" : ""}`}
                    style={{ ["--i" as string]: Math.min(i, 8), background: v("--ux-surface-2"), boxShadow: "var(--ux-shadow-card)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo} alt={p.title} loading="lazy" decoding="async"
                   className="aspect-square h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                   style={{ filter: p.visible ? "none" : "grayscale(.6) brightness(.8)" }} />
              <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 45%, rgba(16,6,24,.82))" }} />
              {!p.visible && (
                <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-bold text-white"
                      style={{ background: "rgba(24,10,34,.72)" }}>
                  <Icons.EyeOff className="h-[11px] w-[11px]" /> Only you
                </span>
              )}
              <span className="absolute end-2 top-2 flex gap-1">
                <button type="button" disabled={busy === p.id}
                        aria-label={p.visible ? `Hide ${p.title}` : `Show ${p.title}`} title={p.visible ? "Hide it" : "Show it"}
                        onClick={() => void act(p.id, () => apiEditPortfolio(p.id, { visible: !p.visible }),
                          p.visible ? "Now only you can see it" : "Now shown to people hiring")}
                        className="ux-press grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow"
                        style={{ color: v("--ux-ink") }}>
                  {p.visible ? <Icons.Eye className="h-4 w-4" /> : <Icons.EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" aria-label={`Remove ${p.title}`} title="Remove"
                        disabled={busy === p.id}
                        onClick={async () => { if (await confirm({ title: `Remove "${p.title}"?`, description: "This will remove it from your work gallery.", confirmLabel: "Remove", danger: true })) await act(p.id, () => apiDeletePortfolio(p.id), "Removed"); }}
                        className="ux-press grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow"
                        style={{ color: v("--ux-danger-ink") }}>
                  <Icons.Trash2 className="h-4 w-4" />
                </button>
              </span>
              <figcaption className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                <span className={`line-clamp-2 block font-bold leading-snug text-white ${i === 0 && items.length >= 3 ? "text-base" : "text-xs sm:text-xsm"}`}>
                  {p.title}
                </span>
                {(p.made_for || p.year) && (
                  <span className="mt-0.5 block truncate text-2xs text-white/80">{[p.made_for, p.year].filter(Boolean).join(" · ")}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/** Someone else's shown work, opened from her card — for the person hiring. */
export function WorkSheet({ userId, name, open, onClose }: {
  userId: string; name: string; open: boolean; onClose: () => void;
}) {
  const res = useResource(
    useCallback((s: AbortSignal) => (open ? apiMemberPortfolio(userId, s) : Promise.resolve(null)), [open, userId]),
    null as { first_name: string; items: PortfolioItem[] } | null,
  );
  const items = res.data?.items ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={`${name}'s work`} icon="Images" width={560}
           description="Photos of work she has finished, shared by her.">
      {res.source === "loading" ? (
        <div className="grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map((i) => <span key={i} className="ux-skeleton aspect-square rounded-[14px]" />)}</div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((p) => (
            <figure key={p.id} className="relative m-0 overflow-hidden rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo} alt={p.title} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover" />
              <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 50%, rgba(16,6,24,.8))" }} />
              <figcaption className="absolute inset-x-0 bottom-0 p-2.5">
                <span className="line-clamp-2 block text-xs font-bold text-white">{p.title}</span>
                {(p.made_for || p.year) && <span className="block truncate text-2xs text-white/80">{[p.made_for, p.year].filter(Boolean).join(" · ")}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyState icon="Images" title="Nothing shared yet" body="She has not shown any photos of her work yet. Ask her in your message." />
      )}
    </Sheet>
  );
}

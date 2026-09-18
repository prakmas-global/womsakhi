"use client";

import { memo, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import type { Listing, ShopOrder, ShopSummary } from "@/lib/shop-api";
import { validateImage } from "@/lib/uploads-api";
import { formatMoney } from "@/components/ux/kit/money";
import { useT } from "@/i18n";

/**
 * My Shop — the parts.
 *
 * ── The photo is the job ───────────────────────────────────────────────────
 * A listing with no photo sells a fraction of one that has it, and almost
 * every listing starts without one. So an empty photo is not a grey box to be
 * tolerated: it is the loudest thing on the card, it takes a drop or a tap,
 * and it says what it is worth.
 *
 * ── Every control on the card ──────────────────────────────────────────────
 * Stock, pause and share are here rather than behind an edit screen, because
 * the things she changes ten times a week should not cost a page load each.
 */

/**
 * One formatter, hoisted, in `kit/money`.
 *
 * This file carried its own copy, and the copy built a fresh
 * `Intl.NumberFormat` on every single call — constructing a locale formatter
 * per figure, on screens that print dozens of them. `kit/money` builds it once
 * at module scope. Byte-identical output; re-exported under the old name so
 * nothing has to change its imports.
 */
export const rupees = formatMoney;

const TONE: Record<string, [string, string]> = {
  violet: ["--ux-tint-violet", "--ux-violet-ink"],
  amber: ["--ux-tint-amber", "--ux-amber-ink"],
  green: ["--ux-tint-green", "--ux-green-ink"],
  blue: ["--ux-tint-blue", "--ux-blue-ink"],
  pink: ["--ux-tint-pink", "--ux-pink-ink"],
};
const TONES = Object.keys(TONE);
/** Stable per listing, so a card keeps its colour between visits. */
export const toneOf = (id: string) =>
  TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export const card = {
  background: "linear-gradient(168deg, var(--ux-surface-2), var(--ux-surface) 48%)",
  border: "1px solid var(--ux-line)",
  boxShadow: "var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)",
} as const;

export function Tile({ tone, size = 34, radius = 11, children }: {
  tone: string; size?: number; radius?: number; children: React.ReactNode;
}) {
  const [tint, ink] = TONE[tone] ?? TONE.violet;
  return (
    <span className="grid shrink-0 place-items-center" aria-hidden
          style={{ width: size, height: size, borderRadius: radius, color: `var(${ink})`,
                   background: `linear-gradient(150deg, var(${tint}), color-mix(in srgb, var(${tint}) 52%, var(--ux-surface)))`,
                   boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)" }}>
      {children}
    </span>
  );
}



export function Ico({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

/* ── an order, and its one next step ────────────────────────────────────── */

const STEPS = ["New", "Making", "Ready", "Sent", "Done"] as const;

/**
 * `onAdvance` takes the order rather than closing over it.
 *
 * It was `onAdvance={() => onAdvance(o)}` at the call site, which is a new
 * function on every render and would have made the memo below a pure cost —
 * it can never match. Handing the order back lets the parent pass one stable
 * callback to every row.
 */
export const OrderCard = memo(function OrderCard({ o, onAdvance, busy }: {
  o: ShopOrder; onAdvance: (o: ShopOrder) => void; busy: boolean;
}) {
  const tr = useT();
  const at = STEPS.indexOf(o.state as (typeof STEPS)[number]);
  const tone = toneOf(o.id);
  const [, ink] = TONE[tone];
  const cancelled = o.state === "Cancelled";
  return (
    <article data-order={o.id} data-state={o.state}
             className="ux-rise mb-3 rounded-[16px] p-4" style={card}>
      <div className="flex flex-wrap items-center gap-3">
        <Tile tone={tone} size={46} radius={14}>
          <Icons.Package className="h-[21px] w-[21px]" />
        </Tile>
        <div className="min-w-0 flex-1">
          <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{o.title}</b>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ux-faint)" }}>
            {o.buyer_name} · {o.placed_on}{o.quantity > 1 ? ` · ${o.quantity}` : ""}
          </p>
        </div>
        <b className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: `var(${ink})` }}>
          {o.total_label}
        </b>
        {o.next_state && (
          <button type="button" onClick={() => onAdvance(o)} disabled={busy}
                  className="ux-press flex min-h-[38px] shrink-0 items-center rounded-[12px] px-4 text-xs font-bold disabled:opacity-60 max-lg:min-h-[44px] max-lg:w-full max-lg:justify-center max-lg:text-[15px]"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                           color: "var(--ux-on-brand)" }}>
            {busy ? "…" : LABEL[o.state] ?? `Mark ${o.next_state.toLowerCase()}`}
          </button>
        )}
      </div>
      {!cancelled && at >= 0 && (
        <>
          <div className="mt-3 flex items-center">
            {STEPS.map((s, i) => (
              <span key={s} className="flex flex-1 items-center last:flex-none">
                {/* Decorative. The step's name is rendered in the row below, so
                    carrying it in here too — previously hidden with a 0px font
                    size — only made a screen reader announce every step twice. */}
                <b aria-hidden className="block h-[10px] w-[10px] shrink-0 rounded-full"
                   style={{ background: i < at ? "var(--ux-green-ink)"
                                      : i === at ? "var(--ux-amber-ink)" : "var(--ux-track)",
                            boxShadow: i === at ? "0 0 0 4px color-mix(in srgb, var(--ux-amber-ink) 26%, transparent)" : undefined }} />
                {i < STEPS.length - 1 && (
                  <i className="h-[3px] flex-1"
                     style={{ background: i < at ? "var(--ux-green-ink)" : "var(--ux-track)" }} />
                )}
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-2xs font-extrabold uppercase tracking-[0.05em]"
               style={{ color: "var(--ux-faint)" }}>
            {STEPS.map((s) => <span key={s}>{s}</span>)}
          </div>
        </>
      )}
      {cancelled && (
        <p className="mt-2.5 text-xs font-semibold" style={{ color: "var(--ux-faint)" }}>{tr("documents.cancelledNothingMoreToDo")}</p>
      )}
    </article>
  );
});

/** The server's own words for the next step, so the button never surprises her. */
const LABEL: Record<string, string> = {
  New: "Start making", Making: "Mark ready", Ready: "Mark sent", Sent: "Mark done",
};

/* ── a listing, with the photo treated as the job ───────────────────────── */

/** Same as `OrderCard`: the listing comes back out, so the parent's four
 *  handlers can be stable and the memo can actually hit. */
export const ListingCard = memo(function ListingCard({
  l, onPhoto, onStock, onPause, onShare, onDelete, busy,
}: {
  l: Listing;
  onPhoto: (l: Listing, file: File) => void;
  onStock: (l: Listing, next: number) => void;
  onPause: (l: Listing) => void;
  onShare: (l: Listing) => void;
  /** Asks for confirmation upstream — a listing carries photographs she took. */
  onDelete: () => void;
  busy: boolean;
}) {
  const tr = useT();
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const tone = toneOf(l.id);
  const paused = l.status === "paused";
  const isProduct = l.kind === "product";

  const take = (f: File | undefined) => {
    if (!f) return;
    const bad = validateImage(f);
    if (bad) { setError(bad); return; }
    setError(null);
    onPhoto(l, f);
  };

  return (
    <article className="ux-rise overflow-hidden rounded-[16px] transition-transform hover:-translate-y-[3px] lg:rounded-[20px]"
             style={card}>
      <div className="relative h-[150px] overflow-hidden" style={{ background: "var(--ux-surface-2)" }}>
        <span className="absolute start-2.5 top-2.5 z-[2] rounded-full px-2.5 py-1 text-2xs font-extrabold uppercase tracking-[0.05em] lg:rounded-[8px]"
              style={{ background: "var(--ux-surface)", color: `var(${TONE[tone][1]})`,
                       boxShadow: "var(--ux-shadow-card)" }}>
          {l.kind}
        </span>
        <span className="absolute end-2.5 top-2.5 z-[2] inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-extrabold uppercase tracking-[0.04em]"
              style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-card)",
                       color: paused ? "var(--ux-faint)" : "var(--ux-green-ink)" }}>
          <i className="h-[6px] w-[6px] rounded-full"
             style={{ background: paused ? "var(--ux-faint)" : "var(--ux-green-ink)" }} />
          {paused ? "Paused" : "Live"}
        </span>

        {l.photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={l.photo} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => file.current?.click()}
                    className="ux-press absolute bottom-2.5 start-2.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-2xs font-extrabold uppercase tracking-[0.04em] lg:rounded-[8px] lg:px-2.5"
                    style={{ background: "color-mix(in srgb, var(--ux-surface) 92%, transparent)",
                             color: "var(--ux-ink-2)", backdropFilter: "blur(6px)" }}>
              <Icons.Camera className="h-[12px] w-[12px]" /> Change
            </button>
          </>
        ) : (
          <button type="button" data-over={over}
                  onClick={() => file.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
                  className="ux-drop absolute inset-0 grid place-content-center justify-items-center gap-1.5 px-3 text-center"
                  style={{ color: "var(--ux-brand)" }}>
            {busy ? <Icons.Loader2 className="h-[26px] w-[26px] animate-spin" />
                  : <Icons.Camera className="h-[26px] w-[26px]" />}
            <b className="text-xsm font-extrabold">{busy ? "Adding…" : "Add a photo"}</b>
            <span className="text-2xs leading-snug" style={{ color: "var(--ux-faint)" }}>{tr("documents.takeOneOrChooseFromYour")}</span>
          </button>
        )}
        <input ref={file} type="file" accept="image/*" className="hidden"
               onChange={(e) => take(e.target.files?.[0])} />
      </div>

      <div className="p-4">
        <b className="block text-sm font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>
          {l.title}
        </b>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
            {l.price_label}
          </span>
          {l.rate && <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{l.rate}</span>}
        </div>

        {error && (
          <p className="mt-2.5 rounded-[12px] px-4 py-3 text-2xs font-semibold lg:p-2.5"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}
        {!l.photo && !error && (
          <p className="mt-2.5 flex items-start gap-2 rounded-[12px] px-4 py-3 text-2xs leading-relaxed lg:p-2.5"
             style={{ background: "var(--ux-tint-blue)", color: "var(--ux-ink-2)" }}>
            <Icons.Info className="mt-px h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-blue-ink)" }} />{tr("documents.aPhotoIsTheDifferenceBetween")}</p>
        )}

        {isProduct && l.stock !== null && (
          <div className="mt-3 flex w-fit items-center overflow-hidden rounded-[12px]"
               style={{ border: "1px solid var(--ux-line-strong)" }}>
            <button type="button" onClick={() => onStock(l, Math.max(0, (l.stock ?? 0) - 1))}
                    aria-label={tr("documents.oneFewerInStock")}
                    className="ux-press grid h-9 w-9 place-items-center text-base font-extrabold"
                    style={{ color: "var(--ux-ink-2)" }}>−</button>
            <span className="min-w-[58px] text-center text-xsm font-extrabold tabular-nums"
                  style={{ color: "var(--ux-ink)" }}>
              {l.stock}
              <small className="block text-2xs font-bold uppercase tracking-[0.04em]"
                     style={{ color: "var(--ux-faint)" }}>
                {l.stock === 0 ? tr("documents.soldOut")
              : tr("documents.inStock")}
              </small>
            </span>
            <button type="button" onClick={() => onStock(l, (l.stock ?? 0) + 1)}
                    aria-label={tr("documents.oneMoreInStock")}
                    className="ux-press grid h-9 w-9 place-items-center text-base font-extrabold"
                    style={{ color: "var(--ux-ink-2)" }}>+</button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/app/documents/${l.kind}/${l.id}`}
                className="ux-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold lg:rounded-[8px]"
                style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)",
                         color: "var(--ux-ink-2)" }}>
            <Icons.Pencil className="h-[13px] w-[13px]" /> Edit
          </Link>
          <button type="button" onClick={() => onPause(l)} disabled={busy}
                  className="ux-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold lg:rounded-[8px] disabled:opacity-60"
                  style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)",
                           color: "var(--ux-ink-2)" }}>
            {paused ? <><Icons.Play className="h-[13px] w-[13px]" />{tr("documents.putBack")}</>
                    : <><Icons.Pause className="h-[13px] w-[13px]" /> Pause</>}
          </button>
          <button type="button" onClick={() => onShare(l)}
                  className="ux-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold lg:rounded-[8px]"
                  style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)",
                           color: "var(--ux-ink-2)" }}>
            <Icons.Share2 className="h-[13px] w-[13px]" /> Share
          </button>
          {/* Quiet, and last. Removing a listing is rarely what she wants —
              pausing usually is — so it does not compete with the actions she
              reaches for daily. It asks before it does anything. */}
          <button type="button" onClick={onDelete} disabled={busy}
                  aria-label={`Remove ${l.title} from your shop`}
                  className="ux-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold lg:rounded-[8px]"
                  style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)",
                           color: "var(--ux-faint)", opacity: busy ? 0.5 : 1 }}>
            <Icons.Trash2 className="h-[13px] w-[13px]" /> Remove
          </button>
        </div>
      </div>
    </article>
  );
});

/* ── her shop as a buyer meets it ───────────────────────────────────────── */

export const Storefront = memo(function Storefront(
  { summary, listings }: { summary: ShopSummary | null; listings: Listing[] },
) {
  const tr = useT();
  const live = useMemo(() => listings.filter((l) => l.status !== "paused"), [listings]);
  return (
    <>
      <div className="rounded-[24px] p-2.5" style={{ background: "var(--ux-ink)",
                                                      boxShadow: "var(--ux-shadow-card)" }}>
        <div className="overflow-hidden rounded-[20px]" style={{ background: "var(--ux-surface)" }}>
          <div className="relative overflow-hidden p-4"
               style={{ background: "linear-gradient(112deg, var(--ux-brand-900), var(--ux-fill) 46%, var(--ux-rib-3))",
                        color: "var(--ux-on-brand)" }}>
            <span className="grid h-[50px] w-[50px] place-items-center rounded-[16px] text-lg font-extrabold"
                  style={{ background: "rgba(255,255,255,.2)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.3)" }}>
              {(summary?.name ?? "S").slice(0, 2).toUpperCase()}
            </span>
            <h2 className="mt-3 text-lg font-extrabold tracking-[-0.02em]">{summary?.name ?? "Your shop"}</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-on-brand-2)" }}>
              {summary?.handle ?? "womsakhi.in"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[["ShieldCheck", "Verified"],
                ["Star", summary?.rating ? summary.rating.toFixed(1) : "New"],
                ["Store", `${live.length} live`]].map(([icon, text]) => (
                <span key={text as string} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-extrabold uppercase tracking-[0.04em]"
                      style={{ background: "rgba(255,255,255,.2)" }}>
                  <Ico name={icon as string} className="h-[11px] w-[11px]" /> {text}
                </span>
              ))}
            </div>
          </div>
          {live.length === 0 ? (
            <p className="p-5 text-center text-xs" style={{ color: "var(--ux-muted)" }}>{tr("documents.nothingIsLiveBuyersSeeAn")}</p>
          ) : live.map((l) => (
            <div key={l.id} className="flex gap-3 p-3.5"
                 style={{ borderBottom: "1px solid var(--ux-line)" }}>
              {l.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy" decoding="async" src={l.photo} alt="" className="h-[54px] w-[54px] shrink-0 rounded-[12px] object-cover" />
              ) : (
                <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: "var(--ux-surface-2)", border: "1px dashed var(--ux-line-strong)",
                               color: "var(--ux-faint)" }}>
                  <Icons.Camera className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <b className="block text-xsm font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>
                  {l.title}
                </b>
                <p className="mt-1 text-sm font-extrabold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
                  {l.price_label}
                </p>
                <p className="mt-0.5 text-2xs" style={{ color: "var(--ux-faint)" }}>
                  {!l.photo ? "No photo yet"
                    : l.out_of_stock ? "Sold out"
                    : l.stock !== null ? `${l.stock} in stock` : "Comes to you"}
                </p>
              </div>
              <span className="ms-auto self-center shrink-0 rounded-[8px] px-3 py-2 text-2xs font-extrabold"
                    style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                             color: "var(--ux-on-brand)" }}>
                {l.kind === "service" ? "Book" : "Buy"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 px-1 text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>
        Your shop as a buyer meets it. A paused listing is missing from here, and one without a photo
        shows an empty square — exactly what she would see.
      </p>
    </>
  );
});

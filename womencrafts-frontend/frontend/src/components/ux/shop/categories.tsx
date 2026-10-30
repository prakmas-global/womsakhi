"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Sheet } from "@/components/ux/kit";
import { artFor, pictureFor } from "@/components/ux/media/art";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiDeleteListing, apiListings, apiUpdateListing, type Listing } from "@/lib/shop-api";
import {
  apiSetStoreCategory, apiShopCategories, type ListingKind, type MyShopCategories, type ShopCategory, type ShopSubcategory,
  type StoreCategoryResult,
} from "@/lib/shop-categories-api";
import { useResource } from "@/lib/use-resource";

/**
 * Shop categories on her side — the one category her shop sells in, and the
 * sub-categories her products and services are filed under.
 *
 * Staff control the list (dashboard → Market → Categories). Everything here
 * offers only what the server will accept: one category per shop, and within
 * it only the sub-categories that take this kind of listing.
 */

export function useShopCategories() {
  const res = useResource(
    useCallback((s?: AbortSignal) => apiShopCategories(s), []),
    null as MyShopCategories | null,
  );
  const data = res.data;
  const storeCat = useMemo(
    () => data?.categories.find((c) => c.key === data.store_category_key) ?? null, [data]);
  return { data, storeCat, loading: data === null && res.source === "loading", reload: res.refetch };
}

/* ── Pictures ──────────────────────────────────────────────────────────────
   Every category and sub-category has a picture: the one staff set (dashboard
   → Market → Categories), else its category's, else the library picture its
   name points to. One rule, so a kind of work looks the same wherever it
   appears — her shop settings, the listing form, the market's filters. */

const artKind = (kinds: ListingKind[]) => (kinds.includes("product") ? "product" : "service");

/** A category's picture. */
export const catPicture = (c: ShopSubcategory) => pictureFor(c, [c.name, c.description], null, artKind(c.kinds));

/** A sub-category's picture; its category's (set by staff) comes before the automatic one. */
export const subPicture = (s: ShopSubcategory, cat?: ShopSubcategory | null) =>
  pictureFor(s, [s.name, s.description, cat?.name], cat, artKind(s.kinds));

/**
 * A listing's picture: her own photo, else the picture staff set for its
 * sub-category or category, else one its own words point to.
 */
export function listingPicture(
  l: { id: string; title: string; kind: string; category?: string; photo?: string | null; photos?: string[];
       category_key?: string; subcategory_key?: string },
  categories?: ShopCategory[] | null,
) {
  const cat = categories?.find((c) => c.key === l.category_key)
    ?? categories?.find((c) => c.subcategories.some((x) => x.key === l.subcategory_key));
  const sub = cat?.subcategories.find((x) => x.key === l.subcategory_key);
  return artFor([l.title, sub?.name, cat?.name, l.category], l.kind === "service" ? "service" : "product",
                l.photo || l.photos?.[0] || sub?.image || cat?.image, l.id);
}

/** A small rounded picture for chips, rows and headers. */
export function CatThumb({ src, size = 22, radius }: { src: string; size?: number; radius?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" decoding="async" className="shrink-0 object-cover"
         style={{ width: size, height: size, borderRadius: radius ?? size / 2, background: "var(--ux-surface-2)" }} />
  );
}

export function CatIcon({ name, className = "h-5 w-5", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[name] ?? Icons.Store;
  return <I className={className} style={style} />;
}

/** Big, tappable category tiles: its picture, its name, a hint of what is inside. */
export function CategoryCards({ categories, value, onPick, busyKey }: {
  categories: ShopCategory[]; value: string; onPick: (c: ShopCategory) => void; busyKey?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]"
         role="radiogroup" aria-label="What your shop sells">
      {categories.map((c, i) => {
        const on = c.key === value;
        return (
          <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(c)}
                  disabled={busyKey === c.key} data-category-card={c.key}
                  className="ux-press ux-rise group relative flex flex-col overflow-hidden rounded-[16px] text-start disabled:opacity-60"
                  style={{ ["--i" as string]: Math.min(i, 8), background: "var(--ux-surface)",
                           boxShadow: on ? "0 0 0 3px var(--ux-brand)" : "0 0 0 1px var(--ux-line)" }}>
            <span className="relative block aspect-[4/3] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={catPicture(c)} alt="" loading="lazy" decoding="async"
                   className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
              <span aria-hidden className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 35%, rgba(16,6,24,.82))" }} />
              <span className="absolute inset-x-0 bottom-0 p-3 text-[15px] font-extrabold leading-tight text-white">{c.name}</span>
              {on && (
                <span className="ux-pop absolute end-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full"
                      style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>
                  <Icons.Check className="h-4 w-4" />
                </span>
              )}
            </span>
            <span className="block px-3 py-2.5">
              <span className="line-clamp-2 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                {c.subcategories.map((x) => x.name).slice(0, 4).join(" · ")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sub-category chips, each with its picture — the one tap that files a listing. */
export function SubChips({ subs, value, onPick, empty, parent }: {
  subs: ShopSubcategory[]; value: string; onPick: (s: ShopSubcategory) => void; empty?: string;
  /** Their category, whose picture a sub-category without one borrows. */
  parent?: ShopSubcategory | null;
}) {
  if (!subs.length) {
    return <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{empty ?? "Nothing in your shop's category takes this kind of listing."}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of listing">
      {subs.map((s) => <PictureChip key={s.key} src={subPicture(s, parent)} label={s.name} role="radio"
                                    selected={s.key === value} onClick={() => onPick(s)} />)}
    </div>
  );
}

/** A chip that leads with a small picture — the kit's `Chip`, with a photo for an icon. */
export function PictureChip({ src, label, selected, onClick, role }: {
  src: string; label: string; selected?: boolean; onClick?: () => void; role?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={role ? undefined : selected}
            role={role} aria-checked={role ? selected : undefined}
            className="ux-press ux-sq inline-flex min-h-[40px] items-center gap-2 rounded-full border py-1 pe-3.5 ps-1 text-xsm font-medium transition-colors"
            style={{
              borderColor: selected ? "var(--ux-brand)" : "var(--ux-line-strong)",
              background: selected ? "var(--ux-brand-tint)" : "var(--ux-surface)",
              color: selected ? "var(--ux-brand)" : "var(--ux-ink)",
              boxShadow: selected ? "inset 0 1px 3px rgb(var(--ux-shadow-ink) / 0.16)"
                                  : "inset 0 1px 0 var(--ux-edge-hi), 0 1px 2px var(--ux-sh-1)",
            }}>
      <CatThumb src={src} size={30} />
      {label}
      {selected && <Icons.Check className="ux-pop h-[13px] w-[13px]" strokeWidth={3} />}
    </button>
  );
}

/**
 * Choose (or change) her shop's category.
 *
 * The first choice saves straight away. A change that would take listings off
 * sale shows them first — by name — and says plainly that they are paused, not
 * deleted, and can be moved under the new category.
 */
export function StoreCategoryPicker({ data, onChanged }: {
  data: MyShopCategories;
  onChanged: (r: StoreCategoryResult) => void;
}) {
  const [asking, setAsking] = useState<{ cat: ShopCategory; outside: Listing[] } | null>(null);
  const [busy, setBusy] = useState("");

  const save = async (cat: ShopCategory) => {
    setBusy(cat.key);
    try {
      const r = await apiSetStoreCategory(cat.key);
      toast(r.paused ? `Your shop sells ${r.category_name}. ${r.paused} ${r.paused === 1 ? "listing" : "listings"} paused.`
                     : `Your shop sells ${r.category_name}.`, { tone: "success" });
      setAsking(null);
      onChanged(r);
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const pick = async (cat: ShopCategory) => {
    if (cat.key === data.store_category_key || busy) return;
    let outside: Listing[] = [];
    try {
      outside = (await apiListings()).filter((l) => l.status === "live" && (l.category_key || "") !== cat.key);
    } catch { /* the server pauses them anyway; the sheet just can't name them */ }
    if (!outside.length) { void save(cat); return; }
    setAsking({ cat, outside });
  };

  return (
    <>
      <CategoryCards categories={data.categories} value={data.store_category_key} onPick={(c) => void pick(c)} busyKey={busy} />
      {asking && (
        <Sheet open onClose={() => setAsking(null)} icon="Store" title={`Sell ${asking.cat.name}?`}
               description={`Your shop can sell in one category. ${asking.outside.length} of your listings don't fit ${asking.cat.name} and will be paused — not deleted. You can move each one into the new category.`}
               footer={
                 <div className="flex flex-wrap gap-2">
                   <Btn icon="Check" loading={busy === asking.cat.key} onClick={() => save(asking.cat)}>
                     {`Change and pause ${asking.outside.length}`}
                   </Btn>
                   <Btn variant="ghost" onClick={() => setAsking(null)}>Keep my category</Btn>
                 </div>
               }>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>These will be paused</p>
          <ul className="space-y-2" data-will-pause>
            {asking.outside.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-[12px] p-2.5" style={{ background: "var(--ux-surface-2)" }}>
                <Icons.PauseCircle className="h-4 w-4 shrink-0" style={{ color: "var(--ux-amber-ink)" }} />
                <span className="min-w-0 flex-1 truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{l.title}</span>
                <span className="shrink-0 text-xs" style={{ color: "var(--ux-muted)" }}>{l.category}</span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}

/** A plain prompt where she can't sell yet: no category chosen. */
export function ChooseCategoryPrompt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-[14px] ${compact ? "p-3" : "p-4"}`} data-choose-category
         style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
      <Icons.Store className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xsm font-extrabold">Choose what your shop sells</p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ux-ink-2)" }}>
          Pick one category, like tailoring or food. You can list products and services only in it.
        </p>
      </div>
      <Link href="/app/documents/store#category" className="ux-press shrink-0 rounded-full px-3 py-2 text-xs font-bold"
            style={{ background: "var(--ux-surface)", color: "var(--ux-brand)" }}>
        Choose
      </Link>
    </div>
  );
}

/**
 * The whole listing as PATCH wants it (it takes the full listing, not a
 * patch), with the filing changed. Computed fields stay behind.
 */
export function listingBody(l: Listing, change: Record<string, unknown> = {}): Record<string, unknown> {
  const {
    id: _id, price_label: _pl, low_stock: _ls, out_of_stock: _oos, views: _v, orders: _o, created_at: _c,
    paused_reason: _pr, category: _cat, ...rest
  } = l as Listing & Record<string, unknown>;
  void _id; void _pl; void _ls; void _oos; void _v; void _o; void _c; void _pr; void _cat;
  return { ...rest, ...change };
}

/**
 * Listings that no longer fit her shop's category — each with the one tap
 * that moves it inside and puts it back on sale, or a delete.
 */
export function OutsideCategoryPanel({ listings, storeCat, onChanged }: {
  listings: Listing[];
  storeCat: ShopCategory | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const outside = listings.filter((l) => l.status === "paused" &&
    (l.paused_reason === "category_changed" || (storeCat && (l.category_key || "") !== storeCat.key)));
  if (!outside.length) return null;

  const move = async (l: Listing, sub: ShopSubcategory) => {
    if (!storeCat) return;
    setBusy(l.id);
    setErrors((e) => ({ ...e, [l.id]: "" }));
    try {
      await apiUpdateListing(l.id, listingBody(l, { category_key: storeCat.key, subcategory_key: sub.key, status: "live" }));
      toast(`“${l.title}” is back on sale under ${sub.name}`, { tone: "success" });
      onChanged();
    } catch (e) {
      setErrors((x) => ({ ...x, [l.id]: apiErrorMessage(e) }));
    } finally {
      setBusy("");
    }
  };

  const remove = async (l: Listing) => {
    setBusy(l.id);
    try {
      await apiDeleteListing(l.id);
      toast(`“${l.title}” deleted`, { tone: "success" });
      onChanged();
    } catch (e) {
      setErrors((x) => ({ ...x, [l.id]: apiErrorMessage(e) }));
    } finally {
      setBusy(""); setConfirmDelete("");
    }
  };

  return (
    <section className="ux-card mb-5 p-4 lg:p-5" data-outside-panel aria-label="Listings that don't fit your shop's category">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
          <Icons.PauseCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>
            Paused — {outside.length === 1 ? "doesn't" : "don't"} fit your shop&rsquo;s category
          </h2>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
            {storeCat
              ? `Your shop sells ${storeCat.name}. Pick where each one belongs and it goes back on sale.`
              : "Choose what your shop sells first, then move these into it."}
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {outside.map((l) => {
          const kind = l.kind === "service" ? "service" : "product";
          const subs = (storeCat?.subcategories ?? []).filter((s) => s.kinds.includes(kind));
          return (
            <li key={l.id} className="rounded-[14px] border p-3" style={{ borderColor: "var(--ux-line)" }} data-outside-row={l.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{l.title}</span>
                <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>was {l.category || "uncategorised"} · {kind}</span>
              </div>
              {storeCat ? (
                <SubChips subs={subs} value="" onPick={(s) => void move(l, s)} parent={storeCat}
                          empty={`Nothing in ${storeCat.name} takes a ${kind}. Delete it, or change your shop's category.`} />
              ) : <ChooseCategoryPrompt compact />}
              {errors[l.id] && <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{errors[l.id]}</p>}
              <div className="mt-2 flex items-center gap-2">
                {busy === l.id && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>Saving…</span>}
                {confirmDelete === l.id ? (
                  <>
                    <span className="text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>Delete for good?</span>
                    <Btn size="sm" variant="outline" onClick={() => remove(l)}>Yes, delete</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete("")}>No</Btn>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(l.id)} className="ux-press text-xs font-bold underline"
                          style={{ color: "var(--ux-muted)" }}>Delete instead</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

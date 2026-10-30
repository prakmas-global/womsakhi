"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { useResource } from "@/lib/use-resource";
import { apiMyStore, type StoreSettings } from "@/lib/shop-api";
import { AvailabilitySwitch } from "./Availability";
import { CatThumb, ChooseCategoryPrompt, catPicture } from "./categories";
import type { ShopCategory } from "@/lib/shop-categories-api";

/**
 * The top of My shop: her store as buyers see it — cover, logo, name — with
 * the open/closed switch right there, and the way into Store settings.
 */
export function StoreBar({ categories }: {
  /** The shop category tree: her category's picture stands in for a cover she has not added. */
  categories?: ShopCategory[] | null;
} = {}) {
  const { data } = useResource(useCallback((s?: AbortSignal) => apiMyStore(s), []), null as StoreSettings | null);
  // The switch hands back the store as the server now has it; that wins.
  const [changed, setChanged] = useState<StoreSettings | null>(null);
  const store = changed ?? data;
  if (!store) return null;
  const cat = categories?.find((c) => c.key === store.category_key) ?? null;
  return (
    <section className="ux-card mb-5 overflow-hidden" style={{ padding: 0 }} aria-label="My store">
      <StoreCover store={store} height={96} fallback={cat ? catPicture(cat) : ""} />
      <div className="px-4 pb-4 lg:px-5">
        {/* Only the logo rides up over the cover; the name sits below it.
            `relative z-[1]`: the cover is positioned, and a positioned box
            paints over a later one that is not — the logo was being drawn
            UNDER the photo, with only its bottom edge showing. */}
        <div className="flex items-start gap-3">
          <div className="relative z-[1] -mt-9"><StoreLogo store={store} size={72} /></div>
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="truncate text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{store.display_name}</h2>
            <p className="truncate text-xs" style={{ color: store.tagline ? "var(--ux-muted)" : "var(--ux-faint)" }}>
              {store.tagline || "Add a line about your shop"}
            </p>
            {store.category_name && (
              <Link href="/app/documents/store#category" data-store-category
                    className="ux-press mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-bold"
                    style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                {cat ? <CatThumb src={catPicture(cat)} size={16} /> : <Icons.Tag className="h-3 w-3 shrink-0" />}
                <span className="truncate">Sells {store.category_name}</span>
              </Link>
            )}
          </div>
          <Link href="/app/documents/store" data-store-settings
                className="ux-press mt-2 inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
            <Icons.Settings className="h-4 w-4" /> <span className="max-sm:hidden">Store settings</span>
          </Link>
        </div>
        {/* No category: nothing can be listed until she picks one. */}
        {!store.category_key && <div className="mt-3.5"><ChooseCategoryPrompt compact /></div>}
        {(store.paused_outside ?? 0) > 0 && (
          <Link href="/app/documents/listings?show=paused" data-paused-outside
                className="ux-press mt-3 flex items-center gap-2 rounded-[12px] p-2.5 text-xs font-semibold"
                style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
            <Icons.PauseCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{store.paused_outside} paused {store.paused_outside === 1 ? "listing doesn't" : "listings don't"} fit your shop&rsquo;s category</span>
            <Icons.ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
        <div className="mt-3.5">
          <AvailabilitySwitch store={store} onChange={setChanged} compact />
        </div>
      </div>
    </section>
  );
}

/**
 * Her cover photo. Without one, her category's picture under the brand
 * colours (`fallback`), so a new shop already says what it sells; with
 * neither, the brand gradient alone.
 */
export function StoreCover({ store, height, fallback = "" }: {
  store: Pick<StoreSettings, "cover">; height: number; fallback?: string;
}) {
  const brand = "linear-gradient(120deg, var(--ux-brand) 0%, var(--ux-violet, #7440a6) 100%)";
  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: store.cover ? "var(--ux-surface-2)" : brand }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {store.cover && <img src={store.cover} alt="" className="h-full w-full object-cover" />}
      {!store.cover && fallback && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fallback} alt="" data-cover-fallback className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0" style={{ background: brand, opacity: 0.55 }} />
        </>
      )}
    </div>
  );
}

export function StoreLogo({ store, size }: { store: Pick<StoreSettings, "logo" | "display_name">; size: number }) {
  const letters = store.display_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-[18px] text-xl font-extrabold"
          style={{ width: size, height: size, background: "var(--ux-brand-tint)", color: "var(--ux-brand)",
                   border: "3px solid var(--ux-surface)", boxShadow: "var(--ux-shadow-card)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {store.logo ? <img src={store.logo} alt="" className="h-full w-full object-cover" /> : letters}
    </span>
  );
}

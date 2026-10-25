"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { useResource } from "@/lib/use-resource";
import { apiMyStore, type StoreSettings } from "@/lib/shop-api";
import { AvailabilitySwitch } from "./Availability";

/**
 * The top of My shop: her store as buyers see it — cover, logo, name — with
 * the open/closed switch right there, and the way into Store settings.
 */
export function StoreBar() {
  const { data } = useResource(useCallback((s?: AbortSignal) => apiMyStore(s), []), null as StoreSettings | null);
  // The switch hands back the store as the server now has it; that wins.
  const [changed, setChanged] = useState<StoreSettings | null>(null);
  const store = changed ?? data;
  if (!store) return null;
  return (
    <section className="ux-card mb-5 overflow-hidden" style={{ padding: 0 }} aria-label="My store">
      <StoreCover store={store} height={96} />
      <div className="px-4 pb-4 lg:px-5">
        {/* Only the logo rides up over the cover; the name sits below it. */}
        <div className="flex items-start gap-3">
          <div className="-mt-9"><StoreLogo store={store} size={72} /></div>
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="truncate text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{store.display_name}</h2>
            <p className="truncate text-xs" style={{ color: store.tagline ? "var(--ux-muted)" : "var(--ux-faint)" }}>
              {store.tagline || "Add a line about your shop"}
            </p>
          </div>
          <Link href="/app/documents/store" data-store-settings
                className="ux-press mt-2 inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold"
                style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
            <Icons.Settings className="h-4 w-4" /> <span className="max-sm:hidden">Store settings</span>
          </Link>
        </div>
        <div className="mt-3.5">
          <AvailabilitySwitch store={store} onChange={setChanged} compact />
        </div>
      </div>
    </section>
  );
}

export function StoreCover({ store, height }: { store: Pick<StoreSettings, "cover">; height: number }) {
  return (
    <div className="w-full overflow-hidden" style={{
      height,
      background: store.cover ? "var(--ux-surface-2)" : "linear-gradient(120deg, var(--ux-brand) 0%, var(--ux-violet, #7440a6) 100%)",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {store.cover && <img src={store.cover} alt="" className="h-full w-full object-cover" />}
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

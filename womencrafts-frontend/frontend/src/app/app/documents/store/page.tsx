"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { toast } from "@/components/ux/mobile/Toast";
import { AvailabilitySwitch } from "@/components/ux/shop/Availability";
import { StoreCover, StoreLogo } from "@/components/ux/shop/StoreBar";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import { apiMyStore, apiUpdateStore, type StoreSettings } from "@/lib/shop-api";
import { apiUploadImage, validateImage } from "@/lib/uploads-api";
import { useResource } from "@/lib/use-resource";

/**
 * Store settings — her shop's name, its two pictures, and opening hours in the
 * only sense that matters here: open, or away.
 *
 * Names and lines are offered as taps, built from her own first name, so most
 * women never type; the box is there for the ones who want their own words.
 * Pictures save the moment they upload. A preview shows the shop the way a
 * buyer opening her link sees it.
 */

const LINES = [
  "Handmade with love",
  "Made to order, delivered on time",
  "Home-cooked, fresh every day",
  "Stitching and alterations",
  "Gifts for every occasion",
  "Fresh from my kitchen",
];

export default function StoreSettingsPage() {
  const { user } = useAuth();
  const { data } = useResource(useCallback((s?: AbortSignal) => apiMyStore(s), []), null as StoreSettings | null);
  const [changed, setChanged] = useState<StoreSettings | null>(null);
  const store = changed ?? data;
  const [draft, setDraft] = useState<{ name?: string; tagline?: string }>({});
  const [busy, setBusy] = useState<"" | "save" | "logo" | "cover">("");

  const first = (user?.full_name || "").split(" ")[0] || "My";
  const names = [`${first}'s Creations`, `${first}'s Kitchen`, `${first} Stitches`, `${first}'s Handmade`, `${first} Crafts`, `Sakhi by ${first}`];

  const name = draft.name ?? store?.name ?? "";
  const tagline = draft.tagline ?? store?.tagline ?? "";
  const dirty = !!store && (name !== store.name || tagline !== store.tagline);
  const preview: StoreSettings | null = store
    ? { ...store, name, tagline, display_name: name.trim() || store.display_name }
    : null;

  const save = async () => {
    setBusy("save");
    try {
      setChanged(await apiUpdateStore({ name, tagline }));
      setDraft({});
      toast("Store saved", { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const upload = async (which: "logo" | "cover", file: File | undefined) => {
    if (!file) return;
    const bad = validateImage(file);
    if (bad) { toast(bad, { tone: "error" }); return; }
    setBusy(which);
    try {
      const up = await apiUploadImage(file, which === "logo" ? "avatar" : "cover");
      setChanged(await apiUpdateStore({ [which]: up.url }));
      toast(which === "logo" ? "Logo updated" : "Cover picture updated", { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const remove = async (which: "logo" | "cover") => {
    setBusy(which);
    try { setChanged(await apiUpdateStore({ [which]: "" })); } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
    finally { setBusy(""); }
  };

  return (
    <HomeShell columns active="/app/documents/store" loadFailed="your store">
      <header className="mb-5">
        <h1 className="ux-screen-title text-2xl font-extrabold" style={{ color: "var(--ux-ink)" }}>Store settings</h1>
        <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>Your shop&rsquo;s name and pictures, and whether you are taking orders.</p>
      </header>

      {!store || !preview ? (
        <Card><p className="text-xsm" style={{ color: "var(--ux-muted)" }}>Loading your store…</p></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <h2 className="mb-1 text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Taking orders</h2>
              <p className="mb-3 text-xs" style={{ color: "var(--ux-muted)" }}>
                Away, unwell, or too busy? Close your shop and buyers cannot order until you are back.
              </p>
              <AvailabilitySwitch store={store} onChange={setChanged} />
            </Card>

            <Card>
              <h2 className="mb-1 text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Shop name</h2>
              <p className="mb-3 text-xs" style={{ color: "var(--ux-muted)" }}>Tap one, or write your own.</p>
              <Text label="Shop name" value={name} max={40} placeholder={store.display_name}
                    onChange={(s) => setDraft((d) => ({ ...d, name: s }))} />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {names.map((n) => (
                  <Chip key={n} on={name === n} onClick={() => setDraft((d) => ({ ...d, name: n }))}>{n}</Chip>
                ))}
              </div>

              <h2 className="mb-1 mt-6 text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>A line about your shop</h2>
              <p className="mb-3 text-xs" style={{ color: "var(--ux-muted)" }}>Shown under the name.</p>
              <Text label="A line about your shop" value={tagline} max={90} placeholder="Handmade with love"
                    onChange={(s) => setDraft((d) => ({ ...d, tagline: s }))} />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {LINES.map((l) => (
                  <Chip key={l} on={tagline === l} onClick={() => setDraft((d) => ({ ...d, tagline: l }))}>{l}</Chip>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Btn icon="Check" disabled={!dirty} loading={busy === "save"} onClick={save}>Save</Btn>
                {dirty && <Btn variant="ghost" onClick={() => setDraft({})}>Undo</Btn>}
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Pictures</h2>
              <p className="mb-4 text-xs" style={{ color: "var(--ux-muted)" }}>A clear logo and a cover photo of your work make your shop look trusted.</p>
              <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <PicturePick label="Logo" hint="Square works best" busy={busy === "logo"} has={!!store.logo}
                             onPick={(f) => upload("logo", f)} onRemove={() => remove("logo")}>
                  <StoreLogo store={preview} size={110} />
                </PicturePick>
                <PicturePick label="Cover photo" hint="Wide — your work, your stall, your kitchen" busy={busy === "cover"} has={!!store.cover}
                             onPick={(f) => upload("cover", f)} onRemove={() => remove("cover")}>
                  <div className="overflow-hidden rounded-[14px]"><StoreCover store={store} height={110} /></div>
                </PicturePick>
              </div>
            </Card>
          </div>

          <aside className="min-w-0">
            <div className="lg:sticky lg:top-[calc(var(--ux-topbar-h,72px)+18px)]">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>
                <Icons.Eye className="h-3.5 w-3.5" /> What buyers see
              </p>
              <div className="ux-card overflow-hidden" style={{ padding: 0 }} data-store-preview>
                <StoreCover store={preview} height={110} />
                <div className="px-4 pb-4">
                  <div className="-mt-10"><StoreLogo store={preview} size={76} /></div>
                  <h3 className="mt-2 text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{preview.display_name}</h3>
                  {preview.tagline && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{preview.tagline}</p>}
                  {!preview.open && (
                    <p className="mt-3 flex items-start gap-2 rounded-[12px] p-2.5 text-xs font-semibold"
                       style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
                      <Icons.Moon className="mt-px h-3.5 w-3.5 shrink-0" />
                      Not taking orders right now{preview.away_reason ? ` (${preview.away_reason.toLowerCase()})` : ""}.
                    </p>
                  )}
                  <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>
                    {store.live_listings} {store.live_listings === 1 ? "thing" : "things"} for sale
                  </p>
                </div>
              </div>
              {store.handle && (
                <Link href={`/s/${store.handle}`} target="_blank"
                      className="ux-press mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                  <Icons.ExternalLink className="h-3.5 w-3.5" /> Open my shop page
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </HomeShell>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
            className="ux-press min-h-[38px] rounded-full px-3.5 text-xsm font-semibold"
            style={{ background: on ? "var(--ux-brand)" : "var(--ux-surface-2)", color: on ? "var(--ux-ink-on-brand)" : "var(--ux-ink-2)" }}>
      {children}
    </button>
  );
}

function PicturePick({ label, hint, busy, has, onPick, onRemove, children }: {
  label: string; hint: string; busy: boolean; has: boolean;
  onPick: (f: File | undefined) => void; onRemove: () => void; children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>{label}</p>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={`Change ${label.toLowerCase()}`}
              className="ux-press relative block w-full text-start disabled:opacity-60">
        {children}
        <span className="absolute bottom-2 end-2 grid h-9 w-9 place-items-center rounded-full"
              style={{ background: "var(--ux-surface)", color: "var(--ux-brand)", boxShadow: "var(--ux-shadow-card)" }}>
          {busy ? <Icons.Loader2 className="h-4 w-4 animate-spin" /> : <Icons.Camera className="h-4 w-4" />}
        </span>
      </button>
      <p className="mt-1.5 text-2xs" style={{ color: "var(--ux-muted)" }}>{hint}</p>
      {has && (
        <button type="button" onClick={onRemove} disabled={busy}
                className="mt-1 text-2xs font-bold underline" style={{ color: "var(--ux-danger-ink)" }}>
          Remove
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden"
             onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

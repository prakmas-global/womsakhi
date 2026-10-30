"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiListings, apiSaveListing, apiUpdateListing, type Listing } from "@/lib/shop-api";
import { apiUploadImage, uploadErrorMessage, validateImage, ACCEPTED_IMAGE_TYPES } from "@/lib/uploads-api";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import {Back, Btn, Card, EmptyState, IconTile, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { Field, TextInput, Toggle } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBusiness } from "@/components/ux/business";
import { rupees } from "@/components/ux/shop/data";
import { useT } from "@/i18n";
import { Picks, Select, Stepper } from "@/components/ux/kit/form";
import { ChooseCategoryPrompt, SubChips, useShopCategories } from "@/components/ux/shop/categories";
import { subsFor } from "@/lib/shop-categories-api";

const MAKE_TIMES = ["Ready now", "1 day", "2 days", "3 days", "1 week", "2 weeks"];
const ABOUT_PHRASES = [
  "Handmade", "Pure cotton", "Made to order", "Can be washed at home",
  "Any size on request", "Colours can be changed", "Ready to send",
];
const togglePhrase = (note: string, phrase: string) => {
  const parts = note.split(". ").map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
  return (parts.includes(phrase) ? parts.filter((x) => x !== phrase) : [...parts, phrase]).join(". ");
};

const BLANK = { id: "new", name: "", price_minor: 0, stock: 0, sold: 0,
  art: "/ux/art/course-photographing-handmade-product.webp", live: false };

/**
 * Adding or editing something she sells.
 *
 * The price is typed in RUPEES and stored in paise. She thinks in rupees; the
 * ledger has to be exact. Doing that conversion at the one place it is entered
 * is the difference between a shop whose totals add up and one that is a paisa
 * out in a hundred places.
 *
 * The preview beside the form is not decoration — it is the buyer's view, and
 * seeing it while typing is what stops a listing going out with no photo and a
 * three-word description.
 */
export default function ProductEditor({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: biz, source, refetch } = useBusiness();
  const PRODUCTS = biz.products;
  const existing = PRODUCTS.find((p) => p.id === id);
  const isNew = id === "new";
  const base = existing ?? (isNew ? BLANK : null);

  /** The form as it should read for a given listing. */
  const shapeOf = (b: typeof base) => ({
    name: b?.name ?? "",
    rupees: b && b.price_minor ? String(Math.round(b.price_minor / 100)) : "",
    stock: b ? String(b.stock) : "",
    // `existing`, not `base`: BLANK is truthy, so a NEW listing was arriving
    // pre-filled with another product's words. It was also a hardcoded
    // sentence about hand-stitching rather than anything she had written.
    about: existing?.about ?? "",
    made: "3 days",
    live: b?.live ?? false,
  });

  const [form, setForm] = useState(() => shapeOf(base));

  /**
   * Fill the form once her listing arrives.
   *
   * `useState(() => …)` runs on the first render only, and on that render the
   * listings are still on their way from the server — so the editor opened
   * completely blank on a product that had a name, a price and a description.
   * The ref makes this happen once per listing and never again, so it cannot
   * overwrite what she has typed.
   */
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!base || filledFor.current === id) return;
    filledFor.current = id;
    setForm(shapeOf(base));
    // `shapeOf` closes over `existing`, which changes with the same fetch that
    // produces `base`; listing it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, id]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  /**
   * Her photographs — up to four, the first is what buyers see.
   *
   * The four slots used to be buttons with no handler: a listing could not
   * get a photo once it existed. Now each empty slot uploads (the same uploads
   * API the add wizard uses), each photo can be made first or removed, and on
   * an existing listing every change is saved straight away (PATCH writes only
   * the fields sent — `photo` and `photos`).
   */
  const raw = useResource(
    useCallback(async (s: AbortSignal) => (await apiListings(s)).find((l) => l.id === id) ?? null, [id]),
    null as Listing | null,
  );
  // Filed under her shop's one category: which kind of product this is.
  // Tapped, not typed: the quick names are her category's own sub-categories.
  const cats = useShopCategories();
  const productSubs = useMemo(() => subsFor(cats.storeCat, "product"), [cats.storeCat]);
  const NAME_PICKS = productSubs.map((x) => x.name);
  const [subPick, setSubPick] = useState<string | null>(null);
  const sub = subPick ?? raw.data?.subcategory_key ?? "";
  const subOk = productSubs.some((x) => x.key === sub);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const current = photos ?? (raw.data ? (raw.data.photos?.length ? raw.data.photos : raw.data.photo ? [raw.data.photo] : []) : []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function storePhotos(next: string[]) {
    const prev = current;
    setPhotos(next);
    setPhotoProblem("");
    if (isNew) return; // saved with the listing
    try {
      // PATCH takes the whole listing's identity; kind and title ride along.
      await apiUpdateListing(id, { kind: "product", title: raw.data?.title || form.name.trim(), photo: next[0] ?? "", photos: next });
      refetch();
    } catch (e) {
      setPhotos(prev);
      setPhotoProblem(messageFrom(e, "That photo change did not save. Try again in a moment."));
    }
  }

  async function addPhotos(files: File[]) {
    const room = 4 - current.length;
    if (!files.length || room <= 0) return;
    const bad = files.map(validateImage).find(Boolean);
    if (bad) { setPhotoProblem(bad); return; }
    setPhotoBusy(true);
    setPhotoProblem("");
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, room)) urls.push((await apiUploadImage(f)).url);
      await storePhotos([...current, ...urls]);
    } catch (e) {
      setPhotoProblem(uploadErrorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  }


  const put = (k: keyof typeof form, value: string) => { setForm((f) => ({ ...f, [k]: value })); setSaved(false); };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => put(k, e.target.value);

  /** Rupees in, paise out — converted once, here. */
  const price_minor = useMemo(() => {
    const n = Number(form.rupees.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [form.rupees]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (form.name.trim().length < 3) m.push("a name");
    if (price_minor <= 0) m.push("a price");
    if (form.about.trim().length < 20) m.push("a description buyers can read");
    if (isNew && !subOk) m.push("what kind of product it is");
    return m;
  }, [form, price_minor, isNew, subOk]);

  /** Save the product. This used to set a flag and send nothing. */
  async function save() {
    setBusy(true);
    setProblem("");
    const body = {
      kind: "product" as const,
      title: form.name.trim(),
      desc: form.about.trim(),
      price_minor,
      stock: Number(form.stock) || 0,
      ...(isNew ? { photo: current[0] ?? "", photos: current } : {}),
      // Sent when she has chosen (or must choose): the server checks it sits in her shop's category.
      ...(subOk && (isNew || subPick !== null) ? { category_key: cats.storeCat?.key ?? "", subcategory_key: sub } : {}),
    };
    try {
      if (isNew) await apiSaveListing(body);
      else await apiUpdateListing(id, body);
      setSaved(true);
      refetch();
    } catch (e) {
      setProblem(messageFrom(e, "That did not save. Your product has not changed — try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way — saying it during the fetch makes the screen flash "that is not
  // here" before showing itself.
  if (!base && source === "loading") {
    return (
      <HomeShell skeleton="form" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="form" />
      </HomeShell>
    );
  }

  if (!base) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("documentsProduct.thatProductIsNotHere")}
            body={tr("documentsProduct.itMayHaveBeenRemovedFrom")}
            action={<Btn href="/app/documents" variant="primary" iconEnd="ArrowRight">{tr("documentsProduct.yourBusiness")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          {/* The buyer's view, live, while she types. */}
          <Card>
            <SectionHead title={tr("documentsProduct.whatABuyerSees")} sub={tr("documentsProduct.updatesAsYouType")} />
            <div className="ux-sq overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--ux-line)" }}>
              <div className="h-[132px] overflow-hidden" style={{ background: "var(--ux-tint-orange)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={current[0] || base.art} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-3.5">
                <p className="text-sm font-semibold" style={{ color: form.name ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {form.name || "Your product name"}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums"
                   style={{ color: price_minor ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {price_minor ? rupees(price_minor) : "₹—"}
                </p>
                <p className="mt-1.5 text-xs leading-snug"
                   style={{ color: form.about ? "var(--ux-muted)" : "var(--ux-faint)" }}>
                  {form.about || "Buyers read this before they decide. Say what it is made of and how it is made."}
                </p>
                <p className="mt-2.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                  {Number(form.stock) > 0 ? `${form.stock} ready now` : "Made to order"} · ready in {form.made}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("documentsProduct.beforeItGoesLive")} />
            {missing.length ? (
              <ul className="space-y-2.5">
                {missing.map((m) => (
                  <li key={m} className="flex items-center gap-2.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                    <Icons.Circle className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                    Still needs {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xsm" style={{ color: "var(--ux-green-ink)" }}>
                <Icons.CheckCheck className="h-[16px] w-[16px]" />{tr("documentsProduct.readyToPublish")}</p>
            )}
            {/* Say what is missing rather than greying a button with no reason. */}
            <div className="mt-4">
              <Btn variant="primary" full icon={busy ? "Loader" : "Check"}
                   disabled={busy || missing.length > 0}
                   onClick={() => void save()}>
                {isNew ? tr("documentsProduct.addToMyShop")
              : tr("documentsProduct.saveChanges")}
              </Btn>
            </div>
            {saved && !problem && (
              <p className="ux-slide-up mt-2.5 text-center text-xs" style={{ color: "var(--ux-green-ink)" }}>
                Saved.
              </p>
            )}
            {problem && (
              <p role="alert" className="ux-slide-up mt-2.5 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}
          </Card>

          {!isNew && (
            <Card>
              <SectionHead title={tr("documentsProduct.howItIsDoing")} />
              <div className="space-y-3.5">
                {[[`${base.sold}`, "Sold so far", "Package", "--ux-tint-green", "--ux-green"],
                  [rupees(base.sold * base.price_minor), "Brought in", "BadgeIndianRupee", "--ux-tint-violet", "--ux-violet"]]
                  .map(([v, label, icon, tint, ink]) => (
                  <div key={label} className="ux-hov flex items-center gap-3">
                    <IconTile icon={icon} tint={tint} ink={ink} size={38} />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                      <p className="mt-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Back to="/app/documents" label={tr("documentsProduct.yourShop")} className="mb-4" />

      <div className="flex min-w-0 items-center gap-3">
        <PlaceMark size={44} />
        <h1 className="text-2xl font-bold min-w-0" style={{ color: "var(--ux-ink)" }}>
          {isNew ? "Add something you sell" : form.name || "Edit product"}
        </h1>
      </div>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        {isNew ? tr("documentsProduct.fourThingsAndItIsListed")
              : tr("documentsProduct.changesReachBuyersStraightAway")}
      </p>

      <Card className="mb-[16px]">
        <SectionHead title="Photos" sub={tr("documentsProduct.theFirstOneIsWhatBuyers")} />
        <input ref={fileInput} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple hidden
               onChange={(e) => { void addPhotos(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => {
            const url = current[i];
            if (url) {
              return (
                <div key={url + i} className="ux-sq relative aspect-square overflow-hidden rounded-[12px] border"
                     style={{ borderColor: i === 0 ? "var(--ux-brand)" : "var(--ux-line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute start-1.5 top-1.5 rounded-full px-2 py-0.5 text-2xs font-bold"
                          style={{ background: "var(--ux-brand)", color: "var(--ux-on-brand)" }}>First</span>
                  )}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                    {i > 0 ? (
                      <button type="button" disabled={photoBusy} onClick={() => void storePhotos([url, ...current.filter((_, j) => j !== i)])}
                              className="rounded-full px-2 py-1 text-2xs font-bold" style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-ink)" }}>
                        Make first
                      </button>
                    ) : <span />}
                    <button type="button" disabled={photoBusy} aria-label={`Remove photo ${i + 1}`}
                            onClick={() => void storePhotos(current.filter((_, j) => j !== i))}
                            className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-ink)" }}>
                      <Icons.X className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                </div>
              );
            }
            const next = i === current.length;
            return (
              <button key={`empty-${i}`} type="button" disabled={!next || photoBusy}
                      onClick={() => fileInput.current?.click()}
                      aria-label={`Add photo ${i + 1}`}
                      className="ux-press ux-sq grid aspect-square place-items-center rounded-[12px] border"
                      style={{ borderColor: "var(--ux-line)", borderStyle: "dashed", opacity: next ? 1 : 0.45 }}>
                <span className="flex flex-col items-center gap-1.5">
                  {photoBusy && next
                    ? <Icons.Loader className="h-[20px] w-[20px] animate-spin" style={{ color: "var(--ux-brand)" }} />
                    : <Icons.Plus className="h-[20px] w-[20px]" style={{ color: next ? "var(--ux-brand)" : "var(--ux-faint)" }} />}
                  <span className="text-2xs font-semibold" style={{ color: next ? "var(--ux-brand)" : "var(--ux-faint)" }}>
                    {photoBusy && next ? "Uploading…" : "Add photo"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {photoProblem && (
          <p role="alert" className="mt-2.5 text-xsm" style={{ color: "var(--ux-danger-ink)" }}>{photoProblem}</p>
        )}
        <p className="mt-3 flex items-start gap-2.5 rounded-[12px] p-3 text-xs leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.Camera className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          Daylight, a plain wall, and the thing filling most of the frame. Products with three photos sell
          roughly twice as often as products with one.
        </p>
      </Card>

      <Card className="mb-[16px]">
        <SectionHead title={tr("documentsProduct.theDetails")} />
        <div className="space-y-4">
          <Field label={tr("documentsProduct.whatIsItCalled")} hint={tr("documentsProduct.whatABuyerWouldSearchFor")}>
            <TextInput value={form.name} onChange={set("name")} placeholder={tr("documentsProduct.cottonKurta")} />
            {!form.name.trim() && NAME_PICKS.length > 0 && (
              <Picks options={NAME_PICKS} value={form.name} label="Quick names"
                     onPick={(x) => { put("name", x); setSubPick(productSubs.find((r) => r.name === x)?.key ?? sub); }} />
            )}
          </Field>

          <Field label={cats.storeCat ? `What kind of ${cats.storeCat.name.toLowerCase()}?` : "What kind of product?"}
                 hint={cats.storeCat ? `Your shop sells ${cats.storeCat.name}.` : undefined}>
            {cats.data && !cats.storeCat ? <ChooseCategoryPrompt compact />
              : <SubChips subs={productSubs} value={sub} parent={cats.storeCat} onPick={(x) => { setSubPick(x.key); setSaved(false); }}
                          empty={cats.storeCat ? `${cats.storeCat.name} doesn't take products. List it as a service instead.` : "Loading…"} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" hint={tr("documentsProduct.inRupeesBuyersSeeThisExactly")}>
              <TextInput value={form.rupees} onChange={set("rupees")} placeholder="1200" inputMode="numeric" />
            </Field>
            <Field label={tr("documentsProduct.howManyAreReady")} hint={tr("documentsProduct.leaveIfYouMakeEachOne")}>
              <Stepper value={form.stock} onChange={(x) => put("stock", x)} label={tr("documentsProduct.howManyAreReady")} presets={[0, 1, 5, 10, 25]} />
            </Field>
          </div>

          <Field label={tr("documentsProduct.describeIt")} hint={tr("documentsProduct.whatItIsMadeOfHow")}>
            <Picks options={ABOUT_PHRASES} value={form.about.split(". ")} multi label="Tap to add to the description"
                   onPick={(x) => put("about", togglePhrase(form.about, x))} />
            <div className="mt-2.5" />
            <textarea
              value={form.about}
              onChange={(e) => { setForm((f) => ({ ...f, about: e.target.value })); setSaved(false); }}
              rows={4}
              aria-label={tr("documentsProduct.describeIt2")}
              className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            />
          </Field>

          <Field label={tr("documentsProduct.howLongToMakeOne")} hint={tr("documentsProduct.beHonestALateOrderCosts")}>
            <Select value={form.made} onChange={(x) => put("made", x)} label={tr("documentsProduct.howLongToMakeOne")} options={MAKE_TIMES} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead title={tr("documentsProduct.inYourShop")} />
        <Toggle
          on={form.live}
          onChange={(v) => { setForm((f) => ({ ...f, live: v })); setSaved(false); }}
          label={tr("documentsProduct.showThisToBuyers")}
          whenOn="Anyone visiting your shop can see and order it."
          whenOff="Only you can see it. Nothing is lost — turn it back on any time."
        />
      </Card>
    </HomeShell>
  );
}

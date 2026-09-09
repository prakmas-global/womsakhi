"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

import { apiSaveListing, apiUpdateListing } from "@/lib/shop-api";
import { messageFrom } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import {Back, Btn, Card, EmptyState, IconTile, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { Field, TextInput, Toggle } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBusiness } from "@/components/ux/business";
import { rupees } from "@/components/ux/shop/data";
import { useT } from "@/i18n";

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


  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

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
    return m;
  }, [form, price_minor]);

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
            body="It may have been removed from your shop."
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
                <img loading="lazy" decoding="async" src={base.art} alt="" className="h-full w-full object-cover" />
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

      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>
        {isNew ? "Add something you sell" : form.name || "Edit product"}
      </h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        {isNew ? tr("documentsProduct.fourThingsAndItIsListed")
              : tr("documentsProduct.changesReachBuyersStraightAway")}
      </p>

      <Card className="mb-[16px]">
        <SectionHead title="Photos" sub={tr("documentsProduct.theFirstOneIsWhatBuyers")} />
        <div className="ux-deck grid grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              className="ux-i ux-sq grid aspect-square place-items-center overflow-hidden rounded-[12px] border"
              style={{ borderColor: i === 0 ? "var(--ux-brand)" : "var(--ux-line)",
                       borderStyle: i === 0 ? "solid" : "dashed", ["--i" as string]: i }}
            >
              {i === 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={base.art} alt="" className="ux-art h-full w-full object-cover" />
                </>
              ) : (
                <span className="flex flex-col items-center gap-1.5">
                  <Icons.Plus className="ux-ico h-[20px] w-[20px]" style={{ color: "var(--ux-faint)" }} />
                  <span className="text-2xs" style={{ color: "var(--ux-faint)" }}>Add</span>
                </span>
              )}
            </button>
          ))}
        </div>
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
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price" hint={tr("documentsProduct.inRupeesBuyersSeeThisExactly")}>
              <TextInput value={form.rupees} onChange={set("rupees")} placeholder="1200" inputMode="numeric" />
            </Field>
            <Field label={tr("documentsProduct.howManyAreReady")} hint={tr("documentsProduct.leaveIfYouMakeEachOne")}>
              <TextInput value={form.stock} onChange={set("stock")} placeholder="0" inputMode="numeric" />
            </Field>
          </div>

          <Field label={tr("documentsProduct.describeIt")} hint={tr("documentsProduct.whatItIsMadeOfHow")}>
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
            <TextInput value={form.made} onChange={set("made")} placeholder={tr("documentsProduct.days")} />
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

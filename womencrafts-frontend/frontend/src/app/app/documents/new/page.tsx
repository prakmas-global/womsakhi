"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { apiPauseListing, apiSaveListing } from "@/lib/shop-api";
import { useMe } from "@/components/ux/me";
import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, I, IconTile, SourceNote, v } from "@/components/ux/kit";
// The centred dialog is a design-system primitive; the ux kit only carries
// `Sheet`, which is a drawer and the wrong shape for a choice like this.
import Modal from "@/design-system/primitives/Modal";
import {
  CATEGORIES, HIGHLIGHTS, PRICE_BANDS, PRICE_TYPES, PROCESSING_TIMES,
  QUOTE_FIELDS, RESPONSE_TIMES,
} from "@/components/ux/earn/data";

import { Saying, Tips } from "./wizard-views";
import {
  Area, Check, Choice, Label, Select, Steps, Text, Toggle,
} from "@/components/ux/kit/form";

/** What the four steps of adding a listing are called. */
const STEPS = [
  { id: 1, label: "What it is" },
  { id: 2, label: "Price and delivery" },
  { id: 3, label: "Photos" },
  { id: 4, label: "Check and publish" },
] as const;
import { QuoteSheet } from "./quote-sheet";

type Kind = "product" | "service" | "both";
type PriceMode = "fixed" | "range" | "quote";
type Delivery = "physical" | "digital" | "service";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const TIPS: Record<number, { title: string; items: string[] }> = {
  1: { title: "Making it findable", items: [
    "Name it the way a buyer would ask for it",
    "Say the size, the material and the colour",
    "Pick the category she would look in",
    "Be honest about what it is not" ] },
  2: { title: "Setting a price", items: [
    "Look at what women near you charge",
    "Count your material AND your hours",
    "Add what postage really costs you",
    "You can change it whenever you like" ] },
  3: { title: "Photographs", items: [
    "Daylight near a window beats any filter",
    "One photo of the whole thing, one close up",
    "Show it being worn or used",
    "Plain wall behind it, nothing distracting" ] },
  4: { title: "Before it goes live", items: [
    "Read it as if you were the buyer",
    "Check the price and the delivery days",
    "Nothing here is permanent — edit any time",
    "Share the link once it is up" ] },
};

/**
 * Adding something to sell, in four steps.
 *
 * ── Why a wizard and not one long form ──────────────────────────────────────
 * The whole thing is about thirty fields. Shown at once that is a wall, and the
 * women this is for are often filling it in on a phone between other work. Four
 * screens, each answering one question — what is it, what does it cost, what
 * does it look like, is it right — is a shape she can put down and come back to.
 *
 * ── Nothing is lost by going back ───────────────────────────────────────────
 * Every completed step stays clickable and every answer survives. A wizard that
 * forgets when you step backwards teaches you not to check your work.
 *
 * ── What is saved, and what is not ──────────────────────────────────────────
 * `POST /shop/listings` takes a kind, a title, a description, a price, a rate,
 * a stock count and a category — and those are written. It has no field for
 * the highlights, the price band, the quote settings or the media, so those
 * are held only in this form and `SourceNote` says so on the steps that
 * collect them.
 *
 * Before this, both buttons on the last step called `router.push` and nothing
 * else: she filled in four steps and the listing was silently thrown away.
 */
export default function AddListingPage() {
  const router = useRouter();

  // The preview says "By <her>", not "By the seller" — she is the seller.
  const me = useMe();
  const seller = me.first || "you";

  const [at, setAt] = useState(1);
  const [done, setDone] = useState(1);

  // Step 1
  const [kind, setKind] = useState<Kind>("product");
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [short, setShort] = useState("");
  const [long, setLong] = useState("");
  const [tags, setTags] = useState("");
  const [picked, setPicked] = useState<string[]>(["Handmade"]);

  // Step 2
  const [mode, setMode] = useState<PriceMode>("fixed");
  const [price, setPrice] = useState("");
  const [was, setWas] = useState("");
  const [discountOn, setDiscountOn] = useState(false);
  const [discount, setDiscount] = useState("");
  const [priceType, setPriceType] = useState(PRICE_TYPES[0]);
  const [minQty, setMinQty] = useState("1");
  const [band, setBand] = useState<{ low: number; high: number } | null>(null);
  const [bandOpen, setBandOpen] = useState(false);
  const [customLow, setCustomLow] = useState("");
  const [customHigh, setCustomHigh] = useState("");
  const [trackStock, setTrackStock] = useState(true);
  const [stock, setStock] = useState("");
  const [lowAt, setLowAt] = useState("5");
  const [whenOut, setWhenOut] = useState<"stop" | "continue">("stop");
  const [delivery, setDelivery] = useState<Delivery>("physical");
  const [prep, setPrep] = useState(PROCESSING_TIMES[1]);
  const [ships, setShips] = useState("India");
  const [freeShip, setFreeShip] = useState(true);
  const [deliveryNote, setDeliveryNote] = useState("");

  // Step 2, quote mode
  const [quoteOn, setQuoteOn] = useState(true);
  const [quoteAsk, setQuoteAsk] = useState<string[]>(QUOTE_FIELDS.filter((f) => f.on).map((f) => f.id));
  const [quoteMsg, setQuoteMsg] = useState("");
  /** Open the buyer's form, so she can see the wall of questions she is
   *  putting in front of somebody who was about to buy. */
  const [askOpen, setAskOpen] = useState(false);
  const [respondIn, setRespondIn] = useState(RESPONSE_TIMES[1]);

  const subs = useMemo(() => CATEGORIES.find((c) => c.label === cat)?.subs ?? [], [cat]);

  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Write the listing, then go and look at it.
   *
   * A draft is saved and then paused rather than created paused: the create
   * endpoint takes a `ListingCreate`, which has no `status` — the same gap
   * that made `apiPauseListing` a separate call in the first place.
   */
  const publish = useCallback(async (asDraft: boolean) => {
    setSaveError(null);
    const rupees = Number(price.replace(/[^\d]/g, "")) || 0;
    try {
      const made = await apiSaveListing({
        kind: kind === "service" ? "service" : "product",
        title: title.trim(),
        desc: [short.trim(), long.trim()].filter(Boolean).join("\n\n"),
        price_minor: mode === "quote" ? 0 : rupees * 100,
        rate: mode === "quote" ? "By quote" : priceType,
        stock: kind === "service" || mode === "quote" || !trackStock
          ? null : Number(stock.replace(/[^\d]/g, "")) || 0,
        category: sub || cat,
      });
      if (asDraft && made?.id) await apiPauseListing(made.id, true);
      router.push("/app/documents/listings");
    } catch {
      setSaveError("That did not save. Nothing you typed is lost — try again in a moment.");
    }
  }, [kind, title, short, long, mode, price, priceType, trackStock, stock, sub, cat, router]);

  const toggleIn = useCallback((list: string[], set: (v: string[]) => void, id: string) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }, []);

  const step1Ok = title.trim().length > 2 && cat && short.trim().length > 5;
  const step2Ok = mode === "quote" ? quoteOn : Boolean(price.trim());

  const go = useCallback((n: number) => {
    setAt(n);
    setDone((d) => Math.max(d, n));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const priceNum = Number(price.replace(/[^\d]/g, "")) || 0;
  const wasNum = Number(was.replace(/[^\d]/g, "")) || 0;
  const discNum = Number(discount.replace(/[^\d]/g, "")) || 0;
  const shownPrice = discountOn && discNum ? discNum : priceNum;
  const off = wasNum > shownPrice && shownPrice > 0
    ? Math.round((1 - shownPrice / wasNum) * 100) : 0;

  return (
    <HomeShell
      active="/app/documents"
      rail={
        <div className="space-y-[16px]">
          <Tips title={TIPS[at].title} at={at} of={4} items={TIPS[at].items} />
          <Saying text={
            at === 2 ? "A fair price is one you would still be glad of on a busy week."
            : "Every small step you take builds something that is yours."
          } />

          {/* What a buyer will see, as she fills it in. */}
          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
              <Icons.Eye className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
              How it will look
            </h2>
            <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: v("--ux-line") }}>
              <div className="grid h-[132px] place-items-center" style={{ background: v("--ux-surface-2") }}>
                <Icons.Image className="h-[30px] w-[30px]" style={{ color: v("--ux-faint") }} />
              </div>
              <div className="p-3">
                <p className="truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                  {title.trim() || "Your title goes here"}
                </p>
                <p className="mt-1 flex items-center gap-2">
                  <span className="text-base font-extrabold" style={{ color: v("--ux-brand") }}>
                    {mode === "quote" ? "By quote"
                      : band ? `${money(band.low)} – ${money(band.high)}`
                      : shownPrice ? money(shownPrice) : "—"}
                  </span>
                  {off > 0 && (
                    <>
                      <span className="text-xs line-through" style={{ color: v("--ux-faint") }}>{money(wasNum)}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-2xs font-bold"
                            style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                        {off}% off
                      </span>
                    </>
                  )}
                </p>
                {picked.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1">
                    {picked.slice(0, 3).map((h) => (
                      <span key={h} className="rounded-[6px] px-1.5 py-0.5 text-2xs font-semibold"
                            style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>{h}</span>
                    ))}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
                  {short.trim() || "Your short description shows here."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      }
    >
      <Back to="/app/documents/listings" label="What you sell" className="mb-4" />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-[1.15] tracking-[-0.02em]"
              style={{ color: v("--ux-ink") }}>
            Add something to sell
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Tell buyers what you make or do. You can change every part of it later.
          </p>
        </div>
        <Btn variant="outline" icon="Save" onClick={() => router.push("/app/documents/listings")}>
          Save and finish later
        </Btn>
      </div>

      <Steps steps={STEPS} at={at} done={done} onGo={go} />

      {/* ── 1 · What it is ───────────────────────────────────────────────── */}
      {at === 1 && (
        <Card pad={20}>
          <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>What are you selling?</h2>
          <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
            The basics. This is what a buyer reads first.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Choice icon="Package" title="A product" sub="Something you make or supply"
                    on={kind === "product"} onClick={() => setKind("product")} />
            <Choice icon="Sparkles" title="A service" sub="Something you do, by hand or by hour"
                    on={kind === "service"} onClick={() => setKind("service")} />
            <Choice icon="Boxes" title="Both" sub="A thing and the work that goes with it"
                    on={kind === "both"} onClick={() => setKind("both")} />
          </div>

          <div className="mt-5">
            <Label need>What is it called</Label>
            <Text value={title} onChange={setTitle} max={100} label="Title"
                  placeholder="Handmade cotton kurta" />
            <span className="mt-1 block text-end text-2xs" style={{ color: v("--ux-faint") }}>
              {title.length}/100
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label need>Category</Label>
              <Select value={cat} onChange={(c) => { setCat(c); setSub(""); }} label="Category"
                      placeholder="Choose one" options={CATEGORIES.map((c) => c.label)} />
            </div>
            <div>
              <Label>Kind of {cat ? "it" : "thing"}</Label>
              <Select value={sub} onChange={setSub} label="Subcategory"
                      placeholder={cat ? "Choose one" : "Pick a category first"} options={subs} />
            </div>
          </div>

          <div className="mt-4">
            <Label need>In one line</Label>
            <Area value={short} onChange={setShort} max={200} rows={2} label="Short description"
                  placeholder="Hand-stitched cotton kurta, available in six colours." />
          </div>

          <div className="mt-3">
            <Label>Everything else</Label>
            <Area value={long} onChange={setLong} max={1000} rows={5} label="Detailed description"
                  placeholder="Material, sizes, how it is made, how to wash it, how long it takes you." />
          </div>

          <div className="mt-4">
            <Label hint="up to six">What makes it worth buying</Label>
            <div className="flex flex-wrap gap-2">
              {HIGHLIGHTS.map((h) => {
                const on = picked.includes(h);
                return (
                  <button key={h} type="button" aria-pressed={on}
                          onClick={() => { if (on || picked.length < 6) toggleIn(picked, setPicked, h); }}
                          className="ux-press ux-sq flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
                          style={{ background: v(on ? "--ux-brand-tint" : "--ux-surface-2"),
                                   color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                    {on && <Icons.Check className="h-[12px] w-[12px]" />}
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <Label>Words people might search</Label>
            <Text value={tags} onChange={setTags} label="Tags"
                  placeholder="cotton, kurta, handmade, festival" />
            <p className="mt-1 text-2xs" style={{ color: v("--ux-faint") }}>
              Separate with commas. These help buyers find you, and are never shown as written.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
               style={{ borderColor: v("--ux-line") }}>
            <Btn variant="ghost" onClick={() => router.push("/app/documents/listings")}>Cancel</Btn>
            <Btn disabled={!step1Ok} onClick={() => go(2)} iconEnd="ArrowRight">
              Next: price and delivery
            </Btn>
          </div>
        </Card>
      )}

      {/* ── 2 · Price and delivery ───────────────────────────────────────── */}
      {at === 2 && (
        <div className="flex flex-col gap-4">
          {band && (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] p-4"
                 style={{ background: v("--ux-tint-green") }}>
              <Icons.CheckCircle2 className="h-[20px] w-[20px] shrink-0" style={{ color: v("--ux-green-ink") }} />
              <div className="min-w-[200px] flex-1">
                <p className="text-xsm font-bold" style={{ color: v("--ux-green-ink") }}>
                  Working within {money(band.low)} – {money(band.high)}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: v("--ux-ink-2") }}>
                  A starting point, not a rule. Change it whenever you like.
                </p>
              </div>
              <Btn size="sm" variant="outline" onClick={() => setBandOpen(true)}>Change range</Btn>
            </div>
          )}

          <Card pad={20}>
            <div className="flex items-start gap-3">
              <IconTile icon="IndianRupee" tint="--ux-tint-violet" ink="--ux-violet-ink" size={36} radius={11} />
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>What it costs</h2>
                <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                  Set a fair price. You can always change it later.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Choice icon="Tag" title="One price" sub="The same for everyone"
                      on={mode === "fixed"} onClick={() => setMode("fixed")} />
              <Choice icon="BarChart3" title="A range" sub="From this much to that much"
                      on={mode === "range"} onClick={() => { setMode("range"); setBandOpen(true); }} />
              <Choice icon="MessageSquare" title="By quote" sub="Buyers ask, you price it"
                      on={mode === "quote"} onClick={() => setMode("quote")} />
            </div>

            {mode !== "quote" ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label need>Your price</Label>
                    <Text value={price} onChange={setPrice} label="Price" prefix="₹" type="number"
                          placeholder="1400" />
                    {band && (
                      <p className="mt-1 text-2xs" style={{ color: v("--ux-faint") }}>
                        Within {money(band.low)} – {money(band.high)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>What it used to be</Label>
                    <Text value={was} onChange={setWas} label="Compare at price" prefix="₹" type="number"
                          placeholder="2000" />
                    <p className="mt-1 text-2xs" style={{ color: v("--ux-faint") }}>
                      Shown struck through, so the saving is visible.
                    </p>
                  </div>
                  <div>
                    <Label>Sold by</Label>
                    <Select value={priceType} onChange={setPriceType} label="Price type" options={PRICE_TYPES} />
                  </div>
                </div>

                <div className="mt-4 rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
                  <Toggle on={discountOn} onChange={setDiscountOn}
                          label="Run a discount"
                          sub="A lower price for now. The original stays visible beside it." />
                  {discountOn && (
                    <div className="mt-3 max-w-[240px]">
                      <Label>Discounted price</Label>
                      <Text value={discount} onChange={setDiscount} label="Discount price" prefix="₹"
                            type="number" placeholder="1200" />
                    </div>
                  )}
                </div>

                <div className="mt-4 max-w-[240px]">
                  <Label>Smallest order you will take</Label>
                  <Text value={minQty} onChange={setMinQty} label="Minimum order quantity" type="number" />
                </div>
              </>
            ) : (
              /* By quote */
              <div className="mt-5">
                <Toggle on={quoteOn} onChange={setQuoteOn}
                        label="Let buyers ask for a price"
                        sub="They send what they need, you reply with a price. Nothing is agreed until you both say so." />

                {quoteOn && (
                  <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div>
                      <Label>What to ask them for</Label>
                      <div className="mt-1">
                        {QUOTE_FIELDS.map((f) => (
                          <Check key={f.id} label={f.label}
                                 on={quoteAsk.includes(f.id)}
                                 onChange={() => toggleIn(quoteAsk, setQuoteAsk, f.id)} />
                        ))}
                      </div>

                      <div className="mt-4">
                        <Label>Anything you want to say first</Label>
                        <Area value={quoteMsg} onChange={setQuoteMsg} max={300} rows={3}
                              label="Message to buyers"
                              placeholder="Tell me the size, the colour and how many, and I will send you a price the same day." />
                      </div>

                      <div className="mt-3 max-w-[280px]">
                        <Label>How fast you usually reply</Label>
                        <Select value={respondIn} onChange={setRespondIn} label="Expected response time"
                                options={RESPONSE_TIMES} />
                      </div>
                    </div>

                    <div className="rounded-[14px] p-4" style={{ background: v("--ux-surface-2") }}>
                      <p className="flex items-center gap-2 text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                        <Icons.Quote className="h-[15px] w-[15px]" style={{ color: v("--ux-brand") }} />
                        What the buyer sees
                      </p>
                      <div className="mt-3 rounded-[12px] p-3.5" style={{ background: v("--ux-surface") }}>
                        <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>Ask for a price</p>
                        <p className="mt-1 text-xs leading-snug" style={{ color: v("--ux-muted") }}>
                          Tell her what you need and she will send you a price.
                        </p>
                        <div className="mt-2.5">
                          <Btn size="sm" full onClick={() => setAskOpen(true)}>Ask for a price</Btn>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {["You are told each time someone asks",
                          "You can talk it through before you price it",
                          "A price you both agree becomes an order"].map((t) => (
                          <li key={t} className="flex items-start gap-1.5 text-2xs leading-snug"
                              style={{ color: v("--ux-ink-2") }}>
                            <Icons.Check className="mt-[1px] h-[12px] w-[12px] shrink-0"
                                         style={{ color: v("--ux-green-ink") }} />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Stock — products only */}
          {kind !== "service" && mode !== "quote" && (
            <Card pad={20}>
              <div className="flex items-start gap-3">
                <IconTile icon="Package" tint="--ux-tint-blue" ink="--ux-blue-ink" size={36} radius={11} />
                <div>
                  <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>How many you have</h2>
                  <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                    Only if you keep a count. A tailor who makes to order does not need this.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Toggle on={trackStock} onChange={setTrackStock}
                        label="Keep a count" sub="We will tell you when it is running low." />
              </div>

              {trackStock && (
                <div className="mt-4 grid gap-4 lg:grid-cols-[160px_160px_minmax(0,1fr)]">
                  <div>
                    <Label need>How many now</Label>
                    <Text value={stock} onChange={setStock} label="Total stock" type="number" placeholder="50" />
                  </div>
                  <div>
                    <Label>Warn me at</Label>
                    <Text value={lowAt} onChange={setLowAt} label="Low stock alert" type="number" />
                  </div>
                  <div className="rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
                    <span className="mb-2 block text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                      When it runs out
                    </span>
                    {([
                      { id: "stop",     t: "Stop taking orders", s: "The listing pauses itself" },
                      { id: "continue", t: "Keep taking orders", s: "You make each one to order" },
                    ] as const).map((o) => (
                      <button key={o.id} type="button" role="radio" aria-checked={whenOut === o.id}
                              onClick={() => setWhenOut(o.id)}
                              className="ux-sq flex w-full items-start gap-2.5 py-1.5 text-start">
                        <span className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2"
                              style={{ borderColor: v(whenOut === o.id ? "--ux-fill" : "--ux-line-strong") }}>
                          {whenOut === o.id && (
                            <span className="h-[9px] w-[9px] rounded-full" style={{ background: v("--ux-fill") }} />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold" style={{ color: v("--ux-ink") }}>{o.t}</span>
                          <span className="block text-2xs" style={{ color: v("--ux-muted") }}>{o.s}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Delivery */}
          <Card pad={20}>
            <div className="flex items-start gap-3">
              <IconTile icon="Truck" tint="--ux-tint-amber" ink="--ux-amber-ink" size={36} radius={11} />
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>How it reaches them</h2>
                <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                  Buyers decide on this almost as much as on the price.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {([
                { id: "physical", t: "I send it" },
                { id: "digital",  t: "They download it" },
                { id: "service",  t: "I do it for them" },
              ] as const).map((d) => {
                const on = delivery === d.id;
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => setDelivery(d.id)}
                          className="ux-press ux-sq min-h-[40px] rounded-[11px] px-4 text-xsm font-bold"
                          style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"),
                                   color: v(on ? "--ux-on-brand" : "--ux-ink-2") }}>
                    {d.t}
                  </button>
                );
              })}
            </div>

            {delivery === "physical" && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                  <Label need>Time to get it ready</Label>
                  <Select value={prep} onChange={setPrep} label="Processing time" options={PROCESSING_TIMES} />
                </div>
                <div>
                  <Label need>Where you send to</Label>
                  <Select value={ships} onChange={setShips} label="Shipping within"
                          options={["My city", "My state", "India", "Anywhere"]} />
                </div>
                <div className="rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
                  <span className="mb-2 block text-xsm font-bold" style={{ color: v("--ux-ink") }}>Postage</span>
                  {([
                    { on: true,  t: "I pay the postage", s: "The price includes it" },
                    { on: false, t: "The buyer pays",    s: "Added at checkout" },
                  ]).map((o) => (
                    <button key={String(o.on)} type="button" role="radio" aria-checked={freeShip === o.on}
                            onClick={() => setFreeShip(o.on)}
                            className="ux-sq flex w-full items-start gap-2.5 py-1.5 text-start">
                      <span className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2"
                            style={{ borderColor: v(freeShip === o.on ? "--ux-fill" : "--ux-line-strong") }}>
                        {freeShip === o.on && (
                          <span className="h-[9px] w-[9px] rounded-full" style={{ background: v("--ux-fill") }} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold" style={{ color: v("--ux-ink") }}>{o.t}</span>
                        <span className="block text-2xs" style={{ color: v("--ux-muted") }}>{o.s}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <Label>Anything else they should know</Label>
              <Area value={deliveryNote} onChange={setDeliveryNote} max={300} rows={2}
                    label="Additional delivery information"
                    placeholder="Wrapped in cloth, not plastic. Usually reaches in three to five days." />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                 style={{ borderColor: v("--ux-line") }}>
              <Btn variant="ghost" icon="ArrowLeft" onClick={() => go(1)}>Back</Btn>
              <Btn disabled={!step2Ok} onClick={() => go(3)} iconEnd="ArrowRight">Next: photos</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ── 3 · Photos ───────────────────────────────────────────────────── */}
      {at === 3 && (
        <Card pad={20}>
          <div className="flex items-start gap-3">
            <IconTile icon="Camera" tint="--ux-tint-pink" ink="--ux-pink-ink" size={36} radius={11} />
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>Show it</h2>
              <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                A photograph is the difference between being looked at and being scrolled past.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button"
                    className="ux-press ux-sq grid aspect-square place-items-center rounded-[14px] border-2 border-dashed"
                    style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface-2") }}>
              <span className="text-center">
                <Icons.Camera className="mx-auto h-[26px] w-[26px]" style={{ color: v("--ux-brand") }} />
                <span className="mt-2 block text-xsm font-bold" style={{ color: v("--ux-ink") }}>Take a photo</span>
                <span className="mt-0.5 block text-2xs" style={{ color: v("--ux-muted") }}>or choose from your phone</span>
              </span>
            </button>
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid aspect-square place-items-center rounded-[14px] border"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface-2") }}>
                <span className="text-center">
                  <Icons.Image className="mx-auto h-[22px] w-[22px]" style={{ color: v("--ux-faint") }} />
                  <span className="mt-1.5 block text-2xs" style={{ color: v("--ux-faint") }}>Photo {n + 1}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[12px] p-4" style={{ background: v("--ux-surface-2") }}>
            <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>What works</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {["Daylight, near a window",
                "One of the whole thing, one close up",
                "Show it worn or in use",
                "A plain wall behind it"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-xs" style={{ color: v("--ux-ink-2") }}>
                  <Icons.Check className="mt-[2px] h-[13px] w-[13px] shrink-0" style={{ color: v("--ux-green-ink") }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <SourceNote source="mock" what="photo uploads" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
               style={{ borderColor: v("--ux-line") }}>
            <Btn variant="ghost" icon="ArrowLeft" onClick={() => go(2)}>Back</Btn>
            <Btn onClick={() => go(4)} iconEnd="ArrowRight">Next: check it</Btn>
          </div>
        </Card>
      )}

      {/* ── 4 · Check and publish ────────────────────────────────────────── */}
      {at === 4 && (
        <Card pad={20}>
          <div className="flex items-start gap-3">
            <IconTile icon="CheckCircle2" tint="--ux-tint-green" ink="--ux-green-ink" size={36} radius={11} />
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: v("--ux-ink") }}>Read it as a buyer would</h2>
              <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                Anything wrong here can be fixed after it is live.
              </p>
            </div>
          </div>

          <dl className="mt-4 divide-y" style={{ borderColor: v("--ux-line") }}>
            {[
              { k: "What it is",   val: title.trim() || "—", step: 1 },
              { k: "Category",     val: [cat, sub].filter(Boolean).join(" · ") || "—", step: 1 },
              { k: "In one line",  val: short.trim() || "—", step: 1 },
              { k: "Price",        val: mode === "quote" ? "Buyers ask for a price"
                                     : band ? `${money(band.low)} – ${money(band.high)}`
                                     : shownPrice ? `${money(shownPrice)} ${priceType.toLowerCase()}` : "—", step: 2 },
              { k: "Stock",        val: kind === "service" || mode === "quote" ? "Not counted"
                                     : trackStock ? `${stock || 0} now` : "Not counted", step: 2 },
              { k: "Delivery",     val: delivery === "physical" ? `${prep}, ${ships.toLowerCase()}`
                                     : delivery === "digital" ? "They download it" : "You do it for them", step: 2 },
              { k: "Photos",       val: "None added yet", step: 3 },
            ].map((r) => (
              <div key={r.k} className="flex items-start justify-between gap-4 py-3">
                <dt className="w-[140px] shrink-0 text-xs font-semibold" style={{ color: v("--ux-muted") }}>{r.k}</dt>
                <dd className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink") }}>{r.val}</dd>
                <button type="button" onClick={() => go(r.step)}
                        className="ux-sq shrink-0 text-xs font-bold" style={{ color: v("--ux-brand") }}>
                  Change
                </button>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-start gap-3 rounded-[12px] p-3.5"
               style={{ background: v("--ux-surface-2") }}>
            <Icons.ShieldCheck className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Your listing shows your shop name and city, never your address or phone number. Buyers
              reach you through WomSakhi until you decide otherwise.
            </p>
          </div>

          <SourceNote source="mock"
                      what="the highlights, the price band and the photos — those are not saved yet" />

          {saveError && (
            <p role="alert" className="mt-3 rounded-[12px] px-4 py-3 text-xsm font-semibold"
               style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
              {saveError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
               style={{ borderColor: v("--ux-line") }}>
            <Btn variant="ghost" icon="ArrowLeft" onClick={() => go(3)}>Back</Btn>
            <div className="flex flex-wrap gap-2">
              <Btn variant="outline" icon="Save" disabled={!title.trim()}
                   onClick={() => publish(true)}>
                Keep as a draft
              </Btn>
              <Btn icon="Rocket" disabled={!title.trim()} onClick={() => publish(false)}>
                Put it in my shop
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── The price band picker ────────────────────────────────────────── */}
      <Modal open={bandOpen} onClose={() => setBandOpen(false)} size="lg"
             title="What should you charge?"
             description="Pick the range your work belongs in. It is a starting point, not a rule."
             icon={Icons.BarChart3} iconTone="brand"
             footer={
               <>
                 <Btn variant="ghost" onClick={() => setBandOpen(false)}>Cancel</Btn>
                 <Btn iconEnd="ArrowRight" onClick={() => {
                   const low = Number(customLow.replace(/[^\d]/g, "")) || 0;
                   const high = Number(customHigh.replace(/[^\d]/g, "")) || 0;
                   if (low && high) setBand({ low: Math.min(low, high), high: Math.max(low, high) });
                   setBandOpen(false);
                 }}>
                   Use this range
                 </Btn>
               </>
             }>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PRICE_BANDS.map((b) => {
                const on = band?.low === b.low && band?.high === b.high;
                return (
                  <button key={b.id} type="button" aria-pressed={on}
                          onClick={() => {
                            setBand({ low: b.low, high: b.high || b.low * 4 });
                            setCustomLow(String(b.low));
                            setCustomHigh(String(b.high || b.low * 4));
                          }}
                          className="ux-press ux-sq flex items-start gap-3 rounded-[12px] border p-3.5 text-start"
                          style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"),
                                   background: v(on ? "--ux-brand-tint" : "--ux-surface") }}>
                    <I name={b.icon} className="mt-[2px] h-[18px] w-[18px] shrink-0"
                       style={{ color: v(on ? "--ux-brand" : "--ux-muted") }} />
                    <span className="min-w-0">
                      <span className="block text-xsm font-bold" style={{ color: v("--ux-ink") }}>{b.label}</span>
                      <span className="mt-0.5 block text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
                        {b.note}
                      </span>
                      {b.popular && (
                        <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-2xs font-bold"
                              style={{ background: v("--ux-tint-pink"), color: v("--ux-pink-ink") }}>
                          Most women pick this
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
              <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>Or set your own</p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Lowest</Label>
                  <Text value={customLow} onChange={setCustomLow} label="Minimum price"
                        prefix="₹" type="number" placeholder="500" />
                </div>
                <div>
                  <Label>Highest</Label>
                  <Text value={customHigh} onChange={setCustomHigh} label="Maximum price"
                        prefix="₹" type="number" placeholder="2500" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[12px] p-4" style={{ background: v("--ux-brand-tint") }}>
            <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>How to decide</p>
            <ul className="mt-2.5 space-y-2">
              {["Look at what similar work sells for here",
                "Count the material and your hours, both",
                "Do not price below what it costs you",
                "You can change it at any time"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>
                  <Icons.CheckCircle2 className="mt-[1px] h-[13px] w-[13px] shrink-0" style={{ color: v("--ux-brand") }} />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t pt-3 text-xs italic leading-relaxed"
               style={{ borderColor: v("--ux-line"), color: v("--ux-brand") }}>
              “Price it like the work took time. It did.”
            </p>
          </div>
        </div>
      </Modal>

      {/* The buyer's form, opened from her own preview of it. */}
      <QuoteSheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        listing={{ title, seller: seller }}
        ask={quoteAsk}
        message={quoteMsg}
        respondIn={respondIn}
      />
    </HomeShell>
  );
}

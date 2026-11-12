"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, useNarrow, v } from "@/components/ux/kit";
import { Area, Label, Picks, Steps, Stepper, Text } from "@/components/ux/kit/form";
import { formatMoney } from "@/components/ux/kit/money";
import { PicTiles, useMasterPictures } from "@/components/ux/media/MasterPictures";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { apiMyWorkProfile } from "@/lib/work-api";
import {
  CONDITION_LOOK, HANDOVER_LOOK, apiAddRental, apiEditRental, rentFor,
  type Condition, type Handover, type ItemInput, type RentalItem,
} from "@/lib/rentals-api";
import { PhotoPicker } from "../PhotoPicker";

/**
 * Rent something out — the form for a new listing and for changing one
 * (backend: routes/rentals.py; prices are checked there too).
 *
 * Almost all taps: a category is a picture, a title is a suggestion chip, a
 * price is a chip, days are steppers, rules are chips. Typing is left for the
 * few words only she can say. On a phone it is four short steps; on a laptop
 * it is one page with the board card it will become standing beside it.
 */

const FALLBACK_CATEGORIES = [
  "Sarees & lehengas", "Party & wedding wear", "Jewellery", "Baby & kids", "Kitchen & big vessels", "Event & decor",
  "Sewing & craft machines", "Home appliances", "Tools", "Books & study", "Travel & luggage", "Something else",
];

/** Titles to tap, by what the category's name points to. */
const TITLES: [RegExp, string[]][] = [
  [/saree|lehenga/i, ["Silk saree", "Bridal lehenga", "Kanjivaram saree", "Designer lehenga", "Half saree set"]],
  [/party|wedding wear/i, ["Party gown", "Anarkali dress", "Sherwani", "Kids' party dress", "Designer blouse"]],
  [/jewel/i, ["Bridal jewellery set", "Kundan necklace set", "Temple jewellery", "Bangles set", "Maang tikka"]],
  [/baby|kid/i, ["Pram", "Baby cot", "Car seat", "Baby walker", "High chair"]],
  [/kitchen|vessel/i, ["Big pressure cooker", "Biryani handi", "Large kadai", "Idli steamer", "Mixer grinder"]],
  [/event|decor/i, ["Fairy lights", "Plastic chairs (set)", "Backdrop stand", "Rangoli stencils", "Flower decor set"]],
  [/sewing|craft/i, ["Sewing machine", "Embroidery machine", "Overlock machine", "Embroidery frame set"]],
  [/appliance/i, ["Air cooler", "Washing machine", "Iron box", "Room heater", "Water purifier"]],
  [/tool/i, ["Drill machine", "Ladder", "Toolkit", "Pressure washer"]],
  [/book|study/i, ["School textbooks", "Competitive exam books", "Scientific calculator", "Study table"]],
  [/travel|luggage/i, ["Large suitcase", "Trolley bag", "Travel backpack", "Kids' stroller"]],
];
const titlesFor = (category: string) => TITLES.find(([rx]) => rx.test(category))?.[1] ?? [];

const DAY_PRICES = [50, 100, 200, 300, 500, 1000];
const DEPOSITS = [0, 500, 1000, 2000, 5000];
const RULES = ["Dry clean only", "Return washed", "No smoking", "Handle with care", "ID needed at pickup", "Return by evening"];
const ABOUT = [
  "Used only a few times.", "Comes with its box.", "All parts included.", "Size M, fits 34–36.",
  "Freshly cleaned.", "Please check it at pickup.",
];
const CONDITION_ICON: Record<Condition, string> = { like_new: "Sparkles", good: "ThumbsUp", used: "Wrench" };

const STEPS = [
  { id: 1, label: "Photos & what" },
  { id: 2, label: "Price & deposit" },
  { id: 3, label: "Days & handover" },
  { id: 4, label: "Check & post" },
] as const;

/** Rupees typed as text → a whole number (0 when empty). */
const rupees = (s: string) => Math.max(0, Math.floor(Number(s.replace(/[^\d]/g, "")) || 0));

interface Form {
  photos: string[]; category: string; title: string; condition: Condition;
  day: string; week: string; deposit: string; minDays: string; maxDays: string;
  handover: Handover; area: string; city: string; rules: string[]; about: string;
}

function fromItem(i?: RentalItem): Form {
  return {
    photos: i?.photos ?? [], category: i?.category ?? "", title: i?.title ?? "", condition: i?.condition ?? "good",
    day: i ? String(i.price_day_minor / 100) : "", week: i?.price_week_minor ? String(i.price_week_minor / 100) : "",
    deposit: i ? String(i.deposit_minor / 100) : "0", minDays: String(i?.min_days ?? 1), maxDays: String(i?.max_days ?? 15),
    handover: i?.handover ?? "pickup", area: i?.area ?? "", city: i?.city ?? "", rules: i?.rules ?? [], about: i?.about ?? "",
  };
}

/** What is missing, in her words, per step. */
function problemsOf(f: Form): Record<number, string> {
  const p: Record<number, string> = {};
  if (!f.photos.length) p[1] = "Add at least one photo.";
  else if (!f.category) p[1] = "Pick what kind of thing it is.";
  else if (f.title.trim().length < 3) p[1] = "Give it a name — tap one, or type a few words.";
  const day = rupees(f.day), week = rupees(f.week);
  if (day < 10) p[2] = "Set a rent a day of at least ₹10.";
  else if (week && week >= day * 7) p[2] = `A week should cost less than seven days' rent (${formatMoney(day * 7 * 100)}).`;
  const min = rupees(f.minDays), max = rupees(f.maxDays);
  if (min < 1) p[3] = "The shortest rental is at least one day.";
  else if (max < min) p[3] = "The longest rental cannot be shorter than the shortest.";
  else if (f.city.trim().length < 2) p[3] = "Add your city, so women nearby find it.";
  return p;
}

export function ItemForm({ initial }: { initial?: RentalItem }) {
  const router = useRouter();
  const narrow = useNarrow();
  const editing = !!initial;
  const [f, setF] = useState<Form>(() => fromItem(initial));
  const [at, setAt] = useState(1);
  const [reached, setReached] = useState(editing ? 4 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ownRule, setOwnRule] = useState("");
  const set = <K extends keyof Form>(k: K) => (val: Form[K]) => setF((cur) => ({ ...cur, [k]: val }));

  const cats = useMasterPictures("rental_categories", FALLBACK_CATEGORIES);
  const categoryOptions = f.category && !cats.labels.includes(f.category) ? [f.category, ...cats.labels] : cats.labels;

  // Her city from her work profile, once, when she has not typed one.
  const work = useResource(useCallback((s: AbortSignal) => apiMyWorkProfile(s).catch(() => null), []), null);
  const [filled, setFilled] = useState(editing);
  if (!filled && work.data) {
    setFilled(true);
    if (!f.city && work.data.city) setF((cur) => ({ ...cur, city: work.data?.city ?? "", area: cur.area || work.data?.area || "" }));
  }

  const problems = useMemo(() => problemsOf(f), [f]);
  const firstProblem = [1, 2, 3].find((n) => problems[n]);

  const input = (): ItemInput => ({
    title: f.title.trim(), category: f.category, about: f.about.trim(), photos: f.photos, condition: f.condition,
    price_day_rupees: rupees(f.day), price_week_rupees: rupees(f.week) || null, deposit_rupees: rupees(f.deposit),
    min_days: rupees(f.minDays), max_days: rupees(f.maxDays), handover: f.handover,
    area: f.area.trim(), city: f.city.trim(), rules: f.rules,
  });

  const submit = async () => {
    if (firstProblem) { setAt(firstProblem); setError(problems[firstProblem]); return; }
    setBusy(true); setError("");
    try {
      if (initial) await apiEditRental(initial.id, input());
      else await apiAddRental(input());
      toast(initial ? "Saved" : "It is up for rent", { tone: "success" });
      router.push("/app/rent/mine");
    } catch (e) {
      setError(apiErrorMessage(e, "That did not save. Check your connection and try again."));
    } finally { setBusy(false); }
  };

  const go = (n: number) => {
    setError("");
    setAt(n);
    setReached((r) => Math.max(r, n));
    if (typeof window !== "undefined") document.getElementById("ux-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    if (problems[at]) { setError(problems[at]); return; }
    go(at + 1);
  };

  /* ── the four parts ─────────────────────────────────────────────────── */

  const partWhat = (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
        <I name="Camera" className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Photos and what it is
      </h2>
      <div className="space-y-5">
        <div>
          <Label need>Photos</Label>
          <PhotoPicker value={f.photos} onChange={set("photos")} max={6} label="Add a photo"
                       hint="Daylight, the whole thing, and any marks. The first photo is the cover." />
        </div>
        <div>
          <Label need>What kind of thing?</Label>
          <PicTiles label="Category" size="sm" value={f.category}
                    onPick={(c) => setF((cur) => ({ ...cur, category: c }))}
                    tiles={categoryOptions.map((c) => ({ value: c, label: c, src: cats.pic(c) }))} />
        </div>
        <div>
          <Label need>Name it</Label>
          <Text value={f.title} onChange={set("title")} label="Name of the thing" max={80}
                placeholder={titlesFor(f.category)[0] ? `e.g. ${titlesFor(f.category)[0]}` : "e.g. Red bridal lehenga"} />
          <Picks options={titlesFor(f.category)} value={f.title} label="Names to tap" onPick={set("title")} />
        </div>
        <div>
          <Label>How is it?</Label>
          <div role="radiogroup" aria-label="Condition" className="grid grid-cols-3 gap-2">
            {(Object.keys(CONDITION_LOOK) as Condition[]).map((c) => {
              const on = f.condition === c;
              return (
                <button key={c} type="button" role="radio" aria-checked={on} onClick={() => set("condition")(c)}
                        className="ux-press flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-[14px] border px-2 text-center text-xs font-semibold"
                        style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                 color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                  <I name={CONDITION_ICON[c]} className="h-6 w-6" />
                  {CONDITION_LOOK[c]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );

  const day = rupees(f.day);
  const partPrice = (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
        <I name="IndianRupee" className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Rent and deposit
      </h2>
      <div className="space-y-5">
        <div>
          <Label need>Rent for one day</Label>
          <span className="relative block">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-2xl font-bold" style={{ color: v("--ux-muted") }}>₹</span>
            <input value={f.day} onChange={(e) => set("day")(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
                   aria-label="Rent for one day in rupees" placeholder="0"
                   className="ux-sq min-h-[60px] w-full rounded-[16px] border ps-11 pe-4 text-3xl font-extrabold tabular-nums outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-brand-tint"), color: v("--ux-brand") }} />
          </span>
          <Picks options={DAY_PRICES.map((n) => `₹${n.toLocaleString("en-IN")}`)} value={day ? `₹${day.toLocaleString("en-IN")}` : ""}
                 label="Usual rents a day" onPick={(x) => set("day")(String(rupees(x)))} />
        </div>
        <div>
          <Label hint="optional">Rent for a whole week</Label>
          <Text value={f.week} onChange={(s) => set("week")(s.replace(/[^\d]/g, ""))} type="number" prefix="₹"
                label="Rent for a week in rupees" placeholder={day ? String(day * 5) : "A little less than 7 days"} />
          {day > 0 && (
            <Picks options={[`5 days' rent — ₹${(day * 5).toLocaleString("en-IN")}`, `6 days' rent — ₹${(day * 6).toLocaleString("en-IN")}`]}
                   value="" label="Weekly price ideas"
                   onPick={(x) => set("week")(String(day * (x.startsWith("5") ? 5 : 6)))} />
          )}
          <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
            A cheaper week brings longer rentals. It is never charged more than paying by the day.
          </p>
        </div>
        <div>
          <Label>Deposit</Label>
          <div role="radiogroup" aria-label="Deposit" className="flex flex-wrap gap-2">
            {DEPOSITS.map((n) => {
              const on = rupees(f.deposit) === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={on} onClick={() => set("deposit")(String(n))}
                        className="ux-press inline-flex min-h-[42px] items-center gap-1.5 rounded-full border px-4 text-xs font-bold"
                        style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                 color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                  {on && <Icons.Check className="h-3.5 w-3.5" />}{n ? `₹${n.toLocaleString("en-IN")}` : "None"}
                </button>
              );
            })}
          </div>
          <div className="mt-2 max-w-[220px]">
            <Text value={f.deposit === "0" ? "" : f.deposit} onChange={(s) => set("deposit")(s.replace(/[^\d]/g, "") || "0")}
                  type="number" prefix="₹" label="Deposit in rupees" placeholder="Other amount" />
          </div>
          <p className="mt-2 flex items-start gap-2 rounded-[12px] p-3 text-xs leading-relaxed" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
            <Icons.ShieldCheck className="mt-[1px] h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />
            A deposit she gets back keeps your thing safe. It is paid at pickup, never before — WomSakhi never holds it.
          </p>
        </div>
      </div>
    </Card>
  );

  const partDays = (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
        <I name="CalendarRange" className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Days and handover
      </h2>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Shortest rental (days)</Label>
            <Stepper value={f.minDays} onChange={set("minDays")} label="Shortest rental in days" min={1} presets={[1, 2, 3]} />
          </div>
          <div>
            <Label>Longest rental (days)</Label>
            <Stepper value={f.maxDays} onChange={set("maxDays")} label="Longest rental in days" min={1} presets={[7, 15, 30]} />
          </div>
        </div>
        <div>
          <Label>How does she get it?</Label>
          <div role="radiogroup" aria-label="Handover" className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(HANDOVER_LOOK) as Handover[]).map((h) => {
              const on = f.handover === h;
              return (
                <button key={h} type="button" role="radio" aria-checked={on} onClick={() => set("handover")(h)}
                        className="ux-press flex min-h-[56px] items-center gap-2.5 rounded-[14px] border px-3 text-start text-xs font-semibold"
                        style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                 color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                  <I name={HANDOVER_LOOK[h].icon} className="h-5 w-5 shrink-0" />
                  {HANDOVER_LOOK[h].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label hint="optional">Area</Label>
            <Text value={f.area} onChange={set("area")} label="Area or colony" max={80} placeholder="Your colony or locality" />
          </div>
          <div>
            <Label need>City</Label>
            <Text value={f.city} onChange={set("city")} label="City" max={60} placeholder="Your city or town" />
          </div>
        </div>
        <div>
          <Label hint="optional">Your rules</Label>
          <Picks options={[...RULES, ...f.rules.filter((r) => !RULES.includes(r))]} value={f.rules} multi label="Rules"
                 onPick={(r) => set("rules")(f.rules.includes(r) ? f.rules.filter((x) => x !== r) : f.rules.length >= 8 ? f.rules : [...f.rules, r])} />
          <div className="mt-2 flex gap-2">
            <Text value={ownRule} onChange={setOwnRule} label="Add your own rule" max={80} placeholder="Add your own rule" />
            <Btn variant="outline" icon="Plus" disabled={ownRule.trim().length < 3 || f.rules.length >= 8}
                 onClick={() => { set("rules")([...f.rules, ownRule.trim()]); setOwnRule(""); }}>Add</Btn>
          </div>
        </div>
        <div>
          <Label hint="optional">A few words about it</Label>
          <Picks options={ABOUT} value={ABOUT.filter((a) => f.about.includes(a))} multi label="Sentences to tap"
                 onPick={(a) => set("about")(f.about.includes(a) ? f.about.replace(a, "").replace(/\s{2,}/g, " ").trim() : `${f.about.trim()} ${a}`.trim())} />
          <div className="mt-2">
            <Area value={f.about} onChange={set("about")} max={800} rows={3} label="About it"
                  placeholder="Anything a renter should know — size, what comes with it, how to care for it." />
          </div>
        </div>
      </div>
    </Card>
  );

  const preview = <Preview f={f} cover={f.photos[0] || (f.category ? cats.pic(f.category) : "")} />;

  const submitBar = (
    <div className="mt-4 flex flex-col gap-2">
      {error && <p role="alert" className="rounded-[12px] p-3 text-xs font-semibold" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>{error}</p>}
      <Btn variant="primary" icon={editing ? "Check" : "KeyRound"} loading={busy} full onClick={() => void submit()}>
        {editing ? "Save changes" : "Put it up for rent"}
      </Btn>
    </div>
  );

  // A phone: four short steps, one at a time.
  if (narrow) {
    return (
      <div>
        <Steps steps={STEPS} at={at} done={reached} onGo={(n) => n <= reached && go(n)} />
        {at === 1 && partWhat}
        {at === 2 && partPrice}
        {at === 3 && partDays}
        {at === 4 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>This is how women will see it.</p>
            {preview}
          </div>
        )}
        {at < 4 ? (
          <div className="mt-4 flex flex-col gap-2">
            {error && <p role="alert" className="rounded-[12px] p-3 text-xs font-semibold" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>{error}</p>}
            <div className="flex gap-2 [&>*]:flex-1">
              {at > 1 && <Btn variant="outline" icon="ArrowLeft" onClick={() => go(at - 1)}>Back</Btn>}
              <Btn variant="primary" iconEnd="ArrowRight" onClick={next}>Next</Btn>
            </div>
          </div>
        ) : submitBar}
      </div>
    );
  }

  // A laptop: one page, with the card it becomes kept in view beside it.
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {partWhat}
        {partPrice}
        {partDays}
      </div>
      <div className="ux-sticky-col space-y-3">
        <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>
          <Icons.Eye className="h-3.5 w-3.5" /> How women will see it
        </p>
        {preview}
        {submitBar}
      </div>
    </div>
  );
}

/** The card exactly as the board will show it, and what a short rental would cost. */
function Preview({ f, cover }: { f: Form; cover: string }) {
  const day = rupees(f.day) * 100;
  const week = rupees(f.week) * 100;
  const deposit = rupees(f.deposit) * 100;
  const sample = Math.max(3, rupees(f.minDays));
  return (
    <Card pad={0} className="overflow-hidden">
      <div className="relative aspect-[4/3]" style={{ background: v("--ux-surface-2") }}>
        {cover
          ? <img src={cover} alt="" className="h-full w-full object-cover" />
          : <span className="grid h-full place-items-center" style={{ color: v("--ux-faint") }}><Icons.Camera className="h-10 w-10" /></span>}
        <span className="absolute start-2.5 top-2.5 rounded-full px-2.5 py-1 text-2xs font-bold" style={{ background: v("--ux-surface"), color: v("--ux-ink") }}>
          {CONDITION_LOOK[f.condition]}
        </span>
        {f.photos.length > 1 && (
          <span className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold text-white" style={{ background: "rgba(16,6,24,.7)" }}>
            <Icons.Images className="h-3 w-3" /> {f.photos.length}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug" style={{ color: v("--ux-ink") }}>{f.title.trim() || "Name of your thing"}</p>
        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{[f.category, f.area.trim() || f.city.trim()].filter(Boolean).join(" · ") || "Category · your area"}</p>
        <p className="mt-2 flex items-baseline gap-1">
          <b className="text-lg font-extrabold" style={{ color: v("--ux-brand") }}>{day ? formatMoney(day) : "₹—"}</b>
          <span className="text-xs" style={{ color: v("--ux-muted") }}>a day</span>
          {week > 0 && <span className="ms-auto text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>{formatMoney(week)} a week</span>}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
          <Icons.ShieldCheck className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} />
          {deposit ? `${formatMoney(deposit)} deposit, back on return` : "No deposit"}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
          <I name={HANDOVER_LOOK[f.handover].icon} className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} />
          {HANDOVER_LOOK[f.handover].label}
        </p>
        {day > 0 && (
          <p className="mt-3 rounded-[12px] px-3 py-2 text-xs font-semibold" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
            {sample} days = {formatMoney(rentFor({ price_day_minor: day, price_week_minor: week }, sample))}
            {week > 0 && <> · 7 days = {formatMoney(rentFor({ price_day_minor: day, price_week_minor: week }, 7))}</>}
          </p>
        )}
      </div>
    </Card>
  );
}

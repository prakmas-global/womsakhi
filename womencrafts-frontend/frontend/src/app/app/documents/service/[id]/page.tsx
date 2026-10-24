"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

import { apiSaveListing, apiUpdateListing } from "@/lib/shop-api";
import { messageFrom } from "@/lib/use-action";
import { settled, useAttemptKey } from "@/lib/idempotency";
import * as Icons from "@/components/ux/icons";

import {Back, Btn, Card, Chip, EmptyState, IconTile, SectionHead } from "@/components/ux/kit";
import { Field, TextInput, Toggle } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBusiness } from "@/components/ux/business";
import {
  RATE_KINDS as RAW_RATE_KINDS, SERVICE_CATEGORIES as RAW_SERVICE_CATEGORIES, rupees, type RateKind,
} from "@/components/ux/shop/data";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { Picks, Select } from "@/components/ux/kit/form";

const BLANK = {
  id: "new", name: "", category: "Tailoring", rate_minor: 0, rateKind: "per visit" as RateKind,
  where: "Either" as const, travelKm: 5, mins: 60, about: "",
  art: "/ux/art/scene-woman-vendor-handing-parcel.webp", live: false, booked: 0, rating: "—",
};

const WHERES = ["At her place", "At your place", "Either", "Online"] as const;

/** Tapped, not typed. */
const NAME_PICKS = [
  "Blouse stitched to measure", "Alterations", "Mehendi for both hands", "Threading and facial",
  "Home tuition, class 1 to 5", "Tiffin delivered daily", "Cake to order", "Childcare at home",
];
const ABOUT_PHRASES = [
  "Bring your own cloth", "Material included", "One fitting included", "I come to your home",
  "Book a day ahead", "Same-day work possible", "Pay after the work is done",
];
const RATE_PICKS = [200, 300, 500, 1000];
const MINUTES = [
  { value: "30", label: "30 minutes" }, { value: "45", label: "45 minutes" }, { value: "60", label: "1 hour" },
  { value: "90", label: "1½ hours" }, { value: "120", label: "2 hours" }, { value: "180", label: "3 hours" },
  { value: "240", label: "Half a day" }, { value: "480", label: "A full day" },
];
const KMS = ["2", "5", "10", "15", "25"];
const togglePhrase = (note: string, phrase: string) => {
  const parts = note.split(". ").map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
  return (parts.includes(phrase) ? parts.filter((x) => x !== phrase) : [...parts, phrase]).join(". ");
};
/** A saved value the list does not have is kept as a choice, never silently replaced. */
const withCurrent = <T extends string | { value: string; label: string }>(list: T[], value: string, make: (v: string) => T) =>
  list.some((o) => (typeof o === "string" ? o : o.value) === value) || !value ? list : [...list, make(value)];

/**
 * Listing a service — her time and skill, rather than a thing in a box.
 *
 * This is how most women on WomSakhi actually earn: beauty, tuition, tailoring
 * to measure, cooking, childcare. It is a separate screen from the product
 * editor because the questions are genuinely different — a service has a rate
 * and a place it happens, not stock. Forcing both into one form would ask a
 * tailor how many haircuts she has left.
 *
 * "How far will you travel" is asked plainly and stored in kilometres, because
 * a buyer three towns away booking a home visit wastes an afternoon that a
 * woman running a household cannot spare.
 */
export default function ServiceEditor({ params }: { params: Promise<{ id: string }> }) {
  const RATE_KINDS = useTranslated(RAW_RATE_KINDS);
  const SERVICE_CATEGORIES = useTranslated(RAW_SERVICE_CATEGORIES);
  const tr = useT();
  const { id } = use(params);
  const { data: biz, refetch } = useBusiness();
  const SERVICES = biz.services;
  const existing = SERVICES.find((s) => s.id === id);
  const isNew = id === "new";
  const base = existing ?? (isNew ? BLANK : null);

  /** The form as it should read for a given service. */
  const shapeOf = (b: typeof base) => ({
    name: b?.name ?? "",
    category: b?.category ?? "Tailoring",
    rupees: b && b.rate_minor ? String(Math.round(b.rate_minor / 100)) : "",
    rateKind: (b?.rateKind ?? "per visit") as RateKind,
    where: (b?.where ?? "Either") as (typeof WHERES)[number],
    travelKm: String(b?.travelKm ?? 5),
    mins: String(b?.mins ?? 60),
    about: existing?.about ?? "",
    live: b?.live ?? false,
  });

  const [form, setForm] = useState(() => shapeOf(base));

  /**
   * Fill the form once her service arrives.
   *
   * `useState(() => …)` runs on the first render only, and the listings are
   * still on their way then — so this editor opened blank on a service that
   * had a name, a rate and a description. Once per service, so it can never
   * overwrite what she has typed.
   */
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!base || filledFor.current === id) return;
    filledFor.current = id;
    setForm(shapeOf(base));
    // `shapeOf` closes over `existing`, which arrives with the same fetch as
    // `base`; listing it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, id]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const attempt = useAttemptKey("service");


  const put = (k: keyof typeof form, value: string) => { setForm((f) => ({ ...f, [k]: value })); setSaved(false); };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => put(k, e.target.value);

  /** Rupees in, paise out — converted once, at the point of entry. */
  const rate_minor = useMemo(() => {
    const n = Number(form.rupees.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [form.rupees]);

  const travels = form.where === "At your place" || form.where === "Either";

  const missing = useMemo(() => {
    const m: string[] = [];
    if (form.name.trim().length < 3) m.push("a name");
    if (rate_minor <= 0) m.push("what you charge");
    if (form.about.trim().length < 20) m.push("a description buyers can read");
    return m;
  }, [form, rate_minor]);

  /**
   * Save the service.
   *
   * This button used to set `saved` and nothing else. The screen said "Saved",
   * the woman closed it, and her price was exactly what it had been — which
   * she finds out when a buyer pays the old one.
   */
  async function save() {
    setBusy(true);
    setProblem("");
    const body = {
      kind: "service" as const,
      title: form.name.trim(),
      desc: form.about.trim(),
      price_minor: rate_minor,
      rate: form.rateKind,
      category: form.category,
      place: form.where,
      travels_km: travels ? Number(form.travelKm) || 0 : 0,
    };
    try {
      if (isNew) await apiSaveListing(body);
      else await apiUpdateListing(id, body);
      attempt.settle();
      setSaved(true);
      refetch();
    } catch (e) {
      if (settled(e)) attempt.settle();
      setProblem(messageFrom(e, "That did not save. Your service has not changed — try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  if (!base) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("documentsService.thatServiceIsNotHere")}
            body={tr("documentsProduct.itMayHaveBeenRemovedFrom")}
            action={<Btn href="/app/documents" variant="primary" iconEnd="ArrowRight">{tr("documentsService.yourBusiness")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  return (
    <HomeShell
      skeleton="form"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("documentsService.whatABuyerSees")} sub={tr("documentsService.updatesAsYouType")} />
            <div className="ux-sq overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--ux-line)" }}>
              <div className="h-[120px] overflow-hidden" style={{ background: "var(--ux-tint-pink)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={base.art} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-3.5">
                <p className="text-sm font-semibold" style={{ color: form.name ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {form.name || "What you do"}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums"
                   style={{ color: rate_minor ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {rate_minor ? `${rupees(rate_minor)} ${form.rateKind}` : "₹— "}
                </p>
                <p className="mt-1.5 text-xs leading-snug"
                   style={{ color: form.about ? "var(--ux-muted)" : "var(--ux-faint)" }}>
                  {form.about || "Say what is included, and what a buyer should have ready."}
                </p>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs" style={{ color: "var(--ux-muted)" }}>
                  <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3 w-3" /> {form.where}</span>
                  {travels && <span>up to {form.travelKm} km</span>}
                  <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3 w-3" /> about {form.mins} min</span>
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("documentsService.beforeItGoesLive")} />
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
                <Icons.CheckCheck className="h-[16px] w-[16px]" />{tr("documentsService.readyToPublish")}</p>
            )}
            <div className="mt-4">
              <Btn variant="primary" full icon={busy ? "Loader" : "Check"}
                   disabled={busy || missing.length > 0}
                   onClick={() => void save()}>
                {isNew ? tr("documentsService.listThisService")
              : tr("documentsService.saveChanges")}
              </Btn>
            </div>
            {/* "Saved." is now only said when the server said so. */}
            {saved && !problem && (
              <p className="ux-slide-up mt-2.5 text-center text-xs" style={{ color: "var(--ux-green-ink)" }}>Saved.</p>
            )}
            {problem && (
              <p role="alert" className="ux-slide-up mt-2.5 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}
          </Card>

          {!isNew && existing && (
            <Card>
              <SectionHead title={tr("documentsService.howItIsDoing")} />
              <div className="space-y-3.5">
                {[[`${existing.booked}`, "Times booked", "CalendarCheck", "--ux-tint-violet", "--ux-violet"],
                  [existing.rating, "Average rating", "Star", "--ux-tint-orange", "--ux-amber"]].map(([v, label, icon, tint, ink]) => (
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
      <Back to="/app/documents" label={tr("documentsService.yourShop")} className="mb-4" />

      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>
        {isNew ? "Offer a service" : form.name || "Edit service"}
      </h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        {isNew
          ? tr("documentsService.anythingYouDoWithYourHands")
              : tr("documentsService.changesReachBuyersStraightAway")}
      </p>

      <Card className="mb-[16px]">
        <SectionHead title={tr("documentsService.whatYouDo")} />
        <div className="space-y-4">
          <Field label={tr("documentsService.nameItTheWaySomeoneWould")}
                 hint={tr("documentsService.blouseStitchedToMeasureNotTailorin")}>
            <TextInput value={form.name} onChange={set("name")} placeholder={tr("documentsService.blouseStitchedToMeasure")} />
            {!form.name.trim() && <Picks options={NAME_PICKS} value={form.name} onPick={(x) => put("name", x)} label="Quick names" />}
          </Field>

          <div>
            <span className="block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("documentsService.whatKindOfWork")}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <Chip key={c} selected={form.category === c}
                      onClick={() => { setForm((f) => ({ ...f, category: c })); setSaved(false); }}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <Field label={tr("documentsService.describeIt")} hint={tr("documentsService.whatIsIncludedAndWhatA")}>
            <Picks options={ABOUT_PHRASES} value={form.about.split(". ")} multi label="Tap to add to the description"
                   onPick={(x) => put("about", togglePhrase(form.about, x))} />
            <div className="mt-2.5" />
            <textarea
              value={form.about}
              onChange={(e) => { setForm((f) => ({ ...f, about: e.target.value })); setSaved(false); }}
              rows={4}
              aria-label={tr("documentsService.describeIt2")}
              className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-[16px]">
        <SectionHead title={tr("documentsService.whatYouCharge")} sub={tr("documentsService.buyersSeeThisExactlyNothingIs")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("documentsService.yourRate")} hint={tr("documentsService.inRupees")}>
            <TextInput value={form.rupees} onChange={set("rupees")} placeholder="450" inputMode="numeric" />
            <Picks options={RATE_PICKS.map((n) => `₹${n.toLocaleString("en-IN")}`)}
                   value={form.rupees ? `₹${Number(form.rupees).toLocaleString("en-IN")}` : ""}
                   onPick={(x) => put("rupees", x.replace(/[^\d]/g, ""))} label="Usual rates" />
          </Field>
          <div>
            <span className="block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>Charged</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {RATE_KINDS.map((k) => (
                <Chip key={k} selected={form.rateKind === k}
                      onClick={() => { setForm((f) => ({ ...f, rateKind: k })); setSaved(false); }}>
                  {k}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <Field label={tr("documentsService.howLongItUsuallyTakes")} hint={tr("documentsService.inMinutesBuyersPlanTheirDay")}>
          <Select value={form.mins} onChange={(x) => put("mins", x)} label={tr("documentsService.howLongItUsuallyTakes")}
                  options={withCurrent(MINUTES, form.mins, (v) => ({ value: v, label: `${v} minutes` }))} />
        </Field>
      </Card>

      <Card>
        <SectionHead title={tr("documentsService.whereItHappens")} />
        <div className="ux-deck space-y-2.5">
          {WHERES.map((w, i) => {
            const on = form.where === w;
            return (
              <button
                key={w}
                onClick={() => { setForm((f) => ({ ...f, where: w })); setSaved(false); }}
                aria-pressed={on}
                className="ux-i ux-sq flex w-full items-center gap-3.5 rounded-[12px] border p-3.5 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <IconTile icon={w === "Online" ? "Video" : w === "At your place" ? "Bike" : "Home"}
                          tint="--ux-tint-lilac" ink="--ux-brand" size={40} radius={11} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{w}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--ux-muted)" }}>
                    {w === "At her place" ? "She comes to you"
                      : w === "At your place" ? "You travel to her"
                      : w === "Either" ? tr("documentsService.whicheverSuitsAgreedWhenSheBooks")
              : tr("documentsService.byVideoCall")}
                  </span>
                </span>
                {on && <Icons.CheckCircle2 className="ux-pop h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-brand)" }} />}
              </button>
            );
          })}
        </div>

        {/* Asked plainly, in kilometres. A buyer three towns away booking a home
            visit wastes an afternoon a woman running a household cannot spare. */}
        {travels && (
          <div className="ux-slide-up mt-4">
            <Field label={tr("documentsService.howFarWillYouTravel")} hint={tr("documentsService.inKilometresFromWhereYouLive")}>
              <Select value={form.travelKm} onChange={(x) => put("travelKm", x)} label={tr("documentsService.howFarWillYouTravel")}
                      options={withCurrent(KMS, form.travelKm, (v) => v).map((k) => ({ value: k, label: `Up to ${k} km` }))} />
            </Field>
          </div>
        )}

        <div className="mt-4 border-t pt-2" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle
            on={form.live}
            onChange={(v) => { setForm((f) => ({ ...f, live: v })); setSaved(false); }}
            label={tr("documentsService.showThisToBuyers")}
            whenOn="Women near you can find and book it."
            whenOff="Only you can see it. Turn it back on any time."
          />
        </div>
      </Card>
    </HomeShell>
  );
}

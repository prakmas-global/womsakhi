"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

import { apiSaveListing, apiUpdateListing } from "@/lib/shop-api";
import { messageFrom } from "@/lib/use-action";
import { settled, useAttemptKey } from "@/lib/idempotency";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, Chip, EmptyState, IconTile, SectionHead } from "@/components/ux/kit";
import { Field, TextInput, Toggle } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBusiness } from "@/components/ux/business";
import {
  RATE_KINDS, SERVICE_CATEGORIES, rupees, type RateKind,
} from "@/components/ux/shop/data";

const BLANK = {
  id: "new", name: "", category: "Tailoring", rate_minor: 0, rateKind: "per visit" as RateKind,
  where: "Either" as const, travelKm: 5, mins: 60, about: "",
  art: "/ux/art/scene-woman-vendor-handing-parcel.webp", live: false, booked: 0, rating: "—",
};

const WHERES = ["At her place", "At your place", "Either", "Online"] as const;

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


  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

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
            title="That service is not here"
            body="It may have been removed from your shop."
            action={<Btn href="/app/documents" variant="primary" iconEnd="ArrowRight">Your business</Btn>}
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
            <SectionHead title="What a buyer sees" sub="Updates as you type" />
            <div className="ux-sq overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--ux-line)" }}>
              <div className="h-[120px] overflow-hidden" style={{ background: "var(--ux-tint-pink)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={base.art} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-3.5">
                <p className="text-[0.875rem] font-semibold" style={{ color: form.name ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {form.name || "What you do"}
                </p>
                <p className="mt-1 text-[1.125rem] font-bold tabular-nums"
                   style={{ color: rate_minor ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                  {rate_minor ? `${rupees(rate_minor)} ${form.rateKind}` : "₹— "}
                </p>
                <p className="mt-1.5 text-[0.75rem] leading-snug"
                   style={{ color: form.about ? "var(--ux-muted)" : "var(--ux-faint)" }}>
                  {form.about || "Say what is included, and what a buyer should have ready."}
                </p>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>
                  <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3 w-3" /> {form.where}</span>
                  {travels && <span>up to {form.travelKm} km</span>}
                  <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3 w-3" /> about {form.mins} min</span>
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead title="Before it goes live" />
            {missing.length ? (
              <ul className="space-y-2.5">
                {missing.map((m) => (
                  <li key={m} className="flex items-center gap-2.5 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
                    <Icons.Circle className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                    Still needs {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--ux-green-ink)" }}>
                <Icons.CheckCheck className="h-[16px] w-[16px]" /> Ready to publish.
              </p>
            )}
            <div className="mt-4">
              <Btn variant="primary" full icon={busy ? "Loader" : "Check"}
                   disabled={busy || missing.length > 0}
                   onClick={() => void save()}>
                {isNew ? "List this service" : "Save changes"}
              </Btn>
            </div>
            {/* "Saved." is now only said when the server said so. */}
            {saved && !problem && (
              <p className="ux-slide-up mt-2.5 text-center text-[0.75rem]" style={{ color: "var(--ux-green-ink)" }}>Saved.</p>
            )}
            {problem && (
              <p role="alert" className="ux-slide-up mt-2.5 text-[0.8125rem] leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}
          </Card>

          {!isNew && existing && (
            <Card>
              <SectionHead title="How it is doing" />
              <div className="space-y-3.5">
                {[[`${existing.booked}`, "Times booked", "CalendarCheck", "--ux-tint-violet", "--ux-violet"],
                  [existing.rating, "Average rating", "Star", "--ux-tint-orange", "--ux-amber"]].map(([v, label, icon, tint, ink]) => (
                  <div key={label} className="ux-hov flex items-center gap-3">
                    <IconTile icon={icon} tint={tint} ink={ink} size={38} />
                    <div className="min-w-0">
                      <p className="text-[1.125rem] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                      <p className="mt-1 truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/documents"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[0.8125rem] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Your shop
      </Link>

      <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>
        {isNew ? "Offer a service" : form.name || "Edit service"}
      </h1>
      <p className="mb-[20px] mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
        {isNew
          ? "Anything you do with your hands or your time — stitching, mehendi, tuition, cooking, childcare."
          : "Changes reach buyers straight away."}
      </p>

      <Card className="mb-[16px]">
        <SectionHead title="What you do" />
        <div className="space-y-4">
          <Field label="Name it the way someone would ask for it"
                 hint="“Blouse stitched to measure”, not “Tailoring services”.">
            <TextInput value={form.name} onChange={set("name")} placeholder="Blouse stitched to measure" />
          </Field>

          <div>
            <span className="block text-[0.8125rem] font-semibold" style={{ color: "var(--ux-ink)" }}>What kind of work</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <Chip key={c} selected={form.category === c}
                      onClick={() => { setForm((f) => ({ ...f, category: c })); setSaved(false); }}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Describe it" hint="What is included, and what a buyer should have ready before you arrive.">
            <textarea
              value={form.about}
              onChange={(e) => { setForm((f) => ({ ...f, about: e.target.value })); setSaved(false); }}
              rows={4}
              aria-label="Describe it"
              className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-[0.875rem] leading-relaxed outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-[16px]">
        <SectionHead title="What you charge" sub="Buyers see this exactly — nothing is added on top" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Your rate" hint="In rupees.">
            <TextInput value={form.rupees} onChange={set("rupees")} placeholder="450" inputMode="numeric" />
          </Field>
          <div>
            <span className="block text-[0.8125rem] font-semibold" style={{ color: "var(--ux-ink)" }}>Charged</span>
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
        <Field label="How long it usually takes" hint="In minutes. Buyers plan their day around this.">
          <TextInput value={form.mins} onChange={set("mins")} placeholder="60" inputMode="numeric" />
        </Field>
      </Card>

      <Card>
        <SectionHead title="Where it happens" />
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
                  <span className="block text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{w}</span>
                  <span className="mt-0.5 block text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                    {w === "At her place" ? "She comes to you"
                      : w === "At your place" ? "You travel to her"
                      : w === "Either" ? "Whichever suits, agreed when she books"
                      : "By video call"}
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
            <Field label="How far will you travel" hint="In kilometres from where you live. Buyers further away will not see this.">
              <TextInput value={form.travelKm} onChange={set("travelKm")} placeholder="5" inputMode="numeric" />
            </Field>
          </div>
        )}

        <div className="mt-4 border-t pt-2" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle
            on={form.live}
            onChange={(v) => { setForm((f) => ({ ...f, live: v })); setSaved(false); }}
            label="Show this to buyers"
            whenOn="Women near you can find and book it."
            whenOff="Only you can see it. Turn it back on any time."
          />
        </div>
      </Card>
    </HomeShell>
  );
}

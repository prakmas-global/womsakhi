"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, v } from "@/components/ux/kit";
import { ChipRow } from "@/components/ux/learning/native";
import { PicChip, useMasterPictures } from "@/components/ux/media/MasterPictures";
import { MediaGrid } from "@/components/ux/media/MediaCard";
import { PlaceMark } from "@/components/ux/nav/Place";
import { RentCard } from "@/components/ux/rent/board/RentCard";
import { RENT_CATEGORY_LABELS } from "@/components/ux/rent/board/look";
import { BookingCard } from "@/components/ux/rent/bookings/BookingCard";
import { RentSafety } from "@/components/ux/rent/bookings/parts";
import { nextFor } from "@/components/ux/rent/bookings/look";
import { useResource } from "@/lib/use-resource";
import { apiMyWorkProfile } from "@/lib/work-api";
import { apiRentalBookings, apiRentals, type Booking, type RentalCard } from "@/lib/rentals-api";

/**
 * Rent & borrow — the board (backend: routes/rentals.py).
 *
 * Every woman here is verified, which is what makes lending a lehenga or a
 * big cooker to a stranger thinkable at all. The board opens on its own
 * picture with the search she came for and the other way in — renting her
 * own things out — beside it. Her own town comes first (the server sorts
 * by the city it is given); a category is a picture to tap.
 */

const HOW = [
  { icon: "CalendarRange", title: "Pick your days", body: "Tap the first and last day on its calendar." },
  { icon: "MessageCircleQuestion", title: "She says yes", body: "The owner confirms — the days are held for you." },
  { icon: "HandCoins", title: "Pay at pickup", body: "Rent and deposit to her, in person or UPI. Never before." },
  { icon: "Undo2", title: "Return it", body: "Give it back on time and get your deposit back." },
];

export default function RentBoardPage() {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const cats = useMasterPictures("rental_categories", RENT_CATEGORY_LABELS);

  // Search as she types, once she pauses.
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const work = useResource(useCallback((s: AbortSignal) => apiMyWorkProfile(s).catch(() => null), []), null);
  const city = work.data?.city ?? "";

  const list = useResource(
    useCallback((s: AbortSignal) => apiRentals({ q, category, city }, s), [q, category, city]),
    [] as RentalCard[],
  );
  const mine = useResource(useCallback((s: AbortSignal) => apiRentals({ mine: true }, s), []), [] as RentalCard[]);
  const bookings = useResource(useCallback((s: AbortSignal) => apiRentalBookings("all", s), []), [] as Booking[]);
  const waiting = bookings.data.filter((b) => nextFor(b)?.urgent);

  const near = city ? list.data.filter((c) => c.city.toLowerCase() === city.toLowerCase()) : [];
  const elsewhere = city ? list.data.filter((c) => c.city.toLowerCase() !== city.toLowerCase()) : list.data;
  const filtering = !!(q || category);

  const rail = (
    <div className="space-y-4">
      <Card>
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
          <Icons.KeyRound className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Earn from what you own
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          The wedding lehenga worn once, the big biryani handi, the sewing machine that sits idle — rent them to women near you.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Btn href="/app/rent/new" icon="Plus" full>Rent something out</Btn>
          {mine.data.length > 0 && (
            <Btn href="/app/rent/mine" variant="outline" icon="Package" full>
              My things for rent · {mine.data.length}
            </Btn>
          )}
        </div>
      </Card>
      <RentSafety />
    </div>
  );

  return (
    <HomeShell rail={rail}>
      {/* `data-page-hero`: this is the screen's banner, so the section banner steps aside. */}
      <section data-banner data-page-hero className="relative mb-5 overflow-hidden rounded-[22px]" style={{ background: v("--ux-brand-900") }}>
        <img src="/ux/art/circle-sharing-help.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 max-lg:hidden"
              style={{ background: "linear-gradient(90deg,rgba(55,20,40,.96),rgba(55,20,40,.86) 40%,rgba(55,20,40,.25) 72%,transparent 90%)" }} />
        <span aria-hidden className="absolute inset-0 lg:hidden"
              style={{ background: "linear-gradient(180deg,rgba(55,20,40,.55),rgba(55,20,40,.95))" }} />
        <div className="relative z-[1] flex max-w-[580px] flex-col gap-3 p-5 text-white lg:p-7">
          <div className="flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title min-w-0 text-3xl font-extrabold leading-[1.08] tracking-[-0.02em]" style={{ color: "#fff" }}>
              Rent &amp; borrow
            </h1>
          </div>
          <p className="max-w-[440px] text-sm leading-relaxed opacity-95">
            Borrow what you need for a few days from verified women near you — or earn from the things you own.
          </p>
          <label className="flex h-[52px] items-center gap-2.5 rounded-[16px] ps-4 pe-1.5 shadow-lg" style={{ background: v("--ux-surface"), color: v("--ux-ink") }}>
            <Icons.Search className="h-5 w-5 shrink-0" style={{ color: v("--ux-brand") }} />
            <input value={typed} onChange={(e) => setTyped(e.target.value)} type="search" maxLength={60}
                   placeholder="Lehenga, pram, cooker, sewing machine…" aria-label="Search things to rent"
                   className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: v("--ux-ink") }} />
            {typed && (
              <button type="button" onClick={() => { setTyped(""); setQ(""); }} aria-label="Clear search"
                      className="ux-press grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color: v("--ux-muted") }}>
                <Icons.X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-2 max-lg:[&>*:nth-child(-n+2)]:w-full">
            <Btn href="/app/rent/new" icon="Plus">Rent something out</Btn>
            <Link href="/app/rent/bookings"
                  className="ux-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 text-xs font-bold"
                  style={{ borderColor: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.14)", color: "#fff" }}>
              <Icons.CalendarCheck className="h-4 w-4" /> My rentals
              {waiting.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]" style={{ background: "#fff", color: v("--ux-brand") }}>
                  {waiting.length}
                </span>
              )}
            </Link>
            <span className="inline-flex min-h-[36px] w-full items-center gap-1.5 text-xs font-semibold opacity-90 lg:w-auto">
              <Icons.BadgeCheck className="h-4 w-4" /> Every woman here is verified
            </span>
          </div>
        </div>
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="rent-waiting" className="mb-5">
          <h2 id="rent-waiting" className="mb-2.5 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
            <I name="Zap" className="h-4 w-4" style={{ color: v("--ux-brand") }} /> Needs you now
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {waiting.slice(0, 2).map((b) => <BookingCard key={b.id} b={b} />)}
          </div>
          {waiting.length > 2 && (
            <Link href="/app/rent/bookings" className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: v("--ux-brand") }}>
              See all {waiting.length} <Icons.ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </section>
      )}

      <ChipRow label="What kind of thing" pad={20} className="mb-5">
        <PicChip src="/ux/art/circle-sharing-help.webp" selected={!category} onClick={() => setCategory("")}>Everything</PicChip>
        {cats.labels.map((c) => (
          <PicChip key={c} src={cats.pic(c)} selected={category === c} onClick={() => setCategory(category === c ? "" : c)}>{c}</PicChip>
        ))}
      </ChipRow>

      {list.source === "loading" && !list.data.length ? (
        <MediaGrid>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="ux-skeleton block h-[300px] rounded-[18px]" />)}</MediaGrid>
      ) : list.source === "error" && !list.data.length ? (
        <Card>
          <EmptyState icon="WifiOff" title="The board did not load" body="Check your connection and try again."
                      action={<Btn icon="RotateCw" variant="outline" onClick={list.refetch}>Try again</Btn>} />
        </Card>
      ) : !list.data.length ? (
        <Card>
          <EmptyState icon="KeyRound"
                      title={filtering ? "Nothing like that yet" : "Be the first to rent something out"}
                      body={filtering
                        ? "Try another word or category — or put up one of your own things for others."
                        : "No one near you has put anything up yet. Your lehenga, pram or big cooker could be the first."}
                      action={<div className="flex flex-wrap justify-center gap-2">
                        {filtering && <Btn variant="outline" icon="X" onClick={() => { setTyped(""); setQ(""); setCategory(""); }}>Clear search</Btn>}
                        <Btn href="/app/rent/new" icon="Plus">Rent something out</Btn>
                      </div>} />
        </Card>
      ) : (
        <div className="space-y-7">
          {near.length > 0 && (
            <section aria-labelledby="rent-near">
              <h2 id="rent-near" className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
                <I name="MapPin" className="h-4 w-4" style={{ color: v("--ux-brand") }} /> In {city}
                <span className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>{near.length}</span>
              </h2>
              <MediaGrid>{near.map((c) => <RentCard key={c.id} item={c} />)}</MediaGrid>
            </section>
          )}
          {elsewhere.length > 0 && (
            <section aria-labelledby="rent-all">
              <h2 id="rent-all" className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
                <I name={near.length ? "Globe" : "LayoutGrid"} className="h-4 w-4" style={{ color: v("--ux-brand") }} />
                {near.length ? "In other places" : filtering ? "What we found" : "Up for rent"}
                <span className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>{elsewhere.length}</span>
              </h2>
              <MediaGrid>{elsewhere.map((c) => <RentCard key={c.id} item={c} />)}</MediaGrid>
            </section>
          )}
        </div>
      )}

      <section aria-labelledby="rent-how" className="mt-8">
        <h2 id="rent-how" className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
          <I name="Route" className="h-4 w-4" style={{ color: v("--ux-brand") }} /> How renting works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {HOW.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-[18px] border p-3.5" style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: "var(--ux-pic-ground)" }}>
                <I name={s.icon} className="h-5 w-5" />
                <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-extrabold"
                      style={{ background: v("--ux-surface"), color: v("--ux-brand"), boxShadow: "0 0 0 2px var(--ux-brand-tint)" }}>{i + 1}</span>
              </span>
              <span className="min-w-0">
                <b className="block text-sm" style={{ color: v("--ux-ink") }}>{s.title}</b>
                <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-start gap-2 text-xs" style={{ color: v("--ux-muted") }}>
          <Icons.BookOpen className="mt-[1px] h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />
          The rent you pay or earn goes into My Money by itself once it is returned.
        </p>
      </section>
    </HomeShell>
  );
}

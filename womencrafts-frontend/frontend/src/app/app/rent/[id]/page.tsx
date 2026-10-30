"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Avatar, Back, Btn, Card, EmptyState, I, ScreenSkeleton, v } from "@/components/ux/kit";
import { Area, Picks } from "@/components/ux/kit/form";
import { formatMoney } from "@/components/ux/kit/money";
import { MessageHer } from "@/components/ux/MessageHer";
import { toast } from "@/components/ux/mobile/Toast";
import { DateRange, nice } from "@/components/ux/rent/board/DateRange";
import { itemArt, place } from "@/components/ux/rent/board/look";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  CONDITION_LOOK, HANDOVER_LOOK, apiBookRental, apiPauseRental, apiRental, apiRentalQuote, clashes, daysBetween, rentFor,
  type Quote, type RentalItem,
} from "@/lib/rentals-api";

/**
 * One thing to rent (backend: routes/rentals.py GET /rentals/{id}).
 *
 * Photos first and big — she is deciding whether to wear it at her sister's
 * wedding. Then the one box that matters: the calendar with the taken days
 * crossed out, what those days cost, what she pays at pickup, and the button.
 * On a laptop that box stays in view beside the details; on a phone it comes
 * straight after the photos. The owner sees her own controls instead.
 */

const NOTE_PICKS = ["For a wedding", "For a function at home", "For travel", "I can pick it up myself", "Can you bring it?"];

export default function RentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const item = useResource(useCallback((s: AbortSignal) => apiRental(id, s), [id]), null as RentalItem | null);

  if (item.source === "loading" && !item.data) return <HomeShell wide skeleton="detail"><ScreenSkeleton shape="detail" /></HomeShell>;
  if (!item.data) {
    return (
      <HomeShell wide>
        <Back to="/app/rent" label="Rent & borrow" className="mb-4" />
        <Card>
          <EmptyState icon="PackageX" title="This is not available any more"
                      body="She may have taken it down. There are other things to rent near you."
                      action={<Btn href="/app/rent" icon="Search">See what you can rent</Btn>} />
        </Card>
      </HomeShell>
    );
  }
  return <ItemView key={item.data.id} it={item.data} reload={item.refetch} />;
}

function ItemView({ it, reload }: { it: RentalItem; reload: () => void }) {
  const photos = it.photos.length ? it.photos : [itemArt(it.title, it.category, it.id)];
  const [shown, setShown] = useState(0);

  return (
    <HomeShell wide>
      <Back to="/app/rent" label="Rent & borrow" className="mb-4" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* 1 · photos and what it is */}
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-[22px]" style={{ background: v("--ux-surface-2") }}>
            <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[460px]">
              <img src={photos[shown]} alt={it.title} className="h-full w-full object-cover" />
              <span className="absolute start-3 top-3 rounded-full px-2.5 py-1 text-2xs font-bold shadow-sm"
                    style={{ background: "rgba(255,255,255,.92)", color: "#2a1a24" }}>{it.category}</span>
              {photos.length > 1 && (
                <>
                  <button type="button" aria-label="Previous photo" onClick={() => setShown((shown - 1 + photos.length) % photos.length)}
                          className="ux-press absolute start-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
                          style={{ color: v("--ux-ink") }}><Icons.ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" aria-label="Next photo" onClick={() => setShown((shown + 1) % photos.length)}
                          className="ux-press absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
                          style={{ color: v("--ux-ink") }}><Icons.ChevronRight className="h-5 w-5" /></button>
                  <span className="absolute bottom-3 end-3 rounded-full px-2.5 py-1 text-2xs font-bold text-white" style={{ background: "rgba(16,6,24,.7)" }}>
                    {shown + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
              {photos.map((p, i) => (
                <button key={p} type="button" role="tab" aria-selected={i === shown} aria-label={`Photo ${i + 1}`} onClick={() => setShown(i)}
                        className="ux-press h-16 w-16 shrink-0 overflow-hidden rounded-[12px]"
                        style={{ boxShadow: i === shown ? "0 0 0 3px var(--ux-brand)" : "none", opacity: i === shown ? 1 : 0.75 }}>
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div>
            <h1 className="ux-screen-title text-2xl font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>{it.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Tagline icon="Sparkles">{CONDITION_LOOK[it.condition]}</Tagline>
              {(it.area || it.city) && <Tagline icon="MapPin">{place(it.area, it.city)}</Tagline>}
              <Tagline icon={HANDOVER_LOOK[it.handover].icon}>{HANDOVER_LOOK[it.handover].label}</Tagline>
              {it.times_rented > 0 && <Tagline icon="Repeat">Rented {it.times_rented} {it.times_rented === 1 ? "time" : "times"}</Tagline>}
            </div>
          </div>
        </div>

        {/* 2 · the box: book it, or (hers) manage it */}
        <aside className="ux-sticky-col space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {it.mine ? <OwnerBox it={it} reload={reload} /> : <BookBox it={it} />}
        </aside>

        {/* 3 · the details */}
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar src={it.owner.avatar || null} name={it.owner.first_name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: v("--ux-ink") }}>
                  {it.mine ? "You" : it.owner.first_name}
                  <Icons.BadgeCheck className="h-4 w-4" style={{ color: v("--ux-brand") }} aria-label="Verified" />
                </p>
                <p className="text-xs" style={{ color: v("--ux-muted") }}>
                  {it.owner.stars ? `★ ${it.owner.stars} · ${it.owner.reviews} ${it.owner.reviews === 1 ? "review" : "reviews"}` : "New on Rent & borrow"}
                </p>
              </div>
              {!it.mine && (
                <MessageHer userId={it.owner.id} name={it.owner.first_name} about={`Rent: ${it.title}`}
                            phrases={["Is it free on my dates?", "Can I see it before?", "Where do I pick it up?", "What size is it?"]} />
              )}
            </div>
          </Card>

          {it.about && (
            <Card>
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
                <Icons.Info className="h-4 w-4" style={{ color: v("--ux-brand") }} /> About it
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{it.about}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              <Icons.ListChecks className="h-4 w-4" style={{ color: v("--ux-brand") }} /> Good to know
            </h2>
            <ul className="grid gap-2 text-sm sm:grid-cols-2" style={{ color: v("--ux-ink-2") }}>
              <Fact icon="CalendarRange">
                {it.min_days > 1 ? `${it.min_days} to ${it.max_days} days` : `Up to ${it.max_days} days`}
              </Fact>
              <Fact icon="ShieldCheck">{it.deposit_minor ? `${formatMoney(it.deposit_minor)} deposit, back on return` : "No deposit"}</Fact>
              {it.price_week_minor > 0 && <Fact icon="Tag">{formatMoney(it.price_week_minor)} for a whole week</Fact>}
              <Fact icon={HANDOVER_LOOK[it.handover].icon}>{HANDOVER_LOOK[it.handover].label}</Fact>
              {it.rules.map((r) => <Fact key={r} icon="CircleCheck">{r}</Fact>)}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              <Icons.Star className="h-4 w-4" style={{ color: v("--ux-brand") }} /> What renters said
            </h2>
            {it.reviews.length ? (
              <ul className="space-y-3">
                {it.reviews.map((r, i) => (
                  <li key={i} className="border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: v("--ux-line") }}>
                    <p className="flex items-center gap-2 text-xs" style={{ color: v("--ux-muted") }}>
                      <span style={{ color: "#f5a524" }} aria-label={`${r.stars} stars`}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                      <b style={{ color: v("--ux-ink") }}>{r.by}</b> · {r.on}
                    </p>
                    {r.praise.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.praise.map((p) => (
                          <span key={p} className="rounded-full px-2 py-0.5 text-2xs font-semibold" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{p}</span>
                        ))}
                      </div>
                    )}
                    {r.text && <p className="mt-1.5 text-sm" style={{ color: v("--ux-ink-2") }}>“{r.text}”</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: v("--ux-muted") }}>No reviews yet — renters say how it went once it is back.</p>
            )}
          </Card>
        </div>
      </div>
    </HomeShell>
  );
}

function Tagline({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-3 font-semibold" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
      <I name={icon} className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} /> {children}
    </span>
  );
}

function Fact({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <I name={icon} className="mt-[2px] h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/* ── her side: pick days, see the cost, ask ─────────────────────────── */

/** Add a tapped phrase to the note, or take it back out. */
const toggleLine = (note: string, p: string) => {
  const parts = note.split(/\.\s*/).map((x) => x.trim()).filter(Boolean);
  return (parts.includes(p) ? parts.filter((x) => x !== p) : [...parts, p]).join(". ");
};

function BookBox({ it }: { it: RentalItem }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const picked = !!(start && end);
  // The server's word on these dates; the local sum shows while it is on its way.
  const quote = useResource(
    useCallback((s: AbortSignal) => (start && end ? apiRentalQuote(it.id, start, end, s) : Promise.resolve(null)), [it.id, start, end]),
    null as Quote | null,
  );
  const days = picked ? daysBetween(start, end) : 0;
  const rent = quote.data?.rent_minor ?? (picked ? rentFor(it, days) : 0);
  const saved = quote.data?.saved_by_week_minor ?? 0;
  const problem = picked
    ? (quote.data && !quote.data.ok ? quote.data.problem
      : days < it.min_days ? `She rents this for at least ${it.min_days} days.`
      : clashes(start, end, it.busy) ? "Someone has it on some of those days. Pick other days." : "")
    : "";

  const ask = async () => {
    if (!picked || problem) return;
    setBusy(true); setError("");
    try {
      const b = await apiBookRental(it.id, start, end, note.trim());
      toast(`Asked ${it.owner.first_name} — you will hear back soon`, { tone: "success" });
      router.push(`/app/rent/bookings/${b.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "That did not send. Check your connection and try again."));
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <p className="flex items-baseline gap-1.5">
          <b className="text-2xl font-extrabold" style={{ color: v("--ux-brand") }}>{formatMoney(it.price_day_minor)}</b>
          <span className="text-sm" style={{ color: v("--ux-muted") }}>a day</span>
          {it.price_week_minor > 0 && (
            <span className="ms-auto text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>{formatMoney(it.price_week_minor)} a week</span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
          <Icons.ShieldCheck className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} />
          {it.deposit_minor ? `${formatMoney(it.deposit_minor)} deposit — you get it back` : "No deposit"}
        </p>

        {it.my_bookings.length > 0 && (
          <Link href={`/app/rent/bookings/${it.my_bookings[0]}`}
                className="ux-press mt-3 flex items-center gap-2 rounded-[14px] p-3 text-xs font-bold"
                style={{ background: "var(--ux-pic-ground)", color: "#fff" }}>
            <Icons.CalendarCheck className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">You have already asked for this — see your request</span>
            <Icons.ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        <div className="mt-4 border-t pt-4" style={{ borderColor: v("--ux-line") }}>
          <DateRange busy={it.busy} minDays={it.min_days} maxDays={it.max_days} start={start} end={end}
                     onChange={(s, e) => { setStart(s); setEnd(e); setError(""); }} />
        </div>

        {picked && (
          <div className="mt-4 rounded-[16px] border p-3.5" style={{ borderColor: v("--ux-line") }}>
            <ul className="space-y-1.5 text-sm" style={{ color: v("--ux-ink-2") }}>
              <li className="flex justify-between gap-2">
                <span>Rent · {days} {days === 1 ? "day" : "days"}</span>
                <b className="tabular-nums" style={{ color: v("--ux-ink") }}>{formatMoney(rent)}</b>
              </li>
              {saved > 0 && (
                <li className="flex justify-between gap-2 text-xs font-semibold" style={{ color: v("--ux-green-ink") }}>
                  <span>Weekly price saves you</span><span className="tabular-nums">− {formatMoney(saved)}</span>
                </li>
              )}
              {it.deposit_minor > 0 && (
                <li className="flex justify-between gap-2">
                  <span>Deposit (comes back)</span>
                  <b className="tabular-nums" style={{ color: v("--ux-ink") }}>{formatMoney(it.deposit_minor)}</b>
                </li>
              )}
            </ul>
            <p className="mt-2.5 flex justify-between gap-2 border-t pt-2.5 text-sm font-extrabold" style={{ borderColor: v("--ux-line"), color: v("--ux-ink") }}>
              <span>Pay at pickup</span><span className="tabular-nums">{formatMoney(rent + it.deposit_minor)}</span>
            </p>
            <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>
              To {it.owner.first_name} on {nice(start)}, when you have it in your hands. Nothing is paid now.
            </p>
          </div>
        )}

        {picked && !problem && (
          <div className="mt-4">
            <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>A word for her <span className="text-2xs font-normal" style={{ color: v("--ux-muted") }}>optional</span></p>
            <Picks options={NOTE_PICKS} value={NOTE_PICKS.filter((p) => note.includes(p))} multi label="Words to tap"
                   onPick={(p) => setNote(toggleLine(note, p))} />
            <div className="mt-2"><Area value={note} onChange={setNote} max={300} rows={2} label="A word for the owner" placeholder="When you need it, what for…" /></div>
          </div>
        )}

        {(problem || error) && (
          <p role="alert" className="mt-3 rounded-[12px] p-3 text-xs font-semibold" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
            {problem || error}
          </p>
        )}

        <div className="mt-4">
          <Btn icon="Send" full loading={busy} disabled={!picked || !!problem} onClick={() => void ask()}>
            {picked ? `Ask ${it.owner.first_name} for these days` : "Pick your days to ask"}
          </Btn>
        </div>
      </Card>
      <p className="flex items-start gap-2 px-1 text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
        <Icons.Lock className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        WomSakhi never collects rental money and never asks for an OTP. You pay her directly at pickup.
      </p>
    </>
  );
}

/* ── the owner's side: her own listing ──────────────────────────────── */

function OwnerBox({ it, reload }: { it: RentalItem; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const live = it.status === "live";
  const flip = async () => {
    setBusy(true);
    try {
      await apiPauseRental(it.id, live ? "paused" : "live");
      toast(live ? "Paused — no one can ask for it" : "It is back on the board", { tone: "success" });
      reload();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.Package className="h-5 w-5" style={{ color: v("--ux-brand") }} /> This is yours
      </p>
      {it.hidden ? (
        <p className="mt-2 rounded-[12px] p-3 text-xs" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
          WomSakhi has hidden this from the board{it.hidden_reason ? `: ${it.hidden_reason}` : "."} Change it and write to Help if you think it is a mistake.
        </p>
      ) : (
        <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>
          {live ? "Women can see it and ask for dates." : "Paused — it is off the board until you show it again."}
        </p>
      )}
      <p className="mt-3 flex items-baseline gap-1.5">
        <b className="text-xl font-extrabold" style={{ color: v("--ux-brand") }}>{formatMoney(it.price_day_minor)}</b>
        <span className="text-xs" style={{ color: v("--ux-muted") }}>a day</span>
      </p>
      {it.busy.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold" style={{ color: v("--ux-ink") }}>Booked days</p>
          <ul className="mt-1 space-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
            {it.busy.map((b) => (
              <li key={b.start} className="flex items-center gap-1.5">
                <Icons.CalendarCheck className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} /> {nice(b.start)} – {nice(b.end)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Btn href={`/app/rent/${it.id}/edit`} icon="Pencil" full>Change it</Btn>
        <Btn variant="outline" icon={live ? "Pause" : "Play"} full loading={busy} onClick={() => void flip()}>
          {live ? "Pause it" : "Show it again"}
        </Btn>
        <Btn variant="ghost" icon="CalendarCheck" full href="/app/rent/bookings">Requests and rentals</Btn>
      </div>
    </Card>
  );
}

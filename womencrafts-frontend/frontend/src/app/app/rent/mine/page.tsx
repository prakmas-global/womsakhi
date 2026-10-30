"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, v } from "@/components/ux/kit";
import { formatMoney } from "@/components/ux/kit/money";
import { Sheet } from "@/components/ux/kit/sheet";
import { ScreenHead } from "@/components/ux/learning/native";
import { toast } from "@/components/ux/mobile/Toast";
import { itemArt } from "@/components/ux/rent/board/look";
import { RentSafety } from "@/components/ux/rent/bookings/parts";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  apiPauseRental, apiRemoveRental, apiRentalBookings, apiRentals, type Booking, type RentalCard,
} from "@/lib/rentals-api";

/**
 * My things for rent (backend: routes/rentals.py GET /rentals?mine=true).
 *
 * Each thing with where it stands — on the board, paused, or hidden by staff
 * and why — how many women are waiting for her answer, and what it has
 * earned. Pausing is one tap; taking it down asks first, and is refused by
 * the server while someone has it booked.
 */

export default function RentMinePage() {
  const list = useResource(useCallback((s: AbortSignal) => apiRentals({ mine: true }, s), []), [] as RentalCard[]);
  const owner = useResource(useCallback((s: AbortSignal) => apiRentalBookings("owner", s), []), [] as Booking[]);
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState<RentalCard | null>(null);

  const asking = (id: string) => owner.data.filter((b) => b.item.id === id && b.status === "requested").length;
  const holding = (id: string) => owner.data.filter((b) => b.item.id === id && (b.status === "accepted" || b.status === "active")).length;
  const earned = owner.data.filter((b) => (b.status === "returned" || b.status === "closed") && b.rent_paid)
    .reduce((n, b) => n + b.rent_minor + b.deduction_minor, 0);
  const waiting = owner.data.filter((b) => b.status === "requested").length;

  const flip = async (c: RentalCard) => {
    setBusy(c.id);
    try {
      await apiPauseRental(c.id, c.status === "live" ? "paused" : "live");
      toast(c.status === "live" ? "Paused" : "Back on the board", { tone: "success" });
      list.refetch();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally { setBusy(""); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await apiRemoveRental(removing.id);
      toast("Taken down", { tone: "success" });
      setRemoving(null);
      list.refetch();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not work. Try again."), { tone: "error" });
    } finally { setBusy(""); }
  };

  const rail = (
    <div className="space-y-4">
      <Card>
        <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>Earned from renting</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color: v("--ux-brand") }}>{formatMoney(earned)}</p>
        <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Written into My Money by itself when each one comes back.</p>
        <Link href="/app/money" className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: v("--ux-brand") }}>
          Open My Money <Icons.ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
      <RentSafety />
    </div>
  );

  return (
    <HomeShell rail={rail}>
      <ScreenHead title="My things for rent"
                  sub={waiting ? `${waiting} ${waiting === 1 ? "woman is" : "women are"} waiting for your answer.` : "What you rent out, and how it is doing."}>
        <div className="flex flex-wrap gap-2">
          {waiting > 0 && <Btn href="/app/rent/bookings" variant="outline" icon="MessageCircleQuestion">Answer requests</Btn>}
          <Btn href="/app/rent/new" icon="Plus">Rent something out</Btn>
        </div>
      </ScreenHead>

      {list.source === "loading" && !list.data.length ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <span key={i} className="ux-skeleton block h-[132px] rounded-[18px]" />)}</div>
      ) : !list.data.length ? (
        <Card>
          <EmptyState icon="KeyRound" title="Nothing up for rent yet"
                      body="Put up something you own — a lehenga worn once, a big cooker, a pram, a sewing machine — and women near you can rent it."
                      action={<Btn href="/app/rent/new" icon="Plus">Rent something out</Btn>} />
        </Card>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {list.data.map((c) => {
            const ask = asking(c.id), held = holding(c.id);
            const state = c.hidden ? { label: "Hidden by WomSakhi", icon: "EyeOff", tone: "danger" }
              : c.status === "live" ? { label: "On the board", icon: "Eye", tone: "green" }
              : { label: "Paused", icon: "Pause", tone: "muted" };
            return (
              <li key={c.id}>
                <Card pad={0} className="overflow-hidden">
                  <Link href={`/app/rent/${c.id}`} className="ux-hov flex gap-3 p-3 sm:p-3.5">
                    <span className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
                      <img src={c.photo || itemArt(c.title, c.category, c.id)} alt="" loading="lazy" className="h-full w-full object-cover"
                           style={{ filter: c.status === "live" && !c.hidden ? undefined : "grayscale(.7)" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm" style={{ color: v("--ux-ink") }}>{c.title}</b>
                      <span className="mt-0.5 block truncate text-xs" style={{ color: v("--ux-muted") }}>
                        {formatMoney(c.price_day_minor)} a day · {c.deposit_minor ? `${formatMoney(c.deposit_minor)} deposit` : "No deposit"}
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold"
                            style={state.tone === "danger" ? { background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }
                              : state.tone === "green" ? { background: v("--ux-tint-green"), color: v("--ux-green-ink") }
                              : { background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                        <I name={state.icon} className="h-3 w-3" /> {state.label}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
                        {ask > 0 && <span className="inline-flex items-center gap-1 font-bold" style={{ color: v("--ux-brand") }}>
                          <Icons.MessageCircleQuestion className="h-3.5 w-3.5" /> {ask} asking</span>}
                        {held > 0 && <span className="inline-flex items-center gap-1"><Icons.CalendarCheck className="h-3.5 w-3.5" /> {held} booked</span>}
                        <span className="inline-flex items-center gap-1"><Icons.Repeat className="h-3.5 w-3.5" /> Rented {c.times_rented} {c.times_rented === 1 ? "time" : "times"}</span>
                      </span>
                    </span>
                  </Link>
                  {c.hidden && c.hidden_reason && (
                    <p className="mx-3.5 mb-2 rounded-[12px] p-2.5 text-xs" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
                      Why: {c.hidden_reason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 border-t p-2.5" style={{ borderColor: v("--ux-line") }}>
                    <Btn size="sm" variant="outline" icon="Pencil" href={`/app/rent/${c.id}/edit`}>Change</Btn>
                    {!c.hidden && (
                      <Btn size="sm" variant="outline" icon={c.status === "live" ? "Pause" : "Play"} loading={busy === c.id}
                           onClick={() => void flip(c)}>{c.status === "live" ? "Pause" : "Show again"}</Btn>
                    )}
                    {ask > 0 && <Btn size="sm" icon="MessageCircleQuestion" href="/app/rent/bookings">Answer</Btn>}
                    <span className="ms-auto">
                      <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Take down ${c.title}`} onClick={() => setRemoving(c)}>Take down</Btn>
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title="Take it down?" icon="Trash2"
             description={removing ? `${removing.title} will leave the board for good. Its past rentals and reviews stay.` : ""}
             footer={<div className="flex gap-2 [&>*]:flex-1">
               <Btn variant="outline" onClick={() => setRemoving(null)}>Keep it</Btn>
               <Btn icon="Trash2" loading={!!removing && busy === removing.id} onClick={() => void remove()}>Take down</Btn>
             </div>}>
        <p className="text-sm" style={{ color: v("--ux-ink-2") }}>
          Only want a break? <b>Pause</b> it instead — it comes back with one tap.
        </p>
        {removing && holding(removing.id) > 0 && (
          <p className="mt-3 rounded-[12px] p-3 text-xs font-semibold" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
            Someone has it booked. Finish that rental first.
          </p>
        )}
      </Sheet>
    </HomeShell>
  );
}

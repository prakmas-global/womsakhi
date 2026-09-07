"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, Pill, SectionHead, Sheet, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { SLOTS, type Slot } from "@/components/ux/eight/data";

/**
 * Her week, as a grid.
 *
 * ── Half of what women here sell is time, not things ────────────────────────
 * Tailoring fittings, mehendi, tuition, beautician work. A shop built only
 * around stock cannot hold any of it, and "message me to book" loses the
 * customer who wanted 4pm Saturday. So the shop needs a diary — and a diary is
 * a grid, days across and times down. A list of slots is not a diary: you
 * cannot see the gap in it, and the gap is the thing she is trying to sell.
 *
 * ── Blocking a slot never asks why ──────────────────────────────────────────
 * She may be unwell, a child may be ill, there may be a funeral. Every other
 * booking tool makes an absence something to justify, and a product for women
 * whose time is not fully theirs must not. One tap closes it, no reason field,
 * and nothing is shown to a customer except that the time has gone.
 */

const DAYS = ["Today", "Tomorrow", "Saturday"];
const TIMES = ["10:00", "11:00", "15:00", "16:00"];

export default function SlotsPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(SLOTS);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const at = useCallback(
    (day: string, time: string) => slots.find((s) => s.day === day && s.time === time),
    [slots],
  );
  const sel = useMemo(() => slots.find((s) => s.id === picked) ?? null, [slots, picked]);

  const booked = useMemo(() => slots.filter((s) => s.bookedBy).length, [slots]);
  const free = useMemo(() => slots.filter((s) => !s.bookedBy && !s.blocked).length, [slots]);
  const earning = useMemo(
    () => slots.filter((s) => s.bookedBy).reduce((n, s) => n + s.minor, 0),
    [slots],
  );

  const block = useCallback((id: string) => {
    setSlots((r) => r.map((s) => (s.id === id ? { ...s, blocked: !s.blocked } : s)));
    const s = slots.find((x) => x.id === id);
    setNote(s?.blocked ? "Open again. It will show to customers." : "Closed. Nobody is told why.");
  }, [slots]);

  const addAll = useCallback(() => {
    setNote("Same times added to next week.");
  }, []);

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Link href={"/app/shop"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to your shops
        </Link>

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Your week
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              Sell your time, not just things
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Customers pick a time themselves. You never have to reply to "when are you free?"
              again — and closing a time takes one tap, with no reason asked.
            </p>
          </div>
          <Btn variant="outline" icon="CopyPlus" onClick={addAll}>Repeat next week</Btn>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* The grid. Days across, times down. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="overflow-x-auto">
            <div className="min-w-[540px] p-4 sm:p-5">
              {/* header row */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `62px repeat(${DAYS.length}, 1fr)` }}>
                <span />
                {DAYS.map((d) => (
                  <p key={d} className="pb-1 text-center text-[0.75rem] font-extrabold uppercase tracking-[0.1em]"
                     style={{ color: v("--ux-ink-2") }}>
                    {d}
                  </p>
                ))}
              </div>

              {TIMES.map((t) => (
                <div key={t} className="mt-2 grid items-stretch gap-2"
                     style={{ gridTemplateColumns: `62px repeat(${DAYS.length}, 1fr)` }}>
                  <p className="pt-3 text-right text-[0.75rem] font-bold tabular-nums" style={{ color: v("--ux-muted") }}>
                    {t}
                  </p>
                  {DAYS.map((d) => {
                    const s = at(d, t);
                    if (!s) {
                      return (
                        <button key={d + t} type="button"
                                onClick={() => setNote(`Added ${t} ${d.toLowerCase()}.`)}
                                aria-label={`Open ${t} on ${d}`}
                                className="ux-press ux-sq grid min-h-[74px] place-items-center rounded-[12px] border border-dashed"
                                style={{ borderColor: v("--ux-line-strong"), color: v("--ux-muted") }}>
                          <I name="Plus" className="h-[15px] w-[15px]" />
                        </button>
                      );
                    }
                    const taken = Boolean(s.bookedBy);
                    const shut = Boolean(s.blocked);
                    return (
                      <button key={s.id} type="button" onClick={() => setPicked(s.id)}
                              className="ux-press ux-sq flex min-h-[74px] flex-col justify-between rounded-[12px] p-2.5 text-left"
                              style={{
                                background: v(shut ? "--ux-surface-2" : taken ? "--ux-fill" : "--ux-tint-green"),
                                border: `1px solid ${v(picked === s.id ? "--ux-ink" : "transparent")}`,
                                opacity: shut ? 0.75 : 1,
                              }}>
                        <p className="text-[0.75rem] font-bold leading-tight"
                           style={{ color: v(shut ? "--ux-muted" : taken ? "--ux-on-brand" : "--ux-green-ink") }}>
                          {shut ? "Closed" : s.service}
                        </p>
                        <p className="text-[0.6875rem] font-semibold"
                           style={{ color: v(shut ? "--ux-muted" : taken ? "--ux-on-brand" : "--ux-ink-2"),
                                    opacity: taken ? 0.85 : 1 }}>
                          {shut ? "No reason given" : taken ? s.bookedBy : `${s.minutes} min · free`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* legend */}
          <div className="flex flex-wrap gap-4 border-t px-5 py-3.5" style={{ borderColor: v("--ux-line") }}>
            {[
              { c: "--ux-brand", t: "Booked" },
              { c: "--ux-tint-green", t: "Free — customers can take it" },
              { c: "--ux-surface-2", t: "You closed it" },
            ].map((l) => (
              <span key={l.t} className="inline-flex items-center gap-2 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                <span className="h-[11px] w-[11px] rounded-[8px]" style={{ background: v(l.c) }} />{l.t}
              </span>
            ))}
          </div>
        </Card>

        {/*
          The picked slot.

          It used to be a card below the grid, which is fine on a desktop and
          wrong on a phone: the grid is 540px wide and scrolls sideways, so
          tapping a time put its details somewhere below the fold she was not
          looking at. A sheet brings the detail to her thumb and leaves the grid
          visible behind it, so she can still see which time she picked.
        */}
        <div className="lg:hidden">
        <Sheet open={!!sel} onClose={() => setPicked(null)}
               title={sel ? `${sel.day}, ${sel.time}` : ""}
               description={sel ? sel.service : undefined}
               footer={sel && (
                 <div className="flex flex-wrap gap-2">
                   {sel.bookedBy ? (
                     <>
                       <Btn size="sm" icon="MessageCircle" href="/app/messages">
                         Message {sel.bookedBy.split(" ")[0]}
                       </Btn>
                       <Btn size="sm" variant="outline" icon="CalendarClock"
                            onClick={() => { setNote(`Asked ${sel.bookedBy} if another time suits. She decides.`); setPicked(null); }}>
                         Ask to move it
                       </Btn>
                     </>
                   ) : (
                     <>
                       <Btn size="sm" variant={sel.blocked ? "primary" : "outline"}
                            icon={sel.blocked ? "Unlock" : "Lock"}
                            onClick={() => { block(sel.id); setPicked(null); }}>
                         {sel.blocked ? "Open it again" : "Close this time"}
                       </Btn>
                       <Btn size="sm" variant="ghost" icon="IndianRupee" href="/app/shop/pricing">
                         Change the price
                       </Btn>
                     </>
                   )}
                 </div>
               )}>
          {sel && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {sel.bookedBy && <Pill tone="brand" size="sm">Booked</Pill>}
                {sel.blocked && <Pill tone="neutral" size="sm">Closed</Pill>}
                {!sel.bookedBy && !sel.blocked && <Pill tone="green" size="sm">Free</Pill>}
              </div>
              <p className="text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {sel.minutes} minutes
                {sel.minor > 0 ? ` · ${formatRupees(sel.minor)}` : " · you set no price for this"}
                {sel.bookedBy ? ` · ${sel.bookedBy} is coming` : ""}
              </p>
              {!sel.bookedBy && !sel.blocked && (
                <p className="rounded-[12px] px-3.5 py-3 text-[0.8125rem] leading-relaxed"
                   style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                  Anyone with your shop link can take this time. Closing it never asks you why, and
                  the customer is not told.
                </p>
              )}
            </div>
          )}
        </Sheet>
        </div>

        {/* Kept for the wide layout, where a panel beside the grid reads better
            than an overlay over it. */}
        {sel && (
          <Card pad={20} className="hidden lg:block" style={{ borderColor: v("--ux-brand") }}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="shrink-0 rounded-[12px] px-3.5 py-2.5 text-center"
                   style={{ background: v("--ux-brand-tint") }}>
                <p className="text-[1.125rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-brand") }}>
                  {sel.time}
                </p>
                <p className="mt-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-brand") }}>
                  {sel.day}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{sel.service}</p>
                  {sel.bookedBy && <Pill tone="brand" size="sm">Booked</Pill>}
                  {sel.blocked && <Pill tone="neutral" size="sm">Closed</Pill>}
                </div>
                <p className="mt-1 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                  {sel.minutes} minutes
                  {sel.minor > 0 ? ` · ${formatRupees(sel.minor)}` : " · you set no price for this"}
                  {sel.bookedBy ? ` · ${sel.bookedBy} is coming` : ""}
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {sel.bookedBy ? (
                    <>
                      <Btn size="sm" icon="MessageCircle" href="/app/messages">Message {sel.bookedBy.split(" ")[0]}</Btn>
                      <Btn size="sm" variant="outline" icon="CalendarClock"
                           onClick={() => setNote(`Asked ${sel.bookedBy} if another time suits. She decides.`)}>Ask to move it</Btn>
                    </>
                  ) : (
                    <>
                      <Btn size="sm" variant={sel.blocked ? "primary" : "outline"} icon={sel.blocked ? "Unlock" : "Lock"}
                           onClick={() => block(sel.id)}>
                        {sel.blocked ? "Open it again" : "Close this time"}
                      </Btn>
                      <Btn size="sm" variant="ghost" icon="IndianRupee" href="/app/shop/pricing">Change the price</Btn>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <div>
          <SectionHead title="This week" icon="CalendarDays" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { n: String(booked), l: "times booked", i: "CalendarCheck", tint: "--ux-tint-violet", ink: "--ux-violet" },
              { n: String(free), l: "still free", i: "CalendarPlus", tint: "--ux-tint-green", ink: "--ux-green-ink" },
              { n: formatRupees(earning), l: "already earned", i: "Wallet", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
            ].map((x) => (
              <Card key={x.l} pad={16}>
                <div className="flex items-center gap-3.5">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]"
                        style={{ background: v(x.tint), color: v(x.ink) }}>
                    <I name={x.i} className="h-[19px] w-[19px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[1.25rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                      {x.n}
                    </p>
                    <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-muted") }}>{x.l}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Closing a time never asks you why, and the customer is never told. Nobody can book a
              time you have closed, and closing one does not count against your shop.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

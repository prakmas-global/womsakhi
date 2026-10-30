"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, v } from "@/components/ux/kit";
import { Area, Picks } from "@/components/ux/kit/form";
import { formatMoney } from "@/components/ux/kit/money";
import {
  CONDITION_LOOK, PRAISE_FOR_OWNER, PRAISE_FOR_RENTER, STATUS_LOOK, STEPS, type Booking,
} from "@/lib/rentals-api";
import { day } from "./look";

/** The safety rules, in the side column — the money is always between the two of them. */
export function RentSafety() {
  return (
    <Card>
      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.ShieldCheck className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Rent safely
      </p>
      <ul className="mt-2.5 space-y-2 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
        {[
          ["HandCoins", "Pay rent and deposit only when you have the thing in your hands — never before."],
          ["Camera", "Photograph it at pickup and at return. Both of you can see the photos."],
          ["MapPin", "Meet somewhere with people around, or at her home with family there."],
          ["MessageCircle", "Talk in WomSakhi messages. Share your number only if you want to."],
          ["Lock", "WomSakhi never asks for an OTP or collects rental money."],
        ].map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2"><I name={icon} className="mt-[1px] h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />{text}</li>
        ))}
      </ul>
      <Link href="/app/safe-money" className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: v("--ux-brand") }}>
        Money traps to know <Icons.ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}

/** Where it stands, as five pictures — or one banner if it stopped. */
export function StepTrack({ b }: { b: Booking }) {
  const at = STEPS.indexOf(b.status);
  if (at < 0) {
    const look = STATUS_LOOK[b.status];
    const why = b.reason || (b.status === "expired" ? "There was no answer before the first day." : "");
    return (
      <div className="flex items-start gap-3 rounded-[16px] p-3.5" style={{ background: v("--ux-surface-2") }}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: v("--ux-surface"), color: v("--ux-muted") }}>
          <I name={look.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <b className="block text-sm" style={{ color: v("--ux-ink") }}>{look.label}</b>
          {why && <span className="mt-0.5 block text-xs" style={{ color: v("--ux-muted") }}>{why}</span>}
        </span>
      </div>
    );
  }
  return (
    <ol className="flex items-start" aria-label="Where this rental stands">
      {STEPS.map((s, i) => {
        const look = STATUS_LOOK[s];
        const done = i < at, here = i === at;
        return (
          <li key={s} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={here ? "step" : undefined}>
            {i > 0 && <span aria-hidden className="absolute end-1/2 top-[18px] h-[3px] w-full rounded-full"
                            style={{ background: i <= at ? v("--ux-brand") : v("--ux-line") }} />}
            <span className="relative z-[1] grid h-9 w-9 place-items-center rounded-full"
                  style={here ? { background: "var(--ux-pic-ground)", color: "#fff", boxShadow: "0 0 0 4px var(--ux-brand-tint)" }
                    : done ? { background: v("--ux-brand"), color: "#fff" } : { background: v("--ux-surface-2"), color: v("--ux-faint") }}>
              {done ? <Icons.Check className="h-4 w-4" /> : <I name={look.icon} className="h-4 w-4" />}
            </span>
            <span className="mt-1.5 px-0.5 text-[11px] font-semibold leading-tight"
                  style={{ color: here ? v("--ux-brand") : done ? v("--ux-ink-2") : v("--ux-faint") }}>{look.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The money, said plainly: what is paid at pickup, and what comes back. */
export function MoneyBox({ b }: { b: Booking }) {
  const back = b.status === "returned" || b.status === "closed";
  const rows: [string, string, number, string?][] = [
    ["Wallet", `Rent · ${b.days} ${b.days === 1 ? "day" : "days"}`, b.rent_minor],
    ...(b.deposit_minor ? [["ShieldCheck", "Deposit — comes back when it does", b.deposit_minor] as [string, string, number]] : []),
  ];
  return (
    <div className="rounded-[16px] border p-3.5" style={{ borderColor: v("--ux-line") }}>
      <ul className="space-y-2">
        {rows.map(([icon, label, minor]) => (
          <li key={label} className="flex items-center gap-2.5 text-sm" style={{ color: v("--ux-ink-2") }}>
            <I name={icon} className="h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />
            <span className="min-w-0 flex-1">{label}</span>
            <b className="tabular-nums" style={{ color: v("--ux-ink") }}>{formatMoney(minor)}</b>
          </li>
        ))}
      </ul>
      {!back && (
        <p className="mt-3 rounded-[12px] p-3 text-xs leading-relaxed" style={{ background: v("--ux-brand-tint"), color: v("--ux-ink") }}>
          <b>Pay at pickup {formatMoney(b.rent_minor + b.deposit_minor)}</b> — to her, in person or by UPI. Never before you have it.
          {(b.status === "active") && (
            <span className="mt-1 block" style={{ color: v("--ux-ink-2") }}>
              {b.rent_paid ? "✓ Rent received" : "Rent not marked received yet"}
              {b.deposit_minor ? (b.deposit_paid ? " · ✓ Deposit received" : " · Deposit not marked received") : ""}
            </span>
          )}
        </p>
      )}
      {back && b.deposit_minor > 0 && (
        <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: v("--ux-line") }}>
          {b.deduction_minor > 0 && (
            <p className="flex items-start gap-2.5 text-sm" style={{ color: v("--ux-ink-2") }}>
              <I name="AlertTriangle" className="mt-[2px] h-4 w-4 shrink-0" style={{ color: v("--ux-danger-ink") }} />
              <span className="min-w-0 flex-1">Kept from the deposit{b.deduction_note ? ` — “${b.deduction_note}”` : ""}</span>
              <b className="tabular-nums" style={{ color: v("--ux-danger-ink") }}>− {formatMoney(b.deduction_minor)}</b>
            </p>
          )}
          <p className="flex items-center gap-2.5 text-sm font-bold" style={{ color: v("--ux-green-ink") }}>
            <I name="HandCoins" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Deposit back</span>
            <span className="tabular-nums">{formatMoney(b.deposit_back_minor)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** When it left, and when it came back — side by side, so a dispute starts from the same pictures. */
export function PhotosCompare({ b }: { b: Booking }) {
  if (!b.photos_out.length && !b.photos_back.length) return null;
  const col = (title: string, photos: string[], note: string) => (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-bold" style={{ color: v("--ux-ink") }}>{title}</p>
      {note && <p className="mb-1.5 text-2xs" style={{ color: v("--ux-muted") }}>{note}</p>}
      {photos.length ? (
        <div className="grid grid-cols-2 gap-1.5">
          {photos.map((p) => (
            <a key={p} href={p} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[10px]" style={{ background: v("--ux-surface-2") }}>
              <img src={p} alt={title} loading="lazy" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <p className="grid aspect-[2/1] place-items-center rounded-[10px] text-2xs" style={{ background: v("--ux-surface-2"), color: v("--ux-faint") }}>No photos</p>
      )}
    </div>
  );
  const back = { fine: "Came back fine", damaged: "Came back damaged", lost: "Lost" }[b.condition_back as "fine"] ?? "";
  return (
    <Card>
      <p className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.Camera className="h-4 w-4" style={{ color: v("--ux-brand") }} /> Its condition
      </p>
      <div className="grid grid-cols-2 gap-3">
        {col("When it left", b.photos_out, b.condition_out ? CONDITION_LOOK[b.condition_out] : "")}
        {col("When it came back", b.photos_back, back)}
      </div>
    </Card>
  );
}

/** Every step, small, at the bottom — the record both of them can point to. */
export function History({ b }: { b: Booking }) {
  if (!b.history.length) return null;
  return (
    <Card>
      <p className="mb-2.5 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.History className="h-4 w-4" style={{ color: v("--ux-muted") }} /> What happened
      </p>
      <ol className="space-y-2.5 border-s ps-4" style={{ borderColor: v("--ux-line") }}>
        {[...b.history].reverse().map((h, i) => (
          <li key={i} className="relative text-xs" style={{ color: v("--ux-ink-2") }}>
            <span aria-hidden className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full" style={{ background: i === 0 ? v("--ux-brand") : v("--ux-line-strong") }} />
            <b style={{ color: v("--ux-ink") }}>{h.note || h.status}</b>
            <span className="block text-2xs" style={{ color: v("--ux-muted") }}>
              {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {h.by ? ` · ${h.by === "owner" ? "owner" : h.by === "renter" ? "renter" : h.by}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Stars and taps for how it went — the renter rates the owner, the owner rates the renter. */
export function ReviewCard({ b, onSend, busy }: {
  b: Booking; busy: boolean; onSend: (r: { stars: number; praise: string[]; text: string }) => void;
}) {
  const [stars, setStars] = useState(0);
  const [praise, setPraise] = useState<string[]>([]);
  const [text, setText] = useState("");
  const words = b.side === "renter" ? PRAISE_FOR_OWNER : PRAISE_FOR_RENTER;
  return (
    <Card>
      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.Star className="h-4 w-4" style={{ color: v("--ux-brand") }} /> How was it with {b.with.first_name}?
      </p>
      <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
        Other women see this before they rent {b.side === "renter" ? "from her" : "to her"}.
      </p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setStars(n)} className="ux-press grid h-12 w-12 place-items-center rounded-full">
            <Icons.Star className="h-9 w-9" style={{ color: n <= stars ? "#f5a524" : v("--ux-line-strong"), fill: n <= stars ? "#f5a524" : "none" }} />
          </button>
        ))}
      </div>
      <Picks options={words} value={praise} multi label="What was good"
             onPick={(p) => setPraise((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))} />
      <div className="mt-3">
        <Area value={text} onChange={setText} max={400} rows={2} label="A few words" placeholder="A few words, if you like" />
      </div>
      <div className="mt-3"><Btn icon="Send" loading={busy} disabled={!stars} onClick={() => onSend({ stars, praise, text })}>Send</Btn></div>
    </Card>
  );
}

/** A small header line about dates, used under the title. */
export const datesLine = (b: Booking) => `${day(b.start)} – ${day(b.end)} · ${b.days} ${b.days === 1 ? "day" : "days"}`;

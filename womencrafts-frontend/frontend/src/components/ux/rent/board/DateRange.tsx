"use client";

import { useState } from "react";

import * as Icons from "@/components/ux/icons";
import { v } from "@/components/ux/kit";
import { daysBetween } from "@/lib/rentals-api";

/**
 * Pick the days she wants it: tap the first day, then the last.
 *
 * Days someone already has it are greyed out and cannot be tapped, and once a
 * first day is picked, every day past the next booking — or past the longest
 * the owner rents it for — goes grey too, so she can only build a range that
 * can actually be asked for. Dates are local `YYYY-MM-DD`; never UTC, or the
 * 1st of a month turns into the 31st for anyone east of Greenwich.
 */

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d); };
export const nice = (iso: string) => parse(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function DateRange({ busy, minDays, maxDays, start, end, onChange }: {
  busy: { start: string; end: string }[];
  minDays: number;
  maxDays: number;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = isoOf(new Date());
  const [month, setMonth] = useState(() => { const d = parse(start || today); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const isBusy = (iso: string) => busy.some((b) => iso >= b.start && iso <= b.end);

  // While picking the last day: the latest day she could end on.
  const limit = start && !end
    ? [addDays(start, maxDays - 1), ...busy.filter((b) => b.start > start).map((b) => addDays(b.start, -1))].sort()[0]
    : "";

  const tap = (iso: string) => {
    if (!start || end || iso < start) return onChange(iso, "");
    if (iso === start && minDays > 1) return;
    onChange(start, iso);
  };

  const first = month.getDay();
  const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: inMonth }, (_, i) => isoOf(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const canBack = isoOf(new Date(month.getFullYear(), month.getMonth(), 0)) >= today;
  const span = start && end ? daysBetween(start, end) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!canBack}
                aria-label="Earlier month" className="ux-press grid h-10 w-10 place-items-center rounded-full disabled:opacity-30"
                style={{ background: v("--ux-surface-2"), color: v("--ux-ink") }}>
          <Icons.ChevronLeft className="h-5 w-5" />
        </button>
        <b className="text-sm" style={{ color: v("--ux-ink") }}>
          {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </b>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                aria-label="Later month" className="ux-press grid h-10 w-10 place-items-center rounded-full"
                style={{ background: v("--ux-surface-2"), color: v("--ux-ink") }}>
          <Icons.ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Pick your days">
        {WEEK.map((w, i) => <span key={i} className="pb-1 text-2xs font-bold" style={{ color: v("--ux-faint") }}>{w}</span>)}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`x${i}`} />;
          const taken = isBusy(iso);
          const off = iso < today || taken || (!!limit && iso > limit);
          const edge = iso === start || iso === end;
          const inside = !!start && !!end && iso > start && iso < end;
          return (
            <button key={iso} type="button" disabled={off} onClick={() => tap(iso)}
                    aria-pressed={edge || inside} aria-label={`${nice(iso)}${taken ? ", taken" : ""}`}
                    className="ux-press relative grid aspect-square place-items-center rounded-[10px] text-xsm font-semibold"
                    style={{
                      background: edge ? v("--ux-fill") : inside ? v("--ux-brand-tint") : "transparent",
                      color: edge ? v("--ux-on-brand") : off ? v("--ux-faint") : inside ? v("--ux-brand") : v("--ux-ink"),
                      textDecoration: taken ? "line-through" : undefined,
                      opacity: off && !taken ? 0.45 : 1,
                    }}>
              {Number(iso.slice(8))}
              {iso === today && !edge && <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: v("--ux-brand") }} />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
        <Icons.CalendarRange className="h-3.5 w-3.5 shrink-0" />
        {!start ? "Tap the day you will pick it up."
          : !end ? `Now tap the day you will give it back${minDays > 1 ? ` — at least ${minDays} days` : ""}.`
          : `${nice(start)} to ${nice(end)} · ${span} ${span === 1 ? "day" : "days"}`}
      </p>
      {busy.length > 0 && (
        <p className="mt-1 text-2xs" style={{ color: v("--ux-faint") }}>
          <span className="line-through">Crossed-out</span> days: someone already has it.
        </p>
      )}
    </div>
  );
}

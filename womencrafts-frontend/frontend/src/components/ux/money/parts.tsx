"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";

import { IconTile, Pill, rowMemo } from "../kit";
import { rupees, signed, type Txn } from "./data";

/**
 * A transaction row.
 *
 * Credits and debits are told apart by the sign and the word, never by colour
 * alone — a woman who cannot distinguish red from green still has to know
 * whether money came in or went out.
 */
/**
 * One line of her ledger.
 *
 * Memoised by the transaction object. Changing a filter chip re-renders the
 * list; without this every surviving row re-renders too, and on a festival
 * season's worth of entries that is the difference between a chip feeling
 * instant and feeling stuck. Every adapter in this app builds fresh objects
 * from the server's answer, so identity changes exactly when the data does.
 */
export const TxnRow = rowMemo(function TxnRow({ item: t, i }: { item: Txn; i: number }) {
  const failed = t.status === "failed";
  const pending = t.status === "pending";
  return (
    <div
      className="ux-i ux-sq flex items-center gap-3.5 rounded-[13px] border p-3"
      style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
    >
      <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={42} radius={11} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{t.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
          {t.source} <span aria-hidden>•</span> {t.when}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="text-[14px] font-bold tabular-nums"
          style={{
            color: failed ? "var(--ux-faint)" : t.kind === "credit" ? "var(--ux-green-ink)" : "var(--ux-ink)",
            textDecoration: failed ? "line-through" : "none",
          }}
        >
          {signed(t)}
        </span>
        {/* The word, not only the sign: "+₹4,200" and "−₹5,000" differ by one
            glyph, and that glyph is the whole meaning. */}
        <span className="text-[10.5px]" style={{ color: "var(--ux-faint)" }}>
          {failed ? "Failed" : pending ? "On its way" : t.kind === "credit" ? "Received" : "Paid out"}
        </span>
      </div>
    </div>
  );
});

/**
 * Twelve months of earnings as bars.
 *
 * Bars rather than a line: she is comparing one month against another, which is
 * a length comparison, and a line asks her to read a slope instead. Each bar
 * grows from the baseline once, on mount.
 */
export function EarningsBars({
  values, labels, height = 132,
}: { values: number[]; labels: string[]; height?: number }) {
  const max = Math.max(...values);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    // One frame, so the browser has a zero-height start to animate from.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /**
   * Pixel heights, not percentages.
   *
   * A percentage height needs a parent with a DEFINITE height, and these
   * columns are flex items in an `items-end` row — so they are sized to their
   * content, the percentage resolved against nothing, and every bar rendered at
   * zero. The chart looked like a row of month labels with no chart.
   */
  const LABEL = 18;
  const plot = height - LABEL;

  return (
    <div className="flex items-end gap-[6px]" style={{ height }}>
      {values.map((v, i) => {
        const h = Math.max(3, Math.round((v / max) * plot));
        const last = i === values.length - 1;
        return (
          <div key={labels[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end"
               style={{ height }}>
            <div
              className="ux-sq w-full rounded-[6px]"
              style={{
                height: grown ? h : 0,
                background: last
                  ? "linear-gradient(180deg, var(--ux-brand-600), var(--ux-brand-700))"
                  : "var(--ux-brand-tint-2)",
                transition: `height var(--ux-t-slow) var(--ux-ease-out) ${i * 40}ms`,
              }}
              title={`${labels[i]}: ${rupees(v)}`}
            />
            <span
              className="mt-1.5 w-full truncate text-center text-[9.5px]"
              style={{ color: last ? "var(--ux-brand)" : "var(--ux-faint)", fontWeight: last ? 700 : 400 }}
            >
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Where the money came from, as one stacked bar plus a key. */
export function SourceSplit({ sources }: { sources: { name: string; minor: number; tone: string }[] }) {
  const total = sources.reduce((a, s) => a + s.minor, 0);
  return (
    <>
      <div className="ux-sq flex h-[10px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
        {sources.map((s, i) => (
          <span
            key={s.name}
            style={{
              width: `${(s.minor / total) * 100}%`,
              background: `var(${s.tone})`,
              transition: `width var(--ux-t-slow) var(--ux-ease-out) ${i * 70}ms`,
            }}
            title={`${s.name}: ${rupees(s.minor)}`}
          />
        ))}
      </div>
      <ul className="ux-stagger mt-3.5 space-y-2.5">
        {sources.map((s) => (
          <li key={s.name} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: `var(${s.tone})` }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ux-ink-2)" }}>{s.name}</span>
            <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>
              {rupees(s.minor)}
            </span>
            <span className="w-[38px] shrink-0 text-end text-[11px] tabular-nums" style={{ color: "var(--ux-faint)" }}>
              {Math.round((s.minor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A saved payout destination. */
export function PayoutMethod({ m }: { m: (typeof import("./data"))["PAYOUT_METHODS"][number] }) {
  return (
    <div className="ux-i ux-sq flex items-center gap-3 rounded-[13px] border p-3"
         style={{ borderColor: m.primary ? "var(--ux-brand)" : "var(--ux-line)", background: "var(--ux-surface)" }}>
      <IconTile icon={m.icon} tint={m.tint} ink={m.ink} size={40} radius={11} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>
          {m.label}
          {m.verified && <Icons.BadgeCheck className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-blue)" }} />}
        </p>
        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{m.detail}</p>
      </div>
      {m.primary && <Pill tone="brand" size="sm">Default</Pill>}
    </div>
  );
}

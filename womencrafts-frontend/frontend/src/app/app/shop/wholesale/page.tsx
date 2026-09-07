"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { BULK, type BulkAsk } from "@/components/ux/shopplus/data";

/**
 * Big orders — and the circle that makes them possible.
 *
 * ── Why a bulk ask is different from twenty small ones ──────────────────────
 * One purchase order for 120 shirts is a different business from 120 sales: one
 * conversation, one delivery, one payment, and a buyer who plans a year ahead.
 * It is also the shape of demand a single woman with one machine must refuse —
 * which is precisely what a circle is for. Ten women who already vouch for each
 * other can quote as one supplier and split the work.
 *
 * ── The thing this screen must not hide ─────────────────────────────────────
 * A big order won on bad terms is worse than no order. When a corporate or
 * institutional buyer pays in sixty or ninety days, a woman who has just spent
 * her own money on cloth is financing them — and the evidence on small-supplier
 * payment terms is blunt: when the US government accelerated payments to small
 * suppliers, employment at those suppliers *went up*. Payment timing was the
 * binding constraint, not access to the contract.
 *
 * So the payment terms are shown at the same size as the money.
 */

const STATE: Record<BulkAsk["state"], { label: string; tint: string; ink: string }> = {
  new: { label: "Waiting for your price", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  quoted: { label: "Price sent", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  won: { label: "Yours", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  declined: { label: "Turned down", tint: "--ux-surface-2", ink: "--ux-muted" },
};

export default function WholesalePage() {
  const router = useRouter();
  const [rows, setRows] = useState<BulkAsk[]>(BULK);
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => rows.filter((b) => b.state === "new" || b.state === "quoted"), [rows]);
  const won = useMemo(() => rows.filter((b) => b.state === "won"), [rows]);
  const value = (b: BulkAsk) => b.qty * b.perMinor;
  const openValue = useMemo(() => open.reduce((n, b) => n + value(b), 0), [open]);
  const wonValue = useMemo(() => won.reduce((n, b) => n + value(b), 0), [won]);

  const quote = useCallback((id: string) => {
    setRows((r) => r.map((b) => (b.id === id ? { ...b, state: "quoted" } : b)));
    const b = rows.find((x) => x.id === id);
    setNote(b?.needsCircle
      ? `Price sent for ${b.what.toLowerCase()} — as a group quote, with the women who will share the work named.`
      : `Price sent to ${b?.from}.`);
  }, [rows]);

  const decline = useCallback((id: string) => {
    setRows((r) => r.map((b) => (b.id === id ? { ...b, state: "declined" } : b)));
    setNote("Turned down. Nothing about your shop is downgraded for saying no.");
  }, []);

  const card = (b: BulkAsk) => {
    const s = STATE[b.state];
    return (
      <Card key={b.id} pad={16}>
        <div className="flex flex-wrap items-start gap-3.5">
          <IconTile icon="Boxes" tint={s.tint} ink={s.ink} size={44} radius={13} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{b.what}</p>
              <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold uppercase tracking-[0.06em]"
                    style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
              {b.needsCircle && <Pill tone="pink" size="sm">Needs your circle</Pill>}
            </div>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
              {b.from} · {b.qty} pieces · wanted {b.byWhen}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[1.125rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
              {formatRupees(value(b))}
            </p>
            <p className="mt-0.5 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>
              {formatRupees(b.perMinor)} each
            </p>
          </div>
        </div>

        {/* Terms at the same weight as the money. */}
        <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-tint-amber") }}>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-amber-ink") }}>
              When they pay
            </p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Sixty days after delivery. Ask for a third up front — you should not be lending
              them the cloth money.
            </p>
          </div>
          {b.needsCircle && (
            <div className="rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-tint-pink") }}>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-pink-ink") }}>
                Too big for one machine
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Quote it with your circle. Ten women, one price, one delivery — the buyer sees
                one supplier.
              </p>
            </div>
          )}
        </div>

        {(b.state === "new" || b.state === "quoted") && (
          <div className="mt-3.5 flex gap-2">
            {b.state === "new" && <Btn size="sm" full onClick={() => quote(b.id)}>
              {b.needsCircle ? "Quote it with my circle" : "Send my price"}
            </Btn>}
            <Btn size="sm" variant="ghost" full onClick={() => decline(b.id)}>Not this one</Btn>
          </div>
        )}
      </Card>
    );
  };

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => router.push("/app/shop")}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to your shops
        </button>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Big orders
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Twenty pieces to one buyer
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            One conversation, one delivery, one payment. Too big for one machine is not a reason
            to say no — it is a reason to quote it with your circle.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(openValue)} label="On the table now"
                  icon="Boxes" tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={formatRupees(wonValue)} label="Already won"
                  icon="CheckCircle2" tint="--ux-tint-green" ink="--ux-green-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Waiting on you" icon="Boxes" chip={String(open.length)} />
          {open.length === 0 ? (
            <Card><EmptyState icon="Boxes" title="No big orders right now"
                              body="Shops and hostels order in seasons. We will tell you when one asks." /></Card>
          ) : (
            <div className="flex flex-col gap-3">{open.map(card)}</div>
          )}
        </div>

        {won.length > 0 && (
          <div>
            <SectionHead title="Yours" icon="CheckCircle2" chip={String(won.length)} />
            <div className="flex flex-col gap-3">{won.map(card)}</div>
          </div>
        )}
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { SUBS, prepaidHeld, type Sub } from "@/components/ux/shopplus/data";

/**
 * Customers who pay every month.
 *
 * ── Why subscriptions and not a storefront ──────────────────────────────────
 * HomeFoodi survives by explicitly *not* being a delivery company — direct
 * contact, no platform fee, tiffin subscriptions. Curryful died building
 * delivery, and its founder's own account is that the problem was never supply:
 * customers could not tell home food from another cloud kitchen. Twenty people
 * who already know her, paying monthly in advance, beats a listing page seen by
 * a thousand strangers.
 *
 * The number this screen is really about is **prepaid**. Money taken in advance
 * is working capital, and working capital is the constraint. So it is the first
 * figure, and the "ask for the month up front" nudge is the main action.
 */

export default function SubscriptionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Sub[]>(SUBS);
  const [note, setNote] = useState<string | null>(null);

  const running = useMemo(() => rows.filter((s) => s.state === "running"), [rows]);
  const paused = useMemo(() => rows.filter((s) => s.state !== "running"), [rows]);
  const monthly = useMemo(() => running.reduce((n, s) => n + s.everyMinor, 0), [running]);
  const held = useMemo(() => prepaidHeld(rows), [rows]);
  const notPrepaid = useMemo(() => running.filter((s) => !s.prepaid), [running]);

  const askUpfront = useCallback((id: string) => {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, prepaid: true } : s)));
    const s = rows.find((x) => x.id === id);
    setNote(`${s?.who} will pay for the month up front from now. That is ${formatRupees(s?.everyMinor ?? 0)} in your hand before you cook.`);
  }, [rows]);

  const toggle = useCallback((id: string) => {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, state: s.state === "running" ? "paused" : "running" } : s)));
    const s = rows.find((x) => x.id === id);
    setNote(s?.state === "running" ? `${s.who} paused. Nothing is charged.` : `${s?.who} is back on.`);
  }, [rows]);

  const card = (s: Sub) => (
    <Card key={s.id} pad={16}>
      <div className="flex flex-wrap items-start gap-3.5">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-[1rem] font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {s.who.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.who}</p>
            {s.prepaid && <Pill tone="green" size="sm">Pays up front</Pill>}
            {s.state === "paused" && <Pill tone="neutral" size="sm">Paused</Pill>}
          </div>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
            {s.what} · since {s.since}
            {s.state === "running" && ` · next on ${s.nextOn}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[1.125rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
            {formatRupees(s.everyMinor)}
          </p>
          <p className="mt-0.5 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>{s.cadence}</p>
        </div>
      </div>

      {!s.prepaid && s.state === "running" && (
        <div className="mt-3.5 rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-tint-amber") }}>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            She pays at the end of the month. Ask her to pay at the start instead — same money,
            in your hand before you buy the rice.
          </p>
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        {!s.prepaid && s.state === "running" && (
          <Btn size="sm" full onClick={() => askUpfront(s.id)}>Ask for the month up front</Btn>
        )}
        <Btn size="sm" variant={s.state === "running" ? "ghost" : "primary"} full onClick={() => toggle(s.id)}>
          {s.state === "running" ? "Pause" : "Start again"}
        </Btn>
      </div>
    </Card>
  );

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Back to="/app/shop" label="Back to your shops" />

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Every month
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Money you can count on
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Twenty people who know you, paying every month, is a better business than a thousand
            strangers who might buy once.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(monthly)} label="Every month, dependable"
                  icon="Repeat" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={formatRupees(held)} label="Already in your hand"
                  icon="HandCoins" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(running.length)} label="Regular customers"
                  icon="Users" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
          {notPrepaid.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>
                {notPrepaid.length} {notPrepaid.length === 1 ? "customer pays" : "customers pay"} at the
                end of the month. Asking for it at the start costs them nothing and changes everything for you.
              </p>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Running" icon="Repeat" chip={String(running.length)} />
          {running.length === 0 ? (
            <Card><EmptyState icon="Repeat" title="No regulars yet"
                              body="Ask three customers who already buy from you every week whether they would rather pay monthly." /></Card>
          ) : (
            <div className="flex flex-col gap-3">{running.map(card)}</div>
          )}
        </div>

        {paused.length > 0 && (
          <div>
            <SectionHead title="Paused" icon="Pause" chip={String(paused.length)} />
            <div className="flex flex-col gap-3">{paused.map(card)}</div>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              These customers are yours, not ours. Their numbers are in your phone, and if you ever
              stop using WomSakhi they stay with you.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

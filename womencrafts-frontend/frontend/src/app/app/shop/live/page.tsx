"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { LIVES, type LiveSale } from "@/components/ux/shopplus/data";

/**
 * Show and sell — half an hour, to her own circle.
 *
 * ── Why live, and why to her circle rather than to the world ────────────────
 * Live commerce works: Whatnot raised $545M at a $20B valuation on $8B of GMV.
 * And the reason it works is the part usually missed — **the seller keeps her
 * own inventory, her own audience and her own customer relationship.** It is
 * the opposite of a marketplace.
 *
 * It also happens to need no logistics, no photography and no stock. She holds
 * a blouse up to the camera and eleven women who already know her decide. That
 * is a whole business with a phone and no capital, which is exactly the
 * constraint everything in this batch is built around.
 */

const STATE: Record<LiveSale["state"], { label: string; tint: string; ink: string }> = {
  scheduled: { label: "Coming up", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  live: { label: "On now", tint: "--ux-danger-tint", ink: "--ux-danger-solid" },
  ended: { label: "Finished", tint: "--ux-surface-2", ink: "--ux-muted" },
};

export default function LivePage() {
  const router = useRouter();
  const [rows, setRows] = useState<LiveSale[]>(LIVES);
  const [note, setNote] = useState<string | null>(null);

  const upcoming = useMemo(() => rows.filter((l) => l.state !== "ended"), [rows]);
  const past = useMemo(() => rows.filter((l) => l.state === "ended"), [rows]);
  const earned = useMemo(() => past.reduce((n, l) => n + l.takenMinor, 0), [past]);
  const sold = useMemo(() => past.reduce((n, l) => n + l.sold, 0), [past]);
  const watched = useMemo(() => past.reduce((n, l) => n + l.watching, 0), [past]);

  const go = useCallback((id: string) => {
    setRows((r) => r.map((l) => (l.id === id ? { ...l, state: l.state === "live" ? "ended" : "live" } : l)));
    const l = rows.find((x) => x.id === id);
    setNote(l?.state === "live"
      ? "Finished. Everything anyone claimed is now an order in your shop."
      : "You are on. Your circle has been told — hold things up and say the price out loud.");
  }, [rows]);

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
              Show and sell
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              Half an hour, your own people
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Hold things up, say the price, take the orders. No photographs, no stock, no delivery —
              and the women watching already know you.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => setNote("Pick a day and a time. Your circle gets one message — never more.")}>
            Plan one
          </Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(earned)} label="Taken from selling live"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(sold)} label="Things sold" icon="Package"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={String(watched)} label="Women watched" icon="Eye"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
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
          <SectionHead title="Coming up" icon="CalendarDays" chip={String(upcoming.length)} />
          {upcoming.length === 0 ? (
            <Card><EmptyState icon="Radio" title="Nothing planned"
                              body="Pick a Saturday evening. The women in your circle are on their phones then anyway." /></Card>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((l) => {
                const s = STATE[l.state];
                const on = l.state === "live";
                return (
                  <Card key={l.id} pad={16} style={on ? { borderColor: v("--ux-danger-solid") } : undefined}>
                    <div className="flex flex-wrap items-start gap-3.5">
                      <IconTile icon="Radio" tint={s.tint} ink={s.ink} size={44} radius={13} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{l.title}</p>
                          <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold uppercase tracking-[0.06em]"
                                style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                        </div>
                        <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                          {l.when} · to {l.circle}
                        </p>
                        {on && (
                          <p className="mt-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-danger-solid") }}>
                            {l.watching} watching now
                          </p>
                        )}
                      </div>
                      <Btn size="sm" variant={on ? "outline" : "primary"} onClick={() => go(l.id)}>
                        {on ? "Finish" : "Start now"}
                      </Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <SectionHead title="Before" icon="History" chip={String(past.length)} />
            <div className="flex flex-col gap-3">
              {past.map((l) => (
                <Card key={l.id} pad={16}>
                  <div className="flex flex-wrap items-center gap-3.5">
                    <IconTile icon="Radio" tint="--ux-surface-2" ink="--ux-muted" size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{l.title}</p>
                      <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                        {l.when} · {l.watching} watched · {l.sold} sold
                      </p>
                    </div>
                    <p className="text-[1.125rem] font-extrabold tabular-nums" style={{ color: v("--ux-green-ink") }}>
                      {formatRupees(l.takenMinor)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Your circle is told once, when you go on. Never repeatedly, and never by us to people
              who did not ask.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

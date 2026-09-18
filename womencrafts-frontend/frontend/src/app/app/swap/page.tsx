"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { SWAPS, type SwapItem } from "@/components/ux/life/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { GroupLabel, PhoneRow, PhoneTitle, phonePrimary } from "@/components/ux/PhoneParts";

/**
 * Circle swap — the second-hand economy women already run.
 *
 * ── Why this is not a resale marketplace ────────────────────────────────────
 * Resale platforms lose money at the ₹200 price point. Poshmark takes a flat
 * $2.95 under $15, so a $5 item nets $2.05; the whole operational load —
 * sourcing, sizing, hygiene, counterfeits, per-item photography, returns —
 * lands on the seller; and India's entire circular-fashion market was about
 * $272M in 2024, with a Gen-Z thrifter as the buyer, not this user.
 *
 * But there *is* a working women-run second-hand economy in India, and it is
 * nothing like Poshmark: the Waghri *bartanwali* trade, clothes bartered for
 * steel utensils, door to door. Local, trust-based, no shipping, no listings
 * fee, no returns policy.
 *
 * So: no prices, no fees, no delivery, no photography studio. Things people in
 * her circle no longer need, handed over in person. Uniforms are the killer
 * item — outgrown every single year, needed every single June.
 */

const CONDITION: Record<SwapItem["condition"], { tint: string; ink: string }> = {
  "as new": { tint: "--ux-tint-green", ink: "--ux-green-ink" },
  good: { tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  "worn but fine": { tint: "--ux-surface-2", ink: "--ux-muted" },
};

type Filter = "all" | "free" | "children";

export default function SwapPage() {
  const tr = useT();
  const [rows, setRows] = useState<SwapItem[]>(SWAPS);
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => rows.filter((s) => !s.taken), [rows]);
  const shown = useMemo(() => {
    if (filter === "free") return open.filter((s) => s.wants.toLowerCase().startsWith("free"));
    if (filter === "children") return open.filter((s) =>
      /uniform|shoe|baby|child|class/i.test(s.what + s.size));
    return open;
  }, [open, filter]);
  const taken = useMemo(() => rows.filter((s) => s.taken), [rows]);

  const claim = useCallback((id: string) => {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, taken: true } : s)));
    const s = rows.find((x) => x.id === id);
    setNote(`${s?.from} has been told. Collect it from her — nothing is posted, nothing is charged.`);
  }, [rows]);

  return (
    <HomeShell active="/app/swap">
      <div className="flex flex-col gap-5">

        <PhoneTitle title={tr("swap.passItOn")} sub={tr("swap.whatSomeoneNearYouNoLonger")}
                    note="Uniforms outgrown, baby things finished with, a lehenga worn once. Collected in person from a woman you know. No prices, no posting, no fee.">
          <Btn icon="Plus" className={`mt-4 ${phonePrimary}`}
               onClick={() => setNote("Photograph it where it is. No studio, no measurements, no listing fee.")}>{tr("swap.offerSomething")}</Btn>
        </PhoneTitle>
        <header className="hidden flex-wrap items-end gap-4 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("swap.passItOn")}</p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("swap.whatSomeoneNearYouNoLonger")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Uniforms outgrown, baby things finished with, a lehenga worn once. Collected in
              person from a woman you know. No prices, no posting, no fee.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => setNote("Photograph it where it is. No studio, no measurements, no listing fee.")}>{tr("swap.offerSomething")}</Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(open.length)} label={tr("swap.goingSpareNearYou")} icon="Gift"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={String(open.filter((s) => s.wants.toLowerCase().startsWith("free")).length)}
                  label={tr("swap.freeNoSwapWanted")} icon="Heart" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(taken.length)} label={tr("swap.foundANewHome")} icon="Check"
                  tint="--ux-surface-2" ink="--ux-muted" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <GroupLabel sub={tr("swap.allWithinWalkingDistance")} count={shown.length}>{tr("swap.goingSpare")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("swap.goingSpare")} sub={tr("swap.allWithinWalkingDistance")} icon="Gift"
                         chip={String(shown.length)} />
          </div>
          {/* One of three, so on a phone it is a segmented control. */}
          <SegmentedControl<Filter> className="mb-4 lg:hidden" label={tr("swap.goingSpare")}
            value={filter} onChange={setFilter}
            options={[
              { value: "all", label: "Everything" },
              { value: "free", label: "Free" },
              { value: "children", label: tr("swap.forChildren") },
            ]} />
          <div className="mb-3.5 hidden flex-wrap gap-2 lg:flex">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Heart" selected={filter === "free"} onClick={() => setFilter("free")}>Free</Chip>
            <Chip icon="Baby" selected={filter === "children"} onClick={() => setFilter("children")}>{tr("swap.forChildren")}</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="Gift" title={tr("swap.nothingHereJustNow")}
                              body="Try another filter, or offer something yourself — someone always needs a uniform in June."
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>{tr("swap.showEverything")}</Btn>} /></Card>
          ) : (
            <>
            {/* On a phone: one grouped list — the thing, its condition, who and
                how far, what she wants for it, and the button. */}
            <ListGroup className="lg:hidden">
              {shown.map((s) => {
                const c = CONDITION[s.condition];
                return (
                  <PhoneRow key={s.id} icon={s.icon} tint={s.tint} ink={s.ink}
                            title={
                              <span className="flex flex-wrap items-center gap-2">
                                {s.what}
                                <span className="rounded-full px-2 py-[2px] text-[13px] font-semibold"
                                      style={{ background: v(c.tint), color: v(c.ink) }}>{s.condition}</span>
                              </span>
                            }
                            meta={`${s.from} · ${s.km} km${s.size ? ` · ${s.size}` : ""}`}
                            body={s.wants}>
                    <Btn size="sm" full className="mt-3 max-lg:px-4" onClick={() => claim(s.id)}>{tr("swap.askHerForIt")}</Btn>
                  </PhoneRow>
                );
              })}
            </ListGroup>
            <div className="hidden gap-3 sm:grid-cols-2 lg:grid">
              {shown.map((s) => {
                const c = CONDITION[s.condition];
                return (
                  <Card key={s.id} pad={16}>
                    <div className="flex items-start gap-3.5">
                      <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={44} radius={13} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.what}</p>
                          <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
                                style={{ background: v(c.tint), color: v(c.ink) }}>{s.condition}</span>
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                          {s.from} · {s.km} km{s.size ? ` · ${s.size}` : ""}
                        </p>
                        <p className="mt-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                          {s.wants}
                        </p>
                      </div>
                    </div>
                    <Btn size="sm" full className="mt-3" onClick={() => claim(s.id)}>{tr("swap.askHerForIt")}</Btn>
                  </Card>
                );
              })}
            </div>
            </>
          )}
        </div>

        {taken.length > 0 && (
          <div>
            <GroupLabel count={taken.length}>{tr("swap.alreadyGone")}</GroupLabel>
            <div className="hidden lg:block">
              <SectionHead title={tr("swap.alreadyGone")} icon="Check" chip={String(taken.length)} />
            </div>
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {taken.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="Check" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.6} />
                    <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>{s.what} · from {s.from}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing here has a price and nothing is posted. This is the swap women already do at
              the school gate — it just means you know what is going spare before you buy new.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

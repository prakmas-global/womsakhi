"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, Chip, EmptyState, I, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { MOVES, POCKETS } from "@/components/ux/vault/data";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";

/**
 * Every movement, and where it went.
 *
 * Grouped by day rather than listed flat, because "what happened on Tuesday"
 * is the question she actually asks. The `auto` marker is deliberately loud:
 * money that moved without her touching it must be the easiest thing on the
 * screen to spot, or the rules stop feeling trustworthy.
 */
export default function HistoryPage() {
  const tr = useT();
  const router = useRouter();
  const [pocket, setPocket] = useState<string>("all");
  const [shown, setShown] = useState(true);

  const rows = useMemo(
    () => (pocket === "all" ? MOVES : MOVES.filter((m) => m.pocket === pocket)),
    [pocket],
  );

  const days = useMemo(() => {
    const by = new Map<string, typeof MOVES>();
    for (const m of rows) by.set(m.when, [...(by.get(m.when) ?? []), m]);
    return [...by.entries()];
  }, [rows]);

  const inMinor = useMemo(() => rows.filter((m) => m.minor > 0).reduce((n, m) => n + m.minor, 0), [rows]);
  const outMinor = useMemo(() => rows.filter((m) => m.minor < 0).reduce((n, m) => n - m.minor, 0), [rows]);
  const money = (n: number) => (shown ? formatRupees(n) : "••••");

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-5">
        <Back to="/app/vault" label={tr("vaultHistory.backToYourLocker")} />

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("vaultHistory.everyMovement")}</p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("vaultHistory.whatCameInWhatWentOut")}</h1>
          </div>
          <Btn variant="outline" icon={shown ? "EyeOff" : "Eye"} onClick={() => setShown((s) => !s)}>
            {shown ? tr("vaultHistory.hideAmounts")
              : tr("vaultHistory.showAmounts")}
          </Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={money(inMinor)} label={tr("vaultHistory.cameIn")} icon="ArrowDownLeft"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={money(outMinor)} label={tr("vaultHistory.wentOut")} icon="ArrowUpRight"
                  tint="--ux-surface-2" ink="--ux-muted" />
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Chip selected={pocket === "all"} onClick={() => setPocket("all")} icon="LayoutGrid">{tr("vaultHistory.everyPocket")}</Chip>
          {POCKETS.map((p) => (
            <Chip key={p.id} selected={pocket === p.name} onClick={() => setPocket(p.name)} icon={p.icon}>
              {p.name}
            </Chip>
          ))}
        </div>

        {days.length === 0 ? (
          <Card>
            <EmptyState icon="History" title={COPY.nothingHereYet}
                        body="No money has moved in or out of this pocket."
                        action={<Btn size="sm" variant="outline" onClick={() => setPocket("all")}>{tr("vaultHistory.showEveryPocket")}</Btn>} />
          </Card>
        ) : (
          days.map(([day, list]) => (
            <div key={day}>
              <SectionHead title={day} icon="CalendarDays" chip={String(list.length)} />
              <Card pad={0}>
                <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                  {list.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full"
                            style={{
                              background: v(m.minor > 0 ? "--ux-tint-green" : "--ux-surface-2"),
                              color: v(m.minor > 0 ? "--ux-green-ink" : "--ux-muted"),
                            }}>
                        <I name={m.minor > 0 ? "ArrowDownLeft" : "ArrowUpRight"} className="h-[16px] w-[16px]" sw={2.4} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: v("--ux-ink") }}>
                          {m.what}
                          {m.automatic && (
                            <span className="ml-2 rounded-full px-1.5 py-[1px] text-2xs font-bold uppercase tracking-[0.06em]"
                                  style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                              a rule did this
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: v("--ux-muted") }}>{m.pocket}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums"
                         style={{ color: v(m.minor > 0 ? "--ux-green-ink" : "--ux-ink-2") }}>
                        {m.minor > 0 ? "+" : "−"}{money(Math.abs(m.minor))}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))
        )}
      </div>
    </HomeShell>
  );
}

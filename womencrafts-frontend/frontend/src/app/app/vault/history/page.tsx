"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, Chip, EmptyState, I, SourceNote, Stat, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiGuards, apiVault, apiVaultMoves,
  type Guards, type Moves, type Vault,
} from "@/lib/vault-api";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";

/**
 * Every movement, and where it went.
 *
 * Grouped by day rather than listed flat, because "what happened on Tuesday"
 * is the question she actually asks. The `auto` marker is deliberately loud:
 * money that moved without her touching it must be the easiest thing on the
 * screen to spot, or the rules stop feeling trustworthy.
 *
 * The day headings are computed from each movement's real date, so a row she
 * back-dated to last Tuesday files under last Tuesday. The fixture this screen
 * used to read stored the day as the literal word "Today", which meant every
 * entry ever made would have sat under "Today" forever.
 */
export default function HistoryPage() {
  const tr = useT();
  const [pocket, setPocket] = useState<string>("all");
  const [revealed, setRevealed] = useState(false);

  const moves = useResource<Moves>(
    useCallback((s) => apiVaultMoves(500, s), []),
    { moves: [], in_minor: 0, out_minor: 0, count: 0 },
  );
  const vault = useResource<Vault>(
    useCallback((s) => apiVault(s), []),
    { pockets: [], total_minor: 0, instant_minor: 0, count: 0 },
  );
  const guards = useResource<Guards>(
    useCallback((s) => apiGuards(s), []),
    { hide_amount: true, pin_to_move: true, quiet_notifications: true, quick_exit: false },
  );

  const shown = revealed || !guards.data.hide_amount;

  const rows = useMemo(
    () => (pocket === "all" ? moves.data.moves : moves.data.moves.filter((m) => m.pocket_id === pocket)),
    [pocket, moves.data.moves],
  );

  /** Grouped by the real calendar day, newest first. */
  const days = useMemo(() => {
    const by = new Map<string, typeof rows>();
    for (const m of rows) {
      const key = dayKey(m.on);
      by.set(key, [...(by.get(key) ?? []), m]);
    }
    return [...by.entries()];
  }, [rows]);

  const inMinor = useMemo(() => rows.filter((m) => m.minor > 0).reduce((n, m) => n + m.minor, 0), [rows]);
  const outMinor = useMemo(() => rows.filter((m) => m.minor < 0).reduce((n, m) => n - m.minor, 0), [rows]);
  const money = (n: number) => (shown ? formatRupees(n) : "••••");

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/vault" label={tr("vaultHistory.backToYourLocker")} />

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("vaultHistory.everyMovement")}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("vaultHistory.whatCameInWhatWentOut")}</h1>
          </div>
          <Btn variant="outline" icon={shown ? "EyeOff" : "Eye"} className="max-lg:w-full" onClick={() => setRevealed((s) => !s)}>
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

        <SourceNote source={moves.source} what="these movements" />

        {vault.data.pockets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip selected={pocket === "all"} onClick={() => setPocket("all")} icon="LayoutGrid">{tr("vaultHistory.everyPocket")}</Chip>
            {vault.data.pockets.map((p) => (
              <Chip key={p.id} selected={pocket === p.id} onClick={() => setPocket(p.id)} icon={p.icon}>
                {p.name}
              </Chip>
            ))}
          </div>
        )}

        {days.length === 0 ? (
          <Card>
            <EmptyState icon="History" title={COPY.nothingHereYet}
                        body={tr("vaultHistory.noMoneyHasMovedInOr")}
                        action={pocket === "all"
                          ? <Btn size="sm" variant="outline" href="/app/vault">Back to your pockets</Btn>
                          : <Btn size="sm" variant="outline" onClick={() => setPocket("all")}>{tr("vaultHistory.showEveryPocket")}</Btn>} />
          </Card>
        ) : (
          days.map(([day, list]) => (
            <div key={day}>
              <Section title={day} icon="CalendarDays" chip={String(list.length)} />
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
                              {tr("vaultHistory.aRuleDidThis")}
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

/** The heading a day gets. Recent days are words; older ones are dates. */
function dayKey(iso: string): string {
  const then = new Date(iso);
  if (!iso || Number.isNaN(then.getTime())) return "Undated";
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

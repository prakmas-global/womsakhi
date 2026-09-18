"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { Btn, Card, I, IconTile, Pill, Progress, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import {
  MOVES, POCKETS, RULES, emergency, savedByRules, total,
  type Pocket,
} from "@/components/ux/vault/data";
import { useT } from "@/i18n";

/**
 * Her vault.
 *
 * The design decision that carries this screen: **the amount is hidden until
 * she asks for it.** Handsets are shared, and a balance readable over her
 * shoulder is not really hers. Everything else here follows from the same
 * evidence — that money reaching a woman privately does more than the same
 * money reaching her openly.
 */

const DOTS = "••••••";

export default function VaultPage() {
  const tr = useT();
  const [pockets, setPockets] = useState<Pocket[]>(POCKETS);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const all = useMemo(() => total(pockets), [pockets]);
  const sos = useMemo(() => emergency(pockets), [pockets]);
  const auto = useMemo(() => savedByRules(RULES), []);
  const activeRules = useMemo(() => RULES.filter((r) => r.on).length, []);

  const money = useCallback(
    (minor: number) => (shown ? formatRupees(minor) : DOTS),
    [shown],
  );

  const move = useCallback((id: string, delta: number, label: string) => {
    setBusy(id);
    setPockets((rows) =>
      rows.map((p) => (p.id === id ? { ...p, minor: Math.max(0, p.minor + delta) } : p)),
    );
    setNote(label);
    setTimeout(() => setBusy(null), 300);
  }, []);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("vault.yourLocker")}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("vault.moneyThatIsYours")}</h1>
            <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("vault.keptSeparateKeptQuietAndReachable")}</p>
          </div>
          {/* On a phone these two are rows in a group at the foot of the
              screen — destinations, not buttons beside a title. */}
          <div className="hidden flex-wrap gap-2 lg:flex">
            <Btn variant="outline" icon="Smartphone" href="/app/vault/showing">{tr("vault.showingSomeone")}</Btn>
            <Btn variant="ghost" icon="ShieldCheck" href="/app/vault/privacy">{tr("vault.whoCanSee")}</Btn>
          </div>
        </header>

        {/* The balance — hidden until asked for. This is the feature. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="p-4 lg:px-6 lg:pt-6 lg:pb-5"
               style={{ background: `linear-gradient(135deg, ${v("--ux-brand")}, ${v("--ux-brand-700")})` }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:font-bold lg:tracking-[0.16em]"
                   style={{ color: v("--ux-on-brand-2") }}>{tr("vault.yoursAltogether")}</p>
                <p className="mt-2 text-[28px] font-extrabold lg:text-[clamp(1.875rem,5vw,2.75rem)] leading-none tabular-nums tracking-[-0.03em]"
                   style={{ color: v("--ux-on-brand") }}>
                  {shown ? formatRupees(all) : DOTS}
                </p>
                <p className="mt-2.5 text-xsm" style={{ color: v("--ux-on-brand-2") }}>
                  Across {pockets.length} pockets · <b>{shown ? formatRupees(auto) : DOTS}</b> of it
                  saved without you thinking about it
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShown((s) => !s)}
                aria-pressed={shown}
                aria-label={shown ? tr("vault.hideTheAmount")
              : tr("vault.showTheAmount")}
                className="ux-press ux-sq grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                style={{ background: v("--ux-on-brand-fill"), color: v("--ux-on-brand") }}
              >
                <I name={shown ? "Eye" : "EyeOff"} className="h-[19px] w-[19px]" />
              </button>
            </div>
          </div>

          {!shown && (
            <div className="flex items-center gap-2.5 px-4 py-3 lg:px-6"
                 style={{ background: v("--ux-surface-2") }}>
              <I name="EyeOff" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
              <p className="text-xsm" style={{ color: v("--ux-ink-2") }}>{tr("vault.hiddenOnPurposeTapTheEye")}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 p-4 lg:px-6">
            <Btn icon="ArrowDownToLine" className="ux-action-primary" onClick={() => setNote("Add money to which pocket? Choose one below.")}>{tr("vault.putMoneyIn")}</Btn>
            <Btn variant="outline" icon="Zap" className="max-lg:w-full"
                 onClick={() => setNote(`${sos ? formatRupees(sos.minor) : "Nothing"} is ready right now, with no waiting.`)}>{tr("vault.iNeedMoneyNow")}</Btn>
            <Btn variant="ghost" icon="Repeat" href="/app/vault/rules" className="max-lg:w-full">
              Saving rules ({activeRules})
            </Btn>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Emergency money — called out because it answers the one thing a
            rotating pot cannot: money on the night you need it. */}
        {sos && (
          <Card style={{ borderColor: v("--ux-green-ink") }}>
            <div className="flex flex-wrap items-start gap-4">
              <IconTile icon="LifeBuoy" tint="--ux-tint-green" ink="--ux-green-ink" size={46} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{sos.name}</p>
                  <Pill tone="green" size="sm">{tr("vault.noWaiting")}</Pill>
                </div>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
                  A savings pot only pays on your turn. This does not wait for a turn, a vote,
                  or anyone&rsquo;s permission.
                </p>
                {sos.goalMinor && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs"
                         style={{ color: v("--ux-muted") }}>
                      <span>{money(sos.minor)} of {money(sos.goalMinor)}</span>
                      <span className="font-bold tabular-nums" style={{ color: v("--ux-green-ink") }}>
                        {Math.round((sos.minor / sos.goalMinor) * 100)}%
                      </span>
                    </div>
                    <Progress pct={(sos.minor / sos.goalMinor) * 100} tone="--ux-green-ink" track="--ux-tint-green" />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2 max-lg:w-full max-lg:ps-[62px] max-lg:[&>*]:flex-1">
                <Btn size="sm" variant="outline" disabled={busy === sos.id}
                     onClick={() => move(sos.id, 50000, "₹500 added to your emergency money.")}>{tr("vault.add")}</Btn>
                <Btn size="sm" disabled={busy === sos.id || sos.minor === 0}
                     onClick={() => move(sos.id, -50000, "₹500 taken out. It is in your wallet now.")}>{tr("vault.take")}</Btn>
              </div>
            </div>
          </Card>
        )}

        {/* Pockets */}
        <div>
          <Section
            title={tr("vault.yourPockets")}
            sub={tr("vault.moneySplitByWhatItIs")}
            icon="Wallet"
            action="See every movement"
            onAction={() => { window.location.href = "/app/vault/history"; }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {pockets.map((p) => (
              <Card key={p.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={p.icon} tint={p.tint} ink={p.ink} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{p.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{p.note}</p>
                  </div>
                </div>
                <p className="mt-3 text-xl font-extrabold leading-none tabular-nums"
                   style={{ color: v("--ux-ink") }}>{money(p.minor)}</p>
                {p.goalMinor && (
                  <div className="mt-2.5">
                    <Progress pct={(p.minor / p.goalMinor) * 100} tone={p.ink} track={p.tint} h={5} />
                    <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
                      Aiming for {money(p.goalMinor)}
                    </p>
                  </div>
                )}
                <div className="mt-3.5 flex gap-2">
                  <Btn size="sm" variant="outline" full disabled={busy === p.id}
                       onClick={() => move(p.id, 10000, `₹100 added to ${p.name.toLowerCase()}.`)}>{tr("vault.add2")}</Btn>
                  <Btn size="sm" variant="ghost" full disabled={busy === p.id || p.minor === 0}
                       onClick={() => move(p.id, -10000, `₹100 taken from ${p.name.toLowerCase()}.`)}>{tr("vault.take2")}</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent */}
        <div>
          <Section title="Lately" icon="History" action="All of it"
                       onAction={() => { window.location.href = "/app/vault/history"; }} />
          <Card pad={0}>
            <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
              {MOVES.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
                        style={{
                          background: v(m.minor > 0 ? "--ux-tint-green" : "--ux-surface-2"),
                          color: v(m.minor > 0 ? "--ux-green-ink" : "--ux-muted"),
                        }}>
                    <I name={m.minor > 0 ? "ArrowDownLeft" : "ArrowUpRight"} className="h-[15px] w-[15px]" sw={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                      {m.what}
                      {m.automatic && (
                        <span className="ml-2 rounded-full px-1.5 py-[1px] text-2xs font-bold uppercase tracking-[0.06em]"
                              style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>auto</span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: v("--ux-muted") }}>{m.when} · {m.pocket}</p>
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

        <ListGroup className="lg:hidden">
          <ListRow href="/app/vault/showing" icon="Smartphone" tint="violet" title={tr("vault.showingSomeone")} />
          <ListRow href="/app/vault/privacy" icon="ShieldCheck" tint="green" title={tr("vault.whoCanSee")} />
        </ListGroup>
      </div>
    </HomeShell>
  );
}

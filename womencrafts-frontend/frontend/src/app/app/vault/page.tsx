"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { Btn, Card, EmptyState, I, IconTile, Pill, Progress, SourceNote, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Text } from "@/components/ux/kit/form";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiAddMove, apiAddPocket, apiGuards, apiVault, apiVaultMoves, apiVaultRules,
  type Guards, type Moves, type Pocket, type Rules, type Vault,
} from "@/lib/vault-api";
import { useT } from "@/i18n";

/**
 * Her vault.
 *
 * The design decision that carries this screen: **the amount is hidden until
 * she asks for it.** Handsets are shared, and a balance readable over her
 * shoulder is not really hers. Everything else here follows from the same
 * evidence — that money reaching a woman privately does more than the same
 * money reaching her openly.
 *
 * ── WomSakhi holds none of this ─────────────────────────────────────────────
 * Every rupee stays where it already is: in her hand, in her own account, in
 * the chit. What this screen shows is her earmark — which part of what she
 * already has is spoken for, and for what. The line under the total says so,
 * because a woman who thought this app was holding her savings would one day
 * come looking for them.
 *
 * ── Why the empty state is empty ────────────────────────────────────────────
 * Until this was wired, the screen ran on a fixture: ₹15,625 across four
 * pockets, none of it hers. On a savings screen that is the one lie that
 * matters, so the fallback here is an empty vault, never a populated one. A
 * woman who has saved nothing yet sees nothing, and is asked whether she would
 * like to start.
 */

const DOTS = "••••••";

/** Fallback is empty on purpose. See the note above. */
const NO_VAULT: Vault = { pockets: [], total_minor: 0, instant_minor: 0, count: 0 };
const NO_MOVES: Moves = { moves: [], in_minor: 0, out_minor: 0, count: 0 };
const NO_RULES: Rules = { rules: [], saved_minor: 0, count: 0 };
const PRIVATE: Guards = {
  hide_amount: true, pin_to_move: true, quiet_notifications: true, quick_exit: false,
};

/**
 * The pockets almost every woman ends up naming anyway, offered as one tap
 * each rather than as a blank form. The first is pre-selected because
 * emergency money is the one that changes what happens to her.
 */
const STARTERS = [
  { name: "For an emergency", note: "Yours the moment you need it — no turn to wait for",
    icon: "LifeBuoy", tint: "--ux-tint-green", ink: "--ux-green-ink", goal_minor: 500000 },
  { name: "Just mine", note: "Not for the house, not for anyone else",
    icon: "Lock", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { name: "Stock for the shop", note: "What the next season has to be bought with",
    icon: "Package", tint: "--ux-tint-blue", ink: "--ux-blue-ink", goal_minor: 600000 },
  { name: "If someone falls ill", note: "So a hospital day does not become a loan",
    icon: "HeartPulse", tint: "--ux-tint-pink", ink: "--ux-pink-ink", goal_minor: 400000 },
];

export default function VaultPage() {
  const tr = useT();

  const vault = useResource<Vault>(useCallback((s) => apiVault(s), []), NO_VAULT);
  const moves = useResource<Moves>(useCallback((s) => apiVaultMoves(5, s), []), NO_MOVES);
  const rules = useResource<Rules>(useCallback((s) => apiVaultRules(s), []), NO_RULES);
  const guards = useResource<Guards>(useCallback((s) => apiGuards(s), []), PRIVATE);

  // Starts hidden, and stays hidden unless she has turned that guard off.
  // Reading it from the server rather than assuming means the setting on the
  // privacy screen is the setting that acts here.
  const [revealed, setRevealed] = useState(false);
  const shown = revealed || !guards.data.hide_amount;

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** The add/take sheet. `sign` is +1 putting in, −1 taking out. */
  const [sheet, setSheet] = useState<{ pocket: Pocket; sign: 1 | -1 } | null>(null);
  const [amount, setAmount] = useState("");
  const [why, setWhy] = useState("");

  const pockets = vault.data.pockets;
  const sos = useMemo(() => pockets.find((p) => p.instant) ?? pockets[0], [pockets]);
  const activeRules = rules.data.rules.filter((r) => r.on).length;
  const auto = rules.data.saved_minor;

  const money = useCallback(
    (minor: number) => (shown ? formatRupees(minor) : DOTS),
    [shown],
  );

  const refreshAll = useCallback(() => {
    vault.refetch(); moves.refetch(); rules.refetch();
  }, [vault, moves, rules]);

  const submit = useCallback(async () => {
    if (!sheet) return;
    // She types rupees; everything below this line is paise.
    const rupeesTyped = Number(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(rupeesTyped) || rupeesTyped <= 0) {
      setErr("Type how much, in rupees."); return;
    }
    const minor = Math.round(rupeesTyped * 100) * sheet.sign;
    setBusy(sheet.pocket.id); setErr(null);
    try {
      await apiAddMove({
        pocket_id: sheet.pocket.id,
        what: why.trim() || (sheet.sign > 0 ? "Set aside" : "Taken out"),
        minor,
      });
      setNote(sheet.sign > 0
        ? `${formatRupees(Math.abs(minor))} set aside in ${sheet.pocket.name.toLowerCase()}.`
        : `${formatRupees(Math.abs(minor))} taken from ${sheet.pocket.name.toLowerCase()}. It is yours to spend.`);
      setSheet(null); setAmount(""); setWhy("");
      refreshAll();
    } catch (e) {
      // The server refuses an overdraw by name, and that message is better
      // than anything this screen could invent.
      setErr(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  }, [sheet, amount, why, refreshAll]);

  const startPockets = useCallback(async () => {
    setBusy("start");
    try {
      for (const p of STARTERS) await apiAddPocket(p);
      setNote("Your pockets are ready. Nothing is in them yet — that part is yours.");
      refreshAll();
    } catch {
      setErr("Could not set those up just now.");
    } finally { setBusy(null); }
  }, [refreshAll]);

  const empty = vault.source !== "loading" && pockets.length === 0;

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
                  {shown ? formatRupees(vault.data.total_minor) : DOTS}
                </p>
                <p className="mt-2.5 text-xsm" style={{ color: v("--ux-on-brand-2") }}>
                  {pockets.length === 0
                    ? "Nothing set aside yet"
                    : <>Across {pockets.length} {pockets.length === 1 ? "pocket" : "pockets"}
                        {auto > 0 && <> · <b>{shown ? formatRupees(auto) : DOTS}</b> of it kept by a rule</>}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevealed((s) => !s)}
                aria-pressed={shown}
                aria-label={shown ? tr("vault.hideTheAmount") : tr("vault.showTheAmount")}
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

          {/* The sentence that keeps this honest. She is not looking at money
              WomSakhi holds, and must never think she is. */}
          <div className="flex items-start gap-2.5 px-4 py-3 lg:px-6"
               style={{ borderTop: `1px solid ${v("--ux-line")}` }}>
            <I name="Info" className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              This money stays where it already is — with you, or in your own account. WomSakhi
              does not hold it. What is written here is which part of it you have set aside, and
              for what.
            </p>
          </div>

          {pockets.length > 0 && (
            <div className="flex flex-wrap gap-2 p-4 lg:px-6">
              <Btn icon="ArrowDownToLine" className="ux-action-primary"
                   onClick={() => { setSheet({ pocket: sos ?? pockets[0], sign: 1 }); setErr(null); }}>
                {tr("vault.putMoneyIn")}
              </Btn>
              {sos && (
                <Btn variant="outline" icon="Zap" className="max-lg:w-full"
                     onClick={() => setNote(
                       sos.minor > 0
                         ? `${formatRupees(sos.minor)} is in ${sos.name.toLowerCase()}, ready now, with no waiting.`
                         : `There is nothing in ${sos.name.toLowerCase()} yet.`)}>
                  {tr("vault.iNeedMoneyNow")}
                </Btn>
              )}
              <Btn variant="ghost" icon="Repeat" href="/app/vault/rules" className="max-lg:w-full">
                Saving rules ({activeRules})
              </Btn>
            </div>
          )}
        </Card>

        <SourceNote source={vault.source} what="what you have set aside" />

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" />{note}
            </p>
          </Card>
        )}
        {err && !sheet && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="h-[16px] w-[16px] shrink-0" />{err}
            </p>
          </Card>
        )}

        {/* Nothing yet. Offered rather than demanded — and honest that the
            money part is hers to do, because we cannot do it for her. */}
        {empty && (
          <EmptyState
            icon="Lock"
            title="Nothing set aside yet"
            body="A pocket is a name for money you have already got — kept for one thing, so it is still there when that thing happens. Start with the four most women name, and rename or remove any of them later."
            action={
              <Btn icon="Sparkles" loading={busy === "start"} onClick={startPockets}>
                Set up my pockets
              </Btn>
            }
          />
        )}

        {/* Emergency money — called out because it answers the one thing a
            rotating pot cannot: money on the night you need it. */}
        {sos && (
          <Card style={{ borderColor: v("--ux-green-ink") }}>
            <div className="flex flex-wrap items-start gap-4">
              <IconTile icon={sos.icon} tint="--ux-tint-green" ink="--ux-green-ink" size={46} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{sos.name}</p>
                  <Pill tone="green" size="sm">{tr("vault.noWaiting")}</Pill>
                </div>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
                  A savings pot only pays on your turn. This does not wait for a turn, a vote,
                  or anyone&rsquo;s permission.
                </p>
                {sos.goal_minor ? (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs"
                         style={{ color: v("--ux-muted") }}>
                      <span>{money(sos.minor)} of {money(sos.goal_minor)}</span>
                      <span className="font-bold tabular-nums" style={{ color: v("--ux-green-ink") }}>
                        {Math.round((sos.minor / sos.goal_minor) * 100)}%
                      </span>
                    </div>
                    <Progress pct={(sos.minor / sos.goal_minor) * 100} tone="--ux-green-ink" track="--ux-tint-green" />
                  </div>
                ) : (
                  <p className="mt-3 text-xl font-extrabold leading-none tabular-nums"
                     style={{ color: v("--ux-ink") }}>{money(sos.minor)}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2 max-lg:w-full max-lg:ps-[62px] max-lg:[&>*]:flex-1">
                <Btn size="sm" variant="outline" disabled={busy === sos.id}
                     onClick={() => { setSheet({ pocket: sos, sign: 1 }); setErr(null); }}>{tr("vault.add")}</Btn>
                <Btn size="sm" disabled={busy === sos.id || sos.minor === 0}
                     onClick={() => { setSheet({ pocket: sos, sign: -1 }); setErr(null); }}>{tr("vault.take")}</Btn>
              </div>
            </div>
          </Card>
        )}

        {/* Pockets */}
        {pockets.length > 0 && (
          <div>
            <Section
              title={tr("vault.yourPockets")}
              sub={tr("vault.moneySplitByWhatItIs")}
              icon="Wallet"
              action={tr("vault.seeEveryMovement")}
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
                  {p.goal_minor ? (
                    <div className="mt-2.5">
                      <Progress pct={(p.minor / p.goal_minor) * 100} tone={p.ink} track={p.tint} h={5} />
                      <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
                        Aiming for {money(p.goal_minor)}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3.5 flex gap-2">
                    <Btn size="sm" variant="outline" full disabled={busy === p.id}
                         onClick={() => { setSheet({ pocket: p, sign: 1 }); setErr(null); }}>{tr("vault.add2")}</Btn>
                    <Btn size="sm" variant="ghost" full disabled={busy === p.id || p.minor === 0}
                         onClick={() => { setSheet({ pocket: p, sign: -1 }); setErr(null); }}>{tr("vault.take2")}</Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent */}
        {moves.data.moves.length > 0 && (
          <div>
            <Section title="Lately" icon="History" action={tr("vault.allOfIt")}
                         onAction={() => { window.location.href = "/app/vault/history"; }} />
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {moves.data.moves.map((m) => (
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
                      <p className="text-xs" style={{ color: v("--ux-muted") }}>{whenWord(m.on)} · {m.pocket}</p>
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
        )}

        <ListGroup className="lg:hidden">
          <ListRow href="/app/vault/showing" icon="Smartphone" tint="violet" title={tr("vault.showingSomeone")} />
          <ListRow href="/app/vault/privacy" icon="ShieldCheck" tint="green" title={tr("vault.whoCanSee")} />
        </ListGroup>
      </div>

      {/* Putting in and taking out. One sheet, because they are the same act
          with a sign — and because taking money out must not be harder or
          more shameful than putting it in. */}
      <Sheet
        open={!!sheet}
        onClose={() => { setSheet(null); setErr(null); }}
        icon={sheet?.sign === 1 ? "ArrowDownToLine" : "ArrowUpRight"}
        title={sheet ? (sheet.sign === 1 ? `Set aside in ${sheet.pocket.name}` : `Take from ${sheet.pocket.name}`) : ""}
        description={sheet?.sign === 1
          ? "Money you already have, marked as spoken for. It stays with you."
          : "Money you are taking back to spend. This is what the pocket is for."}
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setSheet(null); setErr(null); }}>Cancel</Btn>
            <Btn full loading={!!busy && busy !== "start"} onClick={submit}>
              {sheet?.sign === 1 ? "Set aside" : "Take out"}
            </Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {sheet && sheet.sign === -1 && (
            <p className="rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
              There is {formatRupees(sheet.pocket.minor)} in this pocket.
            </p>
          )}
          <div>
            <Label need>How much</Label>
            <Text value={amount} onChange={setAmount} label="How much, in rupees"
                  placeholder="500" prefix="₹" type="text" />
          </div>
          <div>
            <Label hint="So it makes sense to you later">What for</Label>
            <Text value={why} onChange={setWhy} label="What this is for"
                  placeholder={sheet?.sign === 1 ? "Kept from a blouse order" : "Medicine for Amma"} max={140} />
          </div>
          {err && (
            <p className="flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0" />{err}
            </p>
          )}
        </div>
      </Sheet>
    </HomeShell>
  );
}

/**
 * "Today", "Yesterday", then the date. She reads the last few days far more
 * often than the rest, and those are the two words she actually wants.
 */
function whenWord(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

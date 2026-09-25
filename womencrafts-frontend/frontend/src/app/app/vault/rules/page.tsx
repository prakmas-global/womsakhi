"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, SourceNote, Stat, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Select, Text } from "@/components/ux/kit/form";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  TRIGGER_LABEL, apiAddRule, apiDeleteRule, apiEditRule, apiVault, apiVaultRules,
  type RuleTrigger, type Rules, type Vault,
} from "@/lib/vault-api";
import { useT } from "@/i18n";

/**
 * Saving by default, not by decision.
 *
 * Every rule is a share of something that just happened rather than a date in
 * a calendar. Her income is irregular — a fixed monthly transfer fails in a
 * lean month and quietly under-saves in a good one, and then she stops trusting
 * it. "Keep ₹20 from every order" survives both.
 *
 * ── A rule asks; it does not take ───────────────────────────────────────────
 * WomSakhi holds none of this money, so nothing here can move a rupee on its
 * own. What a rule does is *remind her at the moment it matters* — when the
 * payment lands, not on the first of the month — and the movement is written
 * only when she says yes.
 *
 * That is said plainly on the screen rather than left to be inferred. The
 * fixture this replaced showed ₹2,400 "saved without you thinking about it"
 * from rules that had never once run, which is the version of this screen that
 * costs her money: she would have believed she was saving and she was not.
 */
export default function RulesPage() {
  const tr = useT();
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [trigger, setTrigger] = useState<RuleTrigger>("order_paid");
  const [pocketId, setPocketId] = useState("");
  const [keep, setKeep] = useState("");
  const [kind, setKind] = useState<"amount" | "share">("amount");

  const rules = useResource<Rules>(
    useCallback((s) => apiVaultRules(s), []),
    { rules: [], saved_minor: 0, count: 0 },
  );
  const vault = useResource<Vault>(
    useCallback((s) => apiVault(s), []),
    { pockets: [], total_minor: 0, instant_minor: 0, count: 0 },
  );

  const rows = rules.data.rules;
  const on = useMemo(() => rows.filter((r) => r.on).length, [rows]);
  const pockets = vault.data.pockets;

  const toggle = useCallback(async (id: string, next: boolean) => {
    setBusy(id); setErr(null);
    try {
      const r = await apiEditRule(id, { on: next });
      setNote(next
        ? `On. ${TRIGGER_LABEL[r.trigger].toLowerCase()}, you will be asked to keep ${keepWords(r)} for ${r.into}.`
        : "Off. You will not be asked again.");
      rules.refetch();
    } catch {
      setErr("Could not change that just now.");
    } finally { setBusy(null); }
  }, [rules]);

  const remove = useCallback(async (id: string) => {
    setBusy(id); setErr(null);
    try {
      await apiDeleteRule(id);
      setNote("Rule removed. What it already put aside stays where it is.");
      rules.refetch();
    } catch {
      setErr("Could not remove that just now.");
    } finally { setBusy(null); }
  }, [rules]);

  const add = useCallback(async () => {
    const n = Number(keep.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) { setErr("Say how much to keep."); return; }
    if (kind === "share" && n > 100) { setErr("A share cannot be more than 100%."); return; }
    if (!pocketId) { setErr("Choose which pocket it goes to."); return; }
    setBusy("add"); setErr(null);
    try {
      await apiAddRule({
        trigger, pocket_id: pocketId,
        ...(kind === "amount" ? { keep_minor: Math.round(n * 100) } : { keep_pct: Math.round(n) }),
      });
      setNote("Rule added. You will be asked at the moment it applies.");
      setAdding(false); setKeep("");
      rules.refetch();
    } catch {
      setErr("Could not add that rule.");
    } finally { setBusy(null); }
  }, [trigger, pocketId, keep, kind, rules]);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/vault" label={tr("vaultRules.backToYourLocker")} />

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("vaultRules.savingRules")}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("vaultRules.saveWithoutDecidingTo")}</h1>
            <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              A small share of each payment, set aside the moment it arrives. Nothing is asked
              of you on a day you earned nothing.
            </p>
          </div>
          {pockets.length > 0 && (
            <Btn icon="Plus" className="max-lg:w-full"
                 onClick={() => { setAdding(true); setErr(null); setPocketId(pockets[0]?.id ?? ""); }}>
              Add a rule
            </Btn>
          )}
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(rules.data.saved_minor)} label={tr("vaultRules.savedThisWaySoFar")}
                  icon="Sparkles" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={`${on} of ${rows.length}`} label={tr("vaultRules.rulesRunning")}
                  icon="Repeat" tint="--ux-tint-green" ink="--ux-green-ink" />
          </div>
        </Card>

        <SourceNote source={rules.source} what="these rules" />

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" />{note}
            </p>
          </Card>
        )}
        {err && !adding && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="h-[16px] w-[16px] shrink-0" />{err}
            </p>
          </Card>
        )}

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon="Repeat"
              title="No rules yet"
              body={pockets.length === 0
                ? "Rules put money into a pocket, so name a pocket first. Then a rule can keep a little of each payment for it."
                : "A rule keeps a little of each payment for one pocket, and asks you at the moment the money arrives — which is the only moment it is easy to say yes."}
              action={pockets.length === 0
                ? <Btn size="sm" variant="outline" href="/app/vault">Go to your pockets</Btn>
                : <Btn size="sm" icon="Plus" onClick={() => { setAdding(true); setPocketId(pockets[0]?.id ?? ""); }}>Add a rule</Btn>}
            />
          </Card>
        ) : (
          <div>
            <Section title={tr("vaultRules.yourRules")} icon="Repeat" chip={String(rows.length)} />
            <div className={`flex flex-col gap-2.5 ${GROUP}`}>
              {rows.map((r) => (
                <Card key={r.id} pad={16} className={GROUP_ROW}>
                  <div className="flex flex-wrap items-start gap-3.5">
                    <IconTile icon={r.on ? "Repeat" : "Pause"}
                              tint={r.on ? "--ux-tint-green" : "--ux-surface-2"}
                              ink={r.on ? "--ux-green-ink" : "--ux-muted"} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
                        {TRIGGER_LABEL[r.trigger]}, keep <span style={{ color: v("--ux-brand") }}>{keepWords(r)}</span>
                      </p>
                      <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
                        Into &ldquo;{r.into}&rdquo;
                        {r.saved_minor > 0
                          ? ` · ${formatRupees(r.saved_minor)} so far`
                          : r.on ? " · nothing kept yet" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.on}
                        disabled={busy === r.id}
                        aria-label={`${r.on ? tr("vaultRules.turnOff") : tr("vaultRules.turnOn")}: ${TRIGGER_LABEL[r.trigger]}`}
                        onClick={() => toggle(r.id, !r.on)}
                        className="ux-press relative grid h-[28px] w-[50px] shrink-0 place-items-center rounded-full max-lg:-my-2 max-lg:h-[44px]"
                      >
                        {/* The track is drawn inside the button rather than being it. The app's
                            44px tap floor stretched a 28px switch into a 50x44 slab
                            with its knob stuck to the top; now the target is 44px
                            and the switch is still a switch. */}
                        <span className="relative h-[28px] w-[50px] rounded-full transition-colors"
                              style={{ background: v(r.on ? "--ux-brand" : "--ux-line-strong") }}>
                          <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
                                style={{ left: r.on ? 25 : 3, background: v("--ux-surface"),
                                         transition: "left var(--ux-t) var(--ux-ease-out)" }} />
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove this rule: ${TRIGGER_LABEL[r.trigger]}`}
                        disabled={busy === r.id}
                        onClick={() => remove(r.id)}
                        className="ux-press ux-sq grid h-[44px] w-[38px] place-items-center rounded-[10px]"
                        style={{ color: v("--ux-muted") }}
                      >
                        <I name="Trash2" className="h-[15px] w-[15px]" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              A rule never moves money by itself — WomSakhi does not hold your money and cannot
              touch it. What it does is ask you, at the moment the payment lands, whether to set
              that bit aside. Nothing is kept on a day you earned nothing.
            </p>
          </div>
        </Card>
      </div>

      <Sheet
        open={adding}
        onClose={() => { setAdding(false); setErr(null); }}
        icon="Repeat"
        title="Add a saving rule"
        description="A share of something that just happened, never a date in the calendar."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setAdding(false); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy === "add"} onClick={add}>Add rule</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label need>When</Label>
            <Select value={trigger} onChange={(s) => setTrigger(s as RuleTrigger)} label="When this rule applies"
                    options={(Object.keys(TRIGGER_LABEL) as RuleTrigger[]).map((k) => ({ value: k, label: TRIGGER_LABEL[k] }))} />
          </div>
          <div>
            <Label need>Keep</Label>
            <div className="flex gap-2">
              <Select value={kind} onChange={(s) => setKind(s as "amount" | "share")} label="An amount or a share"
                      options={[{ value: "amount", label: "An amount" }, { value: "share", label: "A share" }]} />
              <Text value={keep} onChange={setKeep} label={kind === "amount" ? "How many rupees" : "What percent"}
                    placeholder={kind === "amount" ? "20" : "10"} prefix={kind === "amount" ? "₹" : "%"} />
            </div>
          </div>
          <div>
            <Label need>Into</Label>
            <Select value={pocketId} onChange={setPocketId} label="Which pocket"
                    placeholder="Choose a pocket"
                    options={pockets.map((p) => ({ value: p.id, label: p.name }))} />
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

/** "₹20" or "10%", from whichever of the two the rule carries. */
function keepWords(r: { keep_minor: number | null; keep_pct: number | null }): string {
  if (r.keep_pct) return `${r.keep_pct}%`;
  return formatRupees(r.keep_minor ?? 0);
}

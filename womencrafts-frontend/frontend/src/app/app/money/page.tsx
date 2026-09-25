"use client";

import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SourceNote, formatRupees, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Select, Text } from "@/components/ux/kit/form";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { useResource } from "@/lib/use-resource";
import {
  WEIGHT_LABEL, WEIGHT_LOOK, apiAddCommitment, apiBudget, apiDeleteCommitment,
  apiEditCommitment, type Budget, type Weight,
} from "@/lib/money-api";
import { useT } from "@/i18n";
import { EngineNudge } from "@/components/ux/reminders/EngineNudge";
import { NeedAHuman } from "@/components/ux/support/NeedAHuman";

/**
 * Is there enough for the things that cannot wait?
 *
 * ── Why this screen is one question, not a budget ───────────────────────────
 * §64 asks for a budget and says not to make it look like a banking app. Those
 * two things fight each other unless you drop the budgeting frame entirely: a
 * budget assumes a predictable month with a salary in and categories out, and
 * for a woman whose income arrives in uneven pieces from different people, the
 * variance report is noise.
 *
 * So the whole screen answers one question, in the heading, in words, before
 * any number: **is there enough for the things that cannot wait.** Everything
 * below only explains that answer.
 *
 * ── Ranked by consequence, never by amount ──────────────────────────────────
 * A ₹1,800 school fee that loses a term test sits above ₹3,500 of rent that can
 * be a week late. Sorting by size would put the rent first and teach her the
 * wrong thing about which one to worry about. The server does the ordering, so
 * this screen and any other reading the same data agree.
 *
 * ── Nothing turns red, and nothing is scored ────────────────────────────────
 * There is no "you overspent". A woman who had to spend it did not overspend.
 * The only warning on this screen is about money that has not been agreed yet
 * being counted as money — which is the mistake that actually costs her.
 *
 * ── What this used to be ────────────────────────────────────────────────────
 * A fixture. ₹2,300 in hand, a school fee for a child called Meena, rent of
 * ₹3,500 and a ₹12,500 circle payout — identical for every woman who opened
 * it, and on a screen that exists to tell her whether she can cover her
 * daughter's fee this month.
 */

const EMPTY: Budget = {
  commitments: [], incoming: [], in_hand_minor: 0, must_pay_minor: 0,
  committed_minor: 0, sure_minor: 0, maybe_minor: 0, spare_minor: 0,
  covers_must: true,
};

/** Icons offered for a commitment, by the kind of thing it usually is. */
const ICONS = [
  { value: "GraduationCap", label: "School or fees" },
  { value: "Home", label: "Rent or the house" },
  { value: "Coins", label: "A circle or a loan" },
  { value: "HeartPulse", label: "Medicine or a hospital" },
  { value: "Wrench", label: "Tools or repairs" },
  { value: "Zap", label: "A bill" },
  { value: "Circle", label: "Something else" },
];

export default function MoneyPage() {
  const tr = useT();
  const money = useResource<Budget>(useCallback((s) => apiBudget(s), []), EMPTY);
  const t = money.data;

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [ifMissed, setIfMissed] = useState("");
  const [weight, setWeight] = useState<Weight>("should-pay");
  const [icon, setIcon] = useState("Circle");

  const add = useCallback(async () => {
    const n = Number(amount.replace(/[^0-9.]/g, ""));
    if (!what.trim()) { setErr("What is it for?"); return; }
    if (!Number.isFinite(n) || n <= 0) { setErr("How much is it?"); return; }
    setBusy("add"); setErr(null);
    try {
      const look = WEIGHT_LOOK[weight];
      await apiAddCommitment({
        what: what.trim(),
        minor: Math.round(n * 100),
        due: due ? new Date(due).toISOString() : null,
        if_missed: ifMissed.trim(),
        weight, icon, tint: look.tint, ink: look.ink,
      });
      setNote("Added. It is in the list below, in the order it matters.");
      setAdding(false);
      setWhat(""); setAmount(""); setDue(""); setIfMissed(""); setWeight("should-pay"); setIcon("Circle");
      money.refetch();
    } catch {
      setErr("That did not save. Try again.");
    } finally { setBusy(null); }
  }, [what, amount, due, ifMissed, weight, icon, money]);

  const settle = useCallback(async (id: string, label: string) => {
    setBusy(id); setErr(null);
    try {
      await apiEditCommitment(id, { paid: true });
      setNote(`${label} marked paid.`);
      money.refetch();
    } catch { setErr("Could not mark that paid."); }
    finally { setBusy(null); }
  }, [money]);

  const drop = useCallback(async (id: string) => {
    setBusy(id); setErr(null);
    try {
      await apiDeleteCommitment(id);
      setNote("Removed.");
      money.refetch();
    } catch { setErr("Could not remove that."); }
    finally { setBusy(null); }
  }, [money]);

  const nothingYet = money.source !== "loading"
    && t.commitments.length === 0 && t.incoming.length === 0 && t.in_hand_minor === 0;

  return (
    <HomeShell active="/app/money">
      {/* The engine, where this module already is. Added, not replacing. */}
      <div className="mb-4">
        <EngineNudge
          preset="rem.preset.fee"
          icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink"
          labelKey="nudge.money.label" noteKey="nudge.money.note" />
      </div>
      <div className="flex flex-col gap-6 lg:gap-5" id="money-page">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("money.yourMoney")}</p>
            {/* The answer, in words, before any number. */}
            <h1 className="ux-screen-title mt-2 max-w-[20ch] text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              {t.commitments.length === 0
                ? "Nothing is promised yet"
                : t.covers_must
                  ? tr("money.youHaveEnoughForTheThings")
                  : tr("money.twoThingsCannotWaitAndYou")}
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              {t.commitments.length === 0
                ? "Write down what you have to pay and when, and this screen will tell you whether there is enough for the things that cannot wait."
                : t.covers_must
                  ? tr("money.everythingBelowIsOnlyTheWorking")
                  : tr("money.theTwoBelowCostYouMost")}
            </p>
            <div className="mt-3"><ReadAloud targetId="money-page" /></div>
          </div>
          <Btn icon="Plus" className="max-lg:w-full" onClick={() => { setAdding(true); setErr(null); }}>
            Something I have to pay
          </Btn>
        </header>

        {/* The three numbers that matter, and nothing else. */}
        <div className={`grid gap-3 sm:grid-cols-3 ${GROUP}`}>
          {[
            { n: formatRupees(t.in_hand_minor), l: "in your hand now", i: "Wallet",
              tint: "--ux-tint-green", ink: "--ux-green-ink" },
            { n: formatRupees(t.sure_minor), l: "agreed and coming", i: "ArrowDownLeft",
              tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
            { n: formatRupees(t.committed_minor), l: "already promised", i: "ArrowUpRight",
              tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
          ].map((x) => (
            <Card key={x.l} pad={16} className={GROUP_ROW}>
              <div className="flex items-center gap-3.5">
                <IconTile icon={x.i} tint={x.tint} ink={x.ink} size={42} />
                <div className="min-w-0">
                  <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                    {x.n}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{x.l}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <SourceNote source={money.source} what="these figures" />

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

        {/* What is left, said plainly rather than as a balance. */}
        {t.commitments.length > 0 && (
          <Card pad={18} style={{ background: v(t.spare_minor >= 0 ? "--ux-tint-green" : "--ux-tint-amber"),
                                  borderColor: "transparent" }}>
            <p className="text-smd font-bold" style={{ color: v("--ux-ink") }}>
              {t.spare_minor >= 0
                ? `${formatRupees(t.spare_minor)} is yours to do what you like with`
                : `You are ${formatRupees(Math.abs(t.spare_minor))} short of everything you have promised`}
            </p>
            <p className="mt-1 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {t.spare_minor >= 0
                ? tr("money.afterEverythingBelowIsPaidSpend")
                : tr("money.theThingsThatCannotWaitAre")}
            </p>
          </Card>
        )}

        {nothingYet && (
          <EmptyState
            icon="Wallet"
            title="Nothing written down yet"
            body="This screen works off two things: what you have promised to pay, and what people owe you. Add a payment you have coming up, and anything you are owed goes in your books."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Btn size="sm" icon="Plus" onClick={() => setAdding(true)}>Something I have to pay</Btn>
                <Btn size="sm" variant="outline" icon="BookOpen" href="/app/books">Who owes me</Btn>
              </div>
            }
          />
        )}

        {/* Commitments, by consequence. */}
        {t.commitments.length > 0 && (
          <div>
            <Section title={tr("money.whatYouHavePromised")}
                         sub={tr("money.hardestToMissFirstNotBiggest")} icon="ListChecks" />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {t.commitments.map((c, i) => (
                <div key={c.id} className="flex flex-wrap items-start gap-3.5 px-4 py-4 lg:px-5"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}`,
                              opacity: c.weight === "can-move" ? 0.72 : 1 }}>
                  <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-smd font-bold" style={{ color: v("--ux-ink") }}>{c.what}</p>
                      <Pill tone={c.weight === "cannot-wait" ? "orange" : "neutral"} size="sm">
                        {WEIGHT_LABEL[c.weight]}
                      </Pill>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{whenWords(c.due)}</p>
                    {/* The consequence, which is the reason it is ordered here. */}
                    {c.if_missed && (
                      <p className="mt-1.5 text-xs leading-snug"
                         style={{ color: v(c.weight === "cannot-wait" ? "--ux-amber-ink" : "--ux-muted") }}>
                        If you miss it: {c.if_missed}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Btn size="sm" variant="ghost" disabled={busy === c.id}
                           onClick={() => settle(c.id, c.what)}>Paid</Btn>
                      <Btn size="sm" variant="ghost" disabled={busy === c.id}
                           onClick={() => drop(c.id)}>Remove</Btn>
                    </div>
                  </div>
                  <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {formatRupees(c.minor)}
                  </p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Incoming — agreed and not agreed, kept apart on purpose. */}
        {t.incoming.length > 0 && (
          <div>
            <Section title={tr("money.whatIsComingToYou")}
                         sub={tr("money.onlyTheAgreedMoneyIsCounted")} icon="ArrowDownLeft" />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {t.incoming.map((inc, i) => (
                <div key={inc.id} className="flex flex-wrap items-center gap-3.5 px-4 py-4 lg:px-5"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <I name={inc.certain ? "CheckCircle2" : "HelpCircle"} className="h-[1.0625rem] w-[1.0625rem] shrink-0"
                     style={{ color: v(inc.certain ? "--ux-green-ink" : "--ux-muted") }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold"
                       style={{ color: v(inc.certain ? "--ux-ink" : "--ux-muted") }}>{inc.from}</p>
                    <p className="text-xs" style={{ color: v("--ux-muted") }}>{inc.when}</p>
                  </div>
                  <p className="shrink-0 text-smd font-bold tabular-nums"
                     style={{ color: v(inc.certain ? "--ux-ink" : "--ux-faint") }}>
                    {formatRupees(inc.minor)}
                  </p>
                </div>
              ))}
            </Card>
            {t.maybe_minor > 0 && (
              <p className="mt-2.5 flex items-start gap-2 rounded-[12px] px-4 py-3 text-xsm leading-relaxed lg:px-3.5"
                 style={{ background: v("--ux-tint-amber"), color: v("--ux-ink-2") }}>
                <I name="AlertTriangle" className="mt-[2px] h-[0.9375rem] w-[0.9375rem] shrink-0"
                   style={{ color: v("--ux-amber-ink") }} />
                <span>
                  {formatRupees(t.maybe_minor)} of that is not agreed yet, so it is not counted above.
                  Counting a maybe is how a woman promises a fee she cannot cover.
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Btn href="/app/collect" icon="QrCode" className="ux-action-primary">{tr("money.askSomeoneToPayYou")}</Btn>
          <Btn variant="outline" href="/app/vault" icon="Lock" className="max-lg:w-full">{tr("money.putSomeAside")}</Btn>
          <Btn variant="ghost" href="/app/books" icon="BookOpen" className="max-lg:w-full">{tr("money.whoOwesYou")}</Btn>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing here is a score and nothing goes red. If you had to spend it, you had to spend
              it — this screen is only here so the things that cost you most if they are missed are
              the ones you see first. What is coming to you is read from your books.
            </p>
          </div>
        </Card>

        {/* A person, on a screen about her money. The helplines were only on
            the safety screen, which is not where a woman with a payment
            problem goes looking. */}
        <NeedAHuman />
      </div>

      <Sheet
        open={adding}
        onClose={() => { setAdding(false); setErr(null); }}
        icon="ListChecks"
        title="Something you have to pay"
        description="What it is, when, and what happens if it is missed — that last one is what decides where it sits in the list."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setAdding(false); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy === "add"} onClick={add}>Add it</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label need>What is it for</Label>
            <Text value={what} onChange={setWhat} label="What the payment is for"
                  placeholder="School fee" max={120} />
          </div>
          <div>
            <Label need>How much</Label>
            <Text value={amount} onChange={setAmount} label="How much, in rupees"
                  placeholder="1800" prefix="₹" />
          </div>
          <div>
            <Label hint="Leave it blank if there is no date">By when</Label>
            <Text value={due} onChange={setDue} label="The date it is due" type="date" />
          </div>
          <div>
            <Label need hint="This decides the order">How hard is it to miss</Label>
            <Select value={weight} onChange={(s) => setWeight(s as Weight)} label="How hard it is to miss"
                    options={(Object.keys(WEIGHT_LABEL) as Weight[]).map((k) => ({ value: k, label: WEIGHT_LABEL[k] }))} />
          </div>
          <div>
            <Label hint="Only if something really does">What happens if you miss it</Label>
            <Text value={ifMissed} onChange={setIfMissed} label="What happens if it is missed"
                  placeholder="She cannot sit the term test" max={160} />
          </div>
          <div>
            <Label>Picture</Label>
            <Select value={icon} onChange={setIcon} label="A picture for it" options={ICONS} />
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

/** "by 15 September", or nothing when she set no date. */
function whenWords(iso: string): string {
  if (!iso) return "no date set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no date set";
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `by ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}`;
}

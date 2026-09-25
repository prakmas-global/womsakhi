"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, SourceNote, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { type Late } from "@/components/ux/haq/data";
import { LateRow } from "@/components/ux/haq/parts";
import { useResource } from "@/lib/use-resource";
import { apiAddLate, apiEditLate, apiLate, apiRemoveLate, type LatePayment, type LatePayments } from "@/lib/life-api";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Text } from "@/components/ux/kit/form";
import { useT } from "@/i18n";

/**
 * Money that was late — and the compensation nobody claims.
 *
 * Delay compensation is a legal right attached to most public payments and it
 * is essentially never paid. In one study of 31 million wage transactions
 * across ten states, 63% of payments breached the statutory deadline and the
 * compensation owed was "neither acknowledged nor paid".
 *
 * The product is unglamorous and unambiguous: notice the lateness, compute what
 * is owed, and hand her a filled-in grievance. She sends it. Nothing here needs
 * a government integration, which is exactly why it can ship.
 */
export default function RecoverPage() {
  const tr = useT();
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [what, setWhat] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [owedRs, setOwedRs] = useState("");

  /**
   * Payments the state owes her, from her own records.
   *
   * The screen shipped with three: ₹42 for a March Ladki Bahin payment that
   * came 28 days late, ₹21 for April, ₹91.50 for a January widow pension.
   * Every woman saw the same three, and the grievance button crossed them off
   * in React state — so she would believe a complaint had been prepared about
   * money nobody owed her, and lose the record on reload either way.
   *
   * `days_late` is now counted from the dates on the server, so a delay
   * cannot stop being true overnight.
   */
  const late = useResource<LatePayments>(
    useCallback((sig: AbortSignal) => apiLate(sig), []),
    { late: [], owed_minor: 0, count: 0 },
  );
  const rows = late.data.late;

  const open = useMemo(() => rows.filter((l) => !l.filed), [rows]);
  const filed = useMemo(() => rows.filter((l) => l.filed), [rows]);
  const owed = late.data.owed_minor;
  const claimed = useMemo(() => filed.reduce((n, l) => n + l.owed_minor, 0), [filed]);

  const file = useCallback(async (id: string) => {
    const l = rows.find((x) => x.id === id);
    setBusy(id); setErr(null);
    try {
      await apiEditLate(id, { filed: true });
      setNote(`Grievance ready for ${l?.what}. It is filled in — read it, then send it.`);
      late.refetch();
    } catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [rows, late]);

  const fileAll = useCallback(async () => {
    setBusy("all"); setErr(null);
    try {
      // One at a time rather than a bulk call, so a failure halfway leaves
      // the ones that did go through marked and the rest still open.
      for (const l of open) await apiEditLate(l.id, { filed: true });
      setNote(`${open.length} ${open.length === 1 ? "grievance" : "grievances"} prepared. Each one names the date, the delay and the amount.`);
      late.refetch();
    } catch { setErr("Some of those did not save."); }
    finally { setBusy(null); }
  }, [open, late]);

  const add = useCallback(async () => {
    if (!what.trim()) { setErr("Which payment?"); return; }
    if (!dueOn) { setErr("When was it due?"); return; }
    const n = Number(owedRs.replace(/[^0-9.]/g, ""));
    setBusy("add"); setErr(null);
    try {
      await apiAddLate({
        what: what.trim(), due_on: new Date(dueOn).toISOString(),
        owed_minor: Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0,
      });
      setNote("Recorded. The days late are counted from the date you gave.");
      setAdding(false); setWhat(""); setDueOn(""); setOwedRs("");
      late.refetch();
    } catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [what, dueOn, owedRs, late]);

  const drop = useCallback(async (id: string) => {
    setBusy(id); setErr(null);
    try { await apiRemoveLate(id); late.refetch(); }
    catch { setErr("Could not remove that."); }
    finally { setBusy(null); }
  }, [late]);

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-6 lg:gap-5">

        <Back to="/app/haq" label={tr("haqRecover.backToHaq")} />

        <header>
          <p className={EYEBROW}>{tr("haqRecover.lateMoney")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("haqRecover.theyOweYouForTheWait")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            When a public payment arrives late, compensation is due by law. Almost nobody asks
            for it, because almost nobody is told. Record a late payment and the compensation
            is worked out from the dates.
          </p>
          <div className="mt-4">
            <Btn icon="Plus" onClick={() => { setAdding(true); setErr(null); }}>
              Record a late payment
            </Btn>
          </div>
        </header>

        <SourceNote source={late.source} what="these payments" />

        {err && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="h-[16px] w-[16px] shrink-0" />{err}
            </p>
          </Card>
        )}

        {late.source !== "loading" && rows.length === 0 && (
          <EmptyState
            icon="AlarmClock"
            title="Nothing recorded yet"
            body="When a government payment reaches you late, compensation is due by law — and almost nobody claims it, because almost nobody is told. Record the ones that were late and this works out what you are owed."
            action={<Btn icon="Plus" onClick={() => setAdding(true)}>Record a late payment</Btn>}
          />
        )}

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(owed)} label={tr("haqRecover.owedAndNotYetClaimed")}
                  icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" />
            <Stat value={formatRupees(claimed)} label={tr("haqRecover.alreadyClaimed")}
                  icon="CheckCircle2" tint="--ux-tint-green" ink="--ux-green-ink" />
          </div>
          {open.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5"
                 style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>{tr("haqRecover.theyCanAllGoInOne")}</p>
              <Btn size="sm" icon="FileText" className="max-lg:w-full max-lg:px-4" disabled={busy === "all"} onClick={fileAll}>Prepare all {open.length}</Btn>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <Section title={tr("haqRecover.notClaimedYet")} icon="AlarmClock" chip={String(open.length)} />
          {open.length === 0 ? (
            <Card>
              <EmptyState
                icon="CheckCircle2"
                title={tr("haqRecover.nothingOutstanding")}
                body={tr("haqRecover.everyLatePaymentHasAGrievance")}
              />
            </Card>
          ) : (
            <div className={`flex flex-col gap-2.5 ${GROUP}`}>
              {open.map((l) => <LateRow key={l.id} l={l} onFile={file} className={GROUP_ROW} />)}
            </div>
          )}
        </div>

        {filed.length > 0 && (
          <div>
            <Section title={tr("haqRecover.alreadyAskedFor")} icon="Send" chip={String(filed.length)} />
            <div className={`flex flex-col gap-2.5 ${GROUP}`}>
              {filed.map((l) => <LateRow key={l.id} l={l} onFile={file} className={GROUP_ROW} />)}
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={adding}
        onClose={() => { setAdding(false); setErr(null); }}
        icon="AlarmClock" title="A payment that came late"
        description="Which payment, when it was due, and what the delay is worth. The days late are counted from the date — you never have to update them."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setAdding(false); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy === "add"} onClick={add}>Record it</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div><Label need>Which payment</Label>
            <Text value={what} onChange={setWhat} label="Which payment"
                  placeholder="Ladki Bahin — March" max={120} /></div>
          <div><Label need>When was it due</Label>
            <Text value={dueOn} onChange={setDueOn} label="The date it was due" type="date" /></div>
          <div><Label hint="If you know it">What the delay is worth</Label>
            <Text value={owedRs} onChange={setOwedRs} label="What you are owed, in rupees"
                  placeholder="42" prefix="₹" /></div>
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

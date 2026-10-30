"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, v } from "@/components/ux/kit";
import { Choice, Label, Picks, Stepper, Steps, Text, Toggle } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { toast } from "@/components/ux/mobile/Toast";
import { KhataGate, useKhata } from "@/components/ux/khata/KhataGate";
import { SafetyCard } from "@/components/ux/khata/chits/parts";
import { METHOD_LOOK, lakhs, monthName, shiftMonth, thisMonth } from "@/components/ux/khata/chits/look";
import { apiErrorMessage } from "@/lib/api";
import {
  CHIT_VALUES, MAX_COMMISSION_PCT, apiAddChit, type ChitMethod, type MemberInput,
} from "@/lib/khata-api";

/**
 * Start a chit record — three short steps, almost all taps.
 *
 * The maths is on screen from the first tap ("each pays ₹5,000 a month for 20
 * months"), because a chit is a promise of money every month for a long time
 * and she should see the size of it before anything else. Past start months
 * are allowed: most chits she will record are already running.
 */

const NAME_IDEAS = ["Ward chit", "Family chit", "Friends' chit", "Office chit", "Kitty"];
const MEMBER_PRESETS = [10, 20, 25, 30, 40, 50];
const COMMISSIONS = [0, 1, 2, 3, 4, 5];
const STEPS = [{ id: 1, label: "The chit" }, { id: 2, label: "How the pot is given" }, { id: 3, label: "Members" }] as const;

export default function NewChitPage() {
  return (
    <HomeShell rail={<div className="space-y-4"><SafetyCard /></div>}>
      <KhataGate><NewChit /></KhataGate>
    </HomeShell>
  );
}

function NewChit() {
  const router = useRouter();
  const { locked } = useKhata();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(1);
  const [name, setName] = useState("");
  const [value, setValue] = useState(100000);
  const [other, setOther] = useState("");
  const [count, setCount] = useState("20");
  const [startPick, setStartPick] = useState("This month");
  const [start, setStart] = useState(thisMonth());
  const [method, setMethod] = useState<ChitMethod>("auction");
  const [pct, setPct] = useState(5);
  const [role, setRole] = useState<"organiser" | "member">("organiser");
  const [meToo, setMeToo] = useState(true);
  const [rows, setRows] = useState<MemberInput[]>([]);
  const [who, setWho] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const members = Math.max(2, Number(count) || 0);
  const rupees = other ? Number(other.replace(/\D/g, "")) || 0 : value;
  const monthly = members ? Math.round(rupees / members) : 0;
  const places = members - (meToo ? 1 : 0);
  const okStep1 = name.trim().length >= 2 && rupees >= 1000 && members >= 2 && members <= 100;

  const pickMethod = (m: ChitMethod) => { setMethod(m); setPct(m === "auction" ? 5 : 0); };
  const pickStart = (p: string) => {
    setStartPick(p);
    if (p === "This month") setStart(thisMonth());
    if (p === "Last month") setStart(shiftMonth(thisMonth(), -1));
    if (p === "2 months ago") setStart(shiftMonth(thisMonth(), -2));
  };
  const addRow = () => {
    const w = who.trim();
    if (!w) return;
    if (rows.length >= places) { toast(`This chit has ${members} places.`, { tone: "error" }); return; }
    setRows([...rows, w.startsWith("@") ? { username: w.slice(1) } : { name: w, phone: phone.replace(/\D/g, "") }]);
    setWho(""); setPhone("");
  };
  const go = (n: number) => { setStep(n); setDone((d) => Math.max(d, n)); };

  const save = async () => {
    setBusy(true);
    try {
      const c = await apiAddChit({
        name: name.trim(), value_rupees: rupees, members_count: members, start_month: start, method,
        commission_pct: pct, my_role: role, i_am_member: meToo, members: rows,
      });
      toast("Your chit record is ready", { tone: "success" });
      router.push(`/app/khata/chits/${c.id}`);
    } catch (e) {
      if (locked(e)) return;
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally { setBusy(false); }
  };

  return (
    <>
      <ScreenHead title="Start a chit record" sub="WomSakhi keeps the record. The money stays between you and your members." />
      <Steps steps={STEPS} at={step} done={done} onGo={setStep} />

      {/* What it adds up to — always on screen. */}
      <div className="mb-4 flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: "var(--ux-banner-ground)", color: "#fff" }}>
        <Icons.Coins className="h-8 w-8 shrink-0" />
        <p className="min-w-0 text-sm font-semibold leading-snug">
          {lakhs(rupees)} chit · each pays <b className="text-base">₹{monthly.toLocaleString("en-IN")}</b> a month for {members} months
          <span className="block text-xs font-normal opacity-85">Starts {monthName(start)} · ends {monthName(shiftMonth(start, members - 1))}</span>
        </p>
      </div>

      {step === 1 && (
        <Card className="space-y-5">
          <div>
            <Label need>Name it</Label>
            <Text value={name} onChange={setName} label="Chit name" max={60} placeholder="e.g. Ward 5 chit" />
            <Picks options={NAME_IDEAS} value={name} onPick={setName} label="Name ideas" />
          </div>
          <div>
            <Label need>How big is the chit?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHIT_VALUES.map((x) => {
                const on = !other && value === x;
                return (
                  <button key={x} type="button" aria-pressed={on} onClick={() => { setValue(x); setOther(""); }}
                          className="ux-press ux-sq min-h-[64px] rounded-[14px] border text-base font-extrabold"
                          style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                   color: v(on ? "--ux-brand" : "--ux-ink") }}>
                    {lakhs(x)}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 max-w-[260px]">
              <Text value={other} onChange={(s) => setOther(s.replace(/\D/g, ""))} type="number" prefix="₹" label="Other amount"
                    placeholder="Other amount" />
            </div>
          </div>
          <div>
            <Label need>How many members?</Label>
            <Stepper value={count} onChange={setCount} label="Members" min={2} presets={MEMBER_PRESETS} />
            <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>A chit runs one month for each member.</p>
          </div>
          <div>
            <Label need>When did it start?</Label>
            <Picks options={["This month", "Last month", "2 months ago", "Earlier"]} value={startPick} onPick={pickStart} label="Start" />
            {startPick === "Earlier" && (
              <input type="month" value={start} max={thisMonth()} onChange={(e) => e.target.value && setStart(e.target.value)}
                     aria-label="Start month"
                     className="ux-sq mt-2 min-h-[46px] rounded-[12px] border px-3 text-sm"
                     style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
            )}
          </div>
          <div className="flex justify-end">
            <Btn variant="primary" iconEnd="ArrowRight" disabled={!okStep1} onClick={() => go(2)}>Next</Btn>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <div>
            <Label need>How is the pot given each month?</Label>
            <div className="flex flex-col gap-2.5 lg:flex-row">
              {(Object.keys(METHOD_LOOK) as ChitMethod[]).map((m) => (
                <Choice key={m} icon={METHOD_LOOK[m].icon} title={METHOD_LOOK[m].label} sub={METHOD_LOOK[m].note}
                        on={method === m} onClick={() => pickMethod(m)} />
              ))}
            </div>
          </div>
          <div>
            <Label hint="kept by the organiser">Organiser&rsquo;s commission</Label>
            <Picks options={COMMISSIONS.map((c) => `${c}%`)} value={`${pct}%`} onPick={(s) => setPct(Number(s.replace("%", "")))}
                   label="Commission" />
            <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
              {pct ? `₹${Math.round((rupees * pct) / 100).toLocaleString("en-IN")} a month from the pot. ` : "No commission. "}
              Registered chits allow at most {MAX_COMMISSION_PCT}%.
            </p>
          </div>
          <div className="flex justify-between">
            <Btn variant="ghost" icon="ArrowLeft" onClick={() => setStep(1)}>Back</Btn>
            <Btn variant="primary" iconEnd="ArrowRight" onClick={() => go(3)}>Next</Btn>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5">
          <div>
            <Label need>Your part</Label>
            <div className="flex flex-col gap-2.5 lg:flex-row">
              <Choice icon="Crown" title="I run it" sub="I collect from everyone and give the pot each month." on={role === "organiser"}
                      onClick={() => setRole("organiser")} />
              <Choice icon="Wallet" title="I pay into it" sub="Someone else runs it. I keep my own record." on={role === "member"}
                      onClick={() => { setRole("member"); setMeToo(true); }} />
            </div>
            {role === "organiser" && (
              <div className="mt-3 rounded-[12px] p-3" style={{ background: v("--ux-surface-2") }}>
                <Toggle on={meToo} onChange={setMeToo} label="I am also a member"
                        sub={meToo ? "You pay every month and take the pot once, like everyone." : "You only run it."} />
              </div>
            )}
          </div>

          <div>
            <Label hint="you can add them later">Members</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Text value={who} onChange={setWho} label="Name or @username" max={60} placeholder="Name, or @username" />
              {!who.startsWith("@") && (
                <div className="sm:w-[170px]"><Text value={phone} onChange={(s) => setPhone(s.replace(/\D/g, "").slice(0, 10))}
                                                     type="tel" label="Mobile (optional)" placeholder="Mobile (optional)" /></div>
              )}
              <Btn variant="outline" icon="UserPlus" disabled={!who.trim()} onClick={addRow}>Add</Btn>
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
              <Icons.AtSign className="mt-[1px] h-3 w-3 shrink-0" />
              Type @ and her WomSakhi username to link her: she will see this chit, her dues, and can tell you when she has paid.
            </p>
            <ul className="mt-3 space-y-2">
              {meToo && (
                <li className="flex items-center gap-2.5 rounded-[12px] p-2.5" style={{ background: v("--ux-brand-tint") }}>
                  <Icons.UserRound className="h-5 w-5" style={{ color: v("--ux-brand") }} />
                  <span className="flex-1 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>You</span>
                </li>
              )}
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-[12px] border p-2.5" style={{ borderColor: v("--ux-line") }}>
                  {r.username ? <Icons.AtSign className="h-5 w-5" style={{ color: v("--ux-brand") }} />
                    : <Icons.User className="h-5 w-5" style={{ color: v("--ux-muted") }} />}
                  <span className="min-w-0 flex-1 truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                    {r.username ? `@${r.username}` : r.name}
                    {r.phone && <span className="ms-2 font-normal" style={{ color: v("--ux-muted") }}>{r.phone}</span>}
                  </span>
                  <button type="button" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                          className="ux-press grid h-8 w-8 place-items-center rounded-full" style={{ color: v("--ux-muted") }}>
                    <Icons.X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs" style={{ color: v("--ux-faint") }}>
              {rows.length + (meToo ? 1 : 0)} of {members} places filled
            </p>
          </div>

          <div className="flex justify-between">
            <Btn variant="ghost" icon="ArrowLeft" onClick={() => setStep(2)}>Back</Btn>
            <Btn variant="primary" icon="Check" loading={busy} disabled={!okStep1} onClick={() => void save()}>Save the chit</Btn>
          </div>
        </Card>
      )}
    </>
  );
}

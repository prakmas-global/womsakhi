"use client";

import { useEffect, useRef, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, v } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { Amount } from "@/components/ux/khata/KhataGate";
import {
  apiChitDecide, apiChitIPaid, apiChitPaid, settlePreview, type Chit, type ChitMember,
} from "@/lib/khata-api";
import { METHOD_LOOK, monthName } from "./look";
import { Initial } from "./parts";

/**
 * One month of a chit: who takes the pot, and who has paid.
 *
 * For the organiser it is where the month is run — record the auction (with
 * the money worked out live as she types the bid), hold the draw, or confirm
 * the next name in the order — then tick each member off as she pays. For a
 * linked member it is her own line: what she owes, an "I paid" button, and
 * everyone else's tick, never their phone.
 */

export type Run = (work: () => Promise<Chit>, done?: string) => Promise<boolean>;

export function MonthPanel({ chit, month, run, onMembers }: {
  chit: Chit; month: number; run: Run; onMembers: () => void;
}) {
  const mo = chit.months[month - 1];
  const owner = chit.viewer === "owner";
  const open = month >= 1 && month <= chit.month_now;
  const byId = new Map(chit.members.map((m) => [m.id, m]));
  const [changing, setChanging] = useState(false);
  const winner = mo?.winner ? byId.get(mo.winner) : undefined;

  if (!mo) return null;
  return (
    <div className="space-y-4">
      <Card>
        <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>
          <Icons.CalendarDays className="h-3.5 w-3.5" /> Month {month} · {monthName(mo.label)}
        </p>
        {winner && !changing ? (
          <WinnerCard chit={chit} month={month} winner={winner} onChange={owner && open ? () => setChanging(true) : undefined} />
        ) : !open ? (
          <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: v("--ux-muted") }}>
            <Icons.Hourglass className="h-5 w-5" /> This month opens in {monthName(mo.label)}.
          </p>
        ) : owner ? (
          <Decide chit={chit} month={month} run={run} onDone={() => setChanging(false)} onMembers={onMembers}
                  onCancel={winner ? () => setChanging(false) : undefined} />
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: v("--ux-muted") }}>
            <Icons.Hourglass className="h-5 w-5" /> {chit.owner_name || "The organiser"} has not recorded who takes the pot yet.
          </p>
        )}
      </Card>
      {open && <Payments chit={chit} month={month} run={run} onMembers={onMembers} />}
    </div>
  );
}

function WinnerCard({ chit, month, winner, onChange }: {
  chit: Chit; month: number; winner: ChitMember; onChange?: () => void;
}) {
  const mo = chit.months[month - 1];
  const how = mo.how === "draw" ? "By draw" : mo.how === "auction" ? "By auction" : mo.how === "fixed" ? "By the order" : "Picked";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <span className="relative">
          <Initial name={winner.name} me={winner.is_me} size={52} />
          <span className="absolute -bottom-1 -end-1 grid h-6 w-6 place-items-center rounded-full"
                style={{ background: "#f5a524", color: "#fff" }}><Icons.Trophy className="h-3.5 w-3.5" /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>
            {winner.is_me ? "You take the pot" : `${winner.name} takes the pot`}
          </p>
          <p className="text-xs" style={{ color: v("--ux-muted") }}>{how}</p>
        </div>
        <Amount minor={mo.payout_minor} className="text-lg font-extrabold" style={{ color: v("--ux-green-ink") }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chit.method === "auction" && <Fact label="Bid (discount)" minor={mo.bid_minor} />}
        {mo.commission_minor > 0 && <Fact label="Commission" minor={mo.commission_minor} />}
        {chit.method === "auction" && <Fact label="Dividend each" minor={mo.dividend_minor} />}
        <Fact label="Each pays" minor={mo.due_minor} strong />
      </dl>
      {onChange && (
        <button type="button" onClick={onChange} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: v("--ux-brand") }}>
          <Icons.Pencil className="h-3.5 w-3.5" /> Change this month
        </button>
      )}
    </div>
  );
}

function Fact({ label, minor, strong }: { label: string; minor: number; strong?: boolean }) {
  return (
    <div className="rounded-[12px] p-2.5" style={{ background: v(strong ? "--ux-brand-tint" : "--ux-surface-2") }}>
      <dt className="text-2xs" style={{ color: v("--ux-muted") }}>{label}</dt>
      <dd className="text-sm font-bold" style={{ color: v(strong ? "--ux-brand" : "--ux-ink") }}><Amount minor={minor} /></dd>
    </div>
  );
}

function Decide({ chit, month, run, onDone, onMembers, onCancel }: {
  chit: Chit; month: number; run: Run; onDone: () => void; onMembers: () => void; onCancel?: () => void;
}) {
  // Who may still take a pot: never won, or won THIS month (she is changing it).
  const eligible = chit.members.filter((m) => !m.won_month || m.won_month === month);
  const [pick, setPick] = useState("");
  const [bid, setBid] = useState("");
  const [rolling, setRolling] = useState("");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const decide = async (body: { member_id?: string; bid_rupees?: number; draw?: boolean }, done: string) => {
    if (await run(() => apiChitDecide(chit.id, month, body), done)) onDone();
  };

  if (!eligible.length) {
    return <p className="mt-3 text-sm" style={{ color: v("--ux-muted") }}>Everyone has taken a pot. Add members if places are empty.</p>;
  }

  const picker = (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {eligible.map((m) => (
        <button key={m.id} type="button" aria-pressed={pick === m.id} onClick={() => setPick(m.id)}
                className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] border px-2.5 text-start"
                style={{ borderColor: v(pick === m.id ? "--ux-brand" : "--ux-line"), background: v(pick === m.id ? "--ux-brand-tint" : "--ux-surface") }}>
          <Initial name={m.name} me={m.is_me} size={30} />
          <span className="min-w-0 truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{m.is_me ? "You" : m.name}</span>
        </button>
      ))}
    </div>
  );

  const head = (
    <p className="mt-2 flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
      {/* The method's own picture, so the step reads without the word. */}
      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
        {chit.method === "auction" ? <Icons.Gavel className="h-4 w-4" /> : chit.method === "draw" ? <Icons.Dices className="h-4 w-4" />
          : <Icons.ListOrdered className="h-4 w-4" />}
      </span>
      {METHOD_LOOK[chit.method].label}: who takes it this month?
    </p>
  );

  const cancel = onCancel && <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>;

  if (chit.method === "auction") {
    const bidMinor = (Number(bid) || 0) * 100;
    const p = settlePreview(chit, bidMinor);
    const okBid = bid !== "" && bidMinor >= chit.min_bid_minor && bidMinor <= chit.max_bid_minor;
    // Round, legal suggestions between the commission and the 40% ceiling.
    const ideas = [10, 15, 20, 25, 30, 35, 40].map((pc) => Math.round((chit.value_minor / 100) * pc / 100 / 500) * 500)
      .filter((r) => r * 100 >= chit.min_bid_minor && r * 100 <= chit.max_bid_minor);
    return (
      <div>
        {head}
        <p className="mt-3 text-xs font-semibold" style={{ color: v("--ux-muted") }}>Who won the auction?</p>
        {picker}
        <p className="mt-4 text-xs font-semibold" style={{ color: v("--ux-muted") }}>Her winning bid — the discount she gives up</p>
        <div className="mt-1.5 max-w-[240px]">
          <Text value={bid} onChange={(s) => setBid(s.replace(/\D/g, ""))} type="number" prefix="₹" label="Winning bid" placeholder="20000" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ideas.map((r) => (
            <button key={r} type="button" onClick={() => setBid(String(r))}
                    className="ux-press rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: v(Number(bid) === r ? "--ux-brand" : "--ux-surface-2"),
                             color: v(Number(bid) === r ? "--ux-on-brand" : "--ux-ink-2") }}>
              ₹{r.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        {bid !== "" && (
          okBid ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact label="She gets" minor={p.payout} strong />
              <Fact label="Each pays" minor={p.due} />
              <Fact label="Your commission" minor={p.commission} />
              <Fact label="Dividend each" minor={p.dividend} />
            </div>
          ) : (
            <p role="alert" className="mt-2 text-xs" style={{ color: v("--ux-danger-ink") }}>
              The bid must be between ₹{(chit.min_bid_minor / 100).toLocaleString("en-IN")} (the commission) and
              ₹{(chit.max_bid_minor / 100).toLocaleString("en-IN")} (40% of the chit).
            </p>
          )
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="primary" icon="Gavel" disabled={!pick || !okBid}
               onClick={() => void decide({ member_id: pick, bid_rupees: Number(bid) }, "Auction recorded")}>Record the auction</Btn>
          {cancel}
        </div>
      </div>
    );
  }

  if (chit.method === "draw") {
    // The names spin for a moment before the server's pick lands — a draw
    // she watches is one she believes. The pick itself is the server's.
    const draw = async () => {
      let i = 0;
      timer.current = window.setInterval(() => { setRolling(eligible[i++ % eligible.length].name); }, 90);
      const started = Date.now();
      const ok = await run(async () => {
        const c = await apiChitDecide(chit.id, month, { draw: true });
        await new Promise((r) => window.setTimeout(r, Math.max(0, 1300 - (Date.now() - started))));
        return c;
      }, "Drawn");
      if (timer.current) window.clearInterval(timer.current);
      setRolling("");
      if (ok) onDone();
    };
    return (
      <div>
        {head}
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[16px] p-5 text-center" style={{ background: "var(--ux-banner-ground)" }}>
          <Icons.Dices className={`h-10 w-10 text-white ${rolling ? "animate-spin" : ""}`} />
          <p className="min-h-[28px] text-xl font-extrabold text-white">{rolling || `${eligible.length} names in the draw`}</p>
          <button type="button" disabled={!!rolling} onClick={() => void draw()}
                  className="ux-press inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-6 text-base font-extrabold"
                  style={{ color: v("--ux-fill") }}>
            <Icons.Shuffle className="h-5 w-5" /> Draw now
          </button>
        </div>
        <p className="mt-4 text-xs font-semibold" style={{ color: v("--ux-muted") }}>Drawn at your meeting? Pick who:</p>
        {picker}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="outline" icon="Check" disabled={!pick} onClick={() => void decide({ member_id: pick }, "Recorded")}>Record her</Btn>
          {cancel}
        </div>
      </div>
    );
  }

  const next = eligible.find((m) => m.order === month);
  return (
    <div>
      {head}
      {next ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] p-3" style={{ background: v("--ux-brand-tint") }}>
          <Initial name={next.name} me={next.is_me} size={44} />
          <p className="min-w-0 flex-1 text-sm" style={{ color: v("--ux-ink") }}>
            By your order, month {month} goes to <b>{next.is_me ? "you" : next.name}</b>.
          </p>
          <Btn variant="primary" icon="Check" onClick={() => void decide({}, "Confirmed")}>Confirm</Btn>
        </div>
      ) : (
        <div className="mt-3 rounded-[14px] p-3 text-xs" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          No order is set for month {month}.{" "}
          <button type="button" onClick={onMembers} className="font-bold underline" style={{ color: v("--ux-brand") }}>Set the order</button>
          {" "}or pick who takes it:
        </div>
      )}
      {!next && picker}
      <div className="mt-3 flex flex-wrap gap-2">
        {!next && <Btn variant="outline" icon="Check" disabled={!pick} onClick={() => void decide({ member_id: pick }, "Recorded")}>Record her</Btn>}
        {cancel}
      </div>
    </div>
  );
}

function Payments({ chit, month, run, onMembers }: { chit: Chit; month: number; run: Run; onMembers: () => void }) {
  const mo = chit.months[month - 1];
  const owner = chit.viewer === "owner";
  const paid = new Set(mo.paid);
  const claimed = new Set(mo.claimed);
  const empty = chit.members_count - chit.members.length;
  // Who said she paid comes first: that is the organiser's next thing to do.
  const rows = [...chit.members].sort((a, b) => Number(claimed.has(b.id)) - Number(claimed.has(a.id))
    || Number(paid.has(a.id)) - Number(paid.has(b.id)));

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold" style={{ color: v("--ux-ink") }}>Who has paid</h3>
        <span className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>
          {paid.size} of {chit.members.length} · <Amount minor={mo.due_minor} /> each
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: v("--ux-surface-2") }}>
        <div className="h-full rounded-full transition-[width] duration-500"
             style={{ width: `${chit.members.length ? (paid.size / chit.members.length) * 100 : 0}%`, background: v("--ux-green-ink") }} />
      </div>
      <ul className="mt-3 divide-y" style={{ borderColor: v("--ux-line") }}>
        {rows.map((m) => {
          const isPaid = paid.has(m.id);
          const says = claimed.has(m.id);
          return (
            <li key={m.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: v("--ux-line") }}>
              <Initial name={m.name} me={m.is_me} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{m.is_me ? "You" : m.name}</p>
                {says && (
                  <p className="text-2xs font-bold" style={{ color: v("--ux-brand") }}>
                    {owner ? "Says she paid — confirm when it reaches you" : "Waiting for the organiser to confirm"}
                  </p>
                )}
              </div>
              {owner ? (
                <button type="button" aria-pressed={isPaid} onClick={() => void run(() => apiChitPaid(chit.id, month, m.id, !isPaid))}
                        className="ux-press inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                        style={isPaid ? { background: v("--ux-green-ink"), color: "#fff" }
                          : says ? { background: v("--ux-brand"), color: v("--ux-on-brand") }
                            : { background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                  {isPaid ? <><Icons.CheckCircle2 className="h-4 w-4" /> Paid</>
                    : says ? <><Icons.Check className="h-4 w-4" /> Confirm</> : <><Icons.Circle className="h-4 w-4" /> Not paid</>}
                </button>
              ) : m.is_me && !isPaid && !says ? (
                <Btn size="sm" variant="primary" icon="Check" onClick={() => void run(() => apiChitIPaid(chit.id, month), "We told the organiser")}>
                  I paid
                </Btn>
              ) : isPaid ? (
                <Icons.CheckCircle2 className="h-5 w-5" style={{ color: v("--ux-green-ink") }} aria-label="Paid" />
              ) : (
                <Icons.Circle className="h-5 w-5" style={{ color: v("--ux-line-strong") }} aria-label="Not paid yet" />
              )}
            </li>
          );
        })}
      </ul>
      {owner && empty > 0 && (
        <button type="button" onClick={onMembers} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: v("--ux-brand") }}>
          <Icons.UserPlus className="h-4 w-4" /> {empty} {empty === 1 ? "place is" : "places are"} still empty — add members
        </button>
      )}
    </Card>
  );
}

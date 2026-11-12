"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { I, v } from "@/components/ux/kit";
import { Amount } from "@/components/ux/khata/KhataGate";
import type { ChitSummary } from "@/lib/khata-api";
import { METHOD_LOOK, initial, lakhs, monthName } from "./look";

/** A member's round initial — her photo is not ours to show here. */
export function Initial({ name, me, size = 36 }: { name: string; me?: boolean; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold"
          style={{ width: size, height: size, fontSize: size * 0.42,
                   background: v(me ? "--ux-fill" : "--ux-brand-tint"), color: v(me ? "--ux-on-brand" : "--ux-brand") }}>
      {initial(name)}
    </span>
  );
}

/** How the pot is given — picture first, word after. */
export function MethodBadge({ method }: { method: ChitSummary["method"] }) {
  const m = METHOD_LOOK[method];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold"
          style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
      <I name={m.icon} className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}

/** Month X of N, as a bar she can read without the numbers. */
export function MonthBar({ now, total, onBrand }: { now: number; total: number; onBrand?: boolean }) {
  const at = Math.min(Math.max(now, 0), total);
  const label = now <= 0 ? "Not started yet" : now > total ? "Finished" : `Month ${now} of ${total}`;
  return (
    <div>
      <div className="flex items-center justify-between text-2xs font-semibold" style={{ color: onBrand ? "rgba(255,255,255,.85)" : v("--ux-muted") }}>
        <span>{label}</span><span>{Math.round((at / total) * 100)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: onBrand ? "rgba(255,255,255,.25)" : v("--ux-surface-2") }}>
        <div className="h-full rounded-full transition-[width] duration-500"
             style={{ width: `${(at / total) * 100}%`, background: onBrand ? "#fff" : "linear-gradient(90deg, var(--ux-fill), var(--ux-rib-2))" }} />
      </div>
    </div>
  );
}

/** Whose record this is, from where she stands. */
export function viewerLine(c: ChitSummary): { icon: string; text: string } {
  if (c.viewer === "member") return { icon: "Link", text: `Linked by ${c.owner_name || "the organiser"}` };
  return c.my_role === "organiser" ? { icon: "Crown", text: "You organise" } : { icon: "Wallet", text: "You pay in" };
}

export function ChitCard({ c }: { c: ChitSummary }) {
  const who = viewerLine(c);
  return (
    <Link href={`/app/khata/chits/${c.id}`}
          className="ux-card ux-hov ux-press ux-sq flex flex-col gap-3" aria-label={`${c.name}, ${lakhs(c.value_minor / 100)}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
              style={{ background: "var(--ux-pic-ground)", color: "#fff" }}>
          <Icons.Coins className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
          <p className="text-xs" style={{ color: v("--ux-muted") }}>
            {lakhs(c.value_minor / 100)} · {c.members_count} members · <Amount minor={c.monthly_minor} /> a month
          </p>
        </div>
        <Icons.ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: v("--ux-faint") }} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <MethodBadge method={c.method} />
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          <I name={who.icon} className="h-3.5 w-3.5" /> {who.text}
        </span>
        {c.status === "closed" && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
            <Icons.Archive className="h-3.5 w-3.5" /> Closed
          </span>
        )}
      </div>
      <MonthBar now={c.month_now} total={c.members_count} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs" style={{ borderColor: v("--ux-line") }}>
        {c.my_member_id ? (
          c.my_due_minor > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: v("--ux-ink") }}>
              <Icons.Hourglass className="h-4 w-4" style={{ color: v("--ux-brand") }} /> You owe <Amount minor={c.my_due_minor} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: v("--ux-green-ink") }}>
              <Icons.CheckCircle2 className="h-4 w-4" /> All paid
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5" style={{ color: v("--ux-muted") }}>
            <Icons.Coins className="h-4 w-4" /> Collected <Amount minor={c.collected_minor} />
          </span>
        )}
        {c.i_won ? (
          <span className="inline-flex items-center gap-1 font-bold" style={{ color: v("--ux-green-ink") }}>
            <Icons.Trophy className="h-4 w-4" /> You took the pot · month {c.my_turn_month}
          </span>
        ) : c.my_member_id ? (
          <span style={{ color: v("--ux-muted") }}>Ends {monthName(c.end_month)}</span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Calm, not alarming: the three things that protect her. Chit fraud is common,
 * and the most useful sentence is the one that says what WomSakhi never does.
 */
export function SafetyCard() {
  return (
    <section className="ux-card" aria-labelledby="chit-safety">
      <h2 id="chit-safety" className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
        <Icons.ShieldCheck className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Know before you join a chit
      </h2>
      <ul className="mt-2.5 space-y-2 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
        <li className="flex gap-2"><Icons.Lock className="mt-[2px] h-3.5 w-3.5 shrink-0" style={{ color: v("--ux-brand") }} />
          WomSakhi only keeps the record. We never collect or hold chit money.</li>
        <li className="flex gap-2"><Icons.Landmark className="mt-[2px] h-3.5 w-3.5 shrink-0" style={{ color: v("--ux-brand") }} />
          Registered chits follow the Chit Funds Act, 1982: commission at most 5%, a bid at most 40%.</li>
        <li className="flex gap-2"><Icons.ShieldAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" style={{ color: v("--ux-brand") }} />
          Never pay anyone who says they are from WomSakhi.</li>
      </ul>
      <Link href="/app/safe-money" className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: v("--ux-brand") }}>
        Money traps to watch for <Icons.ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

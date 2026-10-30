"use client";

import Link from "next/link";
import { useCallback } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, v } from "@/components/ux/kit";
import { formatMoney } from "@/components/ux/kit/money";
import { apiChits, type ChitSummary } from "@/lib/khata-api";
import { useResource } from "@/lib/use-resource";
import { Amount, useKhata } from "./KhataGate";

/**
 * The Chits tab on My Khata's front page: her three latest chits at a glance,
 * and the way into the full chit screens (/app/khata/chits). The chit value is
 * the chit's name in real life — "the 1 lakh chit" — so it is shown even when
 * amounts are hidden; what she owes is not.
 */
export function KhataChitsSummary() {
  const { locked } = useKhata();
  const chits = useResource(
    useCallback((s: AbortSignal) => apiChits(s).catch((e) => { locked(e); throw e; }), [locked]),
    [] as ChitSummary[],
  );

  return (
    <div className="flex flex-col gap-4">
      {chits.source === "loading" && !chits.data.length ? (
        <span className="ux-skeleton h-[180px] rounded-[18px]" />
      ) : chits.data.length === 0 ? (
        <Card>
          <EmptyState icon="Coins" title="No chits yet"
                      body="Keep your chit here — every month, who paid and who took the pot. WomSakhi only keeps the record; it never holds the money." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {chits.data.slice(0, 3).map((c) => {
            const month = Math.min(Math.max(c.month_now, 0), c.members_count);
            return (
              <Link key={c.id} href={`/app/khata/chits/${c.id}`} className="ux-card ux-hov flex flex-col gap-3">
                <span className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]" style={{ background: "var(--ux-pic-ground)", color: "#fff" }}>
                    <Icons.Coins className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</span>
                    <span className="block text-xs" style={{ color: v("--ux-muted") }}>
                      {formatMoney(c.value_minor)} chit · {c.viewer === "owner" && c.my_role === "organiser" ? "You run it" : "You pay in"}
                    </span>
                  </span>
                </span>
                <span>
                  <span className="flex justify-between text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                    <span>{c.month_now < 1 ? "Starts soon" : c.month_now > c.members_count ? "Finished" : `Month ${month} of ${c.members_count}`}</span>
                    {c.i_won && <span style={{ color: v("--ux-green-ink") }}>You took the pot</span>}
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full" style={{ background: v("--ux-surface-2") }}>
                    <span className="block h-full rounded-full" style={{ width: `${(month / c.members_count) * 100}%`, background: "var(--ux-pic-ground)" }} />
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: v("--ux-muted") }}>{c.my_due_minor > 0 ? "You owe" : "Your dues"}</span>
                  {c.my_due_minor > 0
                    ? <Amount minor={c.my_due_minor} className="font-bold" style={{ color: v("--ux-brand") }} />
                    : <span className="inline-flex items-center gap-1 font-bold" style={{ color: v("--ux-green-ink") }}><Icons.Check className="h-3.5 w-3.5" /> All paid</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Btn href="/app/khata/chits" icon="Coins" full size="lg">Open my chits{chits.data.length > 3 ? ` (${chits.data.length})` : ""}</Btn>
        <Btn href="/app/khata/chits/new" variant="outline" icon="Plus" full size="lg">Start a chit record</Btn>
      </div>
      <p className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
        <Icons.ShieldCheck className="mt-[1px] h-4 w-4 shrink-0" style={{ color: v("--ux-brand") }} />
        A chit run as a business must be registered under the Chit Funds Act. Join chits run by people you know, and never pay
        anyone who asks you to send chit money through WomSakhi.
      </p>
    </div>
  );
}

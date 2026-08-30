"use client";

import { useState } from "react";

import { apiJoinBuy, apiLeaveBuy } from "@/lib/entitlements-api";
import { useAction } from "@/lib/use-action";

import {
  ActionBtn, Btn, Card, EmptyState, Pill, Progress,
  SectionHead, SourceNote
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGroupBuys } from "@/components/ux/entitlements";
import { MORE_ART, rupees } from "@/components/ux/more/data";

/**
 * Group Buying.
 *
 * A wholesale roll of cotton costs a third of what the same metre costs one
 * woman at a shop. She cannot buy a roll; twenty of her can. The whole design
 * is the saving stated as a number she can check — "₹45 saved per metre", not
 * "great value" — and the number of women still needed.
 */
export default function GroupBuyPage() {
  const { data: GROUP_BUYS, source, refetch } = useGroupBuys();
  /**
   * The buys she is in — from the server, which carries `joined_by_me`.
   *
   * This was a local array starting empty: joining changed a button, and the
   * order she thought she had joined went out without her.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  /**
   * **This is still half-wired, and not from this file.** `joined_by_me` is on
   * the wire — `/group-buy` returns it, and it is `true` for a buy she is in —
   * but `toGroupBuy` in `src/components/ux/entitlements.ts` does not map it
   * onto `UxGroupBuy`, so it arrives here as `undefined` on every row. Joining
   * reaches the server and the button is right for the rest of the session,
   * because the optimistic entry stays; her next visit offers "Join this buy"
   * on an order she has already joined. One line in the mapper fixes it.
   */
  const isIn = (g: { id: string; joined_by_me?: boolean }) => pending[g.id] ?? !!g.joined_by_me;
  const joined = GROUP_BUYS.filter(isIn).map((g) => g.id);

  const membership = useAction(
    async (id: string, want: string) => {
      if (want === "join") await apiJoinBuy(id, 1);
      else await apiLeaveBuy(id);
    },
    {
      onDone: refetch,
      optimistic: (id, want) => setPending((p) => ({ ...p, [id]: want === "join" })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "That did not go through. You are not in this order — try again in a moment.",
    },
  );

  const open = GROUP_BUYS.filter((g) => g.joined < g.need);

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="How it works" icon="Info" />
            <ol className="space-y-3">
              {[
                "Enough women say they want the same thing.",
                "The group orders it wholesale, at the wholesale price.",
                "You pay only when the order actually goes ahead.",
                "If not enough join, nothing happens and you pay nothing.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-green))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MORE_ART.group} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Start one yourself
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              If you buy something regularly, others near you probably buy it too.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/circles/new" variant="soft" size="sm" icon="Plus">Propose a buy</Btn>
            </div>
          </div>
        </div>
      }
    >
      <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Buying together</h1>
      <p className="mb-[20px] mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
        {open.length} open now. You pay nothing unless enough women join and the order goes ahead.
      </p>

      <SourceNote source={source} what="buys" />

      {/* A refusal appears where she pressed, in words she can act on. The
          rollback happened silently before this: the button simply went back
          to "Join this buy" and nothing said why. */}
      {membership.error && (
        <p role="alert" className="ux-slide-up mb-3 rounded-[11px] p-3 text-[12.5px] leading-relaxed"
           style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
          {membership.error}
        </p>
      )}

      {GROUP_BUYS.length ? (
        <div className="ux-deck ux-stagger space-y-[13px]">
          {GROUP_BUYS.map((g, i) => {
            const full = g.need > 0 && g.joined >= g.need;
            const on = joined.includes(g.id);
            const busy = membership.busyWith === g.id;
            const save = g.alone_minor - g.together_minor;
            const pct = g.need > 0 ? Math.round((g.joined / g.need) * 100) : 0;
            return (
              <Card key={g.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }} pad={0}>
                <div className="flex">
                  <span className="h-[164px] w-[176px] shrink-0 overflow-hidden" style={{ background: "var(--ux-tint-orange)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.art} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col p-[16px]">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-[15.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {g.what}
                      </h3>
                      {full && <Pill tone="green" size="sm">Going ahead</Pill>}
                    </div>
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>Organised by {g.by}</p>

                    {/* The saving as a number she can check, not "great value". */}
                    <div className="mt-3 flex items-baseline gap-3">
                      <span className="text-[22px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                        {rupees(g.together_minor)}
                      </span>
                      <span className="text-[13px] line-through tabular-nums" style={{ color: "var(--ux-faint)" }}>
                        {rupees(g.alone_minor)}
                      </span>
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--ux-green-ink)" }}>
                        {rupees(save)} less {g.unit}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                        <span style={{ color: full ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
                          {full ? "Enough women — this is happening" : `${g.need - g.joined} more women needed`}
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                          {g.joined} of {g.need}
                        </span>
                      </div>
                      <Progress pct={pct} track="--ux-track" tone={full ? "--ux-green" : "--ux-brand-600"} h={6} />
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3.5">
                      <span className="text-[11.5px]" style={{ color: "var(--ux-faint)" }}>{g.closes}</span>
                      {full && !on ? (
                        <ActionBtn variant="outline" size="sm" icon="Bell" done="We will tell you when it reopens">Tell me next time</ActionBtn>
                      ) : (
                        <Btn variant={on ? "outline" : "primary"} size="sm"
                             icon={busy ? "Loader" : on ? "Check" : undefined}
                             iconEnd={busy || on ? undefined : "ArrowRight"}
                             disabled={busy}
                             onClick={() => void membership.run(g.id, on ? "leave" : "join")}>
                          {busy ? "Sending…" : on ? "You are in" : "Join this buy"}
                        </Btn>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon="ShoppingBasket" title="Nothing open right now"
                      body="Propose something you buy often and see who else needs it."
                      action={<Btn href="/app/circles/new" variant="primary" icon="Plus">Propose a buy</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}

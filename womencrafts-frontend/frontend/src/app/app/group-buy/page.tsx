"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useState } from "react";

import { apiJoinBuy, apiLeaveBuy, apiWatchBuy } from "@/lib/entitlements-api";
import { toast } from "@/components/ux/mobile/Toast";
import { useAction } from "@/lib/use-action";

import {
  Btn, Card, EmptyState, Progress,
  SectionHead, SourceNote
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGroupBuys } from "@/components/ux/entitlements";
import { MORE_ART as RAW_MORE_ART, rupees } from "@/components/ux/more/data";
import { useT } from "@/i18n";
import { MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";
import { useTranslated } from "@/i18n/data";

/**
 * Group Buying.
 *
 * A wholesale roll of cotton costs a third of what the same metre costs one
 * woman at a shop. She cannot buy a roll; twenty of her can. The whole design
 * is the saving stated as a number she can check — "₹45 saved per metre", not
 * "great value" — and the number of women still needed.
 */
export default function GroupBuyPage() {
  const MORE_ART = useTranslated(RAW_MORE_ART);
  const tr = useT();
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

  // "Tell me next time" — a real row on the server; the next round of this
  // item notifies her. It used to say "We will tell you" and record nothing.
  const [watch, setWatch] = useState<Record<string, boolean>>({});
  const watching = (g: { id: string; watching?: boolean }) => watch[g.id] ?? !!g.watching;
  const notifyMe = useAction(
    async (id: string, on: boolean) => {
      await apiWatchBuy(id, on);
      toast(on ? "We will tell you when the next round opens" : "Okay — no reminder for this one", { tone: "success" });
    },
    {
      onDone: refetch,
      optimistic: (id, on) => setWatch((w) => ({ ...w, [id]: on })),
      rollback: (id) => setWatch((w) => { const n = { ...w }; delete n[id]; return n; }),
      fallbackError: "That did not save. Try again in a moment.",
    },
  );

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("groupbuy.howItWorks")} icon="Info" />
            <ol className="space-y-3">
              {[
                "Enough women say they want the same thing.",
                "The group orders it wholesale, at the wholesale price.",
                "You pay only when the order actually goes ahead.",
                "If not enough join, nothing happens and you pay nothing.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-green))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={MORE_ART.group} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("groupbuy.startOneYourself")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("groupbuy.ifYouBuySomethingRegularlyOthers")}</p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/circles/new" variant="soft" size="sm" icon="Plus">{tr("groupbuy.proposeABuy")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlaceMark size={44} />
        <h1 className="ux-screen-title text-2xl font-bold min-w-0" style={{ color: "var(--ux-ink)" }}>{tr("groupbuy.buyTogether")}</h1>
      </div>
      <p className="mb-6 mt-1.5 text-xsm lg:mb-[20px]" style={{ color: "var(--ux-muted)" }}>
        {open.length} open now. You pay nothing unless enough women join and the order goes ahead.
      </p>

      <SourceNote source={source} what="buys" />

      {/* A refusal appears where she pressed, in words she can act on. The
          rollback happened silently before this: the button simply went back
          to "Join this buy" and nothing said why. */}
      {membership.error && (
        <p role="alert" className="ux-slide-up mb-3 rounded-[12px] px-4 py-3 text-xsm leading-relaxed lg:p-3"
           style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
          {membership.error}
        </p>
      )}

      {GROUP_BUYS.length ? (
        <MediaGrid cols={2}>
          {GROUP_BUYS.map((g) => {
            const full = g.need > 0 && g.joined >= g.need;
            const on = joined.includes(g.id);
            const busy = membership.busyWith === g.id;
            const save = g.alone_minor - g.together_minor;
            const pct = g.need > 0 ? Math.round((g.joined / g.need) * 100) : 0;
            return (
              <MediaCard
                key={g.id}
                // Every buy used to show the same stock picture; this is the
                // thing itself — cloth, thread, tiffin boxes, a gas cylinder.
                image={artFor([g.what, g.unit], "product", null, g.id)}
                alt={g.what}
                topLeft={full ? { text: tr("groupbuy.goingAhead"), tone: "green" } : { text: `${g.joined} of ${g.need} joined`, tone: "light" }}
                topRight={{ text: rupees(g.together_minor), tone: "dark" }}
                overlay={<span>{rupees(save)} less {g.unit}</span>}
                title={g.what}
                subtitle={<>Organised by {g.by}</>}
                meta={<span className="inline-flex items-center gap-2">
                  <span className="line-through tabular-nums" style={{ color: "var(--ux-faint)" }}>{rupees(g.alone_minor)} alone</span>
                  <span className="font-semibold" style={{ color: "var(--ux-green-ink)" }}>{rupees(g.together_minor)} together</span>
                </span>}
                footer={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs" style={{ color: "var(--ux-faint)" }}>{g.closes}</span>
                    {full && !on ? (
                      <Btn variant={watching(g) ? "soft" : "outline"} size="sm" icon={watching(g) ? "Check" : "Bell"}
                           loading={notifyMe.busyWith === g.id}
                           onClick={() => void notifyMe.run(g.id, !watching(g))}>
                        {watching(g) ? tr("groupbuy.weWillTellYouWhenIt") : tr("groupbuy.tellMeNextTime")}
                      </Btn>
                    ) : (
                      <Btn variant={on ? "outline" : "primary"} size="sm"
                           icon={busy ? "Loader" : on ? "Check" : undefined}
                           iconEnd={busy || on ? undefined : "ArrowRight"}
                           disabled={busy}
                           onClick={() => void membership.run(g.id, on ? "leave" : "join")}>
                        {busy ? "Sending…" : on ? tr("groupbuy.youAreIn") : tr("groupbuy.joinThisBuy")}
                      </Btn>
                    )}
                  </div>
                }
              >
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span style={{ color: full ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
                    {full ? "Enough women — this is happening" : `${g.need - g.joined} more women needed`}
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>{g.joined} of {g.need}</span>
                </div>
                <Progress pct={pct} track="--ux-track" tone={full ? "--ux-green" : "--ux-brand-600"} h={6} />
              </MediaCard>
            );
          })}
        </MediaGrid>
      ) : (
        <Card>
          <EmptyState icon="ShoppingBasket" title={tr("groupbuy.nothingOpenRightNow")}
                      body={tr("group-buy.proposeSomethingYouBuyOftenAnd")}
                      action={<Btn href="/app/circles/new" variant="primary" icon="Plus">{tr("groupbuy.proposeABuy2")}</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}

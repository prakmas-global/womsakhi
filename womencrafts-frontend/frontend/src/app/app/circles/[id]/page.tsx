"use client";

import { use, useState } from "react";
import { COPY } from "@/components/ux/copy";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, IconTile, Pill, Progress, RailSkeleton, ScreenSkeleton, SectionHead,
  Tabs,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TurnOrder } from "@/components/ux/circles/parts";
import { memberCount, rupees } from "@/components/ux/circles/data";
import { useCircle, useCircleSavings } from "@/components/ux/growth";
import { apiJoinCircle, apiLeaveCircle } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useT } from "@/i18n";

/**
 * One circle.
 *
 * For a savings circle the first thing on the page is the turn order, because
 * "when is my turn?" is why she opened it. For a community circle it is the
 * conversation. Same route, two genuinely different screens — pretending they
 * are one screen with a different label is how both end up mediocre.
 */
export default function CircleDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: detail, source, refetch } = useCircle(id);
  const { data: sv } = useCircleSavings(id);
  const CIRCLE_POSTS = detail.posts;
  const c = detail.circle;
  const [tab, setTab] = useState("Overview");
  /**
   * Joined, as the server has it — with a press that is still in flight
   * allowed to show through.
   *
   * This was `useState(c?.joined ?? false)`, which is wrong twice over. The
   * initialiser runs on the first render, while the circle is still on its
   * way, so it always started `false` and never corrected itself: a woman
   * already in a circle was invited to join it. And the button only ever set
   * that flag — she pressed Join, the word changed, and the circle never
   * heard.
   */
  const [pending, setPending] = useState<boolean | null>(null);
  const joined = pending ?? c?.joined ?? false;

  const membership = useAction(
    async (want: string) => {
      if (want === "join") await apiJoinCircle(id);
      else await apiLeaveCircle(id);
    },
    {
      onDone: refetch,
      optimistic: (want) => setPending(want === "join"),
      rollback: () => setPending(null),
      fallbackError: COPY.writeFailed,
    },
  );

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way.
  if (!c && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!c) {
    return (
      <HomeShell active="/app/circles">
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("circles.thatCircleIsNotHere")}
            body="It may have closed, or the link may be old."
            action={<Btn href="/app/circles" variant="primary" iconEnd="ArrowRight">{tr("circles.allCircles")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  // The server decides whether this circle collects money, and how much has
  // come in. All of this used to be a hardcoded list of eleven women.
  const savings = !!sv?.is_savings;
  const paid = sv?.members_paid ?? 0;
  const total = sv?.members_total ?? 0;
  // Her own turn, if the circle has agreed an order. Stated only when it is
  // known — a turn nobody agreed is not a promise to make on her behalf.
  const myTurn = sv?.members.find((m) => m.you)?.turn ?? 0;

  return (
    <HomeShell
      active="/app/circles"
      rail={
        <div className="space-y-[16px]">
          {savings ? (
            <Card>
              <SectionHead title={tr("circles.thisMonth")} />
              <div className="flex items-baseline justify-between">
                <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("circles.everyonePays")}</span>
                <span className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {rupees(sv?.monthly_minor ?? 0)}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span style={{ color: "var(--ux-muted)" }}>{tr("circles.collectedSoFar")}</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                    {paid} of {total}
                  </span>
                </div>
                <Progress pct={total ? (paid / total) * 100 : 0} track="--ux-track" />
              </div>
              {/* Whose turn it is, from the circle's own agreed order. This
                  line named "Sunita Devi" on every savings circle in the app,
                  whoever was actually next. */}
              {sv?.whose_turn && (
                <div className="mt-4 rounded-[12px] p-3" style={{ background: "var(--ux-tint-green)" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                    <strong style={{ color: "var(--ux-ink)" }}>{sv.whose_turn}</strong> takes the pot of{" "}
                    <strong style={{ color: "var(--ux-ink)" }}>{rupees(sv.pot_minor)}</strong> this month.
                  </p>
                </div>
              )}
              <div className="mt-3">
                <Btn href={`/app/circles/${c.id}/pay`} variant="primary" full icon="IndianRupee">{tr("circles.payThisMonth")}</Btn>
              </div>
            </Card>
          ) : (
            <Card>
              <SectionHead title={tr("circles.aboutThisCircle")} />
              <div className="space-y-3 text-xsm">
                {[["Members", memberCount(c.members)], ["Where", c.place], ["Activity", c.activity]].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span style={{ color: "var(--ux-muted)" }}>{k}</span>
                    <span className="font-medium" style={{ color: "var(--ux-ink)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionHead title={tr("circles.circleRules")} icon="ShieldCheck" />
            <ul className="space-y-2.5">
              {(savings
                ? ["Pay by the 1st of every month", "The order was agreed by everyone at the start",
                   "Tell the circle early if a month will be hard", "Nobody may take two turns"]
                : ["Be kind — everyone here is learning", "No selling in the main thread",
                   "What is shared here stays here"]
              ).map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Link href="/app/circles"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" />{tr("circles.allCircles2")}</Link>

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        <div className="relative h-[150px] overflow-hidden" style={{ background: `var(${c.tint})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={c.art} alt="" className="h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.42), transparent 62%)" }} />
        </div>
        <div className="p-[20px]">
          <div className="flex items-start gap-3.5">
            <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={52} radius={14} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{c.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
                <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {c.place}</span>
                <span className="inline-flex items-center gap-1"><Icons.Users className="h-4 w-4" /> {memberCount(c.members)} members</span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Pill tone={savings ? "green" : c.kind === "Trade" ? "orange" : "pink"}>{c.kind} circle</Pill>
                {joined && <Pill tone="brand">{tr("circles.youAreIn")}</Pill>}
              </div>
            </div>
            <div className="shrink-0">
              {joined
                ? <Btn variant="outline" icon="Check" disabled={membership.busy}
                       onClick={() => void membership.run("leave")}>
                    {membership.busy ? "Leaving…" : "Joined"}
                  </Btn>
                : <Btn variant="primary" iconEnd="ArrowRight" disabled={membership.busy}
                       onClick={() => void membership.run("join")}>
                    {membership.busy ? "Joining…" : "Join this circle"}
                  </Btn>}
            </div>
          </div>
          <p className="mt-3.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{c.blurb}</p>
        </div>
      </Card>

      <div className="mb-[16px]">
        <Tabs items={savings ? ["Overview", "Turn order", "Talk"] : ["Overview", "Talk", "Members"]}
              active={tab} onChange={setTab} />
      </div>

      {tab === "Turn order" && savings && (
        <Card>
          <SectionHead title={tr("circles.whoseTurnAndWhen")}
                       sub={myTurn
                         ? `Month ${sv?.round ?? 1} of ${total} — yours is month ${myTurn}`
                         : `Month ${sv?.round ?? 1} of ${total}`} />
          <TurnOrder members={sv?.members ?? []} currentMonth={sv?.round ?? 1} />
        </Card>
      )}

      {tab === "Members" && (
        <Card>
          <SectionHead title={tr("circles.whoIsHere")} sub={`${memberCount(c.members)} members`} />
          {/* The women in this circle, from the database. This grid used to
              show the same eleven invented names in every circle in the app. */}
          <div className="ux-deck grid grid-cols-2 gap-2.5">
            {(sv?.members ?? []).map((m, i) => (
              <div key={`${m.name}-${i}`} className="ux-i ux-sq flex items-center gap-3 rounded-[12px] border p-2.5"
                   style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={m.avatar} alt="" className="h-[36px] w-[36px] shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full text-xsm font-semibold"
                        style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet)" }}>
                    {m.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-xsm" style={{ color: "var(--ux-ink)" }}>
                  {m.name}{m.you && <span style={{ color: "var(--ux-brand)" }}> — you</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(tab === "Talk" || tab === "Overview") && (
        <div className="space-y-[12px]">
          {tab === "Overview" && savings && (
            <Card>
              <SectionHead title={tr("circles.whereThisCircleHasGotTo")}
                           sub={`Month ${sv?.round ?? 1} of ${total}`} action="See turn order" onAction={() => setTab("Members")} />
              <TurnOrder members={(sv?.members ?? []).slice(0, 4)} currentMonth={sv?.round ?? 1} />
            </Card>
          )}
          <Card>
            <SectionHead title={tab === "Talk" ? "Conversation" : "Latest from the circle"}
                         action={tab === "Talk" ? undefined : "See all"} onAction={() => setTab("Talk")} />
            <div className="ux-deck ux-stagger space-y-2.5">
              {CIRCLE_POSTS.map((p, i) => (
                <div key={p.id} className="ux-i ux-sq flex items-start gap-3 rounded-[12px] border p-3"
                     style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={p.avatar} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xsm">
                      <span className="font-semibold" style={{ color: "var(--ux-ink)" }}>{p.who}</span>
                      <span style={{ color: "var(--ux-faint)" }}>{p.when}</span>
                      {p.pinned && <Pill tone="brand" size="sm">Pinned</Pill>}
                    </p>
                    <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{p.text}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                      <Icons.MessageCircle className="h-3.5 w-3.5" /> {p.replies} replies
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </HomeShell>
  );
}

"use client";

import { use, useState } from "react";

import { apiAdvanceOrder, apiCancelShopOrder } from "@/lib/shop-api";
import { messageFrom } from "@/lib/use-action";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  Btn, Card, EmptyState, IconTile, Pill, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBusiness } from "@/components/ux/business";
import { STATE_TONE, rupees, type OrderState } from "@/components/ux/shop/data";

const FLOW: OrderState[] = ["New", "Making", "Ready", "Sent", "Done"];

/**
 * One order.
 *
 * The whole screen answers "what do I do next", so the next step is a single
 * button and everything else is context. A row of every possible state change
 * is a quiz; one button is an action.
 *
 * The buyer's own words are quoted verbatim near the top, because a custom
 * request buried under a status track is how the wrong thing gets made.
 */
export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: biz, source, refetch } = useBusiness();
  const ORDERS = biz.orders;
  const o = ORDERS.find((x) => x.id === id);
  const [state, setState] = useState<OrderState | null>(null);
  // Declared with the other state, above the early returns — hooks have to run
  // in the same order every render, and this screen returns early while the
  // order is still loading.
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way — saying it during the fetch makes the screen flash "that is not
  // here" before showing itself.
  if (!o && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!o) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="PackageX"
            title="That order is not here"
            body="It may have been cancelled, or the link may be old."
            action={<Btn href="/app/documents" variant="primary" iconEnd="ArrowRight">Your orders</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const now = state ?? o.state;
  const at = FLOW.indexOf(now);
  const tone = STATE_TONE[now];
  const cancelled = now === "Cancelled";

  /**
   * Move it along, or call it off — both on the server.
   *
   * Both buttons used to write into local state. "Cancelled" appeared on her
   * screen and nowhere else, so she stopped making something the buyer was
   * still expecting.
   */
  async function act(what: "advance" | "cancel") {
    setBusy(true);
    setProblem("");
    try {
      const fresh = what === "advance" ? await apiAdvanceOrder(id) : await apiCancelShopOrder(id);
      setState(fresh.state as OrderState);
      refetch();
    } catch (e) {
      setProblem(messageFrom(e, "That did not go through. The order is as it was — try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  const advance = () => void act("advance");

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="What to do next" />
            {tone.next ? (
              <>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  {now === "New" ? "She is waiting to hear you have started."
                    : now === "Making" ? "Tell her when it is finished and ready to collect or post."
                    : now === "Ready" ? "Mark it sent once it is on its way or in her hands."
                    : "Mark it done once she has it and has paid."}
                </p>
                {/* One button, one next step. */}
                <div className="mt-4">
                  <Btn variant="primary" full iconEnd="ArrowRight" onClick={advance}>{tone.next}</Btn>
                </div>
              </>
            ) : (
              <p className="flex items-center gap-2 text-[12.5px]" style={{ color: cancelled ? "var(--ux-muted)" : "var(--ux-green-ink)" }}>
                {cancelled
                  ? <><Icons.CircleSlash className="h-[16px] w-[16px]" /> This order was cancelled.</>
                  : <><Icons.CheckCheck className="h-[16px] w-[16px]" /> Finished and paid.</>}
              </p>
            )}
            <div className="mt-2.5 flex gap-2">
              <Btn href="/app/messages" variant="outline" size="sm" full icon="MessageCircle">Message her</Btn>
            </div>
          </Card>

          <Card>
            <SectionHead title="The buyer" />
            <div className="ux-hov flex items-center gap-3">
              <IconTile icon="User" tint="--ux-tint-violet" ink="--ux-violet" size={44} radius={12} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{o.buyer}</p>
                <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                  {o.channel === "Repeat" ? "Has ordered before" : `Found you through ${o.channel}`}
                </p>
              </div>
            </div>
            <div className="mt-3.5 space-y-2.5 text-[12.5px]">
              {[["Ordered", o.when], ["Reference", o.ref], ["Quantity", `${o.qty}`]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span style={{ color: "var(--ux-muted)" }}>{k}</span>
                  <span className="font-medium" style={{ color: "var(--ux-ink)" }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {!cancelled && now !== "Done" && (
            <Card style={{ borderColor: "var(--ux-line-strong)" }}>
              <SectionHead title="If you cannot do it" icon="Info" />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                Tell her today rather than late. Cancelling early costs you nothing and she can find someone
                else in time.
              </p>
              <div className="mt-3.5">
                <Btn variant="outline" size="sm" full disabled={busy}
                     onClick={() => void act("cancel")}>
                  {busy ? "Telling her…" : "Cancel this order"}
                </Btn>
              </div>
              {problem && (
                <p role="alert" className="ux-slide-up mt-2.5 text-[12px] leading-relaxed"
                   style={{ color: "var(--ux-orange-ink)" }}>
                  {problem}
                </p>
              )}
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/documents"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Your orders
      </Link>

      <Card className="mb-[15px]">
        <div className="flex items-start gap-4">
          <span className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[16px]"
                style={{ background: "var(--ux-tint-orange)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.art} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h1 className="min-w-0 flex-1 text-[22px] font-bold leading-tight"
                  style={{ color: cancelled ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                {o.item}
              </h1>
              <Pill tone={tone.pill}>{now}</Pill>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1.5"><Icons.User className="h-4 w-4" /> {o.buyer}</span>
              <span>{o.ref}</span>
              <span>×{o.qty}</span>
            </p>
          </div>
          <p className="shrink-0 text-[22px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
            {rupees(o.amount_minor)}
          </p>
        </div>

        {/* Her own words, quoted, above the status track — a custom request
            buried under a progress bar is how the wrong thing gets made. */}
        <div className="mt-4 flex items-start gap-3 rounded-[13px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
          <Icons.Quote className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          <div className="min-w-0">
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--ux-ink)" }}>
              “Could you make it a little longer at the back? About two inches.”
            </p>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
              {o.buyer}, when she ordered
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-[15px]">
        <SectionHead title="Where it has got to" sub={cancelled ? "This order was cancelled" : o.due} />
        {cancelled ? (
          <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Nothing further is expected. The buyer has been told.
          </p>
        ) : (
          <ol className="relative ps-[26px]">
            <span aria-hidden className="absolute bottom-3 start-[10px] top-3 w-[2px] rounded-full"
                  style={{ background: "var(--ux-line)" }} />
            {FLOW.map((s, i) => {
              const done = i < at;
              const here = i === at;
              return (
                <li key={s} className="ux-rise relative pb-4 last:pb-0" style={{ ["--i" as string]: i }}>
                  <span className="absolute -start-[26px] top-[2px] grid h-[21px] w-[21px] place-items-center rounded-full"
                        style={{ background: done ? "var(--ux-green-ink)" : here ? "var(--ux-brand-600)" : "var(--ux-surface)",
                                 border: done || here ? "none" : "2px dashed var(--ux-line-strong)" }}>
                    {done && <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3.2} />}
                    {here && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                  </span>
                  <p className="text-[13.5px] font-semibold"
                     style={{ color: done || here ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                    {s}
                    {here && <span className="ms-2 text-[11.5px] font-medium" style={{ color: "var(--ux-brand)" }}>now</span>}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--ux-muted)" }}>
                    {["She placed the order", "You are making it", "Waiting to be collected or posted",
                      "On its way to her", "She has it, and has paid"][i]}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card>
        <SectionHead title="What you will be paid" />
        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--ux-muted)" }}>{o.item} × {o.qty}</span>
            <span className="font-medium tabular-nums" style={{ color: "var(--ux-ink)" }}>{rupees(o.amount_minor)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--ux-muted)" }}>WomSakhi fee</span>
            <span className="font-medium" style={{ color: "var(--ux-green-ink)" }}>None</span>
          </div>
        </div>
        <div className="my-3.5 h-px" style={{ background: "var(--ux-line)" }} />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>Reaches your wallet</span>
          <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
            {rupees(o.amount_minor)}
          </span>
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          {now === "Done" ? "Already in your wallet."
            : "Paid into your wallet once she confirms she has it — usually within three days of you marking it sent."}
        </p>
      </Card>
    </HomeShell>
  );
}

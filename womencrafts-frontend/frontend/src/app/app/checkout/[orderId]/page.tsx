"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, Pill, SectionHead, Skeleton } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { formatMoney } from "@/components/ux/kit/money";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";
import { settled, useAttemptKey } from "@/lib/idempotency";
import { apiConfirmPayment, apiOrder, apiPaymentMethods, type Order, type PaymentConfig } from "@/lib/member-api";

/** How each method looks. Anything the server adds later still renders. */
const LOOK: Record<string, { icon: string; tint: string; ink: string; detail: string }> = {
  upi:        { icon: "Smartphone",  tint: "--ux-tint-violet", ink: "--ux-violet", detail: "Pay from any UPI app" },
  card:       { icon: "CreditCard",  tint: "--ux-tint-orange", ink: "--ux-orange", detail: "Debit or credit" },
  netbanking: { icon: "Landmark",    tint: "--ux-tint-blue",   ink: "--ux-blue",   detail: "Straight from your bank" },
  wallet:     { icon: "Wallet",      tint: "--ux-tint-green",  ink: "--ux-green",  detail: "Your WomSakhi balance" },
  cash:       { icon: "Store",       tint: "--ux-tint-amber",  ink: "--ux-amber",  detail: "Hand it over in person" },
};
const PLAIN = { icon: "CircleDollarSign", tint: "--ux-tint-blue", ink: "--ux-blue", detail: "" };

interface Loaded { order: Order | null; config: PaymentConfig | null }
const NOTHING: Loaded = { order: null, config: null };

/**
 * Paying for something.
 *
 * Three rules. The total never changes between this screen and her bank — no
 * fee appears at the last step, because that is the moment trust is lost and
 * it does not come back. Paying is one-way: while it is in flight the button
 * is gone, so a slow connection cannot become two payments. And a decline is
 * said out loud with the reason, because a woman who sees nothing happen will
 * press again, and pressing again is the expensive mistake.
 *
 * **This screen used to be a lie.** It held two hardcoded orders, showed one
 * of them whatever the id in the address bar said, and its Pay button waited
 * 1.1 seconds before announcing "Paid" without ever calling the server.
 */
export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);

  // Two independent reads, so they go together. Sequenced, this screen would
  // cost two round trips to Atlas before she sees a price.
  const load = useCallback(
    async (signal: AbortSignal): Promise<Loaded> => {
      const [order, config] = await Promise.all([apiOrder(orderId, signal), apiPaymentMethods()]);
      return { order, config };
    },
    [orderId],
  );
  const { data, source, error, refetch } = useResource<Loaded>(load, NOTHING);
  const order = data.order;

  const [method, setMethod] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [paid, setPaid] = useState<Order | null>(null);
  const attempt = useAttemptKey("confirm");

  const methods = data.config?.methods ?? [];
  const chosen = method || methods[0]?.key || "";

  /** Take the payment. See `useAttemptKey` for why the key is per press. */
  async function pay() {
    if (!order || !chosen) return;
    setSending(true);
    setProblem("");
    try {
      const got = await apiConfirmPayment(order.id, chosen, {}, attempt.current());
      attempt.settle();
      if (got.status === "paid") {
        setPaid(got);
      } else {
        // The server answers a decline with a FAILED order, not an error. Left
        // unhandled this screen would sit still and she would press again.
        setProblem(
          got.failure_reason
            || "The payment did not go through. Nothing has left your account — try another way to pay.",
        );
      }
    } catch (e) {
      if (settled(e)) attempt.settle();
      setProblem(messageFrom(e, "That did not go through. Nothing has left your account — try again in a moment."));
    } finally {
      setSending(false);
    }
  }

  // Already paid, on this visit or a previous one. Returning to the address
  // must not offer to charge her a second time.
  const done = paid ?? (order?.status === "paid" ? order : null);
  if (done) return <Paid order={done} />;

  if (source === "loading") return <LoadingCheckout />;
  if (!order) return <Missing error={error} onRetry={refetch} />;

  const backTo = order.purpose === "program" ? "/app/programs" : "/app/events";

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="What you are paying" />
            <div className="space-y-2.5 text-xsm">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ux-muted)" }}>{order.purpose === "program" ? "Course" : "Booking"}</span>
                <span className="font-medium tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {formatMoney(order.amount_minor)}
                </span>
              </div>
              {/* Stated as zero rather than left out — an absent line reads as a
                  fee waiting to appear. */}
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ux-muted)" }}>WomSakhi fee</span>
                <span className="font-medium" style={{ color: "var(--ux-green-ink)" }}>None</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ux-muted)" }}>Taxes</span>
                <span className="font-medium" style={{ color: "var(--ux-ink)" }}>Included</span>
              </div>
            </div>
            <div className="my-3.5 h-px" style={{ background: "var(--ux-line)" }} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Total</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {order.amount_label || formatMoney(order.amount_minor)}
              </span>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              This is the exact amount that will leave your account. Nothing is added afterwards.
            </p>

            <div className="mt-4">
              {sending ? (
                <Btn variant="primary" full icon="Loader" disabled>Sending…</Btn>
              ) : (
                <Btn variant="primary" full iconEnd="ArrowRight" onClick={pay} disabled={!chosen}>
                  Pay {formatMoney(order.amount_minor)}
                </Btn>
              )}
            </div>

            {problem && (
              <p role="alert" className="ux-slide-up mt-2.5 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}

            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-2xs" style={{ color: "var(--ux-faint)" }}>
              <Icons.Lock className="h-[12px] w-[12px]" /> Your card details never reach WomSakhi
            </p>
          </Card>

          <Card>
            <SectionHead title="If it goes wrong" icon="ShieldCheck" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              If money leaves your account but the payment fails, it comes back on its own within 5–7 working
              days. If it does not, tell us and we will chase it.
            </p>
          </Card>
        </div>
      }
    >
      <Link href={backTo}
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Checkout</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        One step. Nothing is taken until you press the button.
      </p>

      <Card className="mb-[16px]">
        <SectionHead title="What you are getting" />
        <div className="flex items-center gap-4">
          <IconTile icon={order.purpose === "program" ? "GraduationCap" : "CalendarCheck"}
                    tint="--ux-tint-violet" ink="--ux-violet" size={64} radius={13} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                {order.title}
              </h2>
              <Pill tone="brand" size="sm">{order.purpose === "program" ? "Course" : "Booking"}</Pill>
            </div>
            <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
              Started {order.created}
            </p>
          </div>
          <p className="shrink-0 text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
            {formatMoney(order.amount_minor)}
          </p>
        </div>
      </Card>

      <Card>
        <SectionHead title="How you want to pay" />
        <div className="ux-deck space-y-2.5">
          {methods.map((m, i) => {
            const look = LOOK[m.key] ?? PLAIN;
            const on = chosen === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                aria-pressed={on}
                className="ux-i ux-sq flex w-full items-center gap-3.5 rounded-[12px] border p-3.5 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <IconTile icon={look.icon} tint={look.tint} ink={look.ink} size={42} radius={11} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {m.label}
                  </span>
                  {look.detail && (
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                      {look.detail}
                    </span>
                  )}
                </span>
                {on && <Icons.CheckCircle2 className="ux-pop h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-brand)" }} />}
              </button>
            );
          })}
        </div>
      </Card>
    </HomeShell>
  );
}

function Paid({ order }: { order: Order }) {
  const course = order.purpose === "program";
  return (
    <HomeShell>
      <Card className="ux-slide-up mx-auto max-w-[560px]">
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid h-[68px] w-[68px] place-items-center rounded-full"
                style={{ background: "var(--ux-tint-green)" }}>
            <Icons.CheckCheck className="h-[32px] w-[32px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2} />
          </span>
          <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>Paid</h1>
          <p className="mt-2 max-w-[38ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            {order.amount_label || formatMoney(order.amount_minor)} for {order.title}. The receipt is in Money,
            and you can start straight away.
          </p>
          <p className="mt-3 font-mono text-xs" style={{ color: "var(--ux-faint)" }}>{order.id}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Btn href={course ? "/app/programs" : "/app/bookings"} variant="primary" iconEnd="ArrowRight">
              {course ? "Start the course" : "See your booking"}
            </Btn>
            <Btn href="/app/payments" variant="outline" icon="Receipt">Receipt</Btn>
          </div>
        </div>
      </Card>
    </HomeShell>
  );
}

/** The price is the last thing to settle, so its space is held from the start. */
function LoadingCheckout() {
  return (
    <HomeShell rail={<Card><SectionHead title="What you are paying" /><Skeleton h={190} r={12} /></Card>}>
      <Skeleton w={160} h={26} />
      <Card className="mb-[16px] mt-[20px]"><Skeleton h={72} r={12} /></Card>
      <Card><SectionHead title="How you want to pay" /><Skeleton h={210} r={12} /></Card>
    </HomeShell>
  );
}

function Missing({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <HomeShell>
      <Card className="mx-auto max-w-[520px]">
        <div className="flex flex-col items-center py-4 text-center">
          <IconTile icon="SearchX" tint="--ux-tint-amber" ink="--ux-amber" size={54} radius={14} />
          <h1 className="mt-3.5 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>
            We could not find that payment
          </h1>
          <p className="mt-2 max-w-[40ch] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            {messageFrom(error, "It may have been finished already, or the link may be old. Nothing has been charged.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Btn onClick={onRetry} variant="primary" icon="RotateCw">Try again</Btn>
            <Btn href="/app/payments" variant="outline" icon="Receipt">Your payments</Btn>
          </div>
        </div>
      </Card>
    </HomeShell>
  );
}

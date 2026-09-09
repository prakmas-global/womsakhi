"use client";

import { useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, Tabs, escapeHtml, letterhead, plural,
  printDocument
} from "@/components/ux/kit";
import { Rows, rowMemo } from "@/components/ux/kit/rows";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { usePayoutMethods, useOrders, type UxOrder } from "@/components/ux/business";
import { useAction, type Action } from "@/lib/use-action";
import { apiStartOrder } from "@/lib/member-api";
import { useMe } from "@/components/ux/me";

import { PayoutMethod } from "@/components/ux/money/parts";
import { rupeesExact } from "@/components/ux/money/data";
import { formatMoneyOrNothing } from "@/components/ux/kit/money";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";

type Status = "paid" | "refunded" | "failed" | "created";

/** Shaped to `Order` in lib/member-api — id, title, amount_minor, status, method. */

const TONE: Record<Status, { pill: "green" | "blue" | "orange" | "neutral"; word: string }> = {
  paid:     { pill: "green",   word: "Paid" },
  refunded: { pill: "blue",    word: "Refunded to you" },
  failed:   { pill: "orange",  word: "Did not go through" },
  created:  { pill: "neutral", word: "Waiting" },
};

/**
 * Money — what she has paid for, and how.
 *
 * Separate from Earn on purpose. Money coming in and money going out answer
 * different questions, and a single combined ledger makes both harder to read.
 */
export default function PaymentsPage() {
  const tr = useT();
  const { data: ORDERS, source } = useOrders();
  const { data: PAYOUT_METHODS } = usePayoutMethods();

  /**
   * Retry a declined payment.
   *
   * Starts a fresh order for the same thing and sends her to checkout for it.
   * Navigating straight to the failed order's checkout — which is what the
   * button did — lands her on a payment that has already been refused.
   */
  const retry = useAction(
    async (_id: string, purpose: string, referenceId: string) => {
      const started = await apiStartOrder(purpose as "booking" | "program", referenceId);
      window.location.href = `/app/checkout/${started.order.id}`;
    },
    { fallbackError: "We could not start that again. Try in a moment." },
  );
  const ME = useMe();
  const [tab, setTab] = useState("All");

  const shown = useMemo(() => ORDERS.filter((o) => {
    if (tab === "Paid") return o.status === "paid";
    if (tab === "Refunds") return o.status === "refunded";
    if (tab === "Problems") return o.status === "failed";
    return true;
  }), [tab, ORDERS]);

  const spent = ORDERS.filter((o) => o.status === "paid").reduce((a, o) => a + o.amount_minor, 0);
  const back = ORDERS.filter((o) => o.status === "refunded").reduce((a, o) => a + o.amount_minor, 0);
  const trouble = ORDERS.filter((o) => o.status === "failed").length;

  return (
    <HomeShell
      active="/app/payments"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("payments.thisYear")} />
            <div className="space-y-3.5">
              {[
                ["Paid out", formatMoneyOrNothing(spent, "Nothing yet"), "ArrowUpRight", "--ux-tint-violet", "--ux-violet"],
                // No refunds is good news, and "₹0" does not read as good news
                // — it reads as a figure that failed to load.
                ["Came back to you", formatMoneyOrNothing(back, "None"), "RotateCcw", "--ux-tint-blue", "--ux-blue"],
                ["Needs attention", `${trouble}`, "TriangleAlert", "--ux-tint-orange", "--ux-orange"],
              ].map(([label, val, icon, tint, ink]) => (
                <div key={label} className="ux-hov flex items-center gap-3">
                  <IconTile icon={icon} tint={tint} ink={ink} size={38} />
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{val}</p>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("payments.howYouPay")} action="Manage"
                         onAction={() => { window.location.href = "/app/settings/payments"; }} />
            <div className="space-y-2.5">
              {PAYOUT_METHODS.map((m) => <PayoutMethod key={m.id} m={m} />)}
            </div>
            <div className="mt-3">
              <Btn href="/app/settings/payments" variant="outline" size="sm" full icon="Plus">{tr("payments.addAPaymentMethod")}</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("payments.somethingWrong")} icon="ShieldCheck" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              If money left your account but the payment did not go through, it comes back on its own
              within 5–7 working days. If it does not, tell us and we will chase it.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/help" variant="soft" size="sm" full iconEnd="ArrowRight">{tr("payments.raiseAProblem")}</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("payments.whatYouPaid")}</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {shown.length} {plural("payment", shown.length)}
            {trouble > 0 && ` · ${trouble} needs a look`}
          </p>

      <SourceNote source={source} what="payments" />
        </div>
        <Tabs items={["All", "Paid", "Refunds", "Problems"]} active={tab} onChange={setTab} />
      </div>

      {shown.length ? (
        <Rows
          items={shown}
          keyOf={(o) => o.id}
          render={(o, i) => <PaymentRow item={o} index={i} retry={retry} me={ME} />}
          className="ux-deck ux-stagger space-y-[12px]"
        />
      ) : (
        <Card>
          <EmptyState
            icon="Receipt"
            title={tab === "Problems" ? "Nothing has gone wrong" : `No ${tab.toLowerCase()} yet`}
            body="Courses, sessions and circle contributions you pay for appear here with a receipt."
            action={<Btn onClick={() => setTab("All")} variant="soft">{tr("payments.showEverything")}</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}


/**
 * One payment.
 *
 * Split out of the list and memoised on `item` so that changing the tab, or a
 * retry going out on one row, does not re-render every other receipt. With a
 * few payments that is invisible; the women this is for keep years of them.
 */
const PaymentRow = rowMemo(function PaymentRow({
  item, index, retry, me,
}: {
  item: UxOrder;
  index: number;
  retry: Action<[string, string, string]>;
  me: { name: string };
}) {
  const tr = useT();
  return (
    <Card className="ux-i ux-onscroll" style={{ ["--i" as string]: index }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon={item.icon} tint={item.tint} ink={item.ink} size={46} radius={12} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                  {item.title}
                </h3>
                <Pill tone={TONE[item.status].pill} size="sm">{TONE[item.status].word}</Pill>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs" style={{ color: "var(--ux-muted)" }}>
                <span>{item.purpose}</span>
                <span className="inline-flex items-center gap-1"><Icons.CreditCard className="h-3.5 w-3.5" /> {item.method}</span>
                <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {item.when}</span>
              </p>
            </div>
            <div className="shrink-0 text-end">
              {/* Exact paise here: this is the one screen where a receipt has
                  to match her bank statement to the last digit. */}
              <p className="text-base font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {rupeesExact(item.amount_minor)}
              </p>
              <p className="mt-0.5 text-2xs" style={{ color: "var(--ux-faint)" }}>{item.ref}</p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
               style={{ borderColor: "var(--ux-line)" }}>
            <span className="text-xs" style={{ color: "var(--ux-faint)" }}>
              {item.status === "failed"
                ? "No money left your account."
                : item.status === "refunded"
                  ? tr("payments.returnedToTheWayYouPaid")
              : tr("payments.receiptAvailable")}
            </span>
            <span className="flex items-center gap-2">
              {/* A real receipt. Refunds and failures say so on the page
                  rather than printing a document that claims she paid. */}
              <ActionBtn variant="outline" size="sm" icon="Download" doneIcon="Printer"
                         done={COPY.saveAsPdf}
                         act={() => printDocument(`Receipt — ${item.title}`, `
                           ${letterhead("Receipt", `${me.name} · ${escapeHtml(item.when)}`)}
                           <table><tbody>
                             <tr><td>What</td><td>${escapeHtml(item.title)}</td></tr>
                             <tr><td>Why</td><td>${escapeHtml(item.purpose)}</td></tr>
                             <tr><td>{tr("payments.paidWith")}</td><td>${escapeHtml(item.method)}</td></tr>
                             <tr><td>Status</td><td>${escapeHtml(TONE[item.status].word)}</td></tr>
                             <tr class="total"><td>Amount</td><td class="num">${rupeesExact(item.amount_minor)}</td></tr>
                           </tbody></table>
                           <p class="foot">Reference ${escapeHtml(item.ref)}.
                           ${item.status === "failed" ? "No money left your account." :
                             item.status === "refunded" ? "This amount was returned to the way you paid." :
                             "Verify at womsakhi.in/verify."}</p>`)}>
                Receipt
              </ActionBtn>
              {item.status === "failed" && (
                /* A fresh attempt, not a re-open of the failed order. The
                   server deliberately gives a declined payment its own
                   record — that history is what you need when somebody
                   disputes a charge — so retrying starts a new one for the
                   same thing rather than resurrecting the old one. */
                <Btn variant="primary" size="sm" icon="RotateCcw"
                     className={retry.busyWith === item.id ? "pointer-events-none opacity-60" : ""}
                     onClick={() => void retry.run(item.id, item.purpose, item.reference_id)}>
                  {retry.busyWith === item.id ? "Starting…" : "Try again"}
                </Btn>
              )}
            </span>
          </div>
      </Card>
  );
});

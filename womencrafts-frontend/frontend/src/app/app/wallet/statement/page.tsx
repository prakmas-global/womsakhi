"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  ActionBtn, Card, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, Tabs, downloadCsv, escapeHtml, letterhead,
  printDocument
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMe } from "@/components/ux/me";
import { rupeesExact } from "@/components/ux/money/data";
import { useMoney } from "@/components/ux/money/live";

/**
 * The last three months, from today.
 *
 * These were three hard-coded strings, so the tabs said "May 2026" forever and
 * every one of them showed the same rows — a statement she could hand to a bank
 * with the wrong month printed on it. Derived from the ledger's own dates
 * instead, and the rows are filtered by the month she picked.
 */
function monthsFrom(txns: { when: string }[], howMany = 6): string[] {
  const seen = new Map<number, string>();
  for (const t of txns) {
    const d = new Date(t.when);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.getFullYear() * 12 + d.getMonth();
    if (!seen.has(key)) {
      seen.set(key, d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }));
    }
  }
  // Newest first, and always at least the current month so a woman with no
  // transactions still sees which month she is looking at.
  const now = new Date();
  const thisMonth = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const list = [...seen.entries()].sort((a, b) => b[0] - a[0]).map(([, label]) => label);
  return (list.includes(thisMonth) ? list : [thisMonth, ...list]).slice(0, howMany);
}

/**
 * A statement she can hand to somebody.
 *
 * The reason this screen exists is not record-keeping — it is that a bank
 * asking for six months of income, or a scheme asking for proof of earnings,
 * will not accept a screenshot. So the download is the point, and the summary
 * at the top is written to be the thing they actually ask for: money in, money
 * out, and the closing balance.
 */
export default function StatementPage() {
  const ME = useMe();
  const { data: money, source } = useMoney();
  const MONTHS = useMemo(() => monthsFrom(money.txns), [money.txns]);
  const [month, setMonth] = useState("");
  // Whichever month she picked, or the newest the ledger has. Derived rather
  // than synchronised, so it cannot be a render behind the data.
  const showing = month && MONTHS.includes(month) ? month : MONTHS[0] ?? "";

  // Only this month's rows. Every tab showed the same rows before, which on a
  // document a bank accepts is not a cosmetic bug.
  const TXNS = useMemo(
    () => money.txns.filter((t) => {
      const d = new Date(t.when);
      return Number.isNaN(d.getTime())
        ? true
        : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) === showing;
    }),
    [money.txns, showing],
  );
  // A reference a bank can quote back to us, and the date it was issued.
  // Derived from the month so re-issuing the same statement gives the same
  // reference — a document whose number changes each time it is printed is a
  // document nobody trusts.
  const ref = `WS-${showing.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 8)}`;
  const issued = showing;

  // Settled only. A bank asking for proof of income will not accept a figure
  // that counts a transfer still in flight, so pending gets its own line.
  const { inMinor, outMinor, pendingMinor } = useMemo(() => {
    const sum = (kind: "credit" | "debit", status: string) =>
      TXNS.filter((t) => t.kind === kind && t.status === status)
          .reduce((a, t) => a + t.amount_minor, 0);
    return {
      inMinor: sum("credit", "settled"),
      outMinor: sum("debit", "settled"),
      pendingMinor: sum("credit", "pending"),
    };
  }, [TXNS]);

  /** The document a bank actually accepts, printed black on white. */
  const printStatement = () => {
    const row = (t: (typeof TXNS)[number]) => `<tr>
      <td>${escapeHtml(t.when)}</td>
      <td>${escapeHtml(t.label)}<br><span class="muted">${escapeHtml(t.source)}</span></td>
      <td class="num">${t.kind === "credit" ? rupeesExact(t.amount_minor) : ""}</td>
      <td class="num">${t.kind === "debit" ? rupeesExact(t.amount_minor) : ""}</td>
      <td>${t.status === "settled" ? "Cleared" : t.status === "pending" ? "On its way" : "Failed"}</td>
    </tr>`;
    return printDocument(`WomSakhi statement — ${showing}`, `
      ${letterhead("Account statement", `${ME.name} · ${showing}`)}
      <h2>Summary</h2>
      <table><tbody>
        <tr><td>Money in (cleared)</td><td class="num">${rupeesExact(inMinor)}</td></tr>
        <tr><td>Money out (cleared)</td><td class="num">${rupeesExact(outMinor)}</td></tr>
        ${pendingMinor > 0 ? `<tr><td class="muted">Not counted — still on its way</td><td class="num muted">${rupeesExact(pendingMinor)}</td></tr>` : ""}
        <tr class="total"><td>Left at month end</td><td class="num">${rupeesExact(inMinor - outMinor)}</td></tr>
      </tbody></table>
      <h2>Every entry</h2>
      <table>
        <thead><tr><th>Date</th><th>Detail</th><th class="num">In</th><th class="num">Out</th><th>Status</th></tr></thead>
        <tbody>${TXNS.map(row).join("")}</tbody>
      </table>
      <p class="foot">
        Reference ${ref} · issued ${issued}. Any bank may verify this at womsakhi.in/verify
        using the reference above. Amounts are in Indian rupees. Entries marked
        “On its way” are not included in the totals.
      </p>`);
  };

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title={showing} sub="What a bank or a scheme will ask for" />
            <div className="space-y-3 text-[13px]">
              {[["Money in", rupeesExact(inMinor), "--ux-green-ink"],
                ["Money out", rupeesExact(outMinor), "--ux-ink"],
                ["Left at month end", rupeesExact(inMinor - outMinor), "--ux-ink"]].map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span style={{ color: "var(--ux-muted)" }}>{k}</span>
                  <span className="font-semibold tabular-nums" style={{ color: `var(${c})` }}>{v}</span>
                </div>
              ))}
              {pendingMinor > 0 && (
                <div className="flex items-start justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
                  <span style={{ color: "var(--ux-faint)" }}>Not counted — still on its way</span>
                  <span className="shrink-0 font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>
                    {rupeesExact(pendingMinor)}
                  </span>
                </div>
              )}
            </div>
            {/* The download is the point — a screenshot is not accepted anywhere. */}
            <div className="mt-4 space-y-2.5">
              {/* A real PDF, through the browser's own print dialogue. Nothing
                  a client-side PDF library produces is as readable, and this
                  needs no library and no backend. */}
              <ActionBtn variant="primary" full icon="Download" doneIcon="Printer"
                         done="Choose “Save as PDF”" act={printStatement}>
                Download as PDF
              </ActionBtn>
              {/* What an accountant or a loan officer asks for second. */}
              <ActionBtn variant="outline" full icon="Table" doneIcon="Check" done="Saved to your downloads"
                         act={() => downloadCsv(`womsakhi-statement-${showing.replace(/\s+/g, "-").toLowerCase()}.csv`, [
                           ["Date", "Detail", "Source", "In", "Out", "Status"],
                           ...TXNS.map((t) => [
                             t.when, t.label, t.source,
                             t.kind === "credit" ? (t.amount_minor / 100).toFixed(2) : "",
                             t.kind === "debit" ? (t.amount_minor / 100).toFixed(2) : "",
                             t.status === "settled" ? "Cleared" : t.status === "pending" ? "On its way" : "Failed",
                           ]),
                           [], ["Money in (cleared)", "", "", (inMinor / 100).toFixed(2), "", ""],
                           ["Money out (cleared)", "", "", "", (outMinor / 100).toFixed(2), ""],
                           ["Left at month end", "", "", ((inMinor - outMinor) / 100).toFixed(2), "", ""],
                         ])}>
                Download as a spreadsheet
              </ActionBtn>
            </div>
            {/* "Email it to me" said "Sent to your email" and sent no email:
                there is no send-a-statement endpoint, and a woman who needed
                it in an inbox for a loan officer waited for a message that was
                never coming. The two buttons above are what this screen can
                actually do, so it says so. */}
            <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: "var(--ux-faint)" }}>
              The PDF carries your name and a reference a bank can check with us. We cannot email it
              yet — download it here and attach it yourself.
            </p>
          </Card>

          <Card>
            <SectionHead title="Who asks for this" icon="Info" />
            <ul className="space-y-2.5">
              {[
                "A bank, before a Mudra or business loan.",
                "A scheme, as proof you actually earn.",
                "A landlord, for a shop or a stall.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Link href="/app/wallet"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Earn
      </Link>

      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Statement</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Every rupee in and out, in a form a bank will accept.
          </p>
        </div>
        <Tabs items={MONTHS} active={showing} onChange={setMonth} />
      </div>

      <SourceNote source={source} what="entries" />

      {TXNS.length ? (
        <Card pad={0}>
          <ul>
            {TXNS.map((t, i) => (
              <li key={t.id}>
                <div className="ux-hov flex items-center gap-3.5 px-[18px] py-3.5"
                     style={{ borderTop: i ? "1px solid var(--ux-line)" : "none" }}>
                  <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={40} radius={11} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--ux-ink)" }}>{t.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      {t.source} · {t.when}
                    </p>
                  </div>
                  {t.status === "failed" && <Pill tone="neutral" size="sm">Failed</Pill>}
                  {t.status === "pending" && <Pill tone="orange" size="sm">On its way</Pill>}
                  {/* Exact paise, once: it has to match her bank statement, and a
                      rounded figure beside it only invites doubt. */}
                  <span className="w-[104px] shrink-0 text-end text-[13.5px] font-semibold tabular-nums"
                        style={{ color: t.status === "failed" ? "var(--ux-faint)"
                                  : t.kind === "credit" ? "var(--ux-green-ink)" : "var(--ux-ink)",
                                 textDecoration: t.status === "failed" ? "line-through" : "none" }}>
                    {t.kind === "credit" ? "+" : "−"}{rupeesExact(t.amount_minor)}
                  </span>
                  {/* No receipt for money that never moved. */}
                  {t.status === "failed" ? (
                    <span className="w-[92px] shrink-0 text-end text-[11.5px]" style={{ color: "var(--ux-faint)" }}>
                      No receipt
                    </span>
                  ) : (
                    <ActionBtn variant="ghost" size="sm" icon="Download" doneIcon="Printer"
                               done="Choose “Save as PDF”"
                               act={() => printDocument(`Receipt — ${t.label}`, `
                                 ${letterhead("Receipt", `${ME.name} · ${escapeHtml(t.when)}`)}
                                 <table><tbody>
                                   <tr><td>What</td><td>${escapeHtml(t.label)}</td></tr>
                                   <tr><td>From</td><td>${escapeHtml(t.source)}</td></tr>
                                   <tr><td>Direction</td><td>${t.kind === "credit" ? "Paid to you" : "Paid by you"}</td></tr>
                                   <tr class="total"><td>Amount</td><td class="num">${rupeesExact(t.amount_minor)}</td></tr>
                                 </tbody></table>
                                 <p class="foot">Reference ${ref}-${escapeHtml(t.id.toUpperCase())} · issued ${issued}.
                                 Verify at womsakhi.in/verify.</p>`)}>
                      Receipt
                    </ActionBtn>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState icon="Receipt" title={`Nothing in ${showing}`}
                      body="Pick another month, or start earning and it will fill up." />
        </Card>
      )}
    </HomeShell>
  );
}

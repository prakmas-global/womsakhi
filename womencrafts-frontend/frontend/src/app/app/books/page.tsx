"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  ENTRIES, VIA_LABEL, offPlatform, owedTotal, paidTotal, promisedTotal, type Entry,
} from "@/components/ux/books/data";

/**
 * Your books.
 *
 * ── Own the ledger, not the storefront ──────────────────────────────────────
 * She is already selling — 61% of women selling on Jumia also sell through
 * WhatsApp, more than men do — and the evidence on marketplaces is poor. So
 * this screen does not ask her to move anything. It takes the three questions
 * WhatsApp cannot answer: **who owes me, what did I promise, what did I make.**
 *
 * The benchmark to beat is not an AI assistant. It is eBay's plain seller
 * dashboard, which raised small-seller revenue 3.6% in a randomised trial with
 * a third of the effect coming from sellers just watching their own numbers.
 */

const STATE: Record<Entry["state"], { label: string; tint: string; ink: string; icon: string }> = {
  paid: { label: "Paid", tint: "--ux-tint-green", ink: "--ux-green-ink", icon: "Check" },
  owed: { label: "Owes you", tint: "--ux-tint-amber", ink: "--ux-amber-ink", icon: "Clock" },
  promised: { label: "You promised", tint: "--ux-tint-blue", ink: "--ux-blue-ink", icon: "CalendarDays" },
};

type Filter = "all" | "owed" | "promised" | "paid";

export default function BooksPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Entry[]>(ENTRIES);
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  const paid = useMemo(() => paidTotal(rows), [rows]);
  const owed = useMemo(() => owedTotal(rows), [rows]);
  const promised = useMemo(() => promisedTotal(rows), [rows]);
  const off = useMemo(() => offPlatform(rows), [rows]);
  const late = useMemo(() => rows.filter((e) => e.state === "owed"), [rows]);

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((e) => e.state === filter)),
    [rows, filter],
  );

  const markPaid = useCallback((id: string) => {
    setRows((r) => r.map((e) => (e.id === id ? { ...e, state: "paid", on: "Just now", lateDays: undefined } : e)));
    const e = rows.find((x) => x.id === id);
    setNote(`${e?.who} paid ${formatRupees(e?.minor ?? 0)}. It is in your month now.`);
  }, [rows]);

  const remind = useCallback((id: string) => {
    const e = rows.find((x) => x.id === id);
    setNote(`Reminder ready for ${e?.who} — polite, with the amount and the date. You send it.`);
  }, [rows]);

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Your books
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              Who owes you what
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Keep selling wherever you already sell. This just remembers it — including the{" "}
              <b>{off}%</b> that never touches this app.
            </p>
          </div>
          <Btn variant="outline" icon="FileText" href="/app/books/proof">Proof of income</Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(paid)} label="Came in" icon="Check"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(owed)} label="Owed to you" icon="Clock"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={formatRupees(promised)} label="You have promised" icon="CalendarDays"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
          {late.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>
                <b>{late.length}</b> {late.length === 1 ? "person is" : "people are"} late.
                Most people who are late simply forgot.
              </p>
              <Btn size="sm" variant="soft" onClick={() => setFilter("owed")}>See who</Btn>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Everything" sub="However and wherever the sale happened"
                       icon="BookOpen" chip={String(rows.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Clock" selected={filter === "owed"} onClick={() => setFilter("owed")}>
              Owes you{late.length > 0 && ` (${late.length})`}
            </Chip>
            <Chip icon="CalendarDays" selected={filter === "promised"} onClick={() => setFilter("promised")}>You promised</Chip>
            <Chip icon="Check" selected={filter === "paid"} onClick={() => setFilter("paid")}>Paid</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="BookOpen" title="Nothing here"
                              body="Try another filter."
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>Show everything</Btn>} /></Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((e) => {
                const s = STATE[e.state];
                return (
                  <Card key={e.id} pad={16}>
                    <div className="flex flex-wrap items-center gap-3.5">
                      <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{e.who}</p>
                          <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold uppercase tracking-[0.06em]"
                                style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                          {e.lateDays && e.lateDays > 7 && <Pill tone="orange" size="sm">{e.lateDays} days</Pill>}
                        </div>
                        <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                          {e.what} · {e.on} · {VIA_LABEL[e.via]}
                        </p>
                      </div>
                      <p className="shrink-0 text-[1rem] font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                        {formatRupees(e.minor)}
                      </p>
                      {e.state === "owed" && (
                        <div className="flex shrink-0 gap-2">
                          <Btn size="sm" variant="outline" onClick={() => remind(e.id)}>Remind</Btn>
                          <Btn size="sm" onClick={() => markPaid(e.id)}>Paid</Btn>
                        </div>
                      )}
                      {e.state === "promised" && (
                        <Btn size="sm" variant="outline" onClick={() => markPaid(e.id)}>Done and paid</Btn>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Sales made on WhatsApp or in person count exactly the same here. Your books are yours —
              they are not a reason to sell through us.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

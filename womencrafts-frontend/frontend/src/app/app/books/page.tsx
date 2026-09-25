"use client";

import { useCallback, useMemo, useState } from "react";
import { useResource } from "@/lib/use-resource";
import { apiBooks, apiEditEntry, type BookEntry, type Books } from "@/lib/books-api";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import {
  VIA_LABEL as RAW_VIA_LABEL, offPlatform,
} from "@/components/ux/books/data";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { useTranslated } from "@/i18n/data";

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

const STATE: Record<BookEntry["state"], { label: string; tint: string; ink: string; icon: string }> = {
  paid: { label: "Paid", tint: "--ux-tint-green", ink: "--ux-green-ink", icon: "Check" },
  owed: { label: "Owes you", tint: "--ux-tint-amber", ink: "--ux-amber-ink", icon: "Clock" },
  promised: { label: "You promised", tint: "--ux-tint-blue", ink: "--ux-blue-ink", icon: "CalendarDays" },
};

/** Nothing, until the server answers. Never a plausible-looking ledger. */
const EMPTY_BOOKS: Books = {
  entries: [], paid_minor: 0, owed_minor: 0, promised_minor: 0, late_count: 0,
};

/**
 * "Today", "Yesterday", "3 days ago", then a date.
 *
 * The fixture carried these as strings she had written — "Today", "Due 3 days
 * ago" — and the server sends an instant instead, correctly: only an instant
 * survives a timezone and still means the same day tomorrow. Rendering it raw
 * put `2026-09-25T14:37:00.052000` in her ledger, which is the one thing worse
 * than no date at all.
 */
function whenLabel(iso: string, tr: (k: MessageKey, p?: Record<string, string | number>) => string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return tr("books.today");
  if (days === 1) return tr("books.yesterday");
  if (days < 7) return tr("books.daysAgo", { days });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type Filter = "all" | "owed" | "promised" | "paid";

export default function BooksPage() {
  const VIA_LABEL = useTranslated(RAW_VIA_LABEL);
  const tr = useT();
  const router = useRouter();

  /*
    Her ledger, from the server.

    This screen ran on `ENTRIES` — a fixture whose own comment read "Mock data
    throughout". Nine invented customers owed her money she had never been
    owed, and anything she added herself lived in React state: she could write
    down a sale, watch the totals move, and lose it on reload. For the one
    screen in this product whose entire job is remembering what she is owed,
    that is the worst possible failure.
  */
  const { data: books, refetch } = useResource(
    useCallback(async (sig: AbortSignal) => apiBooks(sig), []),
    EMPTY_BOOKS,
  );
  const rows = books.entries;

  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  // Totalled by the server, so the header and the rows can never disagree.
  const paid = books.paid_minor;
  const owed = books.owed_minor;
  const promised = books.promised_minor;
  const off = useMemo(() => offPlatform(rows), [rows]);
  const late = useMemo(() => rows.filter((e) => e.state === "owed"), [rows]);

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((e) => e.state === filter)),
    [rows, filter],
  );

  const markPaid = useCallback(async (id: string) => {
    const e = rows.find((x) => x.id === id);
    // Written before it is said. The old version announced "it is in your
    // month now" over a change that existed only in this tab.
    await apiEditEntry(id, { state: "paid" });
    await refetch();
    setNote(tr("books.paidNow", { who: e?.who ?? "", amount: formatRupees(e?.minor ?? 0) }));
  }, [rows, refetch, tr]);

  const remind = useCallback((id: string) => {
    const e = rows.find((x) => x.id === id);
    setNote(`Reminder ready for ${e?.who} — polite, with the amount and the date. You send it.`);
  }, [rows]);

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("books.yourBooks")}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("books.whoOwesYouWhat")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Keep selling wherever you already sell. This just remembers it — including the{" "}
              <b>{off}%</b> {tr("books.thatNeverTouchesThisApp")}
            </p>
          </div>
          <Btn variant="outline" icon="FileText" href="/app/books/proof" className="max-lg:w-full">{tr("books.proofOfIncome")}</Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(paid)} label={tr("books.cameIn")} icon="Check"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(owed)} label={tr("books.owedToYou")} icon="Clock"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={formatRupees(promised)} label={tr("books.youHavePromised")} icon="CalendarDays"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
          {late.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                <b>{late.length}</b> {late.length === 1 ? tr("books.personIs")
              : tr("books.peopleAre")} late.
                Most people who are late simply forgot.
              </p>
              <Btn size="sm" variant="soft" onClick={() => setFilter("owed")}>{tr("books.seeWho")}</Btn>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <Section title="Everything" sub={tr("books.howeverAndWhereverTheSaleHappened")}
                   icon="BookOpen" chip={String(rows.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Clock" selected={filter === "owed"} onClick={() => setFilter("owed")}>
              Owes you{late.length > 0 && ` (${late.length})`}
            </Chip>
            <Chip icon="CalendarDays" selected={filter === "promised"} onClick={() => setFilter("promised")}>{tr("books.youPromised")}</Chip>
            <Chip icon="Check" selected={filter === "paid"} onClick={() => setFilter("paid")}>Paid</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="BookOpen" title={tr("books.nothingHere")}
                              body={tr("books.tryAnotherFilter")}
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>{tr("books.showEverything")}</Btn>} /></Card>
          ) : (
            <div className={`flex flex-col gap-2.5 ${GROUP}`}>
              {shown.map((e) => {
                const s = STATE[e.state];
                return (
                  <Card key={e.id} pad={16} className={GROUP_ROW}>
                    <div className="flex flex-wrap items-center gap-3.5">
                      <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{e.who}</p>
                          <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-[0.06em]"
                                style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                          {e.late_days > 7 && <Pill tone="orange" size="sm">{tr("books.daysLate", { days: e.late_days })}</Pill>}
                        </div>
                        <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                          {e.what} · {whenLabel(e.on, tr)} · {VIA_LABEL[e.via]}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                        {formatRupees(e.minor)}
                      </p>
                      {e.state === "owed" && (
                        <div className="flex shrink-0 gap-2 max-lg:w-full max-lg:ps-[52px]">
                          <Btn size="sm" variant="outline" className="max-lg:flex-1" onClick={() => remind(e.id)}>Remind</Btn>
                          <Btn size="sm" className="max-lg:flex-1" onClick={() => markPaid(e.id)}>Paid</Btn>
                        </div>
                      )}
                      {e.state === "promised" && (
                        <Btn size="sm" variant="outline" className="max-lg:ms-[52px] max-lg:w-[calc(100%-52px)] max-lg:px-4" onClick={() => markPaid(e.id)}>{tr("books.doneAndPaid")}</Btn>
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
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Sales made on WhatsApp or in person count exactly the same here. Your books are yours —
              they are not a reason to sell through us.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

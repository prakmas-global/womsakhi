"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useCallback, useMemo, useState } from "react";
import { useResource } from "@/lib/use-resource";
import { apiShopOrders, type ShopOrder } from "@/lib/shop-api";
import { apiBooks, type Books } from "@/lib/books-api";
import { formatMoney } from "@/components/ux/kit/money";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, Pill, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { SCAMS as RAW_SCAMS, type ScamPattern } from "@/components/ux/reach/data";
import { apiFileReport } from "@/lib/safety-api";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Picks, Text } from "@/components/ux/kit/form";
import { Area } from "@/components/ux/kit/form";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Money traps — the lesson turned into a guardrail.
 *
 * ── Why /app/digital was not enough ─────────────────────────────────────────
 * Digital literacy teaches spotting a scam message as a lesson. A lesson is
 * read once, months before any money moves, and by someone who is not at that
 * moment being told she has won a contract. She is now taking payments and
 * shipping goods, so the teaching has to exist at the point of risk.
 *
 * ── Led by their words, not by a category name ──────────────────────────────
 * "Advance fee fraud" means nothing. *"Registration and material kit, ₹500"* is
 * recognisable, because it is the sentence she will actually be sent. So every
 * pattern opens with the message in quotation marks, in the register the scam
 * is written in, and only then explains it.
 *
 * ── The single sentence that prevents most of it ────────────────────────────
 * **A PIN is only ever for sending money.** Anyone asking her to approve a
 * request or enter a PIN in order to *receive* money is taking it. This is the
 * most misunderstood mechanic in UPI and it is set as the hero of the screen
 * rather than filed as item four in a list.
 *
 * Every pattern here targets home-based women workers specifically — the
 * work-from-home kit fee, the overpayment reversal, the courier-it-first bulk
 * order, the expiring-KYC link.
 */
export default function SafeMoneyPage() {
  const SCAMS = useTranslated(RAW_SCAMS);
  const tr = useT();
  const [open, setOpen] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /**
   * Filing a report about a buyer.
   *
   * The button used to set a boolean and print "Recorded — the next woman
   * this buyer approaches will see it." Nothing was recorded and no woman
   * would see anything. On a screen about being cheated, telling her she has
   * warned the next woman when she has not is the worst possible lie: she
   * stops there, satisfied, and the buyer moves on to somebody else.
   *
   * It now goes to `/safety/reports`, which is read by staff.
   */
  const file = useCallback(async () => {
    if (!what.trim()) { setErr("What happened?"); return; }
    setBusy(true); setErr(null);
    try {
      await apiFileReport({
        category: "Money or fraud",
        details: what.trim(),
        about: who.trim(),
      });
      setReported(true); setReporting(false); setWho(""); setWhat("");
    } catch {
      setErr("That did not send. Nothing has been filed — please try again.");
    } finally { setBusy(false); }
  }, [who, what]);

  const flip = useCallback((id: string) => setOpen((o) => (o === id ? null : id)), []);

  return (
    <HomeShell active="/app/safe-money">
      <div className="flex flex-col gap-6 lg:gap-5" id="safe-money-page">

        <header>
          <p className={EYEBROW}>{tr("safemoney.moneyTraps")}</p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] min-w-0"
                style={{ color: v("--ux-ink") }}>{tr("safemoney.theTricksAimedAtWomenWorking")}</h1>
          </div>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            These are not general internet scams. Each one below is written for a woman who sews,
            cooks or does mehendi at home, and each is the exact message you will be sent.
          </p>
          <div className="mt-3"><ReadAloud targetId="safe-money-page" label={tr("safemoney.readTheseToMe")} /></div>
        </header>

        {/* The one rule, given the whole width it deserves. */}
        <div className="rounded-[var(--ux-r-card)] p-4 sm:px-9 lg:py-7"
             style={{ background: v("--ux-fill") }}>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:text-2xs lg:font-extrabold lg:tracking-[0.18em]"
             style={{ color: v("--ux-on-brand"), opacity: 0.75 }}>{tr("safemoney.ifYouRememberOneThing")}</p>
          <p className="mt-2.5 max-w-[22ch] text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
             style={{ color: v("--ux-on-brand") }}>{tr("safemoney.aPinIsOnlyEverFor")}</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed"
             style={{ color: v("--ux-on-brand"), opacity: 0.9 }}>
            Money coming to you needs nothing from you — no PIN, no approval, no code. If a screen
            asks for your PIN, you are paying someone, whatever they told you. That one sentence
            stops most of what is below.
          </p>
        </div>

        {/* Their words first. */}
        <div>
          <Section title={tr("safemoney.whatTheyWillSayToYou")}
                       sub={tr("safemoney.tapOneToSeeWhatIs")} icon="MessageSquareWarning"
                       chip={String(SCAMS.length)} />
          <div className="flex flex-col gap-3">
            {SCAMS.map((s) => <Trap key={s.id} s={s} open={open === s.id} onFlip={() => flip(s.id)} />)}
          </div>
        </div>

        {/* Point-of-risk check — from HER records and HER answers, nothing invented. */}
        <BuyerCheck onReport={(name) => { setWho(name); setReporting(true); setErr(null); }} reported={reported} />

        {reported && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" />
              Filed. Someone at WomSakhi will read it. You can see everything you have
              reported under Safety.</p>
          </Card>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Users" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              If something feels wrong, ask your circle before you act — not after. Nobody there will
              think less of you for asking, and every woman who has been cheated says the same thing
              afterwards: she knew, and she was in a hurry.
            </p>
          </div>
        </Card>
      </div>

      <Sheet
        open={reporting}
        onClose={() => { setReporting(false); setErr(null); }}
        icon="Flag" title="Report a buyer"
        description="This goes to a person at WomSakhi, not to the buyer. Nothing is sent to them and they are not told."
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" full onClick={() => { setReporting(false); setErr(null); }}>Cancel</Btn>
            <Btn full loading={busy} onClick={file}>Send it</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div><Label hint="If you know it">Who</Label>
            <Text value={who} onChange={setWho} label="Who the buyer is"
                  placeholder="A name, a shop, or a number" max={120} /></div>
          <div><Label need>What happened</Label>
            <Picks options={REPORT_PHRASES} value={what.split(". ")} multi label="What happened"
                   onPick={(x) => setWhat(togglePhrase(what, x))} />
            <div className="mt-2.5">
              <Area value={what} onChange={setWhat} label="What happened"
                    placeholder="They took the work and did not pay. It was ₹1,200, agreed on WhatsApp."
                    max={1000} rows={4} />
            </div></div>
          {err && (
            <p className="flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
               style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0" />{err}
            </p>
          )}
        </div>
      </Sheet>
    </HomeShell>
  );
}

/** Their sentence, then the truth underneath it. */
function Trap({ s, open, onFlip }: { s: ScamPattern; open: boolean; onFlip: () => void }) {
  const tr = useT();
  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: open ? v("--ux-danger-solid") : undefined }}>
      <button type="button" onClick={onFlip} aria-expanded={open} className="ux-press w-full p-4 text-left lg:p-5">
        <div className="flex items-start gap-3.5">
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
            <I name={s.icon} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold italic leading-relaxed" style={{ color: v("--ux-ink") }}>
              {s.theyWillSay}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="orange" size="sm">{s.name}</Pill>
              {!open && (
                <span className="text-xs font-semibold" style={{ color: v("--ux-brand") }}>{tr("safemoney.whatIsReallyHappening")}</span>
              )}
            </div>
          </div>
          <I name={open ? "ChevronUp" : "ChevronDown"} className="mt-1 h-[16px] w-[16px] shrink-0"
             style={{ color: v("--ux-faint") }} />
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 lg:px-5" style={{ borderColor: v("--ux-line") }}>
          <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {s.whatIsHappening}
          </p>
          <p className="mt-3 flex items-start gap-2.5 rounded-[12px] px-4 py-3 text-xsm lg:px-3.5 font-semibold leading-relaxed"
             style={{ background: v("--ux-tint-green"), color: v("--ux-ink") }}>
            <I name="ShieldCheck" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} />
            {s.whatToDo}
          </p>
        </div>
      )}
    </Card>
  );
}

const REPORT_PHRASES = [
  "They took the goods and did not pay",
  "They asked me to pay a fee first",
  "They sent a fake payment screenshot",
  "They asked for my PIN or OTP",
  "They paid too much and asked for a refund",
];

function togglePhrase(note: string, phrase: string) {
  const parts = note.split(". ").map((x) => x.trim()).filter(Boolean);
  return (parts.includes(phrase) ? parts.filter((x) => x !== phrase) : [...parts, phrase]).join(". ");
}

const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * "Before you send anything to a buyer" — a real check.
 *
 * This used to show a fixed verdict about an invented buyer, "Kavita R", with
 * five ticks and crosses nobody had checked — on the screen meant to stop her
 * being cheated. A made-up "nothing looks wrong" could have sent her goods to
 * a stranger. Now it reads only two true things: what HER OWN records say about
 * this buyer (shop orders, and her money book), and what SHE answers about this
 * order. WomSakhi has no register of buyers, and it does not pretend to.
 */
function BuyerCheck({ onReport, reported }: { onReport: (name: string) => void; reported: boolean }) {
  const orders = useResource(useCallback((s: AbortSignal) => apiShopOrders(s).catch(() => []), []), [] as ShopOrder[]);
  const books = useResource(useCallback((s: AbortSignal) => apiBooks(s).catch(() => null), []), null as Books | null);
  const [buyer, setBuyer] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});

  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of orders.data) if (o.buyer_name?.trim()) seen.set(norm(o.buyer_name), o.buyer_name.trim());
    for (const e of books.data?.entries ?? []) if (e.who?.trim()) seen.set(norm(e.who), e.who.trim());
    return [...seen.values()].slice(0, 12);
  }, [orders.data, books.data]);

  const record = useMemo(() => {
    const key = norm(buyer);
    if (!key) return null;
    const hit = (n: string) => norm(n) === key || (key.length >= 3 && norm(n).includes(key));
    const os = orders.data.filter((o) => hit(o.buyer_name || ""));
    const es = (books.data?.entries ?? []).filter((e) => hit(e.who || ""));
    const paid = es.filter((e) => e.state === "paid");
    const owed = es.filter((e) => e.state !== "paid");
    const late = owed.filter((e) => e.late_days > 0);
    return {
      orders: os.length,
      delivered: os.filter((o) => /done|delivered|complete/i.test(o.state)).length,
      paidCount: paid.length,
      paidMinor: paid.reduce((n, e) => n + e.minor, 0),
      owedMinor: owed.reduce((n, e) => n + e.minor, 0),
      lateDays: late.reduce((n, e) => Math.max(n, e.late_days), 0),
      known: os.length + es.length > 0,
    };
  }, [buyer, orders.data, books.data]);

  const QUESTIONS = [
    { id: "goodsFirst", ask: "Do they want the goods before they pay?", warn: "Ask for the material cost first. A real buyer expects that." },
    { id: "askedToPay", ask: "Have they asked YOU to pay anything — a fee, a deposit, a kit?", warn: "Money should come to you, never from you. This is the most common trick." },
    { id: "hurry", ask: "Are they in a hurry — \u201ccourier it today\u201d?", warn: "Hurry is how tricks work. Slow it down; ask your circle." },
  ];
  const warnings = [
    ...(record && record.owedMinor > 0 ? [`They already owe you ${formatMoney(record.owedMinor)}${record.lateDays ? ` — ${record.lateDays} days late` : ""}. Get that first.`] : []),
    ...QUESTIONS.filter((q) => answers[q.id] === true).map((q) => q.warn),
  ];
  const answered = QUESTIONS.every((q) => answers[q.id] !== undefined);

  return (
    <div>
      <Section title="Before you send anything to a buyer" sub="Check what your own records say, and answer three questions" icon="UserSearch" />
      <Card pad={18}>
        <Label>Who is the buyer?</Label>
        <Text value={buyer} onChange={(x) => { setBuyer(x); }} label="Buyer name" placeholder="A name from your orders or your money book" max={80} />
        {names.length > 0 && <Picks options={names} value={buyer} onPick={(x) => setBuyer(buyer === x ? "" : x)} label="Your buyers" />}

        {record && (
          <div className="mt-4 rounded-[12px] p-4" style={{ background: v("--ux-surface-2") }}>
            <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>What your records say</p>
            {record.known ? (
              <ul className="mt-2 space-y-1.5 text-xsm" style={{ color: v("--ux-ink") }}>
                {record.orders > 0 && <li>• {record.orders} {record.orders === 1 ? "order" : "orders"} in your shop{record.delivered ? `, ${record.delivered} delivered` : ""}</li>}
                {record.paidCount > 0 && <li style={{ color: v("--ux-green-ink") }}>• Paid you {record.paidCount} {record.paidCount === 1 ? "time" : "times"} — {formatMoney(record.paidMinor)}</li>}
                {record.owedMinor > 0 && <li style={{ color: v("--ux-danger-ink") }}>• Owes you {formatMoney(record.owedMinor)}{record.lateDays ? `, ${record.lateDays} days late` : ""}</li>}
                {record.paidCount === 0 && record.owedMinor === 0 && <li>• Nothing in your money book with them yet.</li>}
              </ul>
            ) : (
              <p className="mt-2 text-xsm" style={{ color: v("--ux-ink-2") }}>
                No orders or money with this buyer in your records — a first time. That is not a problem by itself; the questions below matter more.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {QUESTIONS.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{q.ask}</p>
              <div className="flex gap-1.5">
                {[["Yes", true], ["No", false]].map(([label, val]) => {
                  const on = answers[q.id] === val;
                  return (
                    <button key={String(label)} type="button" aria-pressed={on}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: val as boolean }))}
                            className="ux-press min-h-[38px] rounded-full px-4 text-xs font-bold"
                            style={{ background: v(on ? (val ? "--ux-danger-tint" : "--ux-tint-green") : "--ux-surface-2"),
                                     color: v(on ? (val ? "--ux-danger-ink" : "--ux-green-ink") : "--ux-ink-2") }}>
                      {String(label)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {(answered || warnings.length > 0) && (
          <div className="mt-4 flex items-start gap-3 rounded-[12px] px-4 py-3.5"
               style={{ background: v(warnings.length ? "--ux-danger-tint" : "--ux-tint-green") }}>
            <I name={warnings.length ? "AlertTriangle" : "ShieldCheck"} className="mt-[2px] h-[18px] w-[18px] shrink-0"
               style={{ color: v(warnings.length ? "--ux-danger-solid" : "--ux-green-ink") }} />
            {warnings.length ? (
              <ul className="space-y-1 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                {warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : (
              <p className="text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                Nothing you told us looks wrong. Still: take the material money first on a big first order.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: v("--ux-line") }}>
          <Btn size="sm" icon="HandCoins" href="/app/collect" className="max-lg:w-full max-lg:px-4">Ask for the money first</Btn>
          <Btn size="sm" variant="outline" icon="Flag" disabled={reported} className="max-lg:w-full max-lg:px-4"
               onClick={() => onReport(buyer.trim())}>
            {reported ? "Reported" : "Report this buyer"}
          </Btn>
          <Btn size="sm" variant="ghost" icon="BadgeCheck" href="/app/verified" className="max-lg:w-full max-lg:px-4">
            Employer? Did they pay other women
          </Btn>
        </div>
      </Card>
    </div>
  );
}

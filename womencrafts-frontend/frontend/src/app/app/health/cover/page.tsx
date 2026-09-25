"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { COVER as RAW_COVER, COVERERS as RAW_COVERERS, type CoverDay } from "@/components/ux/wellness/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneRow, PhoneTitle, phoneFull, phonePrimary } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

/**
 * Cover when you cannot work.
 *
 * ── The real health-and-earning link ────────────────────────────────────────
 * Roughly 90% of employed Indian women are in informal work; among the salaried
 * minority in non-agriculture, 45.9% are not eligible for paid leave and 58%
 * have no social security of any kind. There is no sick day to take. A day ill
 * is a day unpaid **and** a stall nobody opened, an order nobody delivered, a
 * customer who goes elsewhere.
 *
 * That is a rota problem, not a medical one — which is why this is the health
 * module that stores **no health data whatsoever.** She says "I cannot work
 * Thursday." She never says why, and nobody may ask.
 *
 * ── Paid in hours, not rupees ───────────────────────────────────────────────
 * Cover is repaid in care hours inside the circle rather than cash. It keeps the
 * exchange between women who already trust each other, and for a woman who needs
 * two hours free on a Thursday it is worth more than the money would be.
 */

const STATE: Record<CoverDay["state"], { label: string; tint: string; ink: string }> = {
  asked: { label: "Waiting for someone", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  covered: { label: "Covered", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  past: { label: "Done", tint: "--ux-surface-2", ink: "--ux-muted" },
};

export default function CoverPage() {
  const COVERERS = useTranslated(RAW_COVERERS);
  const COVER = useTranslated(RAW_COVER);
  const tr = useT();
  const router = useRouter();
  const [days, setDays] = useState<CoverDay[]>(COVER);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => days.filter((d) => d.state !== "past"), [days]);
  const past = useMemo(() => days.filter((d) => d.state === "past"), [days]);
  const owed = useMemo(() => COVERERS.reduce((n, c) => n + c.owedHours, 0), []);
  const timesCovered = useMemo(() => COVERERS.reduce((n, c) => n + c.coveredCount, 0), []);

  /**
   * Asking another woman to cover a day.
   *
   * This said "<name> will cover it. She was not told why, and she will not
   * ask" — and asked nobody. The day went green, and on the morning she stayed
   * home nobody turned up, because nobody had been told.
   *
   * On a screen for a woman too unwell to work, that is the failure that costs
   * her the day's earnings she was trying to protect. Nothing here can send
   * the request yet, so it says so and hands her the way to ask.
   */
  const accept = useCallback((dayId: string, who: string) => {
    setAsking(false);
    setNote(`Ask ${who} yourself in your messages — nothing has been sent to her, and she has not been told anything.`);
  }, []);

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        {/* The top bar carries the way back on a phone; this one is the desktop's. */}
        <div className="hidden lg:flex">
          <Back to="/app/health" label={tr("healthCover.backToHealth")} />
        </div>

        <PhoneTitle title="Cover" sub={tr("healthCover.aDayOffShouldNotCost")}
                    note={tr("healthCover.thereIsNoSickLeaveWhen")}>
          <Btn icon="Plus" className={`mt-4 ${phonePrimary}`} onClick={() => setAsking(true)}>{tr("healthCover.iNeedADay")}</Btn>
        </PhoneTitle>
        <header className="hidden flex-wrap items-end gap-4 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Cover
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("healthCover.aDayOffShouldNotCost")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              There is no sick leave when you work for yourself — and a closed stall loses the
              customer, not just the day. So someone in your circle opens it instead.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => setAsking(true)}>{tr("healthCover.iNeedADay")}</Btn>
        </header>

        <Card pad={20} style={{ background: v("--ux-tint-pink"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon="Lock" tint="--ux-surface" ink="--ux-pink-ink" size={44} radius={13} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("healthCover.youNeverHaveToSayWhy")}</p>
              <p className="mt-1.5 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Not to us and not to her. Illness, a child, a hospital visit, a bad day — the app
                asks for a date and nothing else, and nowhere does it store a reason.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(timesCovered)} label={tr("healthCover.timesYouWereCovered")} icon="Handshake"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={`${owed} hours`} label={tr("healthCover.youOweBackInCare")} icon="Clock"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={String(COVERERS.length)} label={tr("healthCover.womenWhoCanStepIn")} icon="Users"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {asking && (
          <Card pad={16} style={{ borderColor: v("--ux-brand") }}>
            <SectionHead title={tr("healthCover.whoCanTakeFriday")}
                         sub="Pick one and ask her yourself — nothing is sent for you" icon="Users" />
            {/* The women who can step in are a list to pick from. */}
            <div className="flex flex-col gap-2.5">
              {COVERERS.map((c) => (
                <button key={c.id} type="button"
                        onClick={() => accept(open.find((d) => d.state === "asked")?.id ?? "cv2", c.name)}
                        className="ux-press ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5 text-left max-lg:p-4"
                        style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-sm font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
                    <p className="text-xs" style={{ color: v("--ux-muted") }}>
                      {c.can} · has covered for you {c.coveredCount}×
                    </p>
                  </div>
                  <I name="ArrowRight" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-faint") }} />
                </button>
              ))}
            </div>
            <Btn size="sm" variant="ghost" full className={`mt-2.5 ${phoneFull}`} onClick={() => setAsking(false)}>{tr("healthCover.notNow")}</Btn>
          </Card>
        )}

        <div>
          <GroupLabel count={open.length}>{tr("healthCover.comingUp")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("healthCover.comingUp")} icon="CalendarDays" chip={String(open.length)} />
          </div>
          {open.length === 0 ? (
            <Card><EmptyState icon="CalendarDays" title={tr("healthCover.nothingNeedingCover")}
                              body={tr("healthCover.whenYouNeedADayAsk")} /></Card>
          ) : (
            <>
            <ListGroup className="lg:hidden">
              {open.map((d) => {
                const s = STATE[d.state];
                return (
                  <PhoneRow key={d.id} icon={d.state === "covered" ? "Check" : "Clock"} tint={s.tint} ink={s.ink}
                            title={
                              <span className="flex flex-wrap items-center gap-2">
                                {d.when}
                                <span className="rounded-full px-2 py-[2px] text-[12px] font-semibold uppercase tracking-[0.06em]"
                                      style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                              </span>
                            }
                            meta={`${d.what}${d.who ? ` · ${d.who} is doing it` : ""}`}
                            trailing={d.state === "asked"
                              ? <Btn size="sm" onClick={() => setAsking(true)}>{tr("healthCover.findSomeone")}</Btn>
                              : undefined} />
                );
              })}
            </ListGroup>
            <div className="hidden flex-col gap-2.5 lg:flex">
              {open.map((d) => {
                const s = STATE[d.state];
                return (
                  <Card key={d.id} pad={16}>
                    <div className="flex flex-wrap items-center gap-3.5">
                      <IconTile icon={d.state === "covered" ? "Check" : "Clock"} tint={s.tint} ink={s.ink} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{d.when}</p>
                          <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-[0.06em]"
                                style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                        </div>
                        <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                          {d.what}{d.who && ` · ${d.who} is doing it`}
                        </p>
                      </div>
                      {d.state === "asked" && <Btn size="sm" onClick={() => setAsking(true)}>{tr("healthCover.findSomeone")}</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>
            </>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <GroupLabel count={past.length}>Before</GroupLabel>
            <div className="hidden lg:block">
              <SectionHead title="Before" icon="History" chip={String(past.length)} />
            </div>
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {past.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="Check" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.6} />
                    <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                      {d.when} · {d.what}{d.who && ` · ${d.who}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </HomeShell>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, Progress, Stat, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { apiSeasons, type Season, type Seasons } from "@/lib/books-api";
import { SourceNote } from "@/components/ux/kit";
import { useT } from "@/i18n";

/**
 * Your year, as it actually is.
 *
 * ── Volatility, not level ───────────────────────────────────────────────────
 * Micro-business income is not low so much as lumpy, and lumpy is what breaks
 * it: the cloth for the wedding-season rush has to be bought during the quiet
 * month before it. Every business tool ever built assumes a smooth month, which
 * is why none of them are any use to a tailor in October.
 *
 * So this screen has exactly two jobs. Tell her a rush is coming **while there
 * is still time to prepare for it**, and tell her a lean stretch is coming
 * **before she commits money she will not have.** The second one matters more,
 * and no product does it.
 */

const SHAPE: Record<Season["shape"], { label: string; tint: string; ink: string }> = {
  rush: { label: "Busy", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  steady: { label: "Normal", tint: "--ux-surface-2", ink: "--ux-muted" },
  quiet: { label: "Thin", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
};

export default function SeasonPage() {
  const tr = useT();
  const router = useRouter();
  const [ready, setReady] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const year = useResource<Seasons>(
    useCallback((sig) => apiSeasons(sig), []),
    { seasons: [], rush_minor: 0, quiet_minor: 0, months_of_history: 0 },
  );

  // Already sorted soonest-first by the server, which is also where the
  // countdown is worked out — from today's date rather than from a constant.
  const soon = year.data.seasons;
  const good = year.data.rush_minor;
  const thin = year.data.quiet_minor;
  /**
   * Whether anything here is grounded in her own trading. Below one month of
   * records the figures are all zero, and the screen says that plainly rather
   * than drawing her a year-shaped story about herself out of nothing.
   */
  const grounded = year.data.months_of_history > 0;

  const mark = (id: string) => {
    setReady((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
    const s = soon.find((x) => x.id === id);
    setNote(ready.includes(id) ? "Unmarked." : `Good. We will stop reminding you about ${s?.name.toLowerCase()}.`);
  };

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/books" label={tr("booksSeason.backToYourBooks")} />

        <header>
          <p className={EYEBROW}>{tr("booksSeason.yourYear")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("booksSeason.theBusyMonthsAndTheThin")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Your work is not the same every month and never has been. What matters is knowing
            far enough ahead — cloth is bought in the quiet month before the rush.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* "Earned", not "expected". These are counted from her books;
                the fixture called them expectations and invented them. */}
            <Stat value={formatRupees(good)} label="Earned in the busy months"
                  icon="TrendingUp" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(thin)} label="Earned in the thin ones"
                  icon="TrendingDown" tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {grounded
                ? <>The thin months are not a failure. They are the part of the year to plan around —
                    and the reason not to promise a large pot instalment in July.</>
                : <>These are counted from your own books, and you have not written anything down
                    yet — so the amounts are all zero. The months below are still worth knowing:
                    they are when the work comes for everyone in this trade.</>}
            </p>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <SourceNote source={year.source} what="these figures" />

        <div>
          <Section title={tr("booksSeason.whatIsComing")} sub={tr("booksSeason.soonestFirstWithHowLongYou")}
                   icon="CalendarDays" chip={String(soon.length)} />
          <div className="flex flex-col gap-3">
            {soon.map((s) => {
              const sh = SHAPE[s.shape];
              const done = ready.includes(s.id);
              const urgency = s.now ? 100 : Math.max(0, 100 - s.weeks_ahead * 10);
              return (
                <Card key={s.id} pad={16} style={done ? { opacity: 0.72 } : undefined}>
                  <div className="flex flex-wrap items-start gap-3.5">
                    <IconTile icon={s.icon} tint={sh.tint} ink={sh.ink} size={44} radius={13} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                        <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-[0.06em]"
                              style={{ background: v(sh.tint), color: v(sh.ink) }}>{sh.label}</span>
                        {done && <Pill tone="green" size="sm">Ready</Pill>}
                      </div>
                      <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                        {s.when}
                        {s.months_recorded > 0
                          ? <> · {formatRupees(s.earned_minor)} last time</>
                          : <> · nothing recorded yet</>}
                      </p>
                      <p className="mt-2.5 flex items-start gap-2 text-xsm leading-relaxed"
                         style={{ color: v("--ux-ink-2") }}>
                        <I name="ArrowRight" className="mt-[3px] h-[14px] w-[14px] shrink-0"
                           style={{ color: v("--ux-brand") }} />
                        {s.prepare}
                      </p>
                    </div>
                    {/* "0 weeks" means two different things — this week, and
                        already here — so they are never shown the same way. */}
                    <div className="shrink-0 text-right">
                      {s.now ? (
                        <>
                          <p className="text-smd font-extrabold leading-tight" style={{ color: v(sh.ink) }}>Now</p>
                          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>happening</p>
                        </>
                      ) : s.weeks_ahead === 0 ? (
                        <>
                          <p className="text-smd font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>Days</p>
                          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>away</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-extrabold leading-none tabular-nums"
                             style={{ color: v("--ux-ink") }}>{s.weeks_ahead}</p>
                          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>{tr("booksSeason.weeksToGo")}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <Progress pct={urgency} tone={sh.ink} track={sh.tint} h={5} />
                  </div>
                  <Btn size="sm" variant={done ? "ghost" : "outline"} full className="mt-3 max-lg:px-4"
                       onClick={() => mark(s.id)}>
                    {done ? tr("booksSeason.notReadyAfterAll")
              : tr("booksSeason.iHaveDoneThis")}
                  </Btn>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

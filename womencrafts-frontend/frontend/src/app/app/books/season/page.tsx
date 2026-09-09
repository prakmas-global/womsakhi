"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, Progress, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { SEASONS, type Season } from "@/components/ux/books/data";

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
  const router = useRouter();
  const [ready, setReady] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const soon = useMemo(() => [...SEASONS].sort((a, b) => a.weeksAhead - b.weeksAhead), []);
  const rushes = useMemo(() => SEASONS.filter((s) => s.shape === "rush"), []);
  const quiets = useMemo(() => SEASONS.filter((s) => s.shape === "quiet"), []);
  const good = useMemo(() => rushes.reduce((n, s) => n + s.expectMinor, 0), [rushes]);
  const thin = useMemo(() => quiets.reduce((n, s) => n + s.expectMinor, 0), [quiets]);

  const mark = (id: string) => {
    setReady((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
    const s = SEASONS.find((x) => x.id === id);
    setNote(ready.includes(id) ? "Unmarked." : `Good. We will stop reminding you about ${s?.name.toLowerCase()}.`);
  };

  return (
    <HomeShell active="/app/books">
      <div className="flex flex-col gap-5">
        <Back to="/app/books" label="Back to your books" />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Your year
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            The busy months and the thin ones
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Your work is not the same every month and never has been. What matters is knowing
            far enough ahead — cloth is bought in the quiet month before the rush.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(good)} label="Expected in the busy months"
                  icon="TrendingUp" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(thin)} label="Expected in the thin ones"
                  icon="TrendingDown" tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              The thin months are not a failure. They are the part of the year to plan around —
              and the reason not to promise a large pot instalment in July.
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

        <div>
          <SectionHead title="What is coming" sub="Soonest first — with how long you have"
                       icon="CalendarDays" chip={String(soon.length)} />
          <div className="flex flex-col gap-3">
            {soon.map((s) => {
              const sh = SHAPE[s.shape];
              const done = ready.includes(s.id);
              const urgency = Math.max(0, 100 - s.weeksAhead * 10);
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
                        {s.when} · about {formatRupees(s.expectMinor)}
                      </p>
                      <p className="mt-2.5 flex items-start gap-2 text-xsm leading-relaxed"
                         style={{ color: v("--ux-ink-2") }}>
                        <I name="ArrowRight" className="mt-[3px] h-[14px] w-[14px] shrink-0"
                           style={{ color: v("--ux-brand") }} />
                        {s.prepare}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-extrabold leading-none tabular-nums"
                         style={{ color: v("--ux-ink") }}>{s.weeksAhead}</p>
                      <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>weeks to go</p>
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <Progress pct={urgency} tone={sh.ink} track={sh.tint} h={5} />
                  </div>
                  <Btn size="sm" variant={done ? "ghost" : "outline"} full className="mt-3"
                       onClick={() => mark(s.id)}>
                    {done ? "Not ready after all" : "I have done this"}
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

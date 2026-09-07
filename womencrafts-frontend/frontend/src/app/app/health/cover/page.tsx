"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { COVER, COVERERS, type CoverDay } from "@/components/ux/wellness/data";

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
  const router = useRouter();
  const [days, setDays] = useState<CoverDay[]>(COVER);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => days.filter((d) => d.state !== "past"), [days]);
  const past = useMemo(() => days.filter((d) => d.state === "past"), [days]);
  const owed = useMemo(() => COVERERS.reduce((n, c) => n + c.owedHours, 0), []);
  const timesCovered = useMemo(() => COVERERS.reduce((n, c) => n + c.coveredCount, 0), []);

  const accept = useCallback((dayId: string, who: string) => {
    setDays((r) => r.map((d) => (d.id === dayId ? { ...d, who, state: "covered" } : d)));
    setAsking(false);
    setNote(`${who} will cover it. She was not told why, and she will not ask.`);
  }, []);

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        <Link href={"/app/health"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to health
        </Link>

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Cover
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              A day off should not cost you the week
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              There is no sick leave when you work for yourself — and a closed stall loses the
              customer, not just the day. So someone in your circle opens it instead.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => setAsking(true)}>I need a day</Btn>
        </header>

        <Card pad={20} style={{ background: v("--ux-tint-pink"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon="Lock" tint="--ux-surface" ink="--ux-pink-ink" size={44} radius={13} />
            <div className="min-w-0">
              <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>
                You never have to say why
              </p>
              <p className="mt-1.5 max-w-[54ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Not to us and not to her. Illness, a child, a hospital visit, a bad day — the app
                asks for a date and nothing else, and nowhere does it store a reason.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(timesCovered)} label="Times you were covered" icon="Handshake"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={`${owed} hours`} label="You owe back in care" icon="Clock"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={String(COVERERS.length)} label="Women who can step in" icon="Users"
                  tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {asking && (
          <Card pad={16} style={{ borderColor: v("--ux-brand") }}>
            <SectionHead title="Who can take Friday?" sub="They see the work, never the reason" icon="Users" />
            <div className="flex flex-col gap-2.5">
              {COVERERS.map((c) => (
                <button key={c.id} type="button"
                        onClick={() => accept(open.find((d) => d.state === "asked")?.id ?? "cv2", c.name)}
                        className="ux-press ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5 text-left"
                        style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[0.875rem] font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
                    <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                      {c.can} · has covered for you {c.coveredCount}×
                    </p>
                  </div>
                  <I name="ArrowRight" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-faint") }} />
                </button>
              ))}
            </div>
            <Btn size="sm" variant="ghost" full className="mt-2.5" onClick={() => setAsking(false)}>Not now</Btn>
          </Card>
        )}

        <div>
          <SectionHead title="Coming up" icon="CalendarDays" chip={String(open.length)} />
          {open.length === 0 ? (
            <Card><EmptyState icon="CalendarDays" title="Nothing needing cover"
                              body="When you need a day, ask here. Someone almost always can." /></Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {open.map((d) => {
                const s = STATE[d.state];
                return (
                  <Card key={d.id} pad={16}>
                    <div className="flex flex-wrap items-center gap-3.5">
                      <IconTile icon={d.state === "covered" ? "Check" : "Clock"} tint={s.tint} ink={s.ink} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{d.when}</p>
                          <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold uppercase tracking-[0.06em]"
                                style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
                        </div>
                        <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                          {d.what}{d.who && ` · ${d.who} is doing it`}
                        </p>
                      </div>
                      {d.state === "asked" && <Btn size="sm" onClick={() => setAsking(true)}>Find someone</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <SectionHead title="Before" icon="History" chip={String(past.length)} />
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {past.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="Check" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.6} />
                    <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>
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

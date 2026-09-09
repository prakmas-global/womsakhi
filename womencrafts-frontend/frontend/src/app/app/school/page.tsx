"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, Progress, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  CHILDREN, SCHOOL_KIND, SCHOOL_TASKS, schoolDue, schoolSoon, type SchoolTask,
} from "@/components/ux/life/data";

/**
 * The school year — hers to run, and nobody has ever helped her run it.
 *
 * ── The emptiest gap in the whole review ────────────────────────────────────
 * Schools broadcast *to* parents. Portals serve students. Fee lenders serve
 * schools. The only mother-side product found anywhere in the world is a
 * $9.99/month American assistant for affluent families. And yet she is the one
 * holding every fee date, exam date, RTE window, scholarship deadline, uniform
 * size and missing certificate — usually in her head, usually alone.
 *
 * ── Why it fits this product particularly well ──────────────────────────────
 * It is deadline-shaped, so it brings her back without a streak or a badge —
 * which matters, because this app's own doctrine forbids engagement mechanics.
 * It plugs straight into the savings pot: a fee pot per child, per term, is the
 * single most motivating goal a mother has. And mothers at one school are
 * already a circle, so it seeds itself.
 */
export default function SchoolPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<SchoolTask[]>(SCHOOL_TASKS);
  const [child, setChild] = useState<string>("all");
  const [note, setNote] = useState<string | null>(null);

  const due = useMemo(() => schoolDue(tasks), [tasks]);
  const soon = useMemo(() => schoolSoon(tasks), [tasks]);

  const shown = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const scoped = child === "all" ? open : open.filter((t) => t.childId === child);
    return [...scoped].sort((a, b) => a.dueIn - b.dueIn);
  }, [tasks, child]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const finish = useCallback((id: string) => {
    setTasks((r) => r.map((t) => (t.id === id ? { ...t, done: true } : t)));
    const t = tasks.find((x) => x.id === id);
    setNote(`${t?.what} — done. One less thing to hold in your head.`);
  }, [tasks]);

  const nameOf = (id: string) => CHILDREN.find((c) => c.id === id)?.name ?? "";

  return (
    <HomeShell active="/app/school">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            The school year
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Every date, in one place
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Fees, exams, forms, uniforms, the scholarship that has to be renewed or it stops.
            You have been holding all of it. You should not have to.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(due)} label="To pay this term" icon="Wallet"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={String(soon)} label="In the next week" icon="AlarmClock"
                  tint="--ux-danger-tint" ink="--ux-danger-solid" />
            <Stat value={String(CHILDREN.length)} label="Children" icon="Baby"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Fee pots — the school year is what a savings pot is actually for */}
        <div>
          <SectionHead title="Saving for the fees" sub="A pot for each child, filled a little at a time"
                       icon="PiggyBank" />
          <div className="grid gap-3 sm:grid-cols-2">
            {CHILDREN.map((c) => {
              const pct = c.feeMinor > 0 ? Math.min(100, (c.savedMinor / c.feeMinor) * 100) : 100;
              return (
                <Card key={c.id} pad={16}>
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-base font-bold"
                          style={{ background: v("--ux-tint-pink"), color: v("--ux-pink-ink") }}>
                      {c.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                        {c.cls} · {c.school}
                      </p>
                    </div>
                  </div>
                  {c.feeMinor > 0 ? (
                    <>
                      <div className="mt-3.5 mb-1.5 flex items-center justify-between text-xs"
                           style={{ color: v("--ux-muted") }}>
                        <span><b style={{ color: v("--ux-ink") }}>{formatRupees(c.savedMinor)}</b> of {formatRupees(c.feeMinor)}</span>
                        <span className="tabular-nums font-bold" style={{ color: v("--ux-brand") }}>{Math.round(pct)}%</span>
                      </div>
                      <Progress pct={pct} />
                      <Btn size="sm" variant="outline" full className="mt-3"
                           onClick={() => setNote(`₹500 added to ${c.name}'s fee pot.`)}>
                        Put ₹500 in
                      </Btn>
                    </>
                  ) : (
                    <div className="mt-3.5 rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-tint-green") }}>
                      <p className="text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
                        No fees — government school. {formatRupees(c.savedMinor)} saved for books and uniform.
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* What is coming */}
        <div>
          <SectionHead title="What is coming" sub="Soonest first" icon="CalendarDays"
                       chip={String(shown.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={child === "all"} onClick={() => setChild("all")}>Both children</Chip>
            {CHILDREN.map((c) => (
              <Chip key={c.id} icon="Baby" selected={child === c.id} onClick={() => setChild(c.id)}>{c.name}</Chip>
            ))}
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="CheckCircle2" title="Nothing due"
                              body="Everything for this child is done. We will tell you when the next date is close." /></Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((t) => {
                const k = SCHOOL_KIND[t.kind];
                const urgent = t.dueIn <= 7;
                return (
                  <Card key={t.id} pad={16} style={urgent ? { borderColor: v("--ux-amber") } : undefined}>
                    <div className="flex flex-wrap items-start gap-3.5">
                      <IconTile icon={k.icon} tint={k.tint} ink={k.ink} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{t.what}</p>
                          <Pill tone="neutral" size="sm">{nameOf(t.childId)}</Pill>
                          {urgent && <Pill tone="orange" size="sm">{t.dueIn === 0 ? "Today" : `${t.dueIn} days`}</Pill>}
                        </div>
                        <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{t.detail}</p>
                      </div>
                      {t.costMinor && (
                        <p className="shrink-0 text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                          {formatRupees(t.costMinor)}
                        </p>
                      )}
                      <div className="flex shrink-0 gap-2">
                        {t.kind === "buy" && (
                          <Btn size="sm" variant="outline" href="/app/swap">Check the swap</Btn>
                        )}
                        <Btn size="sm" onClick={() => finish(t.id)}>Done</Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <SectionHead title="Already done" icon="Check" chip={String(done.length)} />
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {done.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-green-ink") }} />
                    <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                      {t.what} · {nameOf(t.childId)}
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

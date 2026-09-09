"use client";

import { useMemo } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, Pill, Progress, v } from "@/components/ux/kit";
import { formatMoney as formatRupees } from "@/components/ux/kit/money";
import {
  COMPANIONS, STATUS_LABEL, STATUS_TONE,
  type Companion, type Haq, type Late, type Paper,
} from "./data";

/* ── the lead ────────────────────────────────────────────────────────────── */

/**
 * What stops arriving if she does nothing.
 *
 * Deliberately the first thing on the screen, and deliberately a loss rather
 * than an opportunity. Every other product in this category leads with "you
 * may be eligible for 12 schemes!" — and the trial evidence says that framing
 * converts almost nobody. She is not browsing. She is about to be cut off.
 */
export function AtRisk({ monthlyMinor, count, soonestDays }: {
  monthlyMinor: number; count: number; soonestDays: number;
}) {
  if (count === 0) {
    return (
      <Card pad={20} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
        <div className="flex items-center gap-3.5">
          <IconTile icon="ShieldCheck" tint="--ux-surface" ink="--ux-green-ink" size={44} />
          <div className="min-w-0">
            <p className="text-base font-bold" style={{ color: v("--ux-green-ink") }}>
              Nothing is about to stop
            </p>
            <p className="mt-0.5 text-xsm" style={{ color: v("--ux-ink-2") }}>
              Every paper is in date. We will tell you before that changes.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-amber") }}>
      <div className="px-5 pt-5 pb-4" style={{ background: v("--ux-tint-amber") }}>
        <div className="flex items-start gap-3.5">
          <IconTile icon="AlertTriangle" tint="--ux-surface" ink="--ux-amber-ink" size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.14em]"
               style={{ color: v("--ux-amber-ink") }}>
              You are about to lose
            </p>
            <p className="mt-1.5 text-2xlm font-extrabold leading-none tracking-[-0.02em]"
               style={{ color: v("--ux-ink") }}>
              {formatRupees(monthlyMinor)}
              <span className="ml-1.5 text-sm font-semibold" style={{ color: v("--ux-ink-2") }}>
                a month
              </span>
            </p>
            <p className="mt-2 max-w-[46ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {count === 1 ? "One payment" : `${count} payments`} will stop unless something is done.
              The soonest is in <b>{soonestDays} days</b>. None of this is because you stopped
              qualifying — it is paperwork, and paperwork can be finished.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-3.5" style={{ background: v("--ux-surface") }}>
        <Btn size="sm" icon="ListChecks" href="#deadlines">See what to do</Btn>
        <Btn size="sm" variant="outline" icon="UserPlus" href="/app/haq/papers">
          Fix my papers
        </Btn>
      </div>
    </Card>
  );
}

/* ── countdown ───────────────────────────────────────────────────────────── */

export function Countdown({ days }: { days: number }) {
  const tone =
    days < 0 ? { t: "--ux-danger-tint", i: "--ux-danger-solid" }
    : days <= 10 ? { t: "--ux-tint-amber", i: "--ux-amber-ink" }
    : { t: "--ux-surface-2", i: "--ux-muted" };
  const label =
    days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d left`;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold tabular-nums"
          style={{ background: v(tone.t), color: v(tone.i) }}>
      <I name={days < 0 ? "AlarmClock" : "Clock"} className="h-[13px] w-[13px]" />
      {label}
    </span>
  );
}

/* ── one benefit ─────────────────────────────────────────────────────────── */

export function HaqRow({ h, onOpen }: { h: Haq; onOpen: (id: string) => void }) {
  const tone = STATUS_TONE[h.status];
  return (
    <button
      type="button"
      onClick={() => onOpen(h.id)}
      className="ux-press ux-sq flex w-full items-start gap-3.5 rounded-[12px] border p-3.5 text-left transition-colors"
      style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}
    >
      <IconTile icon={h.icon} tint={h.tint} ink={h.ink} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{h.name}</p>
          <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-[0.07em]"
                style={{ background: v(tone.tint), color: v(tone.ink) }}>
            {STATUS_LABEL[h.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-xs" style={{ color: v("--ux-muted") }}>{h.body}</p>

        {h.action && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xsm font-semibold"
                  style={{ color: v("--ux-ink-2") }}>
              <I name="ArrowRight" className="h-[13px] w-[13px]" style={{ color: v("--ux-brand") }} />
              {h.action}
            </span>
            {typeof h.dueDays === "number" && <Countdown days={h.dueDays} />}
          </div>
        )}

        {h.stoppedBecause && (
          <p className="mt-2 rounded-[8px] px-2.5 py-2 text-xs leading-relaxed"
             style={{ background: v("--ux-danger-tint"), color: v("--ux-ink-2") }}>
            {h.stoppedBecause}
          </p>
        )}

        {!h.openNow && h.openNote && (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed"
             style={{ color: v("--ux-muted") }}>
            <I name="Info" className="mt-[2px] h-[13px] w-[13px] shrink-0" />
            {h.openNote}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {h.amountMinor > 0 && (
          <p className="text-base font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
            {formatRupees(h.amountMinor)}
          </p>
        )}
        <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>{h.cadence}</p>
      </div>
    </button>
  );
}

/* ── papers ──────────────────────────────────────────────────────────────── */

export function PaperRow({ p, onFix }: { p: Paper; onFix: (id: string) => void }) {
  const tone =
    p.state === "held" ? { t: "--ux-tint-green", i: "--ux-green-ink", icon: "Check", label: "Held" }
    : p.state === "expiring" ? { t: "--ux-tint-amber", i: "--ux-amber-ink", icon: "Clock", label: "Needs updating" }
    : { t: "--ux-danger-tint", i: "--ux-danger-solid", icon: "X", label: "Missing" };

  return (
    <div className="flex items-center gap-3.5 rounded-[12px] border p-3.5"
         style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
      <span className="ux-sq grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
            style={{ background: v(tone.t), color: v(tone.i) }}>
        <I name={tone.icon} className="h-[18px] w-[18px]" sw={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{p.name}</p>
          <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
                style={{ background: v(tone.t), color: v(tone.i) }}>{tone.label}</span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{p.note}</p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold"
           style={{ color: v("--ux-brand") }}>
          <I name="Unlock" className="h-[12px] w-[12px]" />
          Unlocks {p.unlocks} {p.unlocks === 1 ? "benefit" : "benefits"}
        </p>
      </div>
      {p.state !== "held" && (
        <Btn size="sm" variant="outline" onClick={() => onFix(p.id)}>
          {p.state === "expiring" ? "Renew" : "Get it"}
        </Btn>
      )}
    </div>
  );
}

/* ── accompany ───────────────────────────────────────────────────────────── */

/**
 * The trial arm that worked.
 *
 * Note what is deliberately absent: a rating, a price, a "top rated" badge.
 * She is not hiring a service. She is asking a woman she already knows, who
 * has stood in that particular queue, to come with her. What is shown instead
 * is what that woman has actually done.
 */
export function CompanionCard({ c, chosen, onChoose }: {
  c: Companion; chosen: boolean; onChoose: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose(c.id)}
      aria-pressed={chosen}
      className="ux-press ux-sq flex w-full items-start gap-3.5 rounded-[12px] border p-4 text-left transition-colors"
      style={{
        borderColor: chosen ? v("--ux-brand") : v("--ux-line"),
        background: chosen ? v("--ux-brand-tint") : v("--ux-surface"),
      }}
    >
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-base font-bold"
            style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
        {c.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</p>
        <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{c.did}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
             style={{ color: v("--ux-muted") }}>
          <span className="inline-flex items-center gap-1.5">
            <I name="MapPin" className="h-[12px] w-[12px]" />{c.knows}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <I name="CalendarDays" className="h-[12px] w-[12px]" />Free {c.free}
          </span>
        </div>
      </div>
      {chosen && (
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full"
              style={{ background: v("--ux-brand"), color: v("--ux-on-brand-btn-ink") }}>
          <I name="Check" className="h-[13px] w-[13px]" sw={3} />
        </span>
      )}
    </button>
  );
}

export function useCompanionsFor(office: string): Companion[] {
  return useMemo(() => {
    const exact = COMPANIONS.filter((c) => c.knows.toLowerCase().includes(office.toLowerCase()));
    return exact.length ? [...exact, ...COMPANIONS.filter((c) => !exact.includes(c))] : COMPANIONS;
  }, [office]);
}

/* ── recover ─────────────────────────────────────────────────────────────── */

export function LateRow({ l, onFile }: { l: Late; onFile: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[12px] border p-3.5"
         style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
      <IconTile icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{l.what}</p>
        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
          Due {l.dueOn}{l.paidOn ? ` · paid ${l.paidOn}` : " · still not paid"} ·{" "}
          <b style={{ color: v("--ux-orange-ink") }}>{l.daysLate} days late</b>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
          {formatRupees(l.owedMinor)}
        </p>
        <p className="text-2xs" style={{ color: v("--ux-muted") }}>owed to you</p>
      </div>
      {l.filed ? (
        <Pill tone="green" size="sm">Filed</Pill>
      ) : (
        <Btn size="sm" variant="outline" onClick={() => onFile(l.id)}>Claim it</Btn>
      )}
    </div>
  );
}

/* ── progress through a claim ────────────────────────────────────────────── */

export function ClaimSteps({ step }: { step: number }) {
  const steps = ["Papers", "Someone with you", "At the office", "Waiting", "Arriving"];
  return (
    <div>
      <Progress pct={(step / (steps.length - 1)) * 100} />
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: i <= step ? v("--ux-brand") : v("--ux-muted") }}>
            <I name={i < step ? "CheckCircle2" : i === step ? "CircleDot" : "Circle"}
               className="h-[13px] w-[13px]" />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export const HAQ_ICONS = Icons;

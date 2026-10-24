"use client";


import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, Pill, Progress, v } from "@/components/ux/kit";
import { formatMoney as formatRupees } from "@/components/ux/kit/money";
import { STATUS_LABEL as RAW_STATUS_LABEL, STATUS_TONE as RAW_STATUS_TONE, type Haq, type Paper } from "./data";
import { useTranslated } from "@/i18n/data";
import { MediaCard } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/* ── the lead ────────────────────────────────────────────────────────────── */

/**
 * What stops arriving if she does nothing.
 *
 * Deliberately the first thing on the screen, and deliberately a loss rather
 * than an opportunity. Every other product in this category leads with "you
 * may be eligible for 12 schemes!" — and the trial evidence says that framing
 * converts almost nobody. She is not browsing. She is about to be cut off.
 */
export function AtRisk({ monthlyMinor, count, soonestDays, tracked = 1 }: {
  monthlyMinor: number; count: number; soonestDays: number;
  /** How many schemes she has marked. Zero: we know nothing, so say so. */
  tracked?: number;
}) {
  const tr = useT();
  if (count === 0 && tracked === 0) {
    // "Nothing is about to stop" is only true once she has told us what she gets.
    return (
      <Card pad={20} style={{ background: v("--ux-brand-tint"), borderColor: "transparent" }}>
        <div className="flex items-center gap-3.5">
          <IconTile icon="ListChecks" tint="--ux-surface" ink="--ux-brand" size={44} />
          <div className="min-w-0">
            <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>Tell us what you already get</p>
            <p className="mt-0.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Open any scheme below and tap where it stands for you. We will warn you before
              a payment stops, and remind you of every date.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  if (count === 0) {
    return (
      <Card pad={20} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
        <div className="flex items-center gap-3.5">
          <IconTile icon="ShieldCheck" tint="--ux-surface" ink="--ux-green-ink" size={44} />
          <div className="min-w-0">
            <p className="text-base font-bold" style={{ color: v("--ux-green-ink") }}>
              {tr("parts.nothingIsAboutToStop")}
            </p>
            <p className="mt-0.5 text-xsm" style={{ color: v("--ux-ink-2") }}>
              {tr("parts.everyPaperIsInDateWe")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-amber") }}>
      <div className="p-4 lg:px-5 lg:pt-5 lg:pb-4" style={{ background: v("--ux-tint-amber") }}>
        <div className="flex items-start gap-3.5">
          <IconTile icon="AlertTriangle" tint="--ux-surface" ink="--ux-amber-ink" size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:text-2xs lg:font-extrabold lg:tracking-[0.14em]"
               style={{ color: v("--ux-amber-ink") }}>
              {tr("parts.youAreAboutToLose")}
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
      <div className="flex flex-wrap gap-2 p-4 lg:px-5 lg:py-3.5" style={{ background: v("--ux-surface") }}>
        <Btn size="sm" icon="ListChecks" href="#deadlines" className="max-lg:flex-1 max-lg:px-4">{tr("parts.seeWhatToDo")}</Btn>
        <Btn size="sm" variant="outline" icon="UserPlus" href="/app/haq/papers" className="max-lg:flex-1 max-lg:px-4">
          {tr("parts.fixMyPapers")}
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

/** `className` lets a screen fold the row into a grouped list on a phone. */
export function HaqRow({ h }: { h: Haq; onOpen?: (id: string) => void; className?: string }) {
  const STATUS_LABEL = useTranslated(RAW_STATUS_LABEL);
  const STATUS_TONE = useTranslated(RAW_STATUS_TONE);
  const tone = STATUS_TONE[h.status];
  const badgeTone = h.status === "receiving" ? "green" : h.status === "stopped" || h.status === "at-risk" ? "orange" : "light";
  const amount = h.amountMinor > 0 ? formatRupees(h.amountMinor) : h.amountLabel || "";
  return (
    <MediaCard
      href={`/app/haq/${h.id}`}
      // What the scheme pays for, at a glance: pension → coins, gas → the
      // kitchen, maternity → health, papers → the woman reading her form.
      image={artFor([h.name, h.gives, h.body], "scheme", null, h.id)}
      alt={h.name}
      topLeft={{ text: STATUS_LABEL[h.status], tone: badgeTone }}
      topRight={amount ? { text: amount, tone: "dark" } : null}
      overlay={h.cadence ? <span>{h.cadence}</span> : null}
      title={h.name}
      subtitle={h.body}
    >
      {h.status === "unknown" && h.fits && h.eligibility.length > 0 && (
        <p className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-2xs font-bold"
           style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
          <I name="Sparkles" className="h-[11px] w-[11px]" />From your answers, this may be for you
        </p>
      )}
      {h.action && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>
            <I name="ArrowRight" className="h-[13px] w-[13px]" style={{ color: v("--ux-brand") }} />
            {h.action}
          </span>
          {typeof h.dueDays === "number" && <Countdown days={h.dueDays} />}
        </div>
      )}
      {h.stoppedBecause && (
        <p className="mt-2 rounded-[12px] px-2.5 py-2 text-xs leading-relaxed lg:rounded-[8px]"
           style={{ background: v("--ux-danger-tint"), color: v("--ux-ink-2") }}>
          {h.stoppedBecause}
        </p>
      )}
      {!h.openNow && h.openNote && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
          <I name="Info" className="mt-[2px] h-[13px] w-[13px] shrink-0" />
          {h.openNote}
        </p>
      )}
      <span className="sr-only" style={{ color: v(tone.ink) }}>{STATUS_LABEL[h.status]}</span>
    </MediaCard>
  );
}

/* ── papers ──────────────────────────────────────────────────────────────── */

export function PaperRow({ p, onFix, className = "" }: { p: Paper; onFix: (id: string) => void; className?: string }) {
  const tr = useT();
  const tone =
    p.state === "held" ? { t: "--ux-tint-green", i: "--ux-green-ink", icon: "Check", label: "Held" }
    : p.state === "expiring" ? { t: "--ux-tint-amber", i: "--ux-amber-ink", icon: "Clock", label: tr("parts.needsUpdating") }
    : { t: "--ux-danger-tint", i: "--ux-danger-solid", icon: "X", label: "Missing" };

  return (
    <div className={`flex items-center gap-3.5 rounded-[12px] border p-3.5 max-lg:p-4 ${className}`}
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

/* ── recover ─────────────────────────────────────────────────────────────── */

/**
 * One late payment.
 *
 * Takes the server's shape now, not the fixture's — `days_late` is counted
 * from the dates on every read, so a delay cannot go on saying "28 days"
 * forever the way a stored number would.
 */
export function LateRow({ l, onFile, className = "" }: {
  l: { id: string; what: string; due_on: string; paid_on: string; days_late: number; owed_minor: number; filed: boolean };
  onFile: (id: string) => void;
  className?: string;
}) {
  const tr = useT();
  return (
    <div className={`flex items-center gap-3.5 rounded-[12px] border p-3.5 max-lg:flex-wrap max-lg:p-4 ${className}`}
         style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
      <IconTile icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{l.what}</p>
        <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
          Due {l.due_on}{l.paid_on ? ` · paid ${l.paid_on}` : " · still not paid"} ·{" "}
          <b style={{ color: v("--ux-orange-ink") }}>{l.days_late} {l.days_late === 1 ? "day" : "days"} late</b>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
          {formatRupees(l.owed_minor)}
        </p>
        <p className="text-2xs" style={{ color: v("--ux-muted") }}>{tr("parts.owedToYou")}</p>
      </div>
      {l.filed ? (
        <Pill tone="green" size="sm">Filed</Pill>
      ) : (
        <Btn size="sm" variant="outline" className="max-lg:ms-[52px] max-lg:w-[calc(100%-52px)] max-lg:px-4" onClick={() => onFile(l.id)}>{tr("parts.claimIt")}</Btn>
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

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Eye, HeartHandshake, Info, ShieldCheck, Users } from "lucide-react";

import { Card, StatCard } from "@/design-system";
import { messageFrom } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";
import {
  apiOnboardingInsights, GOAL_LABELS, TIME_LABELS, TOPIC_LABELS,
  type InsightGroup, type OnboardingInsights,
} from "@/lib/personal-api";

/**
 * What women want — the onboarding answers, as anonymous counts.
 *
 * ── What this screen will not do ────────────────────────────────────────
 * It shows no person. The server sends counts only, and drops every group
 * smaller than `min_bucket` (5) before it leaves — a bucket of two women in a
 * small district is a way to tell who they are. This page says how many groups
 * were hidden and never tries to recover them; a percentage is shown only when
 * the server sent one.
 *
 * ── How it is drawn ─────────────────────────────────────────────────────
 * Every chart IS its data table: a real `<table>` with a caption and column
 * headers, and the bar drawn inside the row it describes. One series, one hue
 * (the brand), ranked longest first, numbers printed beside every bar in
 * tabular figures — so nothing is read from colour or length alone, and a
 * screen reader gets the same numbers a sighted reader does.
 */

const STATUS_LABELS: Record<string, string> = {
  applicant: "Waiting for approval",
  active: "Approved members",
  rejected: "Not approved",
  other: "Other",
};

const USAGE_LABELS: Record<string, string> = {
  voice_prompts: "Questions read aloud",
  helper_mode: "Someone helping her",
  shared_phone: "Shares her phone",
};

const MINUTE_LABELS: Record<string, string> = { "10": "10 minutes", "20": "20 minutes", "30": "30 minutes" };

function relabel(g: InsightGroup, labels?: Record<string, string>): InsightGroup {
  if (!labels) return g;
  return { ...g, buckets: g.buckets.map((b) => ({ ...b, label: labels[b.key] ?? b.label })) };
}

const nf = new Intl.NumberFormat("en-IN");

function Ranked({ id, title, description, group, respondents, min, unit = "women" }: {
  id: string; title: string; description: string; group: InsightGroup;
  respondents: number | null; min: number; unit?: string;
}) {
  const max = Math.max(1, ...group.buckets.map((b) => b.count));
  // A bar is the share of everyone who answered when that is known; otherwise
  // the share of the largest group. The printed numbers say which.
  const scale = respondents ?? max;
  return (
    <Card>
      <div className="mb-4">
        <h2 id={`${id}-t`} className="font-display text-base font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>
      </div>
      {group.buckets.length === 0 ? (
        <p className="rounded-xl bg-surface-inset px-4 py-6 text-center text-sm text-ink-subtle">
          No answer has {min} or more women yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left" aria-labelledby={`${id}-t`}>
            <caption className="sr-only">{title}: {description}</caption>
            <colgroup>
              <col className="w-[44%]" />
              <col />
              <col className="w-[4.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="py-2 pe-2">Answer</th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Share</span>
                  <span aria-hidden>{respondents ? "Share of women" : "Relative size"}</span>
                </th>
                <th scope="col" className="py-2 ps-2 text-right">{unit === "women" ? "Women" : unit}</th>
              </tr>
            </thead>
            <tbody>
              {group.buckets.map((b) => {
                const pct = Math.round((b.count * 100) / scale);
                return (
                  <tr key={b.key} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="py-2.5 pe-2 text-sm font-medium text-ink">
                      <span className="block break-words">{b.label}</span>
                    </th>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset" aria-hidden>
                          <div className="h-full rounded-e-[4px] rounded-s-full"
                               style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: "var(--color-brand-600)" }} />
                        </div>
                        {respondents ? (
                          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-muted">{pct}%</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2.5 ps-2 text-right text-sm font-semibold tabular-nums text-ink">{nf.format(b.count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {group.suppressed > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span><span className="tabular-nums">{group.suppressed}</span> smaller {group.suppressed === 1 ? "group" : "groups"} hidden (under {min} women)</span>
        </p>
      )}
    </Card>
  );
}

/** Goals × status: which goals applicants, members and refused women chose. */
function GoalsByStatus({ data }: { data: OnboardingInsights }) {
  const statuses = Object.keys(data.goals_by_status);
  const goals = Array.from(new Set(statuses.flatMap((s) => data.goals_by_status[s].buckets.map((b) => b.key))));
  const cell = (s: string, g: string) => data.goals_by_status[s].buckets.find((b) => b.key === g)?.count;
  return (
    <Card>
      <div className="mb-4">
        <h2 id="gbs-t" className="font-display text-base font-semibold text-ink">Goals by account status</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">A dash is a group under {data.min_bucket} women, hidden. Statuses with fewer than {data.min_bucket} women are left out.</p>
      </div>
      {statuses.length === 0 || goals.length === 0 ? (
        <p className="rounded-xl bg-surface-inset px-4 py-6 text-center text-sm text-ink-subtle">
          {statuses.length === 0
            ? `No status has ${data.min_bucket} or more women yet.`
            : `Every goal in every status has fewer than ${data.min_bucket} women, so all are hidden.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left" aria-labelledby="gbs-t">
            <caption className="sr-only">Goals chosen, by account status. Counts of women.</caption>
            <thead>
              <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="py-2 pe-2">Goal</th>
                {statuses.map((s) => <th key={s} scope="col" className="px-2 py-2 text-right">{STATUS_LABELS[s] ?? s}</th>)}
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-2.5 pe-2 text-sm font-medium text-ink">{GOAL_LABELS[g] ?? g}</th>
                  {statuses.map((s) => {
                    const n = cell(s, g);
                    return (
                      <td key={s} className="px-2 py-2.5 text-right text-sm font-semibold tabular-nums text-ink">
                        {n === undefined ? <span className="text-ink-subtle" aria-label="hidden, under the minimum">–</span> : nf.format(n)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function WhatWomenWantPage() {
  const { data, source, error, refetch } = useResource<OnboardingInsights | null>(
    useCallback((s: AbortSignal) => apiOnboardingInsights(s), []), null,
  );
  const loading = source === "loading";

  const rate = (n: number | null | undefined) => (n === null || n === undefined ? "Too few" : `${n}%`);

  return (
    <div>
      <Link href="/dashboard/analytics"
            className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Analytics
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <HeartHandshake className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">What women want</h1>
            <p className="mt-1 max-w-[62ch] text-sm text-ink-subtle">
              What women told us when they joined: their goals, skills and plans. Anonymous totals only.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-status-info-bg px-4 py-3 text-sm text-ink" role="note">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-info-ink" aria-hidden />
        <p>
          <strong className="font-semibold">Groups under {data?.min_bucket ?? 5} people are hidden.</strong>{" "}
          No names, numbers or answers of any one woman are shown here, and reviewers never see answers when they approve an account.
        </p>
      </div>

      {!data ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-ink-subtle" role={loading ? "status" : "alert"}>
          {loading ? "Loading what women want…" : (
            <>
              <span>Could not load these totals: {messageFrom(error, "the server did not answer.")}</span>
              <button className="btn btn-sm btn-outline min-h-[44px]" onClick={refetch}>Try again</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Women who answered" icon={Users} tone="brand"
                      value={data.respondents === null ? `Fewer than ${data.min_bucket}` : nf.format(data.respondents)}
                      valueClassName="text-2xl tabular-nums" />
            <StatCard label="Use answers to set up her app" icon={Info} tone="violet"
                      value={rate(data.consent_rates.setup)} valueClassName="text-2xl tabular-nums" />
            <StatCard label="Keep details for job updates" icon={BriefcaseBusiness} tone="emerald"
                      value={rate(data.consent_rates.job_updates)} valueClassName="text-2xl tabular-nums" />
            <StatCard label="Visible to employers" icon={Eye} tone="sky"
                      value={rate(data.consent_rates.employer_visibility)} valueClassName="text-2xl tabular-nums" />
          </div>
          <p className="mt-2 text-xs text-ink-subtle">
            Consent rates are the share of women who answered who said yes. &ldquo;Too few&rdquo; means under {data.min_bucket} answered.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Ranked id="goals" title="What brings them here" description="Goals chosen. Each woman could pick several."
                    group={relabel(data.goals, GOAL_LABELS)} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="skills" title="Top skills" description="The 20 skills named most, including ones women typed themselves."
                    group={data.top_skills} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="topics" title="What they want to learn" description="Learning topics chosen."
                    group={relabel(data.learn_topics, TOPIC_LABELS)} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="meet" title="Who they want to meet" description="Circle interests chosen."
                    group={data.meet} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="times" title="When they are free" description="Free times chosen."
                    group={relabel(data.free_times, TIME_LABELS)} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="minutes" title="Time a day" description="Minutes a day they said they have."
                    group={relabel(data.minutes_per_day, MINUTE_LABELS)} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="usage" title="Voice and helpers" description="Who turned on read-aloud, is helped by someone, or shares a phone."
                    group={relabel(data.usage, USAGE_LABELS)} respondents={data.respondents} min={data.min_bucket} />
            <Ranked id="status" title="Who answered, by status" description="Account status of the women who answered."
                    group={relabel(data.by_status, STATUS_LABELS)} respondents={data.respondents} min={data.min_bucket} />
          </div>

          <div className="mt-6">
            <GoalsByStatus data={data} />
          </div>
        </>
      )}
    </div>
  );
}

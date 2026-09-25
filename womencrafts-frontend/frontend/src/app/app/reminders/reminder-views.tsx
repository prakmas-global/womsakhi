"use client";

import { useEffect, useState } from "react";

import { useI18n, useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { Btn, Card, I, IconTile, Pill, v } from "@/components/ux/kit";
import {
  ALL_TIMES, PRESETS, QUICK_TIMES, WEEKDAYS, presetFor, spokenTime,
  type ReminderPreset,
} from "@/components/ux/reminders/data";
import {
  apiEditReminder, apiNextOccurrences, apiSuggestTime,
  type Occurrence, type Reminder,
} from "@/lib/engines-api";

const k = (s: string) => s as MessageKey;

/* ── one reminder in the list ───────────────────────────────────────────── */

/**
 * A row, and the five real dates behind it.
 *
 * The dates are fetched rather than described. REM-UC-001 asks for the actual
 * instants before a repeat starts, because "every Tuesday" is a claim and five
 * Tuesdays are something she can check — and because a reminder built on the
 * wrong weekday index looks perfectly correct as a sentence.
 */
export function ReminderRow({
  reminder, onStop, onChanged, busy,
}: {
  reminder: Reminder;
  onStop: (id: string) => void | Promise<void>;
  /** Re-read the list after an edit, so the row shows what the server now has. */
  onChanged: () => void;
  busy: boolean;
}) {
  const tr = useT();
  const { formatDate } = useI18n();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Occurrence[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!open || next || failed) return;
    let alive = true;
    apiNextOccurrences(reminder.id)
      .then((rows) => { if (alive) setNext(rows); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [open, next, failed, reminder.id]);

  const preset = presetFor(reminder.title_key);
  const s = reminder.schedule;

  const when =
    s.type === "once" && s.at
      ? formatDate(s.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      : s.type === "recurring" && s.days.length > 0
        ? `${s.days.map((d) => tr(k(WEEKDAYS[d]?.key ?? "rem.day.mon"))).join(", ")} · ${spokenTime(s.local_time, tr)}`
        : s.type === "event_relative"
          ? tr("rem.beforeIt", { minutes: Math.abs(s.offset_minutes) })
          : spokenTime(s.local_time, tr);

  return (
    <Card pad={14}>
      <div className="flex items-start gap-3">
        <IconTile
          icon={preset?.icon ?? "Bell"}
          tint={preset?.tint ?? "--ux-brand-tint"}
          ink={preset?.ink ?? "--ux-brand"}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight" style={{ color: v("--ux-ink") }}>
            {tr(k(reminder.title_key))}
          </h3>
          <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>{when}</p>

          {/*
            Where it came from. REM-UC-009: three weeks later she cannot be
            expected to remember, and a reminder whose origin is a mystery is
            one she turns off rather than one she trusts.
          */}
          {reminder.klass !== "user" && (
            <div className="mt-1.5">
              <Pill tone="neutral" size="sm">{tr("rem.setForYou")}</Pill>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn size="sm" variant="ghost" icon={open ? "ChevronUp" : "CalendarDays"}
             onClick={() => setOpen((o) => !o)}>
          {open ? tr("rem.hideDates") : tr("rem.showDates")}
        </Btn>
        {/*
          Stopping is separate from marking a day done, and says so. REM-UC-005:
          missing a Tuesday must never cancel Wednesday, so the only control
          that ends a series is this one, and it is never the easy tap.
        */}
        {/*
          Changing the hour, without stopping and re-creating.
          Only offered for a repeat: a one-off's instant is the reminder, and
          "move it" there is a different question than "what time of day".
        */}
        {s.type === "recurring" && (
          <Btn size="sm" variant="ghost" icon="Clock" disabled={busy || editing}
               onClick={() => setEditing((e) => !e)}>
            {tr("rem.changeTime")}
          </Btn>
        )}
        <Btn size="sm" variant="ghost" icon="CircleSlash"
             onClick={() => onStop(reminder.id)} disabled={busy || saving}>
          {tr("rem.stopSeries")}
        </Btn>
      </div>

      {editing && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: v("--ux-surface-2") }}>
          <p className="text-2xs" style={{ color: v("--ux-muted") }}>{tr("rem.pickANewTime")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_TIMES.map((hhmm) => (
              <button
                key={hhmm}
                type="button"
                disabled={saving || busy}
                aria-pressed={s.local_time === hhmm}
                onClick={async () => {
                  setSaving(true);
                  setSaveFailed(false);
                  try {
                    await apiEditReminder(reminder.id, {
                      schedule: { ...s, local_time: hhmm },
                    });
                    setEditing(false);
                    // The edit bumps the version and re-queues, so the dates
                    // shown are now stale — drop them rather than display
                    // instants that will not happen.
                    setNext(null);
                    setFailed(false);
                    onChanged();
                  } catch {
                    setSaveFailed(true);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="min-h-[44px] rounded-lg px-3 text-2xs font-medium transition-colors hover:ring-1 hover:ring-[var(--ux-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ux-brand)] disabled:opacity-50"
                style={{
                  background: s.local_time === hhmm ? v("--ux-brand") : v("--ux-surface"),
                  color: s.local_time === hhmm ? "#fff" : v("--ux-ink"),
                }}
              >
                {spokenTime(hhmm, tr)}
              </button>
            ))}
          </div>
          {saveFailed && (
            <p role="alert" className="mt-2 text-xsm" style={{ color: v("--ux-ink") }}>
              {tr("rem.saveFailed")}
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: v("--ux-surface-2") }}>
          {failed ? (
            <p className="text-xsm" style={{ color: v("--ux-muted") }}>{tr("rem.datesFailed")}</p>
          ) : !next ? (
            <p className="text-xsm" style={{ color: v("--ux-muted") }}>{tr("rem.readingDates")}</p>
          ) : next.length === 0 ? (
            <p className="text-xsm" style={{ color: v("--ux-muted") }}>{tr("rem.noMoreDates")}</p>
          ) : (
            <ol className="space-y-1">
              {next.map((o) => (
                <li key={o.id} className="flex items-center gap-2 text-xsm"
                    style={{ color: v("--ux-ink-2") }}>
                  <I name="Dot" className="h-4 w-4" style={{ color: v("--ux-brand") }} />
                  {formatDate(o.due_at, {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "numeric", minute: "2-digit",
                  })}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── the four answers ───────────────────────────────────────────────────── */

/**
 * Done · Later · Skip today · Stop.
 *
 * Four taps and no typing, which is the whole of REM-UC-003. They are laid out
 * in the order of how often they are true, and **Stop is last and quietest**:
 * the cost of an accidental Done is one row, the cost of an accidental Stop is
 * a woman who stops being reminded about her iron tablet.
 */
export function DueActions({
  onAct, busy,
}: {
  onAct: (action: "done" | "snooze" | "skip" | "stop") => void | Promise<void>;
  busy: boolean;
}) {
  const tr = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <Btn size="sm" icon="Check" onClick={() => onAct("done")} disabled={busy}>
        {tr("rem.done")}
      </Btn>
      <Btn size="sm" variant="soft" icon="Clock" onClick={() => onAct("snooze")} disabled={busy}>
        {tr("rem.later")}
      </Btn>
      <Btn size="sm" variant="outline" icon="Pause" onClick={() => onAct("skip")} disabled={busy}>
        {tr("rem.skipToday")}
      </Btn>
      <Btn size="sm" variant="ghost" icon="CircleSlash" onClick={() => onAct("stop")} disabled={busy}>
        {tr("rem.stop")}
      </Btn>
    </div>
  );
}

/* ── making one ─────────────────────────────────────────────────────────── */

/**
 * What she chose, in her words.
 *
 * Deliberately not the engine's vocabulary. She picks "every day" or "some
 * days"; the engine knows `recurring` with an empty or populated `days`.
 * Keeping her four choices here and translating once, at the point of saving,
 * means the screen never has to explain the difference and a future schedule
 * kind does not leak a new word onto a button.
 *
 * There is no "every month" here, and that is deliberate: the engine has
 * `once`, `recurring` and `event_relative`, and nothing that means a monthly
 * date. Offering the button and quietly firing it weekly would put a label on
 * her screen that the system does not honour — which is the same lie as the
 * one that made a "daily" reminder never fire at all.
 */
export type Repeat = "once" | "everyDay" | "someDays";

export interface DraftReminder {
  preset: ReminderPreset | null;
  repeat: Repeat;
  time: string;
  days: number[];
}

/**
 * Picture, then time, then how often. In that order, on one screen.
 *
 * No step is a separate page and nothing is typed. A woman who cannot write
 * easily can finish this with four taps, and every label on it is a catalogue
 * key, so it reads back to her in her own language rather than in the language
 * whoever set it up happened to use.
 */
export function ReminderComposer({
  draft, setDraft, onSave, saving,
}: {
  draft: DraftReminder;
  setDraft: (d: DraftReminder) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const tr = useT();
  const [allTimes, setAllTimes] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [why, setWhy] = useState("");
  const times = allTimes ? ALL_TIMES : QUICK_TIMES;

  return (
    <Card>
      <h2 className="text-base font-semibold" style={{ color: v("--ux-ink") }}>
        {tr("rem.whatShallIRemindYou")}
      </h2>

      {/* 1 · the picture */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const on = draft.preset?.key === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setDraft({ ...draft, preset: p, time: p.suggest })}
              aria-pressed={on}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition"
              style={{
                background: on ? v("--ux-brand-tint") : v("--ux-surface-2"),
                outline: on ? `2px solid ${v("--ux-brand")}` : "none",
                outlineOffset: -2,
              }}
            >
              <I name={p.icon} className="h-6 w-6" style={{ color: v(p.ink) }} />
              <span className="text-2xs font-medium leading-tight" style={{ color: v("--ux-ink") }}>
                {tr(k(p.key))}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2 · the hour */}
      <h3 className="mt-5 text-sm font-semibold" style={{ color: v("--ux-ink") }}>
        {tr("rem.atWhatTime")}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {times.map((hhmm) => {
          const on = draft.time === hhmm;
          return (
            <button
              key={hhmm}
              type="button"
              onClick={() => setDraft({ ...draft, time: hhmm })}
              aria-pressed={on}
              className="min-h-[38px] rounded-full px-3 text-xsm font-medium transition"
              style={{
                background: on ? v("--ux-brand") : v("--ux-surface-2"),
                color: on ? "#fff" : v("--ux-ink"),
              }}
            >
              {spokenTime(hhmm, tr)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAllTimes((a) => !a)}
          className="min-h-[38px] rounded-full px-3 text-xsm font-medium"
          style={{ color: v("--ux-brand") }}
        >
          {allTimes ? tr("rem.fewerTimes") : tr("rem.otherTime")}
        </button>
      </div>

      {/*
        A suggestion, and only a suggestion.
        It fills the field; it never creates anything, and she still presses
        "Set it". The server checks the hour against her quiet hours before
        offering it, and falls back to a plain default when the model is off or
        unreachable — so this button behaves the same either way.
      */}
      {draft.preset && (
        <div className="mt-2.5 flex items-center gap-2">
          <Btn size="sm" variant="ghost" icon="Sparkles" loading={suggesting}
               onClick={async () => {
                 if (!draft.preset) return;
                 setSuggesting(true);
                 try {
                   const s2 = await apiSuggestTime(draft.preset.key);
                   setDraft({ ...draft, time: s2.local_time });
                   setWhy(s2.source === "suggested" ? s2.why : "");
                 } catch {
                   setWhy("");
                 } finally {
                   setSuggesting(false);
                 }
               }}>
            {tr("rem.suggestATime")}
          </Btn>
          {why && <span className="text-2xs" style={{ color: v("--ux-muted") }}>{why}</span>}
        </div>
      )}

      {/* 3 · how often */}
      <h3 className="mt-5 text-sm font-semibold" style={{ color: v("--ux-ink") }}>
        {tr("rem.howOften")}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([
          ["once", "rem.justOnce"],
          ["everyDay", "rem.everyDay"],
          ["someDays", "rem.someDays"],
        ] as const).map(([repeat, label]) => {
          const on = draft.repeat === repeat;
          return (
            <button
              key={repeat}
              type="button"
              onClick={() => setDraft({ ...draft, repeat })}
              aria-pressed={on}
              className="min-h-[38px] rounded-full px-3.5 text-xsm font-medium transition"
              style={{
                background: on ? v("--ux-brand") : v("--ux-surface-2"),
                color: on ? "#fff" : v("--ux-ink"),
              }}
            >
              {tr(label)}
            </button>
          );
        })}
      </div>

      {draft.repeat === "someDays" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = draft.days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setDraft({
                    ...draft,
                    days: on ? draft.days.filter((x) => x !== d.value) : [...draft.days, d.value],
                  })
                }
                className="min-h-[38px] min-w-[46px] rounded-full px-2 text-xsm font-medium transition"
                style={{
                  background: on ? v("--ux-brand-tint") : v("--ux-surface-2"),
                  color: on ? v("--ux-brand") : v("--ux-ink"),
                  outline: on ? `1.5px solid ${v("--ux-brand")}` : "none",
                  outlineOffset: -1.5,
                }}
              >
                {tr(k(d.key))}
              </button>
            );
          })}
        </div>
      )}

      {/*
        Nothing is saved until this is pressed, and it says so. The composer
        writes to local state only — a half-finished reminder never reaches the
        server, so she can put the phone down mid-thought without creating one.
      */}
      <div className="mt-5 flex items-center gap-3">
        <Btn
          icon="Bell"
          onClick={onSave}
          loading={saving}
          disabled={!draft.preset || (draft.repeat === "someDays" && draft.days.length === 0)}
        >
          {tr("rem.setIt")}
        </Btn>
        <p className="text-2xs" style={{ color: v("--ux-muted") }}>{tr("rem.nothingSavedYet")}</p>
      </div>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, SectionHead, v, I } from "@/components/ux/kit";
import { PRESETS, QUICK_TIMES } from "@/components/ux/reminders/data";
import {
  apiAddShoppingItem, apiCreateReminder, apiListReminders,
  apiStopReminder, type Reminder,
  apiChannelAvailability, type ChannelAvailability,
} from "@/lib/engines-api";
import { ReminderComposer, ReminderRow, type DraftReminder } from "./reminder-views";

/**
 * Her reminders.
 *
 * ── What this screen is for ────────────────────────────────────────────────
 * The engine behind it can already schedule, decide, send, retry and record.
 * None of that reaches a woman without a screen where she can set one herself
 * and stop one herself — so this is the smallest surface that makes the whole
 * engine hers rather than something the product does to her.
 *
 * ── The three rules it is built on ─────────────────────────────────────────
 * 1. **Nothing is typed.** A picture and a time (REM-UC-002). Everything
 *    stored is a catalogue key, so a reminder set in Telugu reads in Hindi if
 *    she switches, and can be read aloud.
 * 2. **The dates are shown before the repeat starts** (REM-UC-001), and they
 *    are the server's real queued instants, not a sentence describing the rule.
 * 3. **Marking one day done never cancels the series** (REM-UC-005). Done and
 *    Stop are different buttons, in different places, and Stop is the quiet one.
 *
 * ── Why the list is optimistic and the writes are not ──────────────────────
 * Creating shows the new row immediately because she has just pressed a button
 * and the feedback has to be instant on a slow connection. Stopping does not:
 * it re-reads from the server, because "did that actually stop?" is a question
 * a woman will ask again at 9pm, and a row that vanished locally while the
 * request failed is the worst possible answer.
 */
export default function RemindersPage() {
  const params = useSearchParams();
  const presetKey = params.get("preset") || "";
  return <RemindersContent key={presetKey} presetKey={presetKey} />;
}

function RemindersContent({ presetKey }: { presetKey: string }) {
  const tr = useT();
  const initialPreset = PRESETS.find((preset) => preset.key === presetKey) || null;
  const [rows, setRows] = useState<Reminder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(Boolean(initialPreset));
  const [draft, setDraft] = useState<DraftReminder>({
    preset: initialPreset, repeat: "everyDay", time: initialPreset?.suggest || QUICK_TIMES[3], days: [],
  });

  const load = useCallback(async () => {
    try {
      setRows(await apiListReminders());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiListReminders().then((data) => {
      if (active) { setRows(data); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const save = useCallback(async () => {
    if (!draft.preset) return;
    setBusy(true);
    setActionFailed(false);
    try {
      await apiCreateReminder({ title_key: draft.preset.key, ...scheduleFor(draft) });
      setComposing(false);
      setDraft({ preset: null, repeat: "everyDay", time: QUICK_TIMES[3], days: [] });
      await load();
    } catch {
      setActionFailed(true);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);

  const stop = useCallback(async (id: string) => {
    setBusy(true);
    setActionFailed(false);
    try {
      await apiStopReminder(id);
      await load();
    } catch {
      setActionFailed(true);
    } finally {
      setBusy(false);
    }
  }, [load]);


  const mine = useMemo(() => (rows ?? []).filter((r) => r.klass === "user"), [rows]);
  const forHer = useMemo(() => (rows ?? []).filter((r) => r.klass !== "user"), [rows]);

  /*
    What will actually happen when the hour comes.

    She could set a reminder, see it in her list, and never hear anything —
    `ENGINES_ENABLED` is off, so nothing dispatches, and no screen said so. A
    reminder she cannot rely on is worse than no reminder: she stops carrying
    the thing in her head because the app said it would carry it.

    So the screen states the delivery it can honestly promise. In-app always
    works and needs no provider; push works when she has turned it on; and
    when nothing dispatches at all, it says that instead of implying a
    notification.
  */
  const [delivery, setDelivery] = useState<ChannelAvailability | null>(null);
  useEffect(() => { void apiChannelAvailability().then(setDelivery).catch(() => {}); }, []);
  const deliveryLine =
    delivery === null ? ""
    : delivery.delivering === false ? tr("rem.notDeliveringYet")
    : delivery.push ? tr("rem.willArriveAsNotification")
    : tr("rem.willArriveInApp");

  return (
    <HomeShell skeleton="list" loadFailed={failed && rows === null ? tr("rem.title") : undefined}>
      <div className="space-y-4">
        <SectionHead
          level={1}
          icon="Bell"
          title={tr("rem.title")}
          sub={tr("rem.subtitle")}
        />

        {deliveryLine && (
          <div className="flex items-start gap-2.5 rounded-[12px] px-3.5 py-3"
               style={{ background: delivery?.delivering === false ? "var(--ux-tint-amber)" : "var(--ux-surface-2)" }}>
            <I name={delivery?.delivering === false ? "Info" : "BellRing"}
               className="mt-px h-[16px] w-[16px] shrink-0"
               style={{ color: delivery?.delivering === false ? "var(--ux-amber-ink)" : "var(--ux-brand)" }} />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{deliveryLine}</p>
          </div>
        )}

        {/*
          Hidden while the list is empty, because the empty state below already
          carries the same button — two identical calls to action a thumb apart
          is a screen arguing with itself about where to start.
        */}
        {!composing && rows !== null && (mine.length > 0 || forHer.length > 0) && (
          <Btn icon="Plus" onClick={() => setComposing(true)}>{tr("rem.newOne")}</Btn>
        )}

        {composing && (
          <>
            <ReminderComposer draft={draft} setDraft={setDraft} onSave={save} saving={busy} />
            <Btn variant="ghost" size="sm" disabled={busy} onClick={() => setComposing(false)}>
              {tr("common.cancel")}
            </Btn>
          </>
        )}

        {/*
          Something to pick up.
          The one place typing is unavoidable — a thing she needs is a thing
          only she can name — so it is kept to one short field, separate from
          the reminder composer, and it becomes an ordinary reminder for the
          next morning rather than a list she has to come back and read.
        */}
        {!composing && <ShoppingAdd onAdded={() => void load()} />}

        {(actionFailed || (failed && rows !== null)) && (
          <Card pad={14}>
            <p role="alert" className="text-xsm" style={{ color: v("--ux-ink") }}>{tr("rem.saveFailed")}</p>
          </Card>
        )}

        {rows !== null && mine.length === 0 && forHer.length === 0 && !composing && (
          <EmptyState
            icon="Bell"
            title={tr("rem.emptyTitle")}
            body={tr("rem.emptyBody")}
            action={<Btn icon="Plus" onClick={() => setComposing(true)}>{tr("rem.newOne")}</Btn>}
          />
        )}

        {mine.length > 0 && (
          <section className="space-y-2.5">
            <SectionHead title={tr("rem.yoursTitle")} />
            {mine.map((r) => (
              <ReminderRow key={r.id} reminder={r} onStop={stop} onChanged={() => void load()} busy={busy} />
            ))}
          </section>
        )}

        {/*
          Set by the rest of the app on her behalf — a booking, a fee, a
          circle instalment. Kept in their own section rather than mixed in,
          because "I did not set this" is the first thing a woman thinks when
          a reminder she does not recognise arrives, and the honest answer is
          right here rather than three taps away.
        */}
        {forHer.length > 0 && (
          <section className="space-y-2.5">
            <SectionHead title={tr("rem.forYouTitle")} sub={tr("rem.forYouSub")} />
            {forHer.map((r) => (
              <ReminderRow key={r.id} reminder={r} onStop={stop} onChanged={() => void load()} busy={busy} />
            ))}
          </section>
        )}
      </div>
    </HomeShell>
  );
}

/** One short field, and it becomes a reminder for tomorrow morning. */
function ShoppingAdd({ onAdded }: { onAdded: () => void }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Btn size="sm" variant="ghost" icon="ShoppingBasket" onClick={() => setOpen(true)}>
        {tr("shop.addToPickUp")}
      </Btn>
    );
  }

  return (
    <Card pad={14}>
      <label htmlFor="pickup" className="text-xsm font-medium" style={{ color: v("--ux-ink") }}>
        {tr("shop.whatToPickUp")}
      </label>
      <input
        id="pickup"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder={tr("shop.pickUpExample")}
        className="mt-2 w-full rounded-xl px-3 py-2.5 text-xsm"
        style={{
          background: v("--ux-surface-2"),
          color: v("--ux-ink"),
          border: `1px solid ${v("--ux-line")}`,
        }}
      />
      <div className="mt-3 flex items-center gap-2">
        <Btn size="sm" loading={busy} disabled={!item.trim()}
             onClick={async () => {
               setBusy(true);
               try {
                 await apiAddShoppingItem(item.trim());
                 setItem("");
                 setOpen(false);
                 onAdded();
               } finally {
                 setBusy(false);
               }
             }}>
          {tr("shop.addIt")}
        </Btn>
        <Btn size="sm" variant="ghost" onClick={() => { setOpen(false); setItem(""); }}>
          {tr("common.cancel")}
        </Btn>
      </div>
      <p className="mt-2 text-2xs" style={{ color: v("--ux-muted") }}>{tr("shop.pickUpNote")}</p>
    </Card>
  );
}

/**
 * Her four choices, as the three the engine actually has.
 *
 * `everyDay` and `someDays` are both `recurring` — the difference is `days`,
 * empty meaning every day. There is no third case because the composer does
 * not offer one: the engine has no monthly schedule, and a button that fires
 * weekly under a monthly label is the same class of bug as the "daily" that
 * silently became a one-off.
 */
function scheduleFor(draft: DraftReminder) {
  if (draft.repeat === "once") {
    return { schedule_type: "once" as const, at: nextInstant(draft.time) };
  }
  return {
    schedule_type: "recurring" as const,
    local_time: draft.time,
    days: draft.repeat === "someDays" ? draft.days : [],
  };
}

/**
 * The next time today's clock reads `HH:MM`.
 *
 * If the hour has already gone by, tomorrow — because a one-off reminder set
 * for an hour that is already past is a reminder that never fires, and the
 * engine's `_floor` correctly refuses to queue it. That refusal was silent
 * once; this is the half of the fix that lives on the client.
 */
function nextInstant(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const at = new Date();
  at.setHours(h, m, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  return at.toISOString();
}

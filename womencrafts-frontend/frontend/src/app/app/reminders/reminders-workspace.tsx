"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, SectionHead, v } from "@/components/ux/kit";
import { PRESETS, QUICK_TIMES } from "@/components/ux/reminders/data";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { scheduleFor } from "@/components/ux/reminders/schedule";
import { apiErrorMessage } from "@/lib/api";
import {
  apiAddShoppingItem, apiCreateReminder, apiListReminders,
  apiStopReminder, type Reminder,
  apiChannelAvailability, type ChannelAvailability,
} from "@/lib/engines-api";
import { ReminderComposer, ReminderRow, type DraftReminder } from "./reminder-views";
import { ReminderDelivery } from "@/components/ux/reminders/ReminderDelivery";
import { ReminderModal } from "./reminder-modal";

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
export function RemindersWorkspace({ presetKey = "", waterOnly = false }: { presetKey?: string; waterOnly?: boolean }) {
  const tr = useT();
  const confirm = useConfirm();
  const initialPreset = PRESETS.find((preset) => preset.key === presetKey) || null;
  const [rows, setRows] = useState<Reminder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(Boolean(initialPreset) && !waterOnly);
  const [draft, setDraft] = useState<DraftReminder>({
    preset: initialPreset, repeat: initialPreset?.key === "rem.preset.water" ? "interval" : "everyDay", time: initialPreset?.key === "rem.preset.water" ? "08:00" : initialPreset?.suggest || QUICK_TIMES[3], days: [], intervalMinutes: 30, endTime: "21:00",
  });
  /** Why the server said no, in its own words — shown inside the dialog. */
  const [saveError, setSaveError] = useState("");
  const [justAdded, setJustAdded] = useState("");
  const newButton = useRef<HTMLDivElement>(null);

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

  /*
    The server's reason travels to the screen.
    This used to catch everything and say only "That did not save" — so when
    production refused every Windows browser's "Asia/Calcutta", nobody could
    tell a timezone refusal from a dropped connection. The API writes a sentence
    for each refusal; she, and whoever she sends a screenshot to, should see it.
  */
  const save = useCallback(async () => {
    if (!draft.preset || busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const made = await apiCreateReminder({ title_key: draft.preset.key, ...scheduleFor(draft) });
      setComposing(false);
      setJustAdded(made?.id ?? "");
      setDraft({ preset: null, repeat: "everyDay", time: QUICK_TIMES[3], days: [] });
      await load();
      // The dialog hands focus back to what opened it; when that was the
      // empty state's button, it is gone now, so the list's own button takes it.
      requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          newButton.current?.querySelector("button")?.focus();
        }
      });
    } catch (err) {
      setSaveError(reasonFrom(err));
    } finally {
      setBusy(false);
    }
  }, [draft, load, busy]);

  const openComposer = useCallback(() => {
    if(waterOnly) setDraft({ preset: PRESETS.find(p => p.key === "rem.preset.water")!, repeat: "interval", time: "08:00", days: [], intervalMinutes: 30, endTime: "21:00" });
    setSaveError(""); setComposing(true);
  }, [waterOnly]);
  const closeComposer = useCallback(() => { setSaveError(""); setComposing(false); }, []);

  const stop = useCallback(async (id: string) => {
    if(busy || !await confirm({ title: "Stop this reminder?", description: "Future reminders in this series will stop. Completed entries stay recorded. You can use Pause to take a temporary break.", confirmLabel: "Stop reminder", danger: true })) return;
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
  }, [load, busy, confirm]);

  useEffect(() => {
    const refresh = () => { if(document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const scopedRows = useMemo(() => (rows ?? []).filter(r => (r.title_key === "rem.preset.water") === waterOnly), [rows, waterOnly]);
  const mine = useMemo(() => scopedRows.filter((r) => r.klass === "user" && ["scheduled", "paused"].includes(r.state)), [scopedRows]);
  const completed = useMemo(() => scopedRows.filter(r => r.klass === "user" && r.state === "completed"), [scopedRows]);
  const forHer = useMemo(() => scopedRows.filter((r) => r.klass !== "user"), [scopedRows]);

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

  return (
    <HomeShell active={waterOnly ? "/app/health/reminders/water" : "/app/reminders"} skeleton="list" loadFailed={failed && rows === null ? tr("rem.title") : undefined}>
      <div className="space-y-4">
        {waterOnly && <Back to="/app/health/reminders" label="Appointments & Reminders" />}
        <SectionHead
          level={1}
          icon={waterOnly ? "Droplet" : "Bell"}
          title={waterOnly ? "Water reminders" : tr("rem.title")}
          sub={waterOnly ? "Plan your water breaks around your day. Choose your hours, interval and days." : tr("rem.subtitle")}
        />


        {waterOnly && <Btn icon="Droplet" variant="outline" href="/app/health/nutrition#nt-water">Add water</Btn>}
        <ReminderDelivery availability={delivery} />

        {/*
          Hidden while the list is empty, because the empty state below already
          carries the same button — two identical calls to action a thumb apart
          is a screen arguing with itself about where to start.
        */}
        {rows !== null && (mine.length > 0 || forHer.length > 0) && (
          <div ref={newButton} className="contents">
            <Btn icon="Plus" onClick={openComposer}>{waterOnly ? "Add water reminder" : tr("rem.newOne")}</Btn>
          </div>
        )}

        <ReminderModal open={composing} onClose={closeComposer} title={waterOnly ? "Add water reminder" : tr("rem.newOne")} busy={busy}>
          <ReminderComposer waterOnly={waterOnly} draft={draft} setDraft={setDraft} onSave={save} saving={busy} bare />
          {saveError && (
            <div role="alert" className="mt-4 rounded-xl px-3.5 py-3"
                 style={{ background: v("--ux-danger-tint"), border: `1px solid ${v("--ux-line-strong")}` }}>
              <p className="text-xsm font-medium" style={{ color: v("--ux-danger-ink") }}>{tr("rem.saveFailed")}</p>
              <p className="mt-1 text-xsm" style={{ color: v("--ux-ink-2") }}>{saveError}</p>
            </div>
          )}
          <div className="mt-3">
            <Btn variant="ghost" size="sm" className="min-h-[44px]" disabled={busy} onClick={closeComposer}>
              {tr("common.cancel")}
            </Btn>
          </div>
        </ReminderModal>

        {/*
          Something to pick up.
          The one place typing is unavoidable — a thing she needs is a thing
          only she can name — so it is kept to one short field, separate from
          the reminder composer, and it becomes an ordinary reminder for the
          next morning rather than a list she has to come back and read.
        */}
        {!waterOnly && <ShoppingAdd onAdded={() => void load()} />}

        {(actionFailed || (failed && rows !== null)) && (
          <Card pad={14}>
            <p role="alert" className="text-xsm" style={{ color: v("--ux-ink") }}>{tr("rem.saveFailed")}</p>
          </Card>
        )}

        {rows !== null && mine.length === 0 && forHer.length === 0 && (
          <EmptyState
            icon="Bell"
            title={waterOnly ? "Plan your first water reminder" : tr("rem.emptyTitle")}
            body={waterOnly ? "Start with every 30 minutes during the hours you choose." : tr("rem.emptyBody")}
            action={<Btn icon="Plus" onClick={openComposer}>{waterOnly ? "Add water reminder" : tr("rem.newOne")}</Btn>}
          />
        )}

        {mine.length > 0 && (
          <section className="space-y-2.5">
            <SectionHead title={tr("rem.yoursTitle")} />
            {mine.map((r) => (
              <div key={r.id} data-just-added={r.id === justAdded || undefined}>
                <ReminderRow key={`${r.id}:${r.version}`} waterOnly={waterOnly} reminder={r} onStop={stop} onChanged={() => void load()} busy={busy} />
              </div>
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
        {completed.length > 0 && <section className="space-y-2.5"><SectionHead title="Completed reminders" />{completed.map(r => <Card key={r.id} pad={14}><p className="text-sm font-semibold">{tr(r.title_key as Parameters<typeof tr>[0])}</p><p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Completed · one-off reminder</p></Card>)}</section>}
        {forHer.length > 0 && (
          <section className="space-y-2.5">
            <SectionHead title={tr("rem.forYouTitle")} sub={tr("rem.forYouSub")} />
            {forHer.map((r) => (
              <ReminderRow key={`${r.id}:${r.version}`} waterOnly={waterOnly} reminder={r} onStop={stop} onChanged={() => void load()} busy={busy} />
            ))}
          </section>
        )}
      </div>
    </HomeShell>
  );
}

/**
 * The API's own sentence for a refusal.
 *
 * A 422 arrives as "tz: Value error, Choose a valid IANA timezone" — the field
 * name is for developers and "Value error," is pydantic's, so both come off.
 */
function reasonFrom(err: unknown): string {
  const raw = apiErrorMessage(err, "");
  return raw.replace(/^\w+(?: → \w+)*:\s*/, "").replace(/^Value error,\s*/i, "").trim();
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

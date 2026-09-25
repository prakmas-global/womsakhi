"use client";

import { useCallback, useEffect, useState } from "react";

import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { Btn } from "@/components/ux/kit";
import { SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { Group, SaveBar } from "../_parts/Group";
import {
  CHANNELS, apiChannelAvailability, apiGetEnginePreferences, apiSetEnginePreferences,
  type Channel, type ChannelAvailability, type EnginePreferences, type NotifyMode,
} from "@/lib/engines-api";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";

const k = (s: string) => s as MessageKey;

/**
 * How messages reach her.
 *
 * ── Why this is a separate screen ───────────────────────────────────────────
 * `/settings/notifications` decides **what** she is told about — money,
 * orders, circles. This decides **how and when** any of it arrives: which
 * transports are allowed, how many optional messages a day, and whether the
 * whole thing is paused. They are different questions, and the engine keeps
 * them in a different store, so joining them into one screen would have meant
 * two save buttons writing to two servers under one heading.
 *
 * ── The rule that shapes every control here ─────────────────────────────────
 * **A switch that does nothing is worse than a missing switch.** Every channel
 * adapter refuses when its provider is not configured, and that refusal never
 * reaches the client — the toggle saves, the preference stores, nothing is
 * delivered. So the screen asks the server which channels actually work and
 * shows the rest as unavailable, with the reason. Three of the five are
 * unavailable today, and saying so is the honest version of this screen.
 *
 * ── Safety is not on this screen ────────────────────────────────────────────
 * Quiet hours, the daily cap and Pause all exempt `safety`. There is no
 * control for it because there must not be one: every one of these settings
 * would otherwise be a way to silence an alert.
 */
export default function DeliverySettings() {
  const tr = useT();

  const [server, setServer] = useState<EnginePreferences | null>(null);
  const [avail, setAvail] = useState<ChannelAvailability | null>(null);
  const [edited, setEdited] = useState<Partial<EnginePreferences>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const [push, setPush] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([apiGetEnginePreferences(), apiChannelAvailability()]);
      setServer(p);
      setAvail(a);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Read-only, so it is safe on mount. The permission PROMPT is not — that
  // only ever runs from the button below.
  useEffect(() => { void pushState().then(setPush); }, []);

  const mode: NotifyMode = edited.mode ?? server?.mode ?? "all";
  const quiet = edited.quiet ?? server?.quiet ?? { start: "21:30", end: "07:00", days: [], enabled: true };
  const channels = edited.channels ?? server?.channels ?? { inapp: true };
  const budget = edited.budget ?? server?.budget ?? { discretionary_per_day: 2, min_gap_minutes: 240 };
  const paused = Boolean((edited.paused_until ?? server?.paused_until) ?? null);

  const dirty = Object.keys(edited).length > 0;

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const next = await apiSetEnginePreferences({
        mode,
        quiet_start: quiet.start,
        quiet_end: quiet.end,
        quiet_enabled: quiet.enabled,
        channels,
        discretionary_per_day: budget.discretionary_per_day,
        min_gap_minutes: budget.min_gap_minutes,
        // A pause is a date, not a flag. Seven days is long enough to be a
        // rest and short enough that she is not silently switched off for a
        // month she forgot about.
        paused_until: paused ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
      });
      setServer(next);
      setEdited({});
      setSaved(true);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [mode, quiet, channels, budget, paused]);

  const togglePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (push === "ready") {
        await disablePush();
        setPush("off");
        setEdited((e) => ({ ...e, channels: { ...channels, push: false } }));
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPush("ready");
          setEdited((e) => ({ ...e, channels: { ...channels, push: true } }));
        } else {
          setPush(res.reason === "failed" ? "off" : res.reason);
        }
      }
    } finally {
      setPushBusy(false);
    }
  }, [push, channels]);

  const setChannel = (c: Channel, on: boolean) =>
    setEdited((e) => ({ ...e, channels: { ...channels, [c]: on } }));

  const MODES: { id: NotifyMode; label: string; note: string }[] = [
    { id: "all", label: tr("deliv.mode.all"), note: tr("deliv.mode.allNote") },
    { id: "important", label: tr("deliv.mode.important"), note: tr("deliv.mode.importantNote") },
    { id: "inapp_only", label: tr("deliv.mode.inapp"), note: tr("deliv.mode.inappNote") },
    { id: "off", label: tr("deliv.mode.off"), note: tr("deliv.mode.offNote") },
  ];

  return (
    <SettingsPage title={tr("deliv.title")} sub={tr("deliv.subtitle")}>
      {/* ── how much ───────────────────────────────────────────────────── */}
      <Group title={tr("deliv.howMuch")} icon="Settings2" note={tr("deliv.safetyNote")}>
        <div className="flex flex-col gap-1.5 py-1">
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setEdited((e) => ({ ...e, mode: m.id }))}
                className="flex min-h-[56px] items-start gap-3 rounded-[14px] px-3.5 py-3 text-start transition"
                style={{
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface-2)",
                  outline: on ? "1.5px solid var(--ux-brand)" : "none",
                  outlineOffset: -1.5,
                }}
              >
                <span
                  aria-hidden
                  className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                  style={{ border: `2px solid var(${on ? "--ux-brand" : "--ux-line-strong"})` }}
                >
                  {on && <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--ux-brand)" }} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold lg:text-sm" style={{ color: "var(--ux-ink)" }}>
                    {m.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                    {m.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* ── which ways ─────────────────────────────────────────────────── */}
      <Group title={tr("deliv.whichWays")} icon="Send" note={tr("deliv.channelsNote")}>
        {CHANNELS.filter((c) => c !== "voice").map((c) => {
          const usable = avail?.[c] ?? false;
          const isInapp = c === "inapp";
          const on = isInapp ? true : Boolean(channels[c]);

          if (isInapp) {
            return (
              <Toggle
                key={c}
                on
                onChange={() => { /* the floor: it needs no provider and costs nothing */ }}
                label={tr("deliv.ch.inapp")}
                whenOn={tr("deliv.ch.inappNote")}
                whenOff={tr("deliv.ch.inappNote")}
              />
            );
          }

          if (c === "push") {
            return (
              <div key={c} className="flex min-h-[52px] items-start justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold lg:text-sm lg:font-medium" style={{ color: "var(--ux-ink)" }}>
                    {tr("deliv.ch.push")}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                    {!usable ? tr("deliv.notConnected")
                      : push === "ready" ? tr("deliv.push.on")
                      : push === "denied" ? tr("deliv.push.denied")
                      : push === "unsupported" ? tr("deliv.push.unsupported")
                      : tr("deliv.push.off")}
                  </p>
                </div>
                <Btn
                  size="sm"
                  variant={push === "ready" ? "outline" : "primary"}
                  onClick={togglePush}
                  loading={pushBusy}
                  disabled={!usable || push === "denied" || push === "unsupported"}
                >
                  {push === "ready" ? tr("deliv.push.turnOff") : tr("deliv.push.turnOn")}
                </Btn>
              </div>
            );
          }

          return (
            <Toggle
              key={c}
              on={usable && on}
              onChange={(v) => usable && setChannel(c, v)}
              label={tr(k(`deliv.ch.${c}`))}
              whenOn={tr(k(`deliv.ch.${c}On`))}
              whenOff={usable ? tr(k(`deliv.ch.${c}Off`)) : tr("deliv.notConnected")}
            />
          );
        })}
      </Group>

      {/* ── how often ──────────────────────────────────────────────────── */}
      <Group title={tr("deliv.howOften")} icon="Clock" note={tr("deliv.capNote")}>
        <Toggle
          on={quiet.enabled}
          onChange={(v) => setEdited((e) => ({ ...e, quiet: { ...quiet, enabled: v } }))}
          label={tr("deliv.quiet")}
          whenOn={tr("deliv.quietOn", { start: quiet.start, end: quiet.end })}
          whenOff={tr("deliv.quietOff")}
        />

        {/*
          Stacked on a phone, side by side from `lg`.
          Five 40px targets and a two-line label do not both fit across 430px:
          measured, the description ran underneath the buttons and was unreadable.
          The row keeps the same shape as `Toggle` above it on a desktop, where
          there is room for it.
        */}
        <div className="flex min-h-[52px] flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold lg:text-sm lg:font-medium" style={{ color: "var(--ux-ink)" }}>
              {tr("deliv.cap")}
            </p>
            <p className="mt-1 text-[13px] leading-snug lg:text-xs" style={{ color: "var(--ux-muted)" }}>
              {tr("deliv.capSub")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-1">
            {[0, 1, 2, 3, 5].map((n) => {
              const on = budget.discretionary_per_day === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEdited((e) => ({ ...e, budget: { ...budget, discretionary_per_day: n } }))}
                  className="min-h-[40px] min-w-[40px] rounded-full text-[15px] font-semibold transition lg:text-sm"
                  style={{
                    background: on ? "var(--ux-brand)" : "var(--ux-surface-2)",
                    color: on ? "#fff" : "var(--ux-ink)",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <Toggle
          on={paused}
          onChange={(v) => setEdited((e) => ({ ...e, paused_until: v ? new Date().toISOString() : null }))}
          label={tr("deliv.pause")}
          whenOn={tr("deliv.pauseOn")}
          whenOff={tr("deliv.pauseOff")}
        />
      </Group>

      <SaveBar
        tone={failed ? "--ux-danger-ink" : saved ? "--ux-green-ink" : "--ux-muted"}
        status={
          failed ? tr("deliv.saveFailed")
          : saved ? tr("deliv.saved")
          : dirty ? tr("deliv.unsaved")
          : tr("deliv.takesEffect")
        }
      >
        <Btn onClick={save} loading={saving} disabled={!dirty || server === null}>
          {tr("common.save")}
        </Btn>
      </SaveBar>
    </SettingsPage>
  );
}

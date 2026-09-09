"use client";

import { useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { useDevicePref } from "@/lib/use-device-pref";

import { Pill } from "@/components/ux/kit";
import { Card, SectionHead, SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { OFFLINE_ITEMS } from "@/components/ux/more/data";

/**
 * Offline Mode.
 *
 * Every size is shown in megabytes, because data costs money and a member on a
 * ₹99 pack is deciding whether a course is worth a fifth of her month. Hiding
 * that behind "sync automatically" spends her money for her.
 *
 * Three things stay offline whatever she chooses: her balance, her orders, and
 * the helpline numbers. Those are the ones she needs when there is no signal,
 * which is exactly when she cannot download them.
 */
export default function OfflineSettings() {
  const [items, setItems] = useState(OFFLINE_ITEMS);
  const [wifiOnly, setWifiOnly] = useDevicePref("offline.wifiOnly", true);

  const total = useMemo(
    () => items.filter((i) => i.on).reduce((a, i) => a + parseFloat(i.size), 0),
    [items],
  );

  const toggle = (id: string) =>
    setItems((s) => s.map((i) => (i.id === id ? { ...i, on: !i.on } : i)));

  return (
    <SettingsPage
      title="Working without signal"
      sub="What stays on your phone when there is no connection, and what it costs in data."
    >
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>On your phone now</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
              {items.filter((i) => i.on).length} of {items.length} kept offline
            </p>
          </div>
          <p className="shrink-0 text-2xl font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
            {total.toFixed(1)} <span className="text-sm font-semibold">MB</span>
          </p>
        </div>
        <div className="mt-4 border-t pt-2" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle
            on={wifiOnly} onChange={setWifiOnly}
            label="Only download on wi-fi"
            whenOn="Nothing large is downloaded on mobile data. Recommended."
            whenOff="Courses download on mobile data too. This can be expensive."
          />
        </div>
      </Card>

      <Card>
        <SectionHead title="What to keep" sub="Sizes are what it costs you in data" />
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>
                  {i.label}
                  {/* Kept whatever she chooses — she needs these when there is
                      no signal, which is when she cannot download them. */}
                  {i.always && <Pill tone="green" size="sm">Always kept</Pill>}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                  {i.size}{i.always ? " · needed when you have no signal" : ""}
                </p>
              </div>
              {i.always ? (
                <Icons.Lock className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-faint)" }} />
              ) : (
                <button
                  role="switch"
                  aria-checked={i.on}
                  aria-label={i.label}
                  onClick={() => toggle(i.id)}
                  className="ux-press relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors"
                  style={{ background: i.on ? "var(--ux-fill)" : "var(--ux-track)" }}
                >
                  <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white"
                        style={{ insetInlineStart: i.on ? 23 : 3,
                                 transition: "inset-inline-start var(--ux-t) var(--ux-ease-spring)",
                                 boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHead title="What still works with no signal" icon="WifiOff" />
        <ul className="space-y-2.5">
          {[
            "Seeing your balance and your last payments.",
            "Reading and updating your orders — they send when you are back.",
            "Any course you have downloaded.",
            "Every helpline number on the Safety screen.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 flex items-start gap-2.5 rounded-[12px] p-3 text-xs leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.RefreshCw className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          Anything you change offline is sent the moment you have signal again. You do not need to do anything.
        </p>
      </Card>
    </SettingsPage>
  );
}

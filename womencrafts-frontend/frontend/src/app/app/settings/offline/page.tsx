"use client";

import { useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { useDevicePref } from "@/lib/use-device-pref";

import { Pill } from "@/components/ux/kit";
import { SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { PhoneSwitch } from "@/components/ux/PhoneParts";
import { Group } from "../_parts/Group";
import { OFFLINE_ITEMS } from "@/components/ux/more/data";
import { useT } from "@/i18n";

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
  const tr = useT();
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
      title={tr("settingsOffline.workingWithoutSignal")}
      sub={tr("settingsOffline.whatStaysOnYourPhoneWhen")}
    >
      <Group inset="form">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("settingsOffline.onYourPhoneNow")}</p>
            <p className="mt-1 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
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
            label={tr("settingsOffline.onlyDownloadOnWiFi")}
            whenOn="Nothing large is downloaded on mobile data. Recommended."
            whenOff="Courses download on mobile data too. This can be expensive."
          />
        </div>
      </Group>

      <Group title={tr("settingsOffline.whatToKeep")} sub={tr("settingsOffline.sizesAreWhatItCostsYou")}>
        {/* On a phone the items are rows with a hairline between them, like
            every other settings list; from `lg` they stay as they were. */}
        <ul className="space-y-1 max-lg:space-y-0 max-lg:divide-y max-lg:divide-[var(--ux-line)]">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>
                  {i.label}
                  {/* Kept whatever she chooses — she needs these when there is
                      no signal, which is when she cannot download them. */}
                  {i.always && <Pill tone="green" size="sm">{tr("settingsOffline.alwaysKept")}</Pill>}
                </p>
                <p className="mt-0.5 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                  {i.size}{i.always ? " · needed when you have no signal" : ""}
                </p>
              </div>
              {i.always ? (
                <Icons.Lock className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-faint)" }} />
              ) : (
                /* The same 46x26 switch, with a 44px target on a phone. */
                <PhoneSwitch on={i.on} onChange={() => toggle(i.id)} label={i.label} />
              )}
            </li>
          ))}
        </ul>
      </Group>

      <Group title={tr("settingsOffline.whatStillWorksWithNoSignal")} icon="WifiOff" inset="form"
             noteIcon="RefreshCw" note={tr("settingsOffline.anythingYouChangeOfflineIsSent")}>
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
      </Group>
    </SettingsPage>
  );
}

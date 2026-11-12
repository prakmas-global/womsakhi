"use client";

import { useEffect, useState } from "react";
import { Btn, I, v } from "@/components/ux/kit";
import { apiGetEnginePreferences, apiSetEnginePreferences, type ChannelAvailability, type EnginePreferences } from "@/lib/engines-api";
import { enablePush, pushState, type PushState } from "@/lib/push";
import { apiErrorMessage } from "@/lib/api";

export function ReminderDelivery({ availability }: { availability: ChannelAvailability | null }) {
  const [device, setDevice] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<EnginePreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void pushState().then(state => { if(active) setDevice(state); });
    void apiGetEnginePreferences().then(data => { if(active) setPrefs(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const ready = device === "ready" && prefs?.channels.push;
  const off = prefs?.mode === "off";
  return <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: v("--ux-line"), background: v("--ux-surface-2") }} aria-label="Reminder delivery">
    <p className="flex items-center gap-2 text-sm font-semibold"><I name="Bell" className="h-4 w-4" /> How reminders reach you</p>
    <p className="text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
      {availability?.delivering === false ? "Reminders can be saved, but scheduled delivery is currently off."
        : off ? "Reminder delivery is turned off in your preferences. Turn it on in Delivery settings when you are ready."
        : ready && prefs?.mode !== "inapp_only" ? "Browser notifications are enabled on this device. Reminders also appear in your in-app notifications."
        : "Reminders appear in your in-app notifications. Enable device notifications to receive them while you are away from the page."}
    </p>
    <div className="flex flex-wrap gap-2">
      {!ready && device !== null && device !== "unsupported" && <Btn variant="outline" size="sm" loading={busy} disabled={busy || device === "denied" || !availability?.push} onClick={async () => {
        if(busy) return; setBusy(true); setError("");
        try {
          const result = await enablePush();
          if(!result.ok) { setDevice(result.reason === "failed" ? "off" : result.reason); setError(result.reason === "denied" ? "Notifications were blocked. Allow them in your browser settings, then try again." : "Device notifications could not be enabled. You can still use in-app notifications."); return; }
          const current = await apiGetEnginePreferences();
          const saved = await apiSetEnginePreferences({ channels: { ...current.channels, inapp: true, push: true } });
          setPrefs(saved); setDevice("ready");
        } catch(cause) { setError(apiErrorMessage(cause)); } finally { setBusy(false); }
      }}>Enable device notifications</Btn>}
      <Btn href="/app/settings/delivery" variant="ghost" size="sm">Delivery settings</Btn>
      <Btn href="/app/notifications" variant="ghost" size="sm">Open notifications</Btn>
    </div>
    {device === "denied" && <p className="text-xs">Your browser has blocked notifications. Allow notifications in its site settings to enable this device.</p>}
    {device === "unsupported" && <p className="text-xs">This browser does not support device notifications. Your in-app reminders still work.</p>}
    {prefs?.mode === "inapp_only" && <p className="text-xs">Your delivery preference is In-app only. Change it in Delivery settings to receive browser notifications.</p>}
    {error && <p role="alert" className="text-sm" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
  </section>;
}

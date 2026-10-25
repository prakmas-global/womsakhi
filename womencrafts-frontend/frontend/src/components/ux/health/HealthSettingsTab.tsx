"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiCycleErase, apiCycleExport } from "@/lib/cycle-api";
import { apiHealthDeleteAll, apiHealthExport, today, type HealthSettings } from "@/lib/health-api";
import { Cols, Disclaimer, HUE, I, Panel } from "./kit";

/**
 * Her Health & Wellness settings, reached from the avatar menu ("Health
 * settings") and the Health home: what shows in her menu, privacy on screen,
 * the details she gave at setup, and her data — download it all, run setup
 * again, or delete it all.
 */

function Toggle({ id, on, label, sub, onChange }: { id: string; on: boolean; label: string; sub: string; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-[14px] border p-3.5" style={{ borderColor: "var(--ux-line)" }}>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)}
             className="mt-0.5 h-5 w-5 shrink-0" style={{ accentColor: HUE.magenta.ink }} />
      <span className="min-w-0">
        <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{label}</b>
        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</span>
      </span>
    </label>
  );
}

function download(name: string, body: unknown) {
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HealthSettingsTab({ settings, save, onRestart }: {
  settings: HealthSettings;
  save: (patch: Partial<HealthSettings>, msg?: string) => Promise<HealthSettings | null>;
  onRestart: () => void;
}) {
  const [name, setName] = useState(settings.name);
  const [dob, setDob] = useState(settings.dob);
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : "");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);

  const saveAbout = async () => {
    setBusy("about");
    await save({ name: name.trim().slice(0, 40), dob, heightCm: Math.min(250, Math.max(0, Number(height) || 0)) }, "Saved");
    setBusy("");
  };
  const exportAll = async () => {
    setBusy("export");
    try {
      const [health, cycle] = await Promise.allSettled([apiHealthExport(), apiCycleExport()]);
      download(`womsakhi-health-data-${today()}.json`, {
        health: health.status === "fulfilled" ? health.value : null,
        cycle: cycle.status === "fulfilled" ? cycle.value : null,
      });
      toast("Your health data is downloading", { tone: "success" });
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
    finally { setBusy(""); }
  };
  const deleteAll = async () => {
    setBusy("delete");
    try {
      await apiHealthDeleteAll();
      await apiCycleErase().catch(() => undefined);
      toast("All your health data was deleted", { tone: "success" });
      window.location.assign("/app/wellness");
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); setBusy(""); }
  };

  const field = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };
  return (
    <Cols
      main={<>
        <Panel title="What shows in your menu" sub="Hidden sections keep their data. Turn them back on any time.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Toggle id="hs-cycle" on={settings.trackCycle} label="Period and fertility tracking" sub="Fertility in the menu and on your Health home"
                    onChange={(v) => save({ trackCycle: v }, v ? "Fertility is back in your menu" : "Fertility is hidden")} />
            <Toggle id="hs-preg" on={settings.trackPreg} label="Pregnancy tracking" sub="Pregnancy in the menu and on your Health home"
                    onChange={(v) => save({ trackPreg: v }, v ? "Pregnancy is back in your menu" : "Pregnancy is hidden")} />
          </div>
        </Panel>
        <Panel title="Privacy on screen">
          <Toggle id="hs-private" on={settings.privateMode} label="Hide health details on screen"
                  sub="Blurs your moods, journal, records and recent activity, for when someone else can see your phone."
                  onChange={(v) => save({ privateMode: v }, v ? "Health details are hidden" : "Health details are shown")} />
        </Panel>
        <Panel title="About you" sub="Used for your goals and shown to a doctor only when you share it.">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>
              Your name
              <input id="hs-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
                     className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold" style={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>
              Date of birth
              <input id="hs-dob" type="date" value={dob} max={today()} onChange={(e) => setDob(e.target.value)}
                     className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold" style={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>
              Height (cm)
              <input id="hs-height" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, "").slice(0, 3))}
                     className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold tabular-nums" style={field} />
            </label>
          </div>
          <div><Btn size="sm" icon="Save" loading={busy === "about"} onClick={saveAbout}>Save</Btn></div>
        </Panel>
      </>}
      side={<>
        <Panel title="Your data">
          <div className="flex flex-col gap-2">
            <Btn variant="outline" icon="Download" loading={busy === "export"} onClick={exportAll}>Download my data</Btn>
            <Btn variant="outline" icon="RotateCcw" onClick={onRestart}>Run setup again</Btn>
            {confirming ? (
              <div className="flex flex-col gap-2 rounded-[12px] p-3" role="alert" style={{ background: "var(--ux-danger-tint)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--ux-danger-ink)" }}>
                  This deletes every entry, your settings, your saved papers and your cycle tracking. It cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn size="sm" icon="Trash2" loading={busy === "delete"} onClick={deleteAll}>Delete everything</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep my data</Btn>
                </div>
              </div>
            ) : (
              <Btn variant="ghost" icon="Trash2" onClick={() => setConfirming(true)}>Delete all my health data</Btn>
            )}
          </div>
          <p className="flex items-start gap-2 text-xs" style={{ color: "var(--ux-muted)" }}>
            <I name="Info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Mood check-ins and doctor consultations are kept with your account and are not part of this download or delete.
          </p>
        </Panel>
        <Disclaimer>Nothing here is shared unless you choose to. When you book a doctor, you tick what they may see, item by item.</Disclaimer>
      </>}
    />
  );
}

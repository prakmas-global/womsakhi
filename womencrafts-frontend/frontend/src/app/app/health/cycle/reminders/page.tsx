"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Sheet } from "@/components/ux/kit/sheet";
import { Column, CycleHeader, DeskTitle, ErrorLine, Icon, SoftHeart, Toggle } from "@/components/ux/cycle/parts";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleErase, apiCycleExport, apiCycleReminders, apiCycleSettings, type CycleReminders } from "@/lib/cycle-api";

/**
 * When the tracker speaks to her — and the controls over what it keeps.
 *
 * Reminders land in her notification feed on their own: the server files
 * each one when it comes due (see `tick` in routes/cycle.py). Each toggle here
 * writes at once — there is no Save to forget.
 *
 * Below them are the three controls that make a health record hers: discreet
 * mode (nothing about her body on a lock screen), a copy of everything, and
 * one tap to delete it all.
 */

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};

type Row = { key: keyof CycleReminders; icon: string; title: string; sub: string; time?: keyof CycleReminders };

const ROWS: Row[] = [
  { key: "checkin", icon: "CalendarCheck", title: "Daily check-in", sub: "Remind me to log my cycle", time: "checkin_time" },
  { key: "upcoming", icon: "CalendarDays", title: "Upcoming period", sub: "Notify 2 days before" },
  { key: "ovulation", icon: "Sparkles", title: "Ovulation window", sub: "Get fertile window alerts" },
  { key: "pill", icon: "Pill", title: "Pill / Medication reminder", sub: "Set your own reminder", time: "pill_time" },
  { key: "long_period", icon: "HeartPulse", title: "Health check reminder", sub: "If period lasts more than 5 days" },
];

export default function Reminders() {
  const router = useRouter();
  const { state, data, act, busy, error, forget } = useCycle();
  const [timeFor, setTimeFor] = useState<Row | null>(null);
  const [draft, setDraft] = useState("09:00");
  const [confirmErase, setConfirmErase] = useState(false);
  const [erased, setErased] = useState(false);

  useEffect(() => {
    if (data && !data.setup && !erased) router.replace("/app/health/cycle/start");
  }, [data, router, erased]);

  const r = state?.profile.reminders;
  const set = (patch: Partial<CycleReminders>) => act(() => apiCycleReminders(patch));
  const off = !r?.smart;

  const download = async () => {
    const blob = new Blob([JSON.stringify(await apiCycleExport(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-cycle-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const erase = async () => {
    await apiCycleErase();
    setConfirmErase(false);
    setErased(true);
    forget();
    router.replace("/app");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Reminders" />
        <DeskTitle title="Reminders" sub="They arrive in your notifications, on their own." />

        <div className="flex items-center gap-3 rounded-[16px] px-4 py-3.5"
             style={{ background: "var(--cy-fertile)", border: "1px solid var(--ux-line)" }}>
          <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface)" }}>
            <Icons.AlarmClock className="h-5 w-5" style={{ color: "var(--cy-ovulation-ink)" }} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Smart Reminders</b>
            <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>We&apos;ll remind you at the right time.</span>
          </span>
          <Toggle on={!!r?.smart} onChange={(v) => set({ smart: v })} label="Smart reminders" disabled={!r || busy} />
        </div>

        <ul className="mt-3 space-y-2.5" style={{ opacity: off ? 0.5 : 1 }}>
          {ROWS.map((row) => {
            const on = !!r?.[row.key];
            const time = row.time ? String(r?.[row.time] ?? "") : "";
            return (
              <li key={row.key} className="flex items-center gap-3 rounded-[16px] px-4 py-3"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--cy-predicted)" }}>
                  <Icon name={row.icon} className="h-5 w-5" style={{ color: "var(--cy-period-ink)" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{row.title}</b>
                  <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{row.sub}</span>
                </span>
                {row.time && on && (
                  <button type="button" disabled={off}
                          onClick={() => { setDraft(time || "09:00"); setTimeFor(row); }}
                          className="ux-press flex h-11 items-center gap-0.5 text-[13px] font-semibold"
                          style={{ color: "var(--cy-ovulation-ink)" }} aria-label={`${row.title} time, ${fmt12(time || "09:00")}`}>
                    {fmt12(time || "09:00")}
                    <Icons.ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <Toggle on={on} onChange={(v) => set({ [row.key]: v } as Partial<CycleReminders>)} label={row.title} disabled={!r || off || busy} />
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3.5"
             style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
          <Icons.Heart className="h-5 w-5 shrink-0" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
          <p className="text-[13px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            <b className="font-semibold" style={{ color: "var(--ux-ink)" }}>We care for you</b> <SoftHeart className="h-3.5 w-3.5" /><br />
            Because your health matters.
          </p>
        </div>

        <h2 className="mb-3 mt-8 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Your privacy</h2>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 rounded-[16px] px-4 py-3" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Icons.EyeOff className="h-5 w-5 shrink-0" style={{ color: "var(--ux-ink-2)" }} aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Discreet mode</b>
              <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>Hide the cycle card on Home, and keep reminders vague on your lock screen.</span>
            </span>
            <Toggle on={!!state?.profile.discreet} onChange={(v) => act(() => apiCycleSettings({ discreet: v }))} label="Discreet mode" disabled={!state || busy} />
          </div>
          <button type="button" onClick={download}
                  className="ux-press flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-start"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Icons.Download className="h-5 w-5 shrink-0" style={{ color: "var(--ux-ink-2)" }} aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Download my data</b>
              <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>Everything the tracker keeps about you, as a file.</span>
            </span>
          </button>
          <button type="button" onClick={() => setConfirmErase(true)}
                  className="ux-press flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-start"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <Icons.Trash2 className="h-5 w-5 shrink-0" style={{ color: "var(--ux-orange)" }} aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Delete all my cycle data</b>
              <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>Every day you logged, and every reminder.</span>
            </span>
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "var(--ux-muted)" }}>
          <Icons.Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Only you can see your cycle. Nobody at WomSakhi reads it. Predictions are a guide, not contraception.
        </p>
        <ErrorLine text={error} />

        <Sheet open={!!timeFor} onClose={() => setTimeFor(null)} title={timeFor?.title ?? ""} icon="Clock"
               description="What time should we remind you?">
          <input type="time" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Reminder time"
                 className="h-[56px] w-full rounded-[14px] px-4 text-[20px]"
                 style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line-strong)" }} />
          <button type="button"
                  onClick={async () => { if (timeFor?.time && /^\d{2}:\d{2}$/.test(draft)) await set({ [timeFor.time]: draft } as Partial<CycleReminders>); setTimeFor(null); }}
                  className="ux-press mt-3 h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                  style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
            Save time
          </button>
        </Sheet>

        <Sheet open={confirmErase} onClose={() => setConfirmErase(false)} title="Delete all your cycle data?" icon="Trash2"
               description="This removes every day you logged, your settings and your cycle reminders. It cannot be undone.">
          <div className="space-y-2.5">
            <button type="button" onClick={erase}
                    className="ux-press h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                    style={{ background: "var(--ux-danger-solid)", color: "var(--ux-on-brand)" }}>
              Delete everything
            </button>
            <button type="button" onClick={() => setConfirmErase(false)}
                    className="ux-press h-[52px] w-full rounded-[14px] text-[17px] font-semibold"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
              Keep my data
            </button>
          </div>
        </Sheet>
      </Column>
    </HomeShell>
  );
}

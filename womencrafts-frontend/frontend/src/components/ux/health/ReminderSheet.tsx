"use client";

import { useState } from "react";

import { Btn, Sheet } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { addDays, fmtDay, nowHHMM, today, type Entry, type KindData } from "@/lib/health-api";
import { Chips } from "./kit";
import { REM_CATS, REPEATS, TIME_PRESETS, fmtTime } from "./records-data";

/**
 * Add or change a reminder — almost all taps: what it is for, which day, what
 * time, how often. The title is prefilled from the type so most women never
 * type it.
 */

const TITLE_FOR: Record<string, string> = {
  "Doctor appointment": "Doctor appointment", "Mentor session": "Mentor session", Medicine: "Take my medicine",
  Workout: "Time to move", Sleep: "Wind down for bed", Hydration: "Drink a glass of water",
  "Wellness activity": "A calm minute", "Prenatal checkup": "Prenatal check-up", Custom: "",
};

export function ReminderSheet({ open, onClose, initial, onSave }: {
  open: boolean;
  onClose: () => void;
  /** Editing an existing reminder, or prefilling a new one (a day picked on the calendar). */
  initial?: { entry?: Entry<"reminder">; date?: string; data?: Partial<KindData["reminder"]> };
  onSave: (data: KindData["reminder"], date: string, id?: string) => Promise<unknown>;
}) {
  const e = initial?.entry;
  const t = today();
  const [category, setCategory] = useState(e?.data.category || initial?.data?.category || "Doctor appointment");
  const [title, setTitle] = useState(e?.data.title ?? initial?.data?.title ?? TITLE_FOR["Doctor appointment"]);
  const [date, setDate] = useState(e?.date || initial?.date || (nowHHMM() >= "09:00" ? addDays(t, 1) : t));
  const [time, setTime] = useState(e?.data.time || initial?.data?.time || "09:00");
  const [repeat, setRepeat] = useState<KindData["reminder"]["repeat"]>(e?.data.repeat || initial?.data?.repeat || "Once");
  const [where, setWhere] = useState(e?.data.where ?? "");
  const [busy, setBusy] = useState(false);

  const past = repeat === "Once" && `${date}T${time}` < `${t}T${nowHHMM()}`;
  const ok = title.trim().length > 0 && !!date && !past;

  const pickCat = (c: string) => {
    setCategory(c);
    // Follow the type only while she has not written her own title.
    if (!title.trim() || Object.values(TITLE_FOR).includes(title)) setTitle(TITLE_FOR[c] ?? "");
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ ...(e?.data ?? {}), title: title.trim(), category, time, repeat, where: where.trim(), done: e?.data.done ?? [], snooze: "" }, date, e?.id);
    } finally {
      setBusy(false);
    }
  };

  const dayChips = [t, addDays(t, 1), addDays(t, 2), addDays(t, 7)];
  return (
    <Sheet open={open} onClose={onClose} icon="CalendarClock" title={e ? "Change reminder" : "Add a reminder"}
           description="It reaches your bell when it is due. The message never says what it is about."
           footer={<Btn full icon="Check" disabled={!ok} loading={busy} onClick={save}>{e ? "Save changes" : "Add reminder"}</Btn>}>
      <div className="flex flex-col gap-5" data-reminder-sheet>
        <div>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Type</p>
          <Chips label="Reminder type" hue="amber" options={REM_CATS} value={category} onChange={pickCat} />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>What should we remind you about?</p>
          <Text label="Reminder title" value={title} max={80} placeholder="Thyroid check-up" onChange={setTitle} />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Day</p>
          <div className="flex flex-wrap items-center gap-2">
            <Chips label="Day" hue="amber" value={date}
                   options={dayChips.map((d, i) => ({ value: d, label: ["Today", "Tomorrow", fmtDay(d, { weekday: "short" }), "In a week"][i] }))}
                   onChange={setDate} />
            <input type="date" value={date} min={e ? undefined : t} aria-label="Pick a day" onChange={(ev) => ev.target.value && setDate(ev.target.value)}
                   className="min-h-[40px] rounded-[12px] border px-3 text-sm"
                   style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Time</p>
          <div className="flex flex-wrap items-center gap-2">
            <Chips label="Time" hue="amber" value={time} options={TIME_PRESETS.map((x) => ({ value: x, label: fmtTime(x) }))} onChange={setTime} />
            <input type="time" value={time} aria-label="Pick a time" onChange={(ev) => ev.target.value && setTime(ev.target.value)}
                   className="min-h-[40px] rounded-[12px] border px-3 text-sm"
                   style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </div>
          {past && <p className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>That time has already passed. Pick a later one.</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Repeat</p>
          <Chips label="Repeat" hue="amber" options={REPEATS} value={repeat} onChange={(v) => setRepeat(v)} />
        </div>
        {(category === "Doctor appointment" || category === "Prenatal checkup") && (
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Where (optional)</p>
            <Text label="Where" value={where} max={80} placeholder="City Hospital, 2nd floor" onChange={setWhere} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

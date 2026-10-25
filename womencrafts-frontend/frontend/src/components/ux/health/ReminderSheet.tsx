"use client";

import { useState } from "react";

import { Text } from "@/components/ux/kit/form";
import { addDays, fmtDay, nowHHMM, today, type Entry, type KindData } from "@/lib/health-api";
import { Chips } from "./kit";
import { REM_CATS, REPEATS, TIME_PRESETS, fmtTime } from "./records-data";
import { PicChoice, Review, StepSheet, type FlowStep } from "./StepFlow";

/**
 * Add or change a reminder — a short step flow, almost all taps: what it is
 * for, which day, what time, how often. The title is prefilled from the type
 * so most women never type it.
 */

const TITLE_FOR: Record<string, string> = {
  "Doctor appointment": "Doctor appointment", "Mentor session": "Mentor session", Medicine: "Take my medicine",
  Workout: "Time to move", Sleep: "Wind down for bed", Hydration: "Drink a glass of water",
  "Wellness activity": "A calm minute", "Prenatal checkup": "Prenatal check-up", "Period & fertility": "Log my symptoms", Custom: "",
};

/** The picture for each reminder type; "Period & fertility" shows the Fertility flower. */
const CAT_ART: Record<string, string> = { "Period & fertility": "Fertility" };
const REPEAT_ART: Record<string, { art: string; sub: string }> = {
  Once: { art: "Once", sub: "Just this day" },
  "Every day": { art: "Every day", sub: "Daily" },
  "Every week": { art: "Every week", sub: "Same weekday" },
  "Every month": { art: "Calendar", sub: "Same date" },
};

const inputStyle = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" } as const;

export function ReminderSheet({ open, onClose, initial, onSave }: {
  open: boolean;
  onClose: () => void;
  /** Editing an existing reminder, or prefilling a new one (a day picked on the calendar). */
  initial?: { entry?: Entry<"reminder">; date?: string; data?: Partial<KindData["reminder"]> };
  onSave: (data: KindData["reminder"], date: string, id?: string) => Promise<unknown>;
}) {
  const e = initial?.entry;
  const t = today();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(e?.data.category || initial?.data?.category || "Doctor appointment");
  const [title, setTitle] = useState(e?.data.title ?? initial?.data?.title ?? TITLE_FOR["Doctor appointment"]);
  const [date, setDate] = useState(e?.date || initial?.date || (nowHHMM() >= "09:00" ? addDays(t, 1) : t));
  const [time, setTime] = useState(e?.data.time || initial?.data?.time || "09:00");
  const [repeat, setRepeat] = useState<KindData["reminder"]["repeat"]>(e?.data.repeat || initial?.data?.repeat || "Once");
  const [where, setWhere] = useState(e?.data.where ?? "");
  const [busy, setBusy] = useState(false);

  const pastFor = (r: string) => r === "Once" && `${date}T${time}` < `${t}T${nowHHMM()}`;
  const past = pastFor(repeat);
  const ok = title.trim().length > 0 && !!date && !past;

  const pickCat = (c: string) => {
    setCategory(c);
    // Follow the type only while she has not written her own title.
    if (!title.trim() || Object.values(TITLE_FOR).includes(title)) setTitle(TITLE_FOR[c] ?? "");
  };

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await onSave({ ...(e?.data ?? {}), title: title.trim(), category, time, repeat, where: where.trim(), done: e?.data.done ?? [], snooze: "" }, date, e?.id);
    } finally {
      setBusy(false);
    }
  };

  const dayChips = [t, addDays(t, 1), addDays(t, 2), addDays(t, 7)];
  const dayLabel = (d: string) => (d === t ? "Today" : d === addDays(t, 1) ? "Tomorrow" : fmtDay(d, { weekday: "short", day: "numeric", month: "short" }));
  const hasWhere = category === "Doctor appointment" || category === "Prenatal checkup";
  const pastNote = (
    <p role="alert" className="rounded-[12px] px-3 py-2 text-sm font-bold" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
      That time has already passed. Pick a later one.
    </p>
  );

  const flow: FlowStep[] = [
    { id: "type", title: "What is this reminder for?", hint: "Tap one. You can change it later.", valid: !!category,
      body: <PicChoice label="Reminder type" hue="magenta" value={category} onChange={pickCat} onPicked={() => setStep(1)}
                       options={REM_CATS.map((c) => ({ value: c, label: c, art: CAT_ART[c] ?? c }))} /> },
    { id: "what", title: "What should we remind you about?", hint: "We filled it in from the type. Change any word.", valid: title.trim().length > 0,
      body: <Text label="Reminder title" value={title} max={80} placeholder="Thyroid check-up" onChange={setTitle} /> },
    { id: "day", title: "Which day?", valid: !!date,
      body: <div className="flex flex-col gap-3">
        <Chips label="Day" hue="magenta" value={date} onChange={setDate}
               options={dayChips.map((d, i) => ({ value: d, label: ["Today", "Tomorrow", fmtDay(d, { weekday: "short" }), "In a week"][i] }))} />
        <input type="date" value={date} min={e ? undefined : t} aria-label="Pick a day" onChange={(ev) => ev.target.value && setDate(ev.target.value)}
               className="min-h-[44px] w-fit rounded-[12px] border-[1.5px] px-3 text-sm font-bold" style={inputStyle} />
      </div> },
    { id: "time", title: "What time?", hint: dayLabel(date), valid: !past,
      body: <div className="flex flex-col gap-3">
        <Chips label="Time" hue="magenta" value={time} options={TIME_PRESETS.map((x) => ({ value: x, label: fmtTime(x) }))} onChange={setTime} />
        <input type="time" value={time} aria-label="Pick a time" onChange={(ev) => ev.target.value && setTime(ev.target.value)}
               className="min-h-[44px] w-fit rounded-[12px] border-[1.5px] px-3 text-sm font-bold" style={inputStyle} />
        {past && pastNote}
      </div> },
    { id: "repeat", title: "How often?", valid: !past,
      body: <>
        <PicChoice label="Repeat" hue="magenta" value={repeat} columns={4}
                   options={REPEATS.map((r) => ({ value: r, label: r, ...REPEAT_ART[r] }))}
                   onChange={(v) => {
                     setRepeat(v as KindData["reminder"]["repeat"]);
                     // A one-off at a time already gone stays here, with the reason.
                     if (!pastFor(v)) window.setTimeout(() => setStep(5), 180);
                   }} />
        {past && pastNote}
      </> },
    ...(hasWhere ? [{
      id: "where", title: "Where is it?", hint: "Optional. A hospital, clinic or room number.", optional: true, valid: !!where.trim(),
      body: <Text label="Where" value={where} max={80} placeholder="City Hospital, 2nd floor" onChange={setWhere} />,
    }] : []),
    { id: "check", title: e ? "Check your changes" : "Check, then add", valid: ok,
      hint: "It reaches your bell when it is due. The message never says what it is about.",
      body: <Review rows={[["Type", category], ["About", title.trim()], ["Day", dayLabel(date)], ["Time", fmtTime(time)],
                           ["Repeat", repeat], ["Where", hasWhere ? where.trim() : ""]]} /> },
  ];

  return (
    <StepSheet open={open} onClose={onClose} icon="CalendarClock" title={e ? "Change reminder" : "Add a reminder"} hue="magenta"
               steps={flow} step={step} setStep={setStep} onSubmit={save} busy={busy}
               submitLabel={e ? "Save changes" : "Add reminder"} />
  );
}

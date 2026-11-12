import { presetFor, type DraftReminder } from "./data";
import type { Reminder, ReminderInput } from "@/lib/engines-api";

export function scheduleFor(draft: DraftReminder): Pick<ReminderInput, "schedule_type" | "at" | "local_time" | "days" | "interval_minutes" | "end_time"> {
  if (draft.repeat === "once") {
    const [h, m] = draft.time.split(":").map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    return { schedule_type: "once", at: at.toISOString(), local_time: "", days: [], interval_minutes: 0, end_time: "" };
  }
  return {
    schedule_type: "recurring", at: undefined, local_time: draft.time,
    days: draft.repeat === "someDays" || draft.repeat === "interval" ? draft.days : [],
    interval_minutes: draft.repeat === "interval" ? draft.intervalMinutes ?? 30 : 0,
    end_time: draft.repeat === "interval" ? draft.endTime ?? "21:00" : "",
  };
}

export function draftFor(reminder: Reminder): DraftReminder {
  const s = reminder.schedule;
  const date = s.at ? new Date(s.at) : null;
  return {
    preset: presetFor(reminder.title_key),
    repeat: s.type === "once" ? "once" : s.interval_minutes ? "interval" : s.days.length ? "someDays" : "everyDay",
    time: s.local_time || (date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "08:00"),
    days: s.days, intervalMinutes: s.interval_minutes || 30, endTime: s.end_time || "21:00",
  };
}

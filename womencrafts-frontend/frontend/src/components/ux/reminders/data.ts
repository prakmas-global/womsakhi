import type { MessageKey } from "@/i18n";

/**
 * What a woman can set a reminder for, and when.
 *
 * ── Why presets rather than a text box ──────────────────────────────────────
 * The engine stores a `title_key`, not a sentence, and that is deliberate: a
 * reminder typed in English cannot be read back to her in Telugu, and a
 * reminder typed at all is a reminder a woman who does not write easily never
 * sets. REM-UC-002 asks for creation "without composing a sentence" — so she
 * picks a picture and a time, and the key travels through the whole engine
 * until it is rendered in whatever language she is reading in that day.
 *
 * ── Why these thirteen ────────────────────────────────────────────────────────
 * Each one is something the rest of this app already knows she does: an iron
 * tablet from the health module, a circle instalment from savings, thread and
 * lining from the shop. Nothing aspirational, nothing a product manager would
 * like her to do.
 */

export interface ReminderPreset {
  /** The catalogue key. This is what the server stores and the screen renders. */
  key: string;
  icon: string;
  tint: string;
  ink: string;
  /** The hour this one usually belongs at, before she changes it. */
  suggest: string;
}

export const PRESETS: ReminderPreset[] = [
  { key: "rem.preset.tablet",   icon: "Pill",          tint: "--ux-tint-green",  ink: "--ux-green-ink",  suggest: "20:00" },
  { key: "rem.preset.stretch",  icon: "Activity",      tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   suggest: "07:00" },
  { key: "rem.preset.callBack", icon: "PhoneCall",     tint: "--ux-tint-violet", ink: "--ux-violet-ink", suggest: "11:00" },
  { key: "rem.preset.children", icon: "Backpack",      tint: "--ux-tint-orange", ink: "--ux-orange-ink", suggest: "15:30" },
  { key: "rem.preset.circle",   icon: "Users",         tint: "--ux-brand-tint",  ink: "--ux-brand",      suggest: "09:00" },
  { key: "rem.preset.supplies", icon: "ShoppingBasket",tint: "--ux-tint-pink",   ink: "--ux-pink-ink",   suggest: "10:00" },
  { key: "rem.preset.order",    icon: "Package",       tint: "--ux-tint-amber",  ink: "--ux-amber-ink",  suggest: "09:30" },
  { key: "rem.preset.water",    icon: "Droplet",       tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   suggest: "12:00" },
  { key: "rem.preset.clinic",   icon: "Stethoscope",   tint: "--ux-tint-green",  ink: "--ux-green-ink",  suggest: "08:00" },
  { key: "rem.preset.fee",      icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet-ink", suggest: "09:00" },
  /* Added with the module nudges: Learn had been sending her to "Stretch",
     which is a health preset, and Work had no honest one at all. */
  { key: "rem.preset.study",    icon: "BookOpen",      tint: "--ux-tint-violet", ink: "--ux-violet-ink", suggest: "19:00" },
  { key: "rem.preset.deadline", icon: "CalendarClock", tint: "--ux-tint-orange", ink: "--ux-orange-ink", suggest: "09:00" },
  { key: "rem.preset.charge",   icon: "Zap", tint: "--ux-tint-amber",ink: "--ux-amber-ink",  suggest: "21:00" },
];

/**
 * How a reminder the ENGINE set should look.
 *
 * Her own reminders carry a preset key, and the preset carries the picture.
 * The engine's do not — `app/engines/wiring.py` writes `circles.contributionDue`
 * from a circle instalment, `jobs.closesSoon` from a job about to close. With
 * no entry here every one of them fell back to the same grey bell, so a list of
 * twelve read as twelve copies of one thing and the safety row looked exactly
 * like the weekly digest.
 *
 * Keyed by the part before the dot, because that is the module and the module
 * is what the picture is really about. A key from a module not listed still
 * falls back to the bell, which is correct: a guessed icon is worse than a
 * plain one.
 */
const ENGINE_LOOKS: Record<string, { icon: string; tint: string; ink: string }> = {
  circles:      { icon: "Users",         tint: "--ux-brand-tint",  ink: "--ux-brand" },
  school:       { icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  benefit:      { icon: "FileText",      tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  jobs:         { icon: "Briefcase",     tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  applications: { icon: "ClipboardList", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  documents:    { icon: "Package",       tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  order:        { icon: "Package",       tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  shopping:     { icon: "ShoppingBasket",tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  mentors:      { icon: "UserRoundCheck",tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  events:       { icon: "CalendarDays",  tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  booking:      { icon: "CalendarCheck", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  goals:        { icon: "Target",        tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  health:       { icon: "HeartPulse",    tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  cycle:        { icon: "Droplet",       tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  care:         { icon: "HeartHandshake",tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  day:          { icon: "Sun",           tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  // Safety reads as safety at a glance, or the exemption it enjoys from quiet
  // hours and the daily cap is the only thing that distinguishes it.
  travel:       { icon: "ShieldAlert",   tint: "--ux-danger-tint",    ink: "--ux-danger-ink" },
};

export function presetFor(titleKey: string): ReminderPreset | null {
  const preset = PRESETS.find((p) => p.key === titleKey);
  if (preset) return preset;

  const look = ENGINE_LOOKS[titleKey.split(".")[0]];
  // `suggest` is never read for an engine reminder -- the engine chose the
  // hour and the screen only offers to change it on one she set herself --
  // but the shape is shared, so it carries a sane value rather than "".
  return look ? { key: titleKey, ...look, suggest: "09:00" } : null;
}

/**
 * The hours offered as buttons.
 *
 * A row of real times, not a clock widget: a native time input on a cheap
 * Android is a scrolling drum that is hard to hit and impossible to read out.
 * These eleven cover the day a woman running a household and a trade actually
 * keeps, and she can still pick any other hour from the full list.
 */
export const QUICK_TIMES = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "12:00",
  "15:00", "17:00", "19:00", "20:00", "21:00",
];

/** Every half hour, for when none of the quick ones is right. */
export const ALL_TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

/**
 * Monday first, and 0 = Monday.
 *
 * That is Python's `weekday()`, which is what the scheduling engine indexes
 * on. Getting this wrong shifts every weekly reminder by a day, silently, and
 * only on the weeks where it matters.
 */
export const WEEKDAYS: { value: number; key: string }[] = [
  { value: 0, key: "rem.day.mon" },
  { value: 1, key: "rem.day.tue" },
  { value: 2, key: "rem.day.wed" },
  { value: 3, key: "rem.day.thu" },
  { value: 4, key: "rem.day.fri" },
  { value: 5, key: "rem.day.sat" },
  { value: 6, key: "rem.day.sun" },
];

/**
 * How a time reads back to her: "8 in the evening", not "20:00".
 *
 * Takes `t` rather than calling a hook, so the same function works in a row, a
 * button and a screen reader label without each of them re-deriving the words.
 */
export function spokenTime(
  hhmm: string,
  t: (k: MessageKey, p?: Record<string, string | number>) => string,
): string {
  const [hRaw, m] = hhmm.split(":");
  const h = Number(hRaw);
  const part =
    h < 12 ? "rem.part.morning"
    : h < 16 ? "rem.part.afternoon"
    : h < 20 ? "rem.part.evening"
    : "rem.part.night";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  const clock = m === "00" ? String(twelve) : `${twelve}:${m}`;
  return t(part as MessageKey, { time: clock });
}

import { apiClient, expected } from "./api";

/**
 * The reminder and notification engines.
 *
 * One rule runs through every call: **her time zone travels with the request.**
 * A reminder is an instant the server computes from a local wall-clock time —
 * "07:00" means seven in the morning where she is standing, and the server has
 * no other way to know where that is. Send the wrong zone and a habit fires in
 * the middle of her night; send none and it silently becomes UTC, which is the
 * same bug with a friendlier name.
 *
 * `zone()` reads it from the browser on every call rather than caching it, so
 * a woman who travels gets the right hour from the first screen after she
 * lands, without a settings change she would never think to make.
 */

export function zone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

/* ── shapes ─────────────────────────────────────────────────────────────── */

/**
 * The engine's whole schedule vocabulary. Exactly these three words.
 *
 * There is no "daily" or "weekly": both are `recurring`, and the difference is
 * `days` — empty means every day, `[1, 3]` means Tuesday and Thursday. Sending
 * anything else used to be accepted and stored as `once`, which with no `at`
 * produced a reminder that never fired and no error to find it by. The server
 * refuses unknown values now; this type is the other half of that fix.
 */
export type ScheduleType = "once" | "recurring" | "event_relative";

/** What the preview is showing: queued by the engine, or computed from the rule. */
export type OccurrenceState = "scheduled" | "projected" | string;

/** The four answers she can give without typing (REM-UC-003). */
export type ReminderAction = "done" | "snooze" | "skip" | "stop";

export interface ReminderSchedule {
  type: ScheduleType;
  at: string | null;
  local_time: string;
  /** 0 = Monday, matching Python's `weekday()`. */
  days: number[];
  offset_minutes: number;
}

export interface Reminder {
  id: string;
  /** A catalogue key, not a sentence — the screen runs it through `t()`. */
  title_key: string;
  payload: Record<string, unknown>;
  category: string;
  klass: string;
  schedule: ReminderSchedule;
  tz: string;
  state: string;
  version: number;
  ends_at: string | null;
}

export interface Occurrence {
  /** Empty on a projected instant — it has not been queued, so it has no row. */
  id: string;
  definition_id: string;
  due_at: string;
  state: OccurrenceState;
  category: string;
  completed_at: string | null;
}

export interface ReminderInput {
  title_key: string;
  schedule_type: ScheduleType;
  category?: string;
  /** For `once`, an absolute instant. */
  at?: string;
  /** Required for `recurring`: "HH:MM" in her own wall clock. */
  local_time?: string;
  /** Empty = every day. 0 = Monday, matching Python's `weekday()`. */
  days?: number[];
  offset_minutes?: number;
  anchor_at?: string;
  ends_at?: string;
  payload?: Record<string, unknown>;
}

/** The four settings that decide how much reaches her at all. */
export type NotifyMode = "all" | "important" | "inapp_only" | "off";

/** Every transport the policy layer knows about, in the order it prefers them. */
export const CHANNELS = ["inapp", "push", "email", "sms", "whatsapp", "voice"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface EnginePreferences {
  tz: string;
  mode: NotifyMode;
  /** `days` empty means every night. */
  quiet: { start: string; end: string; days: number[]; enabled: boolean };
  channels: Partial<Record<Channel, boolean>>;
  budget: { discretionary_per_day: number; min_gap_minutes: number };
  /** Set when two prompts in a series go unanswered — the engine easing off by itself. */
  fatigue?: Record<string, unknown>;
  paused_until: string | null;
  version?: number;
}

export interface PreferencesInput {
  tz?: string;
  mode?: NotifyMode;
  quiet_start?: string;
  quiet_end?: string;
  quiet_enabled?: boolean;
  channels?: Partial<Record<Channel, boolean>>;
  discretionary_per_day?: number;
  min_gap_minutes?: number;
  paused_until?: string | null;
}

export interface WhyAnswer {
  decision: string;
  reason: string;
  at: string;
  channels: string[];
}

/* ── her reminders ──────────────────────────────────────────────────────── */

export async function apiListReminders(): Promise<Reminder[]> {
  const { data } = await apiClient.get<{ reminders: Reminder[] }>("/engines/reminders");
  return data.reminders;
}

export async function apiCreateReminder(body: ReminderInput): Promise<Reminder> {
  const { data } = await apiClient.post<Reminder>("/engines/reminders", {
    ...body,
    tz: zone(),
  });
  return data;
}

/**
 * The next five real instants.
 *
 * REM-UC-001 asks for these *before* a repeat starts, and asks for computed
 * dates rather than a description of the rule — "every Tuesday" is a claim,
 * five Tuesdays are a thing she can check. So this is never rendered from the
 * schedule on the client: it is what the server has actually queued.
 */
export async function apiNextOccurrences(definitionId: string): Promise<Occurrence[]> {
  const { data } = await apiClient.get<{ next: Occurrence[] }>(
    `/engines/reminders/${definitionId}/next`,
  );
  return data.next;
}

export async function apiEditReminder(
  definitionId: string,
  changes: Partial<Pick<Reminder, "title_key" | "payload" | "category" | "tz" | "ends_at">> & {
    schedule?: Partial<ReminderSchedule>;
  },
): Promise<boolean> {
  const { data } = await apiClient.patch<{ updated: boolean }>(
    `/engines/reminders/${definitionId}`,
    changes,
  );
  return data.updated;
}

/** Stops the series. Days already marked done stay done — see REM-UC-005. */
export async function apiStopReminder(definitionId: string): Promise<boolean> {
  const { data } = await apiClient.delete<{ stopped: boolean }>(
    `/engines/reminders/${definitionId}`,
  );
  return data.stopped;
}

/* ── her answers ────────────────────────────────────────────────────────── */

/**
 * Done, Later, Skip today, Stop.
 *
 * `minutes` only means anything for `snooze`. The server authorises the
 * occurrence against her own id, because this id arrives in a push payload and
 * must not be enough on its own to complete somebody else's reminder.
 */
export async function apiActOnOccurrence(
  occurrenceId: string,
  action: ReminderAction,
  opts: { via?: string; minutes?: number } = {},
): Promise<boolean> {
  const { data } = await apiClient.post<{ ok: boolean }>(
    `/engines/occurrences/${occurrenceId}/action`,
    { action, via: opts.via ?? "inapp", minutes: opts.minutes ?? 60 },
  );
  return data.ok;
}

/**
 * "Did it actually happen?" — the second half of a booking reminder.
 *
 * A `false` here is the answer this exists for: it is how a mentor who did not
 * turn up becomes a fact somebody can act on, instead of a woman quietly
 * giving up. The answer goes back to the booking, not just into the message.
 */
export async function apiAnswerFollowUp(
  occurrenceId: string,
  happened: boolean,
): Promise<{ ok: boolean }> {
  const { data } = await apiClient.post<{ ok: boolean }>(
    `/engines/occurrences/${occurrenceId}/happened`,
    { happened },
  );
  return data;
}

/* ── how she is told ────────────────────────────────────────────────────── */

export async function apiGetEnginePreferences(): Promise<EnginePreferences> {
  const { data } = await apiClient.get<EnginePreferences>("/engines/preferences");
  return data;
}

/**
 * Saving these re-decides work that is already queued, not only what comes
 * next — so turning everything off at 22:00 stops the 07:00 delivery that was
 * held overnight, rather than letting one last message through.
 */
export async function apiSetEnginePreferences(
  body: PreferencesInput,
): Promise<EnginePreferences> {
  const { data } = await apiClient.put<EnginePreferences>("/engines/preferences", {
    ...body,
    tz: body.tz ?? zone(),
  });
  return data;
}

/* ── which ways of reaching her actually work ───────────────────────────── */

export type ChannelAvailability = Record<Channel, boolean> & {
  /**
   * Whether anything is DISPATCHED at all.
   *
   * A configured channel is not a delivered message: `ENGINES_ENABLED` is the
   * switch on the tick loop, and with it off every reminder she sets is
   * stored, scheduled, listed back to her — and never sent. Her screens had no
   * way to know; the only endpoint carrying it was staff-only.
   */
  delivering?: boolean;
};

/**
 * What the settings screen may offer.
 *
 * Each adapter refuses with `*_not_configured` when its provider is missing,
 * and that refusal never reaches the client: the toggle saves, the preference
 * stores, and nothing is delivered. Asking first is what lets the screen show
 * an unavailable channel as unavailable rather than as a switch she has
 * turned on and is quietly waiting on.
 */
export async function apiChannelAvailability(): Promise<ChannelAvailability> {
  const { data } = await apiClient.get<ChannelAvailability>("/engines/channels");
  return data;
}

/* ── web push ───────────────────────────────────────────────────────────── */

export interface PushKey { key: string; enabled: boolean }

export async function apiPushKey(): Promise<PushKey> {
  const { data } = await apiClient.get<PushKey>("/engines/push/key");
  return data;
}

export async function apiSubscribePush(sub: {
  endpoint: string; p256dh: string; auth: string; user_agent?: string;
}): Promise<void> {
  await apiClient.post("/engines/push/subscribe", {
    ...sub, user_agent: sub.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : ""),
  });
}

export async function apiUnsubscribePush(endpoint: string): Promise<void> {
  // A query parameter, not a body: FastAPI declares `endpoint: str` on the
  // signature, and a DELETE body would have been ignored and the row left in
  // place — a browser she thinks she removed, still being sent to.
  await apiClient.delete("/engines/push/subscribe", { params: { endpoint } });
}

/**
 * "Why am I being told this?"
 *
 * Reads the decision that was stored at the time rather than working out a new
 * one, so the answer is what actually happened — including when the reason has
 * since stopped being true. A 404 means no decision was recorded, which is an
 * ordinary answer for an old message, so it is `expected` and never raises the
 * red bar.
 */
export async function apiWhy(intentId: string): Promise<WhyAnswer | null> {
  try {
    const { data } = await apiClient.get<WhyAnswer>(
      `/engines/why/${intentId}`,
      expected({}),
    );
    return data;
  } catch {
    return null;
  }
}

/* ── how she is today ───────────────────────────────────────────────────── */

/** Deliberately few and plain. A fifteen-point scale is a questionnaire. */
export const MOODS = ["good", "tired", "low", "anxious", "angry", "unwell"] as const;
export type Mood = (typeof MOODS)[number];

/** How she would like to be met. `quiet` and `none` return no card at all. */
export const SUPPORT_STYLES = ["practical", "gentle", "quiet", "none"] as const;
export type SupportStyle = (typeof SUPPORT_STYLES)[number];

export interface SupportCard {
  id: string;
  kind: string;
  title: string;
  body: string;
  minutes: number;
}

export interface ResetActivity {
  id: string;
  text: string;
  minutes: number;
  icon: string;
}

/**
 * One tap, and at most one reply.
 *
 * The card that comes back is an answer, not an enrolment: a voluntary
 * check-in never starts a series, and `good` deliberately returns nothing at
 * all — a woman who says she is fine does not need to be handled. `null` here
 * is the correct, common answer, not a failure.
 */
export async function apiMoodCheckIn(
  mood: Mood, opts: { note?: string; style?: SupportStyle } = {},
): Promise<{ ok: boolean; mood: Mood; card: SupportCard | null }> {
  const { data } = await apiClient.post<{ ok: boolean; mood: Mood; card: SupportCard | null }>(
    "/engines/mood/check-in",
    { mood, note: opts.note ?? "", style: opts.style ?? null },
  );
  return data;
}

export async function apiMoodCard(): Promise<SupportCard | null> {
  const { data } = await apiClient.get<{ card: SupportCard | null }>("/engines/mood/card");
  return data.card;
}

/** Something to do, not something to read — under fifteen minutes, nothing to buy. */
export async function apiResetActivity(): Promise<ResetActivity | null> {
  const { data } = await apiClient.get<{ activity: ResetActivity | null }>("/engines/mood/activity");
  return data.activity;
}

/** General, a chosen scripture, or none — and `none` switches off nothing else. */
export async function apiSetEncouragement(
  choice: "general" | "scripture" | "none",
): Promise<void> {
  await apiClient.put("/engines/mood/encouragement", null, { params: { choice } });
}

/* ── a habit she keeps ──────────────────────────────────────────────────── */

export interface Habit {
  id: string;
  kind: string;
  label: string;
  note: string;
  local_time: string;
  every_days: number;
  next_due: string;
  /** Whether today is already marked. Deliberately not a streak or a count. */
  done_today: boolean;
}

/**
 * The habits and screenings she keeps.
 *
 * The server sends `done_today` and nothing else about her history — no
 * streak, no percentage, no missed days. That restraint is the feature: the
 * moment a screen can draw "4 of 7" it becomes a way to feel behind about
 * medicine.
 */
export async function apiListHabits(): Promise<Habit[]> {
  const { data } = await apiClient.get<{ habits: Habit[] }>("/engines/habits");
  return data.habits;
}

/**
 * "I took it."
 *
 * Her record, never a score, and never shown to anyone else — which is why
 * nothing on the screen that calls this draws a streak or a percentage.
 */
export async function apiHabitTaken(habitId: string): Promise<boolean> {
  const { data } = await apiClient.post<{ recorded: boolean }>(
    `/engines/habits/${habitId}/taken`,
  );
  return data.recorded;
}

/** Something to pick up, remembered for when she is next near a market. */
export async function apiAddShoppingItem(item: string): Promise<string> {
  const { data } = await apiClient.post<{ id: string }>("/engines/shopping", null, {
    params: { item },
  });
  return data.id;
}

/* ── a tracked journey ──────────────────────────────────────────────────── */

/**
 * A check-in deadline that outlives the browser.
 *
 * This is the point of doing it server-side: if her phone dies, is taken, or
 * she simply cannot reach it, the deadline still passes and her people are
 * still told. A timer in the page would die with the page — which is precisely
 * the situation this exists for.
 *
 * `journeyId` is ours to choose. It ties the deadline, the check-ins and the
 * alert together, so it must be the same string for the life of one journey.
 */
export async function apiTravelStart(journeyId: string, minutes: number): Promise<string> {
  const { data } = await apiClient.post<{ deadline_id: string }>("/engines/travel/start", {
    journey_id: journeyId, minutes,
  });
  return data.deadline_id;
}

/** "Still on the way." The old deadline dies only after the new one exists. */
export async function apiTravelCheckIn(journeyId: string, minutes: number): Promise<string> {
  const { data } = await apiClient.post<{ deadline_id: string }>("/engines/travel/checkin", {
    journey_id: journeyId, minutes,
  });
  return data.deadline_id;
}

/** "I'm here." Everything stops; nobody is told anything. */
export async function apiTravelEnd(journeyId: string): Promise<void> {
  await apiClient.post("/engines/travel/end", { journey_id: journeyId, minutes: 0 });
}

/**
 * Warn her while the journey can still be made safe.
 *
 * A tracked journey whose phone is about to die is a journey that is about to
 * stop being tracked, and the moment to say so is before the battery goes.
 */
export async function apiTrackingHealth(
  journeyId: string, batteryPercent: number, locationOk: boolean,
): Promise<{ warned: boolean; problems?: string[] }> {
  const { data } = await apiClient.post<{ warned: boolean; problems?: string[] }>(
    "/engines/safety/tracking-health",
    { journey_id: journeyId, battery_percent: batteryPercent, location_ok: locationOk },
  );
  return data;
}

/* ── telling her people ─────────────────────────────────────────────────── */

export interface AlertRaised {
  alert_id: string;
  told: number;
  no_contacts: boolean;
}

/**
 * Tell her trusted contacts, now.
 *
 * `isTest` is carried on the record and into the wording, so her sister can
 * tell a test from the real thing **from the message itself** rather than from
 * context she may not have — SAFE-UC-031.
 */
export async function apiRaiseEngineAlert(
  journeyId: string, reason: string, isTest = false,
): Promise<AlertRaised> {
  const { data } = await apiClient.post<AlertRaised>("/engines/safety/alert", {
    journey_id: journeyId, reason, is_test: isTest,
  });
  return data;
}

/** She is fine. The ladder stops, and a quiet follow-up comes a day later. */
export async function apiResolveEngineAlert(alertId: string, note = ""): Promise<boolean> {
  const { data } = await apiClient.post<{ resolved: boolean }>(
    `/engines/safety/resolve/${alertId}`, null, { params: { note } },
  );
  return data.resolved;
}

/* ── a suggested hour, which she confirms ───────────────────────────────── */

export interface SuggestedTime {
  local_time: string;
  why: string;
  /** `default` when nothing was suggested — the field that stops a guess reading as advice. */
  source: "default" | "suggested";
}

export async function apiSuggestTime(what: string): Promise<SuggestedTime> {
  // `what` only: the server reads her saved zone rather than trusting the
  // browser here, because the suggestion is checked against her quiet hours
  // and those are stored against that same zone.
  const { data } = await apiClient.get<SuggestedTime>("/engines/suggest-time", {
    params: { what },
  });
  return data;
}

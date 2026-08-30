"use client";

import { useCallback } from "react";

import { apiBookings } from "@/lib/me-api";
import { apiEvents, apiMyMentorRequests } from "@/lib/growth-api";
import { useResource, type Resource } from "@/lib/use-resource";

export interface DiaryEntry {
  id: string;
  /** ISO date, so sorting is a string compare and never a locale guess. */
  on: string;
  d: number;
  m: string;
  day: string;
  title: string;
  time: string;
  kind: string;
  where: string;
  icon: string;
  tint: string;
  ink: string;
  cta: string;
  href: string;
  past: boolean;
}

/**
 * Her diary — a view over what she has already committed to.
 *
 * It held five entries in a constant: a mentor session with a woman called
 * Neha, a live class, a webinar, a craft mela at "Community Hall, Sector 12",
 * and a rights workshop. All in May, all invented, all shown as hers.
 *
 * **Deliberately not its own collection.** A diary that stored its own entries
 * would drift from Bookings the first time somebody cancelled on one screen
 * and not the other, and then two screens would disagree about where she is
 * meant to be on Thursday. Everything here is a booking, an event she
 * registered for, or a mentor session she asked for — so this reads those
 * three and merges them, and there is nothing to keep in step.
 */
export interface DiaryWeek {
  iso: string;
  /** Day of the month, as the pip shows it. */
  date: number;
  /** One letter, for the row above the pips. */
  letter: string;
  has: boolean;
}

export interface Diary {
  entries: DiaryEntry[];
  /** Today and the six days after it. */
  week: DiaryWeek[];
}

export function useDiary(): Resource<Diary> {
  return useResource<Diary>(
    useCallback(async (signal: AbortSignal) => {
      const [bookings, events, mentors] = await Promise.all([
        apiBookings(signal),
        apiEvents(signal),
        apiMyMentorRequests(signal),
      ]);

      const today = toIso(new Date());
      const out: DiaryEntry[] = [];

      for (const b of bookings) {
        if (b.status === "cancelled" || !b.date) continue;
        out.push({
          ...stamp(b.date),
          id: `booking-${b.id}`,
          title: b.service_name,
          time: b.time ? `${b.time}${b.duration ? ` · ${b.duration}` : ""}` : "Time to be confirmed",
          kind: "Session",
          where: b.mode === "online" ? "Online" : b.mode || "In person",
          icon: "CalendarCheck", tint: "--ux-tint-violet", ink: "--ux-violet",
          cta: "See booking", href: `/app/bookings/${b.id}`,
          past: b.date < today,
        });
      }

      for (const e of events) {
        // Only the ones she is actually going to. The events screen lists what
        // is on; a diary lists what she has agreed to.
        if (!e.registered || !e.date) continue;
        out.push({
          ...stamp(e.date),
          id: `event-${e.id}`,
          title: e.title,
          time: e.time || e.date_label || "",
          kind: "Event",
          where: e.mode === "online" ? "Online" : e.venue || "In person",
          icon: "Store", tint: "--ux-tint-pink", ink: "--ux-pink",
          cta: "See event", href: `/app/events/${e.id}`,
          past: e.date < today,
        });
      }

      for (const r of mentors) {
        // A request that has not been accepted is not a date in her diary, and
        // putting one there is how somebody waits in for a call nobody agreed.
        if (r.status !== "accepted" || !r.preferred_time) continue;
        out.push({
          ...stamp(today),
          id: `mentor-${r.id}`,
          title: `Session with ${r.mentor_name}`,
          time: r.preferred_time,
          kind: "Mentoring",
          where: "Video call",
          icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange",
          cta: "See mentor", href: `/app/mentors/${r.mentor_id}`,
          past: false,
        });
      }

      const entries = out.sort((a, b) => a.on.localeCompare(b.on));

      // Built here, in the fetcher, and not during render. Reading the clock
      // while rendering makes the server's markup differ from the browser's
      // whenever the two disagree about the date — which they do, every night,
      // for anyone whose timezone is not the server's. This app has been
      // caught by that once already, on the events screen.
      const week: DiaryWeek[] = Array.from({ length: 7 }, (_, i) => {
        const day = new Date();
        day.setDate(day.getDate() + i);
        const iso = toIso(day);
        return {
          iso,
          date: day.getDate(),
          letter: ["S", "M", "T", "W", "T", "F", "S"][day.getDay()],
          has: entries.some((e) => e.on === iso),
        };
      });

      return { entries, week };
    }, []),
    { entries: [], week: [] },
  );
}

/** Local date as YYYY-MM-DD. `toISOString` would shift it by the UTC offset. */
function toIso(when: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** An ISO date, split the way the card reads it. */
function stamp(iso: string) {
  const when = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(when.getTime())) return { on: iso, d: 0, m: "", day: "" };
  return {
    on: iso,
    d: when.getDate(),
    m: MONTHS[when.getMonth()],
    day: WEEKDAYS[when.getDay()],
  };
}

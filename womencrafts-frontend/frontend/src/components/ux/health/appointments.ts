"use client";

import { useEffect, useState } from "react";

import { apiMyConsultations, type Consultation } from "@/lib/doctors-api";
import { apiMyMentorRequests, type MentorRequest } from "@/lib/growth-api";
import { ymd } from "@/lib/health-api";

/**
 * Her booked sessions, from the two places they live — doctor consultations
 * (`/doctors/consultations/mine`) and mentor requests
 * (`/growth/mentors/requests/mine`) — as one list Appointments & Reminders
 * and Health Records can lay beside her own reminders.
 *
 * A mentor's agreed time is her own words ("Sat, 5 PM"), not a date; it is
 * placed on the calendar only when it reads as one, and listed otherwise.
 */

export type ApptStatus = "requested" | "confirmed" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  kind: "doctor" | "mentor";
  title: string;
  sub: string;
  /** YYYY-MM-DD, or "" when the time is not a date. */
  day: string;
  /** HH:MM, or "". */
  time: string;
  /** What she can read when there is no date ("Sat, 5 PM"). */
  when: string;
  status: ApptStatus;
  href: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function fromDoctor(c: Consultation): Appointment {
  const at = new Date(c.start);
  const ok = !Number.isNaN(at.getTime());
  return {
    id: `doc-${c.id}`, kind: "doctor", title: c.doctor_name || "Doctor consultation",
    sub: [c.speciality, c.mode].filter(Boolean).join(" · "),
    day: ok ? ymd(at) : "", time: ok ? `${pad(at.getHours())}:${pad(at.getMinutes())}` : "",
    when: ok ? at.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "",
    status: (["requested", "confirmed", "completed", "cancelled"] as ApptStatus[]).includes(c.status as ApptStatus) ? c.status as ApptStatus : "requested",
    href: "/app/health/doctors?tab=consultations",
  };
}

function fromMentor(r: MentorRequest): Appointment | null {
  const status: ApptStatus | null =
    r.status === "pending" ? "requested" : r.status === "accepted" ? "confirmed" : r.status === "closed" ? "completed"
      : r.status === "declined" || r.status === "withdrawn" ? "cancelled" : null;
  if (!status) return null;
  const at = r.scheduled_for ? new Date(r.scheduled_for) : null;
  const ok = !!at && !Number.isNaN(at.getTime()) && /\d/.test(r.scheduled_for || "");
  return {
    id: `men-${r.id}`, kind: "mentor", title: r.mentor_name || "Mentor session", sub: "Mentor session",
    day: ok ? ymd(at!) : "", time: ok ? `${pad(at!.getHours())}:${pad(at!.getMinutes())}` : "",
    when: r.scheduled_for || (status === "requested" ? "Waiting for her to confirm a time" : ""),
    status, href: "/app/health/mentors?tab=sessions",
  };
}

/** Both lists, merged. Either source failing (or not deployed yet) leaves the other. */
export function useAppointments() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    Promise.allSettled([apiMyConsultations(ctl.signal), apiMyMentorRequests(ctl.signal)]).then(([d, m]) => {
      if (ctl.signal.aborted) return;
      const out: Appointment[] = [];
      if (d.status === "fulfilled") out.push(...d.value.map(fromDoctor));
      if (m.status === "fulfilled") out.push(...m.value.map(fromMentor).filter((x): x is Appointment => !!x));
      setItems(out);
    });
    return () => ctl.abort();
  }, []);
  return { items: items ?? [], loading: items === null };
}

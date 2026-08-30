export type ApptStatus = "Upcoming" | "Completed" | "Cancelled" | "Rescheduled";
export type Appt = {
  _id: string; // mongo id — used for status/delete calls (empty for transient rows)
  id: string;
  name: string;
  service: string;
  day: string; // "Mon"
  date: string; // "May 20"
  time: string; // "09:00 - 10:00 AM"
  status: ApptStatus;
  color: string; // accent hex for the left border
  bg: string; // tailwind card bg incl dark variant
};

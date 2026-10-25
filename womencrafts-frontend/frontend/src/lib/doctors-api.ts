import { apiClient } from "./api";

/**
 * Doctor Consultation — backend: routes/doctors.py.
 *
 * Staff keep the directory (/admin/doctors); a member finds a doctor, picks a
 * free slot and sends a request (/doctors). Staff confirm it with how to join,
 * then complete it with the prescription. No money is taken here: the fee is
 * paid to the doctor or clinic.
 */

export const SPECIALITIES = [
  "Gynaecologist", "General physician", "Paediatrician", "Nutritionist", "Counsellor",
  "Dermatologist", "Physiotherapist", "Other",
] as const;
export type Speciality = (typeof SPECIALITIES)[number];
export const MODES = ["Video", "Phone", "Clinic"] as const;
export type Mode = (typeof MODES)[number];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface Hours { day: (typeof WEEKDAYS)[number]; start: string; end: string; slot_minutes: number }

export interface Doctor {
  id: string;
  name: string;
  speciality: Speciality;
  qualifications: string;
  registration_no: string;
  languages: string[];
  experience_years: number;
  /** Paise; 0 = free. Paid to the doctor or clinic, never through WomSakhi. */
  fee_minor: number;
  modes: Mode[];
  clinic: string;
  city: string;
  photo: string;
  bio: string;
  availability: Hours[];
  active: boolean;
  verified: boolean;
  days: string[];
  /** ISO of her next free slot, or "". */
  next_slot: string;
  consultations_done: number;
}

export type ConsultStatus = "requested" | "confirmed" | "completed" | "cancelled";

export interface Consultation {
  id: string;
  doctor_id: string;
  doctor_name: string;
  speciality: string;
  /** ISO date-time. */
  start: string;
  mode: Mode;
  status: ConsultStatus;
  /** Prescription text once completed; null before. */
  prescription: string | null;
  prescription_file: string;
  prescription_at: string;
  reason: string;
  symptoms: string[];
  join_info: string;
  fee_minor: number;
  clinic: string;
  city: string;
  doctor_photo: string;
  cancel_reason: string;
  cancelled_by: string;
  created_at: string;
}

export interface AdminConsultation extends Consultation { user_id: string; member_name: string; staff_note: string }

export type DoctorInput = Omit<Doctor, "id" | "verified" | "days" | "next_slot" | "consultations_done" | "photo"> & { photo?: string | null };

/* member */
export const apiDoctors = (f: { speciality?: string; language?: string; mode?: string; q?: string } = {}, signal?: AbortSignal) =>
  apiClient.get<Doctor[]>("/doctors", { signal, params: { ...f } }).then((r) => r.data);
export const apiDoctor = (id: string, signal?: AbortSignal) =>
  apiClient.get<Doctor>(`/doctors/${id}`, { signal }).then((r) => r.data);
export const apiDoctorSlots = (id: string, date: string, signal?: AbortSignal) =>
  apiClient.get<{ date: string; slots: string[] }>(`/doctors/${id}/slots`, { signal, params: { date } }).then((r) => r.data);
export const apiBookDoctor = (id: string, body: { start: string; mode: Mode; reason: string; symptoms: string[] }) =>
  apiClient.post<Consultation>(`/doctors/${id}/book`, body).then((r) => r.data);
export const apiMyConsultations = (signal?: AbortSignal) =>
  apiClient.get<Consultation[]>("/doctors/consultations/mine", { signal }).then((r) => r.data);
export const apiCancelConsultation = (id: string) =>
  apiClient.post<Consultation>(`/doctors/consultations/${id}/cancel`).then((r) => r.data);

/* staff */
export const apiAdminDoctors = (q = "", signal?: AbortSignal) =>
  apiClient.get<Doctor[]>("/admin/doctors", { signal, params: { q: q || undefined } }).then((r) => r.data);
export const apiAdminAddDoctor = (body: DoctorInput) =>
  apiClient.post<Doctor>("/admin/doctors", body).then((r) => r.data);
export const apiAdminEditDoctor = (id: string, body: DoctorInput) =>
  apiClient.put<Doctor>(`/admin/doctors/${id}`, body).then((r) => r.data);
export const apiAdminConsultations = (f: { status?: string; doctor_id?: string } = {}, signal?: AbortSignal) =>
  apiClient.get<AdminConsultation[]>("/admin/doctors/consultations", { signal, params: { status: f.status || undefined, doctor_id: f.doctor_id || undefined } }).then((r) => r.data);
export const apiAdminConfirmConsultation = (id: string, body: { join_info: string; staff_note?: string }) =>
  apiClient.post<AdminConsultation>(`/admin/doctors/consultations/${id}/confirm`, body).then((r) => r.data);
export const apiAdminCompleteConsultation = (id: string, body: { prescription: string; file?: string | null; staff_note?: string }) =>
  apiClient.post<AdminConsultation>(`/admin/doctors/consultations/${id}/complete`, body).then((r) => r.data);
export const apiAdminCancelConsultation = (id: string, reason: string) =>
  apiClient.post<AdminConsultation>(`/admin/doctors/consultations/${id}/cancel`, { reason }).then((r) => r.data);

/* display */
export const feeLabel = (minor: number) => (minor > 0 ? `₹${Math.round(minor / 100).toLocaleString("en-IN")}` : "Free");
export const whenLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) =>
  iso ? new Date(iso).toLocaleString("en-IN", opts) : "";
export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

import { apiClient } from "./api";

/**
 * Teach — a member's own courses (backend: routes/teach.py).
 *
 * A course is free or has a price; a paid course is paid to HER directly by
 * UPI, and she confirms each learner's payment here before the lessons open.
 */

export interface TeachLesson {
  title: string;
  detail: string;
  duration: string;
  body: string;
  video_url: string;
  /** A free preview — anyone can watch it before joining. At most 2 per course. */
  preview: boolean;
}

export interface CourseStats {
  learners: number;
  learning: number;
  completed: number;
  pending: number;
  /** Learners who say they paid and are waiting on her. */
  to_confirm: number;
  earned_minor: number;
}

export interface TeachCourseRow {
  id: string;
  name: string;
  category: string;
  status: string;
  live: boolean;
  price_minor: number;
  lesson_count: number;
  updated_at: string;
  stats: CourseStats;
}

export interface TeachCourse extends TeachCourseRow {
  desc: string;
  duration: string;
  upi_id: string;
  lessons: TeachLesson[];
}

export interface CourseInput {
  name: string;
  desc: string;
  category: string;
  duration: string;
  price_rupees: number;
  upi_id: string;
  lessons: TeachLesson[];
  publish: boolean;
}

export interface TeachLearner {
  enrollment_id: string;
  name: string;
  /** active | completed | pending */
  status: string;
  progress: number;
  joined: string;
  payment_status: string;
  amount_minor: number;
  reference: string;
  claimed_at: string;
}

export interface TeachSummary {
  courses: number;
  live: number;
  learners: number;
  to_confirm: number;
  earned_minor: number;
  month_minor: number;
}

/** The categories a member can teach in (backend: ProgramModel.CATEGORIES). */
export const TEACH_CATEGORIES = [
  "Handicrafts",
  "Cooking & Food",
  "Beauty & Care",
  "Entrepreneurship",
  "Digital Literacy",
  "Money & Savings",
  "Health & Wellness",
  "Languages",
  "Personal Development",
  "Sustainability",
];

const get = <T,>(url: string, signal?: AbortSignal) => apiClient.get<T>(url, { signal }).then((r) => r.data);

export const apiTeachSummary = (s?: AbortSignal) => get<TeachSummary>("/teach/summary", s);
export const apiTeachCourses = (s?: AbortSignal) => get<TeachCourseRow[]>("/teach/courses", s);
export const apiTeachCourse = (id: string, s?: AbortSignal) => get<TeachCourse>(`/teach/courses/${id}`, s);
export const apiTeachLearners = (id: string, s?: AbortSignal) => get<TeachLearner[]>(`/teach/courses/${id}/learners`, s);

export async function apiCreateCourse(input: CourseInput) {
  const { data } = await apiClient.post<TeachCourse>("/teach/courses", input);
  return data;
}

export async function apiSaveCourse(id: string, input: CourseInput) {
  const { data } = await apiClient.put<TeachCourse>(`/teach/courses/${id}`, input);
  return data;
}

export async function apiSetCourseLive(id: string, live: boolean) {
  const { data } = await apiClient.post<TeachCourse>(`/teach/courses/${id}/${live ? "publish" : "unpublish"}`);
  return data;
}

export async function apiConfirmLearnerPayment(enrollmentId: string) {
  const { data } = await apiClient.post<TeachLearner>(`/teach/learners/${enrollmentId}/confirm`);
  return data;
}

export async function apiDeclineLearnerPayment(enrollmentId: string, note = "") {
  const { data } = await apiClient.post<TeachLearner>(`/teach/learners/${enrollmentId}/decline`, { note });
  return data;
}

/** "₹499" — whole rupees without paise, as the courses are priced. */
export function rupees(minor: number): string {
  const r = minor / 100;
  return `₹${Number.isInteger(r) ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

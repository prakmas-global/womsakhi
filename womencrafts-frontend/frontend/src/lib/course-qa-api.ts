import { apiClient } from "./api";

/** Questions and answers on a course (backend: routes/course_qa.py). */

export interface QAAnswer {
  id: string;
  author: string;
  body: string;
  when: string;
  by_teacher: boolean;
  /** The teacher marked it correct — the green check. */
  verified: boolean;
  mine: boolean;
}

export interface QAQuestion {
  id: string;
  author: string;
  body: string;
  /** The lesson it is about (1-based), or null for the whole course. */
  lesson: number | null;
  lesson_title: string;
  when: string;
  by_teacher: boolean;
  mine: boolean;
  answers: QAAnswer[];
  resolved: boolean;
}

export interface CourseQA {
  is_teacher: boolean;
  teacher_name: string;
  questions: QAQuestion[];
  unanswered: number;
}

export const apiCourseQA = (programId: string, s?: AbortSignal, lesson?: number) =>
  apiClient.get<CourseQA>(`/courses/${programId}/qa`, { signal: s, params: lesson ? { lesson } : undefined }).then((r) => r.data);

export async function apiAskQuestion(programId: string, body: string, lesson?: number | null) {
  const { data } = await apiClient.post<QAQuestion>(`/courses/${programId}/qa`, { body, lesson: lesson || null });
  return data;
}

export async function apiAnswerQuestion(programId: string, questionId: string, body: string) {
  const { data } = await apiClient.post<QAQuestion>(`/courses/${programId}/qa/${questionId}/answers`, { body });
  return data;
}

export async function apiVerifyAnswer(programId: string, questionId: string, answerId: string) {
  const { data } = await apiClient.post<QAQuestion>(`/courses/${programId}/qa/${questionId}/answers/${answerId}/verify`);
  return data;
}

export async function apiDeleteQuestion(programId: string, questionId: string) {
  await apiClient.delete(`/courses/${programId}/qa/${questionId}`);
}

export async function apiDeleteAnswer(programId: string, questionId: string, answerId: string) {
  await apiClient.delete(`/courses/${programId}/qa/${questionId}/answers/${answerId}`);
}

import { apiClient } from "./api";
import { apiMyPermissions } from "./permissions-api";

/**
 * Staff side of learning: skill tests, the phone-confidence steps, and the
 * certificate register.
 *
 * Everything under `/admin/learning/*` is behind the "learning" module guard
 * and every write names its action (`learning.create`, `.edit`, `.delete`,
 * `.approve`, `.export`). The screens ask `apiLearningPermissions()` which of
 * those the signed-in account holds, so a button is only drawn when the
 * server would accept the click.
 *
 * Revoking and reinstating a certificate sit behind `approve`: they decide
 * whether a document a woman shows an employer still stands, which is a
 * heavier call than editing a title.
 */

/* ---------------- permissions ---------------- */

export type LearningAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export async function apiLearningPermissions(isSuperAdmin: boolean) {
  const all: LearningAction[] = ["view", "create", "edit", "delete", "approve", "export"];
  if (isSuperAdmin) return new Set<LearningAction>(all);
  const { permissions } = await apiMyPermissions();
  return new Set<LearningAction>(all.filter((a) => permissions.includes(`learning.${a}`)));
}

/* ---------------- shared ---------------- */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Hand a CSV the server built to the browser's downloads. */
export function saveCsv(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- assessments ---------------- */

export type AssessmentStatus = "draft" | "published" | "archived";

export interface Question {
  n: number;
  ask: string;
  options: string[];
  /** Index of the correct option. Staff see it; the member app never does. */
  answer: number;
}

export interface QuestionInput {
  ask: string;
  options: string[];
  answer: number;
}

export interface AssessmentRow {
  id: string;
  skill: string;
  title: string;
  blurb: string;
  minutes: number;
  pass_mark: number;
  status: AssessmentStatus | string;
  question_count: number;
  /** Attempts that still count — struck-out ones are excluded from both. */
  attempt_count: number;
  pass_count: number;
  /** 0–100, or null when nobody has tried yet. */
  pass_rate: number | null;
  created_at: string;
  updated_at: string;
  /** Only filled by the single-test endpoints. */
  questions: Question[];
}

export interface AssessmentSummary {
  total: number;
  published: number;
  draft: number;
  archived: number;
  attempts: number;
  pass_rate: number | null;
}

export interface AssessmentPage extends Page<AssessmentRow> {
  summary: AssessmentSummary;
}

export interface AssessmentInput {
  skill: string;
  title: string;
  blurb: string;
  minutes: number;
  pass_mark: number;
  status: AssessmentStatus;
}

export interface AttemptRow {
  id: string;
  user_id: string;
  name: string;
  avatar: string;
  member_id: string;
  score: number;
  passed: boolean;
  invalidated: boolean;
  invalidated_reason: string;
  invalidated_at: string;
  invalidated_by: string;
  at: string;
}

export async function apiAssessments(params: { q?: string; status?: string; page?: number; page_size?: number } = {}) {
  const { data } = await apiClient.get<AssessmentPage>("/admin/learning/assessments", { params });
  return data;
}

export async function apiAssessment(id: string) {
  const { data } = await apiClient.get<AssessmentRow>(`/admin/learning/assessments/${id}`);
  return data;
}

export async function apiCreateAssessment(body: AssessmentInput) {
  const { data } = await apiClient.post<AssessmentRow>("/admin/learning/assessments", body);
  return data;
}

export async function apiUpdateAssessment(id: string, body: AssessmentInput) {
  const { data } = await apiClient.put<AssessmentRow>(`/admin/learning/assessments/${id}`, body);
  return data;
}

export async function apiDeleteAssessment(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/learning/assessments/${id}`);
  return data;
}

export const apiAssessmentsCsv = () =>
  apiClient.get("/admin/learning/assessments/export", { responseType: "blob" }).then((r) => r.data as Blob);

export async function apiAddQuestion(id: string, body: QuestionInput) {
  const { data } = await apiClient.post<AssessmentRow>(`/admin/learning/assessments/${id}/questions`, body);
  return data;
}

export async function apiEditQuestion(id: string, index: number, body: QuestionInput) {
  const { data } = await apiClient.put<AssessmentRow>(`/admin/learning/assessments/${id}/questions/${index}`, body);
  return data;
}

export async function apiRemoveQuestion(id: string, index: number) {
  const { data } = await apiClient.delete<AssessmentRow>(`/admin/learning/assessments/${id}/questions/${index}`);
  return data;
}

/** `order` is every question's current 0-based index, in the new order. */
export async function apiReorderQuestions(id: string, order: number[]) {
  const { data } = await apiClient.post<AssessmentRow>(`/admin/learning/assessments/${id}/questions/reorder`, { order });
  return data;
}

export async function apiAttempts(id: string, params: { page?: number; page_size?: number } = {}) {
  const { data } = await apiClient.get<Page<AttemptRow>>(`/admin/learning/assessments/${id}/attempts`, { params });
  return data;
}

export async function apiInvalidateAttempt(assessmentId: string, attemptId: string, reason: string) {
  const { data } = await apiClient.post<AttemptRow>(
    `/admin/learning/assessments/${assessmentId}/attempts/${attemptId}/invalidate`,
    { reason },
  );
  return data;
}

export const apiAttemptsCsv = (id: string) =>
  apiClient
    .get(`/admin/learning/assessments/${id}/attempts/export`, { responseType: "blob" })
    .then((r) => r.data as Blob);

/* ---------------- digital steps ---------------- */

export interface StepRow {
  id: string;
  n: number;
  label: string;
  note: string;
  minutes: number;
  /** Members who have marked this step done. */
  done_count: number;
  created_at: string;
}

export interface StepsOut {
  items: StepRow[];
  /** Distinct members with at least one step done. */
  members_started: number;
  completions: number;
}

export interface StepInput {
  label: string;
  note: string;
  minutes: number;
}

export async function apiSteps() {
  const { data } = await apiClient.get<StepsOut>("/admin/learning/digital-steps");
  return data;
}

export async function apiCreateStep(body: StepInput) {
  const { data } = await apiClient.post<StepsOut>("/admin/learning/digital-steps", body);
  return data;
}

export async function apiUpdateStep(id: string, body: StepInput) {
  const { data } = await apiClient.put<StepsOut>(`/admin/learning/digital-steps/${id}`, body);
  return data;
}

export async function apiDeleteStep(id: string) {
  const { data } = await apiClient.delete<StepsOut>(`/admin/learning/digital-steps/${id}`);
  return data;
}

/** `order` is every step id, in the new order. */
export async function apiReorderSteps(order: string[]) {
  const { data } = await apiClient.post<StepsOut>("/admin/learning/digital-steps/reorder", { order });
  return data;
}

/* ---------------- certificates ---------------- */

export interface CertificateRow {
  id: string;
  code: string;
  holder_name: string;
  user_id: string;
  member_id: string;
  avatar: string;
  program_id: string;
  program_name: string;
  hours: string;
  grade: string;
  issued_at: string;
  revoked: boolean;
  revoked_reason: string;
  revoked_at: string;
  revoked_by: string;
  reissued_at: string;
  /** "member" when she claimed it herself, else the admin who issued it. */
  issued_by: string;
}

export interface CertificateSummary {
  total: number;
  valid: number;
  revoked: number;
  this_month: number;
}

export interface CertificatePage extends Page<CertificateRow> {
  summary: CertificateSummary;
}

export interface VerifyOut {
  found: boolean;
  code: string;
  valid: boolean;
  holder_name: string;
  member_id: string;
  program_name: string;
  issued_at: string;
  revoked_reason: string;
  revoked_at: string;
}

export interface ProgrammeOption {
  id: string;
  name: string;
  status: string;
}

export interface MemberOption {
  id: string;
  full_name: string;
  member_id: string;
  avatar: string;
}

export interface IssueInput {
  user_id: string;
  program_id: string;
  holder_name: string;
  hours: string;
  grade: string;
}

export async function apiCertificates(params: { q?: string; state?: string; page?: number; page_size?: number } = {}) {
  const { data } = await apiClient.get<CertificatePage>("/admin/learning/certificates", { params });
  return data;
}

export async function apiVerifyCertificate(code: string) {
  const { data } = await apiClient.get<VerifyOut>(`/admin/learning/certificates/verify/${encodeURIComponent(code)}`);
  return data;
}

export async function apiCertificateProgrammes() {
  const { data } = await apiClient.get<ProgrammeOption[]>("/admin/learning/certificates/programmes");
  return data;
}

export async function apiCertificateMembers(q: string) {
  const { data } = await apiClient.get<MemberOption[]>("/admin/learning/certificates/members", { params: { q } });
  return data;
}

export async function apiIssueCertificate(body: IssueInput) {
  const { data } = await apiClient.post<CertificateRow>("/admin/learning/certificates", body);
  return data;
}

export async function apiRevokeCertificate(id: string, reason: string) {
  const { data } = await apiClient.post<CertificateRow>(`/admin/learning/certificates/${id}/revoke`, { reason });
  return data;
}

export async function apiReinstateCertificate(id: string) {
  const { data } = await apiClient.post<CertificateRow>(`/admin/learning/certificates/${id}/reinstate`);
  return data;
}

export async function apiReissueCertificate(id: string, holder_name: string) {
  const { data } = await apiClient.post<CertificateRow>(`/admin/learning/certificates/${id}/reissue`, { holder_name });
  return data;
}

/** Only a hand-issued certificate, and only once it is revoked. */
export async function apiDeleteCertificate(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/learning/certificates/${id}`);
  return data;
}

export const apiCertificatesCsv = () =>
  apiClient.get("/admin/learning/certificates/export", { responseType: "blob" }).then((r) => r.data as Blob);

/* ---------------- display helpers ---------------- */

export function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const STATUS_TONE: Record<string, "emerald" | "amber" | "slate"> = {
  published: "emerald",
  draft: "amber",
  archived: "slate",
};

export const STATUS_LABEL: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

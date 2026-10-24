import { apiClient } from "./api";

/**
 * Work by skill — backend: routes/work_talent.py.
 *
 * The category and skill masters, her work profile (each skill with its own
 * "show me to people hiring" switch, off by default), "Find people" for
 * verified members who want to hire, and the work chat's two special actions.
 */

export interface WorkSkillOption { key: string; name: string; popular: boolean }
export interface WorkCategory { key: string; name: string; skills: WorkSkillOption[] }

export interface ProfileSkill {
  key: string;
  name: string;
  category: string;
  category_name: string;
  /** "" | learning | 1-2 | 3-5 | 5+ */
  level: string;
  /** Switched on: people hiring can find her for this skill. */
  visible: boolean;
  /** She passed a WomSakhi skill test in this category. */
  verified: boolean;
}

export interface WorkProfile {
  skills: ProfileSkill[];
  work_types: string[];
  days: string[];
  area: string;
  city: string;
  /** False until she saves once (the first view is prefilled from onboarding). */
  saved: boolean;
  shown_for: number;
  levels: { key: string; label: string }[];
  work_type_options: string[];
  day_options: string[];
}

export interface WorkProfileInput {
  skills: { key: string; level: string; visible: boolean }[];
  work_types: string[];
  days: string[];
  area: string;
  city: string;
}

export interface TalentSkill { key: string; name: string; level: string; verified: boolean }
export interface Talent {
  user_id: string;
  first_name: string;
  avatar: string;
  area: string;
  city: string;
  /** Only the skills that matched the search — and only switched-on ones. */
  skills: TalentSkill[];
  /** Other skills she is happy to be found for. */
  also: string[];
  work_types: string[];
  days: string[];
  verified: boolean;
  /** Set when the searcher already has a chat with her. */
  conversation_id: string;
}

export interface TalentSearch {
  category?: string;
  skills?: string[];
  city?: string;
  work_type?: string;
  level?: string;
  verified_only?: boolean;
  page?: number;
}

const get = <T,>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

export const apiWorkTaxonomy = (s?: AbortSignal) =>
  get<{ categories: WorkCategory[] }>("/work/taxonomy", s).then((d) => d.categories);

export const apiMyWorkProfile = (s?: AbortSignal) => get<WorkProfile>("/work/profile", s);

export const apiSaveWorkProfile = (input: WorkProfileInput) =>
  apiClient.put<WorkProfile>("/work/profile", input).then((r) => r.data);

export const apiFindTalent = (q: TalentSearch, s?: AbortSignal) =>
  get<{ total: number; page: number; results: Talent[] }>("/work/talent", s, {
    ...q,
    skills: q.skills?.length ? q.skills.join(",") : undefined,
    verified_only: q.verified_only || undefined,
  });

export const apiMessageTalent = (userId: string, text: string, skills: string[] = []) =>
  apiClient.post<{ conversation_id: string; delivered_to: string }>(`/work/talent/${userId}/message`, { text, skills })
    .then((r) => r.data);

export const apiShareMyNumber = (conversationId: string) =>
  apiClient.post<{ ok: boolean }>(`/work/conversations/${conversationId}/share-number`).then((r) => r.data);

export const apiNotInterested = (conversationId: string) =>
  apiClient.post<{ ok: boolean }>(`/work/conversations/${conversationId}/not-interested`).then((r) => r.data);

/* ── staff: the masters ─────────────────────────────────────────────── */

export interface AdminWorkSkill {
  key: string; name: string; active: boolean; popular: boolean; sort: number;
  /** Members who listed it, and how many of them switched it on. */
  members: number; shown: number;
}
export interface AdminWorkCategory {
  key: string; name: string; active: boolean; sort: number; members: number; skills: AdminWorkSkill[];
}

export const apiAdminWorkTaxonomy = () =>
  apiClient.get<{ categories: AdminWorkCategory[] }>("/admin/work/taxonomy").then((r) => r.data.categories);
export const apiAdminAddWorkCategory = (name: string) =>
  apiClient.post<{ key: string }>("/admin/work/categories", { name }).then((r) => r.data);
export const apiAdminEditWorkCategory = (key: string, body: Partial<Pick<AdminWorkCategory, "name" | "active" | "sort">>) =>
  apiClient.patch(`/admin/work/categories/${key}`, body).then((r) => r.data);
export const apiAdminAddWorkSkill = (category: string, name: string, popular = false) =>
  apiClient.post<{ key: string }>("/admin/work/skills", { category, name, popular }).then((r) => r.data);
export const apiAdminEditWorkSkill = (key: string, body: Partial<Pick<AdminWorkSkill, "name" | "active" | "popular" | "sort">> & { category?: string }) =>
  apiClient.patch(`/admin/work/skills/${key}`, body).then((r) => r.data);

/* ── job posts by verified members (same collection as Find work) ───── */

export const JOB_KINDS = ["Job", "Freelance", "Craft order", "Internship", "Training"] as const;
export const JOB_MODES = ["On-site", "Remote", "Hybrid"] as const;

export interface JobInput {
  title: string;
  category: string;
  /** 1–10 keys from the masters. */
  skill_keys: string[];
  kind: string;
  mode: string;
  location: string;
  pay: string;
  openings: number;
  /** YYYY-MM-DD or "". */
  deadline: string;
  desc: string;
  experience: string;
}

/** A job post as Find work returns it (`/growth/opportunities` shape). */
export interface MyJobPost {
  id: string; title: string; org: string; kind: string; desc: string; location: string; mode: string;
  pay: string; skills: string[]; category: string; category_name: string; skill_keys: string[];
  openings: number; deadline: string; deadline_label: string; experience: string;
  applicant_count: number; status: "open" | "closed"; posted: string; owner_kind: string;
}

export interface Applicant {
  application_id: string;
  user_id: string;
  first_name: string;
  avatar: string;
  area: string;
  city: string;
  /** Her skills this job needs, when she applied. */
  skills: { key: string; name: string; level: string; verified: boolean }[];
  note: string;
  /** applied | shortlisted | interview | offered | closed */
  status: string;
  applied_on: string;
  conversation_id: string;
}

export const apiPostJob = (input: JobInput) =>
  apiClient.post<MyJobPost>("/work/jobs", input).then((r) => r.data);
export const apiEditJob = (id: string, input: JobInput) =>
  apiClient.put<MyJobPost>(`/work/jobs/${id}`, input).then((r) => r.data);
export const apiMyJobPosts = (s?: AbortSignal) => get<MyJobPost[]>("/work/jobs/mine", s);
export const apiSetJobOpen = (id: string, open: boolean) =>
  apiClient.post<{ ok: boolean }>(`/work/jobs/${id}/${open ? "reopen" : "close"}`).then((r) => r.data);
export const apiJobApplicants = (id: string, s?: AbortSignal) => get<Applicant[]>(`/work/jobs/${id}/applicants`, s);
export const apiMoveApplicant = (applicationId: string, status: "shortlisted" | "interview" | "offered" | "closed", note = "") =>
  apiClient.post<{ ok: boolean }>(`/work/applications/${applicationId}/move`, { status, note }).then((r) => r.data);
export const apiMessageApplicant = (applicationId: string, text: string) =>
  apiClient.post<{ conversation_id: string; delivered_to: string }>(`/work/applications/${applicationId}/message`, { text })
    .then((r) => r.data);

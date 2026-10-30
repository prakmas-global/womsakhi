import { apiClient } from "./api";

/**
 * Her profile's evidence — backend: routes/portfolio.py.
 *
 * "What you made": photos of finished work, each shown to other members or
 * kept for herself. "Helping others": counts of what actually happened.
 */

export interface PortfolioItem {
  id: string;
  title: string;
  photo: string;
  category: string;
  made_for: string;
  year: number | null;
  /** Shown on her profile to other members. */
  visible: boolean;
  added: string;
}

export interface PortfolioInput {
  title: string;
  photo: string;
  category?: string;
  made_for?: string;
  year?: number | null;
  visible?: boolean;
}

export interface Impact {
  women_helped: number;
  courses: number;
  learners: number;
  finished_course: number;
  mentoring_sessions: number;
  mentees: number;
  answers: number;
  verified_answers: number;
  circles_hosted: number;
  circle_members: number;
  women_hired: number;
  is_teacher: boolean;
  is_mentor: boolean;
}

export interface VerifiedSkillRow { skill: string; title: string; score: number; code: string }

const get = <T,>(url: string, signal?: AbortSignal) => apiClient.get<T>(url, { signal }).then((r) => r.data);

export const PORTFOLIO_MAX = 30;

export const apiMyPortfolio = (s?: AbortSignal) => get<PortfolioItem[]>("/me/portfolio", s);
export const apiAddPortfolio = (input: PortfolioInput) =>
  apiClient.post<PortfolioItem>("/me/portfolio", input).then((r) => r.data);
export const apiEditPortfolio = (id: string, patch: Partial<Pick<PortfolioItem, "title" | "made_for" | "visible">>) =>
  apiClient.patch<PortfolioItem>(`/me/portfolio/${id}`, patch).then((r) => r.data);
export const apiDeletePortfolio = (id: string) =>
  apiClient.delete<{ ok: boolean }>(`/me/portfolio/${id}`).then((r) => r.data);
export const apiMemberPortfolio = (userId: string, s?: AbortSignal) =>
  get<{ first_name: string; items: PortfolioItem[] }>(`/me/portfolio/of/${userId}`, s);
export const apiMyImpact = (s?: AbortSignal) => get<Impact>("/me/portfolio/impact", s);
/** Skills she proved by passing a WomSakhi test (routes/skills.py). */
export const apiMyVerifiedSkills = (s?: AbortSignal) => get<VerifiedSkillRow[]>("/me/skills", s);

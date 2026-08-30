import { apiClient } from "./api";
import type { ThemeChoice } from "@/theme-engine";

/** Colour theme and onboarding progress — both live on the account. */

export interface OnboardingState {
  steps: string[];
  done: string[];
  complete: boolean;
  next_step: string | null;
}

export async function apiMyTheme() {
  const { data } = await apiClient.get<ThemeChoice>("/theme/me");
  return data;
}

export async function apiSaveMyTheme(theme: ThemeChoice) {
  const { data } = await apiClient.put<ThemeChoice>("/theme/me", theme);
  return data;
}

export async function apiMemberTheme(memberId: string) {
  const { data } = await apiClient.get<ThemeChoice>(`/theme/member/${memberId}`);
  return data;
}

/** Staff setting a member's colours — she is notified when this happens. */
export async function apiSetMemberTheme(memberId: string, theme: ThemeChoice) {
  const { data } = await apiClient.put<ThemeChoice>(`/theme/member/${memberId}`, theme);
  return data;
}

export async function apiOnboarding() {
  const { data } = await apiClient.get<OnboardingState>("/theme/onboarding");
  return data;
}

export async function apiFinishStep(step: string) {
  const { data } = await apiClient.post<OnboardingState>("/theme/onboarding/step", { step });
  return data;
}

export async function apiFinishOnboarding() {
  const { data } = await apiClient.post<OnboardingState>("/theme/onboarding/finish");
  return data;
}

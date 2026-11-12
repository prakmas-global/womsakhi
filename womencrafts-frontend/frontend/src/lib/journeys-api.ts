import { apiClient } from "./api";

export type JourneyGoal = "learn" | "sell" | "work";
export interface JourneyStep { id: string; title: string; detail: string; href: string; done: boolean }
export interface MemberJourney { id: JourneyGoal; title: string; note: string; steps: JourneyStep[]; action: string; href: string }

export const apiMyJourneys = async (signal?: AbortSignal) =>
  (await apiClient.get<MemberJourney[]>("/me/journeys", { signal })).data;

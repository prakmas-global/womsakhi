import type { FreeTime, Goal, LearnTopic, MeetChoice, Minutes } from "@/lib/onboarding-api";
import type { ArtName } from "./art";

/** The words she sees for each backend key. English only for now. */

export const GOALS: { key: Goal; label: string; art?: ArtName }[] = [
  { key: "learn", label: "Learn a skill", art: "learn" },
  { key: "earn_home", label: "Earn from home", art: "earn" },
  { key: "find_job", label: "Find a job", art: "job" },
  { key: "sell", label: "Sell what I make", art: "sell" },
  { key: "meet", label: "Meet women like me", art: "meet" },
  { key: "shop", label: "Shop fashion & more", art: "shop" },
  { key: "feel_good", label: "Feel good", art: "calm" },
  { key: "just_looking", label: "Just looking around" },
];

/** The six learning categories the app already has (backend LEARN_TOPICS). */
export const LEARN_TOPICS: { key: LearnTopic; label: string }[] = [
  { key: "digital", label: "Phone & digital" },
  { key: "money", label: "Money & business" },
  { key: "career", label: "Work & career" },
  { key: "personal", label: "Confidence" },
  { key: "technology", label: "Computers & tech" },
  { key: "health", label: "Health" },
];

export const MEET: { key: MeetChoice; label: string }[] = [
  { key: "women_near_me", label: "Women near me" },
  { key: "same_skill", label: "Women with my skill" },
  { key: "new_mothers", label: "New mothers" },
  { key: "starting_business", label: "Starting a business" },
];

export const FREE_TIMES: { key: FreeTime; label: string; plural: string }[] = [
  { key: "morning", label: "Morning", plural: "Mornings" },
  { key: "afternoon", label: "Afternoon", plural: "Afternoons" },
  { key: "evening", label: "Evening", plural: "Evenings" },
  { key: "weekends", label: "Weekends", plural: "Weekends" },
];

export const MINUTES: Minutes[] = [10, 20, 30];

/** The goals that bring the skills question. */
export const SKILL_GOALS: Goal[] = ["earn_home", "sell", "find_job"];

export const MAX_SKILLS = 10;

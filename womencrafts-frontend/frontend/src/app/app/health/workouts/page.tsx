import { redirect } from "next/navigation";

/**
 * Workouts now live in Health & Wellness → Fitness (guided routines, a log,
 * plans, progress and challenges). This address forwards there so old links
 * and bookmarks still work.
 */
export default function WorkoutsMoved() {
  redirect("/app/health/fitness?tab=workouts");
}

import { redirect } from "next/navigation";

/**
 * Retired — this was a second goals screen.
 *
 * /app/goals carries the same idea with full create, edit, pause and delete,
 * each with its own confirmation and success state. Two goals screens meant
 * a goal added in one was invisible in the other.
 */
export default function RetiredProgressGoalsRoute() {
  redirect("/app/goals");
}

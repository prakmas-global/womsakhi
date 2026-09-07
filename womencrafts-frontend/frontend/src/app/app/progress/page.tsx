import { redirect } from "next/navigation";

/**
 * Retired — this was a second "Your journey".
 *
 * The account menu offered "Your journey" pointing here while the Home rail
 * offered "My journey" pointing at /app/journey, and both screens answered
 * "what should I do next?" differently. A woman had two entries, two names and
 * two answers for one question.
 *
 * /app/journey kept it: it carries the Skill→Income stage machine and the Next
 * Best Step engine that Home and Discover also read, so there is one source of
 * truth for where she is. What only this screen had — her real milestones from
 * the live API — moved across with it.
 *
 * A redirect, not a deletion: this path is in her history and in the account
 * menu people have already learned.
 */
export default function RetiredProgressRoute() {
  redirect("/app/journey");
}

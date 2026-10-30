import { redirect } from "next/navigation";

/**
 * "If something goes wrong" showed the same insurance and pension list as
 * Health → Health cover, which carries all of it (PM-JAY first, then accident,
 * life and pension) with her status on each. One place now; this address
 * forwards there so old links still work.
 */
export default function CoverMoved() {
  redirect("/app/health/cover");
}

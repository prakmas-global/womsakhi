import { redirect } from "next/navigation";

/**
 * Retired — this was a second screen for teach-and-learn.
 *
 * `/app/library` and this route were both "teach what you know, learn what you
 * need", with separate data sources and separate names for the same idea. Two
 * screens a woman cannot tell apart are two screens she has to choose between
 * for no reason, and the one that loses gets stale.
 *
 * `/app/library` kept it: richer, with exchange tracking this one never had.
 * The one thing this screen had that it did not — the finding that women taught
 * alongside a friend keep what they learn, and women taught alone mostly do not
 * — moved across with it.
 *
 * A redirect rather than a deletion: links to this path exist in the wild, in
 * her history and in messages she has been sent, and a 404 is a worse answer
 * than the right screen.
 */
export default function RetiredLearnRoute() {
  redirect("/app/library");
}

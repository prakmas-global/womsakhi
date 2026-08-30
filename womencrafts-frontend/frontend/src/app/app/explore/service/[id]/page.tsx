import { redirect } from "next/navigation";

/**
 * A duplicate detail page, removed.
 *
 * A service is booked with a mentor, and that screen lives at
 * `/app/mentors/[id]`. See the note in `explore/program/[id]` — Discover points
 * at the module that owns a thing rather than keeping its own copy.
 */
export default async function ExploreServiceRedirect(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  redirect(`/app/mentors/${id}`);
}

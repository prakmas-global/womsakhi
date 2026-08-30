import { redirect } from "next/navigation";

/**
 * A duplicate detail page, removed.
 *
 * A programme's real home is `/app/programs/[id]`. Keeping a second, subtly
 * different copy of the same screen under Discover is how two pages end up
 * disagreeing about the same course — Discover is a lens over the app, not a
 * second store of it.
 *
 * Redirect rather than delete, so old links and anything already shared still
 * land somewhere correct.
 */
export default async function ExploreProgramRedirect(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  redirect(`/app/programs/${id}`);
}

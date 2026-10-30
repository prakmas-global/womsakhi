import { redirect } from "next/navigation";

/** One scheme — now opened in What you are owed, which reads the same list. */
export default async function SchemeMoved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/haq/${encodeURIComponent(id)}`);
}

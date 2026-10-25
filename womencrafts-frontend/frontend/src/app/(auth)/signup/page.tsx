import { redirect } from "next/navigation";

/**
 * Joining and signing in are one screen now (/signin): she types her mobile
 * number or email, the code decides whether she is new, and a new woman gets
 * one short "about you" step. Old links — invitations, "Refer a friend"
 * (`?ref=`), sign-in's old "Join" button — land there with their query intact.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/signin?${query}` : "/signin");
}
